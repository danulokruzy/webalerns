import { isDashboardAuthorized, updateAdminPassword } from "@/server/auth";
import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function GET() {
  await ensureBootstrap();
  const payment = await prisma.paymentSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return ok(payment);
}

export async function POST(request: Request) {
  await ensureBootstrap();
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const body = (await request.json().catch(() => null)) as
    | {
        uahPaymentUrl?: string;
        cryptobotUsdtUrl?: string;
        tonPayUrl?: string;
        tonReceiverAddress?: string;
        tonNetwork?: string;
        minAmountUah?: number;
        maxAmountUah?: number;
        paymentMemoPrefix?: string;
        confirmationMode?: string;
        usdtToUahFallback?: number;
        tonToUahFallback?: number;
        adminPassword?: string;
      }
    | null;

  const current = await prisma.paymentSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!current) return fail("Налаштування не знайдено.", 404);

  const updated = await prisma.paymentSettings.update({
    where: { id: current.id },
    data: {
      uahPaymentUrl: body?.uahPaymentUrl?.trim() ?? current.uahPaymentUrl,
      cryptobotUsdtUrl: body?.cryptobotUsdtUrl?.trim() ?? current.cryptobotUsdtUrl,
      tonPayUrl: body?.tonPayUrl?.trim() ?? current.tonPayUrl,
      tonReceiverAddress: body?.tonReceiverAddress?.trim() ?? current.tonReceiverAddress,
      tonNetwork: body?.tonNetwork?.trim() ?? current.tonNetwork,
      minAmountUah:
        body?.minAmountUah != null ? Number(body.minAmountUah) : current.minAmountUah,
      maxAmountUah:
        body?.maxAmountUah != null ? Number(body.maxAmountUah) : current.maxAmountUah,
      paymentMemoPrefix: body?.paymentMemoPrefix?.trim() ?? current.paymentMemoPrefix,
      confirmationMode: body?.confirmationMode?.trim() ?? current.confirmationMode,
      usdtToUahFallback:
        body?.usdtToUahFallback != null
          ? Number(body.usdtToUahFallback)
          : current.usdtToUahFallback,
      tonToUahFallback:
        body?.tonToUahFallback != null ? Number(body.tonToUahFallback) : current.tonToUahFallback,
    },
  });

  if (body?.adminPassword?.trim()) {
    await updateAdminPassword(body.adminPassword.trim());
  }

  await prisma.eventLog.create({
    data: {
      type: "SYSTEM",
      message: "Оновлено налаштування платежів/доступу.",
    },
  });

  return ok(updated);
}
