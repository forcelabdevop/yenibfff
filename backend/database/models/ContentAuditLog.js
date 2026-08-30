const mongoose = require("mongoose");

const contentAuditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true, trim: true },
  entityType: { type: String, required: true, trim: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, default: "", maxlength: 500 },
  ip: { type: String, default: "" },
}, { timestamps: true, minimize: false });

contentAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
contentAuditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.models.ContentAuditLog || mongoose.model("ContentAuditLog", contentAuditLogSchema);
