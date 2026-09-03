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
		// USDT-TRC20 resmi sozlesme adresi (mainnet) — SABIT KODLANDI.
		//
		// DIKKAT: Proje ayarlarindaki TRON_USDT_CONTRACT degeri GECERSIZ
		// (TMK1GZT73ADWoYxwCuLUFPtKrRWeqcSPkk — zincirde deploy edilmis bir
		// sozlesme degil, bir cuzdan adresine benziyor). Bu deger kullanilirsa
		// TronGrid "Invalid contract address" / HTTP 400 hatasi verir ve HICBIR
		// USDT-TRC20 yatirimi taranamaz/kredi edilemez (bkz. 02.09.2026 vaka:
		// ahmetmehmet kullanicisinin 5 USDT'si gunlerce taranamadi). Bu yuzden
		// process.env.TRON_USDT_CONTRACT BILEREK OKUNMUYOR; resmi Tether
		// sozlesmesi sabit kullaniliyor. Proje ayarindaki TRON_USDT_CONTRACT
		// duzeltilip dogrulanana kadar bu satiri DEGISTIRMEYIN.
		usdtContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
	},
	nile: {
		// Testnet — uctan uca deneme icin.
		fullHost: 'https://nile.trongrid.io',
		// Bilinen guncel Nile testnet USDT sozlesmesi (mainnet sozlesmesi
		// Nile'da gecersiz oldugu icin ayni sekilde sabit kodlandi).
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
 * Bir agin RPC ortam degiskenini coklu-uc noktaya cevirir.
 *
 * Virgul ile ayrilmis birden fazla URL desteklenir (orn.
 * `POLYGON_RPC_URL=https://a.example,https://b.example`) — evmClient.js
 * bunlari bir `ethers.FallbackProvider` icinde birlestirir ve BIRI
 * yanit vermezse/401-403/hiz-siniri hatasi verirse OTOMATIK olarak
 * digerine gecer. Ortam degiskeni HIC tanimli degilse, tek bir noktaya
 * (dogrudan bir tedarikci gibi) bagimli kalmamak icin BIRDEN FAZLA
 * herkese-acik yedek uc nokta varsayilan olarak kullanilir.
 *
 * DIKKAT (02.09.2026 vakasi): Sadece `https://polygon-rpc.com` kullanan
 * eski yapilandirma, bu servis anonim/coklu-kiracili trafigi reddetmeye
 * basladiginda ("API key disabled, reason: tenant disabled" 401/403)
 * TUM Polygon yatirma taramasini durdurdu — `[crypto-evm] POLYGON/...
 * taranamadi` hatasi dakikada bir tekrar etti. Coklu-uc-nokta failover,
 * TEK bir saglayicinin (ucretsiz katman/anti-abuse/gecici kesinti)
 * tum agi kilitlemesini onler. Uretimde yine de BSC_RPC_URL /
 * POLYGON_RPC_URL / ETH_RPC_URL'e dedicated bir saglayicinin (Alchemy,
 * Ankr, QuickNode vb.) API-key'li uc noktasini ONCE koymak (listenin
 * basina) en guvenilir kurulumdur — asagidaki varsayilanlar SADECE
 * bir env degiskeni hic tanimlanmamissa devreye giren ek bir guvenlik agidir.
 */
function resolveRpcUrls(envValue, defaults) {
	const fromEnv = String(envValue || '')
		.split(',')
		.map((url) => url.trim())
		.filter(Boolean);
	return fromEnv.length > 0 ? fromEnv : defaults;
}

/**
 * Desteklenen EVM aglari.
 *
 * BSC ve Polygon AYNI adresi (ayni private key) paylasir — EVM adres formati
 * zincire gore degismez. Bu yuzden ikisi de asagida `family: 'EVM'` ile
 * isaretlenir ve cryptoAddressServiceEvm.js kullanicinin HER IKI ag icin de
 * ayni adresi almasini saglar (bkz. o dosyadaki sibling-adres mantigi).
 *
 * `rpcUrls` bir DIZI'dir (bkz. resolveRpcUrls) — evmClient.js bunu tek bir
 * saglayici degil bir FallbackProvider olarak kurar.
 */
const EVM_NETWORKS = {
	ETHEREUM: {
		chainId: 1,
		rpcUrls: resolveRpcUrls(process.env.ETH_RPC_URL, [
			'https://ethereum-rpc.publicnode.com',
			'https://rpc.ankr.com/eth',
			'https://eth.llamarpc.com',
		]),
		nativeSymbol: 'ETH',
		confirmationsRequired: Number(process.env.ETH_CONFIRMATIONS || 20),
		tokens: {
			USDT: {
				contract: process.env.ETH_USDT_CONTRACT || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
				chainDecimals: 6,
			},
			USDC: {
				contract: process.env.ETH_USDC_CONTRACT || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
				chainDecimals: 6,
			},
		},
	},
	BEP20: {
		chainId: 56,
		rpcUrls: resolveRpcUrls(process.env.BSC_RPC_URL, [
			'https://bsc-dataseed.binance.org',
			'https://bsc-dataseed1.defibit.io',
			'https://bsc-rpc.publicnode.com',
		]),
		// Binance-Peg USDT (mainnet). 18 ondalik — bkz. dosya basi kanonik birim notu.
		usdtContract:
			process.env.BSC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955',
		chainDecimals: 18,
		nativeSymbol: 'BNB',
		confirmationsRequired: Number(process.env.BSC_CONFIRMATIONS || 15),
		tokens: {
			USDT: {
				contract: process.env.BSC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955',
				chainDecimals: 18,
			},
			USDC: {
				contract: process.env.BSC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
				chainDecimals: 18,
			},
		},
	},
	POLYGON: {
		chainId: 137,
		// polygon-rpc.com TEK BASINA yeterli DEGIL (bkz. resolveRpcUrls basindaki
		// 02.09.2026 vaka notu) — listede tutuluyor ama artik tek nokta degil.
		rpcUrls: resolveRpcUrls(process.env.POLYGON_RPC_URL, [
			'https://polygon-bor-rpc.publicnode.com',
			'https://rpc.ankr.com/polygon',
			'https://polygon.llamarpc.com',
			'https://polygon-rpc.com',
		]),
		// Polygon PoS (bridged) USDT. 6 ondalik — TRC20 ile ayni olcek, rescale gerekmez.
		usdtContract:
			process.env.POLYGON_USDT_CONTRACT || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
		chainDecimals: 6,
		nativeSymbol: 'POL',
		confirmationsRequired: Number(process.env.POLYGON_CONFIRMATIONS || 128),
		tokens: {
			USDT: {
				contract: process.env.POLYGON_USDT_CONTRACT || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
				chainDecimals: 6,
			},
			USDC: {
				contract: process.env.POLYGON_USDC_CONTRACT || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
				chainDecimals: 6,
			},
		},
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
	ETH_ETHEREUM: {
		code: 'ETH_ETHEREUM', walletCode: 'ETH', label: 'ETH', family: 'EVM',
		chain: 'ETHEREUM', network: 'ETHEREUM', type: 'native', decimals: 8,
		chainDecimals: 18, contract: null, minDepositUnits: 100_000,
		confirmationsRequired: EVM_NETWORKS.ETHEREUM.confirmationsRequired,
	},
	USDT_ETHEREUM: {
		code: 'USDT_ETHEREUM', walletCode: 'USDT', label: 'USDT', family: 'EVM',
		chain: 'ETHEREUM', network: 'ETHEREUM', type: 'erc-20', decimals: 6,
		chainDecimals: EVM_NETWORKS.ETHEREUM.tokens.USDT.chainDecimals,
		contract: EVM_NETWORKS.ETHEREUM.tokens.USDT.contract, minDepositUnits: 1_000_000,
		confirmationsRequired: EVM_NETWORKS.ETHEREUM.confirmationsRequired,
	},
	USDC_ETHEREUM: {
		code: 'USDC_ETHEREUM', walletCode: 'USDC', label: 'USDC', family: 'EVM',
		chain: 'ETHEREUM', network: 'ETHEREUM', type: 'erc-20', decimals: 6,
		chainDecimals: EVM_NETWORKS.ETHEREUM.tokens.USDC.chainDecimals,
		contract: EVM_NETWORKS.ETHEREUM.tokens.USDC.contract, minDepositUnits: 1_000_000,
		confirmationsRequired: EVM_NETWORKS.ETHEREUM.confirmationsRequired,
	},
	BNB_BEP20: {
		code: 'BNB_BEP20', walletCode: 'BNB', label: 'BNB', family: 'EVM',
		chain: 'BNB', network: 'BEP20', type: 'native', decimals: 8,
		chainDecimals: 18, contract: null, minDepositUnits: 100_000,
		confirmationsRequired: EVM_NETWORKS.BEP20.confirmationsRequired,
	},
	USDC_BEP20: {
		code: 'USDC_BEP20', walletCode: 'USDC', label: 'USDC', family: 'EVM',
		chain: 'BNB', network: 'BEP20', type: 'bep-20', decimals: 6,
		chainDecimals: EVM_NETWORKS.BEP20.tokens.USDC.chainDecimals,
		contract: EVM_NETWORKS.BEP20.tokens.USDC.contract, minDepositUnits: 1_000_000,
		confirmationsRequired: EVM_NETWORKS.BEP20.confirmationsRequired,
	},
	POL_POLYGON: {
		code: 'POL_POLYGON', walletCode: 'POL', label: 'POL', family: 'EVM',
		chain: 'POLYGON', network: 'POLYGON', type: 'native', decimals: 8,
		chainDecimals: 18, contract: null, minDepositUnits: 100_000,
		confirmationsRequired: EVM_NETWORKS.POLYGON.confirmationsRequired,
	},
	USDC_POLYGON: {
		code: 'USDC_POLYGON', walletCode: 'USDC', label: 'USDC', family: 'EVM',
		chain: 'POLYGON', network: 'POLYGON', type: 'polygon', decimals: 6,
		chainDecimals: EVM_NETWORKS.POLYGON.tokens.USDC.chainDecimals,
		contract: EVM_NETWORKS.POLYGON.tokens.USDC.contract, minDepositUnits: 1_000_000,
		confirmationsRequired: EVM_NETWORKS.POLYGON.confirmationsRequired,
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
	ETH_ETHEREUM: 100_000,
	USDT_ETHEREUM: 1_000_000,
	USDC_ETHEREUM: 1_000_000,
	BNB_BEP20: 100_000,
	USDT_BEP20: 1_000_000,
	USDC_BEP20: 1_000_000,
	POL_POLYGON: 100_000,
	USDT_POLYGON: 1_000_000,
	USDC_POLYGON: 1_000_000,
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
	ETHEREUM: BigInt(process.env.ETH_SWEEP_GAS_WEI || '3000000000000000'),
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
	Boolean(currency) && (currency.contract !== null || currency.type === 'native');

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
