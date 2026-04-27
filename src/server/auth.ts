import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/prisma";
import { DASHBOARD_COOKIE } from "@/server/constants";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function verifyAdminPassword(password: string) {
  const user = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!user) return false;
  return user.passwordHash === sha256(password);
}

export function setDashboardAuthCookie() {
  cookies().set(DASHBOARD_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearDashboardAuthCookie() {
  cookies().set(DASHBOARD_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function isDashboardAuthorized() {
  return cookies().get(DASHBOARD_COOKIE)?.value === "1";
}

export async function updateAdminPassword(newPassword: string) {
  const passwordHash = sha256(newPassword);
  await prisma.user.update({
    where: { username: "admin" },
    data: { passwordHash },
  });
}

export function hashToken(value: string) {
  return sha256(value);
}
