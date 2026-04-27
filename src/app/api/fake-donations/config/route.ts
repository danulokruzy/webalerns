import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function GET() {
  let config = await prisma.fakeDonationConfig.findFirst();
  if (!config) {
    config = await prisma.fakeDonationConfig.create({ data: {} });
  }
  return ok(config);
}

export async function POST(request: Request) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const body = (await request.json().catch(() => null)) as {
    enabled?: boolean;
    name1?: string;
    name2?: string;
    minPauseSec?: number;
    maxPauseSec?: number;
    minAmountUah?: number;
    maxAmountUah?: number;
    messages?: string;
  } | null;

  let config = await prisma.fakeDonationConfig.findFirst();
  if (!config) {
    config = await prisma.fakeDonationConfig.create({ data: {} });
  }

  const updated = await prisma.fakeDonationConfig.update({
    where: { id: config.id },
    data: {
      enabled: body?.enabled ?? config.enabled,
      name1: body?.name1?.trim() ?? config.name1,
      name2: body?.name2?.trim() ?? config.name2,
      minPauseSec: body?.minPauseSec != null ? Number(body.minPauseSec) : config.minPauseSec,
      maxPauseSec: body?.maxPauseSec != null ? Number(body.maxPauseSec) : config.maxPauseSec,
      minAmountUah: body?.minAmountUah != null ? Number(body.minAmountUah) : config.minAmountUah,
      maxAmountUah: body?.maxAmountUah != null ? Number(body.maxAmountUah) : config.maxAmountUah,
      messages: body?.messages ?? config.messages,
    },
  });

  return ok(updated);
}
