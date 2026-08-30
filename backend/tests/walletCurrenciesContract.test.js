/**
 * /wallet/currencies ile casino-ui cuzdan modali arasindaki SOZLESME testleri.
 *
 * Bu iki taraf ayri dilde/ayri repoda gibi yasiyor: backend JSON uretiyor,
 * modal onu Vue sablonunda okuyor. Alan adlari sessizce ayrisirsa hicbir
 * sey patlamaz — kutu sadece BOS gorunur. Gercekte yasanan iki vaka:
 *
 *   1) Backend `networks: [{ id, name }]` gonderiyordu, sablon `n.label`
 *      okuyordu -> Ag secici veri gelse bile hep bostu.
 *   2) Backend `coin-trx.png` ikonunu isaret ediyordu ama dosya repoda yoktu
 *      -> yatirma ekraninda kirik gorsel.
 *
 * Ikisi de derleme/lint hatasi vermez; yalnizca boyle bir test yakalar.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { listCurrencies } = require("../config/crypto");
const { RIVO_WALLET } = require("../utils/rivoWallet");
const {
	buildCurrencyList,
	networkLabel,
	coinIconPath,
} = require("../utils/walletCurrencies");

const backendRoot = path.join(__dirname, "..");
const repoRoot = path.join(backendRoot, "..");
const casinoUi = path.join(repoRoot, "frontend", "public", "casino-ui");

const walletRouteSource = () =>
	fs.readFileSync(path.join(backendRoot, "routes", "wallet.js"), "utf8");
const walletModalSource = () =>
	fs.readFileSync(path.join(casinoUi, "wallet-modal.js"), "utf8");
const indexHtmlSource = () =>
	fs.readFileSync(path.join(casinoUi, "index.html"), "utf8");

test("backend her ag girdisine kullaniciya gosterilecek bir label koyar", () => {
	// `label` dusarse Ag secici tekrar bosalir. Gercek fonksiyonu cagiriyoruz.
	const list = buildCurrencyList([], new Map());
	assert.ok(list.length > 0, "yatirilabilir para birimi listesi bos");

	for (const entry of list) {
		assert.ok(
			Array.isArray(entry.networks) && entry.networks.length > 0,
			`${entry.code} icin ag listesi yok`,
		);
		for (const network of entry.networks) {
			assert.equal(
				typeof network.label,
				"string",
				`${entry.code} agi label tasimiyor`,
			);
			assert.ok(network.label.length > 0, `${entry.code} agi bos label tasiyor`);
		}
	}
});

test("ag etiketi zincirin yani sira token standardini da icerir", () => {
	// Yanlis agda gonderilen kripto GERI ALINAMAZ; "TRON" tek basina
	// kullaniciya TRC-20 mi ERC-20 mi oldugunu soylemez.
	assert.equal(networkLabel("TRON", "trc-20"), "TRON (TRC-20)");
	assert.equal(networkLabel("tron", "TRC-20"), "TRON (TRC-20)");

	// Native transferde parantezli standart anlamsiz olurdu.
	assert.equal(networkLabel("TRON", "native"), "TRON");
	assert.equal(networkLabel("TRON", ""), "TRON");

	// Gercek listede USDT token, TRX native olmali.
	const list = buildCurrencyList([], new Map());
	const usdt = list.find((entry) => entry.code === "USDT");
	const trx = list.find((entry) => entry.code === "TRX");
	assert.equal(usdt.networks[0].label, "TRON (TRC-20)");
	assert.equal(trx.networks[0].label, "TRON");
});

test("yatirilabilir birimler cuzdan olmasa bile listelenir", () => {
	// Cuzdan ilk yatirim kredi edildiginde olusuyor. Bu satir dusserse
	// kullanici USDT'yi hic goremeden para yatiramaz (tavuk-yumurta).
	const codes = buildCurrencyList([], new Map()).map((entry) => entry.code);
	assert.ok(codes.includes("USDT"), "cuzdansiz kullanici USDT goremiyor");
	assert.ok(
		buildCurrencyList([], new Map()).every((entry) => entry.depositable),
		"yatirilabilir isareti dusmus",
	);
});

test("sablon ag adini networkLabel uzerinden okur, ham .label ile degil", () => {
	const html = indexHtmlSource();
	assert.match(
		html,
		/<strong>\{\{networkLabel\(depositNetwork\)\}\}<\/strong>/,
		"secili ag yine ham alan okuyor",
	);
	assert.match(
		html,
		/v-for="n in networkOptions">\{\{networkLabel\(n\)\}\}/,
		"ag listesi yine ham alan okuyor",
	);
});

test("networkLabel eski `name` alanina geri duser", () => {
	// Backend eski surumdeyken bile kutu bos kalmamali.
	const source = walletModalSource();
	assert.match(
		source,
		/return network\.label \|\| network\.name \|\| network\.id \|\| ""/,
	);
});

test("backendin uretebilecegi her coin ikonu diskte gercekten var", () => {
	// Backend ikon yolunu koddan uretiyor: coin-<code>.png. Yeni bir para
	// birimi eklenip ikonu unutulursa kullanici kirik gorsel gorur.
	const codes = new Set(
		listCurrencies().map((currency) => currency.walletCode.toUpperCase()),
	);
	codes.add(RIVO_WALLET.coinType.toUpperCase()); // her kullanicida varsayilan

	const missing = [...codes].filter(
		(code) =>
			!fs.existsSync(path.join(casinoUi, "assets", `coin-${code.toLowerCase()}.png`)),
	);

	assert.deepEqual(
		missing,
		[],
		`ikon dosyasi eksik: ${missing.map((c) => `coin-${c.toLowerCase()}.png`).join(", ")}`,
	);
});

test("backend ikon yolunu assets klasoruyle ayni sekilde uretir", () => {
	// Ustteki varlik testi bu sema uzerine kurulu; sema degisirse o test
	// yanlis yeri kontrol etmeye baslar ve sessizce degersizlesir.
	assert.equal(coinIconPath("USDT"), "/casino-ui/assets/coin-usdt.png");

	// Uretilen her ikon yolu gercekten diskteki bir dosyaya karsilik gelmeli.
	for (const entry of buildCurrencyList([], new Map())) {
		const diskPath = path.join(casinoUi, entry.icon.replace("/casino-ui/", ""));
		assert.ok(
			fs.existsSync(diskPath),
			`${entry.code} ikonu bulunamadi: ${entry.icon}`,
		);
	}
});

test("openDeposit oturum kontrolu yapar", () => {
	// Tum /wallet/* uclari authorizeUser(true) istiyor. Guard olmadan modal
	// aciliyor, her istek 401 donuyor ve kullanici bos kutulara bakiyor.
	const source = walletModalSource();
	const openDeposit = source.match(
		/function openDeposit\(tab\) \{([\s\S]*?)\n  \}/,
	);
	assert.ok(openDeposit, "openDeposit bulunamadi");
	assert.match(
		openDeposit[1],
		/if \(!authUser\.value\) \{[\s\S]*?requestAuth\("login"\)[\s\S]*?return/,
		"openDeposit oturum korumasini kaybetmis",
	);
});

test("cuzdan hatasi kullaniciya gosterilir", () => {
	// walletError uzun sure set ediliyor ama hicbir yerde render edilmiyordu;
	// 401/500 gibi hatalar tamamen sessizdi.
	assert.match(
		indexHtmlSource(),
		/class="wm-alert" role="alert" v-if="walletError">\{\{walletError\}\}/,
		"walletError yeniden gorunmez hale gelmis",
	);
});
