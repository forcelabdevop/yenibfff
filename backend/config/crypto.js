/**
 * Kripto yatirma yapilandirmasi — TRON (v1).
 *
 * Tum tutarlar en kucuk birimde (SUN, 6 hane) TAM SAYI olarak islenir.
 * Float kullanilmaz: 0.1 + 0.2 !== 0.3 hatasi para kaybina yol acar.
 */

const TRON_NETWORKS = {
	mainnet: {
		fullHost: 'https://api.trongrid.io',
		// USDT-TRC20 resmi sozlesme adresi (mainnet).
		usdtContract:
			process.env.TRON_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
	},
	nile: {
		// Testnet — uctan uca deneme icin.
		fullHost: 'https://nile.trongrid.io',
		// DIKKAT: TRON_USDT_CONTRACT proje ayarlarinda mainnet sozlesmesine
		// (TMK1GZT73ADWoYxwCuLUFPtKrRWeqcSPkk) ayarlandi ve Nile agi zorla
		// acildigi icin (yukarida NETWORK='nile') bu deger burada KULLANILAMAZ
		// — mainnet'teki bir sozlesme adresi Nile'da gecersizdir. Bilinen
		// guncel Nile testnet USDT sozlesmesi sabit kodlandi. TRON_USDT_CONTRACT
		// gercekten Nile icin dogru bir adresle guncellenirse bu sabiti kaldirip
		// env okumasini geri acin.
		usdtContract: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
	},
};

// ⚠️ GEÇİCİ GÜVENLİK KİLİDİ — kaldırmadan önce bu yorumu okuyun.
//
// Proje ayarlarındaki TRON_NETWORK değişkeni "Mainnet" olarak kaydedildi ve
// Vars formu üzerinden "nile"a düzeltilemedi (30.08.2026 — form kaydı env
// dosyasına yansımadı, kök sebep bilinmiyor). Şu an kullanılan
// TRON_HD_MNEMONIC salt test amaçlı üretildi ve bu sohbette AÇIKÇA
// gösterildi — dolayısıyla mainnet'te ASLA güvenli değildir. Biri bu
// adreslere gerçek USDT/TRX gönderirse o fon kalıcı olarak kaybolabilir.
//
// Bu satır env okumasını görmezden gelip ağı HER ZAMAN "nile" (testnet)
// olarak zorlar. TRON_NETWORK proje ayarlarında gerçekten "nile" olarak
// düzeltildiğinde VE mnemonic sohbette hiç gösterilmemiş güvenli bir
// üretim seed'i ile değiştirildiğinde, aşağıdaki satırı geri açıp bu
// zorlamayı kaldırın.
const NETWORK = 'nile';
// const NETWORK = process.env.TRON_NETWORK === 'nile' ? 'nile' : 'mainnet';

/** BIP44 TRON coin type: m/44'/195'/0'/0/{index} */
const TRON_DERIVATION_PREFIX = "m/44'/195'/0'/0";

/**
 * Desteklenen yatirma para birimleri.
 * `decimals` zincirdeki ondalik hane sayisi; hem TRX hem USDT-TRC20 icin 6.
 */
const CURRENCIES = {
	USDT_TRC20: {
		code: 'USDT_TRC20',
		// Kullanicinin bakiye tarafinda gordugu kod (wallets.coinType ile eslesir).
		walletCode: 'USDT',
		label: 'USDT',
		chain: 'TRON',
		network: 'TRC20',
		// DIKKAT: Bu deger kod tabanindaki cuzdan konvansiyonuyla ("trc-20",
		// tireli) birebir ayni olmali. rivoWallet.CRYPTO_DEPOSIT_WALLET_KEYS
		// "USDT|TRON|trc-20" bekliyor; uyusmazsa olusturulan cuzdan bir sonraki
		// kayitta normalizeWalletState tarafindan silinir ve kredi edilen bakiye
		// kaybolur. tests/cryptoDepositAddress.test.js bu tutarliligi dogrular.
		type: 'trc-20',
		decimals: 6,
		contract: TRON_NETWORKS[NETWORK].usdtContract,
		// Bu tutarin altindaki transferler tozlama (dust) sayilir, kredi edilmez.
		minDepositUnits: 1_000_000, // 1 USDT
	},
	TRX: {
		code: 'TRX',
		walletCode: 'TRX',
		label: 'TRX',
		chain: 'TRON',
		network: 'TRC20',
		type: 'native',
		decimals: 6,
		contract: null,
		minDepositUnits: 10_000_000, // 10 TRX
	},
};

/**
 * Onay esigi. TRON'da blok ~3sn; 20 blok ~1 dakika.
 * Esigin altindaki islem `pending` gosterilir, ASLA kredi edilmez (reorg korumasi).
 */
const CONFIRMATIONS_REQUIRED = Number(process.env.TRON_CONFIRMATIONS || 20);

/**
 * Bir para birimi kullanilabilir mi?
 *
 * Token'lar sozlesme adresi olmadan izlenemez. Adres eksikken para birimini
 * sunmak, kullanicinin parayi gonderip hicbir zaman kredi alamamasi demektir;
 * bu yuzden eksikse para birimi hic gosterilmez.
 */
const isAvailable = (currency) =>
	Boolean(currency) && (currency.contract !== null || currency.code === 'TRX');

/**
 * Para birimini koduna gore bulur.
 *
 * Hem tam anahtar ("USDT_TRC20") hem de kullanicinin gordugu cuzdan kodu
 * ("USDT") kabul edilir. Arayuz bakiye listesinden gelen kodu ("USDT")
 * gonderdigi icin yalnizca tam anahtari kabul etmek, yatirma adresi
 * alinamamasina yol acardi.
 */
const getCurrency = (code) => {
	const normalized = String(code || '').toUpperCase();
	if (!normalized) return null;

	const currency =
		CURRENCIES[normalized] ||
		Object.values(CURRENCIES).find(
			(entry) => entry.walletCode.toUpperCase() === normalized,
		) ||
		null;

	return isAvailable(currency) ? currency : null;
};

module.exports = {
	NETWORK,
	TRON_FULL_HOST: TRON_NETWORKS[NETWORK].fullHost,
	TRON_DERIVATION_PREFIX,
	CURRENCIES,
	CONFIRMATIONS_REQUIRED,
	getCurrency,
	isSupportedCurrency: (code) => getCurrency(code) !== null,
	/** Yalnizca gercekten kullanilabilir para birimleri. */
	listCurrencies: () => Object.values(CURRENCIES).filter(isAvailable),
};
