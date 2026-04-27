import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { ACTION_TYPE, TRIGGER_TYPE } from "@/server/domain";

const actionMap: Record<string, string> = {
  minecraft_command: ACTION_TYPE.MINECRAFT_COMMAND,
  keypress: ACTION_TYPE.KEYPRESS,
  sound: ACTION_TYPE.SOUND,
  video: ACTION_TYPE.VIDEO,
  webhook: ACTION_TYPE.WEBHOOK,
  obs_action: ACTION_TYPE.OBS_ACTION,
};

const triggerMap: Record<string, string> = {
  amount_uah: TRIGGER_TYPE.AMOUNT_UAH,
  tiktok_donation: TRIGGER_TYPE.TIKTOK_DONATION,
  tiktok_gift: TRIGGER_TYPE.TIKTOK_DONATION,
  chat_command: TRIGGER_TYPE.CHAT_COMMAND,
  like_count: TRIGGER_TYPE.LIKE_COUNT,
  subscribe: TRIGGER_TYPE.SUBSCRIBE,
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
        triggers?: Array<{
          type: string;
          enabled?: boolean;
          amountUah?: number;
          tiktokDonationName?: string;
          tiktokCoins?: number;
          giftName?: string;
          giftCoins?: number;
          commandText?: string;
          likeCount?: number;
          requireExactLike?: boolean;
        }>;
      }
    | null;

  const action = await prisma.action.update({
    where: { id: params.id },
    data: {
      title: body?.title?.trim(),
      description: body?.description?.trim(),
      enabled: body?.enabled,
      actionType: body?.actionType ? actionMap[body.actionType] : undefined,
      payload: body?.payload?.trim(),
      fixedDelaySec: body?.fixedDelaySec != null ? Number(body.fixedDelaySec) : null,
      randomDelayMinSec: body?.randomDelayMinSec != null ? Number(body.randomDelayMinSec) : null,
      randomDelayMaxSec: body?.randomDelayMaxSec != null ? Number(body.randomDelayMaxSec) : null,
      cooldownSec: body?.cooldownSec != null ? Number(body.cooldownSec) : undefined,
      mediaAssetId: body?.mediaAssetId != null ? body.mediaAssetId : undefined,
    },
  });

  if (Array.isArray(body?.triggers)) {
    await prisma.actionTrigger.deleteMany({ where: { actionId: params.id } });
    if (body.triggers.length > 0) {
      await prisma.actionTrigger.createMany({
        data: body.triggers
          .map((trigger) => ({
            actionId: params.id,
            type: triggerMap[trigger.type],
            enabled: trigger.enabled ?? true,
            amountUah: trigger.amountUah != null ? Number(trigger.amountUah) : null,
            giftName: trigger.tiktokDonationName?.trim() || trigger.giftName?.trim() || null,
            giftCoins:
              trigger.tiktokCoins != null
                ? Number(trigger.tiktokCoins)
                : trigger.giftCoins != null
                  ? Number(trigger.giftCoins)
                  : null,
            commandText: trigger.commandText?.trim() || null,
            likeCount: trigger.likeCount != null ? Number(trigger.likeCount) : null,
            requireExactLike: trigger.requireExactLike ?? false,
          }))
          .filter((trigger) => Boolean(trigger.type)),
      });
    }
  }

  await prisma.eventLog.create({
    data: {
      type: "ACTION",
      message: `Оновлено дію: ${action.title}`,
      payloadJson: JSON.stringify({ actionId: action.id }),
    },
  });

  const updated = await prisma.action.findUnique({
    where: { id: params.id },
    include: { triggers: true, mediaAsset: true },
  });
  if (!updated) return ok(updated);

  return ok({
    ...updated,
    triggers: updated.triggers.map((trigger) => ({
      ...trigger,
      type: trigger.type === "TIKTOK_GIFT" ? "TIKTOK_DONATION" : trigger.type,
      tiktokDonationName: trigger.giftName,
      tiktokCoins: trigger.giftCoins,
      giftName: undefined,
      giftCoins: undefined,
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  await prisma.action.delete({ where: { id: params.id } });
  await prisma.eventLog.create({
    data: {
      type: "ACTION",
      message: "Дію видалено.",
      payloadJson: JSON.stringify({ actionId: params.id }),
    },
  });
  return ok({ deleted: true });
}
