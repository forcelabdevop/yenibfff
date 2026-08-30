const axios = require('axios');
const { TRON_FULL_HOST } = require('../../config/crypto');

/**
 * TronGrid okuma istemcisi.
 *
 * Anahtarlar bizde (self-custody); zinciri OKUMAK icin 3. parti RPC kullanilir.
 * Bu istemci yalnizca okuma yapar — imzalama/gonderme icerMEZ.
 *
 * TRON_API_KEY tanimliysa gonderilir. Anahtarsiz TronGrid cok dusuk bir hiz
 * sinirina takilir; uretimde anahtar sarttir.
 */

const REQUEST_TIMEOUT_MS = 15000;

const http = axios.create({
	baseURL: TRON_FULL_HOST,
	timeout: REQUEST_TIMEOUT_MS,
	headers: process.env.TRON_API_KEY
		? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY }
		: {},
});

/** Zincirdeki guncel blok numarasi. */
async function getNowBlock() {
	const { data } = await http.post('/wallet/getnowblock', {});
	const number = data?.block_header?.raw_data?.number;
	if (!Number.isInteger(number)) {
		throw new Error('TronGrid gecerli bir blok numarasi dondurmedi.');
	}
	return number;
}

/**
 * Bir adrese GELEN TRC20 transferleri.
 *
 * `only_to=true` kritik: bu olmadan adresten CIKAN transferler de doner ve
 * kullanicinin kendi cekimi yatirim sanilarak kredi edilebilir.
 *
 * @returns {Promise<Array<{txHash: string, from: string, to: string, valueUnits: string, contract: string, timestamp: number}>>}
 */
async function getIncomingTrc20(address, contract, sinceTimestamp = 0) {
	const { data } = await http.get(`/v1/accounts/${address}/transactions/trc20`, {
		params: {
			only_to: true,
			limit: 50,
			order_by: 'block_timestamp,asc',
			contract_address: contract,
			min_timestamp: sinceTimestamp || undefined,
		},
	});

	return (data?.data || []).map((row) => ({
		txHash: row.transaction_id,
		from: row.from,
		to: row.to,
		// String olarak birakilir; BigInt ile islenecek. Number'a cevirmek
		// buyuk tutarlarda hassasiyet kaybi demektir.
		valueUnits: String(row.value),
		contract: row.token_info?.address || contract,
		timestamp: Number(row.block_timestamp) || 0,
	}));
}

/**
 * Bir adrese GELEN native TRX transferleri.
 * Yalnizca basit transferler (TransferContract) dikkate alinir.
 */
async function getIncomingTrx(address, sinceTimestamp = 0) {
	const { data } = await http.get(`/v1/accounts/${address}/transactions`, {
		params: {
			only_to: true,
			limit: 50,
			order_by: 'block_timestamp,asc',
			min_timestamp: sinceTimestamp || undefined,
		},
	});

	const rows = [];
	for (const tx of data?.data || []) {
		const contract = tx?.raw_data?.contract?.[0];
		if (contract?.type !== 'TransferContract') continue;

		const value = contract?.parameter?.value;
		if (!value || !Number.isFinite(Number(value.amount))) continue;

		rows.push({
			txHash: tx.txID,
			from: value.owner_address,
			to: value.to_address,
			valueUnits: String(value.amount),
			contract: null,
			timestamp: Number(tx.block_timestamp) || 0,
		});
	}
	return rows;
}

/**
 * Islemin blok numarasi ve basari durumu.
 *
 * BASARI KONTROLU SART: geri alinmis (revert) bir TRC20 islemi de olay
 * listesinde gorunebilir. Kontrol edilmezse gerceklesmemis bir transfer
 * kredi edilir.
 *
 * @returns {Promise<{blockNumber: number, success: boolean} | null>}
 */
async function getTransactionInfo(txHash) {
	const { data } = await http.post('/wallet/gettransactioninfobyid', {
		value: txHash,
	});

	if (!data || !Number.isInteger(data.blockNumber)) return null;

	// receipt.result yalnizca sozlesme cagrilarinda bulunur. Native TRX
	// transferlerinde alan yoktur; islem bilgisi dondugu icin basarilidir.
	const receiptResult = data.receipt?.result;
	const success = receiptResult ? receiptResult === 'SUCCESS' : true;

	return { blockNumber: data.blockNumber, success };
}

module.exports = {
	getNowBlock,
	getIncomingTrc20,
	getIncomingTrx,
	getTransactionInfo,
};
