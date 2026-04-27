"use client";

import { useEffect, useMemo, useState } from "react";

type SetupState = {
  connections: {
    id: string;
    tiktokUsername: string;
  } | null;
  parserEnabled: boolean;
  metrics: {
    tiktokDonationsCount: number;
    donationsCount: number;
  } | null;
};

type GiftItem = {
  id: string;
  giftId: string;
  name: string;
  coins: number;
  isActive: boolean;
  lastSeenAt: string;
  imageUrl?: string | null;
};

type GiftLog = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

type CatalogRow = {
  id?: string;
  tiktokDonationId?: string;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  giftId?: string;
  name?: string;
  coins?: number;
  isActive?: boolean;
  lastSeenAt?: string;
  imageUrl?: string | null;
};

function normalizeCatalogRow(row: CatalogRow, index: number): GiftItem {
  const giftId = String(row.giftId ?? row.tiktokDonationId ?? "").trim();
  const name = String(row.name ?? row.tiktokDonationName ?? "").trim();
  const coinsRaw = Number(row.coins ?? row.tiktokCoins ?? 0);
  const coins = Number.isFinite(coinsRaw) && coinsRaw > 0 ? coinsRaw : 1;

  return {
    id: String(row.id || giftId || `tiktok-donation-${index + 1}`),
    giftId: giftId || `unknown-${index + 1}`,
    name: name || giftId || "TikTok donation",
    coins,
    isActive: row.isActive !== false,
    lastSeenAt: row.lastSeenAt || new Date(0).toISOString(),
    imageUrl: row.imageUrl || null,
  };
}

export default function SetupPage() {
  const [state, setState] = useState<SetupState>({
    connections: null,
    parserEnabled: false,
    metrics: null,
  });
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [logs, setLogs] = useState<GiftLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [newGiftId, setNewGiftId] = useState("");
  const [newGiftName, setNewGiftName] = useState("");
  const [newGiftCoins, setNewGiftCoins] = useState(1);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    const [setupRes, giftsRes, logsRes] = await Promise.all([
      fetch("/api/setup", { cache: "no-store" }),
      fetch("/api/tiktok/donations/catalog?includeInactive=1", { cache: "no-store" }),
      fetch("/api/logs?type=TIKTOK_DONATION&take=150", { cache: "no-store" }),
    ]);

    const [setupJson, giftsJson, logsJson] = await Promise.all([
      setupRes.json(),
      giftsRes.json(),
      logsRes.json(),
    ]);

    if (setupJson.ok) {
      setState({
        connections: setupJson.data.connections
          ? {
              id: setupJson.data.connections.id,
              tiktokUsername: setupJson.data.connections.tiktokUsername || "",
            }
          : null,
        parserEnabled: Boolean(setupJson.data.parserEnabled),
        metrics: {
          tiktokDonationsCount:
            setupJson.data.metrics?.tiktokDonationsCount ?? setupJson.data.metrics?.giftsCount ?? 0,
          donationsCount: setupJson.data.metrics?.donationsCount ?? 0,
        },
      });
    }

    if (giftsJson.ok) {
      const rows = Array.isArray(giftsJson.data) ? (giftsJson.data as CatalogRow[]) : [];
      setGifts(rows.map(normalizeCatalogRow));
    }
    if (logsJson.ok) setLogs(logsJson.data || []);
  }

  async function saveSetup() {
    if (!state.connections) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tiktokUsername: state.connections.tiktokUsername,
        parserEnabled: state.parserEnabled,
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося зберегти Setup.");
      return;
    }
    setMessage("Setup оновлено.");
    await loadAll();
  }

  async function addGift() {
    setMessage("");
    if (!newGiftId.trim() || !newGiftName.trim()) {
      setMessage("Вкажи donation id та назву.");
      return;
    }
    const response = await fetch("/api/tiktok/donations/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tiktokDonationId: newGiftId.trim(),
        tiktokDonationName: newGiftName.trim(),
        tiktokCoins: Number(newGiftCoins) || 1,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося додати TikTok-донат.");
      return;
    }
    setNewGiftId("");
    setNewGiftName("");
    setNewGiftCoins(1);
    setMessage("TikTok-донат додано.");
    await loadAll();
  }

  async function saveGiftRow(gift: GiftItem) {
    const response = await fetch("/api/tiktok/donations/catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tiktokDonationId: gift.giftId,
        tiktokDonationName: gift.name,
        tiktokCoins: gift.coins,
        isActive: gift.isActive,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || `Не вдалося оновити ${gift.name}.`);
      return;
    }
    setMessage(`Оновлено: ${gift.name}`);
    await loadAll();
  }

  async function disableGift(giftId: string) {
    const response = await fetch("/api/tiktok/donations/catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiktokDonationId: giftId }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося вимкнути TikTok-донат.");
      return;
    }
    setMessage("TikTok-донат вимкнено.");
    await loadAll();
  }

  const activeGifts = useMemo(() => gifts.filter((gift) => gift.isActive), [gifts]);

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">Setup / Parser</h1>
        <p className="mt-1 text-sm text-amber-50/75">
          Тільки TikTok parser донатів: username, каталог TikTok-донатів та логи зі стримів.
        </p>
        <p className="mt-2 text-xs text-amber-50/60">
          Тут керуються runtime-події TikTok: увімкни parser, вкажи username і запусти runtime через launcher.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <article className="dashboard-card p-5">
          <h2 className="text-lg font-semibold">TikTok parser</h2>
          {state.connections ? (
            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/75">TikTok username</span>
                <input
                  value={state.connections.tiktokUsername}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      connections: prev.connections
                        ? { ...prev.connections, tiktokUsername: event.target.value }
                        : prev.connections,
                    }))
                  }
                  className="input-dark"
                  placeholder="danulo.kruz"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={state.parserEnabled}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      parserEnabled: event.target.checked,
                    }))
                  }
                />
                Увімкнути parser TikTok-донатів
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveSetup}
                  disabled={saving}
                  className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {saving ? "Збереження..." : "Зберегти Setup"}
                </button>
                {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-50/70">Завантаження...</p>
          )}
        </article>

        <article className="dashboard-card p-5">
          <h2 className="text-lg font-semibold">Стан parser</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p>Parser: {state.parserEnabled ? "увімкнено" : "вимкнено"}</p>
            <p>TikTok-донатів у каталозі: {state.metrics?.tiktokDonationsCount ?? 0}</p>
            <p>Подій донатів: {state.metrics?.donationsCount ?? 0}</p>
            <p>Останніх donation-логів: {logs.length}</p>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-amber-50/75">
            Runtime логи: launcher mode `tiktok-runtime` або `dev-stack`.
          </div>
        </article>
      </section>

      <section className="dashboard-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Каталог TikTok-донатів</h2>
          <span className="text-xs text-amber-50/65">
            Активні: {activeGifts.length} / Всього: {gifts.length}
          </span>
        </div>

        <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_1fr_130px_130px]">
          <input
            value={newGiftId}
            onChange={(e) => setNewGiftId(e.target.value)}
            className="input-dark"
            placeholder="donation id"
          />
          <input
            value={newGiftName}
            onChange={(e) => setNewGiftName(e.target.value)}
            className="input-dark"
            placeholder="назва доната"
          />
          <input
            type="number"
            min={1}
            value={newGiftCoins}
            onChange={(e) => setNewGiftCoins(Number(e.target.value) || 1)}
            className="input-dark"
            placeholder="coins"
          />
          <button
            type="button"
            onClick={addGift}
            className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#2b1d13] hover:bg-amber-300"
          >
            Додати
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {gifts.length === 0 ? (
            <p className="text-sm text-amber-50/60">Каталог поки порожній.</p>
          ) : (
            gifts.map((gift) => (
              <div
                key={gift.id}
                className={`grid gap-2 rounded-xl border p-3 md:grid-cols-[64px_1fr_1fr_140px_100px_100px] ${
                  gift.isActive ? "border-white/10 bg-black/25" : "border-white/5 bg-black/10 opacity-70"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/35">
                  {gift.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gift.imageUrl} alt={gift.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-amber-50/50">no img</span>
                  )}
                </div>
                <input value={gift.giftId} readOnly className="input-dark opacity-70" title="donation id" />
                <input
                  value={gift.name}
                  onChange={(e) =>
                    setGifts((prev) =>
                      prev.map((row) => (row.id === gift.id ? { ...row, name: e.target.value } : row))
                    )
                  }
                  className="input-dark"
                />
                <input
                  type="number"
                  min={1}
                  value={gift.coins}
                  onChange={(e) =>
                    setGifts((prev) =>
                      prev.map((row) =>
                        row.id === gift.id ? { ...row, coins: Number(e.target.value) || 1 } : row
                      )
                    )
                  }
                  className="input-dark"
                />
                <button
                  type="button"
                  onClick={() => saveGiftRow(gift)}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
                >
                  Зберегти
                </button>
                <button
                  type="button"
                  onClick={() => disableGift(gift.giftId)}
                  className="rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-200 hover:bg-red-500/15"
                >
                  Вимкнути
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="dashboard-card p-5">
        <h2 className="text-lg font-semibold">Логи TikTok-донатів зі стримів</h2>
        <div className="mt-3 max-h-[320px] space-y-2 overflow-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-sm text-amber-50/60">Поки що немає записів.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="text-sm text-amber-50">{log.message}</p>
                <p className="mt-1 text-xs text-amber-50/60">
                  {new Date(log.createdAt).toLocaleString("uk-UA")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}


