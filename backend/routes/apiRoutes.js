const express = require("express");
const router = express.Router();
const controller = require("../controllers/apiController");
const Banner = require("../database/models/Banner");
const Category = require("../database/models/Category");
const Game = require("../database/models/Game");
const GameProvider = require("../database/models/GameProvider");
const ShopItem = require("../database/models/ShopItem");
const SiteSettings = require("../database/models/SiteSettings");

// Casino arayüzü (footer / hero seçici / canlı bahis tablosu) ayarları.
// casino-ui statik bir iframe olduğu için bu uç kasıtlı olarak publictir ve
// yalnızca sunuma ait alanları döndürür.
const sortByOrder = (list = []) =>
	[...list].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));

router.get("/casino-ui-settings", async (req, res) => {
	try {
		// .lean() KULLANMA: Mongoose varsayılanları yalnızca doküman hydrate
		// edilirken uygulanır, lean sorguda uygulanmaz. Bu değişiklikten önce
		// oluşmuş kayıtlarda casinoUi alanı yok, bu yüzden hydrate edip
		// varsayılanların dolmasını sağlıyoruz.
		let doc = await SiteSettings.findOne();

		// Kayıt yoksa şema varsayılanlarıyla oluştur; casino-ui her zaman dolu
		// bir yapı alsın diye ilk isteği boş dönmüyoruz.
		if (!doc) {
			doc = new SiteSettings();
			await doc.save();
		}

		const casinoUi = doc.toObject().casinoUi || {};
		const footer = casinoUi.footer || {};

		res.status(200).json({
			success: true,
			data: {
				footer: {
					...footer,
					columns: sortByOrder(footer.columns).map((column) => ({
						...column,
						links: sortByOrder(column?.links),
					})),
					contact: {
						...(footer.contact || {}),
						items: sortByOrder(footer.contact?.items),
					},
					partners: sortByOrder(footer.partners),
					socials: sortByOrder(footer.socials),
				},
				heroChooser: casinoUi.heroChooser || {},
				betsTable: {
					...(casinoUi.betsTable || {}),
					tabs: sortByOrder(casinoUi.betsTable?.tabs),
				},
			},
		});
	} catch (error) {
		console.error("Casino arayüz ayarları getirilirken hata:", error);
		res.status(500).json({
			success: false,
			error: "Casino arayüz ayarları getirilirken bir hata oluştu.",
		});
	}
});

// Banner Routes
router.get("/banners", controller.getAllBanners);
router.get("/banners/:position", controller.getBannersByPosition);

router.get("/banners/:slug", async (req, res) => {
	const { slug } = req.params;
	try {
		const banners = await Banner.find({ position: slug }); // position === slug
		res.json(banners);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server Error" });
	}
});

router.get("/games/search-category", async (req, res) => {
	const {
		category,
		provider_code,
		keyword,
		limit = 18,
		offset = 0,
	} = req.query;

	const query = {
		status: 1,
	};

	// Kategori filtresi - hem yeni categories array hem de eski category alanını destekle
	if (category) {
		query.$or = [{ categories: category }, { category: category }];
	}

	if (keyword) {
		query.game_name = { $regex: keyword, $options: "i" }; // case-insensitive search
	}

	if (provider_code) {
		query["provider.code"] = provider_code;
	}

	try {
		const games = await Game.find(query)
			.skip(Number(offset))
			.limit(Number(limit));
		const total = await Game.countDocuments(query);

		res.json({
			success: true,
			total,
			data: games,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Search failed" });
	}
});

// Category Routes
router.get("/categories", controller.getAllCategories);

// Games
router.get("/games/category/:slug", controller.getGamesByCategorySlug);
router.get("/games/search", controller.searchGames);
router.get("/games/featured/list", controller.getFeaturedGames);
router.get("/games/categories/with-games", controller.getCategoriesWithGames);
router.get("/games/detail/:code", controller.getGameDetailByCode);
router.get("/providers/category/:slug", controller.getProvidersByCategorySlug);
router.get("/providers", async (req, res) => {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
		const providers = await GameProvider.find({ status: 1 })
			.select("code name slug logo featured order gameCount")
			.sort({ featured: -1, order: 1, gameCount: -1, name: 1 })
			.limit(limit)
			.lean();
		res.json({ success: true, data: providers, meta: { total: providers.length, limit } });
	} catch (error) {
		res.status(500).json({ success: false, error: { code: "PROVIDERS_LOAD_FAILED", message: error.message } });
	}
});

router.get("/shop/items", async (req, res) => {
	try {
		const items = await ShopItem.find({ isActive: true })
			.sort({ createdAt: -1 })
			.select("title description banner coinCost rewardAmount isActive createdAt")
			.lean();

		res.json({
			success: true,
			total: items.length,
			data: items,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({
			success: false,
			message: "Shop items could not be fetched",
		});
	}
});

router.get("/shop/items/:id", async (req, res) => {
	try {
		const item = await ShopItem.findOne({
			_id: req.params.id,
			isActive: true,
		})
			.select("title description banner coinCost rewardAmount isActive createdAt")
			.lean();

		if (!item) {
			return res.status(404).json({
				success: false,
				message: "Shop item not found",
			});
		}

		return res.json({ success: true, data: item });
	} catch (err) {
		console.error(err);
		return res.status(500).json({
			success: false,
			message: "Shop item could not be fetched",
		});
	}
});

module.exports = router;
