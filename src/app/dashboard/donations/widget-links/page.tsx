"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Preset = {
  id: string;
  slug: string;
  name: string;
  settingsJson: string;
  isActive: boolean;
};

type WidgetVariant = {
  id: string;
  name: string;
  minUah: number;
  maxUah: number;
  gifUrl?: string;
  transparent?: boolean;
};

type WidgetSettings = {
  limit?: number;
  compact?: boolean;
  showChannel?: boolean;
  showTop3?: boolean;
  animation?: string;
  animationPreset?: string;
  period?: "week" | "month" | "all";
  includeFake?: boolean;
  displayMs?: number;
  notificationType?: "all" | "donation" | "tiktok_donation";
  gifUrl?: string;
  soundUrl?: string;
  textTemplate?: string;
  transparent?: boolean;
  variants?: WidgetVariant[];
};

type WidgetSlot = {
  slug: string;
  title: string;
  description: string;
  kind: "last" | "top" | "alert" | "donation_alert" | "tiktok_alert" | "battle";
};

const WIDGET_SLOTS: WidgetSlot[] = [
  {
    slug: "last-donations",
    title: "Останні донати",
    description: "Список останніх донатів",
    kind: "last",
  },
  {
    slug: "top-donors",
    title: "Топ 3 донатерів",
    description: "Топ 1/2/3: ім'я + сума",
    kind: "top",
  },
  {
    slug: "alerts-feed",
    title: "Стрічка алертів",
    description: "Змішана стрічка донатів і TikTok-донатів",
    kind: "alert",
  },
  {
    slug: "donation-alert",
    title: "Донат алерт",
    description: "Окремий алерт тільки для донатів",
    kind: "donation_alert",
  },
  {
    slug: "tiktok-alert",
    title: "TikTok алерт",
    description: "Окремий алерт тільки для TikTok-донатів",
    kind: "tiktok_alert",
  },
  {
    slug: "fake-battle",
    title: "Фейк батл",
    description: "Сценарій батл-донатів",
    kind: "battle",
  },
];

function slotBySlug(slug: string) {
  return WIDGET_SLOTS.find((slot) => slot.slug === slug) || WIDGET_SLOTS[0];
}

function defaultNameFor(slug: string) {
  return slotBySlug(slug).title;
}

function normalizePresetName(value: string | undefined, slug: string) {
  const raw = String(value || "").trim();
  if (!raw) return defaultNameFor(slug);
  if (/\?{2,}/.test(raw)) return defaultNameFor(slug);
  return raw;
}

function defaultsFor(slug: string) {
  if (slug === "last-donations") {
    return {
      limit: 20,
      compact: false,
      showChannel: true,
      transparent: true,
    } satisfies WidgetSettings;
  }
  if (slug === "top-donors") {
    return {
      limit: 3,
      period: "all",
      transparent: true,
    } satisfies WidgetSettings;
  }
  if (slug === "alerts-feed") {
    return {
      limit: 30,
      includeFake: true,
      displayMs: 7000,
      animationPreset: "soft-pop",
      notificationType: "all",
      transparent: true,
      gifUrl: "",
      soundUrl: "",
      textTemplate: "{donorName}: {amount}",
      variants: [],
    } satisfies WidgetSettings;
  }
  if (slug === "donation-alert") {
    return {
      limit: 30,
      includeFake: true,
      displayMs: 7000,
      animationPreset: "soft-pop",
      notificationType: "donation",
      transparent: true,
      gifUrl: "",
      soundUrl: "",
      textTemplate: "{donorName}: {amount}",
      variants: [],
    } satisfies WidgetSettings;
  }
  if (slug === "tiktok-alert") {
    return {
      limit: 30,
      includeFake: false,
      displayMs: 7000,
      animationPreset: "soft-pop",
      notificationType: "tiktok_donation",
      transparent: true,
      gifUrl: "",
      soundUrl: "",
      textTemplate: "{donorName}: {amount}",
      variants: [],
    } satisfies WidgetSettings;
  }
  return {
    limit: 20,
    showTop3: true,
    transparent: true,
  } satisfies WidgetSettings;
}

export default function WidgetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState("last-donations");
  const [settingsText, setSettingsText] = useState("");
  const [name, setName] = useState(defaultNameFor("last-donations"));
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");

  const selectedSlot = useMemo(() => slotBySlug(selected), [selected]);

  const parsedSettings = useMemo<WidgetSettings>(() => {
    try {
      return JSON.parse(settingsText || "{}") as WidgetSettings;
    } catch {
      return {};
    }
  }, [settingsText]);

  const variants = useMemo<WidgetVariant[]>(() => {
    if (!Array.isArray(parsedSettings.variants)) return [];
    return parsedSettings.variants.map((item, index) => ({
      id: item.id || `variant-${index + 1}`,
      name: item.name || `Підвіджет ${index + 1}`,
      minUah: Number(item.minUah ?? 0),
      maxUah: Number(item.maxUah ?? 0),
      gifUrl: item.gifUrl || "",
      transparent: Boolean(item.transparent),
    }));
  }, [parsedSettings.variants]);

  function patchSettings(patch: Partial<WidgetSettings>) {
    const next = { ...parsedSettings, ...patch };
    setSettingsText(JSON.stringify(next, null, 2));
  }

  function setVariantList(nextVariants: WidgetVariant[]) {
    patchSettings({ variants: nextVariants });
  }

  function buildWidgetUrl(settings: WidgetSettings) {
    const params = new URLSearchParams();
    if (settings.transparent) params.set("transparent", "1");
    if (settings.gifUrl?.trim()) params.set("gif", settings.gifUrl.trim());

    if (selected === "top-donors" && settings.period) {
      params.set("period", settings.period);
    }
    if (selected === "alerts-feed") {
      const mode = String(settings.notificationType || "all");
      if (mode !== "all") params.set("mode", mode);
    }
    if (selected === "donation-alert") {
      params.set("mode", "donation");
    }
    if (selected === "tiktok-alert") {
      params.set("mode", "tiktok_donation");
    }

    const query = params.toString();
    return `${origin}/widget/${selected}${query ? `?${query}` : ""}`;
  }

  function buildVariantUrl(variant: WidgetVariant) {
    const params = new URLSearchParams();
    params.set("minUah", String(variant.minUah));
    params.set("maxUah", String(variant.maxUah));
    if (variant.transparent) params.set("transparent", "1");
    if (variant.gifUrl?.trim()) params.set("gif", variant.gifUrl.trim());
    if (selected === "donation-alert") params.set("mode", "donation");
    if (selected === "tiktok-alert") params.set("mode", "tiktok_donation");
    return `${origin}/widget/${selected}?${params.toString()}`;
  }

  const reload = useCallback(
    async (preferredSlug?: string) => {
      const response = await fetch("/api/widgets/presets", { cache: "no-store" });
      const result = await response.json();
      if (!result.ok) return;

      const list: Preset[] = result.data;
      setPresets(list);

      const targetSlug = preferredSlug || selected;
      const fallbackSlug = WIDGET_SLOTS[0].slug;
      const current =
        list.find((item) => item.slug === targetSlug) ||
        list.find((item) => item.slug === fallbackSlug);

      if (current) {
        setSelected(current.slug);
        setName(normalizePresetName(current.name, current.slug));
        setActive(current.isActive);
        setSettingsText(current.settingsJson);
        return;
      }

      const slug = targetSlug || fallbackSlug;
      setSelected(slug);
      setName(defaultNameFor(slug));
      setActive(true);
      setSettingsText(JSON.stringify(defaultsFor(slug), null, 2));
    },
    [selected]
  );

  useEffect(() => {
    setOrigin(window.location.origin);
    const url = new URL(window.location.href);
    const slugFromQuery = url.searchParams.get("slug");
    const hasKnownSlug = WIDGET_SLOTS.some((item) => item.slug === slugFromQuery);
    void reload(hasKnownSlug && slugFromQuery ? slugFromQuery : undefined);
  }, [reload]);

  function choosePreset(slug: string) {
    setSelected(slug);
    const item = presets.find((preset) => preset.slug === slug);
    if (item) {
      setName(normalizePresetName(item.name, slug));
      setActive(item.isActive);
      setSettingsText(item.settingsJson);
      return;
    }
    setName(defaultNameFor(slug));
    setActive(true);
    setSettingsText(JSON.stringify(defaultsFor(slug), null, 2));
  }

  function addVariant() {
    const next: WidgetVariant = {
      id: `variant-${Date.now()}`,
      name: `Підвіджет ${variants.length + 1}`,
      minUah: 0,
      maxUah: 0,
      gifUrl: "",
      transparent: true,
    };
    setVariantList([...variants, next]);
  }

  function updateVariant(id: string, patch: Partial<WidgetVariant>) {
    setVariantList(variants.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeVariant(id: string) {
    setVariantList(variants.filter((item) => item.id !== id));
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Посилання скопійовано.");
    } catch {
      setMessage("Не вдалося скопіювати.");
    }
  }

  async function savePreset() {
    setMessage("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(settingsText || "{}");
    } catch {
      setMessage("JSON налаштувань містить помилку.");
      return;
    }

    const response = await fetch("/api/widgets/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: selected,
        name: name.trim() || defaultNameFor(selected),
        settings: parsed,
        isActive: active,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage(result.error || "Не вдалося зберегти пресет.");
      return;
    }

    setMessage("Пресет віджета збережено.");
    await reload(selected);
  }

  const widgetUrl = buildWidgetUrl(parsedSettings);

  const isTopWidget = selectedSlot.kind === "top";
  const isLastWidget = selectedSlot.kind === "last";
  const isBattleWidget = selectedSlot.kind === "battle";
  const isAlertWidget =
    selectedSlot.kind === "alert" ||
    selectedSlot.kind === "donation_alert" ||
    selectedSlot.kind === "tiktok_alert";
  const modeFixedDonation = selectedSlot.kind === "donation_alert";
  const modeFixedTikTok = selectedSlot.kind === "tiktok_alert";
  const showModeSelector = selectedSlot.kind === "alert";
  const showVariants = selectedSlot.kind === "alert" || selectedSlot.kind === "donation_alert";

  const previewAmount =
    modeFixedTikTok || parsedSettings.notificationType === "tiktok_donation"
      ? "250 coins"
      : "150 грн";

  const previewText = String(parsedSettings.textTemplate || "{donorName}: {amount}")
    .replace("{donorName}", "TikTok Viewer")
    .replace("{amount}", previewAmount);

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">Ссылки виджетов</h1>
        <p className="mt-1 text-sm text-amber-50/75">
          Кожен віджет налаштовується окремо за своїм сценарієм, без зайвих полів.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <article className="dashboard-card p-4">
          <h2 className="text-sm uppercase tracking-[0.15em] text-amber-200/80">Слоти віджетів</h2>
          <div className="mt-3 grid gap-2">
            {WIDGET_SLOTS.map((slot) => {
              const selectedNow = slot.slug === selected;
              return (
                <button
                  key={slot.slug}
                  type="button"
                  onClick={() => choosePreset(slot.slug)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    selectedNow
                      ? "border-amber-200/80 bg-amber-100/10"
                      : "border-white/10 bg-black/20 hover:border-white/30"
                  }`}
                >
                  <p className="text-sm font-semibold">{slot.title}</p>
                  <p className="text-xs text-amber-50/70">{slot.slug}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-amber-50/75">
            <p>Посилання на віджет:</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={widgetUrl} readOnly className="input-dark min-w-[240px] flex-1" />
              <button
                type="button"
                onClick={() => window.open(widgetUrl, "_blank", "noopener,noreferrer")}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
              >
                Перегляд
              </button>
              <button
                type="button"
                onClick={() => copyText(widgetUrl)}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
              >
                Копіювати
              </button>
            </div>
          </div>
        </article>

        <article className="dashboard-card p-5">
          <h2 className="text-lg font-semibold">Налаштування: {selectedSlot.title}</h2>
          <p className="mt-1 text-xs text-amber-50/65">{selectedSlot.description}</p>

          {isAlertWidget ? (
            <div className="mt-3 rounded-xl border border-amber-300/30 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-amber-200/80">Live Preview</p>
              <div className="mt-2 rounded-lg border border-white/10 bg-black/35 p-3">
                <p className="text-sm font-semibold text-amber-100">TikTok Viewer</p>
                <p className="mt-1 text-lg font-bold text-amber-200">{previewAmount}</p>
                <p className="mt-1 text-xs text-amber-50/80">{previewText}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <p className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200/80">
              Загальні
            </p>
            <label className="text-sm">
              <span className="mb-1 block text-amber-50/75">Назва віджета</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-dark" />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Віджет активний
            </label>

            {isLastWidget ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/75">Ліміт записів</span>
                  <input
                    type="number"
                    min={1}
                    value={Number(parsedSettings.limit || 20)}
                    onChange={(e) => patchSettings({ limit: Number(e.target.value) || 20 })}
                    className="input-dark"
                  />
                </label>
                <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(parsedSettings.showChannel)}
                    onChange={(e) => patchSettings({ showChannel: e.target.checked })}
                  />
                  Показувати канал (UAH/Crypto/TikTok)
                </label>
              </>
            ) : null}

            {isTopWidget ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/75">Кількість у топі</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={Number(parsedSettings.limit || 3)}
                    onChange={(e) => patchSettings({ limit: Number(e.target.value) || 3 })}
                    className="input-dark"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/75">Період</span>
                  <select
                    value={parsedSettings.period || "all"}
                    onChange={(e) => patchSettings({ period: e.target.value as "week" | "month" | "all" })}
                    className="input-dark"
                  >
                    <option value="week">Тиждень</option>
                    <option value="month">Місяць</option>
                    <option value="all">Весь час</option>
                  </select>
                </label>
              </>
            ) : null}

            {isBattleWidget ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/75">Ліміт записів</span>
                  <input
                    type="number"
                    min={1}
                    value={Number(parsedSettings.limit || 20)}
                    onChange={(e) => patchSettings({ limit: Number(e.target.value) || 20 })}
                    className="input-dark"
                  />
                </label>
                <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(parsedSettings.showTop3 ?? true)}
                    onChange={(e) => patchSettings({ showTop3: e.target.checked })}
                  />
                  Показувати Top 3
                </label>
              </>
            ) : null}

            {isAlertWidget ? (
              <>
                {showModeSelector ? (
                  <label className="text-sm">
                    <span className="mb-1 block text-amber-50/75">Сповіщення для</span>
                    <select
                      value={parsedSettings.notificationType || "all"}
                      onChange={(e) =>
                        patchSettings({
                          notificationType: e.target.value as "all" | "donation" | "tiktok_donation",
                        })
                      }
                      className="input-dark"
                    >
                      <option value="all">Усе разом</option>
                      <option value="donation">Тільки донати</option>
                      <option value="tiktok_donation">Тільки TikTok-донати</option>
                    </select>
                  </label>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-amber-50/80">
                    {modeFixedDonation
                      ? "Режим зафіксовано: тільки донати."
                      : "Режим зафіксовано: тільки TikTok-донати."}
                  </div>
                )}
                <label className="text-sm">
                  <span className="mb-1 block text-amber-50/75">Display, ms</span>
                  <input
                    type="number"
                    min={1000}
                    value={Number(parsedSettings.displayMs || 7000)}
                    onChange={(e) => patchSettings({ displayMs: Number(e.target.value) || 7000 })}
                    className="input-dark"
                  />
                </label>

                <p className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200/80">
                  Медіа
                </p>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-amber-50/75">GIF URL (опціонально)</span>
                  <input
                    value={parsedSettings.gifUrl || ""}
                    onChange={(e) => patchSettings({ gifUrl: e.target.value })}
                    className="input-dark"
                    placeholder="https://...gif"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-amber-50/75">Sound URL (опціонально)</span>
                  <input
                    value={parsedSettings.soundUrl || ""}
                    onChange={(e) => patchSettings({ soundUrl: e.target.value })}
                    className="input-dark"
                    placeholder="https://...mp3"
                  />
                </label>

                <p className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200/80">
                  Текст
                </p>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-amber-50/75">Template</span>
                  <input
                    value={parsedSettings.textTemplate || "{donorName}: {amount}"}
                    onChange={(e) => patchSettings({ textTemplate: e.target.value })}
                    className="input-dark"
                    placeholder="{donorName}: {amount}"
                  />
                </label>
                <div className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-amber-50/70">
                  Валюти шаблону: UAH / EUR / USD / USDT / TON
                </div>

                {showVariants ? (
                  <div className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Підвіджети з діапазонами сум</p>
                      <button
                        type="button"
                        onClick={addVariant}
                        className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
                      >
                        Додати підвіджет
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {variants.length === 0 ? (
                        <p className="text-xs text-amber-50/60">Поки що підвіджетів немає.</p>
                      ) : (
                        variants.map((variant, index) => (
                          <div key={variant.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                            <div className="grid gap-2 md:grid-cols-4">
                              <input
                                value={variant.name}
                                onChange={(e) => updateVariant(variant.id, { name: e.target.value })}
                                className="input-dark"
                                placeholder={`Підвіджет ${index + 1}`}
                              />
                              <input
                                type="number"
                                value={variant.minUah}
                                onChange={(e) => updateVariant(variant.id, { minUah: Number(e.target.value) || 0 })}
                                className="input-dark"
                                placeholder="Від грн"
                              />
                              <input
                                type="number"
                                value={variant.maxUah}
                                onChange={(e) => updateVariant(variant.id, { maxUah: Number(e.target.value) || 0 })}
                                className="input-dark"
                                placeholder="До грн"
                              />
                              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={Boolean(variant.transparent)}
                                  onChange={(e) => updateVariant(variant.id, { transparent: e.target.checked })}
                                />
                                Прозорий
                              </label>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <input
                                value={variant.gifUrl || ""}
                                onChange={(e) => updateVariant(variant.id, { gifUrl: e.target.value })}
                                className="input-dark min-w-[280px] flex-1"
                                placeholder="GIF URL для підвіджета"
                              />
                              <button
                                type="button"
                                onClick={() => window.open(buildVariantUrl(variant), "_blank", "noopener,noreferrer")}
                                className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
                              >
                                Перегляд
                              </button>
                              <button
                                type="button"
                                onClick={() => copyText(buildVariantUrl(variant))}
                                className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
                              >
                                Копіювати
                              </button>
                              <button
                                type="button"
                                onClick={() => removeVariant(variant.id)}
                                className="rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-200 hover:bg-red-500/15"
                              >
                                Видалити
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            <label className="text-sm md:col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <input
                type="checkbox"
                checked={Boolean(parsedSettings.transparent)}
                onChange={(e) => patchSettings({ transparent: e.target.checked })}
              />
              Прозорий фон віджета
            </label>

            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-amber-50/75">JSON налаштування (розширено)</span>
              <textarea
                value={settingsText}
                onChange={(e) => setSettingsText(e.target.value)}
                className="h-56 w-full rounded-xl border border-white/15 bg-black/30 p-3 font-mono text-xs outline-none focus:border-amber-300/70"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={savePreset}
            className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300"
          >
            Зберегти пресет
          </button>
          {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}

          <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-sm font-semibold">Preview endpoint</p>
            <a
              href={`/api/widgets/${selected}/feed`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-amber-100 underline underline-offset-2"
            >
              /api/widgets/{selected}/feed
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}

