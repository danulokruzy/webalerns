import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function GET() {
  const [items, top3] = await Promise.all([
    prisma.fakeDonation.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.fakeDonation.groupBy({
      by: ["donorName"],
      _sum: { amountUah: true },
      orderBy: { _sum: { amountUah: "desc" } },
      take: 3,
    }),
  ]);

  return ok({
    items,
    top3: top3.map((item) => ({
      donorName: item.donorName,
      totalUah: item._sum.amountUah ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  const body = (await request.json().catch(() => null)) as
    | {
        donorName?: string;
        amountUah?: number;
        message?: string;
        battleTag?: string;
      }
    | null;

  const item = await prisma.fakeDonation.create({
    data: {
      donorName: body?.donorName?.trim() || "Анонім",
      amountUah: body?.amountUah != null ? Number(body.amountUah) : 0,
      message: body?.message?.trim() || "",
      battleTag: body?.battleTag?.trim() || null,
    },
  });

  await prisma.donation.create({
    data: {
      donorName: item.donorName,
      message: item.message,
      channel: "UAH",
      amountOriginal: item.amountUah,
      amountLabel: `${item.amountUah} грн`,
      amountUah: item.amountUah,
      isAnonymous: false,
      isFake: true,
      createdAt: item.createdAt,
    },
  });

  await prisma.eventLog.create({
    data: {
      type: "FAKE",
      message: `Додано фейк-донат від ${item.donorName}`,
      payloadJson: JSON.stringify({ fakeId: item.id }),
    },
  });

  return ok(item);
}
