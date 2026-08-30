const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.TRON_HD_MNEMONIC =
	process.env.TRON_HD_MNEMONIC ||
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../database/models/User");
const CryptoDeposit = require("../database/models/CryptoDeposit");
const CryptoAddress = require("../database/models/CryptoAddress");
const watcher = require("../services/cryptoDepositWatcher");
const addressService = require("../services/cryptoAddressService");
const { getCurrency, CONFIRMATIONS_REQUIRED } = require("../config/crypto");
const { normalizeWalletState } = require("../utils/rivoWallet");

let mongod;

test.before(async () => {
	mongod = await MongoMemoryServer.create();
	await mongoose.connect(mongod.getUri(), { dbName: "crypto-test" });
	await Promise.all([
		CryptoAddress.syncIndexes(),
		CryptoDeposit.syncIndexes(),
	]);
});

test.after(async () => {
	await mongoose.disconnect();
	if (mongod) await mongod.stop();
});

const USDT = getCurrency("USDT_TRC20") || getCurrency("TRX");

let userCounter = 0;

async function makeUser() {
	userCounter += 1;
	const handle = `test${Date.now()}x${userCounter}`;
	return User.create({
		username: handle,
		local: { email: `${handle}@example.test`, password: "hashed-placeholder" },
		wallets: [{ coinType: "Rivo", chain: "TRON", type: "trc-20", balance: 0 }],
	});
}

async function makeDeposit(user, overrides = {}) {
	return CryptoDeposit.create({
		user: user._id,
		chain: "TRON",
		currency: USDT.code,
		address: `T${Math.random().toString(36).slice(2, 12)}`,
		txHash: `tx${Math.random().toString(36).slice(2, 14)}`,
		amountUnits: 5_000_000, // 5 birim
		decimals: USDT.decimals,
		blockNumber: 1000,
		status: "pending",
		...overrides,
	});
}

/** Cuzdan bakiyesini okur (appliedDeposits select:false oldugu icin acikca istenir). */
async function readBalance(userId) {
	const fresh = await User.findById(userId).select("wallets").lean();
	const wallet = (fresh.wallets || []).find(
		(w) => w.coinType === USDT.walletCode,
	);
	return wallet ? wallet.balance : null;
}

test("yatirim bakiyeye bir kez eklenir", async () => {
	const user = await makeUser();
	const deposit = await makeDeposit(user);

	const applied = await watcher.creditDeposit(deposit.toObject(), 25);
	assert.equal(applied, true);
	assert.equal(await readBalance(user._id), 5);
});

test("AYNI yatirim iki kez islenirse bakiye IKI KEZ artmaz", async () => {
	// Bu testin korudugu senaryo: izleyici yeniden baslar, kilit dusmesi
	// yasanir veya bir tur yarida kalir ve ayni yatirim tekrar islenir.
	// Koruma calismazsa kullanici parayi iki kez alir — dogrudan kayip.
	const user = await makeUser();
	const deposit = await makeDeposit(user);

	await watcher.creditDeposit(deposit.toObject(), 25);
	const second = await watcher.creditDeposit(deposit.toObject(), 25);

	assert.equal(second, false, "ikinci islem kredi vermemeli");
	assert.equal(await readBalance(user._id), 5, "bakiye yalnizca bir kez artmali");
});

test("ESZAMANLI kredi cagrilari tek artis yapar", async () => {
	// PM2 cluster'da 4 instance ayni anda ayni yatirimi isleyebilir.
	const user = await makeUser();
	const deposit = await makeDeposit(user);
	const plain = deposit.toObject();

	const results = await Promise.all([
		watcher.creditDeposit(plain, 25),
		watcher.creditDeposit(plain, 25),
		watcher.creditDeposit(plain, 25),
		watcher.creditDeposit(plain, 25),
	]);

	assert.equal(
		results.filter(Boolean).length,
		1,
		"dort eszamanli cagridan yalniz biri kredi vermeli",
	);
	assert.equal(await readBalance(user._id), 5);
});

test("onay esiginin ALTINDAKI yatirim kredi edilmez", async () => {
	const user = await makeUser();
	const currentBlock = 1000;
	// Esigin bir altinda kalacak sekilde: onay sayisi < CONFIRMATIONS_REQUIRED
	await makeDeposit(user, {
		blockNumber: currentBlock - (CONFIRMATIONS_REQUIRED - 1),
	});

	await watcher.creditConfirmed(currentBlock);

	assert.equal(
		await readBalance(user._id),
		null,
		"olgunlasmamis yatirim icin cuzdan bile olusmamali",
	);
});

test("onay esigini ASAN yatirim kredi edilir", async () => {
	const user = await makeUser();
	const currentBlock = 5000;
	await makeDeposit(user, {
		blockNumber: currentBlock - CONFIRMATIONS_REQUIRED,
	});

	await watcher.creditConfirmed(currentBlock);

	assert.equal(await readBalance(user._id), 5);
});

test("kredi edilen cuzdan normalize sonrasi bakiyesini korur", async () => {
	// Uctan uca: kredi -> kaydet -> normalize. Cuzdan silinirse para kaybolur.
	const user = await makeUser();
	const deposit = await makeDeposit(user);
	await watcher.creditDeposit(deposit.toObject(), 25);

	const fresh = await User.findById(user._id).select("wallets currency").lean();
	const { wallets } = normalizeWalletState(fresh);
	const wallet = wallets.find((w) => w.coinType === USDT.walletCode);

	assert.ok(wallet, "kripto cuzdani normalize sonrasi silinmemeli");
	assert.equal(wallet.balance, 5, "bakiye korunmali");
});

test("ayni kullanici + para birimi icin adres DEGISMEZ", async () => {
	const user = await makeUser();
	const first = await addressService.getOrCreateAddress(user._id, USDT.code);
	const second = await addressService.getOrCreateAddress(user._id, USDT.code);

	assert.equal(first.address, second.address);
	assert.match(first.address, /^T/, "TRON adresi T ile baslamali");
});

test("ESZAMANLI adres istekleri TEK adres uretir", async () => {
	// Kullanici iki sekmeden ayni anda yatirma ekranini acarsa iki adres
	// olusmamali; aksi halde birine gonderilen para izlenmez.
	const user = await makeUser();

	const results = await Promise.all([
		addressService.getOrCreateAddress(user._id, USDT.code),
		addressService.getOrCreateAddress(user._id, USDT.code),
		addressService.getOrCreateAddress(user._id, USDT.code),
	]);

	const unique = new Set(results.map((r) => r.address));
	assert.equal(unique.size, 1, "tek adres olusmali");

	const count = await CryptoAddress.countDocuments({
		user: user._id,
		currency: USDT.code,
	});
	assert.equal(count, 1, "veritabaninda tek kayit olmali");
});

test("farkli kullanicilar FARKLI adres ve indeks alir", async () => {
	// Kullanicilar SIRAYLA olusturulur: User modelinin numericId atamasinda
	// (bu ozellikten bagimsiz, mevcut bir davranis) yaris durumu var ve
	// paralel olusturma testi ilgisiz bir sebeple kirar.
	const a = await makeUser();
	const b = await makeUser();
	const [addrA, addrB] = await Promise.all([
		addressService.getOrCreateAddress(a._id, USDT.code),
		addressService.getOrCreateAddress(b._id, USDT.code),
	]);

	assert.notEqual(
		addrA.address,
		addrB.address,
		"iki kullanici ayni adresi PAYLASMAMALI",
	);

	const records = await CryptoAddress.find({
		user: { $in: [a._id, b._id] },
	}).lean();
	const indexes = new Set(records.map((r) => r.derivationIndex));
	assert.equal(indexes.size, 2, "turetme indeksleri carpismamali");
});

test("ayni txHash ikinci kez yazilamaz", async () => {
	// Veritabani seviyesindeki son savunma hatti.
	const user = await makeUser();
	const deposit = await makeDeposit(user);

	await assert.rejects(
		() =>
			CryptoDeposit.create({
				user: user._id,
				chain: "TRON",
				currency: deposit.currency,
				address: deposit.address,
				txHash: deposit.txHash,
				amountUnits: 5_000_000,
				decimals: 6,
				blockNumber: 1000,
			}),
		(err) => err.code === 11000,
		"unique index mukerrer kaydi engellemeli",
	);
});
