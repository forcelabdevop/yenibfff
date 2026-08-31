const express = require("express");
const mongoose = require("mongoose");

const { checkPermission } = require("../../middleware/permission");
const CryptoDeposit = require("../../database/models/CryptoDeposit");
const CryptoAddress = require("../../database/models/CryptoAddress");
const { CURRENCIES, listCurrencies } = require("../../config/crypto");

const router = express.Router();

/**
 * Kendi HD altyapimiz uzerinden gelen on-chain yatirmalarin IZLEME ekrani.
 *
 * SALT OKUNUR — bilincli bir tercih. Yatirmalar zincir tarafindan dogrulanip
 * izleyici tarafindan otomatik kredi edilir. Panelden manuel "onayla" dugmesi
 * koymak, zincirde karsiligi olmayan bakiye yaratmanin en kolay yolu olurdu;
 * ayrica mukerrer krediye karsi kurulmus unique index korumasini da devre disi
 * birakmis olurduk. Bu yuzden burada yalnizca GET uclari var.
 */

/** Tam sayi + ondalik haneden okunabilir tutar. Float aritmetigi YOK. */
const formatUnits = (units, decimals) => {
	const negative = Number(units) < 0;
	const digits = String(Math.abs(Number(units) || 0)).padStart(
		Number(decimals) + 1,
		"0",
	);
	const whole = digits.slice(0, digits.length - decimals);
	const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
	return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
};

/**
 * config/crypto.js anahtarindan gosterim kodu (USDT_TRC20 -> USDT).
 * Alan adi `walletCode`; kullanicinin bakiye tarafinda gordugu kod budur.
 * Bilinmeyen bir anahtar gelirse ilk parcaya duseriz — panel bos hucre yerine
 * en azindan anlamli bir sey gosterir.
 */
const displayCodeFor = (currency) =>
	CURRENCIES?.[currency]?.walletCode ||
	CURRENCIES?.[currency]?.label ||
	String(currency || "").split("_")[0];

const clampInt = (value, fallback, min, max) => {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(Math.max(parsed, min), max);
};

/**
 * GET /admin/crypto-deposits
 * Sayfalanmis yatirma listesi + durum ozeti.
 */
router.get("/", checkPermission("finance.deposits.read"), async (req, res) => {
	try {
		const page = clampInt(req.query.page, 1, 1, 100000);
		// Ust sinir: filtresiz "limit=100000" ile paneli/veritabanini kilitlemeyi onler.
		const limit = clampInt(req.query.limit, 20, 1, 100);

		const filter = {};
		if (req.query.status === "pending" || req.query.status === "credited") {
			filter.status = req.query.status;
		}
		if (req.query.currency) filter.currency = String(req.query.currency);

		// Serbest metin arama: adres veya islem hash'i. Kullanici girdisi regex
		// olarak KACIRILMADAN kullanilirsa ReDoS riski dogar; bu yuzden tam
		// esitlik ariyoruz — zaten ikisi de tam deger olarak bilinir.
		const search = String(req.query.search || "").trim();
		if (search) filter.$or = [{ address: search }, { txHash: search }];

		const [rows, total, statusAgg] = await Promise.all([
			CryptoDeposit.find(filter)
				.sort({ createdAt: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.populate("user", "username local.email")
				.lean(),
			CryptoDeposit.countDocuments(filter),
			CryptoDeposit.aggregate([
				{ $group: { _id: "$status", count: { $sum: 1 } } },
			]),
		]);

		const deposits = rows.map((row) => ({
			id: String(row._id),
			user: row.user
				? {
						id: String(row.user._id),
						username: row.user.username || null,
						email: row.user.local?.email || null,
					}
				: null,
			chain: row.chain,
			currency: row.currency,
			displayCode: displayCodeFor(row.currency),
			address: row.address,
			txHash: row.txHash,
			amount: formatUnits(row.amountUnits, row.decimals),
			confirmations: row.confirmations,
			blockNumber: row.blockNumber,
			status: row.status,
			creditedAmount: row.creditedAmount,
			creditedAt: row.creditedAt,
			createdAt: row.createdAt,
		}));

		const counts = { pending: 0, credited: 0 };
		for (const entry of statusAgg) {
			if (entry._id in counts) counts[entry._id] = entry.count;
		}

		res.json({
			success: true,
			data: {
				deposits,
				pagination: {
					page,
					limit,
					total,
					pages: Math.max(1, Math.ceil(total / limit)),
				},
				stats: counts,
			},
		});
	} catch (error) {
		console.error("[admin/crypto-deposits] liste hatasi:", error);
		res.status(500).json({ success: false, message: "Liste alinamadi" });
	}
});

/**
 * GET /admin/crypto-deposits/addresses
 * Kullanicilara tahsis edilmis yatirma adresleri.
 *
 * derivationIndex bilincli olarak DISARIDA birakildi: turetme yolunu sizdirmak
 * cuzdan yapisi hakkinda gereksiz bilgi verir ve panelde hicbir ise yaramaz.
 */
router.get(
	"/addresses",
	checkPermission("finance.deposits.read"),
	async (req, res) => {
		try {
			const page = clampInt(req.query.page, 1, 1, 100000);
			const limit = clampInt(req.query.limit, 20, 1, 100);

			const [rows, total] = await Promise.all([
				CryptoAddress.find({})
					.sort({ createdAt: -1 })
					.skip((page - 1) * limit)
					.limit(limit)
					.populate("user", "username local.email")
					.lean(),
				CryptoAddress.countDocuments({}),
			]);

			res.json({
				success: true,
				data: {
					addresses: rows.map((row) => ({
						id: String(row._id),
						user: row.user
							? {
									id: String(row.user._id),
									username: row.user.username || null,
									email: row.user.local?.email || null,
								}
							: null,
						chain: row.chain,
						currency: row.currency,
						displayCode: displayCodeFor(row.currency),
						address: row.address,
						lastScannedAt: row.lastScannedAt,
						createdAt: row.createdAt,
					})),
					pagination: {
						page,
						limit,
						total,
						pages: Math.max(1, Math.ceil(total / limit)),
					},
				},
			});
		} catch (error) {
			console.error("[admin/crypto-deposits] adres hatasi:", error);
			res.status(500).json({ success: false, message: "Adresler alinamadi" });
		}
	},
);

/**
 * GET /admin/crypto-deposits/user/:userId
 * Tek bir kullanicinin SABIT kripto cuzdan(lar)i + yatirim yapmis mi ozeti.
 * Kullanici profili (admin panel > Finans) icin kullanilir.
 *
 * Desteklenen her para birimi icin ayri satir dondurulur; kullanici henuz
 * hic yatirma sayfasini acmamissa (ve kayit-oncesi eski bir hesapsa) adres
 * `null` gelir — bu durumda "atanmadi" olarak gosterilmelidir. Yeni kayitlar
 * icin adres kayit anindan itibaren zaten atanmis olur (bkz.
 * routes/auth/credentials/index.js).
 */
router.get(
	"/user/:userId",
	checkPermission("finance.deposits.read"),
	async (req, res) => {
		try {
			const { userId } = req.params;
			if (!mongoose.Types.ObjectId.isValid(userId)) {
				return res
					.status(400)
					.json({ success: false, message: "Gecersiz kullanici id" });
			}

			const [addresses, depositAgg] = await Promise.all([
				CryptoAddress.find({ user: userId }).lean(),
				CryptoDeposit.aggregate([
					{ $match: { user: new mongoose.Types.ObjectId(userId) } },
					{
						$group: {
							_id: "$currency",
							depositCount: { $sum: 1 },
							creditedCount: {
								$sum: { $cond: [{ $eq: ["$status", "credited"] }, 1, 0] },
							},
							totalCreditedAmount: { $sum: "$creditedAmount" },
							lastDepositAt: { $max: "$createdAt" },
						},
					},
				]),
			]);

			const addressByCurrency = new Map(
				addresses.map((row) => [row.currency, row]),
			);
			const depositByCurrency = new Map(
				depositAgg.map((row) => [row._id, row]),
			);

			const wallets = listCurrencies().map((currency) => {
				const addressRow = addressByCurrency.get(currency.code);
				const depositRow = depositByCurrency.get(currency.code);

				return {
					currency: currency.code,
					displayCode: displayCodeFor(currency.code),
					chain: currency.chain,
					network: currency.network,
					address: addressRow?.address || null,
					assignedAt: addressRow?.createdAt || null,
					hasDeposited: Boolean(depositRow?.creditedCount),
					depositCount: depositRow?.depositCount || 0,
					// creditedAmount kullanicinin coin bakiyesi biriminde (float, ondalik
					// hassasiyet zaten kucuk); formatUnits burada gerekmez.
					totalCreditedAmount: depositRow?.totalCreditedAmount || 0,
					lastDepositAt: depositRow?.lastDepositAt || null,
				};
			});

			res.json({ success: true, data: { wallets } });
		} catch (error) {
			console.error("[admin/crypto-deposits] kullanici cuzdan hatasi:", error);
			res
				.status(500)
				.json({ success: false, message: "Kullanici cuzdan bilgisi alinamadi" });
		}
	},
);

module.exports = router;

// Tutar bicimleme para hesabidir; testler dogrudan cagirabilsin diye disari
// acildi (tests/adminCryptoDeposits.test.js).
module.exports.formatUnits = formatUnits;
module.exports.displayCodeFor = displayCodeFor;
