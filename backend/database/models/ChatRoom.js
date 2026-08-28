const mongoose = require("mongoose");

/**
 * Sohbet odaları (EN / TR / Beginner / Whale ...).
 * Frontend'deki oda seçici bu koleksiyondan beslenir.
 */
const chatRoomSchema = new mongoose.Schema({
	key: { type: String, required: true, unique: true, lowercase: true, trim: true },
	name: { type: String, required: true },
	flag: { type: String, default: "🌐" },
	language: { type: String, default: "tr" },
	enabled: { type: Boolean, default: true },
	locked: { type: Boolean, default: false },
	order: { type: Number, default: 0 },
	minLevel: { type: Number, default: 0 },
	minWager: { type: Number, default: 0 },
	vipOnly: { type: Boolean, default: false },
	description: { type: String, default: "" },
	updatedAt: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },
});

chatRoomSchema.index({ enabled: 1, order: 1 });

const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);

const DEFAULT_ROOMS = [
	{ key: "tr", name: "Türkçe", flag: "🇹🇷", language: "tr", order: 1 },
	{ key: "en", name: "English", flag: "🇬🇧", language: "en", order: 2 },
	{ key: "de", name: "Deutsch", flag: "🇩🇪", language: "de", order: 3, enabled: false },
	{ key: "es", name: "Español", flag: "🇪🇸", language: "es", order: 4, enabled: false },
	{ key: "beg", name: "Beginner", flag: "🌱", language: "en", order: 5 },
	{ key: "whale", name: "Whale", flag: "🐋", language: "en", order: 6, minWager: 1000000 },
];

/**
 * İlk çalıştırmada varsayılan odaları oluşturur ve tüm odaları döner.
 */
const ensureDefaultRooms = async () => {
	const count = await ChatRoom.countDocuments();
	if (count === 0) {
		await ChatRoom.insertMany(DEFAULT_ROOMS);
	}

	return ChatRoom.find().sort({ order: 1 }).lean();
};

module.exports = ChatRoom;
module.exports.ensureDefaultRooms = ensureDefaultRooms;
module.exports.DEFAULT_ROOMS = DEFAULT_ROOMS;
