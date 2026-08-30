const jwt = require("jsonwebtoken");

const User = require("../database/models/User");
const logEvent = require("./logEvent");
const { updateMissionProgress } = require("./MissionEngine");
const { authGenerateJwtToken } = require("../utils/auth");
const { processUserAvatar } = require("../utils/avatar");
const { getClientIp } = require("../utils/ip");
const { assertUserNotSuspended } = require("../utils/userSuspension");

const JWT_SECRET =
	process.env.TOKEN_SECRET || process.env.JWT_SECRET || "yourSecretKey";

const getRequestIp = getClientIp;

/**
 * Giris yanitindaki CASL yetkilerini uretir.
 *
 * ⚠️ Bu fonksiyon middleware/permission.js `authenticateAdmin` ile AYNI
 * kurallari uygulamak ZORUNDADIR. Ikisi ayrisirsa panel ile API birbirine
 * ters duser ve admin, API'nin izin verdigi sayfada /not-authorized gorur.
 *
 * Kural: adminRole ATANMAMIS (legacy) adminler super admin sayilir.
 * Bu bir yetki genislemesi DEGILDIR — authenticateAdmin zaten bu kullanicilara
 * her API ucunda `["*"]` veriyor (bkz. extractPermissions isLegacyAdmin).
 * Onceden burasi onlara yalnizca `read Auth` veriyordu; sonucta rol sistemi
 * oncesinden kalma admin girisi yapinca panelde her sayfadan kilitleniyordu.
 */
const buildAdminAbilities = (user) => {
	const SUPER_ADMIN_ABILITIES = [{ action: "manage", subject: "all" }];

	// adminRole hic atanmamis (legacy admin) → tam yetki.
	// Not: populate edilmemis bir ObjectId de gelebilir; o durumda
	// isSuperAdmin okunamaz ve kullaniciyi yanlislikla kilitlemek yerine
	// legacy kabul etmek API davranisiyla tutarlidir.
	const hasAdminRole = Boolean(user.adminRole && user.adminRole._id);

	if (!hasAdminRole) {
		return {
			isSuperAdmin: true,
			userAbilities: SUPER_ADMIN_ABILITIES,
			userPermissions: ["*"],
		};
	}

	if (user.adminRole.isSuperAdmin) {
		return {
			isSuperAdmin: true,
			userAbilities: SUPER_ADMIN_ABILITIES,
			userPermissions: ["*"],
		};
	}

	const permissions = user.adminRole.permissions || [];
	const userAbilities = permissions.map((permission) => ({
		action: permission.action,
		subject: permission.resource,
	}));

	// Her admin en azindan kendi oturum/karsilama sayfalarini gorebilmeli.
	userAbilities.push({ action: "read", subject: "Auth" });

	return {
		isSuperAdmin: false,
		userAbilities,
		userPermissions: permissions.map((permission) => permission.code),
	};
};

const finalizeUserLoginSession = async ({ userId, req }) => {
	const user = await User.findById(userId).select("rank ips ban").lean();

	if (!user) {
		throw new Error("User not found");
	}

	assertUserNotSuspended(user);

	const userIp = getRequestIp(req);
	const isAdmin = user.rank === "admin";
	const updateData = {
		updatedAt: new Date().getTime(),
	};

	if (isAdmin) {
		updateData.ips = [];
	} else {
		const nextIps = Array.isArray(user.ips) ? [...user.ips] : [];
		nextIps.unshift({ address: userIp });
		updateData.ips = nextIps.slice(0, 25);
	}

	const updatedUser = await User.findByIdAndUpdate(
		userId,
		{ $set: updateData },
		{ new: true }
	)
		.select(
			"local.email local.emailVerified roblox.id discord.id username avatar rank balance xp vault phone name stats rakeback fair anonymous mute ban verifiedAt updatedAt createdAt mfa"
		)
		.lean();

	const accessToken = authGenerateJwtToken(updatedUser._id);

	await logEvent("login", {
		userId: updatedUser._id,
		metadata: {
			ip: userIp,
			userAgent: req?.headers?.["user-agent"] || "",
		},
	});

	await updateMissionProgress("login", {
		userId: updatedUser._id,
		amount: 1,
	});

	// 🎁 Casino ödül motoru: günlük giriş görevleri. Referans gün bazlıdır, bu
	// yüzden aynı gün içindeki tekrar girişler ilerlemeyi bir kez artırır.
	try {
		require("./casinoRewardEngine").emitLogin({ userId: updatedUser._id });
	} catch (err) {
		console.error("❌ casino ödül motoru login olayı hatası:", err.message);
	}

	const userWithAvatar = await processUserAvatar(updatedUser);

	return {
		success: true,
		token: accessToken,
		user: userWithAvatar,
	};
};

const createAdminSessionPayload = async ({ userId }) => {
	const user = await User.findById(userId).populate({
		path: "adminRole",
		populate: {
			path: "permissions",
			select: "code name resource action",
		},
	});

	if (!user) {
		throw new Error("User not found");
	}

	assertUserNotSuspended(user);

	if (user.rank !== "admin") {
		throw new Error("You are not authorized to access this panel");
	}

	const accessToken = jwt.sign({ id: user._id }, JWT_SECRET, {
		expiresIn: "1d",
	});

	const { isSuperAdmin, userAbilities, userPermissions } = buildAdminAbilities(user);

	await User.findByIdAndUpdate(user._id, {
		$set: { ips: [] },
	});

	return {
		accessToken,
		userData: {
			id: user._id,
			email: user.local.email,
			fullName: user.name || user.username,
			role: "admin",
			adminRole: user.adminRole
				? {
						_id: user.adminRole._id,
						name: user.adminRole.name,
						displayName: user.adminRole.displayName,
						isSuperAdmin: user.adminRole.isSuperAdmin,
						color: user.adminRole.color,
						icon: user.adminRole.icon,
						// Alan Kısıtlaması (Field Restriction) — bkz.
						// backend/config/fieldRestrictionRegistry.js. Frontend
						// permissionStore.role üzerinden bunu okuyup ilgili
						// formlardaki alanları disable eder.
						restrictedFields: user.adminRole.restrictedFields || [],
				  }
				: null,
			isSuperAdmin,
		},
		userAbilities,
		userPermissions,
	};
};

module.exports = {
	buildAdminAbilities,
	createAdminSessionPayload,
	finalizeUserLoginSession,
	getRequestIp,
};
