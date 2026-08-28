const mongoose = require("mongoose");

/**
 * Chat / Rain / Tips modülünün tüm yönetilebilir ayarları.
 * Tek dokümanlı (singleton) bir koleksiyondur; `getChatSettings()` yardımcısı
 * doküman yoksa varsayılanlarla oluşturur.
 */
const chatSettingsSchema = new mongoose.Schema(
	{
		key: { type: String, default: "default", unique: true },

		// ── Genel sohbet ayarları ──────────────────────────────
		chat: {
			enabled: { type: Boolean, default: true },
			mode: {
				type: String,
				enum: ["normal", "slow", "vipOnly", "readonly"],
				default: "normal",
			},
			slowSeconds: { type: Number, default: 6 },
			cooldownSeconds: { type: Number, default: 3 },
			maxMessageLength: { type: Number, default: 300 },
			historySize: { type: Number, default: 50 },
			minXpToChat: { type: Number, default: 100 },
			minLevelToChat: { type: Number, default: 0 },
			minVipLevelToChat: { type: Number, default: 0 },
			blockLinks: { type: Boolean, default: true },
			blockCaps: { type: Boolean, default: false },
			maxEmojiPerMessage: { type: Number, default: 10 },
			emojiEnabled: { type: Boolean, default: true },
			repliesEnabled: { type: Boolean, default: true },
			showLevelRing: { type: Boolean, default: true },
			onlineMultiplier: { type: Number, default: 1 },
		},

		// ── Sabit (pinned) mesaj ───────────────────────────────
		pinned: {
			enabled: { type: Boolean, default: false },
			text: { type: String, default: "" },
			linkLabel: { type: String, default: "" },
			linkUrl: { type: String, default: "" },
			rooms: [{ type: String }], // boş => tüm odalar
			updatedBy: { type: mongoose.Schema.ObjectId, ref: "User" },
			updatedAt: { type: Date },
		},

		// ── Sohbet kuralları (modal içeriği) ───────────────────
		rules: {
			title: { type: String, default: "Sohbet Kuralları" },
			items: [{ type: String }],
			footer: { type: String, default: "" },
		},

		// ── Rain (yağmur) ayarları ─────────────────────────────
		rain: {
			enabled: { type: Boolean, default: true },
			minAmount: { type: Number, default: 10 },
			maxAmount: { type: Number, default: 10000 },
			durationSeconds: { type: Number, default: 120 },
			maxParticipants: { type: Number, default: 200 },
			hostFeePercent: { type: Number, default: 0 },
			joinMinLevel: { type: Number, default: 1 },
			joinMinWager: { type: Number, default: 0 },
			joinMinDepositCount: { type: Number, default: 0 },
			accountAgeMinutes: { type: Number, default: 60 },
			captchaRequired: { type: Boolean, default: false },
			// Site tarafından otomatik başlatılan rain
			auto: {
				enabled: { type: Boolean, default: false },
				amount: { type: Number, default: 100 },
				intervalMinutes: { type: Number, default: 60 },
				lastRunAt: { type: Date },
			},
		},

		// ── Tip (bahşiş) ayarları ──────────────────────────────
		tip: {
			enabled: { type: Boolean, default: true },
			minAmount: { type: Number, default: 1 },
			maxAmount: { type: Number, default: 100000 },
			feePercent: { type: Number, default: 0 },
			minLevelToTip: { type: Number, default: 1 },
			minWagerToTip: { type: Number, default: 0 },
			dailyLimit: { type: Number, default: 0 }, // 0 => limitsiz
			cooldownSeconds: { type: Number, default: 10 },
			announceInChat: { type: Boolean, default: true },
			currency: { type: String, default: "TRY" },
		},

		updatedAt: { type: Date, default: Date.now },
		createdAt: { type: Date, default: Date.now },
	},
	{ minimize: false },
);

const ChatSettings = mongoose.model("ChatSettings", chatSettingsSchema);

const DEFAULT_RULES = [
	"Diğer kullanıcılara saygılı olun, hakaret ve nefret söylemi yasaktır.",
	"Spam, flood ve büyük harfle bağırmak yasaktır.",
	"Reklam, referans linki ve harici site paylaşımı yasaktır.",
	"Dilencilik (begging) ve tip/rain zorlaması yasaktır.",
	"Kişisel bilgi paylaşmayın; destek ekibi asla şifrenizi istemez.",
];

/**
 * Singleton dokümanı getirir, yoksa varsayılanlarla oluşturur.
 */
const getChatSettings = async (lean = false) => {
	let settings = await ChatSettings.findOne({ key: "default" });

	if (!settings) {
		settings = await ChatSettings.create({
			key: "default",
			rules: { title: "Sohbet Kuralları", items: DEFAULT_RULES },
		});
	}

	return lean ? settings.toObject() : settings;
};

module.exports = ChatSettings;
module.exports.getChatSettings = getChatSettings;
module.exports.DEFAULT_RULES = DEFAULT_RULES;
