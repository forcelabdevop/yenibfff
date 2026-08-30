const mongoose = require("mongoose");

// 🧾 Ödül motorunun işlediği ham olay defteri.
// Hem global idempotency anahtarı hem de audit panelinde "işlenen eventler"
// görünümü ve yatırım sırası (kaçıncı yatırım) hesabı için kullanılır.
const casinoRewardEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  eventType: { type: String, enum: ["deposit", "wager", "win", "game-round", "login"], required: true },
  eventKey: { type: String, required: true },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: "", uppercase: true },
  gameCode: { type: String, default: "" },
  providerCode: { type: String, default: "" },
  category: { type: String, default: "" },
  reference: { type: String, default: "" },
  sequence: { type: Number, default: 0 },
  result: { type: mongoose.Schema.Types.Mixed, default: {} },
  occurredAt: { type: Date, default: Date.now },
}, { timestamps: true, minimize: false });

casinoRewardEventSchema.index({ eventKey: 1 }, { unique: true });
casinoRewardEventSchema.index({ user: 1, eventType: 1, occurredAt: -1 });

module.exports = mongoose.models.CasinoRewardEvent || mongoose.model("CasinoRewardEvent", casinoRewardEventSchema);
