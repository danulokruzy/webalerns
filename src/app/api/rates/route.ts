import { getRates } from "@/server/rates";
import { ok } from "@/server/http";

export async function GET() {
  const rates = await getRates();
  return ok(rates);
}
