import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/server/prisma";
import { DEFAULT_WIDGET_PRESETS } from "@/server/constants";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function defaultPassword() {
  return process.env.DASHBOARD_PASSWORD?.trim() || "donatelko";
}

const TIKTOK_DONATION_MIGRATION_KEY = "migration:tiktok-gift-to-donation:v1";

async function migrateTikTokGiftDomain() {
  const migrationFlag = await prisma.appSetting.findUnique({
    where: { key: TIKTOK_DONATION_MIGRATION_KEY },
  });
  if (migrationFlag) return;

  await prisma.actionTrigger.updateMany({
    where: { type: "TIKTOK_GIFT" },
    data: { type: "TIKTOK_DONATION" },
  });

  await prisma.eventLog.updateMany({
    where: { type: "TIKTOK_GIFT" },
    data: { type: "TIKTOK_DONATION" },
  });

  const tiktokLogs = await prisma.eventLog.findMany({
    where: { type: "TIKTOK_DONATION" },
    select: { id: true, payloadJson: true },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });

  for (const row of tiktokLogs) {
    if (!row.payloadJson) continue;
    try {
      const payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
      if (!payload || typeof payload !== "object") continue;

      let changed = false;

      if (!payload.tiktokDonationName && typeof payload.giftName === "string") {
        payload.tiktokDonationName = payload.giftName;
        changed = true;
      }
      if (payload.tiktokCoins == null && Number.isFinite(Number(payload.giftCoins))) {
        payload.tiktokCoins = Number(payload.giftCoins);
        changed = true;
      }
      if (payload.tiktokCoins == null && Number.isFinite(Number(payload.coins))) {
        payload.tiktokCoins = Number(payload.coins);
        changed = true;
      }
      if ("giftName" in payload) {
        delete payload.giftName;
        changed = true;
      }
      if ("giftCoins" in payload) {
        delete payload.giftCoins;
        changed = true;
      }

      if (!changed) continue;
      await prisma.eventLog.update({
        where: { id: row.id },
        data: { payloadJson: JSON.stringify(payload) },
      });
    } catch {
      // ignore malformed legacy payload rows
    }
  }

  await prisma.appSetting.upsert({
    where: { key: TIKTOK_DONATION_MIGRATION_KEY },
    update: { value: new Date().toISOString() },
    create: { key: TIKTOK_DONATION_MIGRATION_KEY, value: new Date().toISOString() },
  });
}

export async function ensureBootstrap() {
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!admin) {
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash: sha256(defaultPassword()),
      },
    });
  }

  const paymentSettings = await prisma.paymentSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!paymentSettings) {
    await prisma.paymentSettings.create({
      data: {
        minAmountUah: 1,
        maxAmountUah: 10000,
        paymentMemoPrefix: "DON",
        confirmationMode: "semi_auto",
        usdtToUahFallback: 40,
        tonToUahFallback: 250,
      },
    });
  }

  const connection = await prisma.connection.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!connection) {
    await prisma.connection.create({ data: {} });
  }

  for (const preset of DEFAULT_WIDGET_PRESETS) {
    await prisma.widgetPreset.upsert({
      where: { slug: preset.slug },
      update: {},
      create: {
        slug: preset.slug,
        name: preset.name,
        settingsJson: JSON.stringify(preset.settings),
      },
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "dashboardLocale" },
    update: { value: "uk" },
    create: { key: "dashboardLocale", value: "uk" },
  });

  await migrateTikTokGiftDomain();
}

export async function ensureBridgeClient(machineName = "bridge-local") {
  const existing = await prisma.bridgeClient.findFirst({
    where: { machineName },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  const token = randomBytes(24).toString("hex");
  const tokenHash = sha256(token);
  const bridge = await prisma.bridgeClient.create({
    data: {
      machineName,
      tokenHash,
      enabled: true,
    },
  });

  return { ...bridge, plainToken: token };
}
