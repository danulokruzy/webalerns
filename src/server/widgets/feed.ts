import { prisma } from "@/server/prisma";

export type TopPeriod = "week" | "month" | "all";
export type AlertFeedMode = "all" | "donation" | "tiktok_donation";

type TikTokDonationPayload = {
  donorName?: string;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  giftName?: string;
  coins?: number;
  imageUrl?: string | null;
};

type AlertRow = {
  id: string;
  donorName: string;
  amountUah: number;
  channel: string;
  message: string;
  isFake: boolean;
  createdAt: Date;
  kind: "donation" | "tiktok_donation";
  tiktokDonationName?: string | null;
  tiktokCoins?: number | null;
  imageUrl?: string | null;
};

function periodStart(period: TopPeriod): Date | null {
  const now = new Date();
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

function normalizeDonorNameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function isLegacySystemTikTokDonation(row: {
  amountUah: number;
  channel: string;
  message: string;
  amountLabel: string;
}) {
  if (row.channel === "TIKTOK") return true;
  if (row.amountUah > 0) return false;
  const message = row.message.toLowerCase();
  const amountLabel = row.amountLabel.toLowerCase();
  return message.includes("tiktok") || amountLabel.includes("tiktok");
}

function parseTikTokDonationPayload(payloadJson: string | null): TikTokDonationPayload {
  if (!payloadJson) return {};
  try {
    const parsed = JSON.parse(payloadJson) as TikTokDonationPayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function getLastDonations(limit = 20) {
  const rows = await prisma.donation.findMany({
    where: { isFake: false },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
  });
  return rows
    .filter((row) => row.amountUah > 0 && !isLegacySystemTikTokDonation(row))
    .slice(0, limit);
}

export async function getTopDonors(
  limit = 3,
  options?: {
    period?: TopPeriod;
    includeFake?: boolean;
  }
) {
  const period = options?.period ?? "all";
  const includeFake = options?.includeFake ?? false;
  const start = periodStart(period);

  const rows = await prisma.donation.findMany({
    where: {
      isFake: includeFake ? undefined : false,
      amountUah: { gt: 0 },
      ...(start ? { createdAt: { gte: start } } : {}),
    },
    select: {
      donorName: true,
      amountUah: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const grouped = new Map<string, { donorName: string; totalUah: number }>();
  for (const row of rows) {
    const donorName = row.donorName.trim() || "Анонім";
    const key = normalizeDonorNameKey(donorName);
    const existing = grouped.get(key);
    if (existing) {
      existing.totalUah += row.amountUah;
    } else {
      grouped.set(key, { donorName, totalUah: row.amountUah });
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.totalUah - a.totalUah)
    .slice(0, limit)
    .map((item) => ({
      donorName: item.donorName,
      totalUah: Number(item.totalUah.toFixed(2)),
    }));
}

export async function getAlertsFeed(
  limit = 30,
  includeFake = true,
  mode: AlertFeedMode = "all"
) {
  const donationsPromise =
    mode === "tiktok_donation"
      ? Promise.resolve([])
      : prisma.donation.findMany({
          where: includeFake ? {} : { isFake: false },
          orderBy: { createdAt: "desc" },
          take: limit * 4,
        });

  const tiktokDonationLogsPromise =
    mode === "donation"
      ? Promise.resolve([])
      : prisma.eventLog.findMany({
          where: { type: { in: ["TIKTOK_DONATION", "TIKTOK_GIFT"] } },
          orderBy: { createdAt: "desc" },
          take: limit * 4,
        });

  const [donations, tiktokDonationLogs] = await Promise.all([
    donationsPromise,
    tiktokDonationLogsPromise,
  ]);

  const donationRows: AlertRow[] = donations
    .filter((row) => row.amountUah > 0 && !isLegacySystemTikTokDonation(row))
    .map((item) => ({
      id: item.id,
      donorName: item.donorName,
      amountUah: item.amountUah,
      channel: item.channel,
      message: item.message,
      isFake: item.isFake,
      createdAt: item.createdAt,
      kind: "donation",
      tiktokDonationName: null,
      tiktokCoins: null,
      imageUrl: null,
    }));

  const tiktokDonationRows: AlertRow[] = tiktokDonationLogs.map((row) => {
    const payload = parseTikTokDonationPayload(row.payloadJson);
    const donorName = (payload.donorName || "TikTok Viewer").trim();
    const donationName = (payload.tiktokDonationName || payload.giftName || "").trim() || "TikTok Donation";
    const tiktokCoins = Number(payload.tiktokCoins ?? payload.coins ?? 0);
    const imageUrl = payload.imageUrl?.trim() || null;

    return {
      id: `log:${row.id}`,
      donorName: donorName || "TikTok Viewer",
      amountUah: 0,
      channel: "TIKTOK",
      message: donationName,
      isFake: false,
      createdAt: row.createdAt,
      kind: "tiktok_donation",
      tiktokDonationName: donationName,
      tiktokCoins: Number.isFinite(tiktokCoins) ? tiktokCoins : 0,
      imageUrl,
    };
  });

  const combined: AlertRow[] = [...donationRows, ...tiktokDonationRows];
  return combined
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      donorName: item.donorName,
      amountUah: item.amountUah,
      channel: item.channel,
      message: item.message,
      isFake: item.isFake,
      createdAt: item.createdAt,
      kind: item.kind,
      tiktokDonationName: item.tiktokDonationName ?? null,
      tiktokCoins: item.tiktokCoins ?? null,
      imageUrl: item.imageUrl ?? null,
    }));
}

export async function getFakeBattle(limit = 20) {
  const fake = await prisma.fakeDonation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const grouped = new Map<string, number>();
  for (const row of fake) {
    grouped.set(row.donorName, (grouped.get(row.donorName) ?? 0) + row.amountUah);
  }

  const top3 = Array.from(grouped.entries())
    .map(([donorName, totalUah]) => ({ donorName, totalUah }))
    .sort((a, b) => b.totalUah - a.totalUah)
    .slice(0, 3);

  return {
    entries: fake,
    top3,
  };
}
