const mongoose = require("mongoose");

const ChatSettings = require("../../database/models/ChatSettings");
const { getChatSettings } = require("../../database/models/ChatSettings");
const ChatRoom = require("../../database/models/ChatRoom");
const { ensureDefaultRooms } = require("../../database/models/ChatRoom");
const ChatMessage = require("../../database/models/ChatMessage");
const FilterPhrase = require("../../database/models/FilterPhrase");
const Rain = require("../../database/models/Rain");
const TipTransaction = require("../../database/models/TipTransaction");
const User = require("../../database/models/User");

const {
	generalChatAddFilter,
	generalChatRemoveFilter,
	generalChatAddMessage,
	generalChatRemoveMessage,
	generalChatClearRoom,
	generalChatRefreshSettings,
} = require("../general/chat");

// ────────────────────────────────────────────────────────────
// Yardımcılar
// ────────────────────────────────────────────────────────────
const ok = (res, payload = {}) => res.status(200).json({ success: true, ...payload });
const fail = (res, message, status = 400) =>
	res.status(status).json({ success: false, message });

const getIo = (req) => {
	try {
		return req.app.get("io") || require("../../utils/io").getIO();
	} catch (err) {
		return null;
	}
};

const emitChatEvent = (req, event, payload) => {
	const io = getIo(req);
	if (!io) return;
	try {
		io.of("/general").emit(event, payload);
	} catch (err) {
		/* namespace yoksa sessiz geç */
	}
	try {
		io.emit(event, payload);
	} catch (err) {
		/* noop */
	}
};

const toNumber = (value, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const paginate = (req, defaultLimit = 25) => {
	const page = Math.max(1, toNumber(req.query.page, 1));
	const limit = Math.min(200, Math.max(1, toNumber(req.query.limit, defaultLimit)));
	return { page, limit, skip: (page - 1) * limit };
};

const dateRangeFilter = (req, field = "createdAt") => {
	const filter = {};
	if (req.query.from) filter.$gte = new Date(req.query.from);
	if (req.query.to) filter.$lte = new Date(req.query.to);
	return Object.keys(filter).length ? { [field]: filter } : {};
};

// ────────────────────────────────────────────────────────────
// Ayarlar
// ────────────────────────────────────────────────────────────
const getSettings = async (req, res) => {
	try {
		const [settings, rooms] = await Promise.all([
			getChatSettings(),
			ensureDefaultRooms(),
		]);

		return ok(res, { data: settings.toObject(), rooms });
	} catch (err) {
		console.error("chat getSettings:", err);
		return fail(res, "Sohbet ayarları alınamadı.", 500);
	}
};

const ALLOWED_SETTING_GROUPS = ["chat", "pinned", "rules", "rain", "tip"];

const updateSettings = async (req, res) => {
	try {
		const settings = await getChatSettings();

		for (const group of ALLOWED_SETTING_GROUPS) {
			if (req.body[group] === undefined || req.body[group] === null) continue;
			settings[group] = { ...settings[group]?.toObject?.() ?? settings[group], ...req.body[group] };
		}

		if (req.body.pinned) {
			settings.pinned.updatedBy = req.adminUser?._id;
			settings.pinned.updatedAt = new Date();
		}

		settings.updatedAt = new Date();
		await settings.save();

		// Canlı sohbete yeni ayarları bildir
		await generalChatRefreshSettings();
		emitChatEvent(req, "chatSettings", { settings: settings.toObject() });

		return ok(res, { data: settings.toObject(), message: "Ayarlar güncellendi." });
	} catch (err) {
		console.error("chat updateSettings:", err);
		return fail(res, "Sohbet ayarları güncellenemedi.", 500);
	}
};

// ────────────────────────────────────────────────────────────
// Odalar
// ────────────────────────────────────────────────────────────
const listRooms = async (req, res) => {
	try {
		const rooms = await ensureDefaultRooms();

		const counts = await ChatMessage.aggregate([
			{ $match: { deleted: false } },
			{ $group: { _id: "$room", total: { $sum: 1 } } },
		]);
		const countMap = Object.fromEntries(counts.map((c) => [c._id, c.total]));

		return ok(res, {
			data: rooms.map((room) => ({ ...room, messageCount: countMap[room.key] || 0 })),
		});
	} catch (err) {
		console.error("chat listRooms:", err);
		return fail(res, "Odalar alınamadı.", 500);
	}
};

const createRoom = async (req, res) => {
	try {
		const { key, name } = req.body;
		if (!key || !name) return fail(res, "Oda anahtarı ve adı zorunludur.");

		const exists = await ChatRoom.findOne({ key: String(key).toLowerCase() });
		if (exists) return fail(res, "Bu oda anahtarı zaten kullanılıyor.");

		const room = await ChatRoom.create({
			key: String(key).toLowerCase().trim(),
			name,
			flag: req.body.flag || "🌐",
			language: req.body.language || "tr",
			enabled: req.body.enabled !== false,
			locked: req.body.locked === true,
			order: toNumber(req.body.order, 0),
			minLevel: toNumber(req.body.minLevel, 0),
			minWager: toNumber(req.body.minWager, 0),
			vipOnly: req.body.vipOnly === true,
			description: req.body.description || "",
		});

		emitChatEvent(req, "chatRooms", { rooms: await ChatRoom.find().sort({ order: 1 }).lean() });

		return ok(res, { data: room, message: "Oda oluşturuldu." });
	} catch (err) {
		console.error("chat createRoom:", err);
		return fail(res, "Oda oluşturulamadı.", 500);
	}
};

const updateRoom = async (req, res) => {
	try {
		const fields = [
			"name",
			"flag",
			"language",
			"enabled",
			"locked",
			"order",
			"minLevel",
			"minWager",
			"vipOnly",
			"description",
		];

		const update = { updatedAt: new Date() };
		for (const field of fields) {
			if (req.body[field] !== undefined) update[field] = req.body[field];
		}

		const room = await ChatRoom.findByIdAndUpdate(req.params.id, update, { new: true });
		if (!room) return fail(res, "Oda bulunamadı.", 404);

		emitChatEvent(req, "chatRooms", { rooms: await ChatRoom.find().sort({ order: 1 }).lean() });

		return ok(res, { data: room, message: "Oda güncellendi." });
	} catch (err) {
		console.error("chat updateRoom:", err);
		return fail(res, "Oda güncellenemedi.", 500);
	}
};

const deleteRoom = async (req, res) => {
	try {
		const room = await ChatRoom.findByIdAndDelete(req.params.id);
		if (!room) return fail(res, "Oda bulunamadı.", 404);

		emitChatEvent(req, "chatRooms", { rooms: await ChatRoom.find().sort({ order: 1 }).lean() });

		return ok(res, { message: "Oda silindi." });
	} catch (err) {
		console.error("chat deleteRoom:", err);
		return fail(res, "Oda silinemedi.", 500);
	}
};

// ────────────────────────────────────────────────────────────
// Mesaj moderasyonu
// ────────────────────────────────────────────────────────────
const listMessages = async (req, res) => {
	try {
		const { page, limit, skip } = paginate(req, 25);

		const query = { ...dateRangeFilter(req) };
		if (req.query.room) query.room = req.query.room;
		if (req.query.type) query.type = req.query.type;
		if (req.query.deleted === "true") query.deleted = true;
		if (req.query.deleted === "false") query.deleted = false;

		if (req.query.search) {
			const search = String(req.query.search).trim();
			query.$or = [
				{ message: { $regex: search, $options: "i" } },
				{ username: { $regex: search, $options: "i" } },
			];
		}

		if (req.query.userId && mongoose.isValidObjectId(req.query.userId)) {
			query.user = req.query.userId;
		}

		const [data, total] = await Promise.all([
			ChatMessage.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			ChatMessage.countDocuments(query),
		]);

		return ok(res, { data, pagination: { page, limit, total } });
	} catch (err) {
		console.error("chat listMessages:", err);
		return fail(res, "Mesajlar alınamadı.", 500);
	}
};

const deleteMessage = async (req, res) => {
	try {
		const message = await ChatMessage.findByIdAndUpdate(
			req.params.id,
			{
				deleted: true,
				deletedAt: new Date(),
				deletedBy: req.adminUser?._id,
				deletedReason: req.body?.reason || "Admin tarafından silindi.",
			},
			{ new: true },
		);

		if (!message) return fail(res, "Mesaj bulunamadı.", 404);

		generalChatRemoveMessage(getIo(req), message.room, message._id.toString());

		return ok(res, { message: "Mesaj silindi." });
	} catch (err) {
		console.error("chat deleteMessage:", err);
		return fail(res, "Mesaj silinemedi.", 500);
	}
};

const clearRoom = async (req, res) => {
	try {
		const room = req.body?.room;
		if (!room) return fail(res, "Oda seçilmedi.");

		await ChatMessage.updateMany(
			{ room, deleted: false },
			{
				deleted: true,
				deletedAt: new Date(),
				deletedBy: req.adminUser?._id,
				deletedReason: "Oda temizlendi.",
			},
		);

		generalChatClearRoom(getIo(req), room);

		return ok(res, { message: `${room} odası temizlendi.` });
	} catch (err) {
		console.error("chat clearRoom:", err);
		return fail(res, "Oda temizlenemedi.", 500);
	}
};

const sendSystemMessage = async (req, res) => {
	try {
		const text = String(req.body?.message || "").trim();
		if (!text) return fail(res, "Mesaj boş olamaz.");

		const room = req.body?.room || null;

		generalChatAddMessage(getIo(req), {
			message: text,
			type: "system",
			...(room ? { room } : {}),
		});

		return ok(res, { message: "Sistem mesajı gönderildi." });
	} catch (err) {
		console.error("chat sendSystemMessage:", err);
		return fail(res, "Sistem mesajı gönderilemedi.", 500);
	}
};

// ────────────────────────────────────────────────────────────
// Kelime filtresi
// ────────────────────────────────────────────────────────────
const listFilters = async (req, res) => {
	try {
		const data = await FilterPhrase.find().sort({ createdAt: -1 }).lean();
		return ok(res, { data });
	} catch (err) {
		console.error("chat listFilters:", err);
		return fail(res, "Filtre listesi alınamadı.", 500);
	}
};

const createFilter = async (req, res) => {
	try {
		const phrase = String(req.body?.phrase || "").trim().toLowerCase();
		if (!phrase) return fail(res, "Kelime boş olamaz.");

		const exists = await FilterPhrase.findOne({ phrase });
		if (exists) return fail(res, "Bu kelime zaten listede.");

		const created = await FilterPhrase.create({ phrase });
		generalChatAddFilter(phrase);

		return ok(res, { data: created, message: "Kelime eklendi." });
	} catch (err) {
		console.error("chat createFilter:", err);
		return fail(res, "Kelime eklenemedi.", 500);
	}
};

const deleteFilter = async (req, res) => {
	try {
		const removed = await FilterPhrase.findByIdAndDelete(req.params.id);
		if (!removed) return fail(res, "Kelime bulunamadı.", 404);

		generalChatRemoveFilter(removed.phrase);

		return ok(res, { message: "Kelime silindi." });
	} catch (err) {
		console.error("chat deleteFilter:", err);
		return fail(res, "Kelime silinemedi.", 500);
	}
};

// ────────────────────────────────────────────────────────────
// Susturma / yasaklama
// ────────────────────────────────────────────────────────────
const listModeration = async (req, res) => {
	try {
		const now = new Date();
		const data = await User.find({
			$or: [{ "mute.expire": { $gt: now } }, { "ban.expire": { $gt: now } }],
		})
			.select("username avatar rank mute ban")
			.sort({ "mute.expire": -1 })
			.limit(200)
			.lean();

		return ok(res, { data });
	} catch (err) {
		console.error("chat listModeration:", err);
		return fail(res, "Moderasyon listesi alınamadı.", 500);
	}
};

const findUserByIdentifier = async (identifier) => {
	if (!identifier) return null;
	if (mongoose.isValidObjectId(identifier)) {
		const byId = await User.findById(identifier);
		if (byId) return byId;
	}
	return User.findOne({ username: new RegExp(`^${String(identifier).trim()}$`, "i") });
};

const muteUser = async (req, res) => {
	try {
		const user = await findUserByIdentifier(req.body?.user);
		if (!user) return fail(res, "Kullanıcı bulunamadı.", 404);

		const minutes = Math.max(1, toNumber(req.body?.minutes, 10));
		user.mute = {
			expire: new Date(Date.now() + minutes * 60 * 1000),
			reason: req.body?.reason || "Sohbet kuralı ihlali.",
		};
		await user.save();

		return ok(res, {
			message: `${user.username} ${minutes} dakika susturuldu.`,
			data: { _id: user._id, username: user.username, mute: user.mute },
		});
	} catch (err) {
		console.error("chat muteUser:", err);
		return fail(res, "Kullanıcı susturulamadı.", 500);
	}
};

const unmuteUser = async (req, res) => {
	try {
		const user = await findUserByIdentifier(req.params.id || req.body?.user);
		if (!user) return fail(res, "Kullanıcı bulunamadı.", 404);

		user.mute = { expire: null, reason: null };
		await user.save();

		return ok(res, { message: `${user.username} susturması kaldırıldı.` });
	} catch (err) {
		console.error("chat unmuteUser:", err);
		return fail(res, "Susturma kaldırılamadı.", 500);
	}
};

const banUser = async (req, res) => {
	try {
		const user = await findUserByIdentifier(req.body?.user);
		if (!user) return fail(res, "Kullanıcı bulunamadı.", 404);

		const days = Math.max(1, toNumber(req.body?.days, 7));
		user.ban = {
			expire: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
			reason: req.body?.reason || "Sohbet yasağı.",
		};
		await user.save();

		return ok(res, { message: `${user.username} ${days} gün sohbetten yasaklandı.` });
	} catch (err) {
		console.error("chat banUser:", err);
		return fail(res, "Kullanıcı yasaklanamadı.", 500);
	}
};

const unbanUser = async (req, res) => {
	try {
		const user = await findUserByIdentifier(req.params.id || req.body?.user);
		if (!user) return fail(res, "Kullanıcı bulunamadı.", 404);

		user.ban = { expire: null, reason: null };
		await user.save();

		return ok(res, { message: `${user.username} yasağı kaldırıldı.` });
	} catch (err) {
		console.error("chat unbanUser:", err);
		return fail(res, "Yasak kaldırılamadı.", 500);
	}
};

// ────────────────────────────────────────────────────────────
// Rain
// ────────────────────────────────────────────────────────────
const listRains = async (req, res) => {
	try {
		const { page, limit, skip } = paginate(req, 20);

		const query = { ...dateRangeFilter(req) };
		if (req.query.state) query.state = req.query.state;
		if (req.query.type) query.type = req.query.type;

		const [data, total] = await Promise.all([
			Rain.find(query)
				.populate("creator", "username avatar rank")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			Rain.countDocuments(query),
		]);

		return ok(res, {
			data: data.map((rain) => ({
				...rain,
				participantCount: rain.participants?.length || 0,
			})),
			pagination: { page, limit, total },
		});
	} catch (err) {
		console.error("chat listRains:", err);
		return fail(res, "Rain listesi alınamadı.", 500);
	}
};

const getRainDetail = async (req, res) => {
	try {
		const rain = await Rain.findById(req.params.id)
			.populate("creator", "username avatar rank")
			.populate("participants.user", "username avatar rank")
			.lean();

		if (!rain) return fail(res, "Rain bulunamadı.", 404);

		return ok(res, { data: rain });
	} catch (err) {
		console.error("chat getRainDetail:", err);
		return fail(res, "Rain detayı alınamadı.", 500);
	}
};

const createSiteRain = async (req, res) => {
	try {
		const settings = await getChatSettings();
		const amount = toNumber(req.body?.amount, 0);

		if (amount < settings.rain.minAmount) {
			return fail(res, `Minimum rain tutarı ${settings.rain.minAmount}.`);
		}
		if (amount > settings.rain.maxAmount) {
			return fail(res, `Maksimum rain tutarı ${settings.rain.maxAmount}.`);
		}

		const rain = await Rain.create({
			amount,
			type: "site",
			state: "running",
			participants: [],
			creator: req.adminUser?._id,
			updatedAt: new Date(),
		});

		generalChatAddMessage(getIo(req), {
			message: `Site tarafından ${amount} tutarında rain başlatıldı! Katılmak için rain butonunu kullanın.`,
			type: "system",
		});

		emitChatEvent(req, "rainCreate", { rain });

		return ok(res, { data: rain, message: "Site rain başlatıldı." });
	} catch (err) {
		console.error("chat createSiteRain:", err);
		return fail(res, "Rain başlatılamadı.", 500);
	}
};

const cancelRain = async (req, res) => {
	try {
		const rain = await Rain.findByIdAndUpdate(
			req.params.id,
			{ state: "completed", updatedAt: new Date() },
			{ new: true },
		);
		if (!rain) return fail(res, "Rain bulunamadı.", 404);

		emitChatEvent(req, "rainUpdate", { rain });

		return ok(res, { message: "Rain sonlandırıldı." });
	} catch (err) {
		console.error("chat cancelRain:", err);
		return fail(res, "Rain sonlandırılamadı.", 500);
	}
};

// ────────────────────────────────────────────────────────────
// Tips
// ────────────────────────────────────────────────────────────
const listTips = async (req, res) => {
	try {
		const { page, limit, skip } = paginate(req, 25);

		const query = { ...dateRangeFilter(req) };
		if (req.query.state) query.state = req.query.state;
		if (req.query.minAmount) query.amount = { $gte: toNumber(req.query.minAmount, 0) };

		let userFilter = null;
		if (req.query.search) {
			const users = await User.find({
				username: { $regex: String(req.query.search).trim(), $options: "i" },
			})
				.select("_id")
				.limit(50)
				.lean();
			userFilter = users.map((u) => u._id);
			query.$or = [
				{ "sender.user": { $in: userFilter } },
				{ "receiver.user": { $in: userFilter } },
			];
		}

		const [data, total, totals] = await Promise.all([
			TipTransaction.find(query)
				.populate("sender.user", "username avatar rank")
				.populate("receiver.user", "username avatar rank")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			TipTransaction.countDocuments(query),
			TipTransaction.aggregate([
				{ $match: query.$or ? { $or: query.$or } : {} },
				{ $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
			]),
		]);

		return ok(res, {
			data,
			pagination: { page, limit, total },
			summary: {
				totalAmount: totals[0]?.amount || 0,
				totalCount: totals[0]?.count || 0,
			},
		});
	} catch (err) {
		console.error("chat listTips:", err);
		return fail(res, "Tip listesi alınamadı.", 500);
	}
};

// ────────────────────────────────────────────────────────────
// İstatistikler
// ────────────────────────────────────────────────────────────
const getStats = async (req, res) => {
	try {
		const now = new Date();
		const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const [
			messagesToday,
			messagesWeek,
			deletedToday,
			perRoom,
			topChatters,
			rainStats,
			tipStats,
			activeMutes,
		] = await Promise.all([
			ChatMessage.countDocuments({ createdAt: { $gte: dayAgo } }),
			ChatMessage.countDocuments({ createdAt: { $gte: weekAgo } }),
			ChatMessage.countDocuments({ deleted: true, deletedAt: { $gte: dayAgo } }),
			ChatMessage.aggregate([
				{ $match: { createdAt: { $gte: weekAgo } } },
				{ $group: { _id: "$room", total: { $sum: 1 } } },
				{ $sort: { total: -1 } },
			]),
			ChatMessage.aggregate([
				{ $match: { createdAt: { $gte: weekAgo }, type: "user" } },
				{ $group: { _id: "$username", total: { $sum: 1 } } },
				{ $sort: { total: -1 } },
				{ $limit: 10 },
			]),
			Rain.aggregate([
				{ $match: { createdAt: { $gte: weekAgo } } },
				{ $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
			]),
			TipTransaction.aggregate([
				{ $match: { createdAt: { $gte: weekAgo } } },
				{ $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
			]),
			User.countDocuments({ "mute.expire": { $gt: now } }),
		]);

		return ok(res, {
			data: {
				messagesToday,
				messagesWeek,
				deletedToday,
				activeMutes,
				perRoom,
				topChatters,
				rain: {
					count: rainStats[0]?.count || 0,
					amount: rainStats[0]?.amount || 0,
				},
				tips: {
					count: tipStats[0]?.count || 0,
					amount: tipStats[0]?.amount || 0,
				},
			},
		});
	} catch (err) {
		console.error("chat getStats:", err);
		return fail(res, "İstatistikler alınamadı.", 500);
	}
};

module.exports = {
	getSettings,
	updateSettings,
	listRooms,
	createRoom,
	updateRoom,
	deleteRoom,
	listMessages,
	deleteMessage,
	clearRoom,
	sendSystemMessage,
	listFilters,
	createFilter,
	deleteFilter,
	listModeration,
	muteUser,
	unmuteUser,
	banUser,
	unbanUser,
	listRains,
	getRainDetail,
	createSiteRain,
	cancelRain,
	listTips,
	getStats,
};
