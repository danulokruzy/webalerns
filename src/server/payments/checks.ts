import type { DonationCheck } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { CHECK_LIFETIME_MS } from "@/server/constants";
import { amountLabel, getPaymentProvider, normalizeAmountToUahStep, createCryptobotInvoice } from "@/server/payments/providers";
import { convertToUah, getRates } from "@/server/rates";
import { runMatchedActions } from "@/server/actions/engine";
import { CHECK_STATUS, MATCH_TYPE, PAYMENT_CHANNEL, type PaymentChannel } from "@/server/domain";

type CreateCheckInput = {
  donorName: string;
  message: string;
  youtubeUrl?: string;
  voiceUrl?: string;
  amount: number;
  channel: "uah" | "cryptobot" | "tonpay";
};

type VerifyPayload = {
  checkId?: string;
  channel: "uah" | "cryptobot" | "tonpay";
  comment?: string;
  txHash?: string;
  paidAmount?: number;
  donorName?: string;
  message?: string;
  allowAnonymousOnFail?: boolean;
  verifyOnly?: boolean;
};

const donorCreateLocks = new Set<string>();

async function withDonorCreateLock<T>(donorName: string, run: () => Promise<T>): Promise<T> {
  const key = donorName.toLowerCase();
  if (donorCreateLocks.has(key)) {
    throw new Error("Попередній запит ще обробляється. Зачекайте кілька секунд.");
  }

  donorCreateLocks.add(key);
  try {
    return await run();
  } finally {
    donorCreateLocks.delete(key);
  }
}

function toDbChannel(channel: CreateCheckInput["channel"]): PaymentChannel {
  if (channel === "uah") return PAYMENT_CHANNEL.UAH;
  if (channel === "cryptobot") return PAYMENT_CHANNEL.CRYPTOBOT;
  return PAYMENT_CHANNEL.TONPAY;
}

function mapMatchType(type: "code" | "amount_time" | "crypto_tx" | "manual" | "unknown"): string {
  if (type === "code") return MATCH_TYPE.CODE;
  if (type === "amount_time") return MATCH_TYPE.AMOUNT_TIME;
  if (type === "crypto_tx") return MATCH_TYPE.CRYPTO_TX;
  if (type === "manual") return MATCH_TYPE.MANUAL;
  return MATCH_TYPE.UNKNOWN;
}

function generateCheckCode(prefix: string): string {
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${suffix}`;
}

function toNanoTon(amountTon: number): bigint {
  return BigInt(Math.round(amountTon * 1_000_000_000));
}

export async function expireOldChecks() {
  await prisma.donationCheck.updateMany({
    where: {
      status: CHECK_STATUS.PENDING,
      expiresAt: { lte: new Date() },
    },
    data: { status: CHECK_STATUS.EXPIRED },
  });
}

async function getSettings() {
  const settings = await prisma.paymentSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!settings) throw new Error("Налаштування оплати не знайдені.");
  return settings;
}

async function runTonScanner(check: {
  id: string;
  code: string;
  amountOriginal: number;
  createdAt: Date;
}) {
  const settings = await getSettings();
  const receiver = settings.tonReceiverAddress?.trim();
  if (!receiver) return null;

  try {
    const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(
      receiver
    )}&limit=25`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      ok?: boolean;
      result?: Array<{
        utime?: number;
        in_msg?: { value?: string; message?: string | null };
        transaction_id?: { hash?: string };
      }>;
    };
    if (!data.ok || !Array.isArray(data.result)) return null;

    const expectedNano = toNanoTon(check.amountOriginal);
    const createdMs = check.createdAt.getTime();

    for (const tx of data.result) {
      const utimeMs = Number(tx.utime || 0) * 1000;
      if (utimeMs < createdMs - 5 * 60 * 1000) continue;
      const valueRaw = tx.in_msg?.value;
      if (!valueRaw) continue;
      let valueNano: bigint;
      try {
        valueNano = BigInt(valueRaw);
      } catch {
        continue;
      }
      if (valueNano !== expectedNano) continue;

      const messageText = (tx.in_msg?.message || "").toUpperCase();
      const codeMatch = messageText.includes(check.code.toUpperCase());
      const txHash = tx.transaction_id?.hash || "";
      return {
        txHash,
        comment: codeMatch ? check.code : tx.in_msg?.message || "",
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function markDonationPaid(params: {
  check: {
    id: string;
    code: string;
    channel: string;
    donorName: string;
    message: string;
    amountOriginal: number;
    amountLabel: string;
    amountUah: number;
    youtubeUrl: string | null;
    voiceUrl: string | null;
  };
  matchType: "code" | "amount_time" | "crypto_tx" | "manual" | "unknown";
  txHash?: string;
  comment?: string;
  observedAmount?: number;
  observedAmountUah?: number;
  anonymous?: boolean;
}) {
  const donation = await prisma.$transaction(async (tx) => {
    const updatedCheck = await tx.donationCheck.update({
      where: { id: params.check.id },
      data: {
        status: CHECK_STATUS.PAID,
        verifiedAt: new Date(),
      },
    });

    const record = await tx.donation.create({
      data: {
        checkId: updatedCheck.id,
        donorName: updatedCheck.donorName,
        message: updatedCheck.message,
        channel: updatedCheck.channel,
        amountOriginal: updatedCheck.amountOriginal,
        amountLabel: updatedCheck.amountLabel,
        amountUah: updatedCheck.amountUah,
        youtubeUrl: updatedCheck.youtubeUrl,
        voiceUrl: updatedCheck.voiceUrl,
        isAnonymous: params.anonymous ?? false,
      },
    });

    await tx.paymentMatch.create({
      data: {
        checkId: updatedCheck.id,
        donationId: record.id,
        type: mapMatchType(params.matchType),
        success: true,
        provider: updatedCheck.channel,
        comment: params.comment,
        transactionRef: params.txHash,
        amountObservedUah: params.observedAmountUah ?? updatedCheck.amountUah,
      },
    });
    return record;
  });

  if (params.anonymous) {
    await prisma.eventLog.create({
      data: {
        type: "DONATION",
        message: `Чек ${params.check.code} зараховано анонімно без тригерів.`,
        payloadJson: JSON.stringify({ checkId: params.check.id, donationId: donation.id }),
      },
    });
    return { donation, triggered: [] as string[] };
  }

  const triggered = await runMatchedActions({
    amountUah: normalizeAmountToUahStep(donation.amountUah),
    donationId: donation.id,
    channel: donation.channel,
  });

  await prisma.eventLog.create({
    data: {
      type: "DONATION",
      message: `Платіж за чеком ${params.check.code} підтверджено.`,
      payloadJson: JSON.stringify({
        checkId: params.check.id,
        donationId: donation.id,
        matchType: params.matchType,
        triggered,
      }),
    },
  });

  return { donation, triggered };
}

async function createAnonymousDonation(payload: VerifyPayload, amountUah: number) {
  const channel = toDbChannel(payload.channel);
  const amountOriginal = payload.paidAmount ?? amountUah;
  const donation = await prisma.donation.create({
    data: {
      donorName: payload.donorName?.trim() || "Анонім",
      message: payload.message?.trim() || "Оплата без коду/матчингу",
      channel,
      amountOriginal,
      amountLabel: amountLabel(channel, amountOriginal),
      amountUah,
      isAnonymous: true,
    },
  });

  await prisma.eventLog.create({
    data: {
      type: "DONATION",
      message: "Отримано анонімний донат без чіткого матчингу.",
      payloadJson: JSON.stringify({ donationId: donation.id, amountUah }),
    },
  });
  return donation;
}

async function matchCheckByAmountAndTime(payload: VerifyPayload) {
  if (typeof payload.paidAmount !== "number") return null;
  const channel = toDbChannel(payload.channel);
  const now = new Date();
  const start = new Date(now.getTime() - 20 * 60 * 1000);
  return prisma.donationCheck.findFirst({
    where: {
      channel,
      status: CHECK_STATUS.PENDING,
      amountOriginal: payload.paidAmount,
      createdAt: { gte: start, lte: now },
    },
    orderBy: { createdAt: "asc" },
  });
}

type CheckResolveResult = {
  check: DonationCheck | null;
  source: "id" | "code" | "amount_time" | "none";
};

async function resolveCheck(payload: VerifyPayload): Promise<CheckResolveResult> {
  let check = payload.checkId
    ? await prisma.donationCheck.findUnique({ where: { id: payload.checkId } })
    : null;
  if (check) return { check, source: "id" };

  if (!check && payload.comment?.trim()) {
    const comment = payload.comment.trim().toUpperCase();
    const pending = await prisma.donationCheck.findMany({
      where: { status: CHECK_STATUS.PENDING },
      select: { id: true, code: true },
      take: 300,
    });
    const matchedId = pending.find((row) => comment.includes(row.code.toUpperCase()))?.id;
    if (matchedId) {
      check = await prisma.donationCheck.findUnique({ where: { id: matchedId } });
      if (check) return { check, source: "code" };
    }
  }

  if (!check && payload.channel === "uah") {
    check = await matchCheckByAmountAndTime(payload);
    if (check) return { check, source: "amount_time" };
  }

  return { check: null, source: "none" };
}

async function ensureUniqueUahAmount(baseAmount: number): Promise<number> {
  // Check if the exact amount is already taken by a pending UAH check
  const existing = await prisma.donationCheck.count({
    where: {
      status: CHECK_STATUS.PENDING,
      channel: PAYMENT_CHANNEL.UAH,
      amountOriginal: baseAmount,
    },
  });
  if (existing === 0) return baseAmount;

  // Amount is taken — try small offsets (±0.01 to ±0.99)
  for (let attempt = 0; attempt < 50; attempt++) {
    const offset = (Math.floor(Math.random() * 99) + 1) / 100;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const candidate = Math.round((baseAmount + sign * offset) * 100) / 100;
    if (candidate <= 0) continue;
    const taken = await prisma.donationCheck.count({
      where: {
        status: CHECK_STATUS.PENDING,
        channel: PAYMENT_CHANNEL.UAH,
        amountOriginal: candidate,
      },
    });
    if (taken === 0) return candidate;
  }
  // Extremely unlikely fallback — just use base amount
  return baseAmount;
}

export async function createDonationCheck(input: CreateCheckInput) {
  await expireOldChecks();
  const donorName = input.donorName.trim();
  const amount = Number(input.amount);

  if (!donorName) throw new Error("Вкажіть ім'я донатера.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Некоректна сума.");

  return withDonorCreateLock(donorName, async () => {
    const channel = toDbChannel(input.channel);
    const settings = await getSettings();

  if (channel === PAYMENT_CHANNEL.UAH) {
    if (amount < settings.minAmountUah || amount > settings.maxAmountUah) {
      throw new Error(`Сума має бути в межах ${settings.minAmountUah}-${settings.maxAmountUah} грн.`);
    }
  }

    const existingPending = await prisma.donationCheck.findFirst({
      where: { donorName, status: CHECK_STATUS.PENDING },
      orderBy: { createdAt: "desc" },
    });
    if (existingPending) {
      return existingPending;
    }

  const activeByDonor = await prisma.donationCheck.count({
    where: { donorName, status: CHECK_STATUS.PENDING },
  });
  if (activeByDonor >= 1) {
    throw new Error("У вас вже є активний чек. Завершіть або скасуйте його перед новим.");
  }

  if (channel !== PAYMENT_CHANNEL.UAH) {
    const sameAmount = await prisma.donationCheck.count({
      where: {
        status: CHECK_STATUS.PENDING,
        channel,
        amountOriginal: amount,
      },
    });
    if (sameAmount > 0) {
      throw new Error("На цю суму вже є активний крипто-чек. Змініть суму або зачекайте.");
    }
  }

  // For UAH: ensure unique amount among pending checks (add kopecks if needed)
  let finalAmount = amount;
  if (channel === PAYMENT_CHANNEL.UAH) {
    finalAmount = await ensureUniqueUahAmount(amount);
  }

  const rates = await getRates();
  const amountUah = convertToUah(finalAmount, input.channel, rates);
  const code = generateCheckCode(settings.paymentMemoPrefix || "DON");
  const provider = getPaymentProvider(channel);
  let payUrl = provider.createCheckUrl(
    {
      channel,
      amountOriginal: finalAmount,
      checkCode: code,
      donorName,
    },
    settings
  );

  // For CRYPTOBOT, create a real invoice via Crypto Pay API
  if (channel === PAYMENT_CHANNEL.CRYPTOBOT) {
    const conn = await prisma.connection.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { cryptobotToken: true },
    });
    const token = conn?.cryptobotToken?.trim();
    if (token) {
      payUrl = await createCryptobotInvoice(
        { channel, amountOriginal: finalAmount, checkCode: code, donorName },
        token
      );
    }
  }

  // For UAH, fetch card number to include in metadata
  let cardNumber = "";
  if (channel === PAYMENT_CHANNEL.UAH) {
    const conn = await prisma.connection.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { monobankCardNumber: true },
    });
    cardNumber = conn?.monobankCardNumber?.trim() || "";
  }

  const check = await prisma.donationCheck.create({
    data: {
      code,
      channel,
      donorName,
      message: input.message?.trim() || "",
      youtubeUrl: input.youtubeUrl?.trim() || null,
      voiceUrl: input.voiceUrl?.trim() || null,
      amountOriginal: finalAmount,
      amountLabel: amountLabel(channel, finalAmount),
      amountUah,
      metaJson: cardNumber ? JSON.stringify({ cardNumber }) : null,
      payUrl,
      status: CHECK_STATUS.PENDING,
      expiresAt: new Date(Date.now() + CHECK_LIFETIME_MS),
    },
  });

  await prisma.eventLog.create({
    data: {
      type: "CHECK",
      message: `Створено чек ${check.code}`,
      payloadJson: JSON.stringify({ checkId: check.id, channel, amount }),
    },
  });

    return check;
  });
}

export async function cancelDonationCheck(checkId: string) {
  const existing = await prisma.donationCheck.findUnique({ where: { id: checkId } });
  if (!existing) throw new Error("Чек не знайдено.");
  if (existing.status !== CHECK_STATUS.PENDING) return existing;

  const updated = await prisma.donationCheck.update({
    where: { id: checkId },
    data: {
      status: CHECK_STATUS.CANCELLED,
      cancelledAt: new Date(),
    },
  });

  await prisma.eventLog.create({
    data: {
      type: "CHECK",
      message: `Чек ${updated.code} скасовано`,
      payloadJson: JSON.stringify({ checkId }),
    },
  });
  return updated;
}

export async function verifyDonation(payload: VerifyPayload) {
  await expireOldChecks();
  const channel = toDbChannel(payload.channel);
  const rates = await getRates();

  const resolved = await resolveCheck(payload);
  const check = resolved.check;
  if (!check) {
    if (!payload.allowAnonymousOnFail) {
      return { ok: false, status: "not_found" as const };
    }
    const amountUah =
      payload.channel === "uah"
        ? payload.paidAmount ?? 0
        : convertToUah(payload.paidAmount ?? 0, payload.channel, rates);
    const anonymous = await createAnonymousDonation(payload, amountUah);
    return { ok: true, status: "anonymous" as const, donationId: anonymous.id };
  }

  if (check.status !== CHECK_STATUS.PENDING) {
    return { ok: true, status: "already_processed" as const, check };
  }

  let txHash = payload.txHash?.trim() || "";
  let comment = payload.comment?.trim() || "";

  if (channel === PAYMENT_CHANNEL.CRYPTOBOT && !txHash) {
    const match = await prisma.paymentMatch.findFirst({
      where: {
        checkId: check.id,
        provider: PAYMENT_CHANNEL.CRYPTOBOT,
        success: true,
      },
      orderBy: { createdAt: "desc" },
    });
    if (match) {
      txHash = match.transactionRef?.trim() || `cryptobot-webhook-${match.id}`;
      if (!comment && match.comment) {
        comment = match.comment;
      }
    }
  }

  if (channel === PAYMENT_CHANNEL.TONPAY && !txHash) {
    const tonScan = await runTonScanner(check);
    if (tonScan?.txHash) {
      txHash = tonScan.txHash;
      if (!comment && tonScan.comment) comment = tonScan.comment;
    }
  }

  const provider = getPaymentProvider(channel);
  const verification = await provider.verifyPayment({
    checkCode: check.code,
    comment,
    amountObserved: payload.paidAmount,
    txHash,
  });

  const isAmountTimeMatch = resolved.source === "amount_time";
  const confirmed = verification.success || isAmountTimeMatch;
  const matchType = confirmed
    ? verification.success
      ? verification.matchType
      : "amount_time"
    : "unknown";

  if (!confirmed) {
    if (payload.allowAnonymousOnFail && channel === PAYMENT_CHANNEL.UAH) {
      const { donation } = await markDonationPaid({
        check,
        matchType: "manual",
        comment: "anonymous_without_code",
        anonymous: true,
      });
      return {
        ok: true,
        status: "anonymous" as const,
        donationId: donation.id,
        checkId: check.id,
      };
    }

    if (payload.verifyOnly) {
      return { ok: true, status: "pending" as const, checkId: check.id };
    }

    if (payload.allowAnonymousOnFail) {
      const amountUah =
        payload.channel === "uah"
          ? payload.paidAmount ?? check.amountOriginal
          : convertToUah(payload.paidAmount ?? check.amountOriginal, payload.channel, rates);
      const anonymous = await createAnonymousDonation(payload, amountUah);
      await prisma.paymentMatch.create({
        data: {
          checkId: check.id,
          donationId: anonymous.id,
          type: MATCH_TYPE.UNKNOWN,
          success: false,
          provider: channel,
          comment,
          transactionRef: txHash || null,
          amountObservedUah: amountUah,
        },
      });
      return { ok: true, status: "anonymous" as const, donationId: anonymous.id };
    }

    return { ok: true, status: "pending" as const, checkId: check.id };
  }

  const observedAmountUah =
    payload.channel === "uah"
      ? payload.paidAmount ?? check.amountOriginal
      : convertToUah(payload.paidAmount ?? check.amountOriginal, payload.channel, rates);

  const { donation, triggered } = await markDonationPaid({
    check,
    matchType,
    txHash,
    comment,
    observedAmount: payload.paidAmount,
    observedAmountUah,
    anonymous: false,
  });

  return {
    ok: true,
    status: "paid" as const,
    donationId: donation.id,
    checkId: check.id,
    triggeredActionIds: triggered,
  };
}

export async function getPublicSummary() {
  await expireOldChecks();
  const [donations, checks] = await Promise.all([
    prisma.donation.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.donationCheck.findMany({
      where: { status: CHECK_STATUS.PENDING },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return { donations, checks };
}
