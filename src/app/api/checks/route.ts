import { createDonationCheck, getPublicSummary } from "@/server/payments/checks";
import { fail, ok } from "@/server/http";
import { ensureBootstrap } from "@/server/bootstrap";

export async function GET() {
  await ensureBootstrap();
  const summary = await getPublicSummary();
  return ok(summary);
}

export async function POST(request: Request) {
  await ensureBootstrap();
  const body = (await request.json().catch(() => null)) as
    | {
        donorName?: string;
        message?: string;
        youtubeUrl?: string;
        voiceUrl?: string;
        amount?: number;
        channel?: "uah" | "cryptobot" | "tonpay";
      }
    | null;

  if (!body?.channel || body.amount == null) {
    return fail("Не вистачає даних для створення чеку.", 400);
  }

  try {
    const check = await createDonationCheck({
      donorName: body.donorName ?? "",
      message: body.message ?? "",
      youtubeUrl: body.youtubeUrl,
      voiceUrl: body.voiceUrl,
      amount: Number(body.amount),
      channel: body.channel,
    });
    return ok(check);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка створення чеку.";
    return fail(message, 400);
  }
}
