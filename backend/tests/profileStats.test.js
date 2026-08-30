/**
 * profileStatsService toplamalarinin dogrulugu.
 *
 * Gercek (bellek-ici) MongoDB'ye kayit yazip aggregate sonuclarini
 * beklenen degerlerle karsilastirir. Mock yok — sorgular gercekten kosar.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../database/models/User");
const Transaction = require("../database/models/Transaction");
const FuturesBet = require("../database/models/FuturesBet");
const UnboxGame = require("../database/models/UnboxGame");
const TipTransaction = require("../database/models/TipTransaction");
const Rain = require("../database/models/Rain");
const ChatMessage = require("../database/models/ChatMessage");
const Game = require("../database/models/Game");

const {
	buildProfileStats,
	clearProfileStatsCache,
} = require("../services/profileStatsService");

let mongod;

test.before(async () => {
	mongod = await MongoMemoryServer.create();
	await mongoose.connect(mongod.getUri(), { dbName: "profile-stats-test" });
});

test.after(async () => {
	await mongoose.disconnect();
	if (mongod) await mongod.stop();
});

let counter = 0;
async function makeUser() {
	counter += 1;
	const handle = `stats${Date.now()}x${counter}`;
	return User.create({
		username: handle,
		local: { email: `${handle}@example.test`, password: "hashed-placeholder" },
	});
}

/** Casino bahsi (debit) + opsiyonel kazanc (credit) satiri yazar. */
let txnCounter = 0;
async function addBet(user, { bet, win = 0, rakeback = 0, gameType = "slot", gameCode = "g1" }) {
	txnCounter += 1;
	const rows = [
		{
			txn_id: `txn_${txnCounter}_d`,
			user_code: user._id.toString(),
			game_type: gameType,
			game_code: gameCode,
			bet_money: bet,
			win_money: 0,
			txn_type: "debit",
			round_id: `r${txnCounter}`,
			balance_before: 100,
			balance_after: 100 - bet,
			rakeback,
		},
	];
	if (win > 0) {
		rows.push({
			txn_id: `txn_${txnCounter}_c`,
			user_code: user._id.toString(),
			game_type: gameType,
			game_code: gameCode,
			bet_money: 0, // kazanc satirinda bahis yok
			win_money: win,
			txn_type: "credit",
			round_id: `r${txnCounter}`,
			balance_before: 100 - bet,
			balance_after: 100 - bet + win,
			rakeback: 0,
		});
	}
	await Transaction.insertMany(rows);
}

test("bos kullanicida tum metrikler sifir doner", async () => {
	const user = await makeUser();
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);

	assert.equal(stats.totalWagered, 0);
	assert.equal(stats.totalBets, 0);
	assert.equal(stats.earnedStaking, 0);
	assert.equal(stats.totalTips, 0);
	assert.equal(stats.totalRains, 0);
	assert.equal(stats.totalCoindrops, 0);
	assert.deepEqual(stats.topGames, []);
	assert.deepEqual(stats.battleRewards, []);
});

test("casino bahisleri: kazanc satiri bahis sayisini SISIRMEZ", async () => {
	const user = await makeUser();
	// 3 bahis; ikisi kazancli -> toplam 5 Transaction satiri olusur.
	await addBet(user, { bet: 10, win: 25, rakeback: 0.5 });
	await addBet(user, { bet: 20, win: 5, rakeback: 1 });
	await addBet(user, { bet: 30, rakeback: 1.5 });
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);

	assert.equal(stats.totalWagered, 60, "yalnizca bet_money toplanmali");
	// Kritik: 5 satir var ama bahis sayisi 3 olmali.
	assert.equal(stats.totalBets, 3, "kazanc satirlari bahis sayilmamali");
	assert.equal(stats.earnedStaking, 3, "rakeback toplami = earned staking");
});

test("baska kullanicinin verisi sizmaz", async () => {
	const a = await makeUser();
	const b = await makeUser();
	await addBet(a, { bet: 100 });
	await addBet(b, { bet: 7 });
	clearProfileStatsCache(a._id);
	clearProfileStatsCache(b._id);

	const statsA = await buildProfileStats(a._id);
	const statsB = await buildProfileStats(b._id);

	assert.equal(statsA.totalWagered, 100);
	assert.equal(statsB.totalWagered, 7);
});

test("futures: yalnizca pozitif pnl kazanc sayilir", async () => {
	const user = await makeUser();
	await FuturesBet.create([
		{ user: user._id, symbol: "BTC", amount: 10, leverage: 5, entryPrice: 1, direction: "LONG", pnl: 4 },
		{ user: user._id, symbol: "ETH", amount: 20, leverage: 5, entryPrice: 1, direction: "SHORT", pnl: -8 },
	]);
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);

	assert.equal(stats.futures.totalWagered, 30);
	assert.equal(stats.futures.totalBets, 2);
	assert.equal(stats.futures.totalWin, 4, "zarar dusulmemeli");
});

test("lootbox toplamlari", async () => {
	const user = await makeUser();
	await UnboxGame.create([
		{ user: user._id, amount: 5, payout: 12 },
		{ user: user._id, amount: 5, payout: 0 },
	]);
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);

	assert.equal(stats.lootboxes.totalWagered, 10);
	assert.equal(stats.lootboxes.totalBets, 2);
	assert.equal(stats.lootboxes.totalWin, 12);
});

test("tips: yalnizca GONDERILEN ve completed olanlar sayilir", async () => {
	const sender = await makeUser();
	const receiver = await makeUser();
	await TipTransaction.create([
		{ amount: 15, sender: { user: sender._id }, receiver: { user: receiver._id }, state: "completed" },
		{ amount: 99, sender: { user: sender._id }, receiver: { user: receiver._id }, state: "pending" },
		// Alinan bahsis gonderenin toplamina eklenmemeli.
		{ amount: 50, sender: { user: receiver._id }, receiver: { user: sender._id }, state: "completed" },
	]);
	clearProfileStatsCache(sender._id);

	const stats = await buildProfileStats(sender._id);

	assert.equal(stats.totalTips, 15);
});

test("rain: katilimci sayisina bolunmus pay hesaplanir", async () => {
	const user = await makeUser();
	const other = await makeUser();
	await Rain.create([
		// 30 / 3 katilimci = 10
		{ amount: 30, participants: [{ user: user._id }, { user: other._id }, { user: other._id }], state: "completed" },
		// 8 / 2 = 4
		{ amount: 8, participants: [{ user: user._id }, { user: other._id }], state: "completed" },
		// tamamlanmamis -> sayilmaz
		{ amount: 100, participants: [{ user: user._id }], state: "running" },
	]);
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);

	assert.equal(stats.totalRains, 14);
	assert.equal(stats.chat.rains, 2);
});

test("sohbet kademesi mesaj sayisina gore yukselir", async () => {
	const user = await makeUser();
	const rows = [];
	for (let i = 0; i < 60; i += 1) {
		rows.push({ room: "en", user: user._id, message: `m${i}`, username: user.username });
	}
	// Silinmis mesaj sayilmamali.
	rows.push({ room: "en", user: user._id, message: "silindi", deleted: true });
	await ChatMessage.insertMany(rows);
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);

	assert.equal(stats.chat.messages, 60, "silinmis mesaj sayilmamali");
	assert.equal(stats.chat.level, 2, "50+ mesaj -> seviye 2");
	assert.equal(stats.chat.tier, "Member");
	assert.equal(stats.chat.nextLevelAt, 250);
});

test("en cok oynanan oyunlar isim ve kapakla eslesir", async () => {
	const user = await makeUser();
	await Game.create({
		game_id: "gid1",
		provider_id: 1,
		game_name: "Sweet Bonanza",
		game_code: "sweet",
		game_type: "slot",
		cover: "https://cdn/sweet.png",
		technology: "html5",
		distribution: "test",
	});
	await addBet(user, { bet: 5, gameCode: "sweet" });
	await addBet(user, { bet: 40, gameCode: "sweet" });
	await addBet(user, { bet: 10, gameCode: "bilinmeyen" });
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);

	assert.equal(stats.topGames.length, 2);
	assert.equal(stats.topGames[0].name, "Sweet Bonanza", "en cok bahis yapilan once");
	assert.equal(stats.topGames[0].wagered, 45);
	assert.equal(stats.topGames[0].banner, "https://cdn/sweet.png");
	// Katalogda olmayan oyun icin kod gosterilir, satir kaybolmaz.
	assert.equal(stats.topGames[1].name, "bilinmeyen");
});

test("details kirilimi kategorilere gore birlesir", async () => {
	const user = await makeUser();
	await addBet(user, { bet: 10, gameType: "slot" });
	await addBet(user, { bet: 5, gameType: "video-slot" }); // ikisi de Slots
	await addBet(user, { bet: 20, gameType: "live-casino" });
	clearProfileStatsCache(user._id);

	const stats = await buildProfileStats(user._id);
	const byCategory = Object.fromEntries(
		stats.wageredBreakdown.map((row) => [row.category, row])
	);

	assert.equal(byCategory["Slots"].amount, 15, "iki slot turu birlesmeli");
	assert.equal(byCategory["Slots"].bets, 2);
	assert.equal(byCategory["Live Casino"].amount, 20);
	// Azalan siralama
	assert.equal(stats.wageredBreakdown[0].category, "Live Casino");
});

test("onbellek calisir ve force ile atlanir", async () => {
	const user = await makeUser();
	await addBet(user, { bet: 10 });
	clearProfileStatsCache(user._id);

	const first = await buildProfileStats(user._id);
	assert.equal(first.totalWagered, 10);

	// Yeni bahis ekle — onbellek yuzunden ESKI deger donmeli.
	await addBet(user, { bet: 90 });
	const cached = await buildProfileStats(user._id);
	assert.equal(cached.totalWagered, 10, "onbellekten donmeli");

	// force ile taze hesap.
	const fresh = await buildProfileStats(user._id, { force: true });
	assert.equal(fresh.totalWagered, 100);
});
