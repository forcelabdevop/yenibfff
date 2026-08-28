const express = require("express");
const router = express.Router();

const { checkPermission } = require("../../middleware/permission");
const chatController = require("../../controllers/admin/chatController");

// Not: authenticateAdmin + adminOriginGuard + adminActionLogger üst router'da
// (routes/admin/index.js) uygulanıyor.

const READ = ["chat.read", "chat.manage", "platform.read", "platform.manage"];
const MANAGE = ["chat.manage", "platform.manage"];

// ── Ayarlar ───────────────────────────────────────────────
router.get("/settings", checkPermission(READ), chatController.getSettings);
router.put("/settings", checkPermission(MANAGE), chatController.updateSettings);

// ── Odalar ────────────────────────────────────────────────
router.get("/rooms", checkPermission(READ), chatController.listRooms);
router.post("/rooms", checkPermission(MANAGE), chatController.createRoom);
router.put("/rooms/:id", checkPermission(MANAGE), chatController.updateRoom);
router.delete("/rooms/:id", checkPermission(MANAGE), chatController.deleteRoom);

// ── Mesaj moderasyonu ─────────────────────────────────────
router.get("/messages", checkPermission(READ), chatController.listMessages);
router.delete("/messages/:id", checkPermission(MANAGE), chatController.deleteMessage);
router.post("/messages/clear", checkPermission(MANAGE), chatController.clearRoom);
router.post("/messages/system", checkPermission(MANAGE), chatController.sendSystemMessage);

// ── Kelime filtresi ───────────────────────────────────────
router.get("/filters", checkPermission(READ), chatController.listFilters);
router.post("/filters", checkPermission(MANAGE), chatController.createFilter);
router.delete("/filters/:id", checkPermission(MANAGE), chatController.deleteFilter);

// ── Susturma / yasaklama ──────────────────────────────────
router.get("/moderation", checkPermission(READ), chatController.listModeration);
router.post("/moderation/mute", checkPermission(MANAGE), chatController.muteUser);
router.post("/moderation/unmute/:id", checkPermission(MANAGE), chatController.unmuteUser);
router.post("/moderation/ban", checkPermission(MANAGE), chatController.banUser);
router.post("/moderation/unban/:id", checkPermission(MANAGE), chatController.unbanUser);

// ── Rain ──────────────────────────────────────────────────
router.get("/rains", checkPermission(READ), chatController.listRains);
router.get("/rains/:id", checkPermission(READ), chatController.getRainDetail);
router.post("/rains", checkPermission(MANAGE), chatController.createSiteRain);
router.post("/rains/:id/cancel", checkPermission(MANAGE), chatController.cancelRain);

// ── Tips ──────────────────────────────────────────────────
router.get("/tips", checkPermission(READ), chatController.listTips);

// ── İstatistikler ─────────────────────────────────────────
router.get("/stats", checkPermission(READ), chatController.getStats);

module.exports = router;
