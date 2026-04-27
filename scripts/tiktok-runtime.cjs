/* eslint-disable no-console */
const { TikTokLiveConnection } = require("tiktok-live-connector");

const appBase = (process.env.DONATELKO_API_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const pollConfigMs = Math.max(5000, Number(process.env.TIKTOK_CONFIG_POLL_MS || 30000));
const reconnectMs = Math.max(2000, Number(process.env.TIKTOK_RECONNECT_MS || 5000));
const offlineReconnectMs = Math.max(reconnectMs, Number(process.env.TIKTOK_OFFLINE_RECONNECT_MS || 30000));
const explicitUsername = (process.env.TIKTOK_USERNAME || "").trim();

/** @type {Set<string>} */
const seenMessageIds = new Set();
/** @type {string[]} */
const seenQueue = [];
const maxSeenIds = 10000;

function rememberMessageId(id) {
  if (!id || seenMessageIds.has(id)) return;
  seenMessageIds.add(id);
  seenQueue.push(id);
  while (seenQueue.length > maxSeenIds) {
    const oldest = seenQueue.shift();
    if (oldest) seenMessageIds.delete(oldest);
  }
}

function isSeen(id) {
  return !!id && seenMessageIds.has(id);
}

async function loadState() {
  const response = await fetch(`${appBase}/api/tiktok/runtime/state`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Cannot load runtime state (${response.status})`);
  }
  const payload = await response.json();
  const seen = Array.isArray(payload?.data?.seen) ? payload.data.seen : [];
  for (const id of seen) rememberMessageId(String(id));
  console.log(`[tiktok-runtime] restored ids: ${seenQueue.length}`);
}

async function saveState() {
  const response = await fetch(`${appBase}/api/tiktok/runtime/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seen: seenQueue }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Cannot save runtime state (${response.status}): ${text.slice(0, 180)}`);
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatError(error) {
  if (!error) return "unknown error";
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isOfflineError(error) {
  const message = formatError(error).toLowerCase();
  return (
    message.includes("isn't online") ||
    message.includes("is not online") ||
    message.includes("user isn't online")
  );
}

function isExpectedConnectNoise(error) {
  const message = formatError(error).toLowerCase();
  return (
    message.includes("failed to retrieve room id") ||
    message.includes("error while connecting")
  );
}

async function fetchConnectionsConfig() {
  const response = await fetch(`${appBase}/api/connections`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cannot load /api/connections (${response.status})`);
  const data = await response.json();
  if (!data?.ok) throw new Error("Connections payload is not ok");
  return data.data || null;
}

async function fetchSetupConfig() {
  const response = await fetch(`${appBase}/api/setup`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cannot load /api/setup (${response.status})`);
  const data = await response.json();
  if (!data?.ok) throw new Error("Setup payload is not ok");
  return data.data || null;
}

function resolveUsername(connections) {
  const raw = explicitUsername || String(connections?.tiktokUsername || "").trim();
  return normalizeUsername(raw);
}

function normalizeUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/tiktok\.com\/@([^/?#]+)/i);
  const extracted = fromUrl?.[1] || raw;
  return extracted.replace(/^@+/, "").trim();
}

async function postTikTokEvent(payload) {
  const response = await fetch(`${appBase}/api/tiktok/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Forward failed (${response.status}): ${text.slice(0, 180)}`);
  }
}

function extractMessageId(data) {
  return String(
    data?.msgId ||
      data?.messageId ||
      data?.common?.msgId ||
      data?.common?.messageId ||
      data?.event?.msgId ||
      ""
  );
}

function extractGiftImageUrl(data) {
  const candidates = [
    data?.giftPictureUrl,
    data?.gift?.image?.url_list?.[0],
    data?.giftDetails?.giftImage?.url_list?.[0],
    data?.giftDetails?.giftPicture?.url_list?.[0],
    data?.giftDetails?.thumbnail?.url_list?.[0],
  ];
  for (const value of candidates) {
    const normalized = String(value || "").trim();
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      return normalized;
    }
  }
  return null;
}

function createHandlers(connection) {
  connection.on("gift", async (data) => {
    try {
      const msgId = extractMessageId(data);
      if (isSeen(msgId)) return;

      const giftType = toNumber(data?.giftType ?? data?.giftDetails?.giftType, 0);
      const repeatEnd = Boolean(data?.repeatEnd);
      if (giftType === 1 && !repeatEnd) return;

      const giftIdRaw =
        data?.giftId ||
        data?.giftDetails?.giftId ||
        data?.gift?.gift_id ||
        data?.gift?.id ||
        data?.giftDetails?.id ||
        `gift:${toNumber(data?.diamondCount ?? data?.giftDetails?.diamondCount, 0)}`;
      const giftId = String(giftIdRaw);
      const giftNameRaw =
        data?.giftName ||
        data?.giftDetails?.giftName ||
        data?.gift?.name ||
        data?.gift?.gift_name ||
        data?.giftDetails?.name;
      const giftName = String(giftNameRaw || `Gift ${giftId}`).trim() || `Gift ${giftId}`;
      const donorName = String(data?.nickname || data?.uniqueId || "TikTok Viewer").trim() || "TikTok Viewer";
      const coins = toNumber(data?.diamondCount ?? data?.giftDetails?.diamondCount, 0);
      const imageUrl = extractGiftImageUrl(data);

      await postTikTokEvent({
        type: "tiktok_donation",
        giftId,
        tiktokDonationName: giftName,
        coins,
        donorName,
        imageUrl: imageUrl || undefined,
      });

      if (msgId) {
        rememberMessageId(msgId);
        await saveState();
      }
      console.log(`[tiktok-runtime] tiktok_donation: ${donorName} -> ${giftName} (${coins})`);
    } catch (error) {
      console.error(`[tiktok-runtime] tiktok_donation error: ${formatError(error)}`);
    }
  });

  connection.on("social", async (data) => {
    try {
      const msgId = extractMessageId(data);
      if (isSeen(msgId)) return;
      const donorName = String(data?.nickname || data?.uniqueId || "TikTok Viewer").trim() || "TikTok Viewer";
      const displayType = String(data?.displayType || "").toLowerCase();

      if (displayType.includes("follow")) {
        // Keep follower event as a command-like trigger path for now.
        await postTikTokEvent({
          type: "command",
          donorName,
          commandText: "!follow",
        });
        if (msgId) {
          rememberMessageId(msgId);
          await saveState();
        }
        console.log(`[tiktok-runtime] follow: ${donorName}`);
      }
    } catch (error) {
      console.error(`[tiktok-runtime] social error: ${formatError(error)}`);
    }
  });

  connection.on("subscribe", async (data) => {
    try {
      const msgId = extractMessageId(data);
      if (isSeen(msgId)) return;

      const donorName = String(data?.nickname || data?.uniqueId || "TikTok Viewer").trim() || "TikTok Viewer";
      await postTikTokEvent({
        type: "subscribe",
        donorName,
      });

      if (msgId) {
        rememberMessageId(msgId);
        await saveState();
      }
      console.log(`[tiktok-runtime] subscribe: ${donorName}`);
    } catch (error) {
      console.error(`[tiktok-runtime] subscribe error: ${formatError(error)}`);
    }
  });

  connection.on("chat", async (data) => {
    try {
      const msgId = extractMessageId(data);
      if (isSeen(msgId)) return;

      const text = String(data?.comment || "").trim();
      if (!text.startsWith("!")) return;

      const donorName = String(data?.nickname || data?.uniqueId || "TikTok Viewer").trim() || "TikTok Viewer";
      await postTikTokEvent({
        type: "command",
        donorName,
        commandText: text.split(/\s+/)[0],
      });

      if (msgId) {
        rememberMessageId(msgId);
        await saveState();
      }
      console.log(`[tiktok-runtime] command: ${donorName} -> ${text}`);
    } catch (error) {
      console.error(`[tiktok-runtime] chat error: ${formatError(error)}`);
    }
  });

  connection.on("like", async (data) => {
    try {
      const msgId = extractMessageId(data);
      if (isSeen(msgId)) return;

      const donorName = String(data?.nickname || data?.uniqueId || "TikTok Viewer").trim() || "TikTok Viewer";
      const likeCount = Math.max(1, toNumber(data?.likeCount ?? data?.count, 1));

      await postTikTokEvent({
        type: "like",
        donorName,
        likeCount,
      });

      if (msgId) {
        rememberMessageId(msgId);
        await saveState();
      }
      console.log(`[tiktok-runtime] like: ${donorName} -> ${likeCount}`);
    } catch (error) {
      console.error(`[tiktok-runtime] like error: ${formatError(error)}`);
    }
  });

  connection.on("error", (error) => {
    if (isExpectedConnectNoise(error)) return;
    console.error(`[tiktok-runtime] connection error: ${formatError(error)}`);
  });

  connection.on("disconnected", () => {
    console.warn("[tiktok-runtime] disconnected");
  });
}

async function runConnectionLoop(username) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let connection;
    let useOfflineDelay = false;
    try {
      connection = new TikTokLiveConnection(username, {
        processInitialData: false,
        enableExtendedGiftInfo: true,
      });
      createHandlers(connection);

      console.log(`[tiktok-runtime] connecting to @${username}`);
      const state = await connection.connect();
      console.log(`[tiktok-runtime] connected roomId=${state?.roomId || "unknown"}`);

      await new Promise((resolve) => {
        connection.on("disconnected", resolve);
        connection.on("streamEnd", resolve);
      });
    } catch (error) {
      if (isOfflineError(error)) {
        useOfflineDelay = true;
        console.warn("[tiktok-runtime] stream is offline, waiting before reconnect...");
      } else {
        console.error(`[tiktok-runtime] connect failed: ${formatError(error)}`);
      }
    } finally {
      try {
        if (connection?.disconnect) connection.disconnect();
      } catch {
        // ignore
      }
    }

    const delay = useOfflineDelay ? offlineReconnectMs : reconnectMs;
    console.log(`[tiktok-runtime] reconnect in ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function waitForUsername() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const [connections, setup] = await Promise.all([fetchConnectionsConfig(), fetchSetupConfig()]);
      const parserEnabled = Boolean(setup?.parserEnabled);
      if (!parserEnabled) {
        console.warn("[tiktok-runtime] parser is disabled in Setup. Waiting...");
        await new Promise((resolve) => setTimeout(resolve, pollConfigMs));
        continue;
      }

      const username = resolveUsername(connections);
      if (username) return username;
      console.warn("[tiktok-runtime] tiktokUsername is empty in Connections. Waiting...");
    } catch (error) {
      console.error(`[tiktok-runtime] cannot read connections: ${formatError(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollConfigMs));
  }
}

async function main() {
  console.log("[tiktok-runtime] starting");
  console.log(`[tiktok-runtime] app api: ${appBase}`);
  if (explicitUsername) {
    console.log(`[tiktok-runtime] using TIKTOK_USERNAME: @${explicitUsername}`);
  } else {
    console.log("[tiktok-runtime] username source: /api/connections");
  }

  try {
    await loadState();
  } catch (error) {
    console.warn(`[tiktok-runtime] state restore skipped: ${formatError(error)}`);
  }

  const username = await waitForUsername();
  await runConnectionLoop(username);
}

void main();
