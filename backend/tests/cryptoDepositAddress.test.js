const test = require("node:test");
const assert = require("node:assert/strict");

// HD turetme, mnemonic'i modul yuklenirken degil cagri aninda okur; yine de
// testin sirasindan bagimsiz olmasi icin en basta ayarliyoruz.
process.env.TRON_HD_MNEMONIC =
	process.env.TRON_HD_MNEMONIC ||
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const hdWallet = require("../utils/crypto/hdWallet");
const { getCurrency, listCurrencies } = require("../config/crypto");

test("HD turetme bilinen BIP39 vektorunu uretir", () => {
	// Standart test mnemonic'i + m/44'/195'/0'/0/0 -> bilinen TRON adresi.
	// Bu deger degisirse turetme yolu bozulmus demektir ve TUM kullanicilarin
	// adresleri kayar; mevcut adreslere gonderilen paralar goruntulenemez.
	assert.equal(hdWallet.deriveAddress(0), "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH");
});

test("HD turetme deterministtir ve indeksler carpismaz", () => {
	assert.equal(hdWallet.deriveAddress(7), hdWallet.deriveAddress(7));

	const addresses = new Set();
	for (let i = 0; i < 50; i += 1) addresses.add(hdWallet.deriveAddress(i));
	assert.equal(addresses.size, 50, "farkli indeksler farkli adres uretmeli");
});

test("HD turetme gecersiz indeksi reddeder", () => {
	// Negatif/kesirli indeks sessizce yuvarlanirsa iki kullanici ayni adresi
	// paylasabilir; bu yuzden hata firlatmali.
	for (const bad of [-1, 1.5, NaN, Infinity, "0", null, undefined]) {
		assert.throws(() => hdWallet.deriveAddress(bad), /indeks/i);
	}
});

test("seed eksikken anlasilir hata verir ve seed sizdirmaz", () => {
	// Mnemonic ilk okumada onbellege alindigi icin bu senaryo ayni surecte
	// test edilemez; temiz bir alt surecte calistiriyoruz.
	const { execFileSync } = require("node:child_process");
	const script = `
		const hd = require("${require.resolve("../utils/crypto/hdWallet")}");
		if (hd.isConfigured()) { console.log("BEKLENMEDIK_YAPILANDIRILMIS"); process.exit(0); }
		try { hd.deriveAddress(0); console.log("HATA_FIRLATMADI"); }
		catch (err) { console.log(JSON.stringify({ message: err.message, stack: err.stack })); }
	`;

	const env = { ...process.env };
	delete env.TRON_HD_MNEMONIC;

	const raw = execFileSync(process.execPath, ["-e", script], {
		env,
		encoding: "utf8",
	}).trim();

	assert.ok(!raw.startsWith("BEKLENMEDIK"), raw);
	assert.notEqual(raw, "HATA_FIRLATMADI", "seed yokken hata firlatmali");

	const { message, stack } = JSON.parse(raw);
	assert.match(message, /TRON_HD_MNEMONIC/, "hangi degiskenin eksik oldugunu soylemeli");
	// Seed ne mesajda ne de yigin izinde gorunmemeli.
	assert.ok(!/abandon/.test(`${message}${stack}`), "seed sizdirilmamali");
});

test("sozlesme adresi olmayan token para birimi sunulmaz", () => {
	// Sozlesme adresi bilinmeden token transferi izlenemez. Para birimini yine
	// de sunmak, kullanicinin parayi gonderip kredi alamamasi demektir.
	const codes = listCurrencies().map((currency) => currency.code);
	for (const code of codes) {
		const currency = getCurrency(code);
		assert.ok(
			currency.code === "TRX" || currency.contract,
			`${code} sozlesme adresi olmadan listelenmemeli`,
		);
	}
});

test("TRX her zaman kullanilabilir ve dogru turetme bilgisine sahip", () => {
	const trx = getCurrency("TRX");
	assert.ok(trx, "TRX kullanilabilir olmali");
	assert.equal(trx.decimals, 6);
	assert.equal(trx.chain, "TRON");
	// Tutarlar tam sayi olmali; float esik para farki yaratir.
	assert.ok(Number.isInteger(trx.minDepositUnits));
});

test("desteklenmeyen para birimi null doner", () => {
	for (const code of ["BTC", "DOGE", "", null, undefined, "usdt"]) {
		if (code === "usdt") continue; // buyuk/kucuk harf duyarsizligi ayri test
		assert.equal(getCurrency(code), null);
	}
});

test("para birimi kodu buyuk/kucuk harf duyarsizdir", () => {
	assert.equal(getCurrency("trx").code, "TRX");
});

test("config cuzdan tanimlari rivoWallet korumasiyla birebir uyusur", () => {
	// EN KRITIK TUTARLILIK KONTROLU.
	// normalizeWalletState yalnizca CRYPTO_DEPOSIT_WALLET_KEYS listesindeki
	// cuzdanlari korur; listede olmayan her cuzdan her kaydetmede SILINIR.
	// Bir harf farki (or. "trc20" yerine "trc-20") kredi edilen bakiyenin
	// sessizce yok olmasi demektir.
	const {
		CRYPTO_DEPOSIT_WALLET_KEYS,
		isCryptoDepositWallet,
	} = require("../utils/rivoWallet");

	for (const currency of listCurrencies()) {
		const wallet = {
			coinType: currency.walletCode,
			chain: currency.chain,
			type: currency.type,
		};
		assert.ok(
			isCryptoDepositWallet(wallet),
			`${currency.code} cuzdani korunmuyor. Beklenen anahtarlardan biri: ` +
				`${CRYPTO_DEPOSIT_WALLET_KEYS.join(", ")} — uretilen: ` +
				`${wallet.coinType}|${wallet.chain}|${wallet.type}`,
		);
	}
});

test("kripto cuzdani normalize sonrasi hayatta kalir", () => {
	// Uctan uca koruma: izleyicinin olusturacagi cuzdan sekli, gercek
	// normalizeWalletState cagrisindan gectikten sonra da durmali.
	const { normalizeWalletState } = require("../utils/rivoWallet");

	for (const currency of listCurrencies()) {
		const { wallets } = normalizeWalletState({
			wallets: [
				{ coinType: "Rivo", chain: "TRON", type: "trc-20", balance: 0 },
				{
					coinType: currency.walletCode,
					chain: currency.chain,
					type: currency.type,
					balance: 123,
				},
			],
			currency: {},
		});

		const survived = wallets.find(
			(wallet) => wallet.coinType === currency.walletCode,
		);
		assert.ok(survived, `${currency.code} cuzdani normalize sonrasi silindi`);
		assert.equal(survived.balance, 123, "bakiye korunmali");
	}
});
