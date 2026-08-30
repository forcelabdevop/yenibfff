require("dotenv").config();
const mongoose = require("mongoose");
const CasinoContent = require("../database/models/CasinoContent");
const Mission = require("../database/models/Mission");
const Bonus = require("../database/models/Bonus");
const Promotion = require("../database/models/Promotion");

const slugify = (value) => String(value || "content").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function upsert(entry) {
  return CasinoContent.updateOne(
    { type: entry.type, slug: entry.slug, locale: entry.locale || "en" },
    { $setOnInsert: { ...entry, locale: entry.locale || "en" } },
    { upsert: true }
  );
}

async function migrateLegacy() {
  const [missions, bonuses, promotions] = await Promise.all([
    Mission.find({}).lean(), Bonus.find({}).lean(), Promotion.find({}).lean(),
  ]);
  for (const mission of missions) await upsert({
    type: "mission", slug: slugify(mission.name), title: mission.name, description: mission.description,
    image: mission.img || "", status: "published", startsAt: mission.startDate, endsAt: mission.endDate,
    rules: { target: mission.targetValue, eventType: mission.missionType, game: mission.gameSpecific || null },
    reward: { type: mission.tokenReward > 0 ? "balance" : "xp", amount: mission.tokenReward || mission.xpReward || 0, currency: "USD" },
  });
  for (const bonus of bonuses) await upsert({
    type: "bonus", slug: slugify(`${bonus.title}-${bonus._id}`), title: bonus.title, description: bonus.description,
    image: bonus.img || "", category: bonus.bonusType, status: "published",
    rules: { percentage: bonus.percentage }, reward: { type: "bonus", amount: Number(bonus.percentage || 0), currency: "USD" },
    content: { modalDescription: bonus.modalDescription || "" },
  });
  for (const promotion of promotions) await upsert({
    type: "promotion", slug: slugify(`${promotion.title}-${promotion._id}`), title: promotion.title,
    subtitle: promotion.subtitle || "", image: promotion.banner || "", category: promotion.category || "",
    description: promotion.content || "", status: promotion.active === false ? "archived" : "published", order: promotion.order || 0,
  });
}

async function seedPageContent() {
  const entries = [
    { type: "home-section", slug: "featured", title: "Featured Games", status: "published", order: 10, content: { mode: "dynamic", limit: 12, query: { featured: true } } },
    { type: "home-section", slug: "popular", title: "Popular Games", status: "published", order: 20, content: { mode: "dynamic", limit: 12, sort: "views" } },
    { type: "home-section", slug: "new-releases", title: "New Releases", status: "published", order: 30, content: { mode: "dynamic", limit: 12, sort: "createdAt" } },
    { type: "referral-tier", slug: "direct", title: "Direct referrals", description: "Commission from direct referrals", status: "published", order: 10, rules: { level: 1, casinoRate: 10, sportsRate: 5, depositRate: 0, minimumActivity: 0 } },
    { type: "referral-tier", slug: "network", title: "Network referrals", description: "Commission from second-level referrals", status: "published", order: 20, rules: { level: 2, casinoRate: 3, sportsRate: 2, depositRate: 0, minimumActivity: 0 } },
    { type: "vip-faq", slug: "how-to-join", title: "How do I join the VIP Club?", description: "Play eligible games and your settled wager automatically increases your VIP progress.", status: "published", order: 10 },
    { type: "vip-faq", slug: "vip-progress", title: "Where can I see my VIP progress?", description: "Your current rank and progress are shown on the VIP Club page.", status: "published", order: 20 },
  ];
  for (const entry of entries) await upsert(entry);
}

async function main() {
  if (!process.env.DATABASE_URI) throw new Error("DATABASE_URI is required");
  await mongoose.connect(process.env.DATABASE_URI);
  await migrateLegacy();
  await seedPageContent();
  console.log("Casino content migration completed");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
