const crypto = require('node:crypto');

const CryptoAddress = require('../database/models/CryptoAddress');
const CryptoDeposit = require('../database/models/CryptoDeposit');
const JobLock = require('../database/models/JobLock');
const Counter = require('../database/models/Counter');

const evmWallet = require('../utils/crypto/evmWallet');
const evmClient = require('../utils/crypto/evmClient');
const { CURRENCIES } = require('../config/crypto');
// TRON izleyicisindeki para-yatirma (credit) mantigi TAMAMEN zincir-bagimsizdir
// (User.wallets guncellemesi + CryptoDeposit durum gecisi). Ayni islevi
// EVM tarafinda YENIDEN YAZMAK, iki farkli yerde ayni riskli mantigin
// (double-credit, atomik $inc) BAGIMSIZ evrilip birbirinden sapmasi riskini
// tasir — bu yuzden dogrudan import edilip tekrar kullanilir.
const { creditDeposit } = require('./cryptoDepositWatcher');

/**
 * EVM (BSC + Polygon) yatirma izleyicisi.
 *
 * TRON izleyicisinden TEMEL FARKI: TronGrid adres-basina sorgu gerektirirken,
 * EVM `eth_getLogs` TEK cagrida COK adresi OR-filtresiyle tarayabilir (bkz.
 * evmClient.getIncomingErc20Batch). Bu yuzden burada "adres basina dongu"
 * yerine "blok araligi basina toplu tarama" yaklasimi kullanilir.
 *
 * GUVENLIK: Bu izleyici SADECE zaten "guvenli" kabul edilen blok araligini
 * tarar (BSC: 'finalized' etiketi; Polygon: currentBlock - confirmationsRequired).
 * Yani discoverDeposits() bir transferi bulduğunda o transfer ARTIK yeterince
 * onaylanmis demektir — TRON'daki gibi ayri bir "pending -> credited" zaman
 * asimi beklemeye GEREK YOKTUR; deposit olusturulur olusturulmaz creditDeposit()
 * cagrilir. 'finalized' etiketi saglanamiyorsa (BSC) o TUR ATLANIR — ASLA
 * tahmine dayali (guvensiz) bir esik kullanilmaz.
 */

const LOCK_KEY = 'evm:depositScanner';
const LOCK_TTL_MS = 120000;
const OWNER = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

/** Bir turda taranacak maksimum blok sayisi (RPC log limitlerini asmamak icin). */
const MAX_BLOCK_RANGE = Number(process.env.EVM_SCAN_MAX_BLOCK_RANGE || 3000);

/** Tek getLogs cagrisinda OR-filtrelenecek maksimum adres sayisi. */
const ADDRESS_CHUNK = Number(process.env.EVM_SCAN_ADDRESS_CHUNK || 200);

const CURSOR_KEY = (network, currencyCode) => `evm:lastScannedBlock:${network}:${currencyCode}`;

function chunk(array, size) {
	const out = [];
	for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
	return out;
}

/**
 * Belirli bir agin GUVENLE taranabilecegi en son blok numarasi.
 * @returns {Promise<number|null>} null ise bu ag icin bu tur atlanir.
 */
async function getSafeBlock(network, currency) {
	if (network === 'BEP20') {
		const finalized = await evmClient.getFinalizedBlockNumber(network);
		if (finalized !== null) return finalized;
	}
	const current = await evmClient.getCurrentBlock(network);
	return Math.max(current - currency.confirmationsRequired, 0);
}

/** Bu agdaki (chain degeri) TUM kullanici adreslerini dondurur. */
async function loadAddresses(chainValue) {
	return CryptoAddress.find({ chain: chainValue }).select('address user').lean();
}

/**
 * Bir EVM agini tarar; guvenli blok esigine kadar olan yeni transferleri
 * `pending` olarak kaydeder ve HEMEN kredi eder (bkz. dosya basi not).
 * @param {'BEP20'|'POLYGON'} network
 * @param {object} currency config/crypto.js CURRENCIES[...] (USDT_BEP20 | USDT_POLYGON)
 */
async function scanNetwork(network, currency) {
	const safeBlock = await getSafeBlock(network, currency);
	if (safeBlock === null) {
		console.error(`[crypto-evm] ${network}: guvenli blok alinamadi, bu tur atlaniyor.`);
		return 0;
	}

	const cursorKey = CURSOR_KEY(network, currency.code);
	let fromBlock = await Counter.getValue(cursorKey, safeBlock - 1);
	fromBlock += 1;

	if (fromBlock > safeBlock) return 0; // Taranacak yeni blok yok.

	const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, safeBlock);

	const addressDocs = await loadAddresses(currency.chain);
	if (addressDocs.length === 0) {
		await Counter.setValue(cursorKey, toBlock);
		return 0;
	}

	const byAddress = new Map(addressDocs.map((d) => [d.address.toLowerCase(), d]));
	let discovered = 0;

	try {
		for (const group of chunk(addressDocs.map((d) => d.address), ADDRESS_CHUNK)) {
			const transfers = currency.type === 'native'
				? await evmClient.getIncomingNativeBatch(network, group, fromBlock, toBlock)
				: await evmClient.getIncomingErc20Batch(
					network,
					group,
					currency.contract,
					fromBlock,
					toBlock,
				);

			for (const transfer of transfers) {
				const record = byAddress.get(transfer.to.toLowerCase());
				if (!record) continue; // Teorik olarak olmamali (OR-filtre zaten bu adreslerle sinirli).

				const created = await recordAndCredit(record, currency, transfer, network);
				if (created) discovered += 1;
			}
		}

		// Sadece BASARILI tarama sonrasi cursor ilerletilir — hata durumunda
		// bir sonraki tur AYNI araligi yeniden dener (kayip transfer olmaz).
		await Counter.setValue(cursorKey, toBlock);
	} catch (error) {
		console.error(`[crypto-evm] ${network} tarama basarisiz (${fromBlock}-${toBlock}):`, error.message);
	}

	return discovered;
}

/**
 * Tek bir transferi kaydeder ve hemen kredi eder.
 * @returns {Promise<boolean>} Yeni kayit olusup kredi edildiyse true.
 */
async function recordAndCredit(record, currency, transfer, network) {
	let rawValue;
	try {
		rawValue = BigInt(transfer.valueUnitsRaw);
	} catch {
		return false;
	}

	// Ham zincir birimini kanonik (6 ondalik) birime FLOOR ile cevir.
	const canonicalUnits = evmClient.toCanonicalUnits(
		rawValue,
		currency.chainDecimals,
		currency.decimals,
	);

	// Tozlama filtresi.
	if (canonicalUnits < BigInt(currency.minDepositUnits)) return false;

	const exists = await CryptoDeposit.exists({
		txHash: transfer.txHash,
		address: record.address,
		currency: currency.code,
		logIndex: transfer.logIndex ?? -1,
	});
	if (exists) return false;

	// Ek guvenlik katmani: receipt basari kontrolu (loglar zaten yalniz
	// basarili islemlerde yazilir, ama saglayici/ag tutarsizliklarina karsi).
	const receipt = await evmClient.getTransactionReceipt(network, transfer.txHash);
	if (!receipt || !receipt.success) return false;

	let deposit;
	try {
		deposit = await CryptoDeposit.create({
			user: record.user,
			chain: currency.chain,
			currency: currency.code,
			address: record.address,
			txHash: transfer.txHash,
			// canonicalUnits config'te 6 ondalikte tutulur; Number donusumu
			// Number.MAX_SAFE_INTEGER altinda kalir (TRON ile aynı olcek).
			amountUnits: Number(canonicalUnits),
			decimals: currency.decimals,
			blockNumber: receipt.blockNumber,
			logIndex: transfer.logIndex ?? -1,
			confirmations: currency.confirmationsRequired,
			status: 'pending',
		});
	} catch (error) {
		if (error && error.code === 11000) return false; // Baska bir tur zaten yazdi.
		throw error;
	}

	await creditDeposit(deposit.toObject(), currency.confirmationsRequired);
	return true;
}

/** Bir tarama turu (BSC + Polygon). Kilit alinamazsa sessizce cikar. */
async function runOnce() {
	if (!evmWallet.isConfigured()) return;

	const locked = await JobLock.acquire(LOCK_KEY, OWNER, LOCK_TTL_MS);
	if (!locked) return;

	try {
		for (const currency of Object.values(CURRENCIES).filter((item) => item.family === 'EVM')) {
			// Her varlik/ag KENDI try/catch'ine sahiptir: getSafeBlock (finalized/
			// current blok RPC cagrisi) scanNetwork'un ic try/catch'inden ONCE
			// calisir ve hata firlatabilir. Bir agin RPC'si (orn. Polygon) arizali
			// olsa da bu, ayni turda diger aglarin (ETH, BSC) taranmasini VE
			// kredilenmesini ENGELLEMEMELIDIR.
			try {
				await scanNetwork(currency.network, currency);
			} catch (error) {
				console.error(`[crypto-evm] ${currency.network}/${currency.code} taranamadi:`, error.message);
			}
		}
	} catch (error) {
		console.error('[crypto-evm] tarama turu basarisiz:', error.message);
	} finally {
		await JobLock.release(LOCK_KEY, OWNER).catch(() => {});
	}
}

/**
 * Kullanicinin yatirma bekleme sayfasindaysa cagirilir: bir sonraki dakikalik
 * cron tikini beklemeden, o para biriminin agini HEMEN tarar.
 *
 * NEDEN GUVENLI: scanNetwork() bir Counter cursor'unu okuyup-yazarak
 * ilerletir; bu islem ATOMIK DEGILDIR. Cron'un runOnce() TAM DA AYNI aginin
 * cursor'unu ayni anda ilerletmeye calisiyorsa, iki paralel scanNetwork
 * cagrisi blok atlamasina/duplike cursor yazimina yol acabilir. Bu yuzden
 * burada AYNI JobLock anahtari (LOCK_KEY) kisa sureligine alinir; cron zaten
 * tariyorsa kilit alinamaz ve bu fonksiyon SESSIZCE hicbir sey yapmadan
 * cikar (cron zaten o taramayi yapiyor, tekrarina gerek yok).
 *
 * @returns {Promise<{scanned: boolean, discovered: number}>}
 */
async function scanNetworkNow(currency) {
	if (!evmWallet.isConfigured()) return { scanned: false, discovered: 0 };

	const owner = `ondemand-${OWNER}`;
	const locked = await JobLock.acquire(LOCK_KEY, owner, 30000);
	if (!locked) return { scanned: false, discovered: 0 };

	try {
		const discovered = await scanNetwork(currency.network, currency);
		return { scanned: true, discovered };
	} finally {
		await JobLock.release(LOCK_KEY, owner).catch(() => {});
	}
}

module.exports = {
	LOCK_KEY,
	runOnce,
	scanNetwork,
	scanNetworkNow,
};
