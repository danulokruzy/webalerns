const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function upsertSetting(key, value) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function main() {
  const adminPassword = process.env.DASHBOARD_PASSWORD || "donatelko";

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: sha256(adminPassword),
    },
  });

  const settingsCount = await prisma.paymentSettings.count();
  if (settingsCount === 0) {
    await prisma.paymentSettings.create({
      data: {
        minAmountUah: 1,
        maxAmountUah: 10000,
        paymentMemoPrefix: "DON",
        confirmationMode: "semi_auto",
        usdtToUahFallback: 40,
        tonToUahFallback: 250,
      },
    });
  }

  const connectionCount = await prisma.connection.count();
  if (connectionCount === 0) {
    await prisma.connection.create({ data: {} });
  }

  const presetDefaults = [
    {
      slug: "last-donations",
      name: "Останні донати",
      settingsJson: JSON.stringify({ limit: 20, compact: false, showChannel: true }),
    },
    {
      slug: "top-donors",
      name: "Топ 3 донатерів",
      settingsJson: JSON.stringify({ period: "all", limit: 3 }),
    },
    {
      slug: "alerts-feed",
      name: "Стрічка алертів",
      settingsJson: JSON.stringify({ limit: 30, includeFake: true, animation: "slide" }),
    },
    {
      slug: "fake-battle",
      name: "Фейк батл",
      settingsJson: JSON.stringify({ enabled: true, limit: 20 }),
    },
  ];

  for (const preset of presetDefaults) {
    await prisma.widgetPreset.upsert({
      where: { slug: preset.slug },
      update: {},
      create: preset,
    });
  }

  await upsertSetting("dashboardLocale", "uk");
  await upsertSetting("authCookieName", "dk_admin");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
