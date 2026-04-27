import { isDashboardAuthorized } from "@/server/auth";
import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

export async function POST(request: Request) {
  await ensureBootstrap();
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);

  const body = (await request.json().catch(() => null)) as
    | { webhookUrl?: string }
    | null;

  const connection = await prisma.connection.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { monobankToken: true },
  });

  const token = connection?.monobankToken?.trim();
  if (!token) {
    return fail("Monobank токен не налаштовано. Додайте токен у налаштуваннях.", 400);
  }

  const webhookUrl = body?.webhookUrl?.trim();
  if (!webhookUrl) {
    return fail("Вкажіть URL вебхука.", 400);
  }

  try {
    const response = await fetch("https://api.monobank.ua/personal/webhook", {
      method: "POST",
      headers: {
        "X-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ webHookUrl: webhookUrl }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      await prisma.eventLog.create({
        data: {
          type: "SYSTEM",
          message: `Monobank webhook setup failed: ${response.status}`,
          payloadJson: JSON.stringify({ status: response.status, body: errorText }),
        },
      });
      return fail(`Monobank API помилка: ${response.status}. ${errorText}`, response.status);
    }

    await prisma.eventLog.create({
      data: {
        type: "SYSTEM",
        message: `Monobank webhook встановлено: ${webhookUrl}`,
      },
    });

    return ok({ success: true, webhookUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Не вдалося підключитися до Monobank API: ${message}`, 500);
  }
}
