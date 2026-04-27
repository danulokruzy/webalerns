"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type FakeItem = {
  id: string;
  donorName: string;
  amountUah: number;
  message: string;
  createdAt: string;
};

type FakeConfig = {
  id: string;
  enabled: boolean;
  name1: string;
  name2: string;
  minPauseSec: number;
  maxPauseSec: number;
  minAmountUah: number;
  maxAmountUah: number;
  messages: string;
};

export default function FakeDonationsPage() {
  const [fakes, setFakes] = useState<FakeItem[]>([]);
  const [topFake, setTopFake] = useState<Array<{ donorName: string; totalUah: number }>>([]);
  const [config, setConfig] = useState<FakeConfig | null>(null);
  const [message, setMessage] = useState("");

  const [fakeName, setFakeName] = useState("");
  const [fakeAmount, setFakeAmount] = useState(50);
  const [fakeMessage, setFakeMessage] = useState("");

  const [autoRunning, setAutoRunning] = useState(false);
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [nextIn, setNextIn] = useState(0);
  const battleSequenceRef = useRef({
    currentIndex: 0,
    remainingForCurrent: 1,
  });

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    const [fakeRes, configRes] = await Promise.all([
      fetch("/api/fake-donations", { cache: "no-store" }),
      fetch("/api/fake-donations/config", { cache: "no-store" }),
    ]);
    const [fakeJson, configJson] = await Promise.all([fakeRes.json(), configRes.json()]);

    if (fakeJson.ok) {
      setFakes(fakeJson.data.items || []);
      setTopFake(fakeJson.data.top3 || []);
    }
    if (configJson.ok && configJson.data) {
      setConfig(configJson.data);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setMessage("");
    const res = await fetch("/api/fake-donations/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMessage(data.error || "Помилка збереження.");
      return;
    }
    setMessage("Конфігурацію збережено.");
    if (data.data) setConfig(data.data);
  }

  async function addFake(e: FormEvent) {
    e.preventDefault();
    const name = fakeName.trim() || config?.name1 || "Анонім";
    const res = await fetch("/api/fake-donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donorName: name,
        amountUah: fakeAmount,
        message: fakeMessage.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMessage(data.error || "Помилка.");
      return;
    }
    setFakeMessage("");
    await reload();
  }

  async function deleteFake(id: string) {
    await fetch(`/api/fake-donations/${id}`, { method: "DELETE" });
    await reload();
  }

  async function clearAll() {
    const res = await fetch("/api/fake-donations/clear", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.ok) {
      setMessage("Всі фейк-донати видалено.");
      await reload();
    }
  }

  function generateAutoFake() {
    if (!config) return;

    let msgs: string[] = [];
    try {
      const parsed = JSON.parse(config.messages);
      if (Array.isArray(parsed)) {
        msgs = parsed
          .map((item) => String(item ?? "").trim())
          .filter((item) => item.length > 0);
      }
    } catch {
      msgs = [];
    }

    const names = [config.name1.trim(), config.name2.trim()].filter((item) => item.length > 0);
    const selectedNames = names.length > 0 ? names : ["Анонім", "Гість"];
    const seq = battleSequenceRef.current;
    const donorName = selectedNames[seq.currentIndex % selectedNames.length] || selectedNames[0];

    seq.remainingForCurrent -= 1;
    if (seq.remainingForCurrent <= 0) {
      if (selectedNames.length > 1) {
        seq.currentIndex = (seq.currentIndex + 1) % selectedNames.length;
      }
      seq.remainingForCurrent = 1 + Math.floor(Math.random() * 2);
    }

    const amount = Math.floor(
      config.minAmountUah + Math.random() * (config.maxAmountUah - config.minAmountUah)
    );
    const msg = msgs.length > 0 ? msgs[Math.floor(Math.random() * msgs.length)] : "";

    return { donorName, amountUah: amount, message: msg };
  }

  function startAutoGeneration() {
    if (!config) return;
    setAutoRunning(true);
    battleSequenceRef.current = {
      currentIndex: 0,
      remainingForCurrent: 1 + Math.floor(Math.random() * 2),
    };

    function scheduleNext() {
      if (!config) return;
      const pauseSec =
        config.minPauseSec +
        Math.random() * (config.maxPauseSec - config.minPauseSec);
      const pauseMs = Math.round(pauseSec * 1000);

      setNextIn(Math.round(pauseSec));

      const countdown = setInterval(() => {
        setNextIn((prev) => Math.max(0, prev - 1));
      }, 1000);

      const timer = setTimeout(async () => {
        clearInterval(countdown);
        const fakeData = generateAutoFake();
        if (fakeData) {
          await fetch("/api/fake-donations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fakeData),
          });
          await reload();
        }
        scheduleNext();
      }, pauseMs);

      setAutoTimer(timer);
    }

    scheduleNext();
  }

  function stopAutoGeneration() {
    setAutoRunning(false);
    if (autoTimer) {
      clearTimeout(autoTimer);
      setAutoTimer(null);
    }
    setNextIn(0);
  }

  const parsedMessages = useMemo(() => {
    if (!config) return [];
    try {
      return JSON.parse(config.messages) as string[];
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">Fake Donats</h1>
        <p className="mt-1 text-sm text-amber-50/70">
          Фейк-донати для стріму. Виглядають як справжні. Налаштуй імена, паузи та повідомлення.
        </p>
      </section>

      {/* Auto-Generation Controls */}
      <section className="dashboard-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Авто-генерація</h2>
          {autoRunning ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                Працює &middot; наступний через {nextIn}с
              </span>
              <button
                type="button"
                onClick={stopAutoGeneration}
                className="rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-200 hover:bg-red-500/30"
              >
                Зупинити
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startAutoGeneration}
              disabled={!config}
              className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              Запустити
            </button>
          )}
        </div>
      </section>

      {/* Configuration */}
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="dashboard-card p-5">
          <h2 className="mb-3 text-base font-semibold">Налаштування</h2>
          {!config ? (
            <p className="text-sm text-amber-50/60">Завантаження...</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/65">Ім&apos;я 1</span>
                  <input
                    value={config.name1}
                    onChange={(e) => setConfig({ ...config, name1: e.target.value })}
                    className="input-dark"
                    placeholder="Настя"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/65">Ім&apos;я 2</span>
                  <input
                    value={config.name2}
                    onChange={(e) => setConfig({ ...config, name2: e.target.value })}
                    className="input-dark"
                    placeholder="Влад"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/65">Мін. пауза (сек)</span>
                  <input
                    type="number"
                    min={1}
                    value={config.minPauseSec}
                    onChange={(e) => setConfig({ ...config, minPauseSec: Number(e.target.value) || 1 })}
                    className="input-dark"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/65">Макс. пауза (сек)</span>
                  <input
                    type="number"
                    min={1}
                    value={config.maxPauseSec}
                    onChange={(e) => setConfig({ ...config, maxPauseSec: Number(e.target.value) || 1 })}
                    className="input-dark"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/65">Мін. сума (грн)</span>
                  <input
                    type="number"
                    min={1}
                    value={config.minAmountUah}
                    onChange={(e) => setConfig({ ...config, minAmountUah: Number(e.target.value) || 1 })}
                    className="input-dark"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/65">Макс. сума (грн)</span>
                  <input
                    type="number"
                    min={1}
                    value={config.maxAmountUah}
                    onChange={(e) => setConfig({ ...config, maxAmountUah: Number(e.target.value) || 1 })}
                    className="input-dark"
                  />
                </label>
              </div>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">
                  Повідомлення (JSON масив)
                </span>
                <textarea
                  value={config.messages}
                  onChange={(e) => setConfig({ ...config, messages: e.target.value })}
                  className="h-20 w-full rounded-xl border border-white/15 bg-black/25 p-3 text-xs outline-none focus:border-amber-300/70"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {parsedMessages.map((msg, i) => (
                  <span key={i} className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
                    {msg}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={saveConfig}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300"
              >
                Зберегти конфіг
              </button>
            </div>
          )}
        </article>

        {/* Manual Add + Battle Top */}
        <article className="dashboard-card p-5">
          <h2 className="mb-3 text-base font-semibold">Додати фейк вручну</h2>
          <form onSubmit={addFake} className="space-y-2">
            <input
              value={fakeName}
              onChange={(e) => setFakeName(e.target.value)}
              className="input-dark"
              placeholder={`Ім'я (або ${config?.name1 ?? "Настя"} за замовч.)`}
            />
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={fakeAmount}
                onChange={(e) => setFakeAmount(Number(e.target.value) || 0)}
                className="input-dark"
                placeholder="Сума"
              />
              <button
                type="submit"
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300"
              >
                Додати
              </button>
            </div>
            <input
              value={fakeMessage}
              onChange={(e) => setFakeMessage(e.target.value)}
              className="input-dark"
              placeholder="Повідомлення"
            />
          </form>

          <div className="mt-4 border-t border-white/10 pt-4">
            <h3 className="mb-2 text-sm font-semibold">Топ батл</h3>
            {topFake.length === 0 ? (
              <p className="text-xs text-amber-50/50">Ще немає.</p>
            ) : (
              <div className="space-y-1.5">
                {topFake.map((row, i) => (
                  <div key={row.donorName} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-2 text-sm">
                    <span>
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-400/20 text-[10px] font-bold text-purple-200">
                        {i + 1}
                      </span>
                      {row.donorName}
                    </span>
                    <span className="font-semibold text-purple-200">{row.totalUah.toFixed(0)} грн</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20"
            >
              Видалити всі фейки
            </button>
          </div>
        </article>
      </section>

      {/* Fake Donations List */}
      <section className="dashboard-card p-5">
        <h2 className="mb-3 text-base font-semibold">Останні фейк-донати</h2>
        <div className="max-h-[400px] space-y-2 overflow-auto pr-1">
          {fakes.length === 0 ? (
            <p className="py-4 text-center text-sm text-amber-50/50">Порожньо.</p>
          ) : (
            fakes.slice(0, 50).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 p-3">
                <div>
                  <span className="font-semibold">{item.donorName}</span>
                  <span className="ml-2 font-semibold text-amber-200">{item.amountUah.toFixed(0)} грн</span>
                  <p className="mt-0.5 text-xs text-amber-50/50">{item.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteFake(item.id)}
                  className="rounded-lg bg-red-500/15 px-2 py-1 text-xs text-red-200 hover:bg-red-500/25"
                >
                  Видалити
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {message && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-white/15 bg-[#1a1412] px-4 py-3 text-sm shadow-xl">
          {message}
          <button type="button" onClick={() => setMessage("")} className="ml-3 text-xs text-amber-50/60 hover:text-amber-50">
            &times;
          </button>
        </div>
      )}
    </main>
  );
}
