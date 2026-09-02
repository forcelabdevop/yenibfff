/**
 * GET /payment/fiat-methods — Cash sekmesinin para birimi + saglayici
 * listesini SiteSettings.isActive bayraklarindan dogru turettigini dogrular.
 *
 * Bu uc olmadan once cuzdan modalindeki Cash sekmesi HICBIR ZAMAN gercek bir
 * fiat para birimi gormuyordu (/wallet/currencies her girdiyi `fiat:false`
 * olarak uretiyor, bkz. utils/walletCurrencies.js) — secim sabit/bos kalirdi.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");

const SiteSettings = require("../database/models/SiteSettings");
const fiatMethodsRoutes = require("../routes/payment/fiatMethods");

let mongod;
let server;
let baseUrl;

test.before(async () => {
	mongod = await MongoMemoryServer.create();
	await mongoose.connect(mongod.getUri(), { dbName: "fiat-methods-test" });

	const app = express();
	app.use(express.json());
	app.use("/payment", fiatMethodsRoutes);

	server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, resolve));
	baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
	await new Promise((resolve) => server.close(resolve));
	await mongoose.disconnect();
	if (mongod) await mongod.stop();
});

test.beforeEach(async () => {
	await SiteSettings.deleteMany({});
});

const getFiatMethods = async () => {
	const res = await fetch(`${baseUrl}/payment/fiat-methods`);
	return { status: res.status, body: await res.json() };
};

test("hicbir saglayici aktif degilse bos liste doner (sabit/yanlis liste GOSTERMEZ)", async () => {
	await SiteSettings.create({});
	const { status, body } = await getFiatMethods();

	assert.equal(status, 200);
	assert.equal(body.success, true);
	assert.deepEqual(body.data.currencies, []);
	assert.deepEqual(body.data.providers, []);
});

test("tek bir saglayici aktifse currency listesi onun para birimine gore kurulur", async () => {
	await SiteSettings.create({
		forcelabFinance: { isActive: true, name: "Forcelab Finance", currency: "TRY", minAmount: 100, maxAmount: 50000 },
	});
	const { body } = await getFiatMethods();

	assert.deepEqual(body.data.currencies, [{ code: "TRY", name: "TRY" }]);
	assert.equal(body.data.providers.length, 1);
	assert.equal(body.data.providers[0].slug, "forcelab-finance");
	assert.equal(body.data.providers[0].currency, "TRY");
	assert.equal(body.data.providers[0].minAmount, 100);
	assert.equal(body.data.providers[0].maxAmount, 50000);
});

test("ayni currency'de birden fazla saglayici aktifse hepsi listelenir, currency TEKRARLANMAZ", async () => {
	await SiteSettings.create({
		forcelabFinance: { isActive: true, name: "Forcelab Finance", currency: "TRY" },
		meelDev: { isActive: true, name: "MeelDev", currency: "TRY" },
		xPayments: { isActive: false, name: "XPayment", currency: "TRY" },
	});
	const { body } = await getFiatMethods();

	assert.deepEqual(body.data.currencies, [{ code: "TRY", name: "TRY" }]);
	const slugs = body.data.providers.map((p) => p.slug).sort();
	assert.deepEqual(slugs, ["forcelab-finance", "meeldev"]);
});

test("GalaxyPay kasitli olarak listeye dahil edilmez", async () => {
	await SiteSettings.create({
		galaxyPay: { isActive: true, name: "GalaxyPay", currency: "TRY" },
	});
	const { body } = await getFiatMethods();

	assert.deepEqual(body.data.providers, []);
	assert.deepEqual(body.data.currencies, []);
});

test("isActive:false olan saglayici currency listesine katkida bulunmaz", async () => {
	await SiteSettings.create({
		fluxKripto: { isActive: false, name: "FluxKripto", currency: "TRY" },
	});
	const { body } = await getFiatMethods();

	assert.deepEqual(body.data.currencies, []);
	assert.deepEqual(body.data.providers, []);
});
