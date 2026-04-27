import { clearDashboardAuthCookie } from "@/server/auth";
import { ok } from "@/server/http";

export async function POST() {
  clearDashboardAuthCookie();
  return ok({ authorized: false });
}
