"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type WidgetHeartbeat = {
  slug: string;
  online: boolean;
  lastSeenAt: string | null;
};

const TARGET_WIDGETS = [
  { slug: "tiktok-alert", title: "TikTok алерт" },
  { slug: "alerts-feed", title: "Стрічка алертів" },
  { slug: "donation-alert", title: "Донат алерт" },
] as const;

export default function TikTokActionWidgetsPage() {
  const [statusBySlug, setStatusBySlug] = useState<Record<string, WidgetHeartbeat>>({});

  useEffect(() => {
    let mounted = true;

    async function reload() {
      const pairs = await Promise.all(
        TARGET_WIDGETS.map(async ({ slug }) => {
          const response = await fetch(`/api/widgets/heartbeat?slug=${slug}`, { cache: "no-store" });
          const data = await response.json();
          if (!response.ok || !data.ok) return [slug, null] as const;
          return [slug, data.data as WidgetHeartbeat] as const;
        })
      );

      if (!mounted) return;
      const next: Record<string, WidgetHeartbeat> = {};
      for (const [slug, value] of pairs) {
        if (value) next[slug] = value;
      }
      setStatusBySlug(next);
    }

    void reload();
    const timer = window.setInterval(() => {
      void reload();
    }, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">TikTok · Віджети дії</h1>
        <p className="mt-1 text-sm text-amber-50/70">
          Контроль стану віджетів для TikTok-донатів і швидкий перехід до їх налаштувань.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {TARGET_WIDGETS.map((item) => {
          const status = statusBySlug[item.slug];
          const online = Boolean(status?.online);
          return (
            <article key={item.slug} className="dashboard-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{item.title}</h2>
                <span
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    online
                      ? "border-emerald-300/50 bg-emerald-500/15 text-emerald-200"
                      : "border-red-300/40 bg-red-500/10 text-red-200"
                  }`}
                >
                  {online ? "онлайн" : "оффлайн"}
                </span>
              </div>
              <p className="mt-2 text-xs text-amber-50/70">
                {status?.lastSeenAt
                  ? `Останній heartbeat: ${new Date(status.lastSeenAt).toLocaleString("uk-UA")}`
                  : "Heartbeat ще не отримано."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.open(`/widget/${item.slug}`, "_blank", "noopener,noreferrer")}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-white/10"
                >
                  Відкрити виджет
                </button>
                <Link
                  href={`/dashboard/donations/widget-links?slug=${item.slug}`}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-white/10"
                >
                  Налаштувати
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

