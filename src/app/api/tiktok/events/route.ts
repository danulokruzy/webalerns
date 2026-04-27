import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { runMatchedActions } from "@/server/actions/engine";

type TikTokEventPayload = {
  type?: string;
  giftId?: string;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  donorName?: string;
  imageUrl?: string;
  likeCount?: number;
  commandText?: string;
  // legacy incoming fields
  giftName?: string;
  coins?: number;
};

function cleanName(value?: string) {
  return value?.trim() || "TikTok Viewer";
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TikTokEventPayload | null;
  const eventType = String(body?.type || "").trim().toLowerCase();
  if (!eventType) return fail("Некоректна подія TikTok.", 400);

  if (eventType === "tiktok_donation" || eventType === "gift") {
    const giftId = String(body?.giftId || "").trim();
    const tiktokDonationName = String(body?.tiktokDonationName || body?.giftName || "").trim();
    const tiktokCoins = toNumber(body?.tiktokCoins ?? body?.coins, 0);
    const imageUrl = String(body?.imageUrl || "").trim() || null;

    if (!giftId) return fail("giftId is required for TikTok donation.", 400);
    if (!tiktokDonationName) return fail("tiktokDonationName is required.", 400);

    await prisma.giftCatalog.upsert({
      where: { giftId },
      update: {
        name: tiktokDonationName,
        coins: tiktokCoins,
        imageUrl: imageUrl || undefined,
        lastSeenAt: new Date(),
        isActive: true,
      },
      create: {
        giftId,
        name: tiktokDonationName,
        coins: tiktokCoins,
        imageUrl,
        provider: "tiktok",
      },
    });

    const actions = await runMatchedActions({
      channel: "TIKTOK",
      amountUah: 0,
      tiktokDonationName,
      tiktokCoins,
    });

    await prisma.eventLog.create({
      data: {
        type: "TIKTOK_DONATION",
        message: `TikTok-донат @${cleanName(body?.donorName)}: ${tiktokDonationName} (${tiktokCoins} coins)`,
        payloadJson: JSON.stringify({
          giftId,
          tiktokDonationName,
          tiktokCoins,
          donorName: cleanName(body?.donorName),
          imageUrl,
          actions,
        }),
      },
    });

    return ok({ received: true, actions });
  }

  if (eventType === "like") {
    const likeCount = toNumber(body?.likeCount, 0);
    const actions = await runMatchedActions({
      channel: "TIKTOK",
      amountUah: 0,
      likeCount,
    });

    await prisma.eventLog.create({
      data: {
        type: "TIKTOK_LIKE",
        message: `Like @${cleanName(body?.donorName)}: ${likeCount}`,
        payloadJson: JSON.stringify({
          donorName: cleanName(body?.donorName),
          likeCount,
          actions,
        }),
      },
    });

    return ok({ received: true, actions });
  }

  if (eventType === "subscribe") {
    const actions = await runMatchedActions({
      channel: "TIKTOK",
      amountUah: 0,
      isSubscribe: true,
    });

    await prisma.eventLog.create({
      data: {
        type: "TIKTOK_SUBSCRIBE",
        message: `Subscribe @${cleanName(body?.donorName)}`,
        payloadJson: JSON.stringify({
          donorName: cleanName(body?.donorName),
          actions,
        }),
      },
    });

    return ok({ received: true, actions });
  }

  if (eventType === "command") {
    const commandText = String(body?.commandText || "").trim();
    if (!commandText) return fail("commandText is required for command events.", 400);

    const actions = await runMatchedActions({
      channel: "TIKTOK",
      amountUah: 0,
      commandText,
    });

    await prisma.eventLog.create({
      data: {
        type: "TIKTOK_COMMAND",
        message: `Command @${cleanName(body?.donorName)}: ${commandText}`,
        payloadJson: JSON.stringify({
          donorName: cleanName(body?.donorName),
          commandText,
          actions,
        }),
      },
    });

    return ok({ received: true, actions });
  }

  return fail("Unknown TikTok event type.", 400);
}
