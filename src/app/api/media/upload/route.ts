import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import { MEDIA_TYPE } from "@/server/domain";

function detectType(mimeType: string): string {
  return mimeType.startsWith("audio/") ? MEDIA_TYPE.AUDIO : MEDIA_TYPE.VIDEO;
}

export async function POST(request: Request) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  const formData = await request.formData().catch(() => null);
  if (!formData) return fail("Не вдалося прочитати form-data.", 400);
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Файл не передано.", 400);

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = path.extname(safeName) || (file.type.includes("audio") ? ".webm" : ".mp4");
  const outputName = `${Date.now()}-${randomUUID()}${ext}`;
  const outputDir = path.join(process.cwd(), "public", "uploads");
  const outputPath = path.join(outputDir, outputName);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, bytes);

  const media = await prisma.mediaAsset.create({
    data: {
      type: detectType(file.type),
      originalName: file.name,
      fileName: outputName,
      relativePath: `/uploads/${outputName}`,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: bytes.byteLength,
    },
  });

  await prisma.eventLog.create({
    data: {
      type: "SYSTEM",
      message: `Завантажено медіа ${media.originalName}`,
      payloadJson: JSON.stringify({ mediaId: media.id }),
    },
  });

  return ok(media);
}
