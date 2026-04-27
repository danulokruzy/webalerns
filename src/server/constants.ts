export const CHECK_LIFETIME_MS = 10 * 60 * 1000;
export const DASHBOARD_COOKIE = "dk_admin";
export const BRIDGE_TOKEN_LENGTH = 32;

export const DEFAULT_WIDGET_PRESETS = [
  {
    slug: "last-donations",
    name: "Останні донати",
    settings: {
      limit: 20,
      compact: false,
      showChannel: true,
      showMessage: true,
    },
  },
  {
    slug: "top-donors",
    name: "Топ 3 донатерів",
    settings: {
      limit: 3,
      period: "all",
      showAmount: true,
    },
  },
  {
    slug: "alerts-feed",
    name: "Стрічка алертів",
    settings: {
      limit: 30,
      includeFake: true,
      animation: "slide",
      displayMs: 7000,
    },
  },
  {
    slug: "donation-alert",
    name: "Донат алерт",
    settings: {
      limit: 30,
      includeFake: true,
      animation: "pop",
      displayMs: 7000,
      notificationType: "donation",
    },
  },
  {
    slug: "tiktok-alert",
    name: "TikTok алерт",
    settings: {
      limit: 30,
      includeFake: false,
      animation: "pop",
      displayMs: 7000,
      notificationType: "tiktok_donation",
    },
  },
  {
    slug: "fake-battle",
    name: "Фейк батл",
    settings: {
      enabled: true,
      limit: 20,
      showTop3: true,
    },
  },
] as const;

