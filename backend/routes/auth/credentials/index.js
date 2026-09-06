const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const crypto = require("crypto");
const router = express.Router();

// Load database models
const User = require("../../../database/models/User");
const UserSeed = require("../../../database/models/UserSeed");
const Token = require("../../../database/models/Token");
const Report = require("../../../database/models/Report");
const BankTransfer = require("../../../database/models/BankTransfer");
const SiteSettings = require("../../../database/models/SiteSettings");

// Load middleware
const { authorizeUser } = require("../../../middleware/auth");
const {
	rateLimiterStrictMiddleware,
} = require("../../../middleware/rateLimiter");

// Load utils
const { captchaCheckData, captchaGetData } = require("../../../utils/captcha");
const { emailSend, sendTemplatedEmail } = require("../../../utils/email");
const { processUserAvatar } = require("../../../utils/avatar");
const { getClientIp } = require("../../../utils/ip");
const { authGenerateJwtToken } = require("../../../utils/auth");
const {
	buildChallengePayload,
	createMfaError,
	getOtpChallenge,
	getUserMfaSummary,
	issueOtp,
	resendOtp,
	validateOtp,
} = require("../../../services/mfaService");
const { finalizeUserLoginSession } = require("../../../services/authSessionService");
const cryptoAddressService = require("../../../services/cryptoAddressService");
const { listCurrencies } = require("../../../config/crypto");
const {
	ACCOUNT_SUSPENDED_CODE,
	assertUserNotSuspended,
	sendUserSuspensionResponse,
} = require("../../../utils/userSuspension");
const {
	authCheckPostCredentialsData,
	authCheckPostCredentialsUser,
	authCheckPostCredentialsRegisterData,
	authCheckPostCredentialsRegisterUser,
	authCheckPostCredentialsLinkData,
	authCheckPostCredentialsLinkUser,
	authCheckPostCredentialsRequestData,
	authCheckPostCredentialsRequestUser,
	authCheckPostCredentialsRequestToken,
	authCheckPostCredentialsVerifyData,
	authCheckPostCredentialsVerifyToken,
	authCheckPostCredentialsResetData,
	authCheckPostCredentialsResetToken,
} = require("../../../utils/auth/credentials");
const { createAdminNotification } = require("../../../utils/adminNotification");

module.exports = () => {
	// @desc    Login user
	// @route   POST /auth/credentials
	// @access  Public
	router.post("/", rateLimiterStrictMiddleware, async (req, res) => {
		try {
			// Gelen verilerin doğrulanması
			authCheckPostCredentialsData(req.body);

			// Captcha doğrulaması (zorunluysa)
			// const captchaCheck = await captchaGetData(req.body.captcha);
			// captchaCheckData(captchaCheck);

			// Kullanıcının veritabanından alınması
			let userDatabase;

			if (req.body.email) {
				userDatabase = await User.findOne({
					"local.email": req.body.email.trim(),
				})
					.select("local ips rank phone username name mfa ban")
					.lean();
			} else if (req.body.phone) {
				userDatabase = await User.findOne({
					phone: req.body.phone.trim(),
				})
					.select("local ips rank phone username name mfa ban")
					.lean();
			} else if (req.body.username) {
				userDatabase = await User.findOne({
					username: req.body.username.trim(),
				})
					.select("local ips rank phone username name mfa ban")
					.lean();
			} else {
				return res.status(400).json({
					success: false,
					message: "Invalid login credentials",
				});
			}

			// Gönderilen şifreyi alın
			const password = req.body.password.trim();

			// Şifreyi karşılaştır
			const isMatch = await bcrypt.compare(
				password,
				userDatabase !== null && userDatabase.local !== undefined
					? userDatabase.local.password
					: ""
			);

			// Kullanıcıyı doğrula
			authCheckPostCredentialsUser(userDatabase, isMatch);
			assertUserNotSuspended(userDatabase);

			const mfaSummary = getUserMfaSummary(userDatabase);
			if (mfaSummary.enabled) {
				const challenge = await issueOtp({
					user: userDatabase,
					scope: "user-login",
					methodType: mfaSummary.preferredMethodType,
					phone: mfaSummary.phone,
					email: mfaSummary.email,
					metadata: {
						loginIdentifier: req.body.email
							? "email"
							: req.body.phone
								? "phone"
								: "username",
					},
				});

				return res.status(200).json({
					success: true,
					...buildChallengePayload(challenge),
				});
			}

			return res.status(200).json(
				await finalizeUserLoginSession({
					userId: userDatabase._id,
					req,
				})
			);
		} catch (err) {
			if (err.code === ACCOUNT_SUSPENDED_CODE) {
				return sendUserSuspensionResponse(res);
			}
			res.status(err.status || 500).json({
				success: false,
				error: {
					type: "error",
					message: err.message,
					code: err.code,
					...(err.metadata ? { metadata: err.metadata } : {}),
				},
			});
		}
	});

	// Verilen e-postadan benzersiz bir kullanıcı adı üretir. Aşamalı kayıtta
	// kullanıcı adını artık formda sormuyoruz (bkz. authCheckPostCredentialsRegisterData).
	const generateUniqueUsername = async (email) => {
		const base =
			String(email.split("@")[0] || "")
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
				.slice(0, 20) || "player";

		for (let attempt = 0; attempt < 6; attempt += 1) {
			const suffix =
				attempt === 0 ? "" : String(crypto.randomInt(1000, 9999));
			const candidate = `${base}${suffix}`.slice(0, 24);
			const exists = await User.findOne({ username: candidate })
				.select("_id")
				.lean();
			if (!exists) return candidate;
		}

		return `player${crypto.randomBytes(4).toString("hex")}`;
	};

	const assertSignupChallengeScope = (challenge) => {
		if (challenge.scope !== "signup-verify") {
			throw createMfaError(
				"OTP challenge scope is not valid for registration",
				"OTP_INVALID_SCOPE",
				400,
			);
		}
	};

	// @desc    Register user — Aşama 1: e-posta + şifre, e-posta doğrulama
	//          kodu gönderilir. Hesap oluşturulur ama emailVerified=false
	//          kalır; oturum tokenı /register/verify başarılı olunca verilir.
	// @route   POST /auth/credentials/register
	// @access  Public
	router.post("/register", rateLimiterStrictMiddleware, async (req, res) => {
		try {
			// Gelen verilerin doğrulanması
			authCheckPostCredentialsRegisterData(req.body);

			// Kullanıcıdan gelen veriler
			const email = req.body.email.trim().toLowerCase();
			const phone = req.body.phone ? String(req.body.phone).trim() : "";
			const password = req.body.password.trim();
			const fiatCurrency = req.body.fiatCurrency || "EUR";
			const affiliateCode = req.body.affiliate?.trim(); // ✅ affiliate kodu

			const existingUser = await User.findOne({ "local.email": email });

			if (existingUser && existingUser.local?.emailVerified) {
				return res.status(400).json({
					success: false,
					message: "E-mail already in use.",
				});
			}

			if (phone) {
				const phoneOwner = await User.findOne({ phone })
					.select("_id")
					.lean();
				if (
					phoneOwner &&
					(!existingUser ||
						String(phoneOwner._id) !== String(existingUser._id))
				) {
					return res.status(400).json({
						success: false,
						message: "Phone number already in use.",
					});
				}
			}

			// Şifreyi hashle
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(password, salt);

			let userId;
			let username;

			if (existingUser && !existingUser.local?.emailVerified) {
				// Kullanıcı e-posta doğrulamasını tamamlamadan kaydı yarım
				// bırakmış — hesabı silip yeniden oluşturmak yerine devam
				// ettiriyoruz (şifre/telefon güncellenir, yeni kod gönderilir).
				userId = existingUser._id;
				username = existingUser.username;
				existingUser.local.password = hashedPassword;
				existingUser.local.emailVerified = false;
				if (phone) existingUser.phone = phone;
				if (affiliateCode && !existingUser.affiliates?.redeemedCode) {
					const referrerUser = await User.findOne({
						"affiliates.code": affiliateCode,
					})
						.select("_id")
						.lean();
					existingUser.affiliates = {
						...(existingUser.affiliates?.toObject
							? existingUser.affiliates.toObject()
							: existingUser.affiliates || {}),
						referrer: referrerUser
							? referrerUser._id
							: existingUser.affiliates?.referrer,
						redeemedCode: affiliateCode,
					};
				}
				await existingUser.save();
			} else {
				username = await generateUniqueUsername(email);
				const userIp = getClientIp(req);
				userId = new mongoose.Types.ObjectId();

				// 📂 Avatar klasöründen rastgele avatar seç (yeni sistem: /uploads/avatars)
				const avatarDir = path.join(
					__dirname,
					"../../../uploads/avatars",
				);
				if (!fs.existsSync(avatarDir)) {
					fs.mkdirSync(avatarDir, { recursive: true });
				}
				const avatarFiles = fs.existsSync(avatarDir)
					? fs
							.readdirSync(avatarDir)
							.filter((file) => /\.(jpe?g|png|gif)$/i.test(file))
					: [];
				let randomAvatar = null;
				if (avatarFiles.length > 0) {
					randomAvatar = `/uploads/avatars/${
						avatarFiles[
							Math.floor(Math.random() * avatarFiles.length)
						]
					}`;
				} else {
					const settings = await SiteSettings.findOne().lean();
					randomAvatar =
						settings?.avatars?.fallbackAvatar ||
						"/uploads/avatars/default.png";
				}

				// ✅ Referrer bul
				let referrerUser = null;
				if (affiliateCode) {
					referrerUser = await User.findOne({
						"affiliates.code": affiliateCode,
					})
						.select("_id")
						.lean();
				}

				// Rastgele seed ve hash
				const seedsClient = [
					crypto.randomBytes(8).toString("hex"),
					crypto.randomBytes(8).toString("hex"),
				];
				const seedsServer = [
					crypto.randomBytes(24).toString("hex"),
					crypto.randomBytes(24).toString("hex"),
				];
				const hashes = [
					crypto
						.createHash("sha256")
						.update(seedsServer[0])
						.digest("hex"),
					crypto
						.createHash("sha256")
						.update(seedsServer[1])
						.digest("hex"),
				];

				const newUser = await User.create({
					_id: userId,
					username,
					local: {
						email,
						password: hashedPassword,
						emailVerified: false,
					},
					phone: phone || undefined,
					ips: [{ address: userIp }],
					avatar: randomAvatar,
					currency: {
						fiatCurrency,
					},
					affiliates: {
						referred: 0,
						referredLevel2: 0,
						referredLevel3: 0,
						bet: 0,
						deposit: 0,
						earned: 0,
						available: 0,
						generated: 0,
						referredAddress: userIp,
						referredAt: new Date(),
						referrer: referrerUser ? referrerUser._id : null,
						redeemedCode: affiliateCode || null,
					},
				});

				// Günlük rapor ve seeds ekle
				await Promise.all([
					Report.findOneAndUpdate(
						{ createdAt: new Date().toISOString().slice(0, 10) },
						{ $inc: { "stats.total.user": 1 } },
						{ upsert: true },
					),
					UserSeed.create({
						seedClient: seedsClient[0],
						seedServer: seedsServer[0],
						hash: hashes[0],
						nonce: 1,
						user: userId,
						state: "active",
					}),
					UserSeed.create({
						seedClient: seedsClient[1],
						seedServer: seedsServer[1],
						hash: hashes[1],
						nonce: 1,
						user: userId,
						state: "created",
					}),
				]);

				createAdminNotification(
					"new_user",
					"Yeni Üye Kaydı",
					`${username} kullanıcı adıyla yeni bir üye kayıt oldu (e-posta doğrulaması bekleniyor).`,
					"/apps/user/list",
					{ username, userId: newUser._id },
				);

				// Her kullanıcıya kayıt anında SABİT kripto yatırma adresi ata
				// (ör. USDT_TRC20, TRX). getOrCreateAddress zaten aynı
				// kullanıcı+para birimi için hep aynı adresi döndürür/oluşturur;
				// burada erkenden çağırmak, kullanıcı hiç yatırım sayfasını
				// açmasa da admin panelinde adresin görünmesini sağlar. HD
				// cüzdan yapılandırılmamışsa hata fırlatır — kaydı ASLA
				// bloklamadan sessizce loglayıp geçiyoruz.
				Promise.all(
					listCurrencies().map((currency) =>
						cryptoAddressService
							.getOrCreateAddress(userId, currency.code)
							.catch((error) => {
								console.error(
									`[auth/register] kripto adresi atanamadi (${currency.code}):`,
									error.message,
								);
							}),
					),
				).catch(() => {});
			}

			// E-posta doğrulama kodu gönder — hesap tam olarak bu kod
			// doğrulanana kadar aktif değildir (bkz. /register/verify).
			const challenge = await issueOtp({
				user: { _id: userId, username, local: { email } },
				scope: "signup-verify",
				methodType: "email",
				email,
				metadata: { source: "register" },
			});

			res.status(200).json({
				success: true,
				pendingVerification: true,
				...buildChallengePayload(challenge),
			});
		} catch (err) {
			res.status(err.status || 500).json({
				success: false,
				error: { type: "error", message: err.message },
				message: err.message,
				code: err.code,
			});
		}
	});

	// @desc    Register — Aşama 2: e-posta doğrulama kodunu yeniden gönder
	// @route   POST /auth/credentials/register/resend
	// @access  Public
	router.post(
		"/register/resend",
		rateLimiterStrictMiddleware,
		async (req, res) => {
			try {
				const { challengeId } = req.body || {};
				const challenge = await getOtpChallenge({ challengeId });
				assertSignupChallengeScope(challenge);

				const nextChallenge = await resendOtp({ challengeId });

				res.status(200).json({
					success: true,
					...buildChallengePayload(nextChallenge),
				});
			} catch (err) {
				res.status(err.status || 500).json({
					success: false,
					message: err.message,
					code: err.code,
					...(err.metadata ? { metadata: err.metadata } : {}),
				});
			}
		},
	);

	// @desc    Register — Aşama 2: e-posta doğrulama kodunu onayla, hesabı
	//          etkinleştir ve oturum tokenı ver.
	// @route   POST /auth/credentials/register/verify
	// @access  Public
	router.post(
		"/register/verify",
		rateLimiterStrictMiddleware,
		async (req, res) => {
			try {
				const { challengeId, code, marketingConsent } = req.body || {};
				const challenge = await validateOtp({ challengeId, code });
				assertSignupChallengeScope(challenge);

				await User.findByIdAndUpdate(challenge.user, {
					"local.emailVerified": true,
					...(typeof marketingConsent === "boolean"
						? { marketingConsent }
						: {}),
				});

				res.status(200).json(
					await finalizeUserLoginSession({
						userId: challenge.user,
						req,
					}),
				);
			} catch (err) {
				if (err.code === ACCOUNT_SUSPENDED_CODE) {
					return sendUserSuspensionResponse(res);
				}
				res.status(err.status || 500).json({
					success: false,
					message: err.message,
					code: err.code,
					...(err.metadata ? { metadata: err.metadata } : {}),
				});
			}
		},
	);

	// @desc    Link user
	// @route   POST /auth/credentials/link
	// @access  Private
	router.post(
		"/link",
		[rateLimiterStrictMiddleware, authorizeUser(true)],
		async (req, res) => {
			try {
				// Validate sent data
				authCheckPostCredentialsLinkData(req.body);

				// Get sent email and password
				const email = req.body.email.trim();
				let password = req.body.password.trim();

				// Get user from database
				let dataDatabase = await Promise.all([
					User.findById(req.user._id).select("local").lean(),
					User.findOne({ "local.email": email })
						.select("local")
						.lean(),
				]);

				// Validate user
				authCheckPostCredentialsLinkUser(dataDatabase);

				// Encrypt password
				const salt = await bcrypt.genSalt(10);
				password = await bcrypt.hash(password, salt);

				// Update user in database
				dataDatabase = await User.findByIdAndUpdate(
					req.user._id,
					{
						local: {
							email: req.body.email,
							password: password,
						},
					},
					{ new: true }
				)
					.select("local.email local.emailVerified")
					.lean();

				res.status(200).json({ success: true, user: dataDatabase });
			} catch (err) {
				res.status(500).json({
					success: false,
					error: { type: "error", message: err.message },
				});
			}
		}
	);

	// @desc    Request verify user or reset password email
	// @route   POST /auth/credentials/request
	// @access  Public
	router.post("/request", rateLimiterStrictMiddleware, async (req, res) => {
		try {
			// Validate sent data
			authCheckPostCredentialsRequestData(req.body);

			// Get user from the database
			const userDatabase = await User.findOne({
				"local.email": req.body.email,
			})
				.select("local username name")
				.lean();

			// Validate user
			authCheckPostCredentialsRequestUser(userDatabase, req.body);

			// Get token from the database
			const tokenDatabase = await Token.findOne({
				type: req.body.type,
				user: userDatabase._id,
			})
				.select("type user updatedAt")
				.lean();

			// Validate token
			authCheckPostCredentialsRequestToken(tokenDatabase);

			// Create a new token
			const token = crypto.randomBytes(16).toString("hex");

			// Create or update token in the database
			await Token.findOneAndUpdate(
				{ type: req.body.type, user: userDatabase._id },
				{ token: token, updatedAt: new Date() },
				{ upsert: true }
			);

			// Build action URL using configured frontend URL
			const frontendBase =
				(process.env.SERVER_FRONTEND_URL || "")
					.split(",")[0]
					.trim()
					.replace(/\/+$/, "") || "";
			const actionPath =
				req.body.type === "verify" ? "/verify" : "/reset";
			const actionUrl = `${frontendBase}${actionPath}?userId=${userDatabase._id}&token=${token}`;

			// Send templated email to user
			await sendTemplatedEmail({
				to: userDatabase.local.email,
				type:
					req.body.type === "verify"
						? "verifyEmail"
						: "resetPassword",
				vars: {
					username:
						userDatabase.username ||
						userDatabase.name ||
						userDatabase.local.email,
					email: userDatabase.local.email,
					token,
					verifyUrl:
						req.body.type === "verify" ? actionUrl : undefined,
					resetUrl:
						req.body.type === "reset" ? actionUrl : undefined,
					siteUrl: frontendBase,
				},
			});

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({
				success: false,
				error: { type: "error", message: err.message },
			});
		}
	});

	// @desc    Verify user email
	// @route   POST /auth/credentials/verify
	// @access  Public
	router.post("/verify", rateLimiterStrictMiddleware, async (req, res) => {
		try {
			// Validate sent data
			authCheckPostCredentialsVerifyData(req.body);

			// Get token from database
			const tokenDatabase = await Token.findOne({
				token: req.body.token,
				type: "verify",
				user: req.body.userId,
			})
				.select("token type user updatedAt")
				.lean();

			// Validate token
			authCheckPostCredentialsVerifyToken(tokenDatabase);

			// Delete token and update user in the database
			await Promise.all([
				Token.findByIdAndDelete(tokenDatabase._id),
				User.findByIdAndUpdate(
					tokenDatabase.user,
					{ "local.emailVerified": true },
					{}
				),
			]);

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({
				success: false,
				error: { type: "error", message: err.message },
			});
		}
	});

	// @desc    Reset user password
	// @route   POST /auth/credentials/reset
	// @access  Public
	router.post("/reset", rateLimiterStrictMiddleware, async (req, res) => {
		try {
			// Validate sent data
			authCheckPostCredentialsResetData(req.body);

			// Validate captcha
			const captchaCheck = await captchaGetData(req.body.captcha);
			captchaCheckData(captchaCheck);

			// Get token from database
			const tokenDatabase = await Token.findOne({
				token: req.body.token,
				type: "reset",
				user: req.body.userId,
			})
				.select("token type user updatedAt")
				.lean();

			// Validate token
			authCheckPostCredentialsResetToken(tokenDatabase);

			// Get sent password
			let password = req.body.password.trim();

			// Encrypt password
			const salt = await bcrypt.genSalt(10);
			password = await bcrypt.hash(password, salt);

			// Delete token and update user in the database
			await Promise.all([
				Token.findByIdAndDelete(tokenDatabase._id),
				User.findByIdAndUpdate(
					tokenDatabase.user,
					{ "local.password": password },
					{}
				),
			]);

			res.status(200).json({ success: true });
		} catch (err) {
			res.status(500).json({
				success: false,
				error: { type: "error", message: err.message },
			});
		}
	});

	return router;
};
