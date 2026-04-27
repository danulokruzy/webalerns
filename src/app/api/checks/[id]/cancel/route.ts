import { cancelDonationCheck } from "@/server/payments/checks";
import { fail, ok } from "@/server/http";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const check = await cancelDonationCheck(params.id);
    return ok(check);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не вдалося скасувати чек.";
    return fail(message, 400);
  }
}
