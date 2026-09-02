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

// --- EVM (coin bazli kredi) senaryolari -----------------------------------
// creditDeposit() zincir-bagimsizdir (bkz. cryptoDepositWatcherEvm.js dosya
// basi notu); EVM yatirmalari da AYNI fonksiyonu kullanir. Burada dogrulanan:
// her para birimi KENDI coinType cuzdanina gider, ana "Rivo" bakiyesi
// degismez ve ayni coinType'a sahip farkli agdaki cuzdanlar carpismaz.

const ETH = getCurrency("ETH_ETHEREUM");
const USDC_BEP20 = getCurrency("USDC_BEP20");

async function makeEvmDeposit(user, currency, overrides = {}) {
	return CryptoDeposit.create({
		user: user._id,
		chain: currency.chain,
		currency: currency.code,
		address: `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`,
		txHash: `0x${Math.random().toString(16).slice(2, 66).padEnd(64, "0")}`,
		amountUnits: 2 * 10 ** currency.decimals, // 2 birim (kanonik)
		decimals: currency.decimals,
		blockNumber: 1000,
		logIndex: 0,
		status: "pending",
		...overrides,
	});
}

test("ETH yatirimi ETH cuzdanina gider, Rivo bakiyesi degismez", async () => {
	const user = await makeUser();
	const deposit = await makeEvmDeposit(user, ETH);

	const applied = await watcher.creditDeposit(deposit.toObject(), ETH.confirmationsRequired);
	assert.equal(applied, true);

	const fresh = await User.findById(user._id).select("wallets").lean();
	const ethWallet = fresh.wallets.find((w) => w.coinType === "ETH");
	const rivoWallet = fresh.wallets.find((w) => w.coinType === "Rivo");

	assert.ok(ethWallet, "ETH cuzdani olusturulmali");
	assert.equal(ethWallet.balance, 2, "ETH bakiyesi yatirilan miktar olmali");
	assert.equal(rivoWallet.balance, 0, "Rivo bakiyesi ETH yatirimindan etkilenmemeli");
});

test("USDC_BEP20 yatirimi USDC cuzdanina gider (BNB veya USDT DEGIL)", async () => {
	const user = await makeUser();
	const deposit = await makeEvmDeposit(user, USDC_BEP20);

	await watcher.creditDeposit(deposit.toObject(), USDC_BEP20.confirmationsRequired);

	const fresh = await User.findById(user._id).select("wallets").lean();
	const usdcWallet = fresh.wallets.find((w) => w.coinType === "USDC");
	const bnbWallet = fresh.wallets.find((w) => w.coinType === "BNB");
	const usdtWallet = fresh.wallets.find((w) => w.coinType === "USDT");

	assert.ok(usdcWallet, "USDC cuzdani olusturulmali");
	assert.equal(usdcWallet.balance, 2);
	assert.equal(bnbWallet, undefined, "USDC yatirimi BNB cuzdani olusturmamali");
	assert.equal(usdtWallet, undefined, "USDC yatirimi USDT cuzdani olusturmamali");
});

test("AYNI EVM yatirimi iki kez islenirse bakiye IKI KEZ artmaz", async () => {
	const user = await makeUser();
	const deposit = await makeEvmDeposit(user, ETH);
	const plain = deposit.toObject();

	await watcher.creditDeposit(plain, ETH.confirmationsRequired);
	const second = await watcher.creditDeposit(plain, ETH.confirmationsRequired);

	assert.equal(second, false, "ikinci islem kredi vermemeli");
	const fresh = await User.findById(user._id).select("wallets").lean();
	assert.equal(fresh.wallets.find((w) => w.coinType === "ETH").balance, 2);
});

test("ayni coinType'a (USDT) sahip farkli zincir yatirimlari AYNI cuzdanda toplanir", async () => {
	// USDT_ETHEREUM ve USDT_BEP20 farkli aglardir ama wallets semasinda TEK
	// bir "USDT" coinType'i vardir — kullanicinin toplam USDT bakiyesi budur.
	const user = await makeUser();
	const usdtEth = getCurrency("USDT_ETHEREUM");
	const usdtBep = getCurrency("USDT_BEP20");

	const depositEth = await makeEvmDeposit(user, usdtEth);
	const depositBep = await makeEvmDeposit(user, usdtBep);

	await watcher.creditDeposit(depositEth.toObject(), usdtEth.confirmationsRequired);
	await watcher.creditDeposit(depositBep.toObject(), usdtBep.confirmationsRequired);

	const fresh = await User.findById(user._id).select("wallets").lean();
	const usdtWallets = fresh.wallets.filter((w) => w.coinType === "USDT");

	assert.equal(usdtWallets.length, 1, "USDT icin tek cuzdan olmali (zincire gore ayrilmamali)");
	assert.equal(usdtWallets[0].balance, 4, "iki zincirden gelen USDT toplanmali");
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
