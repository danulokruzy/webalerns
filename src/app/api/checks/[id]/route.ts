import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { expireOldChecks } from "@/server/payments/checks";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await expireOldChecks();
  const check = await prisma.donationCheck.findUnique({
    where: { id: params.id },
  });
  if (!check) return fail("Чек не знайдено.", 404);
  return ok(check);
}
