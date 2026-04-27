import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type")?.trim() || null;
  const search = url.searchParams.get("search")?.trim() || null;
  const takeRaw = Number(url.searchParams.get("take") || "500");
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(1000, takeRaw)) : 500;

  const logs = await prisma.eventLog.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(search ? { message: { contains: search } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return ok(logs);
}

export async function DELETE() {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  await prisma.eventLog.deleteMany({});
  return ok({ cleared: true });
}
