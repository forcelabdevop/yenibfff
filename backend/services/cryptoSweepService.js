const crypto = require('node:crypto');

const CryptoAddress = require('../database/models/CryptoAddress');
const CryptoSweep = require('../database/models/CryptoSweep');
const JobLock = require('../database/models/JobLock');
const hdWallet = require('../utils/crypto/hdWallet');
const tronSigner = require('../utils/crypto/tronSigner');
const {
	CURRENCIES,
	SWEEP_DERIVATION_INDEX,
	SWEEP_MIN_UNITS,
	SWEEP_GAS_TRX_SUN,
	SWEEP_GAS_WAIT_MS,
	listCurrencies,
} = require('../config/crypto');

/**
 * TRON sweep (toplama) servisi.
 *
 * AMAC: Kullanicilara atanan HD adreslerinde biriken TRX/USDT bakiyesini,
 * periyodik olarak tek bir ana adrese (SWEEP_DERIVATION_INDEX = 0) tasir.
 * Adresler zaten bizim seed'imizden turetildigi icin fonlar zincirde
 * "bizim" kontrolumuzdedir; sweep bunlari fiziksel olarak birlestirir ki
 * pratikte kullanilabilsinler (borsaya yatirma, tek noktadan yonetim vb.).
 *
 * TASARIM NOTLARI (cryptoDepositWatcher.js ile aynı desen):
 *  - JobLock ile leader-election: PM2 cluster'da 4 instance calisiyor,
 *    yalniz biri sweep dongusunu yurutur.
 *  - USDT sweep'i iki adimlidir: once adrese gas (TRX) gonderilir (adreste
 *    TRC20 transferi icin enerji/TRX yoksa islem basarisiz olur), sonra
 *    asil USDT transferi yapilir. Bu yuzden CryptoSweep durumu
 *    pending -> gas_sent -> completed seklinde ilerler.
 *  - TRX sweep'i tek adimdir (native transfer, gas'in kendisi TRX'ten
 *    dusulur): pending -> completed.
 *  - Her deneme CryptoSweep'e loglanir; ayni adres/para birimi icin
 *    "acik" (pending/gas_sent) bir kayit varsa yeni kayit acilmaz —
 *    bu, ayni bakiyenin cift sweep edilmesini onler.
 */

const LOCK_KEY = 'tron:sweepScanner';
const LOCK_TTL_MS = 180000;
const OWNER = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

/**
 * Her turda taranacak adres sayisi. cryptoDepositWatcher.js'teki ayni
 * gerekceyle (bkz. 02.09.2026 vakasi) TRON_API_KEY artik tanimli oldugundan
 * ve chain filtresi duzeltildiginden guvenle artirildi.
 */
const ADDRESS_BATCH = Number(process.env.TRON_SWEEP_BATCH || 100);

/**
 * Zincir sorgulari arasi bekleme (ms) — TronGrid hiz sinirini asmamak icin.
 * TRON_API_KEY tanimli degilse anahtarsiz limit cok dusuktur (429/bos yanit
 * riski yuksek); bu durumda varsayilan daha guvenli bir deger kullanilir.
 */
const REQUEST_SPACING_MS = Number(
	process.env.TRON_SWEEP_SPACING_MS || (process.env.TRON_API_KEY ? 200 : 600),
);

/** Ayni sweep kaydinin sonsuz denenmesini onlemek icin ust sinir. */
const MAX_ATTEMPTS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Toplama/ana adres (index 0). */
function getSweepDestination() {
	return hdWallet.deriveAddress(SWEEP_DERIVATION_INDEX);
}

/**
 * Bir adresin bakiyesini kontrol eder; esik ustundeyse sweep kaydi acar
 * (zaten acik bir kayit yoksa).
 */
async function queueSweepIfNeeded(record, currency, destination) {
	const minUnits = BigInt(SWEEP_MIN_UNITS[currency.code] ?? 0);

	let balanceUnits;
	if (currency.contract) {
		balanceUnits = await tronSigner.getTrc20Balance(
			record.address,
			currency.contract,
		);
	} else {
		balanceUnits = BigInt(await tronSigner.getTrxBalance(record.address));
	}

	if (balanceUnits < minUnits) return false;

	// Ayni adres+para birimi icin acik (henuz tamamlanmamis) bir kayit
	// varsa yeni kayit acma — cift sweep'i onler.
	const openSweep = await CryptoSweep.findOne({
		fromAddress: record.address,
		currency: currency.code,
		status: { $in: ['pending', 'gas_sent'] },
	}).lean();
	if (openSweep) return false;

	await CryptoSweep.create({
		fromAddress: record.address,
		derivationIndex: record.derivationIndex,
		toAddress: destination,
		currency: currency.code,
		amountUnits: Number(balanceUnits),
		status: 'pending',
	});
	return true;
}

/** Bakiyesi esigi asan adresleri tarar ve sweep kuyruguna ekler. */
async function discoverSweepable() {
	const destination = getSweepDestination();

	// DIKKAT: chain: 'TRON' filtresi KRITIK — cryptoDepositWatcher.js'teki
	// ayni hatanin (bkz. 02.09.2026 vakasi) burada da tekrarlanmasini
	// onler. Filtresiz find({}) TUM zincirlerin (ETHEREUM/BNB/POLYGON dahil)
	// adreslerini bu TRON sweep kuyruguna sokar; tronSigner'a EVM (0x...)
	// adresi gonderilir, her seferinde hata alinir ve gercek TRON adresleri
	// kuyrukta gecikir. EVM sweep'i zaten ayri bir serviste yapiliyor
	// (services/cryptoSweepServiceEvm.js).
	const addresses = await CryptoAddress.find({ chain: 'TRON' })
		.sort({ lastSweepScannedAt: 1 })
		.limit(ADDRESS_BATCH)
		.lean();

	if (addresses.length === 0) return 0;

	// Ayni sekilde yalniz TRON para birimleri (TRX, USDT_TRC20) sweep edilir —
	// listCurrencies() TUM zincirleri dondurur, burada gereksiz/zararli.
	const currencies = listCurrencies().filter(
		(currency) => currency.family === 'TRON',
	);
	let queued = 0;

	for (const record of addresses) {
		try {
			for (const currency of currencies) {
				const didQueue = await queueSweepIfNeeded(
					record,
					currency,
					destination,
				);
				if (didQueue) queued += 1;
				await sleep(REQUEST_SPACING_MS);
			}
		} catch (error) {
			console.error(
				`[sweep] bakiye kontrolu basarisiz ${record.address}:`,
				error.message,
			);
		} finally {
			await CryptoAddress.updateOne(
				{ _id: record._id },
				{ $set: { lastSweepScannedAt: new Date() } },
			);
		}
	}

	return queued;
}

/** Bekleyen sweep kayitlarini isler (gas gonderimi + asil transfer). */
async function processPendingSweeps() {
	const pending = await CryptoSweep.find({
		status: { $in: ['pending', 'gas_sent'] },
		attempts: { $lt: MAX_ATTEMPTS },
	})
		.sort({ createdAt: 1 })
		.limit(20)
		.lean();

	let completed = 0;

	for (const sweep of pending) {
		try {
			const done = await processOneSweep(sweep);
			if (done) completed += 1;
		} catch (error) {
			console.error(
				`[sweep] islenemedi ${sweep.fromAddress} (${sweep.currency}):`,
				error.message,
			);
			await CryptoSweep.updateOne(
				{ _id: sweep._id },
				{
					$set: { status: 'failed', lastError: error.message },
					$inc: { attempts: 1 },
				},
			);
		}
		await sleep(REQUEST_SPACING_MS);
	}

	return completed;
}

/**
 * Tek bir sweep kaydini ilerletir.
 * @returns {Promise<boolean>} Bu turda tamamlandiysa true
 */
async function processOneSweep(sweep) {
	const currency = CURRENCIES[sweep.currency];
	if (!currency) {
		throw new Error(`Bilinmeyen para birimi: ${sweep.currency}`);
	}

	// Native TRX: dogrudan tek adimda gonder. Gonderilecek tutar, bakiyenin
	// tamami DEGIL — agin isteyecegi islem ucreti (bandwidth) icin bir pay
	// birakilir; aksi halde islem "insufficient balance" ile reddedilir.
	if (!currency.contract) {
		const currentBalance = await tronSigner.getTrxBalance(sweep.fromAddress);
		const feeBufferSun = 1_100_000; // ~1.1 TRX bandwidth payı
		const amountToSend = currentBalance - feeBufferSun;

		if (amountToSend <= 0) {
			await CryptoSweep.updateOne(
				{ _id: sweep._id },
				{
					$set: { status: 'failed', lastError: 'Bakiye ucret payindan az' },
					$inc: { attempts: 1 },
				},
			);
			return false;
		}

		const txHash = await tronSigner.sendTrx(
			sweep.derivationIndex,
			sweep.toAddress,
			amountToSend,
		);

		await CryptoSweep.updateOne(
			{ _id: sweep._id },
			{
				$set: {
					status: 'completed',
					txHash,
					amountUnits: amountToSend,
					completedAt: new Date(),
				},
				$inc: { attempts: 1 },
			},
		);
		console.log(
			`[sweep] TRX toplandi: ${sweep.fromAddress} -> ${sweep.toAddress} (${amountToSend} SUN, tx ${txHash})`,
		);
		return true;
	}

	// TRC20 (USDT): iki adim gerekir.
	if (sweep.status === 'pending') {
		// 1) Adreste yeterli TRX (gas) var mi kontrol et; yoksa gonder.
		const trxBalance = await tronSigner.getTrxBalance(sweep.fromAddress);
		const gasThreshold = Math.floor(SWEEP_GAS_TRX_SUN * 0.5);

		if (trxBalance >= gasThreshold) {
			// Zaten yeterli TRX var (onceki bir gas gonderiminden veya
			// kullanicinin kendi TRX'inden) — dogrudan gas_sent'e gec.
			await CryptoSweep.updateOne(
				{ _id: sweep._id },
				{ $set: { status: 'gas_sent' }, $inc: { attempts: 1 } },
			);
			return false;
		}

		const gasTxHash = await tronSigner.sendTrx(
			SWEEP_DERIVATION_INDEX,
			sweep.fromAddress,
			SWEEP_GAS_TRX_SUN,
		);

		await CryptoSweep.updateOne(
			{ _id: sweep._id },
			{
				$set: { status: 'gas_sent', gasTxHash },
				$inc: { attempts: 1 },
			},
		);
		console.log(
			`[sweep] gas gonderildi: ${sweep.fromAddress} (${SWEEP_GAS_TRX_SUN} SUN, tx ${gasTxHash})`,
		);
		return false; // Ana transfer bir sonraki turda yapilir (gas'in blok'a girmesini bekle).
	}

	// status === 'gas_sent': gas'in zincire islenmesi icin biraz bekle,
	// sonra guncel USDT bakiyesini gonder.
	const sweepAgeMs = Date.now() - new Date(sweep.createdAt).getTime();
	if (sweepAgeMs < SWEEP_GAS_WAIT_MS) return false;

	const usdtBalance = await tronSigner.getTrc20Balance(
		sweep.fromAddress,
		currency.contract,
	);
	const minUnits = BigInt(SWEEP_MIN_UNITS[currency.code] ?? 0);
	if (usdtBalance < minUnits) {
		// Bakiye degismis olabilir (baska bir islem tarafindan alinmis olamaz —
		// biz self-custody'yiz — ama guvenlik icin kontrol edilir).
		await CryptoSweep.updateOne(
			{ _id: sweep._id },
			{
				$set: { status: 'failed', lastError: 'USDT bakiyesi esik altina dustu' },
				$inc: { attempts: 1 },
			},
		);
		return false;
	}

	const txHash = await tronSigner.sendTrc20(
		sweep.derivationIndex,
		currency.contract,
		sweep.toAddress,
		usdtBalance,
	);

	await CryptoSweep.updateOne(
		{ _id: sweep._id },
		{
			$set: {
				status: 'completed',
				txHash,
				amountUnits: Number(usdtBalance),
				completedAt: new Date(),
			},
			$inc: { attempts: 1 },
		},
	);
	console.log(
		`[sweep] USDT toplandi: ${sweep.fromAddress} -> ${sweep.toAddress} (${usdtBalance} birim, tx ${txHash})`,
	);
	return true;
}

/** Bir tarama turu. Kilit alinamazsa sessizce cikar. */
async function runOnce() {
	if (!hdWallet.isConfigured()) return;

	const locked = await JobLock.acquire(LOCK_KEY, OWNER, LOCK_TTL_MS);
	if (!locked) return;

	try {
		await discoverSweepable();
		await processPendingSweeps();
	} catch (error) {
		console.error('[sweep] tarama turu basarisiz:', error.message);
	} finally {
		await JobLock.release(LOCK_KEY, OWNER).catch(() => {});
	}
}

module.exports = {
	LOCK_KEY,
	runOnce,
	discoverSweepable,
	processPendingSweeps,
	getSweepDestination,
};
