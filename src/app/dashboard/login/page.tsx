"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setError(data.error || "Не вдалося увійти.");
      setLoading(false);
      return;
    }
    router.replace("/dashboard/donations");
    router.refresh();
  }

  return (
    <main className="coffee-bg flex min-h-screen items-center justify-center px-4 py-10 text-[#f4ede0]">
      <form onSubmit={onSubmit} className="dashboard-card w-full max-w-sm p-7">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">Donatelko</p>
          <h1 className="mt-2 text-2xl font-bold">Панель керування</h1>
          <p className="mt-1 text-sm text-amber-50/60">
            Введіть пароль для входу.
          </p>
        </div>

        <label className="mt-6 block text-sm">
          <span className="mb-1.5 block text-amber-50/65">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-white/12 bg-black/30 px-4 text-base outline-none focus:border-amber-300/60"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 font-semibold text-[#24160d] shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-60"
        >
          {loading ? "Перевірка..." : "Увійти"}
        </button>
      </form>
    </main>
  );
}
