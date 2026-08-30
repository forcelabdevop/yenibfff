const express = require("express");
const mongoose = require("mongoose");
const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const ContentAuditLog = require("../database/models/ContentAuditLog");
const { checkPermission } = require("../middleware/permission");
const { PUBLIC_TYPES, pickContent, validateContent } = require("../services/casinoContentService");

const router = express.Router();
const typePermission = (action) => checkPermission([`casinoContent.${action}`, "casinoContent.manage"]);
const sendError = (res, error) => {
  if (error?.code === 11000) return res.status(409).json({ success: false, error: { message: "Slug and locale must be unique for this content type" } });
  return res.status(error.status || 500).json({ success: false, error: { message: error.message || "Server error" } });
};
const audit = (req, action, entity, before = null, reason = "") => ContentAuditLog.create({
  actor: req.adminUser?._id || null,
  action,
  entityType: entity.type || "casino-content",
  entityId: entity._id,
  before,
  after: entity.toObject ? entity.toObject() : entity,
  reason,
  ip: req.ip || "",
});

router.get("/", typePermission("read"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const query = {};
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    if (req.query.locale) query.locale = String(req.query.locale).toLowerCase();
    if (req.query.search) query.$text = { $search: String(req.query.search).slice(0, 120) };
    const [data, total] = await Promise.all([
      CasinoContent.find(query).sort({ type: 1, order: 1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CasinoContent.countDocuments(query),
    ]);
    res.json({ success: true, data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { sendError(res, error); }
});

router.post("/", typePermission("create"), async (req, res) => {
  try {
    const payload = pickContent(req.body);
    const errors = validateContent(payload);
    if (errors.length) return res.status(422).json({ success: false, error: { message: errors.join(", "), fields: errors } });
    payload.createdBy = req.adminUser?._id;
    payload.updatedBy = req.adminUser?._id;
    const item = await CasinoContent.create(payload);
    await audit(req, "create", item, null, req.body.reason);
    res.status(201).json({ success: true, data: item });
  } catch (error) { sendError(res, error); }
});

router.get("/:id", typePermission("read"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: { message: "Invalid id" } });
    const data = await CasinoContent.findById(req.params.id).lean();
    if (!data) return res.status(404).json({ success: false, error: { message: "Content not found" } });
    res.json({ success: true, data });
  } catch (error) { sendError(res, error); }
});

router.patch("/:id", typePermission("update"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: { message: "Invalid id" } });
    const payload = pickContent(req.body);
    const errors = validateContent(payload, true);
    if (errors.length) return res.status(422).json({ success: false, error: { message: errors.join(", "), fields: errors } });
    const item = await CasinoContent.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { message: "Content not found" } });
    const before = item.toObject();
    Object.assign(item, payload, { updatedBy: req.adminUser?._id });
    await item.save();
    await audit(req, "update", item, before, req.body.reason);
    res.json({ success: true, data: item });
  } catch (error) { sendError(res, error); }
});

router.post("/:id/publish", typePermission("publish"), async (req, res) => {
  try {
    const item = await CasinoContent.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { message: "Content not found" } });
    const before = item.toObject();
    item.status = req.body.status === "draft" ? "draft" : "published";
    item.updatedBy = req.adminUser?._id;
    await item.save();
    await audit(req, item.status === "published" ? "publish" : "unpublish", item, before, req.body.reason);
    res.json({ success: true, data: item });
  } catch (error) { sendError(res, error); }
});

router.delete("/:id", typePermission("delete"), async (req, res) => {
  try {
    if (!String(req.body?.reason || "").trim()) return res.status(422).json({ success: false, error: { message: "Deletion reason is required" } });
    const item = await CasinoContent.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { message: "Content not found" } });
    const stateCount = await CasinoUserState.countDocuments({ content: item._id });
    if (stateCount) return res.status(409).json({ success: false, error: { message: "Content with user activity must be archived instead of deleted" } });
    await audit(req, "delete", item, item.toObject(), req.body.reason);
    await item.deleteOne();
    res.json({ success: true, data: { id: item._id } });
  } catch (error) { sendError(res, error); }
});

router.get("/:id/activity", typePermission("read"), async (req, res) => {
  try {
    const data = await CasinoUserState.find({ content: req.params.id }).populate("user", "username local.email").sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data, meta: { total: data.length } });
  } catch (error) { sendError(res, error); }
});

router.get("/types/meta", typePermission("read"), (req, res) => res.json({ success: true, data: [...PUBLIC_TYPES] }));

module.exports = router;
