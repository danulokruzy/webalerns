import { ok } from "@/server/http";
import { prisma } from "@/server/prisma";

const STATE_KEY = "tiktokRuntimeSeenIds";
const MAX_SEEN = 10000;

function normalizeSeen(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(-MAX_SEEN);
}

export async function GET() {
  const record = await prisma.appSetting.findUnique({
    where: { key: STATE_KEY },
  });

  if (!record?.value) {
    return ok({ seen: [] as string[], updatedAt: null });
  }

  try {
    const parsed = JSON.parse(record.value) as { seen?: unknown };
    return ok({
      seen: normalizeSeen(parsed?.seen),
      updatedAt: record.updatedAt,
    });
  } catch {
    return ok({
      seen: [] as string[],
      updatedAt: record.updatedAt,
    });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        seen?: unknown;
      }
    | null;

  const seen = normalizeSeen(body?.seen);
  const updated = await prisma.appSetting.upsert({
    where: { key: STATE_KEY },
    update: {
      value: JSON.stringify({ seen }),
    },
    create: {
      key: STATE_KEY,
      value: JSON.stringify({ seen }),
    },
  });

  return ok({
    seen,
    updatedAt: updated.updatedAt,
  });
}
