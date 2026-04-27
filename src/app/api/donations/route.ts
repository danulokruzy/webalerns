import { ensureBootstrap } from "@/server/bootstrap";
import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { CHECK_STATUS } from "@/server/domain";
import { getTopDonors } from "@/server/widgets/feed";

type TikTokDonationPayload = {
  donorName?: string;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  giftName?: string;
  coins?: number;
  imageUrl?: string | null;
};

function detectDonationKind(row: {
  amountUah: number;
  message: string;
  amountLabel: string;
  channel: string;
}) {
  if (row.channel === "TIKTOK") return "tiktok_donation";
  const message = (row.message || "").toLowerCase();
  const amountLabel = (row.amountLabel || "").toLowerCase();
  if (message.includes("tiktok donation") || amountLabel.includes("tiktok donation")) return "tiktok_donation";
  if (message.includes("tiktok gift") || amountLabel.includes("tiktok gift")) return "tiktok_donation";
  if (row.amountUah <= 0 && message.includes("gift")) return "tiktok_donation";
  return "donation";
}

function isSystemTikTokRow(row: {
  amountUah: number;
  message: string;
  amountLabel: string;
  channel: string;
}) {
  if (row.channel === "TIKTOK") return true;
  const message = (row.message || "").toLowerCase();
  const amountLabel = (row.amountLabel || "").toLowerCase();
  if (row.amountUah > 0) return false;
  return message.includes("tiktok ") || amountLabel.includes("tiktok ");
}

function parseGiftPayload(payloadJson: string | null): TikTokDonationPayload {
  if (!payloadJson) return {};
  try {
    const parsed = JSON.parse(payloadJson) as TikTokDonationPayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function GET() {
  await ensureBootstrap();
  const [checks, donations, tiktokDonationLogs, topWeek, topMonth, topAll] = await Promise.all([
    prisma.donationCheck.findMany({
      where: { status: CHECK_STATUS.PENDING },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.donation.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.eventLog.findMany({
      where: { type: { in: ["TIKTOK_DONATION", "TIKTOK_GIFT"] } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    getTopDonors(5, { period: "week", includeFake: true }),
    getTopDonors(5, { period: "month", includeFake: true }),
    getTopDonors(5, { period: "all", includeFake: true }),
  ]);

  const realDonations = donations
    .filter((item) => item.amountUah > 0 && !isSystemTikTokRow(item))
    .map((item) => ({
      ...item,
      kind: detectDonationKind(item),
      tiktokDonationName: null,
      tiktokCoins: null,
      tiktokDonationImageUrl: null,
    }));

  const giftRows = tiktokDonationLogs.map((log) => {
    const payload = parseGiftPayload(log.payloadJson);
    const donorName = payload.donorName?.trim() || "TikTok Viewer";
    const tiktokDonationName = (payload.tiktokDonationName || payload.giftName || "").trim() || "TikTok Donation";
    const coinsRaw = Number(payload.tiktokCoins ?? payload.coins ?? 0);
    const giftCoins = Number.isFinite(coinsRaw) ? coinsRaw : 0;

    return {
      id: `log:${log.id}`,
      checkId: null,
      donorName,
      message: tiktokDonationName,
      channel: "TIKTOK",
      amountOriginal: 0,
      amountLabel: `${giftCoins} coins`,
      amountUah: 0,
      isAnonymous: false,
      isFake: false,
      youtubeUrl: null,
      voiceUrl: null,
      triggeredActionsJson: null,
      createdAt: log.createdAt,
      kind: "tiktok_donation",
      tiktokDonationName,
      tiktokCoins: giftCoins,
      tiktokDonationImageUrl: payload.imageUrl?.trim() || null,
    };
  });

  const merged = [...realDonations, ...giftRows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 300);

  return ok({
    checks,
    donations: merged,
    tops: {
      week: topWeek,
      month: topMonth,
      all: topAll,
    },
  });
}

export async function POST(request: Request) {
  await ensureBootstrap();
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const body = (await request.json().catch(() => null)) as {
    donorName?: string;
    amountUah?: number;
    message?: string;
    channel?: string;
  } | null;

  if (!body?.donorName?.trim()) return fail("Вкажіть ім'я.");
  if (!body?.amountUah || body.amountUah <= 0) return fail("Вкажіть суму.");

  const channel = body.channel?.toUpperCase() || "UAH";
  const amount = Number(body.amountUah);

  const donation = await prisma.donation.create({
    data: {
      donorName: body.donorName.trim(),
      message: body.message?.trim() || "",
      channel,
      amountOriginal: amount,
      amountLabel: `${amount} грн`,
      amountUah: amount,
      isAnonymous: false,
      isFake: false,
    },
  });

  await prisma.eventLog.create({
    data: {
      type: "DONATION",
      message: `Створено ручний донат від ${donation.donorName} на ${amount} грн`,
      payloadJson: JSON.stringify({ donationId: donation.id }),
    },
  });

  return ok(donation);
}

export async function DELETE(request: Request) {
  await ensureBootstrap();
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id?.trim();
  if (!id) return fail("id є обов'язковим.", 400);

  if (id.startsWith("log:")) {
    const logId = id.slice(4).trim();
    if (!logId) return fail("id є обов'язковим.", 400);

    const existingLog = await prisma.eventLog.findFirst({
      where: { id: logId, type: { in: ["TIKTOK_DONATION", "TIKTOK_GIFT"] } },
    });
    if (!existingLog) return fail("Запис TikTok-донату не знайдено.", 404);

    await prisma.eventLog.delete({ where: { id: logId } });
    return ok({ id, deleted: true });
  }

  const existing = await prisma.donation.findUnique({ where: { id } });
  if (!existing) return fail("Донат не знайдено.", 404);

  await prisma.donation.delete({ where: { id } });
  await prisma.eventLog.create({
    data: {
      type: "DONATION",
      message: `Донат видалено: ${existing.donorName} (${existing.amountUah.toFixed(2)} грн)`,
      payloadJson: JSON.stringify({ donationId: id }),
    },
  });

  return ok({ id, deleted: true });
}
