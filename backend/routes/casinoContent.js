const express = require("express");
const { authorizeUser } = require("../middleware/auth");
const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const { listPublished, joinContent, claimContent, visibilityQuery } = require("../services/casinoContentService");

const router = express.Router();
const sendError = (res, error) => res.status(error.status || 500).json({ success: false, error: { message: error.message || "Server error" } });

router.get("/bootstrap", authorizeUser(false), async (req, res) => {
  try {
    const locale = String(req.query.locale || "en").toLowerCase();
    const types = ["home-section", "promotion", "bonus", "mission", "vip-benefit", "vip-manager", "vip-faq", "referral-tier"];
    const visibility = visibilityQuery("home-section", locale);
    delete visibility.type;
    const entries = await CasinoContent.find({ type: { $in: types }, ...visibility }).lean();
    const grouped = types.reduce((result, type) => ({ ...result, [type]: [] }), {});
    entries.forEach((entry) => grouped[entry.type]?.push(entry));
    Object.values(grouped).forEach((list) => list.sort((a, b) => a.order - b.order));
    res.json({ success: true, data: grouped, meta: { locale, generatedAt: new Date().toISOString() } });
  } catch (error) { sendError(res, error); }
});

router.get("/:type", authorizeUser(false), async (req, res) => {
  try {
    const data = await listPublished({ type: req.params.type, locale: String(req.query.locale || "en").toLowerCase(), userId: req.user?._id });
    res.json({ success: true, data, meta: { total: data.length } });
  } catch (error) { sendError(res, error); }
});

router.get("/:type/:slug", authorizeUser(false), async (req, res) => {
  try {
    const item = await CasinoContent.findOne({ slug: req.params.slug, ...visibilityQuery(req.params.type, String(req.query.locale || "en").toLowerCase()) }).lean();
    if (!item) return res.status(404).json({ success: false, error: { message: "Content not found" } });
    const userState = req.user ? await CasinoUserState.findOne({ user: req.user._id, content: item._id }).lean() : null;
    res.json({ success: true, data: { ...item, userState } });
  } catch (error) { sendError(res, error); }
});

router.post("/missions/:id/join", authorizeUser(true), async (req, res) => {
  try { res.status(201).json({ success: true, data: await joinContent({ userId: req.user._id, contentId: req.params.id }) }); }
  catch (error) { sendError(res, error); }
});

router.post("/:type/:id/claim", authorizeUser(true), async (req, res) => {
  try {
    const content = await CasinoContent.findById(req.params.id).select("type").lean();
    if (!content || content.type !== req.params.type) return res.status(404).json({ success: false, error: { message: "Content not found" } });
    const result = await claimContent({ userId: req.user._id, contentId: req.params.id, idempotencyKey: req.header("Idempotency-Key") });
    res.json({ success: true, data: result.state, meta: { duplicate: result.duplicate } });
  } catch (error) { sendError(res, error); }
});

router.get("/me/history/:kind", authorizeUser(true), async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const data = await CasinoUserState.find({ user: req.user._id, kind: req.params.kind }).populate("content", "title slug image reward").sort({ updatedAt: -1 }).limit(limit).lean();
    res.json({ success: true, data, meta: { total: data.length } });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
