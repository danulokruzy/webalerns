import { NextRequest } from "next/server";
import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { setDashboardAuthCookie, verifyAdminPassword } from "@/server/auth";

export async function POST(request: NextRequest) {
  await ensureBootstrap();
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim();
  if (!password) {
    return fail("Вкажіть пароль.", 400);
  }

  const valid = await verifyAdminPassword(password);
  if (!valid) {
    return fail("Невірний пароль.", 401);
  }

  setDashboardAuthCookie();
  return ok({ authorized: true });
}
