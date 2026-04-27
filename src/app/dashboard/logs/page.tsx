"use client";

import { useEffect, useState } from "react";

type LogItem = {
  id: string;
  type: string;
  message: string;
  payloadJson: string | null;
  createdAt: string;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const response = await fetch("/api/logs", { cache: "no-store" });
    const data = await response.json();
    if (data.ok) setLogs(data.data);
  }

  async function clearLogs() {
    const response = await fetch("/api/logs", { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося очистити логи.");
      return;
    }
    setMessage("Логи очищено.");
    setLogs([]);
  }

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="mt-1 text-sm text-amber-50/75">
          Журнал подій: платежі, тригери, bridge-задачі та службові операції.
        </p>
        <button
          type="button"
          onClick={clearLogs}
          className="mt-3 rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/20"
        >
          Очистити логи
        </button>
        {message ? <p className="mt-2 text-sm text-emerald-300">{message}</p> : null}
      </section>

      <section className="dashboard-card max-h-[70vh] overflow-auto p-4">
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-amber-50/70">Логи порожні.</p>
          ) : (
            logs.map((log) => (
              <article key={log.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-50/70">
                  <span className="rounded bg-amber-100/10 px-2 py-1 text-amber-100">{log.type}</span>
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm">{log.message}</p>
                {log.payloadJson ? (
                  <pre className="mt-2 overflow-auto rounded bg-black/35 p-2 text-[11px] text-amber-50/80">
                    {log.payloadJson}
                  </pre>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
