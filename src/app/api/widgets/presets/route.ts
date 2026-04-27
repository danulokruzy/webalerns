import { isDashboardAuthorized } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { prisma } from "@/server/prisma";

type NotificationMode = "all" | "donation" | "tiktok_donation";

type WidgetVariant = {
  id: string;
  name: string;
  minUah: number;
  maxUah: number;
  gifUrl: string;
  transparent: boolean;
  mode: NotificationMode;
};

type WidgetSettings = Record<string, unknown> & {
  notificationType?: NotificationMode;
  variants?: WidgetVariant[];
};

function normalizeNotificationMode(input: unknown): NotificationMode {
  const raw = String(input || "all").trim().toLowerCase();
  if (raw === "gift") return "tiktok_donation";
  if (raw === "all" || raw === "donation" || raw === "tiktok_donation") return raw;
  return "all";
}

function normalizeNumber(input: unknown, fallback = 0) {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWidgetSettings(raw: unknown): WidgetSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const notificationType = normalizeNotificationMode(source.notificationType);
  const rawVariants = Array.isArray(source.variants) ? source.variants : [];

  const variants: WidgetVariant[] = rawVariants.map((variant, index) => {
    const row = variant && typeof variant === "object" ? (variant as Record<string, unknown>) : {};
    return {
      id: String(row.id || `variant-${index + 1}`),
      name: String(row.name || `Підвіджет ${index + 1}`),
      minUah: Math.max(0, normalizeNumber(row.minUah, 0)),
      maxUah: Math.max(0, normalizeNumber(row.maxUah, 0)),
      gifUrl: String(row.gifUrl || "").trim(),
      transparent: Boolean(row.transparent),
      mode: normalizeNotificationMode(row.mode ?? notificationType),
    };
  });

  return {
    ...source,
    notificationType,
    variants,
  };
}

function validateVariantDuplicates(slug: string, settings: WidgetSettings) {
  const variants = settings.variants || [];
  const seen = new Set<string>();

  for (const variant of variants) {
    if (variant.maxUah > 0 && variant.maxUah < variant.minUah) {
      return `Некоректний діапазон суми в підвіджеті "${variant.name}": max < min.`;
    }

    const key = `${slug}|${variant.mode}|${variant.minUah}|${variant.maxUah}`;
    if (seen.has(key)) {
      return `Знайдено дубль підвіджета (${variant.mode}, ${variant.minUah}-${variant.maxUah}).`;
    }
    seen.add(key);
  }

  return null;
}

function tryParseSettings(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET() {
  const presets = await prisma.widgetPreset.findMany({
    orderBy: { createdAt: "asc" },
  });

  const normalized = presets.map((preset) => {
    const parsed = tryParseSettings(preset.settingsJson || "{}");
    const nextSettings = normalizeWidgetSettings(parsed);
    return {
      ...preset,
      settingsJson: JSON.stringify(nextSettings),
    };
  });

  return ok(normalized);
}

export async function POST(request: Request) {
  if (!isDashboardAuthorized()) return fail("Потрібна авторизація.", 401);
  const body = (await request.json().catch(() => null)) as
    | {
        slug?: string;
        name?: string;
        settings?: Record<string, unknown>;
        isActive?: boolean;
      }
    | null;

  const slug = body?.slug?.trim();
  if (!slug) return fail("slug is required.", 400);

  const normalizedSettings = normalizeWidgetSettings(body?.settings || {});
  const duplicateError = validateVariantDuplicates(slug, normalizedSettings);
  if (duplicateError) return fail(duplicateError, 400);

  const preset = await prisma.widgetPreset.upsert({
    where: { slug },
    update: {
      name: body?.name?.trim() || slug,
      settingsJson: JSON.stringify(normalizedSettings),
      isActive: body?.isActive ?? true,
    },
    create: {
      slug,
      name: body?.name?.trim() || slug,
      settingsJson: JSON.stringify(normalizedSettings),
      isActive: body?.isActive ?? true,
    },
  });

  return ok(preset);
}
