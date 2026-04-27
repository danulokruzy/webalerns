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

  const linkedDonation = await prisma.donation.findFirst({
    where: {
      isFake: true,
      donorName: item.donorName,
      amountUah: item.amountUah,
      message: item.message,
      createdAt: item.createdAt,
    },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.fakeDonation.delete({ where: { id: params.id } }),
    ...(linkedDonation
      ? [prisma.donation.delete({ where: { id: linkedDonation.id } })]
      : []),
  ]);
  return ok({ deleted: true });
}
