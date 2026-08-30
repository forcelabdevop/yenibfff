const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();

const { authorizeUser } = require('../../middleware/auth');
const CryptoDeposit = require('../../database/models/CryptoDeposit');
const addressService = require('../../services/cryptoAddressService');
const {
	listCurrencies,
	CONFIRMATIONS_REQUIRED,
	NETWORK,
} = require('../../config/crypto');

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
			confirmationsRequired: CONFIRMATIONS_REQUIRED,
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
		const data = await addressService.getOrCreateAddress(
			req.user._id,
			req.query.currency,
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
				confirmationsRequired: CONFIRMATIONS_REQUIRED,
			},
		});
	} catch (error) {
		if (error.statusCode === 400) {
			return res.status(400).json({ success: false, message: error.message });
		}
		// Seed eksikse servis firlatir; kullaniciya ic detay sizdirmadan bildir.
		if (/mnemonic|seed/i.test(error.message || '')) {
			console.error('[crypto] HD cuzdan yapilandirilmamis:', error.message);
			return res.status(503).json({
				success: false,
				message: 'Kripto yatirma gecici olarak kullanilamiyor.',
			});
		}
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

		const data = rows.map((row) => ({
			id: String(row._id),
			currency: row.currency,
			amount: formatUnits(row.amountUnits, row.decimals),
			status: row.status,
			confirmations: row.confirmations,
			confirmationsRequired: CONFIRMATIONS_REQUIRED,
			txHash: row.txHash,
			createdAt: row.createdAt,
			creditedAt: row.creditedAt || null,
		}));

		res.json({ success: true, data });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
