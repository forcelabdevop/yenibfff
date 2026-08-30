/**
 * Profil modali metriklerini CANLI verilerden hesaplar.
 *
 * Onceden `/account/overview` yalnizca `user.stats` denormalize alanini
 * donuyordu; o alan sadece { bet, won, deposit, withdraw } iceriyor ve profil
 * modalinin bekledigi hicbir alanla ortusmuyordu. Sonucta Total Wagered /
 * Total Bets disindaki her kutu 0 gorunuyordu.
 *
 * Kaynaklar (hepsi gercek koleksiyonlar):
 *   - Transaction  : casino bahisleri  (user_code = user._id.toString())
 *   - FuturesBet   : kripto vadeli islem
 *   - UnboxGame    : lootbox
 *   - TipTransaction: gonderilen bahsisler
 *   - Rain         : katilinan rain'lerden alinan pay
 *   - ChatMessage  : sohbet aktivitesi
 *   - Game         : en cok oynanan oyunlarin adi/kapagi
 *
 * KAYNAGI OLMAYAN metrikler uydurulmaz, 0 doner:
 *   - Total Coindrops : coindrop sistemi henuz yok.
 *   - Likes           : begeni modeli yok.
 *   - battleRewards   : turnuva odul modeli yok.
 *
 * "Earned Staking" = kullanicinin bahislerinden biriken `rakeback` toplami
 * (urunde staking karsiligi olan tek gercek pasif gelir kalemi).
 *
 * PERFORMANS: Bu toplamalar agirdir, bu yuzden AYRI bir uctan servis edilir
 * (`GET /account/profile-stats`) ve kullanici basina kisa sureli onbelleklenir.
 * Her sayfa yuklemesinde degil, yalnizca profil modali acilinca calisir.
 */
const mongoose = require("mongoose");

const Transaction = require("../database/models/Transaction");
const FuturesBet = require("../database/models/FuturesBet");
const UnboxGame = require("../database/models/UnboxGame");
const TipTransaction = require("../database/models/TipTransaction");
const Rain = require("../database/models/Rain");
const ChatMessage = require("../database/models/ChatMessage");
const Game = require("../database/models/Game");

const CACHE_TTL_MS = 30 * 1000;
const TOP_GAMES_LIMIT = 4;

/** userId -> { expiresAt, data } */
const cache = new Map();

/**
 * Sohbet kademeleri. Esik = o seviyeye ULASMAK icin gereken mesaj sayisi.
 * Profil modali "level/5" gosterdigi icin tam 5 kademe var.
 */
const CHAT_TIERS = [
	{ level: 1, tier: "Junior", at: 0 },
	{ level: 2, tier: "Member", at: 50 },
	{ level: 3, tier: "Senior", at: 250 },
	{ level: 4, tier: "Expert", at: 1000 },
	{ level: 5, tier: "Legend", at: 5000 },
];

/** Casino `game_type` -> profil "Details" filtresi kategorisi. */
function categoryOf(gameType) {
	const raw = String(gameType || "").toLowerCase();
	if (raw.includes("live")) return "Live Casino";
	if (raw.includes("original") || raw.includes("crash") || raw.includes("dice")) return "Originals";
	return "Slots";
}

/** Aggregate sonucundaki ilk satiri (yoksa bos nesne) doner. */
const firstRow = (rows) => (Array.isArray(rows) && rows.length ? rows[0] : {});

/** NaN/undefined'a karsi guvenli sayi. */
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Kurus hassasiyetine yuvarlar; kayan nokta artiklarini temizler. */
const money = (value) => Math.round(num(value) * 100) / 100;

/**
 * Verilen kullanici icin profil metriklerini hesaplar.
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {{ force?: boolean }} [options] force=true onbellegi atlar.
 */
async function buildProfileStats(userId, options = {}) {
	const key = String(userId);
	if (!options.force) {
		const hit = cache.get(key);
		if (hit && hit.expiresAt > Date.now()) return hit.data;
	}

	const oid = new mongoose.Types.ObjectId(key);
	// Transaction kullaniciyi ObjectId ile DEGIL, string `user_code` ile tutar.
	const userCode = key;

	const [casino, futures, lootboxes, tips, rains, chatMessages, byGame, byCategory] =
		await Promise.all([
			// --- Casino bahisleri -------------------------------------------------
			// `debit` satirlari bahis, `credit` satirlari kazanctir; kazanc
			// satirlarinda bet_money 0 oldugu icin bahis SAYISI yalnizca
			// bet_money > 0 olan satirlardan sayilir (yoksa iki katina cikardi).
			Transaction.aggregate([
				{ $match: { user_code: userCode } },
				{
					$group: {
						_id: null,
						totalWagered: { $sum: "$bet_money" },
						totalBets: { $sum: { $cond: [{ $gt: ["$bet_money", 0] }, 1, 0] } },
						earnedStaking: { $sum: "$rakeback" },
					},
				},
			]),

			// --- Kripto vadeli islem ---------------------------------------------
			// Yalnizca POZITIF pnl "Total Win" sayilir; zararlar dusulmez.
			FuturesBet.aggregate([
				{ $match: { user: oid } },
				{
					$group: {
						_id: null,
						totalWagered: { $sum: "$amount" },
						totalBets: { $sum: 1 },
						totalWin: { $sum: { $cond: [{ $gt: ["$pnl", 0] }, "$pnl", 0] } },
					},
				},
			]),

			// --- Lootbox ----------------------------------------------------------
			UnboxGame.aggregate([
				{ $match: { user: oid } },
				{
					$group: {
						_id: null,
						totalWagered: { $sum: "$amount" },
						totalBets: { $sum: 1 },
						totalWin: { $sum: "$payout" },
					},
				},
			]),

			// --- Gonderilen bahsisler ---------------------------------------------
			TipTransaction.aggregate([
				{ $match: { "sender.user": oid, state: "completed" } },
				{ $group: { _id: null, total: { $sum: "$amount" } } },
			]),

			// --- Rain'den alinan pay ----------------------------------------------
			// Rain tutari katilimcilara esit bolunur; kullanicinin payi
			// amount / participants.length'tir.
			Rain.aggregate([
				{ $match: { "participants.user": oid, state: "completed" } },
				{
					$project: {
						share: {
							$cond: [
								{ $gt: [{ $size: { $ifNull: ["$participants", []] } }, 0] },
								{ $divide: ["$amount", { $size: "$participants" }] },
								0,
							],
						},
					},
				},
				{ $group: { _id: null, total: { $sum: "$share" }, count: { $sum: 1 } } },
			]),

			// --- Sohbet aktivitesi --------------------------------------------------
			ChatMessage.countDocuments({ user: oid, deleted: { $ne: true } }),

			// --- En cok oynanan oyunlar ---------------------------------------------
			Transaction.aggregate([
				{ $match: { user_code: userCode, bet_money: { $gt: 0 } } },
				{ $group: { _id: "$game_code", wagered: { $sum: "$bet_money" } } },
				{ $sort: { wagered: -1 } },
				{ $limit: TOP_GAMES_LIMIT },
			]),

			// --- Oyun turune gore kirilim ("Details" tablosu) -------------------------
			Transaction.aggregate([
				{ $match: { user_code: userCode, bet_money: { $gt: 0 } } },
				{
					$group: {
						_id: "$game_type",
						amount: { $sum: "$bet_money" },
						bets: { $sum: 1 },
					},
				},
			]),
		]);

	const casinoRow = firstRow(casino);
	const futuresRow = firstRow(futures);
	const lootboxRow = firstRow(lootboxes);
	const rainRow = firstRow(rains);

	// --- En cok oynanan oyunlarin adi/kapagi ---------------------------------
	const gameCodes = byGame.map((row) => row._id).filter(Boolean);
	const gameDocs = gameCodes.length
		? await Game.find({ game_code: { $in: gameCodes } })
				.select("game_code game_name cover")
				.lean()
		: [];
	const gameByCode = new Map(gameDocs.map((doc) => [doc.game_code, doc]));
	const topGames = byGame.map((row) => {
		const doc = gameByCode.get(row._id);
		return {
			gameId: row._id || "",
			// Katalogda bulunamayan oyun icin saglayici kodunu gostermek,
			// bos satir birakmaktan daha bilgilendirici.
			name: (doc && doc.game_name) || row._id || "Unknown game",
			banner: (doc && doc.cover) || "",
			wagered: money(row.wagered),
		};
	});

	// --- "Details" kirilimi ---------------------------------------------------
	// Kategoriler birlestirilir (birden fazla game_type ayni kategoriye duser).
	const categoryTotals = new Map();
	for (const row of byCategory) {
		const category = categoryOf(row._id);
		const acc = categoryTotals.get(category) || { amount: 0, bets: 0 };
		acc.amount += num(row.amount);
		acc.bets += num(row.bets);
		categoryTotals.set(category, acc);
	}
	const wageredBreakdown = [...categoryTotals.entries()]
		.map(([category, acc]) => ({
			category,
			currency: "USD",
			amount: money(acc.amount),
			bets: acc.bets,
			icon: "",
		}))
		.sort((a, b) => b.amount - a.amount);

	// --- Sohbet kademesi -------------------------------------------------------
	const messages = num(chatMessages);
	const rainCount = num(rainRow.count);
	let current = CHAT_TIERS[0];
	for (const tier of CHAT_TIERS) if (messages >= tier.at) current = tier;
	const next = CHAT_TIERS.find((tier) => tier.at > messages);

	const data = {
		// Statistics
		totalWagered: money(casinoRow.totalWagered),
		totalBets: num(casinoRow.totalBets),
		earnedStaking: money(casinoRow.earnedStaking),

		// Activity
		totalTips: money(firstRow(tips).total),
		totalRains: money(rainRow.total),
		totalCoindrops: 0, // coindrop sistemi yok

		futures: {
			totalWagered: money(futuresRow.totalWagered),
			totalBets: num(futuresRow.totalBets),
			totalWin: money(futuresRow.totalWin),
		},
		lootboxes: {
			totalWagered: money(lootboxRow.totalWagered),
			totalBets: num(lootboxRow.totalBets),
			totalWin: money(lootboxRow.totalWin),
		},

		chat: {
			level: current.level,
			tier: current.tier,
			messages,
			// Son kademede ilerleme cubugu dolu kalsin diye esik = mevcut deger.
			nextLevelAt: next ? next.at : messages,
			likes: 0, // begeni modeli yok
			nextLikesAt: 0,
			coindrops: 0,
			nextCoindropsAt: 0,
			rains: rainCount,
			nextRainsAt: rainCount,
		},

		topGames,
		wageredBreakdown,
		battleRewards: [], // turnuva odul modeli yok
	};

	cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
	return data;
}

/** Onbellegi bosaltir (test ve kullanici verisi degisince). */
function clearProfileStatsCache(userId) {
	if (userId) cache.delete(String(userId));
	else cache.clear();
}

module.exports = { buildProfileStats, clearProfileStatsCache, CHAT_TIERS };
