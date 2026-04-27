"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Params = { slug: string };
type TopPeriod = "week" | "month" | "all";
type AlertMode = "all" | "donation" | "tiktok_donation";
type AnimationPreset = "soft-pop" | "slide-up" | "slide-left" | "fade-in" | "bounce" | "shake" | "none";

type TopDonorRow = { donorName: string; totalUah: number };
type DonationRow = {
  id: string;
  donorName: string;
  amountUah: number;
  message: string;
  kind?: "donation" | "tiktok_donation";
  tiktokDonationName?: string | null;
  tiktokCoins?: number | null;
  imageUrl?: string | null;
};
type BattleData = { top3: TopDonorRow[]; entries: DonationRow[] };
type WidgetViewConfig = {
  minUah: number | null;
  maxUah: number | null;
  gifUrl: string;
  soundUrl: string;
  transparent: boolean;
  animationPreset: AnimationPreset;
  displayMs: number;
};

const ANIMATION_CSS: Record<AnimationPreset, string> = {
  "soft-pop": "animate-[softPop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]",
  "slide-up": "animate-[slideUp_0.5s_ease-out]",
  "slide-left": "animate-[slideLeft_0.5s_ease-out]",
  "fade-in": "animate-[fadeIn_0.6s_ease]",
  bounce: "animate-[bounce_0.6s_ease]",
  shake: "animate-[shake_0.5s_ease]",
  none: "",
};

function parseMode(value: string | null): AlertMode {
  if (value === "donation" || value === "tiktok_donation" || value === "all") return value;
  if (value === "gift") return "tiktok_donation";
  return "all";
}

function parseAnimationPreset(value: string | null): AnimationPreset {
  const valid: AnimationPreset[] = ["soft-pop", "slide-up", "slide-left", "fade-in", "bounce", "shake", "none"];
  if (value && valid.includes(value as AnimationPreset)) return value as AnimationPreset;
  return "soft-pop";
}

export default function WidgetPage({ params }: { params: Params }) {
  const [items, setItems] = useState<TopDonorRow[] | DonationRow[] | BattleData | null>(null);
  const [topPeriod, setTopPeriod] = useState<TopPeriod>("all");
  const [feedMode, setFeedMode] = useState<AlertMode>("all");
  const [activeAlert, setActiveAlert] = useState<DonationRow | null>(null);
  const [shownAlertId, setShownAlertId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [viewConfig, setViewConfig] = useState<WidgetViewConfig>({
    minUah: null,
    maxUah: null,
    gifUrl: "",
    soundUrl: "",
    transparent: true,
    animationPreset: "soft-pop",
    displayMs: 9000,
  });

  const playSound = useCallback((url: string) => {
    if (!url) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio(url);
      audio.volume = 0.8;
      audioRef.current = audio;
      void audio.play().catch(() => {});
    } catch {
      // ignore audio errors in widget
    }
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const periodRaw = search.get("period");
    const period: TopPeriod =
      periodRaw === "week" || periodRaw === "month" || periodRaw === "all" ? periodRaw : "all";

    const minUah = search.get("minUah");
    const maxUah = search.get("maxUah");
    const gifUrl = search.get("gif") || "";
    const soundUrl = search.get("sound") || "";
    const transparent = search.get("transparent") !== "0";
    const mode = parseMode(search.get("mode"));
    const animationPreset = parseAnimationPreset(search.get("animation"));
    const displayMs = Number(search.get("displayMs")) || 9000;

    setViewConfig({
      minUah: minUah != null ? Number(minUah) : null,
      maxUah: maxUah != null ? Number(maxUah) : null,
      gifUrl,
      soundUrl,
      transparent,
      animationPreset,
      displayMs,
    });

    if (params.slug === "top-donors") setTopPeriod(period);
    if (params.slug === "alerts-feed") setFeedMode(mode);
    if (params.slug === "donation-alert") setFeedMode("donation");
    if (params.slug === "tiktok-alert") setFeedMode("tiktok_donation");
  }, [params.slug]);

  useEffect(() => {
    let mounted = true;
    async function sendHeartbeat() {
      try {
        await fetch("/api/widgets/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: params.slug }),
          keepalive: true,
        });
      } catch {
        // ignore heartbeat errors in widget runtime
      }
    }

    void sendHeartbeat();
    const timer = window.setInterval(() => {
      if (!mounted) return;
      void sendHeartbeat();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [params.slug]);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const feedUrl = new URL(`/api/widgets/${params.slug}/feed`, window.location.origin);
      if (params.slug === "top-donors") {
        feedUrl.searchParams.set("period", topPeriod);
      }
      if (params.slug === "alerts-feed") {
        feedUrl.searchParams.set("mode", feedMode);
      }
      if (params.slug === "donation-alert") {
        feedUrl.searchParams.set("mode", "donation");
      }
      if (params.slug === "tiktok-alert") {
        feedUrl.searchParams.set("mode", "tiktok_donation");
      }

      const response = await fetch(feedUrl.toString(), { cache: "no-store" });
      const data = await response.json();
      if (mounted && data.ok) {
        setItems(data.data);
      }
    }

    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [params.slug, topPeriod, feedMode]);

  const containerClass = viewConfig.transparent
    ? "widget-shell p-4"
    : "widget-shell p-4 bg-[#0b0a09]/90";
  const filteredRows = useMemo(() => {
    const rows: DonationRow[] = Array.isArray(items) ? (items as DonationRow[]) : [];
    return rows.filter((row) => {
      if ((row.kind || "donation") === "tiktok_donation") return true;
      if (viewConfig.minUah != null && Number(row.amountUah) < viewConfig.minUah) return false;
      if (viewConfig.maxUah != null && Number(row.amountUah) > viewConfig.maxUah) return false;
      return true;
    });
  }, [items, viewConfig.maxUah, viewConfig.minUah]);

  useEffect(() => {
    if (params.slug !== "alerts-feed" && params.slug !== "donation-alert" && params.slug !== "tiktok-alert") return;
    if (filteredRows.length === 0) return;

    const newest = filteredRows[0];
    if (!newest || newest.id === shownAlertId) return;

    setActiveAlert(newest);
    setShownAlertId(newest.id);

    if (viewConfig.soundUrl) {
      playSound(viewConfig.soundUrl);
    }

    const timer = window.setTimeout(() => {
      setActiveAlert(null);
    }, viewConfig.displayMs || 9000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [params.slug, filteredRows, shownAlertId, viewConfig.soundUrl, viewConfig.displayMs, playSound]);

  function setAlertMode(mode: AlertMode) {
    setFeedMode(mode);
    const url = new URL(window.location.href);
    if (mode === "all") {
      url.searchParams.delete("mode");
    } else {
      url.searchParams.set("mode", mode);
    }
    window.history.replaceState({}, "", url.toString());
    setShownAlertId(null);
    setActiveAlert(null);
  }

  if (params.slug === "top-donors") {
    const topRows: TopDonorRow[] = Array.isArray(items) ? (items as TopDonorRow[]) : [];
    const title =
      topPeriod === "week"
        ? "Топ донатерів за тиждень"
        : topPeriod === "month"
          ? "Топ донатерів за місяць"
          : "Топ донатерів за весь час";

    return (
      <main className={containerClass}>
        <h1 className="widget-title">{title}</h1>
        <div className="mt-3 space-y-2">
          {topRows.map((row, index) => (
            <div key={row.donorName} className="widget-item">
              {index + 1}. {row.donorName} — {row.totalUah.toFixed(2)} грн
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (params.slug === "fake-battle") {
    const battle: BattleData =
      items && !Array.isArray(items) && "top3" in items
        ? (items as BattleData)
        : { top3: [], entries: [] };
    return (
      <main className={containerClass}>
        <h1 className="widget-title">Топ донатів</h1>
        <div className="mt-3 space-y-2">
          {battle.top3.map((row, index) => (
            <div key={row.donorName} className="widget-item">
              {index + 1}. {row.donorName} — {row.totalUah.toFixed(2)} грн
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (params.slug === "alerts-feed") {
    const isTikTokDonation = (activeAlert?.kind || "donation") === "tiktok_donation";

    return (
      <main className={containerClass}>
        <div className="mb-3 flex flex-wrap gap-2">
          {([
            { id: "all" as const, label: "Усі" },
            { id: "donation" as const, label: "Донати" },
            { id: "tiktok_donation" as const, label: "TikTok-донати" },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAlertMode(item.id)}
              className={`rounded-lg border px-3 py-1 text-xs transition ${
                feedMode === item.id
                  ? "border-amber-300/70 bg-amber-400/20 text-amber-100"
                  : "border-white/20 bg-black/30 text-amber-50/75 hover:bg-black/45"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {activeAlert ? (
          <div className={`widget-item border-amber-300/40 bg-black/45 shadow-[0_0_25px_rgba(245,158,11,0.25)] ${ANIMATION_CSS[viewConfig.animationPreset] || ""}`}>
            {activeAlert.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeAlert.imageUrl} alt="tiktok donation" className="mb-2 h-24 w-24 object-contain" />
            ) : viewConfig.gifUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewConfig.gifUrl} alt="gif" className="mb-2 h-24 w-24 object-contain" />
            ) : null}

            {isTikTokDonation ? (
              <>
                <p className="text-xl font-semibold leading-tight">
                  {activeAlert.donorName} — TikTok-донат: {activeAlert.tiktokDonationName || activeAlert.message}
                </p>
                <p className="mt-1 text-sm text-amber-100/90">
                  {Number(activeAlert.tiktokCoins || 0)} coins
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold leading-tight">
                  {activeAlert.donorName} — {Number(activeAlert.amountUah).toFixed(2)} грн
                </p>
                <p className="mt-1 text-sm text-amber-100/90">
                  {activeAlert.message?.trim() || "Без повідомлення"}
                </p>
              </>
            )}
          </div>
        ) : null}
      </main>
    );
  }

  if (params.slug === "donation-alert") {
    return (
      <main className={containerClass}>
        {activeAlert ? (
          <div className={`widget-item border-amber-300/40 bg-black/45 shadow-[0_0_25px_rgba(245,158,11,0.25)] ${ANIMATION_CSS[viewConfig.animationPreset] || ""}`}>
            {viewConfig.gifUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewConfig.gifUrl} alt="gif" className="mb-2 h-24 w-24 object-contain" />
            ) : null}
            <p className="text-xl font-semibold leading-tight">
              {activeAlert.donorName} — {Number(activeAlert.amountUah).toFixed(2)} грн
            </p>
            <p className="mt-1 text-sm text-amber-100/90">
              {activeAlert.message?.trim() || "Без повідомлення"}
            </p>
          </div>
        ) : null}
      </main>
    );
  }

  if (params.slug === "tiktok-alert") {
    return (
      <main className={containerClass}>
        {activeAlert ? (
          <div className={`widget-item border-amber-300/40 bg-black/45 shadow-[0_0_25px_rgba(245,158,11,0.25)] ${ANIMATION_CSS[viewConfig.animationPreset] || ""}`}>
            {activeAlert.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeAlert.imageUrl} alt="tiktok donation" className="mb-2 h-24 w-24 object-contain" />
            ) : viewConfig.gifUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewConfig.gifUrl} alt="gif" className="mb-2 h-24 w-24 object-contain" />
            ) : null}
            <p className="text-xl font-semibold leading-tight">
              {activeAlert.donorName} — TikTok-донат: {activeAlert.tiktokDonationName || activeAlert.message}
            </p>
            <p className="mt-1 text-sm text-amber-100/90">
              {Number(activeAlert.tiktokCoins || 0)} coins
            </p>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className={containerClass}>
      <div className="space-y-2">
        {filteredRows.map((row) => {
          const isTikTokDonation = (row.kind || "donation") === "tiktok_donation";
          return (
            <div key={row.id} className="widget-item">
              {row.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.imageUrl} alt="tiktok donation" className="mb-2 h-24 w-24 object-contain" />
              ) : viewConfig.gifUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewConfig.gifUrl} alt="gif" className="mb-2 h-24 w-24 object-contain" />
              ) : null}
              {isTikTokDonation ? (
                <>
                  <p className="font-semibold">
                    {row.donorName} — {row.tiktokDonationName || row.message}
                  </p>
                  <p className="text-xs text-amber-100/80">{Number(row.tiktokCoins || 0)} coins</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    {row.donorName} — {Number(row.amountUah).toFixed(2)} грн
                  </p>
                  <p className="text-xs text-amber-100/80">{row.message || "Без повідомлення"}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}



