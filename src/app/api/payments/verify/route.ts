import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { verifyDonation } from "@/server/payments/checks";

export async function POST(request: Request) {
  await ensureBootstrap();

  const body = (await request.json().catch(() => null)) as
    | {
        checkId?: string;
        channel?: "uah" | "cryptobot" | "tonpay";
        comment?: string;
        txHash?: string;
        paidAmount?: number;
        donorName?: string;
        message?: string;
        allowAnonymousOnFail?: boolean;
        verifyOnly?: boolean;
      }
    | null;

  if (!body?.channel) {
    return fail("Не вказано платіжний канал.", 400);
  }

  const result = await verifyDonation({
    checkId: body.checkId,
    channel: body.channel,
    comment: body.comment,
    txHash: body.txHash,
    paidAmount: body.paidAmount != null ? Number(body.paidAmount) : undefined,
    donorName: body.donorName,
    message: body.message,
    allowAnonymousOnFail: Boolean(body.allowAnonymousOnFail),
    verifyOnly: Boolean(body.verifyOnly),
  });

  return ok(result);
}
