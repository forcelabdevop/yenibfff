/**
 * Kullanici hesap sayfalari icin uclar (Wallet, Profile, Account, Sessions, Vault).
 *
 * GUVENLIK: Bu dosyadaki TUM uclar kullaniciyi `req.user._id` uzerinden belirler;
 * hicbir uc URL'den userId almaz. Bu sayede IDOR (baskasinin verisini cekme)
 * yapisal olarak imkansizdir.
 */
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("../../database/models/User");
const UserActionLog = require("../../database/models/UserActionLog");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const { authorizeUser } = require("../../middleware/auth");
const {
	rateLimiterStrictMiddleware,
} = require("../../middleware/rateLimiter");
const { getActiveWallet, emitUserBalance } = require("../../utils/wallet");
const { normalizeWalletState } = require("../../utils/rivoWallet");

/** Para tutarini guvenli sekilde normalize eder. Gecersizse null doner. */
const normalizeAmount = (raw) => {
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) return null;
	// Kurus hassasiyeti; kayan nokta artiklarini temizler.
	const rounded = Math.round(value * 100) / 100;
	if (rounded <= 0 || rounded > 1_000_000_000) return null;
	return rounded;
};

/** Kasa kilidi aktif mi? */
const isVaultLocked = (user) => {
	const expireAt = user?.vault?.expireAt;
	if (!expireAt) return false;
	return new Date(expireAt).getTime() > Date.now();
};

/** Kasadaki ilgili cuzdan girdisini bulur. */
const findVaultEntry = (user, key) =>
	(user?.vault?.balances || []).find(
		(entry) =>
			entry.coinType === key.coinType &&
			entry.chain === key.chain &&
			entry.type === key.type
	) || null;

const vaultTotal = (user) =>
	(user?.vault?.balances || []).reduce(
		(sum, entry) => sum + (Number(entry.amount) || 0),
		0
	);

// ---------------------------------------------------------------------------
// GET /account/overview — Wallet / Profile / Account sayfalarinin ortak verisi
// ---------------------------------------------------------------------------
router.get("/overview", authorizeUser(true), async (req, res) => {
	try {
		const user = await User.findById(req.user._id)
			.select(
				"-local.password -ips -adminRole -mfa.methods.phone -mfa.methods.email"
			)
			.lean();

		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "Kullanici bulunamadi." });
		}

		const { wallets, currency } = normalizeWalletState(user);
		const activeWallet = getActiveWallet(user);

		res.json({
			success: true,
			data: {
				profile: {
					_id: user._id,
					numericId: user.numericId,
					username: user.username,
					name: user.name,
					email: user.local?.email || null,
					emailVerified: user.local?.emailVerified === true,
					phone: user.phone || null,
					birthday: user.birthday || null,
					avatar: user.avatar || null,
					rank: user.rank,
					xp: user.xp || 0,
					createdAt: user.createdAt,
					verifiedAt: user.verifiedAt || null,
					identityVerified: user.identity?.verified === true,
					address: user.address || {},
				},
				security: {
					mfaEnabled: user.mfa?.enabled === true,
					mfaMethodCount: (user.mfa?.methods || []).length,
					mfaLastVerifiedAt: user.mfa?.lastVerifiedAt || null,
				},
				wallet: {
					wallets,
					currency,
					activeWallet,
					activeBalance: Number(activeWallet?.balance) || 0,
				},
				vault: {
					balances: user.vault?.balances || [],
					total: vaultTotal(user),
					locked: isVaultLocked(user),
					expireAt: user.vault?.expireAt || null,
				},
				stats: user.stats || {},
			},
		});
	} catch (error) {
		console.error("account/overview error:", error.message);
		res.status(500).json({ success: false, message: "Sunucu hatasi." });
	}
});

// ---------------------------------------------------------------------------
// GET /account/sessions — Giris gecmisi (UserActionLog "login" kayitlari)
// ---------------------------------------------------------------------------
router.get("/sessions", authorizeUser(true), async (req, res) => {
	try {
		const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

		const logins = await UserActionLog.find({
			userId: req.user._id,
			actionType: "login",
		})
			.sort({ timestamp: -1 })
			.limit(limit)
			.lean();

		// IP adresini kismen maskele — tam adresi geri gondermeye gerek yok.
		const maskIp = (ip) => {
			if (!ip || typeof ip !== "string") return null;
			if (ip.includes(":")) {
				const head = ip.split(":").slice(0, 3).join(":");
				return `${head}:****`;
			}
			const parts = ip.split(".");
			if (parts.length !== 4) return "****";
			return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
		};

		res.json({
			success: true,
			sessions: logins.map((entry) => ({
				_id: entry._id,
				at: entry.timestamp,
				ip: maskIp(entry.metadata?.ip),
				userAgent: entry.metadata?.userAgent || "",
			})),
		});
	} catch (error) {
		console.error("account/sessions error:", error.message);
		res.status(500).json({ success: false, message: "Sunucu hatasi." });
	}
});

// ---------------------------------------------------------------------------
// GET /account/vault — Kasa durumu
// ---------------------------------------------------------------------------
router.get("/vault", authorizeUser(true), async (req, res) => {
	try {
		const user = await User.findById(req.user._id)
			.select("vault wallets currency")
			.lean();

		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "Kullanici bulunamadi." });
		}

		const activeWallet = getActiveWallet(user);

		res.json({
			success: true,
			data: {
				balances: user.vault?.balances || [],
				total: vaultTotal(user),
				locked: isVaultLocked(user),
				expireAt: user.vault?.expireAt || null,
				activeWallet,
				activeBalance: Number(activeWallet?.balance) || 0,
			},
		});
	} catch (error) {
		console.error("account/vault error:", error.message);
		res.status(500).json({ success: false, message: "Sunucu hatasi." });
	}
});

/**
 * Kasa transferini yurutur.
 * @param {"deposit"|"withdraw"} direction deposit: cuzdan -> kasa, withdraw: kasa -> cuzdan
 *
 * Guvenlik notlari:
 * - Tutar sunucu tarafinda dogrulanir ve yuvarlanir; istemciye guvenilmez.
 * - Borclanmayi (negatif bakiye) onlemek icin kosullu ($gte filtreli) atomik
 *   guncelleme kullanilir. Boylece es zamanli iki istek bakiyeyi eksiye dusuremez.
 * - Iki tarafli para hareketi tek bir MongoDB transaction'i icinde yapilir.
 */
const runVaultTransfer = async (direction, req, res) => {
	const amount = normalizeAmount(req.body?.amount);
	if (amount === null) {
		return res
			.status(400)
			.json({ success: false, message: "Gecersiz tutar girdiniz." });
	}

	const session = await mongoose.startSession();
	try {
		let resultPayload = null;

		await session.withTransaction(async () => {
			const user = await User.findById(req.user._id)
				.select("wallets currency vault")
				.session(session);

			if (!user) {
				const err = new Error("Kullanici bulunamadi.");
				err.statusCode = 404;
				throw err;
			}

			if (isVaultLocked(user)) {
				const err = new Error(
					"Kasaniz kilitli oldugu icin su an islem yapamazsiniz."
				);
				err.statusCode = 409;
				throw err;
			}

			const activeWallet = getActiveWallet(user);
			if (!activeWallet) {
				const err = new Error("Aktif cuzdan bulunamadi.");
				err.statusCode = 400;
				throw err;
			}

			const key = {
				coinType: activeWallet.coinType,
				chain: activeWallet.chain,
				type: activeWallet.type,
			};

			if (direction === "deposit") {
				// 1) Cuzdandan dus — yalnizca yeterli bakiye varsa eslesir.
				const debited = await User.findOneAndUpdate(
					{
						_id: user._id,
						wallets: { $elemMatch: { ...key, balance: { $gte: amount } } },
					},
					{ $inc: { "wallets.$.balance": -amount } },
					{ new: true, session }
				);

				if (!debited) {
					const err = new Error("Bu islem icin yeterli bakiyeniz yok.");
					err.statusCode = 400;
					throw err;
				}

				// 2) Kasaya ekle — girdi varsa arttir, yoksa olustur.
				let credited = await User.findOneAndUpdate(
					{ _id: user._id, "vault.balances": { $elemMatch: key } },
					{ $inc: { "vault.balances.$.amount": amount } },
					{ new: true, session }
				);

				if (!credited) {
					credited = await User.findOneAndUpdate(
						{
							_id: user._id,
							"vault.balances": { $not: { $elemMatch: key } },
						},
						{ $push: { "vault.balances": { ...key, amount } } },
						{ new: true, session }
					);
				}

				if (!credited) {
					const err = new Error(
						"Kasa guncellenemedi, lutfen tekrar deneyin."
					);
					err.statusCode = 409;
					throw err;
				}

				resultPayload = credited;
			} else {
				// 1) Kasadan dus — yalnizca yeterli kasa bakiyesi varsa eslesir.
				const debited = await User.findOneAndUpdate(
					{
						_id: user._id,
						"vault.balances": {
							$elemMatch: { ...key, amount: { $gte: amount } },
						},
					},
					{ $inc: { "vault.balances.$.amount": -amount } },
					{ new: true, session }
				);

				if (!debited) {
					const err = new Error("Kasanizda yeterli bakiye yok.");
					err.statusCode = 400;
					throw err;
				}

				// 2) Cuzdana ekle.
				let credited = await User.findOneAndUpdate(
					{ _id: user._id, wallets: { $elemMatch: key } },
					{ $inc: { "wallets.$.balance": amount } },
					{ new: true, session }
				);

				if (!credited) {
					credited = await User.findOneAndUpdate(
						{
							_id: user._id,
							wallets: { $not: { $elemMatch: key } },
						},
						{ $push: { wallets: { ...key, balance: amount } } },
						{ new: true, session }
					);
				}

				if (!credited) {
					const err = new Error(
						"Cuzdan guncellenemedi, lutfen tekrar deneyin."
					);
					err.statusCode = 409;
					throw err;
				}

				resultPayload = credited;
			}

			// Denetim izi
			await BalanceTransaction.create(
				[
					{
						amount: direction === "deposit" ? -amount : amount,
						type: direction === "deposit" ? "vaultDeposit" : "vaultWithdraw",
						user: user._id,
						state: "completed",
					},
				],
				{ session }
			);
		});

		// Transaction basarili — bakiyeyi soket uzerinden bildir.
		if (resultPayload) {
			try {
				emitUserBalance(null, resultPayload);
			} catch (err) {
				console.error("vault transfer socket emit error:", err.message);
			}
		}

		const activeWallet = getActiveWallet(resultPayload);

		res.json({
			success: true,
			data: {
				balances: resultPayload?.vault?.balances || [],
				total: vaultTotal(resultPayload),
				activeBalance: Number(activeWallet?.balance) || 0,
			},
		});
	} catch (error) {
		const status = error.statusCode || 500;
		if (status === 500) {
			console.error(`account/vault/${direction} error:`, error.message);
		}
		res.status(status).json({
			success: false,
			message:
				status === 500
					? "Islem tamamlanamadi, lutfen tekrar deneyin."
					: error.message,
		});
	} finally {
		await session.endSession();
	}
};

// POST /account/vault/deposit — cuzdandan kasaya aktar
router.post(
	"/vault/deposit",
	authorizeUser(true),
	rateLimiterStrictMiddleware,
	(req, res) => runVaultTransfer("deposit", req, res)
);

// POST /account/vault/withdraw — kasadan cuzdana aktar
router.post(
	"/vault/withdraw",
	authorizeUser(true),
	rateLimiterStrictMiddleware,
	(req, res) => runVaultTransfer("withdraw", req, res)
);

module.exports = router;
