const { TronWeb } = require('tronweb');
const { TRON_FULL_HOST } = require('../../config/crypto');
const hdWallet = require('./hdWallet');

/**
 * TRON imzalama/gonderme istemcisi (self-custody sweep icin).
 *
 * GUVENLIK: Private key hicbir zaman degiskende/loglarda tutulmaz. Her
 * cagrida hdWallet.derivePrivateKey(index) ile aninda turetilir, TronWeb
 * instance'ina privateKey olarak verilir ve fonksiyon donunce garbage
 * collector'a birakilir.
 */

let readOnlyClient = null;
function getReadOnlyClient() {
	if (!readOnlyClient) {
		readOnlyClient = new TronWeb({
			fullHost: TRON_FULL_HOST,
			headers: process.env.TRON_API_KEY
				? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY }
				: undefined,
		});
	}
	return readOnlyClient;
}

/** Belirli bir indeks icin imzalayabilen bir TronWeb instance'i olusturur. */
function getSigningClient(index) {
	const privateKey = hdWallet.derivePrivateKey(index);
	return new TronWeb({
		fullHost: TRON_FULL_HOST,
		privateKey,
		headers: process.env.TRON_API_KEY
			? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY }
			: undefined,
	});
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * TronGrid anahtarsiz/dusuk kotada 429 veya bos govdeli "Unknown error"
 * dondurebilir. Bu gecici hatalarda kisa bir bekleme ile tekrar denenir;
 * kalici hatalarda (gecersiz adres vb.) hemen firlatilir.
 */
async function withRetry(fn, { retries = 3, delayMs = 1500 } = {}) {
	let lastError;
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			const status = error?.response?.status;
			const isTransient =
				status === 429 || status === 503 || /unknown error/i.test(error.message || '');
			if (!isTransient || attempt === retries) throw error;
			await sleep(delayMs * (attempt + 1));
		}
	}
	throw lastError;
}

// Ayni TRC20 sozlesmesi icin contract().at() cagrisini tekrarlamamak icin
// cache'lenir — her cagrida yeniden metadata/ABI cekmek TronGrid'e gereksiz
// yuk bindirip anahtarsiz kotada rate limit'i tetikliyordu.
const contractCache = new Map();
async function getContractInstance(contract) {
	if (!contractCache.has(contract)) {
		const client = getReadOnlyClient();
		contractCache.set(contract, await client.contract().at(contract));
	}
	return contractCache.get(contract);
}

/** Adresin native TRX bakiyesi (SUN, tam sayi). */
async function getTrxBalance(address) {
	const balance = await withRetry(() => getReadOnlyClient().trx.getBalance(address));
	return Number(balance) || 0;
}

/** Adresin belirli bir TRC20 sozlesmesindeki bakiyesi (en kucuk birim, tam sayi). */
async function getTrc20Balance(address, contract) {
	const raw = await withRetry(async () => {
		const contractInstance = await getContractInstance(contract);
		return contractInstance.balanceOf(address).call({ from: address });
	});
	return BigInt(raw?.toString?.() ?? raw ?? 0);
}

/**
 * Adresin enerji (energy) kaynagi. TRC20 transferi enerji gerektirir;
 * yetersizse TRX yakilarak karsilanir. Bu fonksiyon yalniz bilgi amaclidir,
 * sweep akisinda "gas gerekiyor mu" kararini TRX bakiyesi belirler.
 */
async function getAccountResources(address) {
	return getReadOnlyClient().trx.getAccountResources(address);
}

/**
 * Native TRX gonderir (imzalar + yayinlar).
 *
 * @param {number} fromIndex Gonderen adresin turetme indeksi
 * @param {string} toAddress Alici adres
 * @param {number} amountSun Gonderilecek tutar (SUN, tam sayi)
 * @returns {Promise<string>} Islem hash'i
 */
async function sendTrx(fromIndex, toAddress, amountSun) {
	if (!Number.isInteger(amountSun) || amountSun <= 0) {
		throw new Error(`Gecersiz TRX tutari: ${amountSun}`);
	}
	const client = getSigningClient(fromIndex);
	const fromAddress = client.defaultAddress.base58;

	const tx = await client.transactionBuilder.sendTrx(
		toAddress,
		amountSun,
		fromAddress,
	);
	const signed = await client.trx.sign(tx);
	const result = await client.trx.sendRawTransaction(signed);

	if (!result?.result) {
		throw new Error(
			`TRX gonderimi zincir tarafindan reddedildi: ${JSON.stringify(result)}`,
		);
	}
	return result.txid;
}

/**
 * TRC20 token gonderir (imzalar + yayinlar).
 *
 * @param {number} fromIndex Gonderen adresin turetme indeksi
 * @param {string} contract TRC20 sozlesme adresi
 * @param {string} toAddress Alici adres
 * @param {bigint|string} amountUnits Gonderilecek tutar (sozlesme biriminde, tam sayi)
 * @returns {Promise<string>} Islem hash'i
 */
async function sendTrc20(fromIndex, contract, toAddress, amountUnits) {
	const amount = BigInt(amountUnits);
	if (amount <= 0n) {
		throw new Error(`Gecersiz TRC20 tutari: ${amountUnits}`);
	}
	const client = getSigningClient(fromIndex);
	const fromAddress = client.defaultAddress.base58;

	const { transaction } = await client.transactionBuilder.triggerSmartContract(
		contract,
		'transfer(address,uint256)',
		{ feeLimit: 50_000_000 }, // 50 TRX ust sinir — asilmasi imkansiza yakin ama guvenlik payi
		[
			{ type: 'address', value: toAddress },
			{ type: 'uint256', value: amount.toString() },
		],
		fromAddress,
	);

	const signed = await client.trx.sign(transaction);
	const result = await client.trx.sendRawTransaction(signed);

	if (!result?.result) {
		throw new Error(
			`TRC20 gonderimi zincir tarafindan reddedildi: ${JSON.stringify(result)}`,
		);
	}
	return result.txid;
}

module.exports = {
	getTrxBalance,
	getTrc20Balance,
	getAccountResources,
	sendTrx,
	sendTrc20,
};
