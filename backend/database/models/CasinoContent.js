const mongoose = require("mongoose");

const casinoContentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      "mission", "bonus", "promotion", "vip-benefit", "vip-manager", "vip-faq", "referral-tier",
      "site-navigation", "site-footer", "help-article", "home-hero", "home-section", "casino-rail",
      "provider-showcase", "battle-showcase", "ui-copy", "crypto-staking", "crypto-swap",
      "crypto-futures-display", "crypto-lootbox-display",
    ],
    index: true,
  },
  slug: { type: String, required: true, trim: true, lowercase: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  subtitle: { type: String, default: "", maxlength: 300 },
  description: { type: String, default: "", maxlength: 5000 },
  image: { type: String, default: "" },
  mobileImage: { type: String, default: "" },
  category: { type: String, default: "", trim: true },
  locale: { type: String, default: "en", trim: true, lowercase: true },
  status: { type: String, enum: ["draft", "scheduled", "published", "archived"], default: "draft", index: true },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  order: { type: Number, default: 0 },
  cta: {
    label: { type: String, default: "" },
    href: { type: String, default: "" },
  },
  rules: { type: mongoose.Schema.Types.Mixed, default: {} },
  reward: {
    type: { type: String, enum: ["none", "balance", "bonus", "free-spins", "xp"], default: "none" },
    amount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "USD", uppercase: true },
    wageringMultiplier: { type: Number, min: 0, default: 0 },
    // free-spins delivery parameters (Betinovi ApplyFreeRound)
    spinCount: { type: Number, min: 0, default: 0 },
    betAmount: { type: Number, min: 0, default: 0 },
    gameCode: { type: String, default: "", trim: true },
    providerCode: { type: String, default: "", trim: true },
    expireHours: { type: Number, min: 0, default: 72 },
  },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, minimize: false });

casinoContentSchema.index({ type: 1, slug: 1, locale: 1 }, { unique: true });
casinoContentSchema.index({ type: 1, status: 1, order: 1, startsAt: 1, endsAt: 1 });
casinoContentSchema.index({ title: "text", subtitle: "text", description: "text" });

casinoContentSchema.methods.isVisibleAt = function isVisibleAt(date = new Date()) {
  return this.status === "published" && (!this.startsAt || this.startsAt <= date) && (!this.endsAt || this.endsAt >= date);
};

module.exports = mongoose.models.CasinoContent || mongoose.model("CasinoContent", casinoContentSchema);
