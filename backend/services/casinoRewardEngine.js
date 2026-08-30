// 🎰 Casino ödül motoru
// Tek giriş noktası: recordEvent(). Login / deposit / wager / win / game-round
// olaylarını alır, yayınlanmış mission kayıtlarının ilerlemesini artırır,
// special bonus kayıtlarının yatırım uygunluğunu değerlendirir ve
// free-spin teslimlerini (Betinovi ApplyFreeRound) idempotent biçimde yürütür.

const mongoose = require("mongoose");
const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const FreeSpinGrant = require("../database/models/FreeSpinGrant");
const CasinoRewardEvent = require("../database/models/CasinoRewardEvent");
const User = require("../database/models/User");
const { updateUserBalance } = require("../utils/wallet");
const { periodKeyFor } = require("./casinoRewardSchema");

const MAX_DELIVERY_ATTEMPTS = 6;
const BACKOFF_BASE_MS = 60 * 1000;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const upper = (value) => String(value || "").toUpperCase();

function publishedQuery(type, now = new Date()) {
  return {
    type,
    status: "published",
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  };
}

function backoffDelay(attempts) {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------- filtreler

function matchesFilters(rules = {}, event = {}) {
  const gameCodes = rules.gameCodes || [];
  const providerCodes = rules.providerCodes || [];
  const categories = rules.categories || [];
  if (gameCodes.length && !gameCodes.includes(event.gameCode)) return false;
  if (providerCodes.length && !providerCodes.includes(event.providerCode)) return false;
  if (categories.length && !categories.includes(event.category)) return false;
  if (rules.metric === "amount" && rules.currency && event.currency && upper(rules.currency) !== upper(event.currency)) return false;
  if (toNumber(rules.minimumAmount) > 0 && toNumber(event.amount) < toNumber(rules.minimumAmount)) return false;
  return true;
}

async function globalLimitReached(contentId, limit) {
  if (!limit) return false;
  const used = await CasinoUserState.countDocuments({ content: contentId, status: { $in: ["claimed", "completed", "eligible", "wagering", "delivery-pending"] } });
  return used >= limit;
}

async function perUserLimitReached(userId, contentId, limit) {
  if (!limit) return false;
  const used = await CasinoUserState.countDocuments({ user: userId, content: contentId, status: "claimed" });
  return used >= limit;
}

// ------------------------------------------------------------ mission akışı

async function ensureMissionState({ userId, mission, periodKey }) {
  const rules = mission.rules || {};
  const target = Math.max(1, toNumber(rules.target, 1));
  const existing = await CasinoUserState.findOne({ user: userId, content: mission._id, periodKey });
  if (existing) return existing;
  // Otomatik katılım kapalıysa, kullanıcının bu göreve daha önce katılmış olması gerekir.
  if (!rules.autoJoin) {
    const enrolled = await CasinoUserState.exists({ user: userId, content: mission._id });
    if (!enrolled) return null;
  }
  try {
    return await CasinoUserState.create({
      user: userId, content: mission._id, kind: "mission", status: "active",
      progress: 0, target, periodKey, joinedAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) return CasinoUserState.findOne({ user: userId, content: mission._id, periodKey });
    throw error;
  }
}

async function applyMissionEvent({ userId, event, mission }) {
  const rules = mission.rules || {};
  if (rules.eventType !== event.eventType) return null;
  if (!matchesFilters(rules, event)) return null;
  if (await perUserLimitReached(userId, mission._id, rules.perUserLimit)) return null;
  if (await globalLimitReached(mission._id, rules.globalLimit)) return null;

  const periodKey = periodKeyFor(rules.period, event.occurredAt);
  const state = await ensureMissionState({ userId, mission, periodKey });
  if (!state || ["claimed", "expired", "rejected"].includes(state.status)) return null;

  const increment = rules.metric === "amount" ? toNumber(event.amount) : 1;
  if (increment <= 0) return null;

  // Idempotency: aynı eventKey iki kez ilerleme üretemez.
  const updated = await CasinoUserState.findOneAndUpdate(
    { _id: state._id, processedEvents: { $ne: event.eventKey }, status: { $in: ["joined", "active"] } },
    { $inc: { progress: increment }, $addToSet: { processedEvents: event.eventKey } },
    { new: true }
  );
  if (!updated) return null;

  const target = Math.max(1, toNumber(updated.target, 1));
  if (updated.progress >= target) {
    await CasinoUserState.updateOne(
      { _id: updated._id, status: { $in: ["joined", "active"] } },
      { $set: { progress: target, status: "completed", completedAt: new Date() } }
    );
    return { state: updated._id, completed: true };
  }
  return { state: updated._id, completed: false };
}

// -------------------------------------------------------- special bonus akışı

async function selectBonus({ userId, contentId }) {
  if (!mongoose.isValidObjectId(contentId)) throw Object.assign(new Error("Invalid bonus id"), { status: 400 });
  const bonus = await CasinoContent.findOne({ _id: contentId, ...publishedQuery("bonus") }).lean();
  if (!bonus) throw Object.assign(new Error("Bonus is not available"), { status: 404 });

  const rules = bonus.rules || {};
  const periodKey = periodKeyFor(rules.period);
  if (await perUserLimitReached(userId, bonus._id, rules.perUserLimit)) {
    throw Object.assign(new Error("You have already used this bonus"), { status: 409 });
  }
  if (await globalLimitReached(bonus._id, rules.globalLimit)) {
    throw Object.assign(new Error("This bonus has reached its global limit"), { status: 409 });
  }

  const open = await CasinoUserState.findOne({
    user: userId, content: bonus._id, periodKey,
    status: { $in: ["awaiting-deposit", "eligible", "delivery-pending", "wagering", "active"] },
  });
  if (open) return { state: open, duplicate: true };

  const windowHours = Math.max(0, toNumber(rules.windowHours, 48));
  const instant = rules.activation === "instant";
  const payload = {
    user: userId, content: bonus._id, kind: "bonus",
    status: instant ? "eligible" : "awaiting-deposit",
    progress: 0, target: 1, periodKey, joinedAt: new Date(),
    expiresAt: windowHours ? new Date(Date.now() + windowHours * 3600000) : null,
    rewardSnapshot: bonus.reward || {},
    metadata: { activation: rules.activation, selectedAt: new Date().toISOString() },
  };

  let state;
  try {
    state = await CasinoUserState.create(payload);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    state = await CasinoUserState.findOneAndUpdate(
      { user: userId, content: bonus._id, periodKey, status: { $in: ["expired", "rejected", "claimed"] } },
      { $set: { ...payload, processedEvents: [], deliveryAttempts: 0, lastDeliveryError: "", triggerEventKey: null, claimedAt: null, completedAt: null } },
      { new: true }
    );
    if (!state) throw Object.assign(new Error("Bonus is already selected"), { status: 409 });
  }

  if (instant) await deliverBonus({ state, content: bonus });
  return { state: await CasinoUserState.findById(state._id), duplicate: false };
}

function depositMatchesBonus(rules = {}, event = {}, state) {
  const amount = toNumber(event.amount);
  if (toNumber(rules.minimumDeposit) > 0 && amount < toNumber(rules.minimumDeposit)) return "Deposit amount is below the minimum";
  if (toNumber(rules.maximumDeposit) > 0 && amount > toNumber(rules.maximumDeposit)) return "Deposit amount is above the maximum";
  if ((rules.currencies || []).length && !rules.currencies.includes(upper(event.currency))) return "Deposit currency is not eligible";
  if (rules.depositSequence > 0 && toNumber(event.depositSequence, 0) !== rules.depositSequence) return "Deposit order does not match";
  if (state.expiresAt && state.expiresAt.getTime() < Date.now()) return "Bonus selection window has expired";
  return null;
}

async function activateBonusesForDeposit({ userId, event }) {
  const pending = await CasinoUserState.find({ user: userId, kind: "bonus", status: "awaiting-deposit" }).sort({ createdAt: 1 });
  if (!pending.length) return [];
  const contents = await CasinoContent.find({ _id: { $in: pending.map((state) => state.content) } }).lean();
  const contentMap = new Map(contents.map((item) => [String(item._id), item]));
  const results = [];

  for (const state of pending) {
    const content = contentMap.get(String(state.content));
    if (!content) continue;
    const rules = content.rules || {};
    if (rules.activation !== "deposit") continue;

    if (state.expiresAt && state.expiresAt.getTime() < Date.now()) {
      await CasinoUserState.updateOne({ _id: state._id, status: "awaiting-deposit" }, { $set: { status: "expired" } });
      continue;
    }
    const rejection = depositMatchesBonus(rules, event, state);
    if (rejection) { results.push({ content: content._id, skipped: rejection }); continue; }
    if (await globalLimitReached(content._id, rules.globalLimit)) { results.push({ content: content._id, skipped: "global limit" }); continue; }

    // Aynı yatırım iki kez ödül üretemez: triggerEventKey atomik olarak rezerve edilir.
    const activated = await CasinoUserState.findOneAndUpdate(
      { _id: state._id, status: "awaiting-deposit", triggerEventKey: null },
      {
        $set: {
          status: "eligible",
          triggerEventKey: event.eventKey,
          rewardSnapshot: content.reward || {},
          expiresAt: rules.activeHours ? new Date(Date.now() + toNumber(rules.activeHours, 72) * 3600000) : null,
        },
        $addToSet: { processedEvents: event.eventKey },
        $inc: { progress: 0 },
      },
      { new: true }
    );
    if (!activated) continue;
    activated.metadata = { ...(activated.metadata || {}), depositAmount: toNumber(event.amount), depositCurrency: upper(event.currency), depositReference: event.reference || "" };
    await activated.save();
    const delivery = await deliverBonus({ state: activated, content });
    results.push({ content: content._id, delivered: delivery.delivered, error: delivery.error || null });
    break; // aynı yatırımla yalnızca tek bir special bonus aktive edilir
  }
  return results;
}

// -------------------------------------------------------------- ödül teslimi

async function applyFreeSpins({ userId, content, state }) {
  const reward = content.reward || {};
  const deliveryKey = `state:${state._id}`;
  const existing = await FreeSpinGrant.findOne({ deliveryKey });
  if (existing?.deliveryStatus === "delivered") return { delivered: true, duplicate: true };

  const expireHours = Math.max(1, toNumber(reward.expireHours, 72));
  const payload = {
    userCode: String(userId),
    vendorCode: reward.providerCode,
    gameCode: reward.gameCode,
    currencyCode: upper(reward.currency || "TRY"),
    betAmount: toNumber(reward.betAmount),
    spinCount: Math.trunc(toNumber(reward.spinCount)),
    expireHours,
  };

  // Servis modülü lazily yüklenir; testlerde ve provider yapılandırması olmayan
  // ortamlarda import zinciri patlamasın diye burada require edilir.
  const { betinoviAdminRequest } = require("./betinoviAdminApiService");
  const providerResponse = await betinoviAdminRequest("controlGame", "ApplyFreeRound", payload);

  // Sağlayıcı HTTP 200 dönüp gövdede hata bildirebilir (status !== 0). Bu durumda
  // teslim başarılı sayılmaz; kayıt kuyrukta kalır ve backoff ile yeniden denenir.
  const providerStatus = Number(providerResponse?.status);
  if (Number.isFinite(providerStatus) && providerStatus !== 0) {
    throw new Error(`ApplyFreeRound rejected (status ${providerStatus}): ${providerResponse?.msg || "unknown"}`);
  }

  await FreeSpinGrant.findOneAndUpdate(
    { deliveryKey },
    {
      $set: {
        targetUser: userId, actorUser: null,
        vendorCode: payload.vendorCode, gameCode: payload.gameCode, currencyCode: payload.currencyCode,
        betAmount: payload.betAmount, spinCount: payload.spinCount, expireHours,
        expiresAt: new Date(Date.now() + expireHours * 3600000),
        providerResponse, source: "bonus", sourceContent: content._id, sourceState: state._id,
        deliveryStatus: "delivered", lastError: "",
      },
      $inc: { attempts: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { delivered: true, providerResponse };
}

async function creditReward({ userId, content, state }) {
  const reward = content.reward || {};
  if (reward.type === "balance" && toNumber(reward.amount) > 0) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    const result = await updateUserBalance(user, toNumber(reward.amount), { emitSocket: true });
    if (result === false) throw new Error("Wallet credit failed");
    return { delivered: true };
  }
  if (reward.type === "xp" && toNumber(reward.amount) > 0) {
    await User.updateOne({ _id: userId }, { $inc: { xp: toNumber(reward.amount) } });
    return { delivered: true };
  }
  if (reward.type === "free-spins") return applyFreeSpins({ userId, content, state });
  if (reward.type === "bonus") {
    // Çevrimli bonus: gerçek bakiyeye yazılmaz, ayrı kilitli bakiye olarak izlenir.
    const rules = content.rules || {};
    const amount = Math.min(toNumber(reward.amount), toNumber(rules.maxBonusAmount) || toNumber(reward.amount));
    const wagerTarget = amount * Math.max(1, toNumber(reward.wageringMultiplier || rules.wagerMultiplier, 1));
    await CasinoUserState.updateOne({ _id: state._id }, {
      $set: {
        status: "wagering", target: wagerTarget, progress: 0,
        metadata: { ...(state.metadata || {}), bonusBalance: amount, wagerTarget, lockedAt: new Date().toISOString() },
      },
    });
    return { delivered: true, wagering: true };
  }
  return { delivered: true, noop: true };
}

async function deliverBonus({ state, content }) {
  const userId = state.user;
  try {
    const result = await creditReward({ userId, content, state });
    if (result.wagering) return { delivered: true };
    await CasinoUserState.updateOne({ _id: state._id }, {
      $set: { status: "claimed", claimedAt: new Date(), deliveredAt: new Date(), completedAt: new Date(), progress: state.target || 1, lastDeliveryError: "", nextDeliveryAt: null },
    });
    return { delivered: true };
  } catch (error) {
    const attempts = toNumber(state.deliveryAttempts) + 1;
    const failed = attempts >= MAX_DELIVERY_ATTEMPTS;
    await CasinoUserState.updateOne({ _id: state._id }, {
      $set: {
        status: failed ? "delivery-failed" : "delivery-pending",
        deliveryAttempts: attempts,
        lastDeliveryError: String(error.message || error).slice(0, 500),
        nextDeliveryAt: failed ? null : new Date(Date.now() + backoffDelay(attempts)),
      },
    });
    await FreeSpinGrant.updateOne({ deliveryKey: `state:${state._id}` }, { $set: { deliveryStatus: failed ? "failed" : "pending", lastError: String(error.message || error).slice(0, 500) } });
    console.error("[casinoRewardEngine] bonus delivery failed:", error.message);
    return { delivered: false, error: error.message };
  }
}

// Kuyruktaki başarısız teslimleri yeniden dener (cron veya admin tetikler).
async function processDeliveryQueue({ limit = 25 } = {}) {
  const due = await CasinoUserState.find({ status: "delivery-pending", nextDeliveryAt: { $lte: new Date() } }).limit(limit);
  if (!due.length) return { processed: 0, delivered: 0 };
  const contents = await CasinoContent.find({ _id: { $in: due.map((state) => state.content) } }).lean();
  const contentMap = new Map(contents.map((item) => [String(item._id), item]));
  let delivered = 0;
  for (const state of due) {
    const content = contentMap.get(String(state.content));
    if (!content) continue;
    const result = await deliverBonus({ state, content });
    if (result.delivered) delivered += 1;
  }
  return { processed: due.length, delivered };
}

// Süresi dolan bonus seçimlerini ve çevrim pencerelerini kapatır. Teslim edilmiş
// ("claimed") kayıtlara dokunmaz; yalnızca hâlâ bekleyen kayıtları sonlandırır.
async function expireStaleStates() {
  const now = new Date();
  const result = await CasinoUserState.updateMany(
    { kind: "bonus", status: { $in: ["awaiting-deposit", "eligible", "wagering"] }, expiresAt: { $ne: null, $lte: now } },
    { $set: { status: "expired", nextDeliveryAt: null } }
  );
  return { expired: result.modifiedCount || 0 };
}

async function retryDelivery({ stateId }) {
  const state = await CasinoUserState.findById(stateId);
  if (!state) throw Object.assign(new Error("State not found"), { status: 404 });
  if (!["delivery-pending", "delivery-failed", "eligible"].includes(state.status)) {
    throw Object.assign(new Error("This record is not awaiting delivery"), { status: 409 });
  }
  const content = await CasinoContent.findById(state.content).lean();
  if (!content) throw Object.assign(new Error("Content not found"), { status: 404 });
  return deliverBonus({ state, content });
}

async function cancelDelivery({ stateId, reason = "" }) {
  const state = await CasinoUserState.findOneAndUpdate(
    { _id: stateId, status: { $in: ["delivery-pending", "delivery-failed", "awaiting-deposit", "eligible"] } },
    { $set: { status: "rejected", nextDeliveryAt: null, lastDeliveryError: String(reason || "Cancelled by admin").slice(0, 500) } },
    { new: true }
  );
  if (!state) throw Object.assign(new Error("This record cannot be cancelled"), { status: 409 });
  await FreeSpinGrant.updateOne({ deliveryKey: `state:${state._id}` }, { $set: { deliveryStatus: "failed", lastError: "cancelled" } });
  return state;
}

// ------------------------------------------------------------ çevrim ilerleme

async function applyWagerProgress({ userId, event }) {
  const states = await CasinoUserState.find({ user: userId, kind: "bonus", status: "wagering" });
  if (!states.length) return [];
  const contents = await CasinoContent.find({ _id: { $in: states.map((state) => state.content) } }).lean();
  const contentMap = new Map(contents.map((item) => [String(item._id), item]));
  const results = [];

  for (const state of states) {
    const content = contentMap.get(String(state.content));
    if (!content) continue;
    const rules = content.rules || {};
    const bet = toNumber(event.amount);
    if (rules.wagerMinBet && bet < rules.wagerMinBet) continue;
    if (rules.wagerMaxBet && bet > rules.wagerMaxBet) continue;
    if ((rules.wagerCategories || []).length && !rules.wagerCategories.includes(event.category)) continue;

    const updated = await CasinoUserState.findOneAndUpdate(
      { _id: state._id, status: "wagering", processedEvents: { $ne: event.eventKey } },
      { $inc: { progress: bet }, $addToSet: { processedEvents: event.eventKey } },
      { new: true }
    );
    if (!updated) continue;
    if (updated.progress >= updated.target && updated.target > 0) {
      const bonusBalance = toNumber(updated.metadata?.bonusBalance);
      const user = await User.findById(userId);
      if (user && bonusBalance > 0) await updateUserBalance(user, bonusBalance, { emitSocket: true });
      await CasinoUserState.updateOne({ _id: updated._id, status: "wagering" }, {
        $set: { status: "claimed", progress: updated.target, completedAt: new Date(), claimedAt: new Date(), deliveredAt: new Date() },
      });
      results.push({ content: content._id, released: bonusBalance });
    }
  }
  return results;
}

// ------------------------------------------------------------------ giriş noktası

async function recordEvent(input = {}) {
  const event = {
    eventType: String(input.eventType || ""),
    eventKey: String(input.eventKey || ""),
    amount: toNumber(input.amount, 0),
    currency: upper(input.currency || ""),
    gameCode: String(input.gameCode || ""),
    providerCode: String(input.providerCode || ""),
    category: String(input.category || ""),
    reference: String(input.reference || ""),
    depositSequence: toNumber(input.depositSequence, 0),
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
  };
  const userId = input.userId;
  if (!userId || !event.eventType || !event.eventKey) return { skipped: true };

  const summary = { missions: 0, completed: 0, bonuses: [], wagering: [] };
  let ledger = null;
  try {
    // Global idempotency: aynı eventKey ikinci kez işlenmez.
    ledger = await CasinoRewardEvent.create({
      user: userId, eventType: event.eventType, eventKey: event.eventKey,
      amount: event.amount, currency: event.currency, gameCode: event.gameCode,
      providerCode: event.providerCode, category: event.category,
      reference: event.reference, occurredAt: event.occurredAt,
    });
  } catch (error) {
    if (error?.code === 11000) return { ...summary, duplicate: true };
    console.error("[casinoRewardEngine] event ledger failed:", error.message);
  }

  if (event.eventType === "deposit" && !event.depositSequence) {
    event.depositSequence = await CasinoRewardEvent.countDocuments({ user: userId, eventType: "deposit", occurredAt: { $lte: event.occurredAt } });
  }

  try {
    const missions = await CasinoContent.find(publishedQuery("mission", event.occurredAt)).select("rules reward title").lean();
    for (const mission of missions) {
      const result = await applyMissionEvent({ userId, event, mission });
      if (!result) continue;
      summary.missions += 1;
      if (result.completed) summary.completed += 1;
    }
    if (event.eventType === "deposit") summary.bonuses = await activateBonusesForDeposit({ userId, event });
    if (event.eventType === "wager") summary.wagering = await applyWagerProgress({ userId, event });
  } catch (error) {
    // Ödül motoru hataları çağıran akışı (yatırım/oyun) bozmamalıdır.
    console.error("[casinoRewardEngine] recordEvent failed:", error.message);
    if (ledger) await CasinoRewardEvent.updateOne({ _id: ledger._id }, { $set: { result: { error: error.message } } }).catch(() => {});
    return { ...summary, error: error.message };
  }
  if (ledger) await CasinoRewardEvent.updateOne({ _id: ledger._id }, { $set: { result: summary, sequence: event.depositSequence || 0 } }).catch(() => {});
  return summary;
}

// Fire-and-forget yardımcıları: ödeme/oyun akışlarını bloklamaz.
const emit = (payload) => {
  recordEvent(payload).catch((error) => console.error("[casinoRewardEngine] emit failed:", error.message));
};
const emitDeposit = ({ userId, amount, currency, reference, depositSequence }) =>
  emit({ userId, eventType: "deposit", eventKey: `deposit:${reference}`, amount, currency, reference, depositSequence });
const emitLogin = ({ userId, at = new Date() }) =>
  emit({ userId, eventType: "login", eventKey: `login:${userId}:${new Date(at).toISOString().slice(0, 10)}`, amount: 1, occurredAt: at });
const emitWager = ({ userId, amount, currency, gameCode, providerCode, category, reference }) =>
  emit({ userId, eventType: "wager", eventKey: `wager:${reference}`, amount, currency, gameCode, providerCode, category, reference });
const emitWin = ({ userId, amount, currency, gameCode, providerCode, category, reference }) =>
  emit({ userId, eventType: "win", eventKey: `win:${reference}`, amount, currency, gameCode, providerCode, category, reference });
const emitGameRound = ({ userId, gameCode, providerCode, category, reference }) =>
  emit({ userId, eventType: "game-round", eventKey: `round:${reference}`, amount: 1, gameCode, providerCode, category, reference });

module.exports = {
  recordEvent,
  emit,
  emitDeposit,
  emitLogin,
  emitWager,
  emitWin,
  emitGameRound,
  selectBonus,
  creditReward,
  deliverBonus,
  processDeliveryQueue,
  expireStaleStates,
  retryDelivery,
  cancelDelivery,
  publishedQuery,
  MAX_DELIVERY_ATTEMPTS,
};
