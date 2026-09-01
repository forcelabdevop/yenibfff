const CryptoAddress = require('../database/models/CryptoAddress');
const Counter = require('../database/models/Counter');
const evmWallet = require('../utils/crypto/evmWallet');
const { getCurrency, CURRENCIES } = require('../config/crypto');

const INDEX_COUNTER_KEY = 'evm:derivationIndex';

/** family === 'EVM' olan tum para birimlerinin `chain` degerleri (or. ['BNB','POLYGON']). */
const EVM_CHAINS = [
	...new Set(Object.values(CURRENCIES).filter((c) => c.family === 'EVM').map((c) => c.chain)),
];

/**
 * Kullaniciya, verilen EVM para birimi icin kalici yatirma adresi dondurur.
 *
 * cryptoAddressService.js (TRON) ile AYNI mantik, tek farkla: TRON'da "zincir"
 * tektir (TRON), burada ise BSC ve Polygon FARKLI `chain` degerleri olarak
 * saklanir ama AYNI EVM adresini paylasirlar (ayni private key, ayni
 * turetme yolu — bkz. evmWallet.js). Bu yuzden "sibling" adres aranirken
 * TUM EVM zincirleri (`EVM_CHAINS`) taranir, sadece ayni `chain` degil.
 *
 * @param {string} userId
 * @param {string} currencyCode config/crypto.js CURRENCIES anahtari (USDT_BEP20 | USDT_POLYGON)
 */
async function getOrCreateAddress(userId, currencyCode) {
	const currency = getCurrency(currencyCode);
	if (!currency || currency.family !== 'EVM') {
		const err = new Error(`Desteklenmeyen EVM para birimi: ${currencyCode}`);
		err.statusCode = 400;
		throw err;
	}

	const existing = await CryptoAddress.findOne({
		user: userId,
		chain: currency.chain,
		currency: currency.code,
	}).lean();

	if (existing) return format(existing, currency);

	// Kullanicinin BASKA bir EVM agi icin (or. BEP20) zaten adresi varsa,
	// yeni indeks almadan AYNI adresi/indeksi paylas (BSC ve Polygon ayni
	// adres formatini kullanir).
	const sibling = await CryptoAddress.findOne({
		user: userId,
		chain: { $in: EVM_CHAINS },
	}).lean();

	const { address, index } = sibling
		? { address: sibling.address, index: sibling.derivationIndex }
		: await allocateNewAddress();

	try {
		const created = await CryptoAddress.create({
			user: userId,
			chain: currency.chain,
			currency: currency.code,
			address,
			derivationIndex: index,
		});
		return format(created.toObject(), currency);
	} catch (err) {
		// 11000 = unique index ihlali: eszamanli istek bizden once olusturmus.
		if (err && err.code === 11000) {
			const raced = await CryptoAddress.findOne({
				user: userId,
				chain: currency.chain,
				currency: currency.code,
			}).lean();
			if (raced) return format(raced, currency);
		}
		throw err;
	}
}

/**
 * Atomik indeks tahsisi. TRON'dan AYRI bir sayac kullanilir (evm:derivationIndex)
 * — iki zincirin indeksleri karisirsa (ayni indeks farkli seed'lerden farkli
 * adres uretir, bu teknik olarak sorun degildir) yine de karisikligi onlemek
 * icin ayri tutulur.
 */
async function allocateNewAddress() {
	const index = await Counter.next(INDEX_COUNTER_KEY);
	const address = evmWallet.deriveAddress(index);
	return { address, index };
}

function format(doc, currency) {
	return {
		address: doc.address,
		currency: currency.code,
		displayCode: currency.walletCode,
		label: currency.label,
		chain: currency.chain,
		network: currency.network,
		decimals: currency.decimals,
		minDepositUnits: currency.minDepositUnits,
	};
}

/** Izleyicinin adres → kullanici eslemesi icin (chain bazinda filtrelenir). */
async function findByAddresses(chain, addresses) {
	if (!Array.isArray(addresses) || addresses.length === 0) return [];
	return CryptoAddress.find({ chain, address: { $in: addresses } }).lean();
}

module.exports = {
	EVM_CHAINS,
	INDEX_COUNTER_KEY,
	getOrCreateAddress,
	findByAddresses,
};
