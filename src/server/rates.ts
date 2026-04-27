import { prisma } from "@/server/prisma";

type CachedRates = {
  updatedAt: number;
  usdToUah: number;
  usdtToUah: number;
  tonToUah: number;
};

const cache: { value: CachedRates | null } = { value: null };
const TTL_MS = 60 * 1000;

function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function fetchUsdToUah(): Promise<number> {
  const response = await fetch(
    "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json",
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error(`NBU request failed: ${response.status}`);
  const data = (await response.json()) as Array<{ rate?: number }>;
  const rate = data?.[0]?.rate;
  if (!rate) throw new Error("NBU response has no USD rate");
  return safeNumber(rate, 40);
}

async function fetchCryptoToUsd(): Promise<{ usdtToUsd: number; tonToUsd: number }> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether,the-open-network&vs_currencies=usd",
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error(`CoinGecko request failed: ${response.status}`);
  const data = (await response.json()) as Record<string, { usd?: number }>;
  return {
    usdtToUsd: safeNumber(data?.tether?.usd, 1),
    tonToUsd: safeNumber(data?.["the-open-network"]?.usd, 6),
  };
}

async function fallbackRates(): Promise<CachedRates> {
  const settings = await prisma.paymentSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const usdt = settings?.usdtToUahFallback ?? 40;
  const ton = settings?.tonToUahFallback ?? 250;
  const usd = usdt;
  return {
    updatedAt: Date.now(),
    usdToUah: usd,
    usdtToUah: usdt,
    tonToUah: ton,
  };
}

export async function getRates(forceRefresh = false): Promise<CachedRates> {
  const now = Date.now();
  if (!forceRefresh && cache.value && now - cache.value.updatedAt < TTL_MS) {
    return cache.value;
  }

  try {
    const [usdToUah, crypto] = await Promise.all([fetchUsdToUah(), fetchCryptoToUsd()]);
    const next: CachedRates = {
      updatedAt: now,
      usdToUah,
      usdtToUah: Number((crypto.usdtToUsd * usdToUah).toFixed(4)),
      tonToUah: Number((crypto.tonToUsd * usdToUah).toFixed(4)),
    };
    cache.value = next;
    return next;
  } catch {
    const fallback = await fallbackRates();
    cache.value = fallback;
    return fallback;
  }
}

export function convertToUah(
  amount: number,
  channel: "uah" | "cryptobot" | "tonpay",
  rates: CachedRates
) {
  if (channel === "uah") return amount;
  if (channel === "cryptobot") return amount * rates.usdtToUah;
  return amount * rates.tonToUah;
}
