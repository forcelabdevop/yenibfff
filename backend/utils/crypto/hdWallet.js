const { TronWeb } = require('tronweb');
const { TRON_DERIVATION_PREFIX } = require('../../config/crypto');

/**
 * TRON HD cuzdan turetme (self-custody).
 *
 * GUVENLIK KURALLARI — bu dosyayi degistirirken bunlara uyun:
 *  1. Mnemonic YALNIZ ortam degiskeninden okunur. Veritabanina yazilmaz,
 *     loglanmaz, hata mesajina konmaz, repoya girmez.
 *  2. Private key ASLA kalici yazilmaz. Yalnizca imzalama aninda (cekim/sweep)
 *     turetilir ve bellekte kalir.
 *  3. Adres turetme deterministiktir: ayni seed + ayni indeks = ayni adres.
 *     Bu yuzden veritabaninda adres + indeks saklamak yeterlidir.
 */

const MNEMONIC_ENV = 'TRON_HD_MNEMONIC';

let cachedMnemonic = null;

/**
 * Mnemonic'i ortamdan okur.
 * @throws {Error} Tanimli degilse — hata mesajinda seed ASLA yer almaz.
 */
function getMnemonic() {
	if (cachedMnemonic) return cachedMnemonic;

	const raw = process.env[MNEMONIC_ENV];
	if (!raw || !String(raw).trim()) {
		throw new Error(
			`${MNEMONIC_ENV} tanimli degil. Kripto yatirma altyapisi bu deger olmadan calisamaz.`,
		);
	}

	// Fazla bosluklari temizle; BIP39 kelimeler tek boslukla ayrilir.
	const normalized = String(raw).trim().replace(/\s+/g, ' ');

	const wordCount = normalized.split(' ').length;
	if (![12, 15, 18, 21, 24].includes(wordCount)) {
		throw new Error(
			`${MNEMONIC_ENV} gecersiz: BIP39 mnemonic 12/15/18/21/24 kelime olmali (bulunan: ${wordCount}).`,
		);
	}

	cachedMnemonic = normalized;
	return cachedMnemonic;
}

/** Yapilandirilan seed'in gecerli olup olmadigini soyler (deger sizdirmadan). */
function isConfigured() {
	try {
		getMnemonic();
		return true;
	} catch {
		return false;
	}
}

/**
 * Verilen indeks icin TRON adresini turetir.
 *
 * @param {number} index Turetme indeksi (>= 0, tam sayi)
 * @returns {string} Base58 TRON adresi (T ile baslar)
 */
function deriveAddress(index) {
	if (!Number.isInteger(index) || index < 0) {
		throw new Error(`Gecersiz turetme indeksi: ${index}`);
	}

	const account = TronWeb.fromMnemonic(getMnemonic(), `${TRON_DERIVATION_PREFIX}/${index}`);

	if (!account || !TronWeb.isAddress(account.address)) {
		throw new Error(`Turetilen adres gecersiz (indeks ${index}).`);
	}

	return account.address;
}

/**
 * Verilen indeks icin private key turetir.
 *
 * YALNIZCA imzalama aninda (cekim/sweep) cagirin. Donen degeri
 * loglamayin, veritabanina yazmayin, yanita koymayin.
 *
 * @param {number} index
 * @returns {string} Hex private key
 */
function derivePrivateKey(index) {
	if (!Number.isInteger(index) || index < 0) {
		throw new Error(`Gecersiz turetme indeksi: ${index}`);
	}
	const account = TronWeb.fromMnemonic(getMnemonic(), `${TRON_DERIVATION_PREFIX}/${index}`);
	return account.privateKey;
}

module.exports = {
	MNEMONIC_ENV,
	isConfigured,
	deriveAddress,
	derivePrivateKey,
};
