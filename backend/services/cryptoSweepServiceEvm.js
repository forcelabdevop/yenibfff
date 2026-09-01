const crypto = require('node:crypto');

const CryptoAddress = require('../database/models/CryptoAddress');
const CryptoSweep = require('../database/models/CryptoSweep');
const JobLock = require('../database/models/JobLock');
const evmWallet = require('../utils/crypto/evmWallet');
const evmClient = require('../utils/crypto/evmClient');
const evmSigner = require('../utils/crypto/evmSigner');
const {
	CURRENCIES,
	SWEEP_DERIVATION_INDEX,
	SWEEP_MIN_UNITS,
	EVM_SWEEP_GAS_WEI,
	EVM_SWEEP_GAS_WAIT_MS,
} = require('../config/crypto');

/**
 * EVM (BSC + Polygon) sweep (toplama) servisi.
 *
 * cryptoSweepService.js (TRON) ile AYNI JobLock/durum-makinesi desenini
 * izler, ama yalnizca USDT (ERC20) toplar — native BNB/MATIC yatirmalari
 * desteklenmiyor (bkz. config/crypto.js), bu yuzden TRON'daki "native tek
 * adim" dalina burada gerek yoktur; tum akis TRC20/USDT dalinin EVM
 * karsiligidir: pending -> gas_sent -> completed.
 *
 * ONEMLI: BSC ve Polygon ayni EVM adresini paylasir (ayni private key) ama
 * bakiyeleri TAMAMEN BAGIMSIZ zincirlerdir. Bu yuzden her fonksiyon `network`
 * parametresini acikca alir; hicbir yerde "adres ayni oldugu icin bakiye de
 * ayni" varsayimi yapilmaz.
 */

const LOCK_KEY = 'evm:sweepScanner';
const LOCK_TTL_MS = 180000;
const OWNER = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

const ADDRESS_BATCH = Number(process.env.EVM_SWEEP_BATCH || 15);
const MAX_ATTEMPTS = 5;

/** Ucretsiz/genel RPC saglayicilarinin hiz sinirini asmamak icin bekleme. */
const REQUEST_SPACING_MS = Number(process.env.EVM_SWEEP_SPACING_MS || 150);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Toplama/ana adres (index 0) — TRON'dan BAGIMSIZ bir EVM adresi. */
function getSweepDestination() {
	return evmWallet.deriveAddress(SWEEP_DERIVATION_INDEX);
}

/**
 * Bir adresin USDT bakiyesini kontrol eder; esik ustundeyse sweep kaydi acar.
 * @param {'BEP20'|'POLYGON'} network
 */
async function queueSweepIfNeeded(network, record, currency, destination) {
	const minUnits = BigInt(SWEEP_MIN_UNITS[currency.code] ?? 0);

	const rawBalance = currency.type === 'native'
		? await evmClient.getNativeBalance(network, record.address)
		: await evmClient.getErc20Balance(network, currency.contract, record.address);
	const canonicalBalance = evmClient.toCanonicalUnits(
		rawBalance,
		currency.chainDecimals,
		currency.decimals,
	);
	if (canonicalBalance < minUnits) return false;

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
		amountUnits: Number(canonicalBalance),
		status: 'pending',
	});
	return true;
}

/** Bir agdaki bakiyesi esigi asan adresleri tarar ve sweep kuyruguna ekler. */
async function discoverSweepableForNetwork(network, currency) {
	const destination = getSweepDestination();

	const addresses = await CryptoAddress.find({ chain: currency.chain })
		.sort({ lastSweepScannedAt: 1 })
		.limit(ADDRESS_BATCH)
		.lean();

	let queued = 0;
	for (const record of addresses) {
		try {
			const didQueue = await queueSweepIfNeeded(network, record, currency, destination);
			if (didQueue) queued += 1;
		} catch (error) {
			console.error(`[sweep-evm] ${network} bakiye kontrolu basarisiz ${record.address}:`, error.message);
		} finally {
			await CryptoAddress.updateOne({ _id: record._id }, { $set: { lastSweepScannedAt: new Date() } });
		}
		await sleep(REQUEST_SPACING_MS);
	}
	return queued;
}

async function discoverSweepable() {
	let queued = 0;
	for (const currency of Object.values(CURRENCIES).filter((item) => item.family === 'EVM')) {
		queued += await discoverSweepableForNetwork(currency.network, currency);
	}
	return queued;
}

/** Bekleyen sweep kayitlarini isler (gas gonderimi + asil USDT transferi). */
async function processPendingSweeps() {
	const evmCurrencyCodes = Object.values(CURRENCIES)
		.filter((item) => item.family === 'EVM')
		.map((item) => item.code);
	const pending = await CryptoSweep.find({
		currency: { $in: evmCurrencyCodes },
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
			console.error(`[sweep-evm] islenemedi ${sweep.fromAddress} (${sweep.currency}):`, error.message);
			await CryptoSweep.updateOne(
				{ _id: sweep._id },
				{ $set: { status: 'failed', lastError: error.message }, $inc: { attempts: 1 } },
			);
		}
		await sleep(REQUEST_SPACING_MS);
	}
	return completed;
}

/** currency.code -> network kodu ('BEP20' | 'POLYGON'). */
function networkOf(currency) {
	return currency.network; // config/crypto.js'te network alani zaten 'BEP20'/'POLYGON' ile aynı.
}

/**
 * Tek bir sweep kaydini ilerletir (yalniz USDT/ERC20 dali — bkz. dosya basi not).
 * @returns {Promise<boolean>} Bu turda tamamlandiysa true
 */
async function processOneSweep(sweep) {
	const currency = CURRENCIES[sweep.currency];
	if (!currency || currency.family !== 'EVM') {
		throw new Error(`Bilinmeyen veya EVM olmayan para birimi: ${sweep.currency}`);
	}
	const network = networkOf(currency);
	const gasWei = EVM_SWEEP_GAS_WEI[network];

	if (currency.type === 'native') {
		const txHash = await evmSigner.sweepNative(network, sweep.derivationIndex, sweep.toAddress);
		if (!txHash) return false;
		await CryptoSweep.updateOne(
			{ _id: sweep._id },
			{ $set: { status: 'completed', txHash, completedAt: new Date() }, $inc: { attempts: 1 } },
		);
		return true;
	}

	if (sweep.status === 'pending') {
		const nativeBalance = await evmClient.getNativeBalance(network, sweep.fromAddress);
		const gasThreshold = gasWei / 2n;

		if (nativeBalance >= gasThreshold) {
			await CryptoSweep.updateOne(
				{ _id: sweep._id },
				{ $set: { status: 'gas_sent' }, $inc: { attempts: 1 } },
			);
			return false;
		}

		const gasTxHash = await evmSigner.sendNativeGas(
			network,
			SWEEP_DERIVATION_INDEX,
			sweep.fromAddress,
			gasWei,
		);

		await CryptoSweep.updateOne(
			{ _id: sweep._id },
			{ $set: { status: 'gas_sent', gasTxHash }, $inc: { attempts: 1 } },
		);
		console.log(`[sweep-evm] gas gonderildi: ${network} ${sweep.fromAddress} (tx ${gasTxHash})`);
		return false; // Ana transfer bir sonraki turda yapilir.
	}

	// status === 'gas_sent'
	const sweepAgeMs = Date.now() - new Date(sweep.createdAt).getTime();
	if (sweepAgeMs < EVM_SWEEP_GAS_WAIT_MS) return false;

	const rawBalance = await evmClient.getErc20Balance(network, currency.contract, sweep.fromAddress);
	const canonicalBalance = evmClient.toCanonicalUnits(rawBalance, currency.chainDecimals, currency.decimals);
	const minUnits = BigInt(SWEEP_MIN_UNITS[currency.code] ?? 0);

	if (canonicalBalance < minUnits) {
		await CryptoSweep.updateOne(
			{ _id: sweep._id },
			{ $set: { status: 'failed', lastError: 'USDT bakiyesi esik altina dustu' }, $inc: { attempts: 1 } },
		);
		return false;
	}

	// rawBalance HAM zincir birimindedir (chainDecimals olceginde) — transfer
	// cagrisina AYNI ham deger gonderilir (rescale edilmemis).
	const txHash = await evmSigner.sweepErc20(network, sweep.derivationIndex, currency.contract, sweep.toAddress, rawBalance);

	await CryptoSweep.updateOne(
		{ _id: sweep._id },
		{
			$set: {
				status: 'completed',
				txHash,
				amountUnits: Number(canonicalBalance),
				completedAt: new Date(),
			},
			$inc: { attempts: 1 },
		},
	);
	console.log(`[sweep-evm] USDT toplandi: ${network} ${sweep.fromAddress} -> ${sweep.toAddress} (tx ${txHash})`);
	return true;
}

/** Bir tarama turu. Kilit alinamazsa sessizce cikar. */
async function runOnce() {
	if (!evmWallet.isConfigured()) return;

	const locked = await JobLock.acquire(LOCK_KEY, OWNER, LOCK_TTL_MS);
	if (!locked) return;

	try {
		await discoverSweepable();
		await processPendingSweeps();
	} catch (error) {
		console.error('[sweep-evm] tarama turu basarisiz:', error.message);
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
