const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const User = require("../database/models/User");
const Deposit = require("../database/models/Deposit");
const CryptoTransaction = require("../database/models/CryptoTransaction");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const ReferralCampaign = require("../database/models/ReferralCampaign");
const { authorizeUser } = require("../middleware/auth");
const { updateUserBalance } = require("../utils/wallet");

const MIN_AFFILIATE_CLAIM = Math.max(0, Number(process.env.AFFILIATE_MIN_CLAIM) || 1.5);
const campaignCode = () => `REF${require("crypto").randomBytes(5).toString("hex").toUpperCase()}`;
const campaignResponse = (campaign, referralCount = 0, profit = 0) => ({
	id: campaign._id.toString(),
	name: campaign.name,
	code: campaign.code,
	createdAt: campaign.createdAt,
	default: campaign.isDefault,
	commissionShare: campaign.commissionShare,
	referrals: referralCount,
	profit,
});

async function ensureDefaultCampaign(user) {
	let campaign = await ReferralCampaign.findOne({ owner: user._id, isDefault: true });
	if (!campaign) {
		let code = String(user.affiliates?.code || "").trim().toUpperCase();
		if (!code) code = campaignCode();
		try {
			campaign = await ReferralCampaign.create({ owner: user._id, name: "Default Campaign", code, isDefault: true });
		} catch (error) {
			if (error.code !== 11000) throw error;
			campaign = await ReferralCampaign.create({ owner: user._id, name: "Default Campaign", code: campaignCode(), isDefault: true });
		}
		if (!user.affiliates?.code) await User.updateOne({ _id: user._id }, { $set: { "affiliates.code": campaign.code } });
	}
	return campaign;
}

// Giriş yapma endpointi
router.post("/login", async (req, res) => {
	const { username, password } = req.body;

	try {
		// Kullanıcıyı username'e göre bul
		const user = await User.findOne({ username: username });

		if (!user) {
			return res.status(404).json({ message: "Kullanıcı bulunamadı." });
		}

		// Şifreyi kontrol et
		const passwordMatch = await bcrypt.compare(
			password,
			user.local.password
		);
		if (!passwordMatch) {
			return res.status(401).json({ message: "Geçersiz şifre." });
		}

		// Kullanıcının rank değerini kontrol et
		if (user.rank !== "partner") {
			return res.status(403).json({ message: "Partner değilsiniz." });
		}

		// Giriş başarılı
		res.status(200).json({
			message: "Giriş başarılı.",
			user: {
				id: user._id, // Kullanıcı ID'si
				username: user.username,
				name: user.name,
				email: user.local.email,
				rank: user.rank,
				balance: user.balance,
			},
		});
	} catch (error) {
		console.error("Hata:", error);
		res.status(500).json({ message: "Sunucu hatası." });
	}
});

// Toplam referans sayısını hesaplama endpoint'i - ⚠️ GÜVENLİK: Sadece kendi referanslarını görebilir
router.get("/referrals/:id", authorizeUser(true), async (req, res) => {
	const { id } = req.params; // Giriş yapan kullanıcının ID'si

	// Sadece kendi referanslarını görebilir
	if (req.user._id.toString() !== id) {
		return res.status(403).json({ success: false, message: "Yetkisiz erişim" });
	}

	try {
		// Referrer alanında verilen ID'ye sahip kullanıcıları say
		const referralCount = await User.countDocuments({
			"affiliates.referrer": id,
		});

		// Sonucu döndür
		res.status(200).json({
			message: "Toplam referans sayısı başarıyla hesaplandı.",
			referralCount,
		});
	} catch (error) {
		console.error("Hata:", error);
		res.status(500).json({ message: "Sunucu hatası." });
	}
});

// ⚠️ GÜVENLİK: Sadece kendi affiliate bilgilerini görebilir
router.get("/info/:id", authorizeUser(true), async (req, res) => {
	const { id } = req.params;

	// Sadece kendi bilgilerini görebilir
	if (req.user._id.toString() !== id) {
		return res.status(403).json({ success: false, message: "Yetkisiz erişim" });
	}

	try {
		const user = await User.findById(id).select(
			"affiliates.earned affiliates.available"
		);
		if (!user) {
			return res.status(404).json({ message: "Kullanıcı bulunamadı." });
		}
		res.status(200).json({ affiliates: user.affiliates });
	} catch (error) {
		console.error("Hata:", error);
		res.status(500).json({ message: "Sunucu hatası." });
	}
});

// Referansların toplam depozit miktarını hesaplama endpoint'i - ⚠️ GÜVENLİK
router.get("/referrals/total-deposits/:id", authorizeUser(true), async (req, res) => {
	const { id } = req.params; // Giriş yapan kullanıcının ID'si

	// Sadece kendi referanslarının depozitlerini görebilir
	if (req.user._id.toString() !== id) {
		return res.status(403).json({ success: false, message: "Yetkisiz erişim" });
	}

	try {
		// Kullanıcının referanslarını al
		const referrals = await User.find({ "affiliates.referrer": id }, "_id");
		const referralIds = referrals.map((referral) => referral._id);

		// Deposit modelinden toplam miktarı hesapla
		const depositTotal = await Deposit.aggregate([
			{ $match: { user: { $in: referralIds } } },
			{ $group: { _id: null, totalAmount: { $sum: "$amount" } } },
		]);

		// CryptoTransaction modelinden toplam miktarı hesapla
		const cryptoTotal = await CryptoTransaction.aggregate([
			{
				$match: {
					user: { $in: referralIds },
					"data.type": "deposit",
					state: "completed",
				},
			},
			{ $group: { _id: null, totalAmount: { $sum: "$amount" } } },
		]);

		// Toplam depozit miktarını hesapla
		const totalDeposits =
			(depositTotal[0]?.totalAmount || 0) +
			(cryptoTotal[0]?.totalAmount || 0);

		// Sonucu döndür
		res.status(200).json({
			message: "Toplam depozit miktarı başarıyla hesaplandı.",
			totalDeposits,
		});
	} catch (error) {
		console.error("Hata:", error);
		res.status(500).json({ message: "Sunucu hatası." });
	}
});

router.get("/referrals/last-five/:id", async (req, res) => {
	const { id } = req.params; // Giriş yapan kullanıcının ID'si

	try {
		// Son 5 referansı tarihe göre sıralayarak al
		const lastFiveUsers = await User.find({ "affiliates.referrer": id })
			.sort({ createdAt: -1 }) // Tarihe göre sıralama
			.limit(5) // Sadece 5 kullanıcı
			.select("_id name username createdAt"); // Gerekli alanları seç

		res.status(200).json({
			message: "Son 5 kullanıcı başarıyla alındı.",
			users: lastFiveUsers,
		});
	} catch (error) {
		console.error("Hata:", error);
		res.status(500).json({ message: "Sunucu hatası." });
	}
});

// Referans kullanıcıların verilerini döndüren endpoint
router.get("/referrals/stats/:id", async (req, res) => {
	const { id } = req.params; // Giriş yapan kullanıcının ID'si

	try {
		// Kullanıcının referans kullanıcılarını al
		const referrals = await User.find({ "affiliates.referrer": id }).select(
			"name username stats.deposit stats.withdrawal stats.bet createdAt"
		);

		res.status(200).json({
			message: "Referans kullanıcılar başarıyla alındı.",
			referrals,
		});
	} catch (error) {
		console.error("Hata:", error);
		res.status(500).json({ message: "Sunucu hatası." });
	}
});

// Referral Cabinet API — authenticated, user-scoped endpoints.
router.get("/overview", authorizeUser(true), async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select("username affiliates currency");
		if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
		const defaultCampaign = await ensureDefaultCampaign(user);
		const [referralCount, recentRewards] = await Promise.all([
			User.countDocuments({ "affiliates.referrer": user._id }),
			BalanceTransaction.find({ user: user._id, type: { $in: ["affiliateCommission", "affiliateDeposit"] }, state: "completed" })
				.populate("fromUser", "username").sort({ createdAt: -1 }).limit(20).lean(),
		]);
		res.json({ success: true, data: {
			totalProfit: Number(user.affiliates?.earned || 0),
			available: Number(user.affiliates?.available || 0),
			locked: Math.max(0, Number(user.affiliates?.earned || 0) - Number(user.affiliates?.available || 0)),
			totalReferrals: referralCount,
			minimumClaim: MIN_AFFILIATE_CLAIM,
			campaign: campaignResponse(defaultCampaign, referralCount, Number(user.affiliates?.earned || 0)),
			recentRewards: recentRewards.map((reward) => ({ id: reward._id, user: reward.fromUser?.username || "Player", amount: reward.amount, type: reward.type, createdAt: reward.createdAt })),
		} });
	} catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get("/campaigns", authorizeUser(true), async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select("affiliates");
		await ensureDefaultCampaign(user);
		const campaigns = await ReferralCampaign.find({ owner: user._id }).sort({ isDefault: -1, createdAt: -1 }).lean();
		const codes = campaigns.map((campaign) => campaign.code);
		const referrals = await User.aggregate([
			{ $match: { "affiliates.referrer": user._id, "affiliates.redeemedCode": { $in: codes } } },
			{ $group: { _id: "$affiliates.redeemedCode", count: { $sum: 1 } } },
		]);
		const counts = Object.fromEntries(referrals.map((item) => [item._id, item.count]));
		res.json({ success: true, data: campaigns.map((campaign) => campaignResponse(campaign, counts[campaign.code] || 0, 0)) });
	} catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post("/campaigns", authorizeUser(true), async (req, res) => {
	try {
		const name = String(req.body?.name || "").trim();
		if (!name || name.length > 80) return res.status(422).json({ success: false, message: "Kampanya adı 1-80 karakter olmalıdır." });
		const count = await ReferralCampaign.countDocuments({ owner: req.user._id });
		if (count >= 20) return res.status(409).json({ success: false, message: "En fazla 20 kampanya oluşturabilirsiniz." });
		const campaign = await ReferralCampaign.create({ owner: req.user._id, name, code: campaignCode() });
		res.status(201).json({ success: true, data: campaignResponse(campaign) });
	} catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: error.message }); }
});

router.delete("/campaigns/:id", authorizeUser(true), async (req, res) => {
	try {
		const campaign = await ReferralCampaign.findOne({ _id: req.params.id, owner: req.user._id });
		if (!campaign) return res.status(404).json({ success: false, message: "Kampanya bulunamadı." });
		if (campaign.isDefault) return res.status(409).json({ success: false, message: "Varsayılan kampanya silinemez." });
		await campaign.deleteOne();
		res.json({ success: true, data: { id: campaign._id } });
	} catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get("/referrals", authorizeUser(true), async (req, res) => {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
		const query = { "affiliates.referrer": req.user._id };
		if (req.query.campaign) query["affiliates.redeemedCode"] = String(req.query.campaign).toUpperCase();
		if (req.query.from || req.query.to) query.createdAt = {};
		if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
		if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
		const users = await User.find(query).select("username name createdAt affiliates.redeemedCode stats.deposit stats.bet").sort({ createdAt: -1 }).limit(limit).lean();
		res.json({ success: true, data: users.map((user) => ({ id: user._id, username: user.username || user.name || "Player", joinedAt: user.createdAt, campaignCode: user.affiliates?.redeemedCode || "", deposits: Number(user.stats?.deposit || 0), wagered: Number(user.stats?.bet || 0) })), meta: { total: users.length } });
	} catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post("/claim", authorizeUser(true), async (req, res) => {
	try {
		const user = await User.findOneAndUpdate(
			{ _id: req.user._id, "affiliates.available": { $gte: MIN_AFFILIATE_CLAIM } },
			{ $set: { "affiliates.available": 0 } },
			{ new: false },
		);
		if (!user) return res.status(409).json({ success: false, message: `Minimum claim is $${MIN_AFFILIATE_CLAIM}.` });
		const amount = Number(user.affiliates?.available || 0);
		try {
			const balance = await updateUserBalance(user, amount);
			if (balance === false) throw new Error("Aktif cüzdan bulunamadı.");
			await BalanceTransaction.create({ user: user._id, amount, type: "affiliateEarningClaim", state: "completed" });
			return res.json({ success: true, data: { amount, balance } });
		} catch (error) {
			await User.updateOne({ _id: user._id }, { $inc: { "affiliates.available": amount } });
			throw error;
		}
	} catch (error) {
		const status = error.message?.startsWith("Minimum claim") ? 409 : 500;
		res.status(status).json({ success: false, message: error.message });
	}
});

module.exports = router;
