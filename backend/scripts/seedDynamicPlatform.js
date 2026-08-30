require("dotenv").config();
const mongoose = require("mongoose");
const CasinoContent = require("../database/models/CasinoContent");

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");
const base = { locale: "en", status: "published" };
const entries = [
  { type: "site-navigation", slug: "primary", title: "Primary navigation", order: 10, content: { items: [
    { label: "Casino", href: "/casino", icon: "fas fa-dice" }, { label: "Sports", href: "/sports", icon: "fas fa-futbol" },
    { label: "Bonuses", href: "/bonuses", icon: "fas fa-gift" }, { label: "Promotions", href: "/promotions", icon: "fas fa-fire" },
    { label: "VIP", href: "/vip", icon: "fas fa-crown" }, { label: "Crypto Earn", href: "/crypto-earn", icon: "fab fa-bitcoin" },
  ] } },
  { type: "site-footer", slug: "main", title: "Footer", order: 10, description: "Play responsibly. Terms and eligibility requirements apply.", content: { columns: [
    { title: "Casino", links: [{ label: "Games", href: "/casino" }, { label: "Promotions", href: "/promotions" }] },
    { title: "Account", links: [{ label: "Wallet", href: "/wallet" }, { label: "VIP Club", href: "/vip" }] },
    { title: "Support", links: [{ label: "Help Center", href: "/help" }, { label: "Responsible Gaming", href: "/responsible-gaming" }] },
  ] } },
  { type: "home-hero", slug: "main", title: "Play, compete and earn", subtitle: "Casino, sports and rewards in one account.", order: 10, cta: { label: "Explore games", href: "/casino" }, content: { badge: "Live platform" } },
  { type: "home-section", slug: "featured", title: "Featured Games", order: 10, content: { source: "games", filter: { featured: true }, limit: 12 } },
  { type: "home-section", slug: "popular", title: "Popular Games", order: 20, content: { source: "games", sort: "views", limit: 12 } },
  { type: "home-section", slug: "new-releases", title: "New Releases", order: 30, content: { source: "games", sort: "createdAt", limit: 12 } },
  { type: "casino-rail", slug: "originals", title: "Original Games", order: 10, content: { category: "originals", limit: 16 } },
  { type: "casino-rail", slug: "slots", title: "Slots", order: 20, content: { category: "slots", limit: 16 } },
  { type: "provider-showcase", slug: "providers", title: "Game Providers", order: 10, content: { source: "providers", limit: 30 } },
  { type: "battle-showcase", slug: "active-battles", title: "Active Battles", order: 10, content: { source: "battles", statuses: ["active", "scheduled"], limit: 8 } },
  { type: "help-article", slug: "responsible-gaming", title: "Responsible Gaming", order: 10, description: "Set limits, take breaks and only play with funds you can afford to lose." },
  { type: "help-article", slug: "account-security", title: "Account Security", order: 20, description: "Use a strong password and enable multi-factor authentication from account settings." },
  { type: "ui-copy", slug: "empty-states", title: "Empty states", order: 10, content: { noGames: "No games found.", noBets: "No settled bets yet.", unavailable: "This service is temporarily unavailable." } },
  { type: "referral-tier", slug: "direct", title: "Direct referrals", order: 10, description: "Commission from direct referrals", rules: { level: 1, casinoRate: 10, sportsRate: 5, minimumActivity: 0 } },
  { type: "referral-tier", slug: "network", title: "Network referrals", order: 20, description: "Commission from second-level referrals", rules: { level: 2, casinoRate: 3, sportsRate: 2, minimumActivity: 0 } },
  { type: "vip-faq", slug: "how-to-join", title: "How do I join the VIP Club?", order: 10, description: "Play eligible games and settled wagers automatically increase your VIP progress." },
  { type: "vip-faq", slug: "vip-progress", title: "Where can I see VIP progress?", order: 20, description: "Your current rank and progress are shown on the VIP Club page." },
  { type: "crypto-staking", slug: "bitcoin-flexible", title: "Bitcoin Flexible", category: "BTC", order: 10, rules: { apr: 4.5, lockDays: 0, minimum: 0.0001, maximum: 10 }, content: { symbol: "BTC", enabled: true } },
  { type: "crypto-staking", slug: "ethereum-30d", title: "Ethereum 30 Days", category: "ETH", order: 20, rules: { apr: 6.2, lockDays: 30, minimum: 0.001, maximum: 100 }, content: { symbol: "ETH", enabled: true } },
  { type: "crypto-swap", slug: "btc-usdt", title: "BTC / USDT", category: "BTC", order: 10, rules: { feePercent: 0.25, minimum: 0.0001, maximum: 2, precision: 8 }, content: { from: "BTC", to: "USDT", enabled: true } },
  { type: "crypto-swap", slug: "eth-usdt", title: "ETH / USDT", category: "ETH", order: 20, rules: { feePercent: 0.25, minimum: 0.001, maximum: 25, precision: 8 }, content: { from: "ETH", to: "USDT", enabled: true } },
  { type: "crypto-futures-display", slug: "markets", title: "Futures Markets", order: 10, content: { symbols: ["BTCUSDT", "ETHUSDT", "BNBUSDT"], refreshMs: 10000 } },
  { type: "crypto-lootbox-display", slug: "catalog", title: "Crypto Boxes", order: 10, content: { source: "boxes", limit: 12 } },
].map(entry => ({ ...base, ...entry }));

async function run() {
  if (!process.env.DATABASE_URI) throw new Error("DATABASE_URI is required");
  await mongoose.connect(process.env.DATABASE_URI);
  const operations = entries.map(entry => ({ updateOne: {
    filter: { type: entry.type, slug: entry.slug, locale: entry.locale },
    update: force ? { $set: entry } : { $setOnInsert: entry },
    upsert: true,
  } }));
  if (dryRun) {
    const keys = await CasinoContent.find({ $or: entries.map(({ type, slug, locale }) => ({ type, slug, locale })) }).select("type slug locale").lean();
    const existing = new Set(keys.map(item => `${item.type}:${item.slug}:${item.locale}`));
    const creates = entries.filter(item => !existing.has(`${item.type}:${item.slug}:${item.locale}`)).length;
    console.log(JSON.stringify({ dryRun: true, total: entries.length, creates, unchanged: entries.length - creates, force }, null, 2));
  } else {
    const result = await CasinoContent.bulkWrite(operations, { ordered: false });
    console.log(JSON.stringify({ total: entries.length, inserted: result.upsertedCount, modified: result.modifiedCount, force }, null, 2));
  }
  await mongoose.disconnect();
}
run().catch(async error => { console.error(error); await mongoose.disconnect().catch(() => {}); process.exit(1); });
