const express = require("express");
const { TronWeb } = require("tronweb");

const { checkPermission, requireSuperAdmin } = require("../../middleware/permission");
const CryptoSweep = require("../../database/models/CryptoSweep");
const CryptoWalletWithdrawal = require("../../database/models/CryptoWalletWithdrawal");
const hdWallet = require("../../utils/crypto/hdWallet");
const tronSigner = require("../../utils/crypto/tronSigner");
const cryptoSweepService = require("../../services/cryptoSweepService");
const { CURRENCIES, SWEEP_DERIVATION_INDEX } = require("../../config/crypto");
const { formatUnits, displayCodeFor } = require("./cryptoDeposits");

const router = express.Router();

/**
 * Toplama (sweep) cuzdani yonetim ekrani.
 *
 * Kullanicilarin kendi HD adreslerine yatirdigi TRX/USDT, sweep servisi
 * tarafindan otomatik olarak tek bir ana adrese (HD index 0) toplanir
 * (bkz. services/cryptoSweepService.js). Bu adres, sitenin gercek on-chain
 * kripto varliginin bulunduğu yerdir — kullanici bakiyeleri (User.wallets)
 * yalniz ic muhasebe kaydidir, zincirdeki fonlarla BIREBIR ES DEGILDIR.
 *
 * Bu router, bu toplama adresinin canli bakiyesini gostermeyi ve PLATFORM
 * DISINDAKI bir adrese (borsa, kisisel cuzdan) manuel cekim yapmayi saglar.
 * Cekim, gercek zincir islemidir ve GERI ALINAMAZ — bu yuzden hem permission
 * hem (varsayilan olarak) super admin kontrolu gerektirir.
 */

/** TRON aile para birimleri (bu cuzdan yalniz TRON'u yonetir). */
const TRON_CURRENCIES = Object.values(CURRENCIES).filter(
	(currency) => currency.family === "TRON",
);

const getCurrencyOrNull = (code) =>
	TRON_CURRENCIES.find((currency) => currency.code === String(code || "").toUpperCase()) ||
	null;

/**
 * Ondalikli metin tutari (kullanicidan gelen "5.5" gibi) en kucuk birime
 * (tam sayi) cevirir. Float aritmetigi YOK — string manipulasyonu ile.
 */
function parseUnits(amountText, decimals) {
	const text = String(amountText ?? "").trim();
	if (!/^\d+(\.\d+)?$/.test(text)) return null;

	const [wholePart, fractionPartRaw = ""] = text.split(".");
	if (fractionPartRaw.length > decimals) return null; // hassasiyet asimi

	const fractionPart = fractionPartRaw.padEnd(decimals, "0");
	const combined = `${wholePart}${fractionPart}`.replace(/^0+(?=\d)/, "");

	if (!/^\d+$/.test(combined)) return null;
	const units = Number(combined);
	if (!Number.isSafeInteger(units) || units <= 0) return null;
	return units;
}

/**
 * GET /admin/crypto-wallet
 * Toplama adresi + canli zincir bakiyeleri + son sweep/cekim ozetleri.
 */
router.get("/", checkPermission("finance.cryptoWallet.read"), async (req, res) => {
	try {
		if (!hdWallet.isConfigured()) {
			return res.status(503).json({
				success: false,
				message: "Kripto altyapisi yapilandirilmamis (TRON_HD_MNEMONIC eksik).",
			});
		}

		const address = hdWallet.deriveAddress(SWEEP_DERIVATION_INDEX);

		const [trxBalanceSun, usdtBalanceUnits, sweepCounts, recentSweeps, recentWithdrawals] =
			await Promise.all([
				tronSigner.getTrxBalance(address).catch(() => null),
				tronSigner
					.getTrc20Balance(address, CURRENCIES.USDT_TRC20.contract)
					.catch(() => null),
				CryptoSweep.aggregate([
					{ $group: { _id: "$status", count: { $sum: 1 } } },
				]),
				CryptoSweep.find({}).sort({ createdAt: -1 }).limit(20).lean(),
				CryptoWalletWithdrawal.find({})
					.sort({ createdAt: -1 })
					.limit(20)
					.populate("admin", "username local.email")
					.lean(),
			]);

		const counts = { pending: 0, gas_sent: 0, completed: 0, failed: 0 };
		for (const entry of sweepCounts) {
			if (entry._id in counts) counts[entry._id] = entry.count;
		}

		res.json({
			success: true,
			data: {
				address,
				network: "TRON",
				balances: {
					TRX: {
						units: trxBalanceSun,
						formatted: trxBalanceSun !== null ? formatUnits(trxBalanceSun, 6) : null,
					},
					USDT_TRC20: {
						units: usdtBalanceUnits !== null ? Number(usdtBalanceUnits) : null,
						formatted:
							usdtBalanceUnits !== null ? formatUnits(Number(usdtBalanceUnits), 6) : null,
					},
				},
				sweepStats: counts,
				recentSweeps: recentSweeps.map((row) => ({
					id: String(row._id),
					fromAddress: row.fromAddress,
					toAddress: row.toAddress,
					currency: row.currency,
					displayCode: displayCodeFor(row.currency),
					amount: formatUnits(row.amountUnits, CURRENCIES[row.currency]?.decimals ?? 6),
					status: row.status,
					txHash: row.txHash,
					lastError: row.lastError,
					createdAt: row.createdAt,
					completedAt: row.completedAt,
				})),
				recentWithdrawals: recentWithdrawals.map((row) => ({
					id: String(row._id),
					admin: row.admin
						? {
								username: row.admin.username || null,
								email: row.admin.local?.email || null,
							}
						: null,
					toAddress: row.toAddress,
					currency: row.currency,
					displayCode: displayCodeFor(row.currency),
					amount: formatUnits(row.amountUnits, CURRENCIES[row.currency]?.decimals ?? 6),
					status: row.status,
					txHash: row.txHash,
					lastError: row.lastError,
					createdAt: row.createdAt,
					completedAt: row.completedAt,
				})),
			},
		});
	} catch (error) {
		console.error("[admin/crypto-wallet] ozet hatasi:", error);
		res.status(500).json({ success: false, message: "Cuzdan bilgisi alinamadi" });
	}
});

/**
 * POST /admin/crypto-wallet/sweep-now
 * Kullanici adreslerinde biriken bakiyeleri hemen tarar ve bekleyen sweep
 * kayitlarini isler — normalde 5 dakikalik cron'u beklemek yerine anlik
 * tetiklemek icin (or. bir kullanicinin yatirimini hemen toplama adresine
 * tasimak istendiginde).
 */
router.post(
	"/sweep-now",
	checkPermission("finance.cryptoWallet.manage"),
	async (req, res) => {
		try {
			if (!hdWallet.isConfigured()) {
				return res.status(503).json({
					success: false,
					message: "Kripto altyapisi yapilandirilmamis (TRON_HD_MNEMONIC eksik).",
				});
			}

			const queued = await cryptoSweepService.discoverSweepable();
			const completed = await cryptoSweepService.processPendingSweeps();

			res.json({ success: true, data: { queued, completed } });
		} catch (error) {
			console.error("[admin/crypto-wallet] sweep-now hatasi:", error);
			res.status(500).json({ success: false, message: "Sweep tetiklenemedi" });
		}
	},
);

/**
 * POST /admin/crypto-wallet/withdraw
 * Toplama adresinden PLATFORM DISINDAKI bir adrese kripto gonderir.
 *
 * GERI ALINAMAZ zincir islemidir — requireSuperAdmin ile ek koruma altina
 * alinir (finance.cryptoWallet.manage permission'i yeterli DEGILDIR).
 */
router.post("/withdraw", requireSuperAdmin, async (req, res) => {
	try {
		if (!hdWallet.isConfigured()) {
			return res.status(503).json({
				success: false,
				message: "Kripto altyapisi yapilandirilmamis (TRON_HD_MNEMONIC eksik).",
			});
		}

		const { currency: currencyCode, toAddress, amount } = req.body || {};

		const currency = getCurrencyOrNull(currencyCode);
		if (!currency) {
			return res.status(400).json({
				success: false,
				message: "Gecersiz para birimi. Desteklenen: TRX, USDT_TRC20.",
			});
		}

		if (!TronWeb.isAddress(String(toAddress || ""))) {
			return res.status(400).json({
				success: false,
				message: "Gecersiz TRON adresi.",
			});
		}

		const units = parseUnits(amount, currency.decimals);
		if (units === null) {
			return res.status(400).json({
				success: false,
				message: `Gecersiz tutar. En fazla ${currency.decimals} ondalik hane girin.`,
			});
		}

		const fromAddress = hdWallet.deriveAddress(SWEEP_DERIVATION_INDEX);

		// Bakiye onceden kontrol edilir; zincir zaten yetersiz bakiyede
		// reddeder ama burada erken ve anlasilir bir hata donmek daha iyi.
		if (currency.contract) {
			const balance = await tronSigner.getTrc20Balance(fromAddress, currency.contract);
			if (BigInt(units) > balance) {
				return res.status(400).json({
					success: false,
					message: `Yetersiz bakiye. Mevcut: ${formatUnits(Number(balance), currency.decimals)} ${currency.walletCode}.`,
				});
			}
		} else {
			const balance = await tronSigner.getTrxBalance(fromAddress);
			// ~1.1 TRX bandwidth payi — sweep'teki ayni guvenlik mantigi.
			const feeBufferSun = 1_100_000;
			if (units > balance - feeBufferSun) {
				return res.status(400).json({
					success: false,
					message: `Yetersiz bakiye (islem ucreti payi dahil). Mevcut: ${formatUnits(balance, 6)} TRX.`,
				});
			}
		}

		const withdrawal = await CryptoWalletWithdrawal.create({
			admin: req.adminUser._id,
			fromAddress,
			toAddress,
			currency: currency.code,
			amountUnits: units,
			status: "pending",
		});

		try {
			const txHash = currency.contract
				? await tronSigner.sendTrc20(
						SWEEP_DERIVATION_INDEX,
						currency.contract,
						toAddress,
						units,
					)
				: await tronSigner.sendTrx(SWEEP_DERIVATION_INDEX, toAddress, units);

			await CryptoWalletWithdrawal.updateOne(
				{ _id: withdrawal._id },
				{ $set: { status: "completed", txHash, completedAt: new Date() } },
			);

			console.log(
				`[admin/crypto-wallet] cekim tamamlandi: ${formatUnits(units, currency.decimals)} ${currency.walletCode} -> ${toAddress} (tx ${txHash}, admin ${req.adminUser._id})`,
			);

			return res.json({
				success: true,
				data: {
					id: String(withdrawal._id),
					txHash,
					amount: formatUnits(units, currency.decimals),
					displayCode: currency.walletCode,
					toAddress,
				},
			});
		} catch (sendError) {
			await CryptoWalletWithdrawal.updateOne(
				{ _id: withdrawal._id },
				{ $set: { status: "failed", lastError: sendError.message } },
			);
			throw sendError;
		}
	} catch (error) {
		console.error("[admin/crypto-wallet] cekim hatasi:", error);
		res.status(500).json({
			success: false,
			message: `Cekim gonderilemedi: ${error.message}`,
		});
	}
});

module.exports = router;
