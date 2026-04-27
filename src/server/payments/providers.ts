import type { PaymentSettings } from "@prisma/client";
import { PAYMENT_CHANNEL, type PaymentChannel } from "@/server/domain";

export type PaymentProviderInput = {
  channel: PaymentChannel;
  amountOriginal: number;
  checkCode: string;
  donorName: string;
};

export type PaymentProvider = {
  channel: PaymentChannel;
  createCheckUrl: (input: PaymentProviderInput, settings: PaymentSettings) => string;
  verifyPayment: (args: {
    checkCode: string;
    comment?: string;
    amountObserved?: number;
    txHash?: string;
  }) => Promise<{
    success: boolean;
    matchType: "code" | "amount_time" | "crypto_tx" | "manual" | "unknown";
  }>;
};

function buildUahUrl(input: PaymentProviderInput, settings: PaymentSettings) {
  const base = settings.uahPaymentUrl?.trim();
  if (!base) return "https://send.monobank.ua/";
  const divider = base.includes("?") ? "&" : "?";
  return `${base}${divider}amount=${input.amountOriginal}&comment=${encodeURIComponent(input.checkCode)}`;
}

export async function createCryptobotInvoice(
  input: PaymentProviderInput,
  token: string
): Promise<string> {
  try {
    const response = await fetch("https://pay.crypt.bot/api/createInvoice", {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset: "USDT",
        amount: String(input.amountOriginal),
        description: `Донат від ${input.donorName}`,
        payload: input.checkCode,
        allow_comments: true,
        allow_anonymous: false,
      }),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      result?: { bot_invoice_url?: string; pay_url?: string };
    };
    if (data.ok && data.result) {
      return data.result.bot_invoice_url || data.result.pay_url || "https://t.me/CryptoBot";
    }
  } catch {
    // fallback to static URL
  }
  return "https://t.me/CryptoBot";
}

function buildCryptobotUrl(input: PaymentProviderInput, settings: PaymentSettings) {
  const base = settings.cryptobotUsdtUrl?.trim();
  if (!base) return "https://t.me/CryptoBot";
  const divider = base.includes("?") ? "&" : "?";
  return `${base}${divider}asset=USDT&amount=${input.amountOriginal}&comment=${encodeURIComponent(input.checkCode)}`;
}

function toNanoTon(amountTon: number): string {
  const nano = BigInt(Math.round(amountTon * 1_000_000_000));
  return nano.toString();
}

function buildTonWalletUrl(input: PaymentProviderInput, settings: PaymentSettings) {
  const receiver = settings.tonReceiverAddress?.trim();
  if (receiver) {
    const nano = toNanoTon(input.amountOriginal);
    return `ton://transfer/${encodeURIComponent(receiver)}?amount=${nano}&text=${encodeURIComponent(
      input.checkCode
    )}`;
  }

  const fallback = settings.tonPayUrl?.trim();
  if (fallback) {
    const divider = fallback.includes("?") ? "&" : "?";
    return `${fallback}${divider}amount=${input.amountOriginal}&comment=${encodeURIComponent(input.checkCode)}`;
  }
  return "https://ton.org/";
}

const providers: Record<PaymentChannel, PaymentProvider> = {
  UAH: {
    channel: PAYMENT_CHANNEL.UAH,
    createCheckUrl: buildUahUrl,
    async verifyPayment({ checkCode, comment, amountObserved }) {
      if ((comment || "").toUpperCase().includes(checkCode.toUpperCase())) {
        return { success: true, matchType: "code" };
      }
      if (typeof amountObserved === "number" && amountObserved > 0) {
        return { success: true, matchType: "amount_time" };
      }
      return { success: false, matchType: "unknown" };
    },
  },
  CRYPTOBOT: {
    channel: PAYMENT_CHANNEL.CRYPTOBOT,
    createCheckUrl: buildCryptobotUrl,
    async verifyPayment({ txHash, comment, checkCode }) {
      if (txHash?.trim()) return { success: true, matchType: "crypto_tx" };
      if ((comment || "").toUpperCase().includes(checkCode.toUpperCase())) {
        return { success: true, matchType: "code" };
      }
      return { success: false, matchType: "unknown" };
    },
  },
  TONPAY: {
    channel: PAYMENT_CHANNEL.TONPAY,
    createCheckUrl: buildTonWalletUrl,
    async verifyPayment({ txHash, comment, checkCode }) {
      if (txHash?.trim()) return { success: true, matchType: "crypto_tx" };
      if ((comment || "").toUpperCase().includes(checkCode.toUpperCase())) {
        return { success: true, matchType: "code" };
      }
      return { success: false, matchType: "unknown" };
    },
  },
};

export function getPaymentProvider(channel: PaymentChannel): PaymentProvider {
  return providers[channel];
}

export function amountLabel(channel: PaymentChannel, amount: number): string {
  if (channel === PAYMENT_CHANNEL.UAH) return `${amount} UAH`;
  if (channel === PAYMENT_CHANNEL.CRYPTOBOT) return `${amount} USDT`;
  return `${amount} TON`;
}

export function normalizeAmountToUahStep(value: number): number {
  return Math.round(value * 2) / 2;
}
