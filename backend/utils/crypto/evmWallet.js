const { ethers } = require('ethers');
const { EVM_DERIVATION_PREFIX } = require('../../config/crypto');

/**
 * EVM (BSC + Polygon) HD cuzdan turetme (self-custody).
 *
 * hdWallet.js (TRON) ile AYNI guvenlik kurallarina uyar:
 *  1. Mnemonic YALNIZ ortam degiskeninden okunur. Veritabanina yazilmaz,
 *     loglanmaz, hata mesajina konmaz, repoya girmez.
 *  2. Private key ASLA kalici yazilmaz. Yalnizca imzalama aninda (sweep)
 *     turetilir ve bellekte kalir.
 *  3. Adres turetme deterministiktir: ayni seed + ayni indeks = ayni adres.
 *     BSC ve Polygon AYNI adres formatini kullanir; bu yuzden bir kullanicinin
 *     tek bir EVM indeksi HER IKI agda da gecerlidir (bkz.
 *     cryptoAddressServiceEvm.js).
 *
 * DIKKAT: Bu, TRON_HD_MNEMONIC'ten TAMAMEN AYRI bir seed'dir
 * (EVM_HD_MNEMONIC). Ayni seed'i iki zincirde paylasmak guvenlik acisindan
 * sakincali degildir (adresler farkli turetme yollarindan gelir) ama proje
 * ayrimi ve anahtar rotasyonunu kolaylastirmak icin ayri tutulur.
 */

const MNEMONIC_ENV = 'EVM_HD_MNEMONIC';

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
			`${MNEMONIC_ENV} tanimli degil. EVM (BSC/Polygon) kripto yatirma altyapisi bu deger olmadan calisamaz.`,
		);
	}

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

/** Verilen indeks icin turetilmis HD dugumunu (node) dondurur. */
function deriveNode(index) {
	if (!Number.isInteger(index) || index < 0) {
		throw new Error(`Gecersiz turetme indeksi: ${index}`);
	}
	const path = `${EVM_DERIVATION_PREFIX}/${index}`;
	// fromPhrase varsayilan olarak zaten m/44'/60'/0'/0/0 yoluna iner.
	// Bu dugumden tekrar mutlak bir m/... yolu turetmek ethers v6'da hata verir;
	// hedef yolu dogrudan olusturma asamasinda vermek gerekir.
	return ethers.HDNodeWallet.fromPhrase(getMnemonic(), undefined, path);
}

/**
 * Verilen indeks icin EVM adresini turetir (BSC ve Polygon'da ayni adres).
 * @param {number} index Turetme indeksi (>= 0, tam sayi)
 * @returns {string} 0x ile baslayan EVM adresi (checksum'li)
 */
function deriveAddress(index) {
	const node = deriveNode(index);
	if (!node || !ethers.isAddress(node.address)) {
		throw new Error(`Turetilen adres gecersiz (indeks ${index}).`);
	}
	return node.address;
}

/**
 * Verilen indeks icin private key turetir.
 *
 * YALNIZCA imzalama aninda (sweep) cagirin. Donen degeri loglamayin,
 * veritabanina yazmayin, yanita koymayin.
 *
 * @param {number} index
 * @returns {string} 0x ile baslayan hex private key
 */
function derivePrivateKey(index) {
	return deriveNode(index).privateKey;
}

module.exports = {
	MNEMONIC_ENV,
	isConfigured,
	deriveAddress,
	derivePrivateKey,
};
