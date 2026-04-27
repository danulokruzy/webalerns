"use client";

import { useEffect, useState } from "react";

type ConnectionsData = {
  id: string;
  twitchUsername: string;
  minecraftHost: string;
  minecraftPort: number;
  rconPassword: string;
  cryptobotToken: string;
  monobankToken: string;
  monobankJarId: string;
  monobankJarUrl: string;
  monobankCardNumber: string;
  bridgeEnabled: boolean;
};

type PaymentData = {
  id: string;
  paymentMemoPrefix: string;
  confirmationMode: string;
};

type Metrics = {
  actionsCount: number;
  giftsCount: number;
  checksCount: number;
  donationsCount: number;
  bridgeCount: number;
};

export default function SettingsPage() {
  const [connections, setConnections] = useState<ConnectionsData | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [bridgeToken, setBridgeToken] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    const [setupRes, connRes, settingsRes, bridgeRes] = await Promise.all([
      fetch("/api/setup", { cache: "no-store" }),
      fetch("/api/connections", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" }),
      fetch("/api/bridge/clients", { cache: "no-store" }),
    ]);
    const [setupJson, connJson, settingsJson, bridgeJson] = await Promise.all([
      setupRes.json(),
      connRes.json(),
      settingsRes.json(),
      bridgeRes.json(),
    ]);

    if (connJson.ok) {
      setConnections({
        id: connJson.data.id,
        twitchUsername: connJson.data.twitchUsername || "",
        minecraftHost: connJson.data.minecraftHost || "",
        minecraftPort: Number(connJson.data.minecraftPort || 0),
        rconPassword: connJson.data.rconPassword || "",
        cryptobotToken: connJson.data.cryptobotToken || "",
        monobankToken: connJson.data.monobankToken || "",
        monobankJarId: connJson.data.monobankJarId || "",
        monobankJarUrl: connJson.data.monobankJarUrl || "",
        monobankCardNumber: connJson.data.monobankCardNumber || "",
        bridgeEnabled: Boolean(connJson.data.bridgeEnabled),
      });
    }

    if (settingsJson.ok) {
      setPayment({
        id: settingsJson.data.id,
        paymentMemoPrefix: settingsJson.data.paymentMemoPrefix || "DON",
        confirmationMode: settingsJson.data.confirmationMode || "semi_auto",
      });
    }

    if (setupJson.ok) setMetrics(setupJson.data.metrics);
    if (bridgeJson.ok) setBridgeToken(bridgeJson.data.seededToken ?? null);
  }

  async function saveAll() {
    if (!connections || !payment) return;
    setSaving(true);
    setMessage("");

    const [connectionsRes, paymentRes] = await Promise.all([
      fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twitchUsername: connections.twitchUsername,
          minecraftHost: connections.minecraftHost,
          minecraftPort: connections.minecraftPort,
          rconPassword: connections.rconPassword,
          cryptobotToken: connections.cryptobotToken,
          monobankToken: connections.monobankToken,
          monobankJarId: connections.monobankJarId,
          monobankJarUrl: connections.monobankJarUrl,
          monobankCardNumber: connections.monobankCardNumber,
          bridgeEnabled: connections.bridgeEnabled,
        }),
      }),
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMemoPrefix: payment.paymentMemoPrefix,
          confirmationMode: payment.confirmationMode,
          adminPassword: adminPassword.trim() || undefined,
        }),
      }),
    ]);

    const [connJson, paymentJson] = await Promise.all([connectionsRes.json(), paymentRes.json()]);
    setSaving(false);

    if (!connectionsRes.ok || !connJson.ok || !paymentRes.ok || !paymentJson.ok) {
      setMessage(connJson.error || paymentJson.error || "Не вдалося зберегти глобальні налаштування.");
      return;
    }

    setMessage("Глобальні налаштування оновлено.");
    setAdminPassword("");
    await loadAll();
  }

  const loading = !connections || !payment;

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">Налаштування · Глобальні</h1>
        <p className="mt-1 text-sm text-amber-50/70">
          Лише системні параметри. Платежі та TikTok-вузли винесені в окремі розділи без дублювання.
        </p>
      </section>

      {loading ? (
        <section className="dashboard-card p-5">
          <p className="text-sm text-amber-50/70">Завантаження...</p>
        </section>
      ) : (
        <>
          <section className="dashboard-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Платіжні інтеграції</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <p className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200/80">Monobank</p>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-amber-50/65">Monobank API токен (X-Token)</span>
                <input
                  type="password"
                  value={connections.monobankToken}
                  onChange={(e) => setConnections({ ...connections, monobankToken: e.target.value })}
                  className="input-dark"
                  placeholder="Токен з api.monobank.ua"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">ID рахунку / банки (опціонально)</span>
                <input
                  value={connections.monobankJarId}
                  onChange={(e) => setConnections({ ...connections, monobankJarId: e.target.value })}
                  className="input-dark"
                  placeholder="ID рахунку з webhook"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">URL банки (send.monobank.ua)</span>
                <input
                  value={connections.monobankJarUrl}
                  onChange={(e) => setConnections({ ...connections, monobankJarUrl: e.target.value })}
                  className="input-dark"
                  placeholder="https://send.monobank.ua/jar/..."
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-amber-50/65">Номер карти (показується на сторінці чеку)</span>
                <input
                  value={connections.monobankCardNumber}
                  onChange={(e) => setConnections({ ...connections, monobankCardNumber: e.target.value })}
                  className="input-dark"
                  placeholder="4874 1000 2550 7644"
                />
              </label>

              <p className="md:col-span-2 mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200/80">CryptoBot / Crypto Pay</p>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-amber-50/65">CryptoBot API токен</span>
                <input
                  type="password"
                  value={connections.cryptobotToken}
                  onChange={(e) => setConnections({ ...connections, cryptobotToken: e.target.value })}
                  className="input-dark"
                  placeholder="Токен з @CryptoBot"
                />
              </label>
            </div>
          </section>

          <section className="dashboard-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Інтеграції ядра</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">Twitch username</span>
                <input
                  value={connections.twitchUsername}
                  onChange={(e) => setConnections({ ...connections, twitchUsername: e.target.value })}
                  className="input-dark"
                  placeholder="your_stream"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">Minecraft host</span>
                <input
                  value={connections.minecraftHost}
                  onChange={(e) => setConnections({ ...connections, minecraftHost: e.target.value })}
                  className="input-dark"
                  placeholder="127.0.0.1"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">RCON порт</span>
                <input
                  type="number"
                  value={connections.minecraftPort}
                  onChange={(e) => setConnections({ ...connections, minecraftPort: Number(e.target.value) || 0 })}
                  className="input-dark"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">RCON пароль</span>
                <input
                  type="password"
                  value={connections.rconPassword}
                  onChange={(e) => setConnections({ ...connections, rconPassword: e.target.value })}
                  className="input-dark"
                  placeholder="••••••••"
                />
              </label>
              <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={connections.bridgeEnabled}
                  onChange={(e) => setConnections({ ...connections, bridgeEnabled: e.target.checked })}
                />
                Увімкнути Bridge-клієнт для клавіш, медіа та RCON-дій
              </label>
            </div>
          </section>

          <section className="dashboard-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Системні правила</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">Префікс коду чека</span>
                <input
                  value={payment.paymentMemoPrefix}
                  onChange={(e) => setPayment({ ...payment, paymentMemoPrefix: e.target.value })}
                  className="input-dark"
                  placeholder="DON"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">Режим підтвердження</span>
                <select
                  value={payment.confirmationMode}
                  onChange={(e) => setPayment({ ...payment, confirmationMode: e.target.value })}
                  className="input-dark"
                >
                  <option value="semi_auto">semi_auto</option>
                  <option value="manual">manual</option>
                  <option value="auto">auto</option>
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-amber-50/65">Новий пароль dashboard (необов&apos;язково)</span>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="input-dark"
                  placeholder="Залиш порожнім, щоб не змінювати"
                />
              </label>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="dashboard-card p-5">
              <h2 className="mb-3 text-lg font-semibold">Стан системи</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Дій", value: metrics?.actionsCount ?? 0 },
                  { label: "TikTok-донатів", value: metrics?.giftsCount ?? 0 },
                  { label: "Чеків", value: metrics?.checksCount ?? 0 },
                  { label: "Донатів", value: metrics?.donationsCount ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-200">{stat.value}</p>
                    <p className="text-xs text-amber-50/60">{stat.label}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="dashboard-card p-5">
              <h2 className="mb-3 text-lg font-semibold">Bridge-клієнт</h2>
              <p className="text-xs text-amber-50/60">
                Токен для bridge-launcher (локальні клавіші, звуки, відео).
              </p>
              {bridgeToken ? (
                <p className="mt-3 break-all rounded-lg bg-black/40 px-3 py-2 text-xs text-amber-100">{bridgeToken}</p>
              ) : (
                <p className="mt-3 text-xs text-amber-50/60">Token не показується повторно. Використай rotate.</p>
              )}
            </article>
          </section>

          <div className="sticky bottom-4 z-20">
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0b0a09]/95 px-5 py-3 shadow-2xl backdrop-blur">
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300 disabled:opacity-60"
              >
                {saving ? "Збереження..." : "Зберегти все"}
              </button>
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

