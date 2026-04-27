import { ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function GET() {
  const media = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok(media);
}
