"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type CheckItem = {
  id: string;
  code: string;
  donorName: string;
  amountLabel: string;
  amountUah: number;
  channel: string;
  status: string;
  expiresAt: string;
  payUrl: string;
};

type DonationItem = {
  id: string;
  donorName: string;
  message: string;
  amountLabel: string;
  amountUah: number;
  channel: string;
  isAnonymous: boolean;
  isFake: boolean;
  kind?: "donation" | "tiktok_donation";
  tiktokDonationName?: string | null;
  tiktokCoins?: number | null;
  tiktokDonationImageUrl?: string | null;
  createdAt: string;
};

type TopPeriod = "week" | "month" | "all";
type DonationStatus = "pending" | "playing" | "played" | "skipped" | "deleted";
type DonationStatusMap = Record<string, DonationStatus>;

type TopDonorItem = {
  donorName: string;
  totalUah: number;
};

type TopsByPeriod = Record<TopPeriod, TopDonorItem[]>;
type WidgetPreset = { isActive: boolean };
type WidgetHeartbeat = {
  slug: string;
  online: boolean;
  lastSeenAt: string | null;
};

const EMPTY_TOPS: TopsByPeriod = { week: [], month: [], all: [] };
const STORAGE_STATUS_KEY = "donatelko_donation_statuses";
const STORAGE_QUEUE_ENABLED_KEY = "donatelko_queue_enabled";

function detectTikTokDonation(item: DonationItem) {
  if (item.kind === "tiktok_donation" || item.channel === "TIKTOK") return true;
  const msg = (item.message || "").toLowerCase();
  const label = (item.amountLabel || "").toLowerCase();
  return msg.includes("tiktok donation") || msg.includes("tiktok gift") || label.includes("tiktok donation");
}

function channelLabel(channel: string) {
  if (channel === "UAH") return "UAH";
  if (channel === "CRYPTOBOT") return "CryptoBOT";
  if (channel === "TONPAY") return "TonPay";
  if (channel === "TIKTOK") return "TikTok";
  return channel;
}

function estimateSpeakDurationMs(text: string) {
  const len = Math.max(1, text.trim().length);
  return Math.max(2200, Math.min(13000, 1000 + len * 55));
}

export default function DonationsPage() {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [tops, setTops] = useState<TopsByPeriod>(EMPTY_TOPS);
  const [message, setMessage] = useState("");

  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState(50);
  const [manualMessage, setManualMessage] = useState("");
  const [manualChannel, setManualChannel] = useState("UAH");
  const [addingManual, setAddingManual] = useState(false);

  const [topPeriod, setTopPeriod] = useState<TopPeriod>("all");
  const [listTab, setListTab] = useState<"all" | "tiktok_donations" | "donations">("all");

  const [queueEnabled, setQueueEnabled] = useState(false);
  const [hasActiveWidget, setHasActiveWidget] = useState(false);
  const [widgetOnline, setWidgetOnline] = useState(false);
  const [widgetLastSeenAt, setWidgetLastSeenAt] = useState<string | null>(null);
  const [readingQueue, setReadingQueue] = useState(false);
  const [activeDonationId, setActiveDonationId] = useState<string | null>(null);
  const [activeProgress, setActiveProgress] = useState(0);

  const [statusMap, setStatusMap] = useState<DonationStatusMap>({});

  const donationsRef = useRef<DonationItem[]>([]);
  const statusMapRef = useRef<DonationStatusMap>({});
  const queueIdsRef = useRef<string[]>([]);
  const queueRunningRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function saveStatusMap(nextMap: DonationStatusMap) {
    setStatusMap(nextMap);
    statusMapRef.current = nextMap;
    try {
      localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(nextMap));
    } catch {}
  }

  function updateStatus(id: string, status: DonationStatus) {
    const nextMap = { ...statusMapRef.current, [id]: status };
    saveStatusMap(nextMap);
  }

  function getStatus(id: string): DonationStatus {
    return statusMapRef.current[id] ?? "pending";
  }

  function clearPlaybackInternals() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }

  const loadWidgetActivity = useCallback(async () => {
    const response = await fetch("/api/widgets/presets", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) return;
    const presets = (data.data || []) as WidgetPreset[];
    setHasActiveWidget(presets.some((item) => item.isActive));
  }, []);

  const loadWidgetHeartbeat = useCallback(async () => {
    const response = await fetch("/api/widgets/heartbeat?slug=alerts-feed", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) return;
    const hb = data.data as WidgetHeartbeat;
    setWidgetOnline(Boolean(hb?.online));
    setWidgetLastSeenAt(hb?.lastSeenAt || null);
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch("/api/donations", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      setChecks(data.data.checks);
      setDonations(data.data.donations);
      setTops(data.data.tops || EMPTY_TOPS);
    }
  }, []);

  useEffect(() => {
    try {
      const rawMap = localStorage.getItem(STORAGE_STATUS_KEY);
      if (rawMap) {
        const parsed = JSON.parse(rawMap) as DonationStatusMap;
        if (parsed && typeof parsed === "object") {
          setStatusMap(parsed);
          statusMapRef.current = parsed;
        }
      }
    } catch {}

    try {
      const rawQueue = localStorage.getItem(STORAGE_QUEUE_ENABLED_KEY);
      if (rawQueue != null) setQueueEnabled(rawQueue === "1");
    } catch {}

    void Promise.all([reload(), loadWidgetActivity(), loadWidgetHeartbeat()]);
  }, [reload, loadWidgetActivity, loadWidgetHeartbeat]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadWidgetHeartbeat();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadWidgetHeartbeat]);

  useEffect(() => {
    donationsRef.current = donations;
    const nextMap = { ...statusMapRef.current };
    let changed = false;
    for (const row of donations) {
      if (!nextMap[row.id]) {
        nextMap[row.id] = "pending";
        changed = true;
      }
    }
    if (changed) saveStatusMap(nextMap);
  }, [donations]);

  useEffect(() => {
    if (!queueEnabled && readingQueue) {
      queueRunningRef.current = false;
      setReadingQueue(false);
      setActiveDonationId(null);
      setActiveProgress(0);
      clearPlaybackInternals();
    }
  }, [queueEnabled, readingQueue]);

  useEffect(() => {
    return () => {
      queueRunningRef.current = false;
      clearPlaybackInternals();
    };
  }, []);

  const visibleRows = useMemo(() => {
    let rows = [...donations];
    if (listTab === "tiktok_donations") rows = rows.filter((item) => detectTikTokDonation(item));
    if (listTab === "donations") rows = rows.filter((item) => !detectTikTokDonation(item));
    rows = rows.filter((item) => (statusMap[item.id] ?? "pending") !== "deleted");
    return [...rows].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [donations, listTab, statusMap]);

  const pendingRows = useMemo(() => {
    return [...visibleRows]
      .filter((item) => (statusMap[item.id] ?? "pending") === "pending")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [visibleRows, statusMap]);

  const totalDonations = useMemo(() => {
    return donations.reduce((sum, item) => {
      if (detectTikTokDonation(item)) return sum;
      return sum + item.amountUah;
    }, 0);
  }, [donations]);

  const topRows = tops[topPeriod] || [];
  const playbackAllowed = queueEnabled && hasActiveWidget && widgetOnline;

  function playNextFromQueue() {
    if (!queueRunningRef.current) return;

    const nextId = queueIdsRef.current.find((id) => getStatus(id) === "pending");
    if (!nextId) {
      queueRunningRef.current = false;
      setReadingQueue(false);
      setActiveDonationId(null);
      setActiveProgress(0);
      clearPlaybackInternals();
      return;
    }

    const row = donationsRef.current.find((item) => item.id === nextId);
    if (!row) {
      updateStatus(nextId, "played");
      playNextFromQueue();
      return;
    }

    updateStatus(nextId, "playing");
    setActiveDonationId(nextId);
    setActiveProgress(0);

    const text = `${row.donorName}. ${Math.round(row.amountUah)} гривень. ${row.message?.trim() || "Без повідомлення"}`;
    const playbackText = detectTikTokDonation(row)
      ? `${row.donorName}. TikTok-донат ${row.tiktokDonationName || row.message || "TikTok Donation"}. ${Number(row.tiktokCoins || 0)} монет.`
      : text;
    const durationMs = estimateSpeakDurationMs(playbackText);
    const startedAt = Date.now();

    clearPlaybackInternals();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.max(0, Math.min(98, Math.round((elapsed / durationMs) * 100)));
      setActiveProgress(pct);
    }, 120);

    const finish = () => {
      clearPlaybackInternals();
      setActiveProgress(100);
      if (getStatus(nextId) === "playing") {
        updateStatus(nextId, "played");
      }
      setActiveDonationId(null);
      setTimeout(() => {
        setActiveProgress(0);
        playNextFromQueue();
      }, 60);
    };

    playbackTimeoutRef.current = setTimeout(finish, durationMs);
  }

  function startQueue() {
    if (!queueEnabled) {
      setMessage("Програвання в dashboard можливе лише коли увімкнено чергу.");
      return;
    }
    if (!hasActiveWidget) {
      setMessage("Увімкніть хоча б один активний віджет у розділі «Донати · Ссылки виджетов».");
      return;
    }
    if (!widgetOnline) {
      setMessage("Віджет оффлайн. Відкрийте /widget/alerts-feed в OBS або браузері та повторіть запуск.");
      return;
    }
    if (pendingRows.length === 0) {
      setMessage("У черзі немає непрограних донатів.");
      return;
    }
    queueIdsRef.current = pendingRows.map((item) => item.id);
    queueRunningRef.current = true;
    setReadingQueue(true);
    playNextFromQueue();
  }

  function stopQueue() {
    queueRunningRef.current = false;
    setReadingQueue(false);
    if (activeDonationId && getStatus(activeDonationId) === "playing") {
      updateStatus(activeDonationId, "pending");
    }
    setActiveDonationId(null);
    setActiveProgress(0);
    clearPlaybackInternals();
  }

  function skipDonation(id: string) {
    updateStatus(id, "skipped");
    if (activeDonationId === id && readingQueue) {
      clearPlaybackInternals();
      setActiveDonationId(null);
      setActiveProgress(0);
      setTimeout(() => playNextFromQueue(), 50);
    }
  }

  async function deleteDonation(id: string) {
    const response = await fetch("/api/donations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося видалити донат.");
      return;
    }
    updateStatus(id, "deleted");
    if (activeDonationId === id) {
      clearPlaybackInternals();
      setActiveDonationId(null);
      setActiveProgress(0);
      if (readingQueue) setTimeout(() => playNextFromQueue(), 50);
    }
    await reload();
  }

  async function cancelCheck(id: string) {
    const response = await fetch(`/api/checks/${id}/cancel`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося скасувати чек.");
      return;
    }
    setMessage("Чек скасовано.");
    await reload();
  }

  async function verifyCheck(check: CheckItem, anonymous = false) {
    const response = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkId: check.id,
        channel: check.channel.toLowerCase(),
        paidAmount: check.channel === "UAH" ? check.amountUah : undefined,
        comment: anonymous ? "anonymous-no-code" : check.code,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося підтвердити оплату.");
      return;
    }
    setMessage(anonymous ? "Анонімний платіж зафіксовано." : "Оплату підтверджено.");
    await reload();
  }

  async function addManualDonation(event: FormEvent) {
    event.preventDefault();
    if (!manualName.trim()) {
      setMessage("Вкажіть ім'я донатера.");
      return;
    }
    setAddingManual(true);
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donorName: manualName.trim(),
        amountUah: manualAmount,
        message: manualMessage.trim(),
        channel: manualChannel,
      }),
    });
    const data = await res.json();
    setAddingManual(false);
    if (!res.ok || !data.ok) {
      setMessage(data.error || "Не вдалося додати донат.");
      return;
    }
    setMessage("Донат додано вручну.");
    setManualMessage("");
    await reload();
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_QUEUE_ENABLED_KEY, queueEnabled ? "1" : "0");
    } catch {}
  }, [queueEnabled]);

  useEffect(() => {
    if (!widgetOnline && readingQueue) {
      queueRunningRef.current = false;
      setReadingQueue(false);
      setActiveDonationId(null);
      setActiveProgress(0);
      clearPlaybackInternals();
      setMessage("Віджет оффлайн, чергу донатів зупинено. Відкрийте віджет і запустіть ще раз.");
    }
  }, [widgetOnline, readingQueue]);

  async function copyWidgetUrl() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/widget/alerts-feed`);
      setMessage("URL віджета скопійовано.");
    } catch {
      setMessage("Не вдалося скопіювати URL віджета.");
    }
  }

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Донати</h1>
            <p className="mt-1 text-sm text-amber-50/70">
              Непрограні донати підсвічені жовтим і йдуть у чергу.
            </p>
          </div>
          <div className="rounded-xl border border-amber-300/35 bg-amber-400/10 px-4 py-2 text-center">
            <p className="text-xl font-bold text-amber-200">{totalDonations.toFixed(2)} грн</p>
            <p className="text-xs text-amber-50/60">Сума донатів</p>
          </div>
        </div>
      </section>

      <section className="dashboard-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setQueueEnabled((prev) => !prev)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              queueEnabled ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-200" : "border-white/20 text-amber-100 hover:bg-white/10"
            }`}
          >
            Програвання по черзі: {queueEnabled ? "Увімкнено" : "Вимкнено"}
          </button>
          <button
            type="button"
            onClick={startQueue}
            disabled={readingQueue || pendingRows.length === 0 || !playbackAllowed}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-white/10 disabled:opacity-50"
          >
            Прочитати всі
          </button>
          <button
            type="button"
            onClick={stopQueue}
            disabled={!readingQueue}
            className="rounded-lg border border-yellow-400/70 px-3 py-1.5 text-xs text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
          >
            Зупинити донат
          </button>
          <button
            type="button"
            onClick={() => window.open("/widget/alerts-feed", "_blank", "noopener,noreferrer")}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-white/10"
          >
            Відкрити віджет
          </button>
          <button
            type="button"
            onClick={copyWidgetUrl}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-white/10"
          >
            Копіювати URL
          </button>
          <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-amber-50/70">
            Активний віджет: {hasActiveWidget ? "так" : "ні"}
          </span>
          <span
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              widgetOnline
                ? "border-emerald-300/50 bg-emerald-500/15 text-emerald-200"
                : "border-red-300/40 bg-red-500/10 text-red-200"
            }`}
          >
            Статус віджета: {widgetOnline ? "онлайн" : "оффлайн"}
          </span>
          {!widgetOnline && widgetLastSeenAt ? (
            <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-amber-50/70">
              Останній heartbeat: {new Date(widgetLastSeenAt).toLocaleTimeString("uk-UA")}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { id: "all" as const, label: "Усі разом" },
            { id: "tiktok_donations" as const, label: "TikTok-донати" },
            { id: "donations" as const, label: "Донати" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setListTab(tab.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                listTab === tab.id
                  ? "border-amber-300/60 bg-amber-400/20 text-amber-200"
                  : "border-white/15 text-amber-50/70 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-amber-50/55">
              <tr>
                <th className="px-3 py-2">Ім&apos;я</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Система</th>
                <th className="px-3 py-2 text-right">Сума</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-amber-50/50">
                    Немає записів для цього фільтра.
                  </td>
                </tr>
              ) : (
                visibleRows.map((item) => {
                  const status = getStatus(item.id);
                  const isTikTokDonation = detectTikTokDonation(item);
                  const isVip = item.isFake;
                  const isActive = activeDonationId === item.id;
                  const donationText = isTikTokDonation
                    ? item.tiktokDonationName || item.message || "Без повідомлення"
                    : item.message || "Без повідомлення";

                  const rowClass =
                    status === "pending"
                      ? "bg-yellow-500/10"
                      : status === "playing"
                        ? "bg-blue-500/15"
                        : status === "skipped"
                          ? "bg-zinc-500/10"
                          : "bg-black/10";

                  return (
                    <tr key={item.id} className={`border-t border-white/10 align-top ${rowClass}`}>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-amber-50">{item.donorName}</div>
                        <div className="mt-0.5 max-w-[360px] truncate text-xs text-amber-50/55">
                          {donationText}
                        </div>
                        {isActive && (
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-white/10">
                            <div
                              className="h-full bg-emerald-400 transition-all"
                              style={{ width: `${activeProgress}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] ${
                              isTikTokDonation ? "bg-blue-500/20 text-blue-200" : "bg-emerald-500/20 text-emerald-200"
                            }`}
                          >
                            {isTikTokDonation ? "TikTok-донат" : "Донат"}
                          </span>
                          {isVip ? (
                            <span className="rounded-md border border-fuchsia-300/40 bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-200">
                              VIP
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-amber-50/70">
                        {new Date(item.createdAt).toLocaleString("uk-UA")}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-amber-50/70">{channelLabel(item.channel)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-200">
                        {isTikTokDonation ? `${Number(item.tiktokCoins || 0)} coins` : null}
                        <span className={isTikTokDonation ? "hidden" : ""}>
                          {item.amountUah.toFixed(2)} грн
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-amber-50/80">
                        {status === "pending" && "Очікує"}
                        {status === "playing" && "Програється"}
                        {status === "played" && "Відтворено"}
                        {status === "skipped" && "Пропущено"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setMessage(donationText)}
                            className="rounded-md border border-white/20 px-2 py-1 text-xs text-amber-100 hover:bg-white/10"
                            title="Переглянути повідомлення"
                          >
                            Перегляд
                          </button>
                          <button
                            type="button"
                            onClick={() => skipDonation(item.id)}
                            className="rounded-md border border-yellow-300/50 px-2 py-1 text-xs text-yellow-200 hover:bg-yellow-500/15"
                            title="Пропустити"
                          >
                            Пропустити
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDonation(item.id)}
                            className="rounded-md border border-red-400/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/15"
                            title="Видалити"
                          >
                            Видалити
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <article className="dashboard-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Топ донатерів</h2>
            <div className="flex gap-1 rounded-lg border border-white/10 p-0.5">
              {[
                { id: "week" as TopPeriod, label: "Тиждень" },
                { id: "month" as TopPeriod, label: "Місяць" },
                { id: "all" as TopPeriod, label: "Весь час" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTopPeriod(item.id)}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${
                    topPeriod === item.id
                      ? "bg-amber-400/20 text-amber-200"
                      : "text-amber-50/60 hover:text-amber-50/80"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {topRows.length === 0 ? (
              <p className="text-sm text-amber-50/60">Поки що топ порожній.</p>
            ) : (
              topRows.map((row, index) => (
                <div key={row.donorName} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-2.5 text-sm">
                  <span>{index + 1}. {row.donorName}</span>
                  <span className="font-semibold text-amber-200">{row.totalUah.toFixed(0)} грн</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="dashboard-card p-5">
          <h2 className="text-base font-semibold">Активні чеки</h2>
          <div className="mt-3 max-h-[320px] space-y-2 overflow-auto pr-1">
            {checks.length === 0 ? (
              <p className="text-sm text-amber-50/60">Немає активних чеків.</p>
            ) : (
              checks.map((check) => (
                <div key={check.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{check.code}</span>
                    <span className="text-xs text-amber-50/60">
                      до {new Date(check.expiresAt).toLocaleTimeString("uk-UA")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-amber-50/80">
                    {check.donorName} | {check.amountLabel}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => verifyCheck(check, false)}
                      className="rounded-lg bg-emerald-500/20 px-2 py-1 text-emerald-200 hover:bg-emerald-500/30"
                    >
                      Перевірити
                    </button>
                    <button
                      type="button"
                      onClick={() => verifyCheck(check, true)}
                      className="rounded-lg bg-amber-500/20 px-2 py-1 text-amber-200 hover:bg-amber-500/30"
                    >
                      Анонімно
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelCheck(check.id)}
                      className="rounded-lg bg-red-500/20 px-2 py-1 text-red-200 hover:bg-red-500/30"
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section id="manual-donation-form" className="dashboard-card p-5">
        <h2 className="mb-3 text-base font-semibold">Додати донат вручну</h2>
        <form onSubmit={addManualDonation} className="grid gap-3 md:grid-cols-4">
          <input
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            className="input-dark"
            placeholder="Ім'я донатера"
          />
          <input
            type="number"
            min={1}
            value={manualAmount}
            onChange={(event) => setManualAmount(Number(event.target.value) || 0)}
            className="input-dark"
            placeholder="Сума, грн"
          />
          <input
            value={manualMessage}
            onChange={(event) => setManualMessage(event.target.value)}
            className="input-dark"
            placeholder="Повідомлення"
          />
          <div className="flex gap-2">
            <select
              value={manualChannel}
              onChange={(event) => setManualChannel(event.target.value)}
              className="input-dark w-28"
            >
              <option value="UAH">UAH</option>
              <option value="CRYPTOBOT">CryptoBOT</option>
              <option value="TONPAY">TonPay</option>
            </select>
            <button
              type="submit"
              disabled={addingManual}
              className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300 disabled:opacity-60"
            >
              {addingManual ? "..." : "Додати"}
            </button>
          </div>
        </form>
      </section>

      {message && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-white/15 bg-[#1a1412] px-4 py-3 text-sm shadow-xl">
          {message}
          <button
            type="button"
            onClick={() => setMessage("")}
            className="ml-3 text-xs text-amber-50/60 hover:text-amber-50"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

