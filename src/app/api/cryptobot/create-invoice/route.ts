import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function POST(request: Request) {
  await ensureBootstrap();

  const body = (await request.json().catch(() => null)) as
    | { amount?: number; asset?: string; description?: string; payload?: string }
    | null;

  const connection = await prisma.connection.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { cryptobotToken: true },
  });

  const token = connection?.cryptobotToken?.trim();
  if (!token) {
    return fail("CryptoBot API токен не налаштовано.", 400);
  }

  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Некоректна сума.", 400);
  }

  try {
    const response = await fetch("https://pay.crypt.bot/api/createInvoice", {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset: body?.asset || "USDT",
        amount: String(amount),
        description: body?.description || "",
        hidden_message: "",
        payload: body?.payload || "",
        allow_comments: true,
        allow_anonymous: false,
      }),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      result?: {
        invoice_id?: number;
        bot_invoice_url?: string;
        pay_url?: string;
        status?: string;
      };
      error?: { code?: number; name?: string };
    };

    if (!data.ok || !data.result) {
      const errName = data.error?.name || "unknown";
      return fail(`CryptoBot API помилка: ${errName}`, 400);
    }

    return ok({
      invoiceId: data.result.invoice_id,
      payUrl: data.result.bot_invoice_url || data.result.pay_url,
      status: data.result.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Не вдалося створити інвойс: ${message}`, 500);
  }
}
