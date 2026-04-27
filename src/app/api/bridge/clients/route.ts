import { isDashboardAuthorized } from "@/server/auth";
import { ensurePrimaryBridgeClient, rotateBridgeToken } from "@/server/bridge";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function GET() {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  const seed = await ensurePrimaryBridgeClient();
  const clients = await prisma.bridgeClient.findMany({
    orderBy: { createdAt: "asc" },
  });

  return ok({
    clients,
    seededToken: seed.token,
  });
}

export async function POST(request: Request) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  const body = (await request.json().catch(() => null)) as { clientId?: string } | null;
  const clientId = body?.clientId;
  if (!clientId) return fail("clientId є обов'язковим.", 400);
  const rotated = await rotateBridgeToken(clientId);
  return ok({
    client: rotated.client,
    token: rotated.token,
  });
}
