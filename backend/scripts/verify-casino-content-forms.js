// Admin MissionEditor / BonusEditor formlarının ürettiği payload'ların backend
// normalize + validate katmanından geçtiğini doğrular. Veritabanı gerektirmez.
//
// Buradaki "varsayılanlar" CasinoContentManager.vue içindeki defaultRules() ile
// birebir aynı olmalıdır; editör ile motor sözleşmesi ayrışırsa bu test kırılır.
//
// Çalıştırma: node scripts/verify-casino-content-forms.js

const { pickContent, validateContent } = require("../services/casinoContentService");

let passed = 0;
let failed = 0;

function check(name, payload, shouldBeValid) {
	const errors = validateContent(pickContent(payload));
	const ok = shouldBeValid ? errors.length === 0 : errors.length > 0;
	if (ok) {
		passed += 1;
		console.log(`  ✅ ${name}`);
	} else {
		failed += 1;
		console.log(`  ❌ ${name} -> ${JSON.stringify(errors)}`);
	}
}

// --- MissionEditor varsayılanları ------------------------------------------
const missionDefaults = {
	type: "mission", slug: "m1", title: "M", locale: "tr",
	rules: { eventType: "wager", metric: "count", target: 1, currency: "USD", minimumAmount: 0, gameCodes: [], providerCodes: [], categories: [], period: "lifetime", autoJoin: false, perUserLimit: 1, globalLimit: 0 },
	reward: { type: "none", amount: 0, currency: "USD", wageringMultiplier: 0, spinCount: 0, betAmount: 0, gameCode: "", providerCode: "", expireHours: 72 },
};

console.log("Mission editörü:");
check("Varsayılan form geçerli", missionDefaults, true);
check("Tutar hedefli görev", { ...missionDefaults, rules: { ...missionDefaults.rules, metric: "amount", target: 500 } }, true);
check("Free-spin ödüllü görev", { ...missionDefaults, reward: { ...missionDefaults.reward, type: "free-spins", spinCount: 10, betAmount: 1, gameCode: "vs20", providerCode: "PRAGMATIC" } }, true);
check("Eksik free-spin oyunu reddedilir", { ...missionDefaults, reward: { ...missionDefaults.reward, type: "free-spins", spinCount: 10, betAmount: 1, providerCode: "PRAGMATIC" } }, false);
check("Lifetime + çoklu login reddedilir", { ...missionDefaults, rules: { ...missionDefaults.rules, eventType: "login", target: 7, period: "lifetime" } }, false);
check("Günlük login görevi geçerli", { ...missionDefaults, rules: { ...missionDefaults.rules, eventType: "login", target: 1, period: "daily" } }, true);

// --- BonusEditor varsayılanları --------------------------------------------
const bonusDefaults = {
	type: "bonus", slug: "b1", title: "Friday Bonus", locale: "tr",
	content: { label: "HAFTALIK", highlight: "50 Free Spins", infoText: "x", accent: "#f5a524" },
	rules: { activation: "deposit", minimumDeposit: 100, maximumDeposit: 0, depositSequence: 0, windowHours: 48, activeHours: 72, currencies: ["TRY"], period: "lifetime", perUserLimit: 1, globalLimit: 0, wagerMultiplier: 0, wagerMinBet: 0, wagerMaxBet: 0, wagerCategories: [], maxBonusAmount: 0, maxClaimMultiplier: 0, excludedCountries: [] },
	reward: { type: "free-spins", amount: 0, currency: "TRY", wageringMultiplier: 0, spinCount: 50, betAmount: 1, gameCode: "vs20fruit", providerCode: "PRAGMATIC", expireHours: 72 },
};

console.log("\nBonus editörü:");
check("Varsayılan free-spin bonusu geçerli", bonusDefaults, true);
check("Ödülsüz bonus reddedilir", { ...bonusDefaults, reward: { ...bonusDefaults.reward, type: "none" } }, false);
check("Min. yatırımsız deposit bonusu reddedilir", { ...bonusDefaults, rules: { ...bonusDefaults.rules, minimumDeposit: 0 } }, false);
check("Instant bonus min. yatırım istemez", { ...bonusDefaults, rules: { ...bonusDefaults.rules, activation: "instant", minimumDeposit: 0 } }, true);
check("Ters min/max yatırım reddedilir", { ...bonusDefaults, rules: { ...bonusDefaults.rules, maximumDeposit: 50 } }, false);
check("Ters çevrim bahis aralığı reddedilir", { ...bonusDefaults, rules: { ...bonusDefaults.rules, wagerMultiplier: 30, wagerMinBet: 10, wagerMaxBet: 5 } }, false);
check("Çevrimli bakiye bonusu geçerli", { ...bonusDefaults, rules: { ...bonusDefaults.rules, wagerMultiplier: 30 }, reward: { ...bonusDefaults.reward, type: "bonus", amount: 500, spinCount: 0, betAmount: 0, gameCode: "", providerCode: "" } }, true);
check("Global < kullanıcı limiti reddedilir", { ...bonusDefaults, rules: { ...bonusDefaults.rules, perUserLimit: 5, globalLimit: 2 } }, false);

console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
