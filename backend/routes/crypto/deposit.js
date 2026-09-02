const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();

const { authorizeUser } = require('../../middleware/auth');
const CryptoDeposit = require('../../database/models/CryptoDeposit');
const tronAddressService = require('../../services/cryptoAddressService');
const evmAddressService = require('../../services/cryptoAddressServiceEvm');
const { listCurrencies, getCurrency, NETWORK } = require('../../config/crypto');

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
