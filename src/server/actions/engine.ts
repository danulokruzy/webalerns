import { prisma } from "@/server/prisma";
import { normalizeAmountToUahStep } from "@/server/payments/providers";
import { ACTION_TYPE, LOG_TYPE } from "@/server/domain";

type TriggerContext = {
  amountUah: number;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  commandText?: string;
  likeCount?: number;
  isSubscribe?: boolean;
};

function randomDelayMs(minSec?: number | null, maxSec?: number | null): number {
  if (!minSec || !maxSec || maxSec < minSec) return 0;
  const rand = Math.random() * (maxSec - minSec) + minSec;
  return Math.round(rand * 1000);
}

function triggerMatches(
  trigger: {
    type: string;
    enabled: boolean;
    amountUah: number | null;
    giftName: string | null;
    giftCoins: number | null;
    commandText: string | null;
    likeCount: number | null;
    requireExactLike: boolean;
  },
  ctx: TriggerContext
) {
  if (!trigger.enabled) return false;
  switch (trigger.type) {
    case "AMOUNT_UAH":
      if (trigger.amountUah == null) return false;
      return normalizeAmountToUahStep(ctx.amountUah) === normalizeAmountToUahStep(trigger.amountUah);
    case "TIKTOK_GIFT":
    case "TIKTOK_DONATION":
      if (!ctx.tiktokDonationName && ctx.tiktokCoins == null) return false;
      if (trigger.giftName && ctx.tiktokDonationName) {
        return trigger.giftName.toLowerCase() === ctx.tiktokDonationName.toLowerCase();
      }
      if (trigger.giftCoins != null && ctx.tiktokCoins != null) {
        return trigger.giftCoins === ctx.tiktokCoins;
      }
      return false;
    case "CHAT_COMMAND":
      if (!trigger.commandText || !ctx.commandText) return false;
      return trigger.commandText.toLowerCase() === ctx.commandText.trim().toLowerCase();
    case "LIKE_COUNT":
      if (trigger.likeCount == null || ctx.likeCount == null) return false;
      if (trigger.requireExactLike) return ctx.likeCount === trigger.likeCount;
      return ctx.likeCount >= trigger.likeCount;
    case "SUBSCRIBE":
      return Boolean(ctx.isSubscribe);
    default:
      return false;
  }
}

async function appendLog(type: string, message: string, payload?: Record<string, unknown>) {
  await prisma.eventLog.create({
    data: {
      type,
      message,
      payloadJson: payload ? JSON.stringify(payload) : null,
    },
  });
}

export async function runMatchedActions(params: {
  amountUah: number;
  donationId?: string;
  channel: string;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  giftName?: string;
  giftCoins?: number;
  commandText?: string;
  likeCount?: number;
  isSubscribe?: boolean;
}) {
  const actions = await prisma.action.findMany({
    where: { enabled: true },
    include: { triggers: true },
    orderBy: { createdAt: "asc" },
  });

  const context: TriggerContext = {
    amountUah: params.amountUah,
    tiktokDonationName: params.tiktokDonationName || params.giftName,
    tiktokCoins: params.tiktokCoins ?? params.giftCoins,
    commandText: params.commandText,
    likeCount: params.likeCount,
    isSubscribe: params.isSubscribe,
  };

  const matched = actions.filter((action) =>
    action.triggers.some((trigger) => triggerMatches(trigger, context))
  );

  if (matched.length === 0) {
    await appendLog(LOG_TYPE.ACTION, "Не знайдено жодної дії для цього донату.", {
      donationId: params.donationId,
      amountUah: params.amountUah,
    });
    if (params.donationId) {
      await prisma.donation.update({
        where: { id: params.donationId },
        data: { triggeredActionsJson: JSON.stringify([]) },
      });
    }
    return [];
  }

  const executedActionIds: string[] = [];
  let queueCursorTs = Date.now();

  for (const action of matched) {
    const baseDelay = action.fixedDelaySec ? action.fixedDelaySec * 1000 : 0;
    const randomDelay = randomDelayMs(action.randomDelayMinSec, action.randomDelayMaxSec);
    const runDelayMs = baseDelay + randomDelay;
    queueCursorTs += runDelayMs;
    const runAt = new Date(queueCursorTs);

    if (
      action.actionType === ACTION_TYPE.KEYPRESS ||
      action.actionType === ACTION_TYPE.SOUND ||
      action.actionType === ACTION_TYPE.VIDEO ||
      action.actionType === ACTION_TYPE.MINECRAFT_COMMAND
    ) {
      await prisma.bridgeTask.create({
        data: {
          actionId: action.id,
          type: action.actionType,
          payloadJson: JSON.stringify({
            payload: action.payload,
            donationId: params.donationId,
            channel: params.channel,
            queueIndex: executedActionIds.length,
          }),
          runAt,
        },
      });
      queueCursorTs += 200;
    } else if (action.actionType === ACTION_TYPE.WEBHOOK) {
      try {
        await fetch(action.payload, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            donationId: params.donationId,
            amountUah: params.amountUah,
            channel: params.channel,
          }),
        });
      } catch {
        await appendLog(LOG_TYPE.ACTION, "Webhook-дія завершилась помилкою мережі.", {
          actionId: action.id,
          donationId: params.donationId,
        });
      }
    }

    executedActionIds.push(action.id);
    await appendLog(LOG_TYPE.ACTION, `Заплановано дію: ${action.title}`, {
      actionId: action.id,
      donationId: params.donationId,
      runAt: runAt.toISOString(),
    });
  }

  if (params.donationId) {
    await prisma.donation.update({
      where: { id: params.donationId },
      data: { triggeredActionsJson: JSON.stringify(executedActionIds) },
    });
  }

  return executedActionIds;
}
