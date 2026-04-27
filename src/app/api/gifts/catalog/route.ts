import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

type CatalogPayload = {
  provider?: string;
  giftId?: string;
  name?: string;
  coins?: number;
  imageUrl?: string;
  isActive?: boolean;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "1";

  const [items, logs] = await Promise.all([
    prisma.giftCatalog.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ coins: "asc" }, { name: "asc" }],
      take: 1000,
    }),
    prisma.eventLog.findMany({
      where: { type: { in: ["TIKTOK_DONATION", "TIKTOK_GIFT"] } },
      orderBy: { createdAt: "desc" },
      take: 3000,
      select: { payloadJson: true },
    }),
  ]);

  const imageByGiftId = new Map<string, string>();
  for (const row of logs) {
    if (!row.payloadJson) continue;
    try {
      const payload = JSON.parse(row.payloadJson) as { giftId?: string; imageUrl?: string };
      const giftId = payload.giftId?.trim();
      const imageUrl = payload.imageUrl?.trim();
      if (!giftId || !imageUrl || imageByGiftId.has(giftId)) continue;
      imageByGiftId.set(giftId, imageUrl);
    } catch {
      // ignore malformed payload
    }
  }

  return ok(
    items.map((item) => ({
      ...item,
      imageUrl: item.imageUrl || imageByGiftId.get(item.giftId) || null,
    }))
  );
}

export async function POST(request: Request) {
  if (!isDashboardAuthorized()) return fail("Authorization required.", 401);
  const body = (await request.json().catch(() => null)) as CatalogPayload | null;

  const giftId = body?.giftId?.trim();
  const name = body?.name?.trim();
  if (!giftId || !name) return fail("giftId and name are required.", 400);

  const item = await prisma.giftCatalog.upsert({
    where: { giftId },
    update: {
      name,
      coins: body?.coins != null ? Number(body.coins) : 1,
      imageUrl: body?.imageUrl?.trim() || null,
      lastSeenAt: new Date(),
      isActive: true,
    },
    create: {
      provider: body?.provider?.trim() || "tiktok",
      giftId,
      name,
      coins: body?.coins != null ? Number(body.coins) : 1,
      imageUrl: body?.imageUrl?.trim() || null,
    },
  });

  return ok(item);
}

export async function PATCH(request: Request) {
  if (!isDashboardAuthorized()) return fail("Authorization required.", 401);
  const body = (await request.json().catch(() => null)) as CatalogPayload | null;

  const giftId = body?.giftId?.trim();
  if (!giftId) return fail("giftId is required.", 400);

  const existing = await prisma.giftCatalog.findUnique({ where: { giftId } });
  if (!existing) return fail("TikTok donation entry not found.", 404);

  const updated = await prisma.giftCatalog.update({
    where: { giftId },
    data: {
      name: typeof body?.name === "string" ? body.name.trim() : existing.name,
      coins: body?.coins != null ? Number(body.coins) : existing.coins,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : existing.isActive,
      imageUrl: typeof body?.imageUrl === "string" ? body.imageUrl.trim() || null : existing.imageUrl,
      lastSeenAt: new Date(),
    },
  });

  return ok(updated);
}

export async function DELETE(request: Request) {
  if (!isDashboardAuthorized()) return fail("Authorization required.", 401);
  const body = (await request.json().catch(() => null)) as { giftId?: string } | null;

  const giftId = body?.giftId?.trim();
  if (!giftId) return fail("giftId is required.", 400);

  const existing = await prisma.giftCatalog.findUnique({ where: { giftId } });
  if (!existing) return fail("TikTok donation entry not found.", 404);

  const updated = await prisma.giftCatalog.update({
    where: { giftId },
    data: { isActive: false, lastSeenAt: new Date() },
  });

  return ok(updated);
}
