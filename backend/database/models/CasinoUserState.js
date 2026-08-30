const mongoose = require("mongoose");

const casinoUserStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  content: { type: mongoose.Schema.Types.ObjectId, ref: "CasinoContent", required: true, index: true },
  kind: { type: String, enum: ["mission", "bonus", "promotion", "vip-transfer"], required: true },
  status: {
    type: String,
    enum: [
      "joined", "active", "completed", "claimed", "rejected", "expired",
      // special bonus lifecycle
      "awaiting-deposit", "eligible", "delivery-pending", "delivery-failed", "wagering",
    ],
    default: "active",
  },
  progress: { type: Number, min: 0, default: 0 },
  target: { type: Number, min: 0, default: 0 },
  periodKey: { type: String, default: "lifetime" },
  joinedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  claimedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  idempotencyKey: { type: String, default: null },
  rewardSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  processedEvents: [{ type: String }],
  // special bonus / delivery bookkeeping
  triggerEventKey: { type: String, default: null },
  deliveryAttempts: { type: Number, min: 0, default: 0 },
  nextDeliveryAt: { type: Date, default: null },
  lastDeliveryError: { type: String, default: "" },
  deliveredAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false });

casinoUserStateSchema.index({ user: 1, content: 1, periodKey: 1 }, { unique: true });
// ⚠️ `sparse: true` BURADA YETMEZ: bu alanların şema varsayılanı `null` olduğu
// için alan dokümanda AÇIKÇA var sayılır ve sparse index onu atlamaz — sonuçta
// aynı kullanıcının ikinci kaydı "duplicate null" hatasıyla reddedilirdi.
// `partialFilterExpression` ile yalnızca gerçek string değerler indekslenir.
casinoUserStateSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
casinoUserStateSchema.index({ kind: 1, status: 1, createdAt: -1 });
// Teslim kuyruğu taraması ve aynı yatırımın iki bonusu tetiklemesini engelleme.
casinoUserStateSchema.index({ status: 1, nextDeliveryAt: 1 });
casinoUserStateSchema.index(
  { user: 1, triggerEventKey: 1 },
  { unique: true, partialFilterExpression: { triggerEventKey: { $type: "string" } } }
);

module.exports = mongoose.models.CasinoUserState || mongoose.model("CasinoUserState", casinoUserStateSchema);
