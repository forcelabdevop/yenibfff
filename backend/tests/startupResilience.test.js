const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mongoose = require("mongoose");

/**
 * Baslangic dayanikliligi.
 *
 * Arka plan: nginx error log'unda 4 ayda 304 kesinti penceresi vardi;
 * dokuzu 20 dakikadan uzun, en uzunu 2,8 saat. Sebep tek bir bozuk uc
 * degildi — dort PM2 worker'i ayni anda oluyordu.
 *
 * Zincir soyleydi:
 *   connectDB catch -> process.exit(1)
 *     -> PM2 dort worker'i da aninda yeniden baslatir
 *       -> Atlas hala erisilemez, tekrar exit
 *         -> varsayilan max_restarts (16) saniyeler icinde tukenir
 *           -> PM2 uygulamayi "errored" isaretler ve BIRAKIR
 *             -> site, biri elle `pm2 restart` yazana kadar kapali
 *
 * Buradaki testler o zincirin her halkasini kirik tutar.
 */

const DB_MODULE_PATH = require.resolve("../database");

/** database modulunu temiz durumda yeniden yukler. */
const loadDbModule = () => {
	delete require.cache[DB_MODULE_PATH];
	return require("../database");
};

test("instance 0 ve PM2 disi calisma birincil sayilir", () => {
	const { isPrimaryInstance } = loadDbModule();
	const original = process.env.NODE_APP_INSTANCE;

	try {
		// PM2 disinda (yerel `node index.js`) degisken tanimsizdir; tek surec
		// oldugumuz icin baslangic gorevlerini calistirmaliyiz.
		delete process.env.NODE_APP_INSTANCE;
		assert.equal(isPrimaryInstance(), true, "PM2 disi birincil olmali");

		process.env.NODE_APP_INSTANCE = "0";
		assert.equal(isPrimaryInstance(), true, "instance 0 birincil olmali");

		// Diger worker'lar baslangic gorevlerine girmemeli; aksi halde dordu
		// birden ayni koleksiyonlarda index senkronu ve seed yarisi yapar.
		for (const id of ["1", "2", "3"]) {
			process.env.NODE_APP_INSTANCE = id;
			assert.equal(
				isPrimaryInstance(),
				false,
				`instance ${id} birincil sayilmamali`,
			);
		}
	} finally {
		if (original === undefined) delete process.env.NODE_APP_INSTANCE;
		else process.env.NODE_APP_INSTANCE = original;
	}
});

test("ikincil instance baslangic gorevlerine hic girmez", async () => {
	const { runStartupTasks } = loadDbModule();
	const original = process.env.NODE_APP_INSTANCE;

	try {
		process.env.NODE_APP_INSTANCE = "2";
		// Veritabani baglantisi olmadan cagriliyor. Gorevlere girseydi
		// mongoose buffer zaman asimina duser ve bu test asilirdi.
		await runStartupTasks();
	} finally {
		if (original === undefined) delete process.env.NODE_APP_INSTANCE;
		else process.env.NODE_APP_INSTANCE = original;
	}
});

test("baglanti hatasi sureci OLDURMEZ, yeniden dener", async () => {
	const dbModule = loadDbModule();
	const originalConnect = mongoose.connect;
	const originalExit = process.exit;
	const originalInstance = process.env.NODE_APP_INSTANCE;

	let attempts = 0;
	let exitCalled = false;

	try {
		// Ikincil instance: baglanti kurulduktan sonra gercek migration'lara
		// girmesin, test veritabanina dokunmayalim.
		process.env.NODE_APP_INSTANCE = "1";

		process.exit = (code) => {
			exitCalled = true;
			throw new Error(`process.exit(${code}) cagrildi — olmamaliydi`);
		};

		mongoose.connect = async () => {
			attempts += 1;
			if (attempts < 2) {
				throw new Error("simule edilmis Atlas kesintisi");
			}
			return { connection: { host: "test-host" } };
		};

		await dbModule();

		assert.equal(exitCalled, false, "process.exit cagrilmamaliydi");
		assert.equal(attempts, 2, "basarisiz denemeden sonra yeniden denemeliydi");
	} finally {
		mongoose.connect = originalConnect;
		process.exit = originalExit;
		if (originalInstance === undefined) delete process.env.NODE_APP_INSTANCE;
		else process.env.NODE_APP_INSTANCE = originalInstance;
	}
});

test("bir baslangic gorevi patlarsa digerleri yine de calisir", async () => {
	// Gercek risk buydu: veritabani gayet saglikliyken bile bir migration
	// hata verirse eski kod `process.exit(1)` cagiriyordu — cunku
	// migration'lar baglantiyla AYNI try/catch icindeydi.
	const { runTasksSafely } = loadDbModule();
	const calisanlar = [];

	await runTasksSafely([
		[
			"patlayan gorev",
			async () => {
				calisanlar.push("patlayan");
				throw new Error("simule edilmis migration hatasi");
			},
		],
		[
			"sonraki gorev",
			async () => {
				calisanlar.push("sonraki");
			},
		],
	]);

	// Kritik: ilk gorev patladi ama ikincisi yine de calisti ve cagri
	// normal sekilde dondu (throw etmedi, exit cagirmadi).
	assert.deepEqual(
		calisanlar,
		["patlayan", "sonraki"],
		"bir gorevin hatasi sonraki gorevleri engellememeli",
	);
});

test("PM2 yeniden baslatma butcesi pes etmeyecek kadar genis", () => {
	// Yapilandirmayi veri olarak yukluyoruz (kaynak kodu regex'lemiyoruz),
	// boylece bicim degisiklikleri testi sessizce degersizlestirmez.
	const config = require("../ecosystem.config.js");
	const app = config.apps[0];

	assert.ok(
		app.max_restarts >= 50,
		`max_restarts en az 50 olmali, su an ${app.max_restarts}. ` +
			"Varsayilan 16'dir ve saniyeler icinde tukenir.",
	);
	assert.ok(
		app.exp_backoff_restart_delay > 0,
		"exp_backoff_restart_delay tanimli olmali; yoksa denemeler aninda " +
			"art arda yapilip butceyi tuketir",
	);
	assert.ok(
		app.min_uptime >= 10000,
		"min_uptime tanimli olmali; yoksa aylar icinde biriken bagimsiz " +
			"cokmeler yeniden baslatma butcesini yavas yavas tuketir",
	);

	// Giris dosyasi gercekten var mi? Yanlis script adi pm2'yi
	// "Script not found" ile aninda cokertir.
	const scriptPath = path.join(__dirname, "..", app.script);
	assert.ok(fs.existsSync(scriptPath), `giris dosyasi bulunamadi: ${app.script}`);
});

test("surec seviyesi hata yakalayicilar kurulu", () => {
	// Not: index.js'i require etmek tum sunucuyu (port dinleme, cron, socket)
	// ayaga kaldirirdi; bu yuzden burada kaynak kontrolu yapiyoruz. Bicim
	// degisikligine karsi hassas oldugunu bilerek kabul ediyoruz — amac
	// yakalayicilarin yanlislikla SILINMESINI fark etmek.
	const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

	assert.match(
		source,
		/process\.on\(\s*["']unhandledRejection["']/,
		"unhandledRejection yakalayicisi yok: yakalanmamis bir promise reddi " +
			"Node 16+ uzerinde sureci SESSIZCE oldurur",
	);
	assert.match(
		source,
		/process\.on\(\s*["']uncaughtException["']/,
		"uncaughtException yakalayicisi yok: cokme sebebi hicbir yere yazilmaz",
	);
	// Veritabani cagrisinin bagli bir .catch()'i olmali; yoksa reddi
	// yukaridaki unhandledRejection'a duser ve sebebi kaybolur.
	assert.match(
		source,
		/require\(["']\.\/database["']\)\(\)\s*\.catch\(/,
		"database cagrisina .catch() baglanmamis",
	);
});
