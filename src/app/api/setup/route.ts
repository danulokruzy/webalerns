import { ensureBootstrap } from "@/server/bootstrap";
import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { CHECK_STATUS } from "@/server/domain";

const TIKTOK_PARSER_ENABLED_KEY = "tiktokParserEnabled";

function normalizeTikTokUsername(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/tiktok\.com\/@([^/?#]+)/i);
  const extracted = fromUrl?.[1] || raw;
  return extracted.replace(/^@+/, "").trim();
}

export async function GET() {
  await ensureBootstrap();
  const [connections, settings, actionsCount, tiktokDonationsCount, checksCount, donationsCount, bridge, parserSetting] =
    await Promise.all([
      prisma.connection.findFirst({ orderBy: { updatedAt: "desc" } }),
      prisma.paymentSettings.findFirst({ orderBy: { updatedAt: "desc" } }),
      prisma.action.count(),
      prisma.giftCatalog.count({ where: { isActive: true } }),
      prisma.donationCheck.count({ where: { status: CHECK_STATUS.PENDING } }),
      prisma.donation.count(),
      prisma.bridgeClient.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.appSetting.findUnique({ where: { key: TIKTOK_PARSER_ENABLED_KEY } }),
    ]);

  return ok({
    connections,
    settings,
    metrics: {
      actionsCount,
      tiktokDonationsCount,
      giftsCount: tiktokDonationsCount,
      checksCount,
      donationsCount,
      bridgeCount: bridge.length,
    },
    parserEnabled: parserSetting?.value === "1",
    bridgeClients: bridge,
  });
}

export async function POST(request: Request) {
  await ensureBootstrap();
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const body = (await request.json().catch(() => null)) as
    | {
        tiktokUsername?: string;
        parserEnabled?: boolean;
      }
    | null;

  const connection = await prisma.connection.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!connection) return fail("Конфіг підключень не знайдено.", 404);

  const updatedConnection = await prisma.connection.update({
    where: { id: connection.id },
    data: {
      tiktokUsername:
        typeof body?.tiktokUsername === "string"
          ? normalizeTikTokUsername(body.tiktokUsername)
          : connection.tiktokUsername,
    },
  });

  let parserEnabled = false;
  if (typeof body?.parserEnabled === "boolean") {
    const parserRecord = await prisma.appSetting.upsert({
      where: { key: TIKTOK_PARSER_ENABLED_KEY },
      update: { value: body.parserEnabled ? "1" : "0" },
      create: { key: TIKTOK_PARSER_ENABLED_KEY, value: body.parserEnabled ? "1" : "0" },
    });
    parserEnabled = parserRecord.value === "1";
  } else {
    const parserRecord = await prisma.appSetting.findUnique({
      where: { key: TIKTOK_PARSER_ENABLED_KEY },
    });
    parserEnabled = parserRecord?.value === "1";
  }

  await prisma.eventLog.create({
    data: {
      type: "SYSTEM",
      message: `Оновлено Setup TikTok: parser=${parserEnabled ? "on" : "off"}, user=@${updatedConnection.tiktokUsername || "-"}`,
    },
  });

  return ok({
    tiktokUsername: updatedConnection.tiktokUsername,
    parserEnabled,
  });
}
