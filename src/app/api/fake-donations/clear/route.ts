import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function POST() {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  await prisma.fakeDonation.deleteMany({});
  await prisma.donation.deleteMany({ where: { isFake: true } });

  await prisma.eventLog.create({
    data: {
      type: "FAKE",
      message: "Видалено всі фейк-донати.",
    },
  });

  return ok({ cleared: true });
}
