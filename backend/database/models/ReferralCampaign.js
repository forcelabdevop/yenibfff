const mongoose = require("mongoose");

const referralCampaignSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
  isDefault: { type: Boolean, default: false },
  commissionShare: { type: Number, min: 0, max: 100, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

referralCampaignSchema.index({ owner: 1, createdAt: -1 });
referralCampaignSchema.index({ owner: 1, isDefault: 1 });

module.exports = mongoose.models.ReferralCampaign || mongoose.model("ReferralCampaign", referralCampaignSchema);
