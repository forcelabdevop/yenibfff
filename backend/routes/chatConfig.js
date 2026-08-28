const express = require("express");
const router = express.Router();

const { getChatSettings } = require("../database/models/ChatSettings");
const { ensureDefaultRooms } = require("../database/models/ChatRoom");
const ChatMessage = require("../database/models/ChatMessage");

/**
 * Frontend sohbet paneli için genel yapılandırma (auth gerekmez).
 * GET /chat/config
 */
router.get("/config", async (req, res) => {
	try {
		const [settings, rooms] = await Promise.all([
			getChatSettings(true),
			ensureDefaultRooms(),
		]);

		res.status(200).json({
			success: true,
			data: {
				chat: settings.chat,
				pinned: settings.pinned?.enabled ? settings.pinned : { enabled: false },
				rules: settings.rules,
				rain: {
					enabled: settings.rain.enabled,
					minAmount: settings.rain.minAmount,
					maxAmount: settings.rain.maxAmount,
					durationSeconds: settings.rain.durationSeconds,
					joinMinLevel: settings.rain.joinMinLevel,
					joinMinWager: settings.rain.joinMinWager,
					captchaRequired: settings.rain.captchaRequired,
				},
				tip: {
					enabled: settings.tip.enabled,
					minAmount: settings.tip.minAmount,
					maxAmount: settings.tip.maxAmount,
					feePercent: settings.tip.feePercent,
					minLevelToTip: settings.tip.minLevelToTip,
					currency: settings.tip.currency,
					announceInChat: settings.tip.announceInChat,
				},
				rooms: rooms
					.filter((room) => room.enabled)
					.map(({ key, name, flag, language, locked, minLevel, minWager, vipOnly }) => ({
						key,
						name,
						flag,
						language,
						locked,
						minLevel,
						minWager,
						vipOnly,
					})),
			},
		});
	} catch (err) {
		console.error("chat config:", err);
		res.status(500).json({ success: false, message: "Sohbet ayarları alınamadı." });
	}
});

/**
 * Bir odanın son mesajları (yeniden bağlanma / SSR için).
 * GET /chat/messages?room=tr&limit=50
 */
router.get("/messages", async (req, res) => {
	try {
		const room = req.query.room || "tr";
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

		const messages = await ChatMessage.find({ room, deleted: false })
			.sort({ createdAt: -1 })
			.limit(limit)
			.select("message type username avatar rank level meta createdAt")
			.lean();

		res.status(200).json({ success: true, data: messages.reverse() });
	} catch (err) {
		console.error("chat messages:", err);
		res.status(500).json({ success: false, message: "Mesajlar alınamadı." });
	}
});

module.exports = router;
