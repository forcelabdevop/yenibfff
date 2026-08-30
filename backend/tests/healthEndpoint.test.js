const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const express = require("express");

/**
 * /health ucu, catch-all 404 handler'indan ONCE tanimlanmak ZORUNDA.
 *
 * Yasanan hata: /health, `app.use("/", require("./routes")(io))` satirindan
 * SONRA tanimlanmisti. routes/index.js sonunda her istegi yakalayan bir
 * `router.use(...)` 404 handler'i var. Express sirayla eslestirdigi icin
 * catch-all /health'i yutuyordu ve uc her zaman su cevabi donuyordu:
 *
 *   {"success":false,"message":"Endpoint not found"}
 *
 * Sonucu ciddiydi: deploy.sh saglik kontrolunde 200 bekliyor
 * (scripts/deploy.sh:241). Uc hicbir zaman 200 donmedigi icin otomatik
 * dagitim her seferinde basarisiz sayilip GERI ALINIRDI.
 */

const INDEX_PATH = path.join(__dirname, "..", "index.js");

test("/health, routes mount'undan ONCE tanimlanmali", () => {
	const lines = fs.readFileSync(INDEX_PATH, "utf8").split("\n");

	const healthLine = lines.findIndex((l) => l.includes('app.get("/health"'));
	const mountLine = lines.findIndex((l) =>
		/app\.use\(\s*"\/"\s*,\s*require\("\.\/routes"\)/.test(l),
	);

	assert.notEqual(healthLine, -1, "/health tanimi bulunamadi");
	assert.notEqual(mountLine, -1, "routes mount satiri bulunamadi");

	assert.ok(
		healthLine < mountLine,
		`/health (satir ${healthLine + 1}) routes mount'undan (satir ${
			mountLine + 1
		}) SONRA tanimlanmis. Catch-all 404 handler onu yutar ve uc erisilemez ` +
			"hale gelir; deploy.sh her dagitimi geri alir.",
	);
});

test("/health yalnizca bir kez tanimlanmis", () => {
	// Tasima sirasinda eski blogun silinmemesi sessiz bir tekrar birakirdi;
	// ikinci tanim (mount'tan sonraki) olu kod olurdu.
	const src = fs.readFileSync(INDEX_PATH, "utf8");
	const count = src.split('app.get("/health"').length - 1;
	assert.equal(count, 1, `/health ${count} kez tanimlanmis, 1 olmali`);
});

/**
 * Mekanizmayi davranissal olarak da gosterir: catch-all'dan SONRA tanimlanan
 * bir rota gercekten erisilemez olur. Bu, ustteki statik kontrolun neden
 * gerekli oldugunu kanitlar.
 */
test("catch-all'dan sonra tanimlanan rota erisilemez olur", async () => {
	const app = express();

	// Gercek yapinin kucuk bir kopyasi: once mount + catch-all...
	const router = express.Router();
	router.get("/birsey", (req, res) => res.json({ ok: true }));
	router.use((req, res) => {
		res.status(404).json({ success: false, message: "Endpoint not found" });
	});
	app.use("/", router);

	// ...sonra /health (YANLIS sira — hatanin ta kendisi)
	app.get("/health", (req, res) => res.status(200).json({ ok: true }));

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, resolve));
	const port = server.address().port;

	try {
		const res = await fetch(`http://127.0.0.1:${port}/health`);
		const body = await res.json();

		// Catch-all kazanir: 200 degil 404 gelir.
		assert.equal(res.status, 404, "catch-all /health'i yutmaliydi");
		assert.equal(body.message, "Endpoint not found");
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});

test("catch-all'dan once tanimlanan rota erisilebilir", async () => {
	const app = express();

	// DOGRU sira: once /health...
	app.get("/health", (req, res) => res.status(200).json({ ok: true }));

	// ...sonra mount + catch-all
	const router = express.Router();
	router.use((req, res) => {
		res.status(404).json({ success: false, message: "Endpoint not found" });
	});
	app.use("/", router);

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, resolve));
	const port = server.address().port;

	try {
		const res = await fetch(`http://127.0.0.1:${port}/health`);
		assert.equal(res.status, 200, "/health erisilebilir olmaliydi");
		assert.equal((await res.json()).ok, true);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});
