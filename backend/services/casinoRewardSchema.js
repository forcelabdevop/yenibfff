// 🎯 Mission ve Special Bonus kayıtları için yapılandırılmış şema katmanı.
// Admin panelinden gelen serbest JSON doğrudan kaydedilmez; burada
// allowlist + normalize + validate edilir. Motor (casinoRewardEngine) da
// aynı normalize edilmiş yapıyı okur, böylece tek bir kontrat olur.

const MISSION_EVENT_TYPES = ["deposit", "wager", "win", "game-round", "login"];
const MISSION_METRICS = ["count", "amount"];
const PERIODS = ["lifetime", "daily", "weekly", "monthly"];
const REWARD_TYPES = ["none", "balance", "bonus", "free-spins", "xp"];
const BONUS_ACTIVATIONS = ["deposit", "instant"];

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const positive = (value, fallback = 0) => Math.max(0, num(value, fallback));
const bool = (value) => value === true || value === "true" || value === 1 || value === "1";
const list = (value) => {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(source.map((item) => String(item ?? "").trim()).filter(Boolean))];
};
const upperList = (value) => list(value).map((item) => item.toUpperCase());
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);

function normalizeMissionRules(input = {}) {
  const eventType = oneOf(input.eventType, MISSION_EVENT_TYPES, "wager");
  return {
    eventType,
    metric: eventType === "login" ? "count" : oneOf(input.metric, MISSION_METRICS, "count"),
    target: Math.max(1, positive(input.target, 1)),
    currency: String(input.currency || "USD").toUpperCase(),
    minimumAmount: positive(input.minimumAmount, 0),
    gameCodes: list(input.gameCodes),
    providerCodes: list(input.providerCodes),
    categories: list(input.categories),
    period: oneOf(input.period, PERIODS, "lifetime"),
    autoJoin: bool(input.autoJoin),
    perUserLimit: Math.max(0, Math.trunc(positive(input.perUserLimit, 1))),
    globalLimit: Math.max(0, Math.trunc(positive(input.globalLimit, 0))),
  };
}

function normalizeBonusRules(input = {}) {
  return {
    activation: oneOf(input.activation, BONUS_ACTIVATIONS, "deposit"),
    minimumDeposit: positive(input.minimumDeposit, 0),
    maximumDeposit: positive(input.maximumDeposit, 0),
    depositSequence: Math.max(0, Math.trunc(positive(input.depositSequence, 0))),
    windowHours: Math.max(0, positive(input.windowHours, 48)),
    activeHours: Math.max(0, positive(input.activeHours, 72)),
    currencies: upperList(input.currencies),
    period: oneOf(input.period, PERIODS, "lifetime"),
    perUserLimit: Math.max(0, Math.trunc(positive(input.perUserLimit, 1))),
    globalLimit: Math.max(0, Math.trunc(positive(input.globalLimit, 0))),
    wagerMultiplier: positive(input.wagerMultiplier, 0),
    wagerMinBet: positive(input.wagerMinBet, 0),
    wagerMaxBet: positive(input.wagerMaxBet, 0),
    wagerCategories: list(input.wagerCategories),
    maxBonusAmount: positive(input.maxBonusAmount, 0),
    maxClaimMultiplier: positive(input.maxClaimMultiplier, 0),
    excludedCountries: upperList(input.excludedCountries),
  };
}

function normalizeBonusContent(input = {}) {
  return {
    label: String(input.label || "").trim().slice(0, 60),
    highlight: String(input.highlight || "").trim().slice(0, 80),
    infoText: String(input.infoText || "").trim().slice(0, 600),
    section: "special",
    accent: String(input.accent || "").trim().slice(0, 40),
  };
}

function normalizeReward(input = {}) {
  const type = oneOf(input.type, REWARD_TYPES, "none");
  return {
    type,
    amount: positive(input.amount, 0),
    currency: String(input.currency || "USD").toUpperCase(),
    wageringMultiplier: positive(input.wageringMultiplier, 0),
    spinCount: Math.trunc(positive(input.spinCount, 0)),
    betAmount: positive(input.betAmount, 0),
    gameCode: String(input.gameCode || "").trim(),
    providerCode: String(input.providerCode || "").trim(),
    expireHours: Math.max(1, positive(input.expireHours, 72)),
  };
}

function validateMission(payload = {}) {
  const errors = [];
  const rules = payload.rules || {};
  const reward = payload.reward || {};
  if (!MISSION_EVENT_TYPES.includes(rules.eventType)) errors.push("Geçerli bir görev etkinlik tipi seçin");
  if (!(rules.target >= 1)) errors.push("Hedef en az 1 olmalıdır");
  if (rules.metric === "amount" && !rules.currency) errors.push("Tutar hedefi için para birimi zorunludur");
  if (rules.eventType === "login" && rules.period === "lifetime" && rules.target > 1) {
    errors.push("Tekrarlayan giriş görevleri için günlük/haftalık dönem seçin");
  }
  if (rules.perUserLimit && rules.globalLimit && rules.globalLimit < rules.perUserLimit) {
    errors.push("Global limit, kullanıcı limitinden küçük olamaz");
  }
  errors.push(...validateReward(reward));
  return errors;
}

function validateBonus(payload = {}) {
  const errors = [];
  const rules = payload.rules || {};
  const reward = payload.reward || {};
  if (!BONUS_ACTIVATIONS.includes(rules.activation)) errors.push("Geçerli bir aktivasyon tipi seçin");
  if (rules.activation === "deposit" && !(rules.minimumDeposit > 0)) errors.push("Yatırım bonusu için minimum yatırım tutarı zorunludur");
  if (rules.activation === "deposit" && !(rules.windowHours > 0)) errors.push("Yatırım bonusu için geçerlilik penceresi zorunludur");
  if (rules.maximumDeposit && rules.maximumDeposit < rules.minimumDeposit) errors.push("Maksimum yatırım, minimum yatırımdan küçük olamaz");
  if (rules.wagerMaxBet && rules.wagerMinBet && rules.wagerMaxBet < rules.wagerMinBet) errors.push("Maksimum çevrim bahsi, minimum çevrim bahsinden küçük olamaz");
  if (rules.perUserLimit && rules.globalLimit && rules.globalLimit < rules.perUserLimit) errors.push("Global limit, kullanıcı limitinden küçük olamaz");
  if (reward.type === "none") errors.push("Special bonus için bir ödül tipi seçin");
  errors.push(...validateReward(reward));
  return errors;
}

function validateReward(reward = {}) {
  const errors = [];
  if (reward.type === "free-spins") {
    if (!(reward.spinCount >= 1)) errors.push("Free spin adedi en az 1 olmalıdır");
    if (!(reward.betAmount > 0)) errors.push("Free spin başına bahis tutarı zorunludur");
    if (!reward.gameCode) errors.push("Free spin için oyun kodu zorunludur");
    if (!reward.providerCode) errors.push("Free spin için sağlayıcı kodu zorunludur");
    if (!(reward.expireHours >= 1)) errors.push("Free spin geçerlilik süresi en az 1 saat olmalıdır");
  }
  if (["balance", "bonus", "xp"].includes(reward.type) && !(reward.amount > 0)) {
    errors.push("Ödül tutarı sıfırdan büyük olmalıdır");
  }
  return errors;
}

// Type bazlı normalize: yalnızca mission ve bonus yapılandırılmış şemaya tabidir.
// Kısmi güncellemelerde yalnızca gönderilen anahtarlar normalize edilir; böylece
// sadece "status" gönderen publish/arşiv istekleri kuralları silmez.
function normalizeContentPayload(payload = {}) {
  const type = payload.type;
  if (type !== "mission" && type !== "bonus") return payload;
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  const next = { ...payload };
  if (has("rules")) next.rules = type === "mission" ? normalizeMissionRules(payload.rules) : normalizeBonusRules(payload.rules);
  if (has("reward")) next.reward = normalizeReward(payload.reward);
  if (type === "bonus" && has("content")) next.content = { ...(payload.content || {}), ...normalizeBonusContent(payload.content) };
  return next;
}

function validateStructuredContent(payload = {}) {
  if (payload.type === "mission") return validateMission(payload);
  if (payload.type === "bonus") return validateBonus(payload);
  return [];
}

// Dönem anahtarı: ilerlemenin hangi periyoda ait olduğunu belirler.
function periodKeyFor(period = "lifetime", date = new Date()) {
  const value = new Date(date);
  if (period === "daily") return `d:${value.toISOString().slice(0, 10)}`;
  if (period === "monthly") return `m:${value.toISOString().slice(0, 7)}`;
  if (period === "weekly") {
    const utc = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
    return `w:${utc.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
  }
  return "lifetime";
}

module.exports = {
  MISSION_EVENT_TYPES,
  MISSION_METRICS,
  PERIODS,
  REWARD_TYPES,
  BONUS_ACTIVATIONS,
  normalizeMissionRules,
  normalizeBonusRules,
  normalizeReward,
  normalizeContentPayload,
  validateStructuredContent,
  periodKeyFor,
};
