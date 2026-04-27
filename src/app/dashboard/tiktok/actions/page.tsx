"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MediaAsset = {
  id: string;
  type: "AUDIO" | "VIDEO";
  originalName: string;
  relativePath: string;
};

type TikTokDonationCatalogItem = {
  giftId: string;
  name: string;
  coins: number;
  imageUrl?: string | null;
  provider?: string;
};

type RawTikTokDonationCatalogItem = {
  id?: string;
  giftId?: string;
  name?: string;
  coins?: number;
  tiktokDonationId?: string;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  imageUrl?: string | null;
  provider?: string;
};

function normalizeCatalogItems(input: unknown): TikTokDonationCatalogItem[] {
  const rows = Array.isArray(input) ? (input as RawTikTokDonationCatalogItem[]) : [];
  return rows.map((row, index) => {
    const giftId = String(row.giftId ?? row.tiktokDonationId ?? row.id ?? `donation-${index + 1}`).trim();
    const name = String(row.name ?? row.tiktokDonationName ?? giftId).trim();
    const coinsRaw = Number(row.coins ?? row.tiktokCoins ?? 0);
    return {
      giftId,
      name: name || giftId || "TikTok donation",
      coins: Number.isFinite(coinsRaw) && coinsRaw > 0 ? coinsRaw : 1,
      imageUrl: row.imageUrl || null,
      provider: row.provider || "tiktok",
    };
  });
}

type Trigger = {
  type: "amount_uah" | "tiktok_donation" | "chat_command" | "like_count" | "subscribe";
  enabled: boolean;
  amountUah?: number;
  tiktokDonationName?: string;
  tiktokCoins?: number;
  commandText?: string;
  likeCount?: number;
  requireExactLike?: boolean;
};

type ActionItem = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  actionType: string;
  payload: string;
  fixedDelaySec: number | null;
  randomDelayMinSec: number | null;
  randomDelayMaxSec: number | null;
  cooldownSec: number;
  mediaAssetId: string | null;
  triggers: Array<{
    id: string;
    type: string;
    enabled: boolean;
    amountUah: number | null;
    tiktokDonationName: string | null;
    tiktokCoins: number | null;
    commandText: string | null;
    likeCount: number | null;
    requireExactLike: boolean;
  }>;
};

const ACTION_TYPES = [
  { value: "minecraft_command", label: "Minecraft RCON команда" },
  { value: "keypress", label: "Натискання клавіші на ПК" },
  { value: "sound", label: "Програти звук" },
  { value: "video", label: "Програти відео" },
  { value: "webhook", label: "Webhook" },
  { value: "obs_action", label: "OBS дія" },
] as const;

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [gifts, setGifts] = useState<TikTokDonationCatalogItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState<string>("minecraft_command");
  const [payload, setPayload] = useState("");
  const [fixedDelaySec, setFixedDelaySec] = useState<number | "">("");
  const [randomFrom, setRandomFrom] = useState<number | "">("");
  const [randomTo, setRandomTo] = useState<number | "">("");
  const [mediaAssetId, setMediaAssetId] = useState<string>("");

  const [triggerAmount, setTriggerAmount] = useState(false);
  const [triggerGift, setTriggerGift] = useState(false);
  const [triggerCommand, setTriggerCommand] = useState(false);
  const [triggerLike, setTriggerLike] = useState(false);
  const [triggerSubscribe, setTriggerSubscribe] = useState(false);

  const [amountUah, setAmountUah] = useState<number | "">(50);
  const [tiktokDonationName, setTiktokDonationName] = useState("");
  const [tiktokCoins, setTiktokCoins] = useState<number | "">(1);
  const [giftSearch, setGiftSearch] = useState("");
  const [commandText, setCommandText] = useState("!totem");
  const [likeCount, setLikeCount] = useState<number | "">(100);
  const [requireExactLike, setRequireExactLike] = useState(false);

  const mediaForType = useMemo(() => {
    if (actionType === "sound") return mediaAssets.filter((item) => item.type === "AUDIO");
    if (actionType === "video") return mediaAssets.filter((item) => item.type === "VIDEO");
    return mediaAssets;
  }, [actionType, mediaAssets]);

  const filteredGifts = useMemo(() => {
    const query = giftSearch.trim().toLowerCase();
    if (!query) return gifts;
    return gifts.filter((gift) => {
      return (
        gift.name.toLowerCase().includes(query) ||
        String(gift.coins).includes(query) ||
        (gift.provider || "").toLowerCase().includes(query)
      );
    });
  }, [giftSearch, gifts]);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [actionsRes, mediaRes, giftsRes] = await Promise.all([
      fetch("/api/actions", { cache: "no-store" }),
      fetch("/api/media", { cache: "no-store" }),
      fetch("/api/tiktok/donations/catalog", { cache: "no-store" }),
    ]);
    const [actionsJson, mediaJson, giftsJson] = await Promise.all([
      actionsRes.json(),
      mediaRes.json(),
      giftsRes.json(),
    ]);
    if (actionsJson.ok) setActions(actionsJson.data);
    if (mediaJson.ok) setMediaAssets(mediaJson.data);
    if (giftsJson.ok) setGifts(normalizeCatalogItems(giftsJson.data));
  }

  async function refreshGiftCatalog() {
    setMessage("");
    await reload();
    setMessage("Каталог TikTok-донатів оновлено.");
  }

  async function uploadMedia(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Помилка завантаження файлу.");
      return;
    }
    setMessage("Медіа завантажено.");
    await reload();
  }

  function collectTriggers(): Trigger[] {
    const result: Trigger[] = [];
    if (triggerAmount && amountUah !== "") {
      result.push({
        type: "amount_uah",
        enabled: true,
        amountUah: Number(amountUah),
      });
    }
    if (triggerGift) {
      result.push({
        type: "tiktok_donation",
        enabled: true,
        tiktokDonationName: tiktokDonationName.trim() || undefined,
        tiktokCoins: tiktokCoins === "" ? undefined : Number(tiktokCoins),
      });
    }
    if (triggerCommand && commandText.trim()) {
      result.push({
        type: "chat_command",
        enabled: true,
        commandText: commandText.trim(),
      });
    }
    if (triggerLike && likeCount !== "") {
      result.push({
        type: "like_count",
        enabled: true,
        likeCount: Number(likeCount),
        requireExactLike,
      });
    }
    if (triggerSubscribe) {
      result.push({
        type: "subscribe",
        enabled: true,
      });
    }
    return result;
  }

  async function createAction() {
    const triggers = collectTriggers();
    if (!title.trim() || !payload.trim()) {
      setMessage("Назва та payload обов'язкові.");
      return;
    }
    if (triggers.length === 0) {
      setMessage("Увімкніть хоча б один тригер.");
      return;
    }
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        actionType,
        payload,
        fixedDelaySec: fixedDelaySec === "" ? null : Number(fixedDelaySec),
        randomDelayMinSec: randomFrom === "" ? null : Number(randomFrom),
        randomDelayMaxSec: randomTo === "" ? null : Number(randomTo),
        mediaAssetId: mediaAssetId || null,
        triggers,
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося створити дію.");
      return;
    }

    setTitle("");
    setDescription("");
    setPayload("");
    setMediaAssetId("");
    setFixedDelaySec("");
    setRandomFrom("");
    setRandomTo("");
    setGiftSearch("");
    setTriggerAmount(false);
    setTriggerGift(false);
    setTriggerCommand(false);
    setTriggerLike(false);
    setTriggerSubscribe(false);
    setMessage("Дію створено.");
    await reload();
  }

  async function toggleAction(action: ActionItem) {
    const response = await fetch(`/api/actions/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: !action.enabled,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося змінити стан дії.");
      return;
    }
    await reload();
  }

  async function removeAction(actionId: string) {
    const response = await fetch(`/api/actions/${actionId}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося видалити дію.");
      return;
    }
    await reload();
  }

  async function deleteMedia(id: string) {
    const response = await fetch(`/api/media/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setMessage(data.error || "Не вдалося видалити файл.");
      return;
    }
    await reload();
  }

  return (
    <main className="space-y-4">
      <section className="dashboard-card p-5">
        <h1 className="text-2xl font-semibold">Дії</h1>
        <p className="mt-1 text-sm text-amber-50/75">
          Налаштовуйте всі тригери в одному місці: сума, TikTok-донат, команда, лайки, підписка.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/dashboard/donations/widget-links?slug=tiktok-alert"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-white/10"
          >
            Налаштувати TikTok-алерт
          </Link>
          <button
            type="button"
            onClick={() => window.open("/widget/tiktok-alert", "_blank", "noopener,noreferrer")}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-white/10"
          >
            Відкрити TikTok-віджет
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="dashboard-card p-5">
          <h2 className="text-lg font-semibold">Нова дія</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-amber-50/75">Назва</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="input-dark" />
            </label>

            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-amber-50/75">Опис</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input-dark"
                placeholder="Що має відбутися"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-amber-50/75">Тип результату</span>
              <select
                value={actionType}
                onChange={(event) => setActionType(event.target.value)}
                className="input-dark"
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-amber-50/75">Payload / команда / URL</span>
              <input
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                className="input-dark"
                placeholder="/summon zombie / key:F5 / https://..."
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-amber-50/75">Фіксована затримка, сек</span>
              <input
                value={fixedDelaySec}
                onChange={(event) => setFixedDelaySec(event.target.value ? Number(event.target.value) : "")}
                className="input-dark"
                type="number"
                min={0}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/75">Від, сек</span>
                <input
                  value={randomFrom}
                  onChange={(event) => setRandomFrom(event.target.value ? Number(event.target.value) : "")}
                  className="input-dark"
                  type="number"
                  min={0}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-amber-50/75">До, сек</span>
                <input
                  value={randomTo}
                  onChange={(event) => setRandomTo(event.target.value ? Number(event.target.value) : "")}
                  className="input-dark"
                  type="number"
                  min={0}
                />
              </label>
            </div>

            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-amber-50/75">Медіа-файл</span>
              <select
                value={mediaAssetId}
                onChange={(event) => setMediaAssetId(event.target.value)}
                className="input-dark"
              >
                <option value="">Без файлу</option>
                {mediaForType.map((media) => (
                  <option key={media.id} value={media.id}>
                    {media.originalName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-amber-200/80">Тригери</h3>
          <div className="mt-3 space-y-3">
            <label className="trigger-row">
              <input type="checkbox" checked={triggerAmount} onChange={(event) => setTriggerAmount(event.target.checked)} />
              <span>Сума в грн</span>
              <input
                value={amountUah}
                onChange={(event) => setAmountUah(event.target.value ? Number(event.target.value) : "")}
                type="number"
                className="input-dark max-w-[140px]"
                disabled={!triggerAmount}
              />
            </label>

            <label className="trigger-row">
              <input type="checkbox" checked={triggerGift} onChange={(event) => setTriggerGift(event.target.checked)} />
              <span>TikTok-донат</span>
              <select
                value={tiktokDonationName}
                onChange={(event) => {
                  const selected = gifts.find((gift) => gift.name === event.target.value);
                  setTiktokDonationName(event.target.value);
                  if (selected) setTiktokCoins(selected.coins);
                }}
                className="input-dark max-w-[240px]"
                disabled={!triggerGift}
              >
                <option value="">Обери донат</option>
                {gifts.map((gift) => (
                  <option key={gift.giftId} value={gift.name}>
                    {gift.name} ({gift.coins})
                  </option>
                ))}
              </select>
              <input
                value={tiktokCoins}
                onChange={(event) => setTiktokCoins(event.target.value ? Number(event.target.value) : "")}
                type="number"
                className="input-dark max-w-[120px]"
                disabled={!triggerGift}
              />
              <button
                type="button"
                onClick={refreshGiftCatalog}
                className="rounded border border-white/20 px-2 py-1 text-xs text-amber-100 hover:bg-white/10"
              >
                Оновити
              </button>
            </label>

            {triggerGift ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={giftSearch}
                    onChange={(event) => setGiftSearch(event.target.value)}
                    className="input-dark min-w-[220px] flex-1"
                    placeholder="Пошук доната або монет..."
                  />
                  <p className="text-xs text-amber-50/70">{filteredGifts.length} TikTok-донатів</p>
                </div>
                <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {filteredGifts.map((gift) => {
                      const selected = gift.name === tiktokDonationName && Number(tiktokCoins || 0) === gift.coins;
                      return (
                        <button
                          key={gift.giftId}
                          type="button"
                          onClick={() => {
                            setTiktokDonationName(gift.name);
                            setTiktokCoins(gift.coins);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                            selected
                              ? "border-amber-300/70 bg-amber-400/20"
                              : "border-white/10 bg-black/25 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/30">
                            {gift.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={gift.imageUrl} alt={gift.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-amber-50/50">no img</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{gift.name}</p>
                            <p className="text-[11px] text-amber-200">{gift.coins} coins</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            <label className="trigger-row">
              <input type="checkbox" checked={triggerCommand} onChange={(event) => setTriggerCommand(event.target.checked)} />
              <span>Команда чату</span>
              <input
                value={commandText}
                onChange={(event) => setCommandText(event.target.value)}
                className="input-dark max-w-[220px]"
                disabled={!triggerCommand}
              />
            </label>

            <div className="trigger-row">
              <input type="checkbox" checked={triggerLike} onChange={(event) => setTriggerLike(event.target.checked)} />
              <span>N лайків</span>
              <input
                value={likeCount}
                onChange={(event) => setLikeCount(event.target.value ? Number(event.target.value) : "")}
                type="number"
                className="input-dark max-w-[120px]"
                disabled={!triggerLike}
              />
              <label className="ml-2 flex items-center gap-2 text-xs text-amber-50/75">
                <input
                  type="checkbox"
                  checked={requireExactLike}
                  onChange={(event) => setRequireExactLike(event.target.checked)}
                  disabled={!triggerLike}
                />
                Рівно N
              </label>
            </div>

            <label className="trigger-row">
              <input
                type="checkbox"
                checked={triggerSubscribe}
                onChange={(event) => setTriggerSubscribe(event.target.checked)}
              />
              <span>Підписка</span>
            </label>
          </div>

          {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
          <button
            type="button"
            onClick={createAction}
            disabled={saving}
            className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#2b1d13] transition hover:bg-amber-300 disabled:opacity-60"
          >
            {saving ? "Створення..." : "Створити дію"}
          </button>
        </article>

        <article className="dashboard-card p-5">
          <h2 className="text-lg font-semibold">Медіа-бібліотека</h2>
          <label className="mt-3 block rounded-xl border border-dashed border-white/20 bg-black/25 px-3 py-4 text-sm">
            <span className="text-amber-50/75">Завантажити звук або відео</span>
            <input
              type="file"
              accept="audio/*,video/*"
              className="mt-2 block w-full text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadMedia(file);
                  event.currentTarget.value = "";
                }
              }}
            />
          </label>

          <div className="mt-3 space-y-2">
            {mediaAssets.length === 0 ? (
              <p className="text-sm text-amber-50/70">Файлів ще немає.</p>
            ) : (
              mediaAssets.map((media) => (
                <div key={media.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                  <p className="text-sm">{media.originalName}</p>
                  <p className="text-xs text-amber-50/70">{media.type}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={media.relativePath}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-white/20 px-2 py-1 text-xs"
                    >
                      Відкрити
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteMedia(media.id)}
                      className="rounded border border-red-300/40 px-2 py-1 text-xs text-red-200"
                    >
                      Видалити
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-card p-5">
        <h2 className="text-lg font-semibold">Активні правила</h2>
        <div className="mt-3 space-y-3">
          {actions.length === 0 ? (
            <p className="text-sm text-amber-50/70">Поки що правил немає.</p>
          ) : (
            actions.map((action) => (
              <article key={action.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{action.title}</p>
                    <p className="text-xs text-amber-50/70">{action.description || "Без опису"}</p>
                    <p className="mt-1 text-xs text-amber-50/70">
                      {action.actionType} | payload: {action.payload}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAction(action)}
                      className={`rounded-lg px-3 py-1 text-xs ${
                        action.enabled
                          ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                          : "border border-white/20 bg-white/5 text-white"
                      }`}
                    >
                      {action.enabled ? "Увімкнено" : "Вимкнено"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAction(action.id)}
                      className="rounded-lg border border-red-300/40 px-3 py-1 text-xs text-red-200"
                    >
                      Видалити
                    </button>
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2 text-xs text-amber-100">
                  {action.triggers.map((trigger) => (
                    <li key={trigger.id} className="rounded bg-amber-100/10 px-2 py-1">
                      {trigger.type}
                      {trigger.amountUah != null ? `: ${trigger.amountUah} грн` : ""}
                      {trigger.tiktokDonationName ? `: ${trigger.tiktokDonationName}` : ""}
                      {trigger.commandText ? `: ${trigger.commandText}` : ""}
                      {trigger.likeCount != null ? `: ${trigger.likeCount}` : ""}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

