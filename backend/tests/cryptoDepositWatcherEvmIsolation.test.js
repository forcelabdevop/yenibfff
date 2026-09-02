const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.EVM_HD_MNEMONIC =
	process.env.EVM_HD_MNEMONIC ||
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
process.env.TRON_HD_MNEMONIC =
	process.env.TRON_HD_MNEMONIC ||
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const { MongoMemoryServer } = require("mongodb-memory-server");

const JobLock = require("../database/models/JobLock");
const CryptoAddress = require("../database/models/CryptoAddress");
const evmClient = require("../utils/crypto/evmClient");
const watcher = require("../services/cryptoDepositWatcherEvm");

let mongod;

test.before(async () => {
	mongod = await MongoMemoryServer.create();
	await mongoose.connect(mongod.getUri(), { dbName: "crypto-evm-isolation-test" });
	await Promise.all([JobLock.syncIndexes(), CryptoAddress.syncIndexes()]);
});

test.after(async () => {
	await mongoose.disconnect();
	if (mongod) await mongod.stop();
});

// scanNetwork'un getSafeBlock asamasi (dosyanin ic try/catch'inin DISINDA)
// bir RPC cagrisi (evmClient.getCurrentBlock / getFinalizedBlockNumber)
// yapar ve bu cagri hata firlatabilir. Canli hatanin kok nedeni: runOnce
// eskiden her para birimini TEK bir try/catch icinde tarardi; bir agin
// (orn. Polygon) RPC arizasi tum turu iptal ediyor, ETH/BSC yatirimlari da
// hic taranmiyordu. Bu test, evmClient'i RPC seviyesinde sahteleyerek
// Polygon'u kasitli olarak hata firlatir ve ETHEREUM/BEP20'nin YINE DE
// tarandigini dogrular.
test("bir agin RPC hatasi runOnce'in diger aglari taramasini engellemez", async () => {
	const originalGetCurrentBlock = evmClient.getCurrentBlock;
	const originalGetFinalizedBlockNumber = evmClient.getFinalizedBlockNumber;
	const calledNetworks = [];

	evmClient.getCurrentBlock = async (network) => {
		calledNetworks.push(network);
		if (network === "POLYGON") {
			throw new Error("RPC baglantisi basarisiz (simule edilmis)");
		}
		return 1000;
	};
	// BEP20 once bu fonksiyonu dener; null dondururek getCurrentBlock'a
	// dusmesini sagliyoruz (yukaridaki mock zaten calledNetworks'u dolduruyor).
	evmClient.getFinalizedBlockNumber = async () => null;

	try {
		await watcher.runOnce();
	} finally {
		evmClient.getCurrentBlock = originalGetCurrentBlock;
		evmClient.getFinalizedBlockNumber = originalGetFinalizedBlockNumber;
		await JobLock.release(watcher.LOCK_KEY, undefined).catch(() => {});
	}

	assert.ok(calledNetworks.includes("POLYGON"), "Polygon taranmaya calisilmali");
	assert.ok(
		calledNetworks.includes("ETHEREUM"),
		"Polygon hata firlatsa bile ETHEREUM taranmaya devam etmeli",
	);
	assert.ok(
		calledNetworks.includes("BEP20"),
		"Polygon hata firlatsa bile BEP20 taranmaya devam etmeli",
	);
});
