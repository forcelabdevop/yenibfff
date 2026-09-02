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
	//
	// DIKKAT: hdWallet mnemonic'i modul-seviyesinde `cachedMnemonic` olarak
	// onbellege alir ve bu test dosyasi ustteki `process.env.TRON_HD_MNEMONIC =
	// ... || ...` satiri YALNIZCA ortamda deger yoksa standart vektoru kullanir.
	// Gercek bir ortamda (bu proje gibi) TRON_HD_MNEMONIC zaten tanimliysa bu
	// test o gercek mnemonic'i kullanir ve bilinen adres yerine baska bir adres
	// uretip YANLIS YERE basarisiz olur — turetme yolu bozuk degildir, sadece
	// test ortamdan sizan gercek seed'i kullanmistir. Bu yuzden bilinen vektoru
	// ayri bir alt surecte, ortami tamamen gormezden gelerek dogruluyoruz.
	const { execFileSync } = require("node:child_process");
	const script = `
		process.env.TRON_HD_MNEMONIC =
			"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
		const hd = require("${require.resolve("../utils/crypto/hdWallet")}");
		console.log(hd.deriveAddress(0));
	`;
	const env = { ...process.env };
	delete env.TRON_HD_MNEMONIC;
	const address = execFileSync(process.execPath, ["-e", script], { env }).toString().trim();
	assert.equal(address, "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH");
});

test("EVM HD turetme bilinen BIP39 vektorunu uretir", () => {
	const { execFileSync } = require("node:child_process");
	const script = `
		process.env.EVM_HD_MNEMONIC =
			"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
		const wallet = require("${require.resolve("../utils/crypto/evmWallet")}");
		console.log(wallet.deriveAddress(0));
	`;
	const env = { ...process.env };
	delete env.EVM_HD_MNEMONIC;
	const address = execFileSync(process.execPath, ["-e", script], { env }).toString().trim();
	assert.equal(address, "0x9858EfFD232B4033E47d90003D41EC34EcaEda94");
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
				currency.type === "native" || currency.contract,
			`${code} sozlesme adresi olmadan listelenmemeli`,
		);
	}
});

test("Ethereum, BSC ve Polygon native + USDT/USDC kombinasyonlari tanimlidir", () => {
	const expected = [
		"ETH_ETHEREUM", "USDT_ETHEREUM", "USDC_ETHEREUM",
		"BNB_BEP20", "USDT_BEP20", "USDC_BEP20",
		"POL_POLYGON", "USDT_POLYGON", "USDC_POLYGON",
	];
	for (const code of expected) {
		const currency = getCurrency(code);
		assert.ok(currency, `${code} tanimli olmali`);
		assert.equal(currency.family, "EVM");
		assert.ok(Number.isInteger(currency.minDepositUnits));
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

test("para birimi kodu buyuk/kucuk harf duyarsizdir (tam anahtar icin)", () => {
	assert.equal(getCurrency("trx").code, "TRX");
	assert.equal(getCurrency("usdt_trc20").code, "USDT_TRC20");
	assert.equal(getCurrency("usdt_bep20").code, "USDT_BEP20");
	assert.equal(getCurrency("usdt_polygon").code, "USDT_POLYGON");
});

test("kisa cuzdan kodu ('usdt') artik birden fazla aga karsilik geldigi icin BILEREK belirsizdir", () => {
	// USDT artik TRC20/BEP20/POLYGON aglarinda var. Kisa kodu tek bir aga
	// sessizce baglamak, yanlis agda adres uretme riski tasir — bu yuzden
	// getCurrency() BILEREK null doner (bkz. config/crypto.js getCurrency).
	// Arayuz/route her zaman TAM kodu (currency.code) gondermelidir.
	assert.equal(getCurrency("usdt"), null);
	assert.equal(getCurrency("USDT"), null);
});

test("arayuzun gonderdigi cuzdan kodu, YALNIZ TEK bir aga karsilik geliyorsa para birimini bulur", () => {
	// walletCode -> currency eslemesi ARTIK N:1 olabilir (USDT -> 3 ag).
	// Bu yuzden yalniz TEK eslesmesi olan walletCode'lar (or. TRX) icin kisa
	// kod fallback'i calismali; birden fazla eslesmesi olanlar (USDT) icin
	// arayuz/route TAM kodu (currency.code) gondermeye zorlanmalidir.
	const walletCodeCounts = new Map();
	for (const currency of listCurrencies()) {
		const key = currency.walletCode.toUpperCase();
		walletCodeCounts.set(key, (walletCodeCounts.get(key) || 0) + 1);
	}

	for (const currency of listCurrencies()) {
		assert.equal(
			getCurrency(currency.code)?.code,
			currency.code,
			`tam anahtar calismali: ${currency.code}`,
		);

		const isUnique = walletCodeCounts.get(currency.walletCode.toUpperCase()) === 1;
		assert.equal(
			getCurrency(currency.walletCode)?.code,
			isUnique ? currency.code : undefined,
			isUnique
				? `benzersiz cuzdan kodu calismali: ${currency.walletCode}`
				: `belirsiz cuzdan kodu (${currency.walletCode}) tam kod gerektirmeli, yanlislikla ${currency.code}'a cozulmemeli`,
		);
	}
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
