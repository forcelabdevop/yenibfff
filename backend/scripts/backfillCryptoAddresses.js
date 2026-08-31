/**
 * Tek seferlik migration: kayit sirasinda henuz otomatik adres atanmasi
 * eklenmemisken (bkz. routes/auth/credentials/index.js) olusturulmus TUM
 * eski kullanicilara sabit kripto yatirma adresi (USDT_TRC20, TRX ...)
 * atar.
 *
 * getOrCreateAddress zaten idempotent: bir kullanicinin belirli bir para
 * birimi icin adresi varsa dokunmaz, yoksa atomik olarak olusturur. Bu
 * script guvenle birden fazla kez calistirilabilir.
 *
 * Kullanim:
 *   node scripts/backfillCryptoAddresses.js            # varsayilan batch=200
 *   node scripts/backfillCryptoAddresses.js --batch=50
 *   node scripts/backfillCryptoAddresses.js --dry-run  # sadece sayar, yazmaz
 */
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../database/models/User");
const cryptoAddressService = require("../services/cryptoAddressService");
const { listCurrencies } = require("../config/crypto");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const batchArg = args.find((a) => a.startsWith("--batch="));
const batchSize = batchArg ? Number.parseInt(batchArg.split("=")[1], 10) || 200 : 200;

async function main() {
	const uri = process.env.MONGODB_CONNECTION_STRING || process.env.DATABASE_URI;
	if (!uri) {
		console.error("MONGODB_CONNECTION_STRING / DATABASE_URI tanimli degil.");
		process.exit(1);
	}

	await mongoose.connect(uri);
	console.log("[backfill] DB baglantisi kuruldu.");

	const currencies = listCurrencies();
	console.log(
		`[backfill] Para birimleri: ${currencies.map((c) => c.code).join(", ")}`,
	);

	const totalUsers = await User.countDocuments({});
	console.log(
		`[backfill] Toplam ${totalUsers} kullanici islenecek (batch=${batchSize}, dryRun=${dryRun}).`,
	);

	let processed = 0;
	let successCount = 0;
	let failedCount = 0;
	const cursor = User.find({}, { _id: 1 }).lean().cursor();

	let batch = [];
	const flush = async () => {
		if (batch.length === 0) return;
		await Promise.all(
			batch.map(async (userId) => {
				for (const currency of currencies) {
					if (dryRun) continue;
					try {
						const result = await cryptoAddressService.getOrCreateAddress(
							userId,
							currency.code,
						);
						if (result) successCount += 1;
					} catch (error) {
						failedCount += 1;
						console.error(
							`[backfill] ${userId} / ${currency.code} atanamadi:`,
							error.message,
						);
					}
				}
			}),
		);
		processed += batch.length;
		console.log(`[backfill] ${processed}/${totalUsers} kullanici islendi.`);
		batch = [];
	};

	for await (const doc of cursor) {
		batch.push(doc._id);
		if (batch.length >= batchSize) await flush();
	}
	await flush();

	console.log(
		`[backfill] Tamamlandi. Islenen kullanici: ${processed}, getOrCreateAddress cagrisi basarili: ${successCount}, hatali: ${failedCount}.`,
	);
	if (dryRun) console.log("[backfill] --dry-run modundaydi, DB'ye YAZILMADI.");

	await mongoose.disconnect();
	process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error("[backfill] beklenmeyen hata:", error);
	process.exit(1);
});
