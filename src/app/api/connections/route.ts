import { isDashboardAuthorized } from "@/server/auth";
import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

function normalizeTikTokUsername(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/tiktok\.com\/@([^/?#]+)/i);
  const extracted = fromUrl?.[1] || raw;
  return extracted.replace(/^@+/, "").trim();
}

export async function GET() {
  await ensureBootstrap();
  const connection = await prisma.connection.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return ok(connection);
}

export async function POST(request: Request) {
  await ensureBootstrap();
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  const body = (await request.json().catch(() => null)) as
    | {
        twitchUsername?: string;
        tiktokUsername?: string;
        minecraftHost?: string;
        minecraftPort?: number;
        rconPassword?: string;
        cryptobotToken?: string;
        monobankJarUrl?: string;
        monobankToken?: string;
        monobankJarId?: string;
        tonAddress?: string;
        bridgeEnabled?: boolean;
      }
    | null;

  const current = await prisma.connection.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!current) return fail("Конфіг підключень не знайдено.", 404);

  const updated = await prisma.connection.update({
    where: { id: current.id },
    data: {
      twitchUsername: body?.twitchUsername?.trim() ?? current.twitchUsername,
      tiktokUsername:
        typeof body?.tiktokUsername === "string"
          ? normalizeTikTokUsername(body.tiktokUsername)
          : current.tiktokUsername,
      minecraftHost: body?.minecraftHost?.trim() ?? current.minecraftHost,
      minecraftPort:
        body?.minecraftPort != null ? Number(body.minecraftPort) : current.minecraftPort,
      rconPassword: body?.rconPassword?.trim() ?? current.rconPassword,
      cryptobotToken: body?.cryptobotToken?.trim() ?? current.cryptobotToken,
      monobankJarUrl: body?.monobankJarUrl?.trim() ?? current.monobankJarUrl,
      monobankToken: body?.monobankToken?.trim() ?? current.monobankToken,
      monobankJarId: body?.monobankJarId?.trim() ?? current.monobankJarId,
      tonAddress: body?.tonAddress?.trim() ?? current.tonAddress,
      bridgeEnabled:
        typeof body?.bridgeEnabled === "boolean" ? body.bridgeEnabled : current.bridgeEnabled,
    },
  });

  await prisma.eventLog.create({
    data: {
      type: "SYSTEM",
      message: "Оновлено інтеграційні підключення.",
    },
  });

  return ok(updated);
}
