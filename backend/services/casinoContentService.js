const mongoose = require("mongoose");
const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const User = require("../database/models/User");
const { updateUserBalance } = require("../utils/wallet");

const PUBLIC_TYPES = new Set(["mission", "bonus", "promotion", "vip-benefit", "vip-manager", "vip-faq", "referral-tier", "home-section"]);
const MUTABLE_FIELDS = ["type", "slug", "title", "subtitle", "description", "image", "mobileImage", "category", "locale", "status", "startsAt", "endsAt", "order", "cta", "rules", "reward", "content"];

function pickContent(input = {}) {
  return MUTABLE_FIELDS.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = input[field];
    return result;
  }, {});
}

function validateContent(input, partial = false) {
  const errors = [];
  if (!partial || input.type !== undefined) if (!PUBLIC_TYPES.has(input.type)) errors.push("Invalid content type");
  if (!partial || input.slug !== undefined) if (!String(input.slug || "").trim()) errors.push("Slug is required");
  if (!partial || input.title !== undefined) if (!String(input.title || "").trim()) errors.push("Title is required");
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) errors.push("endsAt must be after startsAt");
  if (input.reward?.amount != null && (!Number.isFinite(Number(input.reward.amount)) || Number(input.reward.amount) < 0)) errors.push("Reward amount is invalid");
  return errors;
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

module.exports = { PUBLIC_TYPES, pickContent, validateContent, visibilityQuery, listPublished, joinContent, claimContent };
