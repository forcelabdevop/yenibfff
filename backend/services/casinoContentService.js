const mongoose = require("mongoose");
const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const User = require("../database/models/User");
const { updateUserBalance } = require("../utils/wallet");

const PUBLIC_TYPES = new Set([
  "mission", "bonus", "promotion", "vip-benefit", "vip-manager", "vip-faq", "referral-tier",
  "site-navigation", "site-footer", "help-article", "home-hero", "home-section", "casino-rail",
  "provider-showcase", "battle-showcase", "ui-copy", "crypto-staking", "crypto-swap",
  "crypto-futures-display", "crypto-lootbox-display",
]);
const MUTABLE_FIELDS = ["type", "slug", "title", "subtitle", "description", "image", "mobileImage", "category", "locale", "status", "startsAt", "endsAt", "order", "cta", "rules", "reward", "content"];

function pickContent(input = {}) {
  return MUTABLE_FIELDS.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = input[field];
    return result;
  }, {});
}

const TYPE_REQUIREMENTS = {
  mission: [["rules.eventType", "Event type"], ["rules.target", "Target"]],
  "site-navigation": [["content.href", "Navigation URL"]],
  "help-article": [["content.answer", "Article answer"]],
  "provider-showcase": [["content.providerCode", "Provider code"]],
  "ui-copy": [["content.namespace", "Namespace"]],
  "crypto-staking": [["content.coin", "Coin"]],
  "crypto-swap": [["content.fromCoin", "Source coin"], ["content.toCoin", "Target coin"]],
  "crypto-futures-display": [["content.symbol", "Market symbol"]],
  "crypto-lootbox-display": [["content.boxId", "Box id"]],
};
const valueAt = (input, path) => path.split(".").reduce((value, key) => value?.[key], input);
const isMissing = (value) => value === undefined || value === null || value === "";

function validateContent(input, partial = false) {
  const errors = [];
  if (!partial || input.type !== undefined) if (!PUBLIC_TYPES.has(input.type)) errors.push("Invalid content type");
  if (!partial || input.slug !== undefined) if (!String(input.slug || "").trim()) errors.push("Slug is required");
  if (!partial || input.title !== undefined) if (!String(input.title || "").trim()) errors.push("Title is required");
  if (input.startsAt && Number.isNaN(new Date(input.startsAt).getTime())) errors.push("startsAt is invalid");
  if (input.endsAt && Number.isNaN(new Date(input.endsAt).getTime())) errors.push("endsAt is invalid");
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) errors.push("endsAt must be after startsAt");
  if (input.status === "scheduled" && !input.startsAt) errors.push("startsAt is required for scheduled content");
  if (input.reward?.amount != null && (!Number.isFinite(Number(input.reward.amount)) || Number(input.reward.amount) < 0)) errors.push("Reward amount is invalid");
  if (input.cta?.href && !/^(\/|https?:\/\/)/i.test(String(input.cta.href))) errors.push("CTA URL must be relative or HTTP(S)");
  const requirements = TYPE_REQUIREMENTS[input.type] || [];
  for (const [path, label] of requirements) {
    const value = valueAt(input, path);
    if (!partial && isMissing(value)) errors.push(`${label} is required`);
    if (path === "rules.target" && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 1)) errors.push("Target must be at least 1");
  }
  const minimum = Number(input.content?.minimum);
  const maximum = Number(input.content?.maximum);
  if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) errors.push("Maximum must be greater than or equal to minimum");
  for (const rate of [input.content?.commissionRate, input.content?.fee, input.content?.apr]) {
    if (rate !== undefined && (!Number.isFinite(Number(rate)) || Number(rate) < 0)) errors.push("Rate must be a positive number");
  }
  return [...new Set(errors)];
}

function visibilityQuery(type, locale = "en", now = new Date()) {
  const query = {
    type,
    status: "published",
    locale: { $in: [locale, "en"] },
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  };
  return query;
}

async function listPublished({ type, locale, userId }) {
  if (!PUBLIC_TYPES.has(type)) throw Object.assign(new Error("Invalid content type"), { status: 400 });
  const items = await CasinoContent.find(visibilityQuery(type, locale)).sort({ order: 1, createdAt: -1 }).lean();
  if (!userId || !items.length) return items.map((item) => ({ ...item, userState: null }));
  const states = await CasinoUserState.find({ user: userId, content: { $in: items.map((item) => item._id) } }).lean();
  const stateMap = new Map(states.map((state) => [String(state.content), state]));
  return items.map((item) => ({ ...item, userState: stateMap.get(String(item._id)) || null }));
}

async function joinContent({ userId, contentId }) {
  if (!mongoose.isValidObjectId(contentId)) throw Object.assign(new Error("Invalid content id"), { status: 400 });
  const content = await CasinoContent.findOne({ _id: contentId, ...visibilityQuery("mission") });
  if (!content) throw Object.assign(new Error("Mission not found or unavailable"), { status: 404 });
  const target = Math.max(1, Number(content.rules?.target || 1));
  return CasinoUserState.findOneAndUpdate(
    { user: userId, content: content._id, periodKey: "lifetime" },
    { $setOnInsert: { kind: "mission", status: "joined", progress: 0, target, joinedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function recordMissionEvent({ userId, eventType, eventKey, amount = 1, gameCode = "", providerCode = "", category = "" }) {
  if (!userId || !eventType || !eventKey) return { matched: 0, completed: 0 };
  const increment = Math.max(0, Number(amount) || 0);
  if (!increment) return { matched: 0, completed: 0 };

  const missions = await CasinoContent.find(visibilityQuery("mission")).select("rules").lean();
  let matched = 0;
  let completed = 0;
  for (const mission of missions) {
    const rules = mission.rules || {};
    if (rules.eventType && rules.eventType !== eventType) continue;
    if (rules.gameCodes?.length && !rules.gameCodes.includes(gameCode)) continue;
    if (rules.providerCodes?.length && !rules.providerCodes.includes(providerCode)) continue;
    if (rules.categories?.length && !rules.categories.includes(category)) continue;
    if (Number(rules.minimumAmount || 0) > increment) continue;

    const state = await CasinoUserState.findOne({ user: userId, content: mission._id, periodKey: "lifetime", status: { $in: ["joined", "active"] } });
    if (!state || state.processedEvents.includes(eventKey)) continue;
    matched += 1;
    state.processedEvents.push(eventKey);
    state.progress = Math.min(state.target, state.progress + increment);
    state.status = state.progress >= state.target ? "completed" : "active";
    if (state.status === "completed" && !state.completedAt) {
      state.completedAt = new Date();
      completed += 1;
    }
    await state.save();
  }
  return { matched, completed };
}

async function claimContent({ userId, contentId, idempotencyKey }) {
  if (!mongoose.isValidObjectId(contentId)) throw Object.assign(new Error("Invalid content id"), { status: 400 });
  if (!String(idempotencyKey || "").trim()) throw Object.assign(new Error("Idempotency-Key header is required"), { status: 400 });
  const content = await CasinoContent.findById(contentId);
  if (!content || !content.isVisibleAt()) throw Object.assign(new Error("Content not available"), { status: 404 });
  if (!["mission", "bonus"].includes(content.type)) throw Object.assign(new Error("Content cannot be claimed"), { status: 400 });

  const query = { user: userId, content: content._id, periodKey: "lifetime" };
  let state = await CasinoUserState.findOne(query);
  if (!state && content.type === "bonus") {
    state = await CasinoUserState.create({ ...query, kind: "bonus", status: "completed", progress: 1, target: 1, completedAt: new Date() });
  }
  if (!state || (content.type === "mission" && state.progress < state.target && state.status !== "completed")) {
    throw Object.assign(new Error("Requirements are not completed"), { status: 409 });
  }
  if (state.status === "claimed") return { state, duplicate: true };

  const reserved = await CasinoUserState.findOneAndUpdate(
    { _id: state._id, status: { $ne: "claimed" }, idempotencyKey: null },
    { $set: { status: "claimed", claimedAt: new Date(), idempotencyKey, rewardSnapshot: content.reward || {} } },
    { new: true }
  );
  if (!reserved) {
    const existing = await CasinoUserState.findOne(query);
    if (existing?.status === "claimed") return { state: existing, duplicate: true };
    throw Object.assign(new Error("Claim is already being processed"), { status: 409 });
  }

  try {
    if (content.reward?.type === "balance" && Number(content.reward.amount) > 0) {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");
      const result = await updateUserBalance(user, Number(content.reward.amount));
      if (result === false) throw new Error("Wallet credit failed");
    }
    return { state: reserved, duplicate: false };
  } catch (error) {
    await CasinoUserState.updateOne({ _id: reserved._id, idempotencyKey }, { $set: { status: "completed", claimedAt: null, idempotencyKey: null } });
    throw error;
  }
}

module.exports = { PUBLIC_TYPES, pickContent, validateContent, visibilityQuery, listPublished, joinContent, recordMissionEvent, claimContent };
