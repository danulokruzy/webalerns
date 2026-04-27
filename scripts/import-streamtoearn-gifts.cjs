/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SOURCE_URL = "https://streamtoearn.io/gifts";

function decodeHtml(input) {
  return String(input || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(input) {
  return String(input || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseGiftsFromHtml(html) {
  const regex =
    /<div class="gift">[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[\s\S]*?<p class="gift-name">([\s\S]*?)<\/p>[\s\S]*?<p class="gift-price">\s*([0-9]+)\s*<img/gi;

  const parsed = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const imageUrl = decodeHtml(match[1]).trim();
    const altName = decodeHtml(match[2]).trim();
    const nameFromHtml = stripTags(decodeHtml(match[3]));
    const name = nameFromHtml || altName;
    const coins = Number(match[4]);

    if (!name || !Number.isFinite(coins)) continue;
    parsed.push({
      name,
      coins,
      imageUrl: imageUrl || null,
    });
  }

  const dedup = new Map();
  for (const item of parsed) {
    const key = `${item.name.toLowerCase()}|${item.coins}`;
    if (!dedup.has(key)) {
      dedup.set(key, item);
      continue;
    }
    const current = dedup.get(key);
    if (!current.imageUrl && item.imageUrl) {
      dedup.set(key, item);
    }
  }

  return Array.from(dedup.values()).sort((a, b) => {
    if (a.coins !== b.coins) return a.coins - b.coins;
    return a.name.localeCompare(b.name);
  });
}

function assignGiftIds(gifts) {
  const used = new Set();
  return gifts.map((gift) => {
    const base = `ste:${slugify(gift.name)}:${gift.coins}`;
    let giftId = base;
    let i = 2;
    while (used.has(giftId)) {
      giftId = `${base}:${i}`;
      i += 1;
    }
    used.add(giftId);
    return { ...gift, giftId };
  });
}

async function main() {
  console.log(`[streamtoearn-import] downloading: ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Cannot fetch ${SOURCE_URL}: ${response.status}`);
  }

  const html = await response.text();
  const gifts = assignGiftIds(parseGiftsFromHtml(html));
  console.log(`[streamtoearn-import] parsed gifts: ${gifts.length}`);

  const externalDir = path.join(process.cwd(), "external");
  if (!fs.existsSync(externalDir)) fs.mkdirSync(externalDir, { recursive: true });
  const dumpPath = path.join(externalDir, "streamtoearn-gifts.json");
  fs.writeFileSync(
    dumpPath,
    JSON.stringify(
      {
        sourceUrl: SOURCE_URL,
        importedAt: new Date().toISOString(),
        count: gifts.length,
        gifts,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`[streamtoearn-import] dump saved: ${dumpPath}`);

  const now = new Date();
  const existing = await prisma.giftCatalog.findMany({
    where: { provider: "streamtoearn" },
    select: { giftId: true },
  });
  const nextIds = new Set(gifts.map((gift) => gift.giftId));

  const staleIds = existing.map((row) => row.giftId).filter((giftId) => !nextIds.has(giftId));
  if (staleIds.length > 0) {
    await prisma.giftCatalog.updateMany({
      where: { provider: "streamtoearn", giftId: { in: staleIds } },
      data: { isActive: false, lastSeenAt: now },
    });
  }

  let upserted = 0;
  for (const gift of gifts) {
    await prisma.giftCatalog.upsert({
      where: { giftId: gift.giftId },
      update: {
        provider: "streamtoearn",
        name: gift.name,
        coins: gift.coins,
        imageUrl: gift.imageUrl,
        isActive: true,
        lastSeenAt: now,
      },
      create: {
        provider: "streamtoearn",
        giftId: gift.giftId,
        name: gift.name,
        coins: gift.coins,
        imageUrl: gift.imageUrl,
        firstSeenAt: now,
        lastSeenAt: now,
        isActive: true,
      },
    });
    upserted += 1;
  }

  console.log(`[streamtoearn-import] upserted: ${upserted}, disabled stale: ${staleIds.length}`);
}

main()
  .catch((error) => {
    console.error("[streamtoearn-import] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
