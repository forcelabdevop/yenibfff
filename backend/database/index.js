const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { ensureSportsbookGames } = require("../services/sportsbookGames");
const { seedPermissionsAndRoles } = require("../scripts/seedPermissions");
const { migrateUsersToRivoWallet } = require("../utils/rivoWalletMigration");

// Set mongoose mode to strict and deactive auto indexing
mongoose.set("strictQuery", true);
mongoose.set("autoIndex", false);

let modelsLoaded = false;
const AFFILIATE_REFERRER_FIELDS = [
	"affiliates.referrer",
	"affiliates.referrerLevel2",
	"affiliates.referrerLevel3",
];

const getNestedValue = (obj, path) =>
	path.split(".").reduce((current, key) => current?.[key], obj);

const loadAllModels = () => {
	if (modelsLoaded) return;

	const modelsDir = path.join(__dirname, "models");
	const modelFiles = fs
		.readdirSync(modelsDir)
		.filter((file) => file.endsWith(".js"));

	for (const file of modelFiles) {
		require(path.join(modelsDir, file));
	}

	modelsLoaded = true;
};

const syncAllIndexes = async () => {
	const shouldSyncIndexes = process.env.MONGOOSE_SYNC_INDEXES !== "false";

	if (!shouldSyncIndexes) {
		console.log("MongoDB index sync skipped (MONGOOSE_SYNC_INDEXES=false)");
		return;
	}

	loadAllModels();
	const syncResult = await mongoose.connection.syncIndexes();
	const syncedModelCount = Object.keys(syncResult || {}).length;

	console.log(`MongoDB indexes synced for ${syncedModelCount} model(s)`);
};

const cleanupInvalidAffiliateReferrers = async () => {
	const usersCollection = mongoose.connection.collection("users");
	const stringReferrerQuery = {
		$or: AFFILIATE_REFERRER_FIELDS.map((field) => ({
			[field]: { $type: "string" },
		})),
	};

	const cursor = usersCollection.find(stringReferrerQuery, {
		projection: AFFILIATE_REFERRER_FIELDS.reduce(
			(acc, field) => ({ ...acc, [field]: 1 }),
			{ _id: 1 },
		),
	});

	const operations = [];
	let convertedCount = 0;
	let removedCount = 0;
	let updatedUsers = 0;

	for await (const user of cursor) {
		const $set = { updatedAt: new Date() };
		const $unset = {};
		let hasChanges = false;

		for (const field of AFFILIATE_REFERRER_FIELDS) {
			const currentValue = getNestedValue(user, field);

			if (typeof currentValue !== "string") {
				continue;
			}

			if (mongoose.isValidObjectId(currentValue)) {
				$set[field] = new mongoose.Types.ObjectId(currentValue);
				convertedCount += 1;
			} else {
				$unset[field] = "";
				removedCount += 1;
			}

			hasChanges = true;
		}

		if (!hasChanges) {
			continue;
		}

		operations.push({
			updateOne: {
				filter: { _id: user._id },
				update: {
					$set,
					...(Object.keys($unset).length ? { $unset } : {}),
				},
			},
		});
		updatedUsers += 1;

		if (operations.length >= 500) {
			await usersCollection.bulkWrite(operations, { ordered: false });
			operations.length = 0;
		}
	}

	if (operations.length) {
		await usersCollection.bulkWrite(operations, { ordered: false });
	}

	if (updatedUsers > 0) {
		console.log(
			`Affiliate referrer cleanup applied to ${updatedUsers} user(s); converted=${convertedCount}, removed=${removedCount}`,
		);
	}

	return {
		updatedUsers,
		convertedCount,
		removedCount,
	};
};

const seedSystemPermissions = async () => {
	const shouldSeedPermissions = process.env.AUTO_SEED_PERMISSIONS !== "false";

	if (!shouldSeedPermissions) {
		console.log("Permission seeding skipped (AUTO_SEED_PERMISSIONS=false)");
		return;
	}

	await seedPermissionsAndRoles();
	console.log("System permissions seeded");
};

const MONGO_OPTIONS = {
	maxPoolSize: 70,
	minPoolSize: 10,

	serverSelectionTimeoutMS: 5000,
	socketTimeoutMS: 45000,

	// Stability
	family: 4,

	useNewUrlParser: true,
	useUnifiedTopology: true,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * PM2 cluster modunda her worker'a NODE_APP_INSTANCE verir ("0", "1", ...).
 * PM2 disinda (yerel `node index.js`) tanimsizdir; o durumda tek surec
 * oldugumuz icin kendimizi birincil sayariz.
 *
 * Bunun onemi: baslangic gorevleri (index senkronu, migration, seed) 4
 * worker'da ayni anda calisirsa ayni koleksiyonlar uzerinde yarisirlar.
 */
const isPrimaryInstance = () => {
	const id = process.env.NODE_APP_INSTANCE;
	return id === undefined || id === "" || id === "0";
};

/**
 * Baglanti kurulana kadar ustel bekleme ile yeniden dener.
 *
 * Eskiden ilk deneme basarisiz olunca `process.exit(1)` cagriliyordu. PM2
 * cluster'da bu su zinciri uretiyordu: Atlas birkac saniye erisilemez ->
 * dort worker da aninda olur -> PM2 hepsini hemen yeniden baslatir -> yine
 * erisilemez -> varsayilan 16 denemede PM2 uygulamayi "errored" isaretleyip
 * BIRAKIR. Site, biri elle `pm2 restart` yazana kadar kapali kalirdi.
 * (nginx logunda 2,8 saate kadar suren kesintiler bu sekilde olustu.)
 *
 * Artik surec olmuyor; baglanana kadar sessizce yeniden dener. Mongoose ilk
 * baglanti kurulduktan SONRAKI kopmalari zaten kendi icinde toparlar.
 */
const connectWithRetry = async () => {
	const baseDelayMs = 1000;
	const maxDelayMs = 30000;
	let attempt = 0;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		attempt += 1;
		try {
			const conn = await mongoose.connect(
				process.env.DATABASE_URI,
				MONGO_OPTIONS,
			);
			console.log(
				`MongoDB Connected: ${conn.connection.host}` +
					(attempt > 1 ? ` (${attempt}. denemede)` : ""),
			);
			return conn;
		} catch (err) {
			// 1s, 2s, 4s ... 30s'de tavan yapar. Tavan onemli: aksi halde
			// uzun kesintide bekleme saatlere cikar ve Atlas geri geldiginde
			// site hala kapali gorunur.
			const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
			console.error(
				`MongoDB baglanti hatasi (deneme ${attempt}): ${err.message}. ` +
					`${Math.round(delay / 1000)} sn sonra yeniden denenecek.`,
			);
			await sleep(delay);
		}
	}
};

/**
 * Baglanti yasam dongusu gorunurlugu. Bunlar olmadan loglarda yalnizca
 * nginx'in "Connection refused" satirlari kaliyor ve kopmanin ne zaman
 * basladigi anlasilamiyordu.
 */
const registerConnectionListeners = () => {
	const connection = mongoose.connection;

	connection.on("disconnected", () => {
		console.error("MongoDB baglantisi koptu; surucu yeniden baglanmayi deniyor");
	});

	connection.on("reconnected", () => {
		console.log("MongoDB yeniden baglandi");
	});

	connection.on("error", (err) => {
		// Baglanti kurulduktan sonraki hatalar; surucu kendi toparlar,
		// burada yalnizca gorunurluk icin loglariz.
		console.error(`MongoDB baglanti hatasi: ${err.message}`);
	});
};

/**
 * Baslangic gorevleri: index senkronu, migration'lar, seed.
 *
 * Kritik: bunlar ARTIK sunucuyu dusuremez. Eskiden hepsi baglantiyla ayni
 * try/catch icindeydi, yani veritabani gayet saglikliyken bile bir
 * migration hata verirse `process.exit(1)` calisiyordu.
 *
 * Her gorev tek tek sarmalanir; biri patlarsa loglanir ve digerleri devam
 * eder. Site ayakta kalir, sorun loglardan gorulur.
 */
const runTasksSafely = async (tasks) => {
	for (const [label, task] of tasks) {
		try {
			await task();
		} catch (err) {
			console.error(
				`Baslangic gorevi basarisiz (${label}): ${err.message}. ` +
					"Sunucu calismaya devam ediyor.",
			);
		}
	}
};

const runStartupTasks = async () => {
	if (!isPrimaryInstance()) {
		console.log(
			`Baslangic gorevleri atlandi (instance ${process.env.NODE_APP_INSTANCE}; ` +
				"yalnizca instance 0 calistirir)",
		);
		return;
	}

	await runTasksSafely([
		["affiliate referrer temizligi", cleanupInvalidAffiliateReferrers],
		["index senkronu", syncAllIndexes],
		["Rivo cuzdan migrasyonu", migrateUsersToRivoWallet],
		["izin seed", seedSystemPermissions],
		["sportsbook oyunlari", ensureSportsbookGames],
	]);
};

const connectDB = async () => {
	registerConnectionListeners();
	await connectWithRetry();
	await runStartupTasks();
};

module.exports = connectDB;
module.exports.cleanupInvalidAffiliateReferrers =
	cleanupInvalidAffiliateReferrers;
module.exports.isPrimaryInstance = isPrimaryInstance;
module.exports.runStartupTasks = runStartupTasks;
module.exports.runTasksSafely = runTasksSafely;
