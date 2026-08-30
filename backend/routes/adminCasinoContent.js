const express = require("express");
const mongoose = require("mongoose");
const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const ContentAuditLog = require("../database/models/ContentAuditLog");
const Game = require("../database/models/Game");
const { checkPermission } = require("../middleware/permission");
const { PUBLIC_TYPES, pickContent, validateContent } = require("../services/casinoContentService");
const casinoRewardEngine = require("../services/casinoRewardEngine");

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

router.get("/summary", typePermission("read"), async (req, res) => {
  try {
    const rows = await CasinoContent.aggregate([
      { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 }, updatedAt: { $max: "$updatedAt" } } },
      { $sort: { "_id.type": 1, "_id.status": 1 } },
    ]);
    res.json({ success: true, data: rows.map((row) => ({ type: row._id.type, status: row._id.status, count: row.count, updatedAt: row.updatedAt })) });
  } catch (error) { sendError(res, error); }
});

router.post("/", typePermission("create"), async (req, res) => {
  try {
    if (!String(req.body.reason || "").trim()) return res.status(422).json({ success: false, error: { message: "Change reason is required" } });
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

router.get("/types/meta", typePermission("read"), (req, res) => res.json({ success: true, data: [...PUBLIC_TYPES] }));

// Form seçenekleri: admin JSON/serbest metin yazmasın diye gerçek sağlayıcı,
// oyun ve kategori listesi buradan beslenir. ("/:id" üstünde olmalı.)
router.get("/lookups/options", typePermission("read"), async (req, res) => {
  try {
    const { MISSION_EVENT_TYPES, MISSION_METRICS, PERIODS, REWARD_TYPES, BONUS_ACTIVATIONS } = require("../services/casinoRewardSchema");
    const [providers, categories] = await Promise.all([
      Game.distinct("provider_code", { status: 1, provider_code: { $nin: [null, ""] } }),
      Game.distinct("categories", { status: 1 }),
    ]);
    res.json({
      success: true,
      data: {
        eventTypes: MISSION_EVENT_TYPES,
        metrics: MISSION_METRICS,
        periods: PERIODS,
        rewardTypes: REWARD_TYPES,
        activations: BONUS_ACTIVATIONS,
        providers: providers.filter(Boolean).sort(),
        categories: categories.filter(Boolean).sort(),
      },
    });
  } catch (error) { sendError(res, error); }
});

// Oyun arama: free-spin ödülü ve görev filtreleri için gerçek game_code seçtirir.
router.get("/lookups/games", typePermission("read"), async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 80);
    const query = { status: 1 };
    if (req.query.providerCode) query.provider_code = String(req.query.providerCode);
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [{ game_name: { $regex: safe, $options: "i" } }, { game_code: { $regex: safe, $options: "i" } }];
    }
    const data = await Game.find(query, { game_code: 1, game_name: 1, provider_code: 1 })
      .sort({ featured: -1, views: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data });
  } catch (error) { sendError(res, error); }
});

// ⚠️ Teslim kuyruğu rotaları "/:id" ÜSTÜNDE tanımlanmalıdır; aksi halde
// "deliveries" bir içerik id'si sanılır ve 400 döner.
const DELIVERY_STATUSES = ["delivery-pending", "delivery-failed", "eligible", "awaiting-deposit", "wagering"];

// Sağlayıcıya teslim edilemeyen / bekleyen bonus ödüllerinin operasyon kuyruğu.
router.get("/deliveries/queue", typePermission("read"), async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const page = Math.max(1, Number(req.query.page) || 1);
    const status = String(req.query.status || "").trim();
    const query = { kind: "bonus", status: status && DELIVERY_STATUSES.includes(status) ? status : { $in: DELIVERY_STATUSES } };

    const [data, total, counts] = await Promise.all([
      CasinoUserState.find(query)
        .populate("content", "title slug type reward")
        .populate("user", "username local.email")
        .sort({ nextDeliveryAt: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CasinoUserState.countDocuments(query),
      CasinoUserState.aggregate([
        { $match: { kind: "bonus", status: { $in: DELIVERY_STATUSES } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data,
      meta: {
        total, page, limit,
        pages: Math.ceil(total / limit) || 1,
        counts: counts.reduce((result, row) => ({ ...result, [row._id]: row.count }), {}),
        maxAttempts: casinoRewardEngine.MAX_DELIVERY_ATTEMPTS,
      },
    });
  } catch (error) { sendError(res, error); }
});

// Başarısız/bekleyen bir teslimi hemen yeniden dener.
router.post("/deliveries/:stateId/retry", typePermission("update"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.stateId)) return res.status(400).json({ success: false, error: { message: "Invalid id" } });
    const result = await casinoRewardEngine.retryDelivery({ stateId: req.params.stateId });
    const state = await CasinoUserState.findById(req.params.stateId).lean();
    await audit(req, "delivery-retry", { _id: req.params.stateId, type: "casino-user-state", ...state }, null, req.body?.reason || "");
    res.json({ success: true, data: state, meta: { delivered: result.delivered, error: result.error || null } });
  } catch (error) { sendError(res, error); }
});

// Teslimi iptal eder: kayıt "rejected" olur ve kuyruktan düşer.
router.post("/deliveries/:stateId/cancel", typePermission("update"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.stateId)) return res.status(400).json({ success: false, error: { message: "Invalid id" } });
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(422).json({ success: false, error: { message: "Change reason is required" } });
    const state = await casinoRewardEngine.cancelDelivery({ stateId: req.params.stateId, reason });
    await audit(req, "delivery-cancel", { _id: state._id, type: "casino-user-state", ...state.toObject() }, null, reason);
    res.json({ success: true, data: state });
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
    if (!String(req.body.reason || "").trim()) return res.status(422).json({ success: false, error: { message: "Change reason is required" } });
    const payload = pickContent(req.body);
    const item = await CasinoContent.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { message: "Content not found" } });
    const errors = validateContent(payload, true, item.toObject());
    if (errors.length) return res.status(422).json({ success: false, error: { message: errors.join(", "), fields: errors } });
    if (payload.type && payload.type !== item.type) return res.status(409).json({ success: false, error: { message: "Content type cannot be changed" } });
    const before = item.toObject();
    delete payload.type;
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

router.get("/:id/audit", typePermission("read"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: { message: "Invalid id" } });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const query = { entityId: req.params.id };
    const [data, total] = await Promise.all([
      ContentAuditLog.find(query).populate("actor", "username email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ContentAuditLog.countDocuments(query),
    ]);
    res.json({ success: true, data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { sendError(res, error); }
});

router.get("/:id/activity", typePermission("read"), async (req, res) => {
  try {
    const data = await CasinoUserState.find({ content: req.params.id }).populate("user", "username local.email").sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data, meta: { total: data.length } });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
