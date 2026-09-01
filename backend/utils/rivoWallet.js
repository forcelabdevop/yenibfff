const RIVO_WALLET = Object.freeze({
	coinType: "Rivo",
	chain: "TRON",
	type: "trc-20",
});

const toFiniteNumber = (value, fallback = 0) => {
	const normalizedValue = Number(value);
	return Number.isFinite(normalizedValue) ? normalizedValue : fallback;
};

const isRivoWallet = (wallet = {}) =>
	wallet.coinType === RIVO_WALLET.coinType &&
	wallet.chain === RIVO_WALLET.chain &&
	wallet.type === RIVO_WALLET.type;

const createRivoWallet = (balance = 0) => ({
	...RIVO_WALLET,
	balance: toFiniteNumber(balance, 0),
});

const findActiveWallet = (wallets = [], currency = {}) => {
	if (!Array.isArray(wallets) || wallets.length === 0) return null;

	const { coinType, chain, type } = currency || {};
	if (!coinType || !chain || !type) return null;

	return (
		wallets.find(
			(wallet) =>
				wallet.coinType === coinType &&
				wallet.chain === chain &&
				wallet.type === type
		) || null
	);
};

const pickRivoBalance = ({ wallets = [], currency = {} } = {}) => {
	if (!Array.isArray(wallets) || wallets.length === 0) return 0;

	const activeWallet = findActiveWallet(wallets, currency);
	if (activeWallet) {
		return toFiniteNumber(activeWallet.balance, 0);
	}

	const rivoWallet = wallets.find(isRivoWallet);
	if (rivoWallet) {
		return toFiniteNumber(rivoWallet.balance, 0);
	}

	return toFiniteNumber(wallets[0]?.balance, 0);
};

const normalizeCurrency = (currency = {}) => ({
	fiatCurrency: currency?.fiatCurrency || "EUR",
	coinType: RIVO_WALLET.coinType,
	chain: RIVO_WALLET.chain,
	type: RIVO_WALLET.type,
	coins: toFiniteNumber(currency?.coins, 0),
});

/**
 * On-chain yatirma icin kalici tutulmasi gereken kripto cuzdanlari.
 * "coinType|chain|type" anahtariyla tanimlanir.
 *
 * Bu liste disindaki cuzdanlar eskisi gibi elenir; boylece degisiklik yalnizca
 * bilerek destekledigimiz para birimlerini kapsar.
 */
const CRYPTO_DEPOSIT_WALLET_KEYS = Object.freeze([
	"USDT|TRON|trc-20",
	"TRX|TRON|native",
	// DIKKAT: Bu degerler config/crypto.js CURRENCIES.USDT_BEP20/USDT_POLYGON
	// icindeki walletCode/chain/type alanlariyla BIREBIR ayni olmali. Uyusmazsa
	// olusturulan cuzdan bir sonraki normalizeWalletState cagrisinda silinir ve
	// kredi edilen bakiye kaybolur (bkz. cryptoDepositWatcher.creditDeposit).
	"USDT|BNB|bep-20",
	"USDT|POLYGON|polygon",
]);

const walletKey = (wallet = {}) =>
	`${wallet.coinType}|${wallet.chain}|${wallet.type}`;

const isCryptoDepositWallet = (wallet = {}) =>
	CRYPTO_DEPOSIT_WALLET_KEYS.includes(walletKey(wallet));

/**
 * Cuzdan durumunu normalize eder.
 *
 * ONCEDEN: tum cuzdanlari tek Rivo cuzdanina indirgiyordu; bu yuzden kripto
 * bakiyeleri her kaydetmede siliniyor ve multi-currency imkansiz hale
 * geliyordu.
 *
 * SIMDI: Rivo cuzdani DEGISMEDEN ilk sirada kalir (wallets[0] varsayan mevcut
 * kodlar ve `currency` Rivo'yu isaret ettigi icin oyun/bonus mantigi aynen
 * calisir), ek olarak desteklenen kripto yatirma cuzdanlari korunur.
 */
const normalizeWalletState = ({ wallets = [], currency = {} } = {}) => {
	const source = Array.isArray(wallets) ? wallets : [];

	// Desteklenen kripto cuzdanlarini koru; ayni anahtardan yalniz bir tane kalsin.
	const seen = new Set();
	const cryptoWallets = [];
	for (const wallet of source) {
		if (!isCryptoDepositWallet(wallet)) continue;
		const key = walletKey(wallet);
		if (seen.has(key)) continue;
		seen.add(key);
		cryptoWallets.push({
			coinType: wallet.coinType,
			chain: wallet.chain,
			type: wallet.type,
			balance: toFiniteNumber(wallet.balance, 0),
		});
	}

	return {
		// Rivo daima ilk sirada — mevcut wallets[0] varsayimlarini bozmamak icin.
		wallets: [
			createRivoWallet(pickRivoBalance({ wallets: source, currency })),
			...cryptoWallets,
		],
		currency: normalizeCurrency(currency),
	};
};

/**
 * Cuzdan durumu zaten normalize mi?
 *
 * Kosul: ilk cuzdan Rivo, kalanlarin tamami desteklenen kripto yatirma
 * cuzdani ve `currency` Rivo'yu isaret ediyor.
 *
 * NOT: Eskiden "tam olarak tek cuzdan" araniyordu. Kripto cuzdanlari artik
 * kalici oldugu icin bu kosul, normalize kullanicilari da "migrate edilmemis"
 * sayip her aciliste gereksiz yeniden yazma yapilmasina yol acardi.
 */
const hasOnlyRivoWallet = ({ wallets = [], currency = {} } = {}) => {
	if (!Array.isArray(wallets) || wallets.length === 0) return false;
	if (!isRivoWallet(wallets[0])) return false;
	if (!wallets.slice(1).every(isCryptoDepositWallet)) return false;

	return (
		currency?.coinType === RIVO_WALLET.coinType &&
		currency?.chain === RIVO_WALLET.chain &&
		currency?.type === RIVO_WALLET.type
	);
};

module.exports = {
	RIVO_WALLET,
	CRYPTO_DEPOSIT_WALLET_KEYS,
	createRivoWallet,
	findActiveWallet,
	hasOnlyRivoWallet,
	isCryptoDepositWallet,
	isRivoWallet,
	normalizeCurrency,
	normalizeWalletState,
};
