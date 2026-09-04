const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();

const { authorizeUser } = require('../../middleware/auth');
const CryptoDeposit = require('../../database/models/CryptoDeposit');
const tronAddressService = require('../../services/cryptoAddressService');
const evmAddressService = require('../../services/cryptoAddressServiceEvm');
const tronDepositWatcher = require('../../services/cryptoDepositWatcher');
const evmDepositWatcher = require('../../services/cryptoDepositWatcherEvm');
const { listCurrencies, getCurrency, NETWORK } = require('../../config/crypto');

/**
 * Kullanici basina "hemen tara" throttle'i — bellek ici, tek surec yeterli
 * (JobLock zaten cok-instance korumasi sagliyor, burada amac sadece TEK
 * kullanicinin ayni butona hizlica art art basarak TronGrid/RPC hiz sinirini
 * zorlamasini onlemek).
 */
const lastScanAt = new Map();
const SCAN_THROTTLE_MS = 8000;

/** Bellek buyumesini sinirlar: 10 dakikadan eski girdileri periyodik temizler. */
setInterval(() => {
	const cutoff = Date.now() - 10 * 60 * 1000;
	for (const [userId, ts] of lastScanAt) {
		if (ts < cutoff) lastScanAt.delete(userId);
	}
}, 5 * 60 * 1000);

/** Para biriminin ailesine (TRON/EVM) gore dogru adres servisini secer. */
function addressServiceFor(currency) {
	return currency.family === 'EVM' ? evmAddressService : tronAddressService;
}

/** En kucuk birimdeki tam sayiyi goruntulenebilir ondalik metne cevirir. */
const formatUnits = (units, decimals) => {
	const negative = BigInt(units) < 0n;
	const abs = negative ? -BigInt(units) : BigInt(units);
	const base = 10n ** BigInt(decimals);
	const whole = abs / base;
	const frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
	return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
};

/** Desteklenen yatirma para birimleri. */
router.get('/currencies', authorizeUser(true), async (req, res, next) => {
	try {
		const data = listCurrencies().map((currency) => ({
			code: currency.code,
			label: currency.label,
			chain: currency.chain,
			network: currency.network,
			decimals: currency.decimals,
			minDeposit: formatUnits(currency.minDepositUnits, currency.decimals),
			confirmationsRequired: currency.confirmationsRequired,
		}));
		res.json({ success: true, data, network: NETWORK });
	} catch (error) {
		next(error);
	}
});

/**
 * Kullanicinin kalici yatirma adresi. Ayni kullanici + para birimi icin her
 * cagrida AYNI adresi dondurur (Stake davranisi).
 */
router.get('/address', authorizeUser(true), async (req, res, next) => {
	try {
		// TAM kod (or. "USDT_BEP20") zorunlu kilinir: kisaltilmis "USDT" kodu
		// artik birden fazla aga (TRC20/BEP20/POLYGON) karsilik geldigi icin
		// getCurrency() BILEREK belirsiz eslesmede null doner (bkz. config/crypto.js).
		const currency = getCurrency(req.query.currency);
		if (!currency) {
			return res.status(400).json({
				success: false,
				message: 'Gecersiz veya belirsiz para birimi kodu. Tam kod gonderin (or. USDT_BEP20).',
			});
		}

		const data = await addressServiceFor(currency).getOrCreateAddress(
			req.user._id,
			currency.code,
		);

		// QR SUNUCUDA uretilir. Ucuncu parti bir QR servisine adres gondermek,
		// kullanicinin yatirma adresini disariya sizdirmak demektir.
		const qr = await QRCode.toDataURL(data.address, {
			errorCorrectionLevel: 'M',
			margin: 1,
			width: 240,
		});

		res.json({
			success: true,
			data: {
				...data,
				qr,
				minDeposit: formatUnits(data.minDepositUnits, data.decimals),
				confirmationsRequired: currency.confirmationsRequired,
			},
		});
	} catch (error) {
		if (error.statusCode === 400) {
			return res.status(400).json({ success: false, message: error.message });
		}
		// Seed eksikse servis firlatir; kullaniciya ic detay sizdirmadan bildir.
		if (/mnemonic|seed/i.test(error.message || '')) {
			console.error('[crypto] HD cuzdan yapilandirilmamis.');
			return res.status(503).json({
				success: false,
				code: 'CRYPTO_WALLET_NOT_CONFIGURED',
				message: 'Kripto yatırma yapılandırması tamamlanmamış. Lütfen destek ekibine bildirin.',
			});
		}
		next(error);
	}
});

/**
 * Kullanici yatirma bekleme sayfasindayken cagirir: kuyruk/cron dakikasini
 * beklemeden o para biriminin agini/adresini HEMEN tarar. Bkz.
 * services/cryptoDepositWatcher.js scanAddressNow() ve
 * services/cryptoDepositWatcherEvm.js scanNetworkNow() ust dokumantasyonu.
 *
 * NOT: Bu HALA anlik kredi VERMEZ — tespit edilen transfer normal onay
 * esigini bekler (TRON icin reorg korumasi). Sadece "hic tespit edilmeme"
 * bekleme suresini kaldirir.
 */
router.post('/scan', authorizeUser(true), async (req, res, next) => {
	try {
		const currency = getCurrency(req.query.currency || req.body.currency);
		if (!currency) {
			return res.status(400).json({
				success: false,
				message: 'Gecersiz veya belirsiz para birimi kodu. Tam kod gonderin (or. USDT_BEP20).',
			});
		}

		const userId = String(req.user._id);
		const now = Date.now();
		const last = lastScanAt.get(userId) || 0;
		if (now - last < SCAN_THROTTLE_MS) {
			return res.status(429).json({
				success: false,
				message: 'Cok sik tarama istegi. Lutfen birkac saniye bekleyin.',
				retryAfterMs: SCAN_THROTTLE_MS - (now - last),
			});
		}
		lastScanAt.set(userId, now);

		const result = currency.family === 'EVM'
			? await evmDepositWatcher.scanNetworkNow(currency)
			: await tronDepositWatcher.scanAddressNow(req.user._id);

		res.json({ success: true, data: result });
	} catch (error) {
		next(error);
	}
});

/** Kullanicinin son yatirmalari — onay sayaciyla birlikte. */
router.get('/history', authorizeUser(true), async (req, res, next) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 20, 100);
		const rows = await CryptoDeposit.find({ user: req.user._id })
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();

		const data = rows.map((row) => {
			const currency = getCurrency(row.currency);
			return {
				id: String(row._id),
				currency: row.currency,
				amount: formatUnits(row.amountUnits, row.decimals),
				status: row.status,
				confirmations: row.confirmations,
				confirmationsRequired: currency ? currency.confirmationsRequired : row.confirmations,
				txHash: row.txHash,
				createdAt: row.createdAt,
				creditedAt: row.creditedAt || null,
			};
		});

		res.json({ success: true, data });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
