import { unlink } from "node:fs/promises";
import path from "node:path";
import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const media = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!media) return fail("Файл не знайдено.", 404);

  await prisma.mediaAsset.delete({ where: { id: params.id } });

  const absolute = path.join(process.cwd(), "public", media.relativePath.replace(/^\//, ""));
  await unlink(absolute).catch(() => null);

  return ok({ deleted: true });
}
