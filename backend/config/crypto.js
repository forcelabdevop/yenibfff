/**
 * Kripto yatirma yapilandirmasi — TRON (v1) + EVM/BSC+Polygon (v2).
 *
 * Tum tutarlar en kucuk birimde TAM SAYI olarak islenir. Float kullanilmaz:
 * 0.1 + 0.2 !== 0.3 hatasi para kaybina yol acar.
 *
 * KANONIK BIRIM NOTU (EVM icin kritik):
 * USDT-BEP20 sozlesmesi 18 ondalik kullanir (1 USDT = 10^18 birim). Bu deger
 * JS Number guvenli tam sayi sinirini (2^53 ~ 9.007e15) COK asar — 1 USDT
 * bile (1e18) bu sinirin ustunde. Bu yuzden USDT_BEP20 icin veritabaninda
 * saklanan `amountUnits`, zincirdeki HAM wei degeri DEGIL, 6 ondalikli
 * KANONIK bir deger (TRC20 ile ayni olcek). Zincirden okunan wei degeri
 * `chainDecimals` kullanilarak kanonik 6 ondalige DAIMA asagi yuvarlanarak
 * (floor, ASLA yukari) cevrilir — bu, gercekte alinandan fazla kredi
 * verilmesini imkansiz kilar; kaybedilen tek sey 10^-12 USDT altindaki toz.
 * `decimals` alani HER ZAMAN bu kanonik degeri ifade eder; `chainDecimals`
 * yalniz utils/crypto/evmClient.js ve evmSigner.js icinde ham zincir
 * degerleriyle (bakiye okuma, sweep gonderimi) calisirken kullanilir.
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

// 31.08.2026 — TRON_HD_MNEMONIC guvenli, sohbette hic gosterilmemis yeni bir
// seed ile rotate edildi (SystemAction/requestEnvironmentVariables formu
// uzerinden, degeri hicbir zaman metin olarak gorunmedi). Eski test seed'i
// artik kullanilmiyor. Mainnet kilidi kaldirildi; TRON_NETWORK proje
// ayarindan okunuyor (varsayilan mainnet).
const NETWORK = process.env.TRON_NETWORK === 'nile' ? 'nile' : 'mainnet';

/** BIP44 TRON coin type: m/44'/195'/0'/0/{index} */
const TRON_DERIVATION_PREFIX = "m/44'/195'/0'/0";

/**
 * BIP44 EVM coin type (standart Ethereum yolu, BSC ve Polygon dahil TUM
 * EVM zincirlerinde AYNI adres formatini uretir): m/44'/60'/0'/0/{index}
 */
const EVM_DERIVATION_PREFIX = "m/44'/60'/0'/0";

/**
 * Desteklenen EVM aglari.
 *
 * BSC ve Polygon AYNI adresi (ayni private key) paylasir — EVM adres formati
 * zincire gore degismez. Bu yuzden ikisi de asagida `family: 'EVM'` ile
 * isaretlenir ve cryptoAddressServiceEvm.js kullanicinin HER IKI ag icin de
 * ayni adresi almasini saglar (bkz. o dosyadaki sibling-adres mantigi).
 *
 * `rpcUrl` bos kalirsa herkese acik, hiz siniri dusuk bir RPC'ye duser —
 * yalniz gelistirme/deneme icin. Uretimde BSC_RPC_URL / POLYGON_RPC_URL
 * dedicated bir saglayiciya (Alchemy, Ankr, QuickNode vb.) isaret etmeli.
 */
const EVM_NETWORKS = {
	BEP20: {
		chainId: 56,
		rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
		// Binance-Peg USDT (mainnet). 18 ondalik — bkz. dosya basi kanonik birim notu.
		usdtContract:
			process.env.BSC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955',
		chainDecimals: 18,
	},
	POLYGON: {
		chainId: 137,
		rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
		// Polygon PoS (bridged) USDT. 6 ondalik — TRC20 ile ayni olcek, rescale gerekmez.
		usdtContract:
			process.env.POLYGON_USDT_CONTRACT || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
		chainDecimals: 6,
	},
};

/**
 * Desteklenen yatirma para birimleri.
 *
 * `family` adres turetme/imzalama altyapisini secer ('TRON' -> hdWallet.js/
 * tronSigner.js, 'EVM' -> evmWallet.js/evmSigner.js). `chain`/`network`/`type`
 * ise KULLANICIYA gosterilen ve wallets[] semasinda saklanan zincir kimligidir
 * — ayni family icinde bile ag basina FARKLI olabilir (BEP20 vs POLYGON).
 *
 * `decimals` HER ZAMAN kanonik (gosterim/DB) ondalik sayisidir. EVM 18-ondalik
 * tokenlar icin `chainDecimals` ayrica tanimlanir (bkz. dosya basi notu).
 */
const CURRENCIES = {
	USDT_TRC20: {
		code: 'USDT_TRC20',
		// Kullanicinin bakiye tarafinda gordugu kod (wallets.coinType ile eslesir).
		walletCode: 'USDT',
		label: 'USDT',
		family: 'TRON',
		chain: 'TRON',
		network: 'TRC20',
		// DIKKAT: Bu deger kod tabanindaki cuzdan konvansiyonuyla ("trc-20",
		// tireli) birebir ayni olmali. rivoWallet.CRYPTO_DEPOSIT_WALLET_KEYS
		// "USDT|TRON|trc-20" bekliyor; uyusmazsa olusturulan cuzdan bir sonraki
		// kayitta normalizeWalletState tarafindan silinir ve kredi edilen bakiye
		// kaybolur. tests/cryptoDepositAddress.test.js bu tutarliligi dogrular.
		type: 'trc-20',
		decimals: 6,
		chainDecimals: 6,
		contract: TRON_NETWORKS[NETWORK].usdtContract,
		// Bu tutarin altindaki transferler tozlama (dust) sayilir, kredi edilmez.
		minDepositUnits: 1_000_000, // 1 USDT
		// Blok ~3sn; 20 blok ~1 dakika. Reorg korumasi.
		confirmationsRequired: Number(process.env.TRON_CONFIRMATIONS || 20),
	},
	TRX: {
		code: 'TRX',
		walletCode: 'TRX',
		label: 'TRX',
		family: 'TRON',
		chain: 'TRON',
		network: 'TRC20',
		type: 'native',
		decimals: 6,
		chainDecimals: 6,
		contract: null,
		minDepositUnits: 10_000_000, // 10 TRX
		confirmationsRequired: Number(process.env.TRON_CONFIRMATIONS || 20),
	},
	USDT_BEP20: {
		code: 'USDT_BEP20',
		walletCode: 'USDT',
		label: 'USDT',
		family: 'EVM',
		chain: 'BNB',
		network: 'BEP20',
		// rivoWallet.CRYPTO_DEPOSIT_WALLET_KEYS "USDT|BNB|bep-20" bekler —
		// degistirilirse orada da guncellenmeli (aksi halde bakiye kaybolur).
		type: 'bep-20',
		decimals: 6, // KANONIK (rescale edilmis) — chainDecimals'a bakiniz.
		chainDecimals: EVM_NETWORKS.BEP20.chainDecimals, // 18 — sozlesmenin gercek ondalik sayisi.
		contract: EVM_NETWORKS.BEP20.usdtContract,
		minDepositUnits: 1_000_000, // 1 USDT (kanonik 6 ondalikte)
		// BSC artik sabit blok sayisi degil "finalized" etiketiyle takip edilir
		// (bkz. utils/crypto/evmClient.js). Bu deger yalniz GOSTERIM icindir.
		confirmationsRequired: Number(process.env.BSC_CONFIRMATIONS_DISPLAY || 5),
	},
	USDT_POLYGON: {
		code: 'USDT_POLYGON',
		walletCode: 'USDT',
		label: 'USDT',
		family: 'EVM',
		chain: 'POLYGON',
		network: 'POLYGON',
		// rivoWallet.CRYPTO_DEPOSIT_WALLET_KEYS "USDT|POLYGON|polygon" bekler.
		type: 'polygon',
		decimals: 6,
		chainDecimals: EVM_NETWORKS.POLYGON.chainDecimals, // 6 — rescale gerekmez.
		contract: EVM_NETWORKS.POLYGON.usdtContract,
		minDepositUnits: 1_000_000, // 1 USDT
		// Polygon PoS derin reorg riski tasir; L1 checkpoint'e kadar 64-256 blok
		// arasi bir esik onerilir, orta nokta olarak 128 kullanilir.
		confirmationsRequired: Number(process.env.POLYGON_CONFIRMATIONS || 128),
	},
};

/**
 * Geriye uyumluluk icin: TRON'un tek-deger onay esigi. Yeni kod
 * `currency.confirmationsRequired` kullanmali (para birimine gore degisir).
 */
const CONFIRMATIONS_REQUIRED = CURRENCIES.USDT_TRC20.confirmationsRequired;

/**
 * Sweep (toplama) yapilandirmasi.
 *
 * Toplama adresi HD cuzdanin index 0'idir — kullaniciya ASLA atanmaz
 * (bkz. Counter baslangic degeri: scripts/backfillCryptoAddresses.js,
 * services/cryptoAddressService.js index 1'den baslar).
 */
const SWEEP_DERIVATION_INDEX = 0;

/** Bu esigin altindaki bakiyeler sweep edilmez (gas maliyetine degmez). */
const SWEEP_MIN_UNITS = {
	USDT_TRC20: 1_000_000, // 1 USDT
	TRX: 15_000_000, // 15 TRX (10 TRX min + islem/gas payi)
	USDT_BEP20: 1_000_000, // 1 USDT (kanonik 6 ondalikte)
	USDT_POLYGON: 1_000_000, // 1 USDT
};

/**
 * USDT sweep'i icin kullanici adresine gonderilecek gas (TRX, SUN).
 * TRC20 transfer enerji gerektirir; adreste enerji yoksa TRX yakilir.
 * 30 TRX, enerji kiralanmadigi durumda bir TRC20 transferini karsilar.
 */
const SWEEP_GAS_TRX_SUN = Number(process.env.TRON_SWEEP_GAS_SUN || 30_000_000);

/** USDT sweep'inde gas gonderdikten sonra ana transferden once beklenecek sure. */
const SWEEP_GAS_WAIT_MS = Number(process.env.TRON_SWEEP_GAS_WAIT_MS || 15_000);

/**
 * EVM USDT sweep'i icin kullanici adresine gonderilecek native gas (wei).
 * ERC20 transfer'in gerektirdigi gas ucretini karsilamaya yeter miktarda
 * BNB/MATIC. Varsayilanlar cok cok cok dusuk gas fiyatlarinda bile guvenli
 * bir pay birakacak sekilde bol tutulmustur (~birkac sent).
 */
const EVM_SWEEP_GAS_WEI = {
	BEP20: BigInt(process.env.BSC_SWEEP_GAS_WEI || '600000000000000'), // ~0.0006 BNB
	POLYGON: BigInt(process.env.POLYGON_SWEEP_GAS_WEI || '50000000000000000'), // ~0.05 MATIC/POL
};

/** EVM sweep'inde gas gonderdikten sonra ana transferden once beklenecek sure. */
const EVM_SWEEP_GAS_WAIT_MS = Number(process.env.EVM_SWEEP_GAS_WAIT_MS || 20_000);

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
 * Tam anahtar ("USDT_TRC20", "USDT_BEP20", "USDT_POLYGON") HER ZAMAN tercih
 * edilir ve dogrudan eslesir.
 *
 * Kullanicinin gordugu cuzdan kodu ("USDT") ise ARTIK BIRDEN FAZLA ag
 * tarafindan paylasiliyor (TRC20/BEP20/POLYGON) — bu yuzden yalniz TEK bir
 * eslesme varsa geriye uyumluluk icin kabul edilir; birden fazla eslesme
 * varsa YANLIS AGA adres uretmemek icin BILEREK null donulur (cagiran taraf
 * tam kodu (currency.code) gondermeye zorlanir). Frontend artik her zaman
 * tam kodu gonderiyor (bkz. wallet-modal.js loadDepositAddress).
 */
const getCurrency = (code) => {
	const normalized = String(code || '').toUpperCase();
	if (!normalized) return null;

	if (CURRENCIES[normalized]) {
		return isAvailable(CURRENCIES[normalized]) ? CURRENCIES[normalized] : null;
	}

	const matches = Object.values(CURRENCIES).filter(
		(entry) => entry.walletCode.toUpperCase() === normalized,
	);
	if (matches.length !== 1) return null;

	return isAvailable(matches[0]) ? matches[0] : null;
};

module.exports = {
	NETWORK,
	TRON_FULL_HOST: TRON_NETWORKS[NETWORK].fullHost,
	TRON_DERIVATION_PREFIX,
	EVM_DERIVATION_PREFIX,
	EVM_NETWORKS,
	CURRENCIES,
	CONFIRMATIONS_REQUIRED,
	SWEEP_DERIVATION_INDEX,
	SWEEP_MIN_UNITS,
	SWEEP_GAS_TRX_SUN,
	SWEEP_GAS_WAIT_MS,
	EVM_SWEEP_GAS_WEI,
	EVM_SWEEP_GAS_WAIT_MS,
	getCurrency,
	isSupportedCurrency: (code) => getCurrency(code) !== null,
	/** Yalnizca gercekten kullanilabilir para birimleri. */
	listCurrencies: () => Object.values(CURRENCIES).filter(isAvailable),
};
