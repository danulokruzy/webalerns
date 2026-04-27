"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type CheckData = {
  id: string;
  code: string;
  channel: "UAH" | "CRYPTOBOT" | "TONPAY";
  donorName: string;
  message: string;
  youtubeUrl: string | null;
  voiceUrl: string | null;
  amountOriginal: number;
  amountLabel: string;
  amountUah: number;
  payUrl: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  expiresAt: string;
};

function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function channelLabel(channel: CheckData["channel"]) {
  if (channel === "UAH") return "🏦 UAH (Monobank)";
  if (channel === "CRYPTOBOT") return "🤖 CryptoBOT (USDT)";
  return "💎 TON";
}

type VerifyResponse = {
  ok: boolean;
  status: "paid" | "pending" | "anonymous" | "already_processed" | "not_found";
};

export default function CheckPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [check, setCheck] = useState<CheckData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [infoMessage, setInfoMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const loadCheck = useCallback(async () => {
    const response = await fetch(`/api/checks/${params.id}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setIsError(true);
      setInfoMessage(data.error || "Чек не знайдено.");
      return;
    }
    setCheck(data.data);
  }, [params.id]);

  useEffect(() => {
    void loadCheck();
  }, [loadCheck]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    if (!check) return "00:00";
    return formatRemaining(new Date(check.expiresAt).getTime() - now);
  }, [check, now]);

  const remainingMs = useMemo(() => {
    if (!check) return 0;
    return Math.max(0, new Date(check.expiresAt).getTime() - now);
  }, [check, now]);

  const isExpired = remainingMs <= 0 && check?.status === "PENDING";
  const showButtons = check?.status === "PENDING" && !isExpired;
  const isPaid = check?.status === "PAID";

  useEffect(() => {
    if (isExpired) {
      setInfoMessage("Час вийшов. Повертаємось назад...");
      const t = setTimeout(() => router.push("/?restore=1"), 3000);
      return () => clearTimeout(t);
    }
  }, [isExpired, router]);

  useEffect(() => {
    if (isPaid) {
      setInfoMessage("Оплату підтверджено! Дякуємо за донат.");
      // Clear form data except name on successful payment
      try {
        localStorage.removeItem("donatelko_form");
        localStorage.removeItem("donatelko_amount");
      } catch {}
    }
  }, [isPaid]);

  async function verifyCheck(options?: { allowAnonymousOnFail?: boolean }) {
    if (!check) return;
    setProcessing(true);
    setIsError(false);
    setInfoMessage("");

    const response = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkId: check.id,
        channel: check.channel.toLowerCase(),
        allowAnonymousOnFail: Boolean(options?.allowAnonymousOnFail),
        verifyOnly: !options?.allowAnonymousOnFail,
      }),
    });

    const data = await response.json();
    setProcessing(false);

    if (!response.ok || !data.ok) {
      setIsError(true);
      setInfoMessage(data.error || "Не вдалося перевірити оплату.");
      return;
    }

    const result = data.data as VerifyResponse;
    if (result.status === "paid" || result.status === "already_processed") {
      setIsError(false);
      setInfoMessage("Оплату підтверджено!");
    } else if (result.status === "anonymous") {
      setIsError(false);
      setInfoMessage("Донат зараховано як анонімний.");
    } else {
      setIsError(false);
      setInfoMessage("Оплату ще не знайдено. Спробуйте пізніше.");
    }

    await loadCheck();
  }

  async function cancelCheckAndBack() {
    if (!check) return;
    if (check.status !== "PENDING") {
      router.push("/");
      return;
    }

    setProcessing(true);
    const response = await fetch(`/api/checks/${check.id}/cancel`, { method: "POST" });
    const data = await response.json();
    setProcessing(false);

    if (!response.ok || !data.ok) {
      setIsError(true);
      setInfoMessage(data.error || "Не вдалося скасувати чек.");
      return;
    }

    router.push("/");
  }

  const timerColor = remainingMs > 120000 ? "text-amber-200" : remainingMs > 30000 ? "text-orange-300" : "text-red-400";

  return (
    <main className="coffee-bg min-h-screen px-3 py-4 text-[#f4ede0] sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Timer Header */}
        <div className="dashboard-card overflow-hidden p-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-50/60">Час на оплату</p>
          <p className={`mt-2 text-6xl font-bold tabular-nums ${timerColor}`}>{remaining}</p>
          {check && (
            <p className="mt-2 text-sm text-amber-50/60">
              {channelLabel(check.channel)} &middot; {check.amountLabel}
              {check.channel !== "UAH" && (
                <span className="ml-1 text-amber-50/40">(≈ {check.amountUah.toFixed(2)} грн)</span>
              )}
            </p>
          )}
        </div>

        {/* Check Details */}
        <section className="dashboard-card mt-4 p-5">
          {!check ? (
            <div>
              <p className="text-sm text-amber-50/70">{infoMessage || "Завантаження..."}</p>
              {isError && (
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-amber-300/40 bg-amber-400/15 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/25"
                >
                  ← Назад
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-50/50">Ім&apos;я</p>
                  <p className="mt-1 font-medium">{check.donorName}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-50/50">Сума</p>
                  <p className="mt-1 font-medium">{check.amountLabel}</p>
                </div>
              </div>

              {check.message && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-50/50">Повідомлення</p>
                  <p className="mt-1 text-sm">{check.message}</p>
                </div>
              )}

              {check.youtubeUrl && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-50/50">YouTube</p>
                  <a
                    href={check.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-sm text-amber-300 underline hover:text-amber-200"
                  >
                    {check.youtubeUrl}
                  </a>
                </div>
              )}

              {check.voiceUrl && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-50/50">Голосове повідомлення</p>
                  <p className="mt-1 text-sm text-amber-200">
                    🎤 {check.voiceUrl.replace("voice:", "").replace("s", " сек.")}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <a
                  href={showButtons ? check.payUrl : "#"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!showButtons) e.preventDefault();
                  }}
                  className={`flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition ${
                    showButtons
                      ? "bg-gradient-to-r from-amber-400 to-amber-500 text-[#2b1d13] shadow-lg shadow-amber-500/20 hover:from-amber-300 hover:to-amber-400"
                      : "border border-white/10 bg-black/20 text-amber-50/40"
                  }`}
                >
                  Оплатити
                </a>
                <button
                  type="button"
                  onClick={() => verifyCheck()}
                  disabled={processing || !showButtons}
                  className="flex h-12 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  Перевірити
                </button>
                <button
                  type="button"
                  onClick={cancelCheckAndBack}
                  disabled={processing}
                  className="flex h-12 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 text-sm text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  Скасувати (назад)
                </button>
              </div>

              {showButtons && (
                <button
                  type="button"
                  onClick={cancelCheckAndBack}
                  disabled={processing}
                  className="mt-2 w-full rounded-xl border border-amber-300/30 bg-amber-400/10 py-2.5 text-sm text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50"
                >
                  Закрити чек
                </button>
              )}

              {/* Code Instructions for UAH */}
              {check.channel === "UAH" && showButtons && (
                <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/8 p-4">
                  <p className="text-sm font-semibold text-amber-200">Важливо!</p>
                  <p className="mt-1 text-sm text-amber-50/70">
                    При оплаті через Monobank обов&apos;язково вкажіть код чека у коментарі до переказу:
                  </p>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-300/30 bg-black/30 px-4 py-3">
                    <span className="font-mono text-lg font-bold text-amber-200">{check.code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(check.code);
                        setInfoMessage("Код скопійовано!");
                        setIsError(false);
                      }}
                      className="ml-auto rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                    >
                      Копіювати
                    </button>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    check.status === "PAID" ? "bg-emerald-400" : check.status === "PENDING" ? "bg-amber-400 animate-pulse" : "bg-red-400"
                  }`}
                />
                <span className="text-sm text-amber-50/70">Статус: {check.status}</span>
              </div>

              {infoMessage && (
                <p className={`mt-3 rounded-xl p-3 text-sm ${isError ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                  {infoMessage}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
