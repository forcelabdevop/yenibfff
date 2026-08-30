const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
	formatUnits,
	displayCodeFor,
} = require("../routes/admin/cryptoDeposits");
const { CURRENCIES } = require("../config/crypto");

/**
 * Admin kripto yatirma IZLEME ekraninin sozlesmesi.
 *
 * Iki sey korunuyor:
 *  1) Tutar gosterimi. Zincirdeki tutar en kucuk birimde TAM SAYI tutulur;
 *     float'a cevirip bolmek yuvarlama hatasi (yani para farki) uretir.
 *  2) Ekranin SALT OKUNUR kalmasi. Panelden manuel kredi vermek, zincirde
 *     karsiligi olmayan bakiye yaratmanin en kolay yoludur.
 */

test("tutar en kucuk birimden kayipsiz bicimlenir", () => {
	assert.equal(formatUnits(1000000, 6), "1");
	assert.equal(formatUnits(1500000, 6), "1.5");
	assert.equal(formatUnits(123456789, 6), "123.456789");
	assert.equal(formatUnits(0, 6), "0");

	// Tek birim: float'a bolunurse 1e-6 gibi bilimsel gosterime duserdi.
	assert.equal(formatUnits(1, 6), "0.000001");
	assert.equal(formatUnits(100, 6), "0.0001");
});

test("buyuk tutarlar float hassasiyetine kurban gitmez", () => {
	// 2^53 ustu degil ama float bolmede son hane kayabilir.
	assert.equal(formatUnits(999999999999, 6), "999999.999999");

	// Number(9007199254740993)/1e6 gibi bir islem son haneyi bozardi.
	const result = formatUnits(1234567890123456, 6);
	assert.equal(result, "1234567890.123456");
	assert.ok(!result.includes("e"), "bilimsel gosterime dusmus");
});

test("gosterim kodu config'teki walletCode ile ayni", () => {
	// Panelde "USDT_TRC20" degil "USDT" gorunmeli; kullanicinin bakiye
	// tarafinda gordugu kod budur.
	assert.equal(displayCodeFor("USDT_TRC20"), "USDT");
	assert.equal(displayCodeFor("TRX"), "TRX");

	// Config'teki her para birimi icin tutarli olmali.
	for (const [key, currency] of Object.entries(CURRENCIES)) {
		assert.equal(
			displayCodeFor(key),
			currency.walletCode,
			`${key} icin gosterim kodu walletCode ile uyusmuyor`,
		);
	}
});

test("bilinmeyen para birimi bos hucre birakmaz", () => {
	// Veritabaninda config'ten kaldirilmis eski bir kayit olabilir; panel
	// bos gostermek yerine anlamli bir sey yazmali.
	assert.equal(displayCodeFor("SOMETHING_NEW"), "SOMETHING");
	assert.equal(displayCodeFor(""), "");
});

test("admin kripto yatirma ekrani SALT OKUNUR kalir", () => {
	// Zincirde dogrulanip otomatik kredi edilen bir akista panelden manuel
	// kredi vermek, mukerrer krediye karsi kurulmus unique index korumasini
	// da devre disi birakir. Yazma ucu eklenirse bu test kirilir.
	const source = fs.readFileSync(
		path.join(__dirname, "../routes/admin/cryptoDeposits.js"),
		"utf8",
	);

	for (const method of ["post", "put", "patch", "delete"]) {
		assert.ok(
			!new RegExp(`router\\.${method}\\s*\\(`).test(source),
			`admin kripto yatirma rotasina router.${method} eklenmis; bu ekran salt okunur olmali`,
		);
	}
});

test("listeleme uclari yetki kontrolu olmadan acilmaz", () => {
	const source = fs.readFileSync(
		path.join(__dirname, "../routes/admin/cryptoDeposits.js"),
		"utf8",
	);

	const getCount = (source.match(/router\.get\s*\(/g) || []).length;
	const permCount = (source.match(/checkPermission\(/g) || []).length;

	assert.ok(getCount > 0, "hic GET ucu yok");
	assert.equal(
		permCount,
		getCount,
		"her GET ucu checkPermission ile korunmali",
	);
	assert.ok(
		source.includes('checkPermission("finance.deposits.read")'),
		"mevcut finance.deposits.read izni kullanilmali (yeni izin uydurma)",
	);
});

test("kullanilan izin seedPermissions icinde tanimli", () => {
	// Var olmayan bir izin kodu yazilirsa hicbir rol bu sayfayi goremez ve
	// hata "sayfa bos" olarak gorunur.
	const seed = fs.readFileSync(
		path.join(__dirname, "../scripts/seedPermissions.js"),
		"utf8",
	);
	assert.ok(
		seed.includes("finance.deposits.read"),
		"finance.deposits.read izni seed dosyasinda tanimli degil",
	);
});

test("turetme indeksi admin yanitinda sizdirilmaz", () => {
	// derivationIndex cuzdan turetme yolunu ele verir ve panelde hicbir ise
	// yaramaz. Yanit alanlarina eklenirse bu test kirilir.
	const source = fs.readFileSync(
		path.join(__dirname, "../routes/admin/cryptoDeposits.js"),
		"utf8",
	);
	assert.ok(
		!/derivationIndex:/.test(source),
		"derivationIndex admin yanitina eklenmis",
	);
});
