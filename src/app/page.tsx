"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Channel = "uah" | "cryptobot" | "tonpay";
type Rates = { usdtToUah: number; tonToUah: number };

const CHANNELS: Array<{ id: Channel; label: string; hint: string; icon: string }> = [
  { id: "uah", label: "UAH", hint: "Monobank", icon: "🏦" },
  { id: "cryptobot", label: "CryptoBOT", hint: "USDT", icon: "🤖" },
  { id: "tonpay", label: "TON", hint: "TON wallet", icon: "💎" },
];

const QUICK_AMOUNTS_UAH = [25, 50, 100, 250, 500];

const MAX_VOICE_SECONDS = 30;

export default function HomePage() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("uah");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(50);
  const [message, setMessage] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [accepted, setAccepted] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<Rates | null>(null);

  const [recording, setRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef<number>(0);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitInFlightRef = useRef(false);

  // Restore last name and amount from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem("donatelko_name");
      const savedAmount = localStorage.getItem("donatelko_amount");
      if (savedName) setName(savedName);
      if (savedAmount) setAmount(Number(savedAmount) || 50);

      // If returning from expired check, restore full form
      const params = new URLSearchParams(window.location.search);
      if (params.get("restore") === "1") {
        const savedForm = localStorage.getItem("donatelko_form");
        if (savedForm) {
          const form = JSON.parse(savedForm);
          if (form.name) setName(form.name);
          if (form.amount) setAmount(Number(form.amount));
          if (form.message) setMessage(form.message);
          if (form.youtubeUrl) setYoutubeUrl(form.youtubeUrl);
          if (form.channel) setChannel(form.channel as Channel);
        }
        window.history.replaceState({}, "", "/");
      }
    } catch {}
  }, []);

  // Persist name and amount to localStorage on change
  useEffect(() => {
    try {
      if (name.trim()) localStorage.setItem("donatelko_name", name.trim());
      if (amount > 0) localStorage.setItem("donatelko_amount", String(amount));
    } catch {}
  }, [name, amount]);

  useEffect(() => {
    fetch("/api/rates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRates(d.data);
      })
      .catch(() => {});
  }, []);

  const amountLabel = useMemo(() => {
    if (channel === "uah") return "грн";
    if (channel === "cryptobot") return "USDT";
    return "TON";
  }, [channel]);

  const convertedHint = useMemo(() => {
    if (!rates || channel === "uah") return null;
    if (channel === "cryptobot") {
      const uah = (amount * rates.usdtToUah).toFixed(2);
      return `${amount} USDT ≈ ${uah} грн`;
    }
    const uah = (amount * rates.tonToUah).toFixed(2);
    return `${amount} TON ≈ ${uah} грн`;
  }, [amount, channel, rates]);

  const switchChannel = useCallback(
    (newChannel: Channel) => {
      if (!rates) {
        setChannel(newChannel);
        return;
      }
      let uahValue: number;
      if (channel === "uah") uahValue = amount;
      else if (channel === "cryptobot") uahValue = amount * rates.usdtToUah;
      else uahValue = amount * rates.tonToUah;

      let newAmount: number;
      if (newChannel === "uah") newAmount = Math.round(uahValue);
      else if (newChannel === "cryptobot")
        newAmount = Math.round((uahValue / rates.usdtToUah) * 100) / 100;
      else newAmount = Math.round((uahValue / rates.tonToUah) * 1000) / 1000;

      setChannel(newChannel);
      setAmount(newAmount > 0 ? newAmount : 1);
    },
    [amount, channel, rates]
  );

  async function startRecord() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.onstop = () => {
        setVoiceSeconds(Math.max(1, Math.min(MAX_VOICE_SECONDS, Math.round((Date.now() - startedAtRef.current) / 1000))));
        stream.getTracks().forEach((track) => track.stop());
        if (voiceTimerRef.current) {
          clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
        }
      };
      recorder.start();
      setRecording(true);

      // Auto-stop at MAX_VOICE_SECONDS
      voiceTimerRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        if (elapsed >= MAX_VOICE_SECONDS) {
          recorder.stop();
          setRecording(false);
        }
      }, 500);
    } catch {
      setError("Немає доступу до мікрофона.");
    }
  }

  function stopRecord() {
    if (!recorderRef.current || !recording) return;
    recorderRef.current.stop();
    setRecording(false);
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitInFlightRef.current || loading) return;
    setError("");

    if (!name.trim()) {
      setError("Вкажіть ім'я.");
      return;
    }
    if (!accepted) {
      setError("Підтвердіть правила донатів.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Вкажіть коректну суму.");
      return;
    }

    submitInFlightRef.current = true;
    setLoading(true);
    const response = await fetch("/api/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donorName: name.trim(),
        message: message.trim(),
        youtubeUrl: youtubeUrl.trim() || undefined,
        voiceUrl: voiceSeconds > 0 ? `voice:${voiceSeconds}s` : undefined,
        amount,
        channel,
      }),
    });
    const data = await response.json();
    setLoading(false);
    submitInFlightRef.current = false;

    if (!response.ok || !data.ok) {
      setError(data.error || "Не вдалося створити чек.");
      return;
    }
    // Save form state to localStorage for restoration if check expires
    try {
      localStorage.setItem("donatelko_form", JSON.stringify({
        name: name.trim(),
        amount,
        message: message.trim(),
        youtubeUrl: youtubeUrl.trim(),
        channel,
      }));
    } catch {}

    router.push(`/check/${data.data.id}`);
  }

  return (
    <main className="coffee-bg min-h-screen text-[#f4ede0]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-3 py-4 sm:px-6">
        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl border border-white/12 bg-black/40 px-5 py-3 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/coffee_icon.png" alt="logo" className="h-7 w-7" width={28} height={28} />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">Donatelko</span>
          </Link>
          <Link
            href="/dashboard/login"
            className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-amber-50/80 transition hover:bg-white/10"
          >
            Dashboard
          </Link>
        </header>

        {/* Main Content */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Donation Form */}
          <section className="dashboard-card p-6">
            <h1 className="text-2xl font-bold">Підтримати стрім</h1>
            <p className="mt-1 text-sm text-amber-50/65">
              Обери спосіб оплати, введи суму та повідомлення.
            </p>

            {/* Payment Method Selection */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {CHANNELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchChannel(item.id)}
                  className={`rounded-xl border px-3 py-3 text-center transition ${
                    channel === item.id
                      ? "border-amber-300/60 bg-amber-100/10 shadow-[0_0_16px_rgba(233,179,90,0.1)]"
                      : "border-white/10 bg-black/25 hover:border-white/25"
                  }`}
                >
                  <p className="text-lg">{item.icon}</p>
                  <p className="mt-1 text-sm font-semibold">{item.label}</p>
                  <p className="text-[10px] text-amber-50/55">{item.hint}</p>
                </button>
              ))}
            </div>

            {/* Currency Converter Hint */}
            {convertedHint && (
              <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/8 px-3 py-2 text-center text-sm text-amber-200">
                {convertedHint}
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-amber-50/65">Ім&apos;я</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-dark"
                  placeholder="Ваше ім'я"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-amber-50/65">Сума</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="input-dark"
                  />
                  <div className="inline-flex min-w-[72px] items-center justify-center rounded-xl border border-white/12 bg-black/25 px-3 text-sm font-medium">
                    {amountLabel}
                  </div>
                </div>
              </label>

              {/* Quick Amounts */}
              {channel === "uah" && (
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS_UAH.map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setAmount(quick)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        amount === quick
                          ? "border-amber-300/50 bg-amber-400/15 text-amber-100"
                          : "border-white/15 bg-black/20 hover:bg-white/10"
                      }`}
                    >
                      {quick} грн
                    </button>
                  ))}
                </div>
              )}

              <label className="block text-sm">
                <span className="mb-1 block text-amber-50/65">Повідомлення</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="h-24 w-full rounded-xl border border-white/12 bg-black/25 p-3 text-sm outline-none focus:border-amber-300/60"
                  maxLength={500}
                  placeholder="Ваше повідомлення для стрімера..."
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-amber-50/65">YouTube посилання (опц.)</span>
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="input-dark"
                  placeholder="https://youtube.com/..."
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-amber-50/70">Запис голосу <span className="text-amber-50/40">(макс. {MAX_VOICE_SECONDS} сек.)</span></p>
                <div className="mt-2 flex items-center gap-2">
                  {!recording ? (
                    <button
                      type="button"
                      onClick={startRecord}
                      className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/10"
                    >
                      🎤 Почати
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecord}
                      className="rounded-lg border border-red-300/40 px-3 py-1.5 text-xs text-red-100 hover:bg-red-300/10 animate-pulse"
                    >
                      ⏹ Зупинити
                    </button>
                  )}
                  {voiceSeconds > 0 ? (
                    <span className="text-xs text-amber-50/70">🎤 Запис: {voiceSeconds} сек.</span>
                  ) : recording ? (
                    <span className="text-xs text-red-300">Запис...</span>
                  ) : (
                    <span className="text-xs text-amber-50/50">Можна додати до чека</span>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-amber-50/65">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                Я приймаю правила і розумію, що чек дійсний 10 хвилин.
              </label>

              {error && <p className="text-sm text-red-300">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 text-base font-bold text-[#2d1d13] shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-60"
              >
                {loading ? "Створення чека..." : "Надіслати донат"}
              </button>
            </form>
          </section>

          {/* Info Panel */}
          <section className="space-y-4">
            <article className="dashboard-card p-5">
              <h2 className="text-lg font-semibold">Як це працює</h2>
              <ol className="mt-3 space-y-3">
                {[
                  { step: "1", text: "Заповнюєш форму та обираєш спосіб оплати." },
                  { step: "2", text: "Отримуєш чек з таймером на 10 хвилин." },
                  { step: "3", text: "Оплачуєш за вказаними реквізитами." },
                  { step: "4", text: "Донат з'являється на стрімі автоматично." },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-xs font-bold text-amber-200">
                      {item.step}
                    </span>
                    <span className="text-sm text-amber-50/75">{item.text}</span>
                  </li>
                ))}
              </ol>
            </article>

            <article className="dashboard-card p-5">
              <h2 className="text-lg font-semibold">Способи оплати</h2>
              <div className="mt-3 space-y-2 text-sm text-amber-50/70">
                <p>
                  <span className="font-medium text-amber-50/90">🏦 UAH</span> &mdash; переказ на банку Monobank
                </p>
                <p>
                  <span className="font-medium text-amber-50/90">🤖 CryptoBOT</span> &mdash; оплата USDT через Telegram
                </p>
                <p>
                  <span className="font-medium text-amber-50/90">💎 TON</span> &mdash; прямий переказ TON на гаманець
                </p>
              </div>
            </article>

            {rates && (
              <article className="dashboard-card p-4">
                <p className="text-xs text-amber-50/50 uppercase tracking-wider">Актуальний курс</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
                    <p className="font-semibold text-amber-200">{rates.usdtToUah.toFixed(2)}</p>
                    <p className="text-[10px] text-amber-50/50">USDT/UAH</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
                    <p className="font-semibold text-amber-200">{rates.tonToUah.toFixed(2)}</p>
                    <p className="text-[10px] text-amber-50/50">TON/UAH</p>
                  </div>
                </div>
              </article>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
