"use client";

import { useEffect, useMemo, useState } from "react";

type ConnectionsData = {
  id: string;
  cryptobotToken: string;
  monobankJarUrl: string;
  tonAddress: string;
};

type PaymentData = {
  id: string;
  uahPaymentUrl: string;
  cryptobotUsdtUrl: string;
  tonPayUrl: string;
  tonReceiverAddress: string;
  tonNetwork: string;
  minAmountUah: number;
  maxAmountUah: number;
};

type Rates = {
  usdtToUah: number;
  tonToUah: number;
};

export default function DonationPaymentsPage() {
  const [connections, setConnections] = useState<ConnectionsData | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    const [connRes, settingsRes, ratesRes] = await Promise.all([
      fetch("/api/connections", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" }),
      fetch("/api/rates", { cache: "no-store" }),
    ]);
    const [connJson, settingsJson, ratesJson] = await Promise.all([
      connRes.json(),
      settingsRes.json(),
      ratesRes.json(),
    ]);
    if (connJson.ok) setConnections(connJson.data);
    if (settingsJson.ok) setPayment(settingsJson.data);
    if (ratesJson.ok) setRates(ratesJson.data);
  }

  const loading = !connections || !payment;

  const currencySamples = useMemo(() => {
    if (!rates) return null;
    const eurToUahApprox = rates.usdtToUah * 1.08;
    return {
      UAH: 100,
      USD: Number((100 / rates.usdtToUah).toFixed(2)),
      EUR: Number((100 / eurToUahApprox).toFixed(2)),
      USDT: Number((100 / rates.usdtToUah).toFixed(2)),
      TON: Number((100 / rates.tonToUah).toFixed(3)),
    };
  }, [rates]);

  async function saveAll() {
    if (!connections || !payment) return;
    setSaving(true);
    setMessage("");

    const [connRes, settingsRes] = await Promise.all([
      fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cryptobotToken: connections.cryptobotToken,
          monobankJarUrl: connections.monobankJarUrl,
          tonAddress: connections.tonAddress,
        }),
      }),
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uahPaymentUrl: payment.uahPaymentUrl,
          cryptobotUsdtUrl: payment.cryptobotUsdtUrl,
          tonPayUrl: payment.tonPayUrl,
          tonReceiverAddress: payment.tonReceiverAddress,
          tonNetwork: payment.tonNetwork,
          minAmountUah: payment.minAmountUah,
          maxAmountUah: payment.maxAmountUah,
        }),
      }),
    ]);

    const [connJson, settingsJson] = await Promise.all([connRes.json(), settingsRes.json()]);
    setSaving(false);

    if (!connRes.ok || !connJson.ok || !settingsRes.ok || !settingsJson.ok) {
      setMessage(connJson.error || settingsJson.error || "Не вдалося зберегти платіжні налаштування.");
      return;
    }

    setMessage("Платіжні налаштування оновлено.");
    await loadAll();
  }

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">Донати · Настройка крипты/грн</h1>
        <p className="mt-1 text-sm text-amber-50/70">
          Єдине місце для UAH, USDT, TON та лімітів донатів. Без дублювання в інших екранах.
        </p>
      </section>

      {loading ? (
        <section className="dashboard-card p-5">
          <p className="text-sm text-amber-50/70">Завантаження...</p>
        </section>
      ) : (
        <>
          <section className="dashboard-card p-5">
            <h2 className="mb-4 text-lg font-semibold">UAH / Monobank</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">Monobank jar URL</span>
                <input
                  value={connections.monobankJarUrl}
                  onChange={(e) => setConnections({ ...connections, monobankJarUrl: e.target.value })}
                  className="input-dark"
                  placeholder="https://send.monobank.ua/jar/..."
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">UAH payment URL</span>
                <input
                  value={payment.uahPaymentUrl}
                  onChange={(e) => setPayment({ ...payment, uahPaymentUrl: e.target.value })}
                  className="input-dark"
                  placeholder="https://send.monobank.ua/jar/..."
                />
              </label>
            </div>
          </section>

          <section className="dashboard-card p-5">
            <h2 className="mb-4 text-lg font-semibold">USDT / TON</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">CryptoBOT token</span>
                <input
                  value={connections.cryptobotToken}
                  onChange={(e) => setConnections({ ...connections, cryptobotToken: e.target.value })}
                  className="input-dark"
                  type="password"
                  placeholder="API token @CryptoBot"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">CryptoBOT URL</span>
                <input
                  value={payment.cryptobotUsdtUrl}
                  onChange={(e) => setPayment({ ...payment, cryptobotUsdtUrl: e.target.value })}
                  className="input-dark"
                  placeholder="https://t.me/CryptoBot?start=..."
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">TON address (direct)</span>
                <input
                  value={connections.tonAddress}
                  onChange={(e) => setConnections({ ...connections, tonAddress: e.target.value })}
                  className="input-dark"
                  placeholder="UQ..."
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">TON receiver (invoice)</span>
                <input
                  value={payment.tonReceiverAddress}
                  onChange={(e) => setPayment({ ...payment, tonReceiverAddress: e.target.value })}
                  className="input-dark"
                  placeholder="UQ..."
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">TonPay URL</span>
                <input
                  value={payment.tonPayUrl}
                  onChange={(e) => setPayment({ ...payment, tonPayUrl: e.target.value })}
                  className="input-dark"
                  placeholder="ton://transfer/..."
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">TON network</span>
                <select
                  value={payment.tonNetwork}
                  onChange={(e) => setPayment({ ...payment, tonNetwork: e.target.value })}
                  className="input-dark"
                >
                  <option value="mainnet">mainnet</option>
                  <option value="testnet">testnet</option>
                </select>
              </label>
            </div>
          </section>

          <section className="dashboard-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Ліміти та шаблони валют</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">Мін. сума (грн)</span>
                <input
                  type="number"
                  value={payment.minAmountUah}
                  onChange={(e) => setPayment({ ...payment, minAmountUah: Number(e.target.value) || 0 })}
                  className="input-dark"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/65">Макс. сума (грн)</span>
                <input
                  type="number"
                  value={payment.maxAmountUah}
                  onChange={(e) => setPayment({ ...payment, maxAmountUah: Number(e.target.value) || 0 })}
                  className="input-dark"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-amber-50/80">
              <p className="font-semibold text-amber-100">Підтримувані валюти шаблонів алертів</p>
              <p className="mt-1">UAH, EUR, USD, USDT, TON</p>
              {currencySamples ? (
                <p className="mt-2">
                  100 UAH ≈ {currencySamples.USD} USD ≈ {currencySamples.EUR} EUR ≈ {currencySamples.USDT} USDT ≈{" "}
                  {currencySamples.TON} TON
                </p>
              ) : (
                <p className="mt-2">Курс ще завантажується…</p>
              )}
            </div>
          </section>

          <div className="sticky bottom-4 z-20">
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0b0a09]/95 px-5 py-3 shadow-2xl backdrop-blur">
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300 disabled:opacity-60"
              >
                {saving ? "Збереження..." : "Зберегти"}
              </button>
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

