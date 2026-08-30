const express = require("express");
const { authorizeUser } = require("../middleware/auth");
const { generalGetBetsDataSocket } = require("../controllers/general/bets");

const router = express.Router();
const ALLOWED_TABS = new Set(["all", "my", "high", "rare"]);

function getBets(user) {
	return new Promise((resolve, reject) => {
		generalGetBetsDataSocket(null, null, user, null, (result) => {
			if (!result?.success) return reject(new Error(result?.error?.message || "Bets could not be loaded"));
			resolve(result.bets || {});
		});
	});
}

router.get("/", authorizeUser(false), async (req, res) => {
	try {
		const tab = ALLOWED_TABS.has(req.query.tab) ? req.query.tab : "all";
		const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
		if (tab === "my" && !req.user) {
			return res.status(401).json({ success: false, error: { message: "Sign in to view your bets" } });
		}

		const bets = await getBets(req.user || null);
		const source = tab === "high" ? bets.whale : tab === "rare" ? bets.lucky : bets[tab];
		res.json({
			success: true,
			data: Array.isArray(source) ? source.slice(0, limit) : [],
			meta: { tab, limit, updatedAt: new Date().toISOString() },
		});
	} catch (error) {
		res.status(500).json({ success: false, error: { message: error.message } });
	}
});

module.exports = router;
