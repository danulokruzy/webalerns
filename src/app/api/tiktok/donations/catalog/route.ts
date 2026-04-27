import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

type CatalogInput = {
  provider?: string;
  tiktokDonationId?: string;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  imageUrl?: string;
  isActive?: boolean;
  // legacy fallback
  giftId?: string;
  name?: string;
  coins?: number;
};

function normalizeDonationId(input: CatalogInput | null) {
  return String(input?.tiktokDonationId || input?.giftId || "").trim();
}

function normalizeDonationName(input: CatalogInput | null) {
  return String(input?.tiktokDonationName || input?.name || "").trim();
}

function normalizeCoins(input: CatalogInput | null, fallback = 1) {
  const raw = Number(input?.tiktokCoins ?? input?.coins);
  return Number.isFinite(raw) ? raw : fallback;
}

function toPublicItem(item: {
  id: string;
  provider: string;
  giftId: string;
  name: string;
  coins: number;
  imageUrl: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
}) {
  return {
    id: item.id,
    provider: item.provider,
    tiktokDonationId: item.giftId,
    tiktokDonationName: item.name,
    tiktokCoins: item.coins,
    imageUrl: item.imageUrl,
    firstSeenAt: item.firstSeenAt,
    lastSeenAt: item.lastSeenAt,
    isActive: item.isActive,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "1";

  const items = await prisma.giftCatalog.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ coins: "asc" }, { name: "asc" }],
    take: 1000,
  });

  return ok(items.map(toPublicItem));
}

export async function POST(request: Request) {
  if (!isDashboardAuthorized()) return fail("Authorization required.", 401);
  const body = (await request.json().catch(() => null)) as CatalogInput | null;

  const tiktokDonationId = normalizeDonationId(body);
  const tiktokDonationName = normalizeDonationName(body);
  const tiktokCoins = normalizeCoins(body, 1);

  if (!tiktokDonationId || !tiktokDonationName) {
    return fail("tiktokDonationId and tiktokDonationName are required.", 400);
  }

  const item = await prisma.giftCatalog.upsert({
    where: { giftId: tiktokDonationId },
    update: {
      name: tiktokDonationName,
      coins: tiktokCoins,
      imageUrl: body?.imageUrl?.trim() || null,
      isActive: true,
      lastSeenAt: new Date(),
    },
    create: {
      provider: body?.provider?.trim() || "tiktok",
      giftId: tiktokDonationId,
      name: tiktokDonationName,
      coins: tiktokCoins,
      imageUrl: body?.imageUrl?.trim() || null,
      isActive: true,
    },
  });

  return ok(toPublicItem(item));
}

export async function PATCH(request: Request) {
  if (!isDashboardAuthorized()) return fail("Authorization required.", 401);
  const body = (await request.json().catch(() => null)) as CatalogInput | null;

  const tiktokDonationId = normalizeDonationId(body);
  if (!tiktokDonationId) return fail("tiktokDonationId is required.", 400);

  const existing = await prisma.giftCatalog.findUnique({ where: { giftId: tiktokDonationId } });
  if (!existing) return fail("TikTok donation entry not found.", 404);

  const item = await prisma.giftCatalog.update({
    where: { giftId: tiktokDonationId },
    data: {
      name: normalizeDonationName(body) || existing.name,
      coins: normalizeCoins(body, existing.coins),
      isActive: typeof body?.isActive === "boolean" ? body.isActive : existing.isActive,
      imageUrl: typeof body?.imageUrl === "string" ? body.imageUrl.trim() || null : existing.imageUrl,
      lastSeenAt: new Date(),
    },
  });

  return ok(toPublicItem(item));
}

export async function DELETE(request: Request) {
  if (!isDashboardAuthorized()) return fail("Authorization required.", 401);
  const body = (await request.json().catch(() => null)) as CatalogInput | null;

  const tiktokDonationId = normalizeDonationId(body);
  if (!tiktokDonationId) return fail("tiktokDonationId is required.", 400);

  const existing = await prisma.giftCatalog.findUnique({ where: { giftId: tiktokDonationId } });
  if (!existing) return fail("TikTok donation entry not found.", 404);

  const item = await prisma.giftCatalog.update({
    where: { giftId: tiktokDonationId },
    data: { isActive: false, lastSeenAt: new Date() },
  });

  return ok(toPublicItem(item));
}
