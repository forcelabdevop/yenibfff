const express = require("express");
const router = express.Router();

const { findUserById } = require("../services/userStore");
const { getProviderAdapter } = require("../providers");
const { LaunchGuardError } = require("../services/launchGuards");

/**
 * TEK bir genel (provider-agnostic) oyun baslatma endpoint'i.
 *
 * Frontend hangi saglayicinin nasil calistigini bilmez; sadece
 * { userId, provider, gameCode, channel, language } gonderir. Gercek
 * projede her saglayicinin kendi endpoint'i (/betinovi, /drakon, /gold,
 * /poker, /betcolabs) vardir ve frontend hangisine gidecegini game
 * kaydindaki `distribution` alanindan cikarir — bu ornekte de ayni
 * bilgiyi `provider` alaniyla tasiyoruz, sadece tek bir HTTP yolundan
 * geciriyoruz.
 */
router.post("/launch", async (req, res) => {
	const { userId, provider, gameCode, vendorCode, channel, language } = req.body;

	if (!userId || !provider) {
		return res.status(400).json({
			success: false,
			error: "INVALID_REQUEST",
			details: "userId ve provider alanlari zorunludur.",
		});
	}

	const user = findUserById(userId);

	try {
		const adapter = getProviderAdapter(provider);
		const result = await adapter.launchGame(user, {
			gameCode,
			vendorCode,
			channel,
			language,
		});

		return res.status(200).json({ success: true, ...result });
	} catch (error) {
		if (error instanceof LaunchGuardError) {
			return res.status(error.httpStatus).json({
				success: false,
				error: error.code,
				details: error.message,
			});
		}

		console.error(`[launch] ${provider} icin baslatma hatasi:`, error.message);
		return res.status(502).json({
			success: false,
			error: "PROVIDER_ERROR",
			details: error.message,
		});
	}
});

module.exports = router;
