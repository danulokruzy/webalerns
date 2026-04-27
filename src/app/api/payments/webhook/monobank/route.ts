import { ensureBootstrap } from "@/server/bootstrap";
import { ok } from "@/server/http";
import { verifyDonation } from "@/server/payments/checks";
import { prisma } from "@/server/prisma";

type StatementItem = {
  id?: string;
  time?: number;
  description?: string;
  comment?: string;
  mcc?: number;
  amount?: number;
  operationAmount?: number;
  currencyCode?: number;
  balance?: number;
  hold?: boolean;
};

type MonobankWebhookBody = {
  type?: string;
  data?: {
    account?: string;
    statementItem?: StatementItem;
  };
};

export async function GET() {
  return new Response("OK", { status: 200 });
}

export async function POST(request: Request) {
  await ensureBootstrap();

  const body = (await request.json().catch(() => null)) as MonobankWebhookBody | null;

  if (!body || body.type !== "StatementItem" || !body.data?.statementItem) {
    return ok({ received: true, processed: false });
  }

  const item = body.data.statementItem;
  const amountKopecks = item.amount ?? 0;

  if (amountKopecks <= 0) {
    return ok({ received: true, processed: false, reason: "outgoing_or_zero" });
  }

  const amountUah = amountKopecks / 100;
  const comment = (item.description || item.comment || "").trim();
  const txRef = item.id || `mono-${item.time || Date.now()}`;

  const connection = await prisma.connection.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { monobankJarId: true },
  });

  if (connection?.monobankJarId?.trim() && body.data.account) {
    if (body.data.account !== connection.monobankJarId.trim()) {
      await prisma.eventLog.create({
        data: {
          type: "PAYMENT",
          message: `Monobank webhook: транзакція для іншого рахунку (${body.data.account}), пропущено.`,
        },
      });
      return ok({ received: true, processed: false, reason: "wrong_account" });
    }
  }

  const result = await verifyDonation({
    channel: "uah",
    comment,
    paidAmount: amountUah,
    txHash: txRef,
    allowAnonymousOnFail: true,
    verifyOnly: false,
  });

  await prisma.eventLog.create({
    data: {
      type: "PAYMENT",
      message: `Monobank webhook: ${amountUah} грн оброблено.`,
      payloadJson: JSON.stringify({
        status: result.status,
        amountUah,
        comment,
        txRef,
        accountId: body.data.account || null,
      }),
    },
  });

  return ok({ received: true, processed: true, result });
}
