import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  const item = await prisma.fakeDonation.findUnique({ where: { id: params.id } });
  if (!item) return fail("Фейк-донат не знайдено.", 404);

  await prisma.$transaction([
    prisma.fakeDonation.delete({ where: { id: params.id } }),
    prisma.donation.deleteMany({
      where: {
        isFake: true,
        donorName: item.donorName,
        amountUah: item.amountUah,
        message: item.message,
        createdAt: item.createdAt,
      },
    }),
  ]);
  return ok({ deleted: true });
}
