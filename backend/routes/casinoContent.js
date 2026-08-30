const express = require("express");
const { authorizeUser } = require("../middleware/auth");
const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const CryptoPrice = require("../database/models/CryptoPrice");
const Box = require("../database/models/Box");
const { PUBLIC_TYPES, listPublished, joinContent, claimContent, visibilityQuery } = require("../services/casinoContentService");
const { selectBonus } = require("../services/casinoRewardEngine");

const router = express.Router();
const sendError = (res, error) => res.status(error.status || 500).json({ success: false, error: { message: error.message || "Server error" } });

router.get("/bootstrap", authorizeUser(false), async (req, res) => {
  try {
    const locale = String(req.query.locale || "en").toLowerCase();
    const types = [...PUBLIC_TYPES];
    const visibility = visibilityQuery("home-section", locale);
    delete visibility.type;
    const entries = await CasinoContent.find({ type: { $in: types }, ...visibility }).lean();
    const grouped = types.reduce((result, type) => ({ ...result, [type]: [] }), {});
    entries.forEach((entry) => grouped[entry.type]?.push(entry));
    Object.values(grouped).forEach((list) => list.sort((a, b) => a.order - b.order));
    res.json({ success: true, data: grouped, meta: { locale, generatedAt: new Date().toISOString() } });
  } catch (error) { sendError(res, error); }
});

router.get("/crypto/earn", authorizeUser(false), async (req, res) => {
  try {
    const locale = String(req.query.locale || "en").toLowerCase();
    const types = ["crypto-staking", "crypto-swap", "crypto-futures-display", "crypto-lootbox-display"];
    const visibility = visibilityQuery("crypto-staking", locale);
    delete visibility.type;
    const [content, prices, boxes] = await Promise.all([
      CasinoContent.find({ type: { $in: types }, ...visibility }).sort({ order: 1 }).lean(),
      CryptoPrice.find({ price: { $gt: 0 } }).select("name price fee").lean(),
      Box.find({ state: { $in: ["active", "published"] } }).select("name slug amount levelMin categories type items state").sort({ createdAt: -1 }).limit(24).lean(),
    ]);
    const grouped = types.reduce((result, type) => ({ ...result, [type]: [] }), {});
    content.forEach(item => grouped[item.type].push(item));
    res.json({ success: true, data: { content: grouped, prices, boxes }, meta: { generatedAt: new Date().toISOString() } });
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

// Special bonus seçimi. "instant" bonuslar anında teslim edilir; "deposit"
// aktivasyonlu bonuslar ilk uygun yatırıma kadar "awaiting-deposit" bekler.
router.post("/bonuses/:id/select", authorizeUser(true), async (req, res) => {
  try {
    const result = await selectBonus({ userId: req.user._id, contentId: req.params.id });
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      data: result.state,
      meta: { duplicate: result.duplicate },
    });
  } catch (error) { sendError(res, error); }
});

// Kullanıcının açık bonusu: seçim penceresi, çevrim ilerlemesi ve teslim durumu.
router.get("/me/bonuses/active", authorizeUser(true), async (req, res) => {
  try {
    const data = await CasinoUserState.find({
      user: req.user._id,
      kind: "bonus",
      status: { $in: ["awaiting-deposit", "eligible", "delivery-pending", "delivery-failed", "wagering"] },
    })
      .populate("content", "title slug image reward rules")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: data.map((state) => ({
        ...state,
        // Çevrim yüzdesi UI'da doğrudan kullanılabilsin diye burada hesaplanır.
        wagerPercent: state.target > 0 ? Math.min(100, Math.round((state.progress / state.target) * 100)) : 0,
      })),
      meta: { total: data.length },
    });
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
