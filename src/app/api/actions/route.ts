import { ensureBootstrap } from "@/server/bootstrap";
import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { ACTION_TYPE, TRIGGER_TYPE } from "@/server/domain";

type TriggerInput = {
  type: "amount_uah" | "tiktok_donation" | "tiktok_gift" | "chat_command" | "like_count" | "subscribe";
  enabled?: boolean;
  amountUah?: number;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  giftName?: string;
  giftCoins?: number;
  commandText?: string;
  likeCount?: number;
  requireExactLike?: boolean;
};

const triggerMap: Record<TriggerInput["type"], string> = {
  amount_uah: TRIGGER_TYPE.AMOUNT_UAH,
  tiktok_donation: TRIGGER_TYPE.TIKTOK_DONATION,
  tiktok_gift: TRIGGER_TYPE.TIKTOK_DONATION,
  chat_command: TRIGGER_TYPE.CHAT_COMMAND,
  like_count: TRIGGER_TYPE.LIKE_COUNT,
  subscribe: TRIGGER_TYPE.SUBSCRIBE,
};

const actionMap: Record<string, string> = {
  minecraft_command: ACTION_TYPE.MINECRAFT_COMMAND,
  keypress: ACTION_TYPE.KEYPRESS,
  sound: ACTION_TYPE.SOUND,
  video: ACTION_TYPE.VIDEO,
  webhook: ACTION_TYPE.WEBHOOK,
  obs_action: ACTION_TYPE.OBS_ACTION,
};

export async function GET() {
  await ensureBootstrap();
  const actions = await prisma.action.findMany({
    include: { triggers: true, mediaAsset: true },
    orderBy: { createdAt: "desc" },
  });
  const normalized = actions.map((action) => ({
    ...action,
    triggers: action.triggers.map((trigger) => ({
      ...trigger,
      type: trigger.type === "TIKTOK_GIFT" ? "TIKTOK_DONATION" : trigger.type,
      tiktokDonationName: trigger.giftName,
      tiktokCoins: trigger.giftCoins,
      giftName: undefined,
      giftCoins: undefined,
    })),
  }));
  return ok(normalized);
}

export async function POST(request: Request) {
  await ensureBootstrap();
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        enabled?: boolean;
        actionType?: string;
        payload?: string;
        fixedDelaySec?: number | null;
        randomDelayMinSec?: number | null;
        randomDelayMaxSec?: number | null;
        cooldownSec?: number;
        mediaAssetId?: string | null;
        triggers?: TriggerInput[];
      }
    | null;

  const title = body?.title?.trim();
  const payload = body?.payload?.trim();
  const actionType = body?.actionType ? actionMap[body.actionType] : undefined;
  if (!title || !payload || !actionType) {
    return fail("Заповніть назву, тип дії та payload.", 400);
  }

  const triggers = (body?.triggers || [])
    .map((trigger) => ({
      type: triggerMap[trigger.type],
      enabled: trigger.enabled ?? true,
      amountUah: trigger.amountUah != null ? Number(trigger.amountUah) : null,
      giftName: trigger.tiktokDonationName?.trim() || trigger.giftName?.trim() || null,
      giftCoins: trigger.tiktokCoins != null ? Number(trigger.tiktokCoins) : trigger.giftCoins != null ? Number(trigger.giftCoins) : null,
      commandText: trigger.commandText?.trim() || null,
      likeCount: trigger.likeCount != null ? Number(trigger.likeCount) : null,
      requireExactLike: trigger.requireExactLike ?? false,
    }))
    .filter((trigger) => Boolean(trigger.type));

  const action = await prisma.action.create({
    data: {
      title,
      description: body?.description?.trim() || "",
      enabled: body?.enabled ?? true,
      actionType,
      payload,
      fixedDelaySec: body?.fixedDelaySec != null ? Number(body.fixedDelaySec) : null,
      randomDelayMinSec: body?.randomDelayMinSec != null ? Number(body.randomDelayMinSec) : null,
      randomDelayMaxSec: body?.randomDelayMaxSec != null ? Number(body.randomDelayMaxSec) : null,
      cooldownSec: body?.cooldownSec != null ? Number(body.cooldownSec) : 0,
      mediaAssetId: body?.mediaAssetId || null,
      triggers: { create: triggers },
    },
    include: { triggers: true, mediaAsset: true },
  });

  await prisma.eventLog.create({
    data: {
      type: "ACTION",
      message: `Створено дію: ${action.title}`,
      payloadJson: JSON.stringify({ actionId: action.id }),
    },
  });

  return ok(action);
}
