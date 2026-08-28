const mongoose = require("mongoose");

/**
 * Sohbet mesajlarının kalıcı kaydı.
 * Canlı sohbet hâlâ bellek üzerinden çalışır; bu koleksiyon admin panelindeki
 * moderasyon / arama / geçmiş ekranlarını besler.
 */
const chatMessageSchema = new mongoose.Schema({
	room: { type: String, index: true },
	type: {
		type: String,
		enum: ["user", "system", "tip", "rain"],
		default: "user",
	},
	message: { type: String, default: "" },
	user: { type: mongoose.Schema.ObjectId, ref: "User" },
	username: { type: String },
	avatar: { type: String },
	rank: { type: String },
	level: { type: Number, default: 0 },

	// Tip kartı / rain bildirimi meta verisi
	meta: {
		amount: { type: Number },
		currency: { type: String },
		targetUser: { type: mongoose.Schema.ObjectId, ref: "User" },
		targetUsername: { type: String },
		replyTo: { type: mongoose.Schema.ObjectId },
	},

	deleted: { type: Boolean, default: false },
	deletedAt: { type: Date },
	deletedBy: { type: mongoose.Schema.ObjectId, ref: "User" },
	deletedReason: { type: String },

	ip: { type: String },
	createdAt: { type: Date, default: Date.now },
});

chatMessageSchema.index({ createdAt: -1 });
chatMessageSchema.index({ room: 1, createdAt: -1 });
chatMessageSchema.index({ user: 1, createdAt: -1 });
chatMessageSchema.index({ deleted: 1, createdAt: -1 });
chatMessageSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
