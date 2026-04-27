import { ensureBootstrap } from "@/server/bootstrap";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

const HEARTBEAT_KEY_PREFIX = "widgetHeartbeat:";
const ONLINE_WINDOW_MS = 15_000;

function keyFor(slug: string) {
  return `${HEARTBEAT_KEY_PREFIX}${slug}`;
}

function normalizeSlug(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function mapStatus(slug: string, value: string | null) {
  const lastSeenAt = value ? Number(value) : NaN;
  const now = Date.now();
  const online = Number.isFinite(lastSeenAt) && now - lastSeenAt <= ONLINE_WINDOW_MS;
  return {
    slug,
    lastSeenAt: Number.isFinite(lastSeenAt) ? new Date(lastSeenAt).toISOString() : null,
    online,
    staleMs: Number.isFinite(lastSeenAt) ? now - lastSeenAt : null,
  };
}

export async function GET(request: Request) {
  await ensureBootstrap();

  const url = new URL(request.url);
  const requestedSlug = normalizeSlug(url.searchParams.get("slug"));

  if (requestedSlug) {
    const row = await prisma.appSetting.findUnique({
      where: { key: keyFor(requestedSlug) },
      select: { value: true },
    });
    return ok(mapStatus(requestedSlug, row?.value ?? null));
  }

  const [presets, rows] = await Promise.all([
    prisma.widgetPreset.findMany({
      select: { slug: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.appSetting.findMany({
      where: { key: { startsWith: HEARTBEAT_KEY_PREFIX } },
      select: { key: true, value: true },
    }),
  ]);

  const valueBySlug = new Map<string, string>();
  for (const row of rows) {
    const slug = row.key.slice(HEARTBEAT_KEY_PREFIX.length);
    if (!slug) continue;
    valueBySlug.set(slug, row.value);
  }

  const uniq = new Set<string>();
  for (const preset of presets) uniq.add(normalizeSlug(preset.slug));
  for (const slug of Array.from(valueBySlug.keys())) uniq.add(normalizeSlug(slug));

  const statuses = Array.from(uniq)
    .filter(Boolean)
    .map((slug) => mapStatus(slug, valueBySlug.get(slug) ?? null))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return ok(statuses);
}

export async function POST(request: Request) {
  await ensureBootstrap();

  const body = (await request.json().catch(() => null)) as
    | {
        slug?: string;
      }
    | null;

  const slug = normalizeSlug(body?.slug);
  if (!slug) return fail("slug є обов'язковим.", 400);

  const timestamp = String(Date.now());
  await prisma.appSetting.upsert({
    where: { key: keyFor(slug) },
    update: { value: timestamp },
    create: { key: keyFor(slug), value: timestamp },
  });

  return ok(mapStatus(slug, timestamp));
}
