"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  description: string;
};

type NavGroup = {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "core",
    title: "Керування",
    icon: "⚙️",
    items: [
      {
        href: "/dashboard/donations/alerts",
        label: "Донати · Оповіщення",
        icon: "💬",
        description: "Черга, статуси та показ донатів",
      },
      {
        href: "/dashboard/donations/battle",
        label: "Донати · Батл",
        icon: "🎭",
        description: "Сценарії батл-донатів та автогенерація",
      },
      {
        href: "/dashboard/donations/widget-links",
        label: "Донати · Ссылки виджетов",
        icon: "📎",
        description: "Лінки OBS, пресети та редактор алертів",
      },
      {
        href: "/dashboard/donations/payments",
        label: "Донати · Крипта/грн",
        icon: "💸",
        description: "UAH, USDT, TON та валютні параметри",
      },
    ],
  },
  {
    id: "tiktok",
    title: "Тикток",
    icon: "🤩",
    items: [
      {
        href: "/dashboard/tiktok/actions",
        label: "Дії",
        icon: "⚡",
        description: "Тригери TikTok-донатів та виконання дій",
      },
      {
        href: "/dashboard/tiktok/action-widgets",
        label: "Віджети дії",
        icon: "🧩",
        description: "Прив’язка дій до віджетів і live-перевірки",
      },
      {
        href: "/dashboard/tiktok/setup-parser",
        label: "Setup / parser",
        icon: "🛠️",
        description: "Username, парсер та каталог TikTok-донатів",
      },
    ],
  },
  {
    id: "system",
    title: "Налаштування",
    icon: "🔧",
    items: [
      {
        href: "/dashboard/settings",
        label: "Глобальні",
        icon: "⚙️",
        description: "Системні параметри без дублювання",
      },
      {
        href: "/dashboard/logs",
        label: "Логи",
        icon: "📋",
        description: "Події, помилки та технічний аудит",
      },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/dashboard/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#0b0a09] text-[#f4ede0]">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0b0a09]/95 px-4 py-3 backdrop-blur md:hidden">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-300/90">Donatelko</p>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs uppercase tracking-wide text-amber-100"
        >
          {menuOpen ? "Закрити" : "Меню"}
        </button>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 px-3 py-4 md:grid-cols-[290px_1fr]">
        <aside
          className={`rounded-2xl border border-white/10 bg-gradient-to-b from-[#16110f] to-[#0f0c0a] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${
            menuOpen ? "block" : "hidden"
          } md:block`}
        >
          <div className="border-b border-white/10 pb-4">
            <p className="text-xs uppercase tracking-[0.26em] text-amber-300/80">Panel</p>
            <h1 className="mt-1.5 text-lg font-semibold">Керування стрімом</h1>
            <p className="mt-1 text-xs text-amber-50/55">Одна панель для донатів, тригерів та віджетів</p>
          </div>

          <nav className="mt-3 space-y-3">
            {navGroups.map((group) => (
              <div key={group.id} className="rounded-xl border border-white/10 bg-black/20 p-2">
                <p className="mb-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200/80">
                  {group.icon} {group.title}
                </p>
                <div className="grid gap-1.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`group rounded-xl border px-3 py-2.5 transition ${
                          active
                            ? "border-amber-300/55 bg-amber-300/10 shadow-[0_0_0_1px_rgba(233,179,90,0.12)]"
                            : "border-transparent hover:border-white/15 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 text-base">{item.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{item.label}</p>
                            <p className="mt-0.5 text-[11px] leading-tight text-amber-50/55 group-hover:text-amber-50/75">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-4 border-t border-white/10 pt-4">
            <Link
              href="/"
              className="mb-2 block rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-amber-50/75 transition hover:bg-white/5"
            >
              Відкрити донат-сторінку
            </Link>
            <button
              type="button"
              onClick={logout}
              className="w-full rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/20"
              disabled={loggingOut}
            >
              {loggingOut ? "Вихід..." : "Вийти"}
            </button>
          </div>
        </aside>

        <section className="space-y-4">{children}</section>
      </div>
    </div>
  );
}
