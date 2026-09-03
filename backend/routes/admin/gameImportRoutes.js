const express = require("express");
const router = express.Router();
const { checkPermission } = require("../../middleware/permission");
const {
	fetchBetinoviVendors,
	importBetinoviVendorGames,
	importAllBetinoviGames,
	fetchNexusProviders,
	importNexusProviderGames,
	importAllNexusGames,
	importAllDrakonGames,
} = require("../../services/gameImportService");

/**
 * Oyun İçe Aktarma Route'ları
 *
 * Not: Bu endpoint'ler, mevcut betinoviApi.js / goldApi.js içindeki eski
 * "fetch_games" / "fetch-games" işleyicilerinin YERİNE geçmez — onlar
 * dokunulmadan bırakıldı. Admin panelindeki "Oyun İçe Aktarma" sayfası
 * artık bunları değil, bu yeni ve güvenli (görsel/isim koruma destekli)
 * yolu çağırır.
 */

// -------------------- BETINOVI --------------------

router.get(
	"/betinovi/vendors",
	checkPermission("games.read"),
	async (req, res) => {
		try {
			const vendors = await fetchBetinoviVendors();
			res.json({ success: true, data: vendors });
		} catch (error) {
			console.error("Betinovi vendor listesi hatası:", error);
			res.status(500).json({ success: false, message: error.message });
		}
	},
);

router.post(
	"/betinovi",
	checkPermission("games.manage"),
	async (req, res) => {
		try {
			const { vendorCode, forceUpdateImages = false } = req.body;

			const result =
				!vendorCode || vendorCode === "all"
					? await importAllBetinoviGames({ forceUpdateImages })
					: await importBetinoviVendorGames(vendorCode, {
							forceUpdateImages,
						});

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Betinovi içe aktarma hatası:", error);
			res.status(500).json({ success: false, message: error.message });
		}
	},
);

// -------------------- NEXUS --------------------

router.get(
	"/nexus/providers",
	checkPermission("games.read"),
	async (req, res) => {
		try {
			const providers = await fetchNexusProviders();
			res.json({ success: true, data: providers });
		} catch (error) {
			console.error("Nexus sağlayıcı listesi hatası:", error);
			res.status(500).json({ success: false, message: error.message });
		}
	},
);

router.post("/nexus", checkPermission("games.manage"), async (req, res) => {
	try {
		const { providerCode, forceUpdateImages = false } = req.body;

		const result =
			!providerCode || providerCode === "all"
				? await importAllNexusGames({ forceUpdateImages })
				: await importNexusProviderGames(providerCode, {
						forceUpdateImages,
					});

		res.json({ success: true, data: result });
	} catch (error) {
		console.error("Nexus içe aktarma hatası:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// -------------------- DRAKON --------------------

router.post("/drakon", checkPermission("games.manage"), async (req, res) => {
	try {
		const { forceUpdateImages = false } = req.body;
		const result = await importAllDrakonGames({ forceUpdateImages });
		res.json({ success: true, data: result });
	} catch (error) {
		console.error("Drakon içe aktarma hatası:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

module.exports = router;
