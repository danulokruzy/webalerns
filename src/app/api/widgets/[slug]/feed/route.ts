import { ok } from "@/server/http";
import { prisma } from "@/server/prisma";
import {
  type AlertFeedMode,
  getAlertsFeed,
  getFakeBattle,
  getLastDonations,
  getTopDonors,
  type TopPeriod,
} from "@/server/widgets/feed";

function parseTopPeriod(input: string | null): TopPeriod | null {
  if (input === "week" || input === "month" || input === "all") return input;
  return null;
}

function parseAlertMode(input: string | null): AlertFeedMode {
  if (input === "donation" || input === "tiktok_donation" || input === "all") return input;
  if (input === "gift") return "tiktok_donation";
  return "all";
}

async function resolveTopPeriodFromPreset(): Promise<TopPeriod> {
  const preset = await prisma.widgetPreset.findUnique({
    where: { slug: "top-donors" },
    select: { settingsJson: true },
  });
  if (!preset?.settingsJson) return "all";

  try {
    const parsed = JSON.parse(preset.settingsJson) as { period?: string };
    const period = parseTopPeriod(parsed.period ?? null);
    return period ?? "all";
  } catch {
    return "all";
  }
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "30");
  const includeFake = url.searchParams.get("includeFake") !== "false";
  const requestedPeriod = parseTopPeriod(url.searchParams.get("period"));
  const mode = parseAlertMode(url.searchParams.get("mode"));

  if (params.slug === "last-donations") {
    return ok(await getLastDonations(limit));
  }
  if (params.slug === "top-donors") {
    const period = requestedPeriod ?? (await resolveTopPeriodFromPreset());
    return ok(await getTopDonors(Math.min(10, limit), { period }));
  }
  if (params.slug === "alerts-feed") {
    return ok(await getAlertsFeed(limit, includeFake, mode));
  }
  if (params.slug === "donation-alert") {
    return ok(await getAlertsFeed(limit, includeFake, "donation"));
  }
  if (params.slug === "tiktok-alert") {
    return ok(await getAlertsFeed(limit, includeFake, "tiktok_donation"));
  }
  if (params.slug === "fake-battle") {
    return ok(await getFakeBattle(limit));
  }

  return ok([]);
}
