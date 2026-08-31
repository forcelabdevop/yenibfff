const CryptoAddress = require('../database/models/CryptoAddress');
const Counter = require('../database/models/Counter');
const hdWallet = require('../utils/crypto/hdWallet');
const { getCurrency } = require('../config/crypto');

const CHAIN = 'TRON';
const INDEX_COUNTER_KEY = 'tron:derivationIndex';

/**
 * Kullaniciya, verilen para birimi icin kalici yatirma adresi dondurur.
 * Adres yoksa atomik olarak yeni bir turetme indeksi alip olusturur.
 *
 * Stake davranisi: kullanici basina, ZINCIR basina TEK ve DEGISMEYEN adres —
 * o zincirdeki TUM para birimleri (TRX, USDT_TRC20, ...) AYNI adresi paylasir.
 * TRON'da bir adres = bir hesap; o hesap ayni anda hem native TRX hem de
 * herhangi bir TRC20 token bakiyesi tutabilir, dolayisiyla para birimi basina
 * ayri adres turetmenin teknik bir gerekce yoktur ve cryptoDepositWatcher
 * zaten her adresi TUM para birimleri icin tarar (bkz. o dosyadaki not).
 *
 * Her para birimi icin hala ayri bir CryptoAddress KAYDI olusturulur (admin
 * panelinde para birimi bazinda yatirim/bakiye takibi icin), ama `address`
 * ve `derivationIndex` alanlari ayni kullanicinin tum kayitlarinda birebir
 * aynidir.
 *
 * Yaris durumu: ayni kullanici iki sekmeden ayni anda istek atarsa iki istek de
 * yeni indeks alabilir. Bu durumda unique index ikinciyi reddeder; hata
 * yakalanip mevcut kayit dondurulur. Kaybedilen indeks bosa gider — zararsiz,
 * cunku indeks alani pratik olarak sinirsiz.
 *
 * @param {string} userId
 * @param {string} currencyCode config/crypto.js CURRENCIES anahtari
 * @returns {Promise<{address: string, currency: string, chain: string, network: string, label: string, minDepositUnits: number, decimals: number}>}
 */
async function getOrCreateAddress(userId, currencyCode) {
	const currency = getCurrency(currencyCode);
	if (!currency) {
		const err = new Error(`Desteklenmeyen para birimi: ${currencyCode}`);
		err.statusCode = 400;
		throw err;
	}

	const existing = await CryptoAddress.findOne({
		user: userId,
		chain: CHAIN,
		currency: currency.code,
	}).lean();

	if (existing) return format(existing, currency);

	// Kullanicinin bu zincirde BASKA bir para birimi icin adresi varsa
	// (or. TRX icin), yeni indeks almadan AYNI adresi/indeksi paylas.
	const sibling = await CryptoAddress.findOne({
		user: userId,
		chain: CHAIN,
	}).lean();

	const { address, index } = sibling
		? { address: sibling.address, index: sibling.derivationIndex }
		: await allocateNewAddress();

	try {
		const created = await CryptoAddress.create({
			user: userId,
			chain: CHAIN,
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
				chain: CHAIN,
				currency: currency.code,
			}).lean();
			if (raced) return format(raced, currency);
		}
		throw err;
	}
}

/**
 * Atomik indeks tahsisi. "oku sonra yaz" kalibi KULLANILMAZ; iki kullanici
 * ayni indeksi alirsa ayni adresi paylasir ve biri otekinin parasini alir.
 */
async function allocateNewAddress() {
	const index = await Counter.next(INDEX_COUNTER_KEY);
	const address = hdWallet.deriveAddress(index);
	return { address, index };
}

function format(doc, currency) {
	return {
		address: doc.address,
		currency: currency.code,
		// Kullaniciya GOSTERILECEK ad ("USDT"). `currency` ic anahtardir
		// ("USDT_TRC20") ve arayuzde gosterilmemelidir.
		displayCode: currency.walletCode,
		label: currency.label,
		chain: currency.chain,
		network: currency.network,
		decimals: currency.decimals,
		minDepositUnits: currency.minDepositUnits,
	};
}

/** Izleyicinin adres → kullanici eslemesi icin. */
async function findByAddresses(addresses) {
	if (!Array.isArray(addresses) || addresses.length === 0) return [];
	return CryptoAddress.find({ address: { $in: addresses } }).lean();
}

module.exports = {
	CHAIN,
	INDEX_COUNTER_KEY,
	getOrCreateAddress,
	findByAddresses,
};
