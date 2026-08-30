const Banner = require("../database/models/Banner");
const Category = require("../database/models/Category");
const Game = require("../database/models/Game");
const GameProvider = require("../database/models/GameProvider");
const { serializeBanner } = require("../utils/banner");
const mongoose = require("mongoose");
const Transaction = require("../database/models/Transaction");
const User = require("../database/models/User");

// Oyun kartlari / raflar icin yeterli olan alan seti
const GAME_LIST_FIELDS =
	"game_name game_code banner background views featured provider_code provider categories category distribution rtp";

// Oyun detay sayfasinin "Game Attributes" bolumu icin ek alanlar
const GAME_DETAIL_FIELDS = `${GAME_LIST_FIELDS} game_type technology is_mobile has_freespins has_tables has_lobby only_demo description created_at`;

// Top wins listesinde gercek kullanici adini sizdirmadan taninabilir bir etiket uretir.
const maskUsername = (user) => {
	if (!user || user.anonymous) return "Gizli oyuncu";
	const name = String(user.username || "").trim();
	if (!name) return "Gizli oyuncu";
	if (name.length <= 3) return `${name.slice(0, 1)}**`;
	return `${name.slice(0, 3)}${"*".repeat(Math.min(5, name.length - 3))}`;
};

// ===== BANNER =====
exports.getAllBanners = async (req, res) => {
	try {
		const banners = await Banner.find().sort({
			position: 1,
			createdAt: -1,
		});
		res.json(banners.map(serializeBanner));
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

exports.getBannersByPosition = async (req, res) => {
	try {
		const { position } = req.params;
		const banners = await Banner.find({ position }).sort({ createdAt: -1 });
		res.json(banners.map(serializeBanner));
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// ===== CATEGORY =====
exports.getAllCategories = async (req, res) => {
	try {
		const categories = await Category.find().sort({ created_at: -1 });
		res.json(categories);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// ===== GAME BY CATEGORY SLUG =====
exports.getGamesByCategorySlug = async (req, res) => {
	try {
		const { slug } = req.params;
		const limit = parseInt(req.query.limit) || 18;
		const offset = parseInt(req.query.offset) || 0;
		const providerCode = req.query.provider_code;

		// Hem yeni categories array hem de eski category alanını destekle
		const query = {
			$or: [{ categories: slug }, { category: slug }],
		};
		if (providerCode) {
			query.provider_code = providerCode;
		}

		const [games, total] = await Promise.all([
			Game.find(query)
				.select(
					"game_name game_code banner background views featured provider_code provider categories category distribution rtp"
				)
				.sort({ featured: -1, views: -1 })
				.skip(offset)
				.limit(limit)
				.populate("provider", "name"),

			Game.countDocuments(query),
		]);

		res.json({ success: true, data: games, total });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

// ===== SEARCH GAME =====
exports.searchGames = async (req, res) => {
	try {
		const { query } = req.query;

		if (!query || query.trim().length < 2) {
			return res.status(200).json([]); // boşsa hata vermiyoruz, boş liste dönüyoruz
		}

		const games = await Game.find({
			game_name: { $regex: query, $options: "i" },
		})
			.select(
				"game_name game_code banner background views featured provider_code provider distribution rtp"
			)
			.sort({ featured: -1, views: -1 })
			.limit(30) // performans için sınır koyuyoruz
			.populate("provider", "name"); // eğer provider ilişkili modelse

		res.json(games);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

exports.getFeaturedGames = async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 15;

		const games = await Game.find({ featured: true })
			.select(
				"game_name game_code banner background views featured provider_code provider distribution rtp"
			)
			.sort({ views: -1 })
			.limit(limit)
			.populate("provider", "name");

		res.json(games);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

exports.getCategoriesWithGames = async (req, res) => {
	try {
		const homepageOnly = req.query.homepage === "true";
		const categoryFilter = { isActive: { $ne: false } };
		if (homepageOnly) categoryFilter.showOnHomepage = { $ne: false };

		const categories = await Category.find(categoryFilter).sort({ order: 1, created_at: 1 });
		const categoriesWithGames = await Promise.all(
			categories.map(async cat => {
				const dynamicQuery = {
					status: 1,
					$or: [{ categories: cat.slug }, { category: cat.slug }],
				};
				const gameQuery =
					cat.gameSelectionMode === "manual" && cat.games.length
						? { _id: { $in: cat.games }, status: 1 }
						: dynamicQuery;
				const limit = Math.min(100, Math.max(1, Number(cat.gameLimit) || 20));
				const [games, totalCount] = await Promise.all([
					Game.find(gameQuery)
						.select(GAME_LIST_FIELDS)
						.sort({ featured: -1, views: -1 })
						.limit(limit)
						.populate("provider", "name"),
					Game.countDocuments(gameQuery),
				]);

				return { ...cat.toObject(), total_games: totalCount, games };
			})
		);

		res.json({ success: true, data: categoriesWithGames, meta: { total: categoriesWithGames.length } });
	} catch (err) {
		res.status(500).json({ success: false, error: { code: "CATALOG_LOAD_FAILED", message: err.message } });
	}
};

// ===== GAME DETAIL (oyun sayfasi) =====
// Tek istekte oyun detayi + saglayici bilgisi + kategoriler + gercek top 3 kazanc
// + "Best <provider> games" ve "Most popular games" raflarini dondurur.
exports.getGameDetailByCode = async (req, res) => {
	try {
		const code = String(req.params.code || "").trim();
		if (!code) {
			return res
				.status(400)
				.json({ success: false, message: "Game code is required" });
		}

		const game = await Game.findOne({ game_code: code })
			.select(GAME_DETAIL_FIELDS)
			.populate("provider", "name");

		if (!game) {
			return res.status(404).json({ success: false, message: "Game not found" });
		}

		const providerCode = game.provider_code || null;
		const slugs =
			Array.isArray(game.categories) && game.categories.length
				? game.categories
				: game.category
					? [game.category]
					: [];

		const popularQuery = { game_code: { $ne: game.game_code } };
		if (slugs.length) {
			popularQuery.$or = [
				{ categories: { $in: slugs } },
				{ category: { $in: slugs } },
			];
		}

		const [providerGames, popularGames, winTransactions, providerDoc, categories] =
			await Promise.all([
				providerCode
					? Game.find({
							provider_code: providerCode,
							game_code: { $ne: game.game_code },
						})
							.select(GAME_LIST_FIELDS)
							.sort({ featured: -1, views: -1 })
							.limit(18)
							.populate("provider", "name")
					: [],
				Game.find(popularQuery)
					.select(GAME_LIST_FIELDS)
					.sort({ views: -1, featured: -1 })
					.limit(18)
					.populate("provider", "name"),
				Transaction.find({ game_code: game.game_code, win_money: { $gt: 0 } })
					.select("user_code bet_money win_money created_at")
					.sort({ win_money: -1 })
					.limit(3)
					.lean(),
				providerCode
					? GameProvider.findOne({ code: providerCode }).select("code name")
					: null,
				slugs.length
					? Category.find({ slug: { $in: slugs } }).select("name slug img")
					: [],
			]);

		const userIds = winTransactions
			.map((txn) => String(txn.user_code || ""))
			.filter((value) => mongoose.Types.ObjectId.isValid(value));

		const users = userIds.length
			? await User.find({ _id: { $in: userIds } }).select("username anonymous")
			: [];

		const userMap = new Map(users.map((user) => [user._id.toString(), user]));

		const topWins = winTransactions.map((txn) => {
			const bet = Number(txn.bet_money) || 0;
			const win = Number(txn.win_money) || 0;
			return {
				username: maskUsername(userMap.get(String(txn.user_code))),
				bet_money: bet,
				win_money: win,
				multiplier: bet > 0 ? Number((win / bet).toFixed(2)) : null,
				created_at: txn.created_at,
			};
		});

		res.json({
			success: true,
			data: {
				game,
				provider: {
					code: providerCode,
					name:
						game.provider?.name || providerDoc?.name || providerCode || null,
				},
				categories,
				topWins,
				providerGames,
				popularGames,
			},
		});
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

exports.getProvidersByCategorySlug = async (req, res) => {
	try {
		const { slug } = req.params;

		// Hem yeni categories array hem de eski category alanını destekle
		const providers = await Game.aggregate([
			{
				$match: {
					$or: [{ categories: slug }, { category: slug }],
				},
			},
			{
				$group: {
					_id: "$provider_code",
					count: { $sum: 1 },
				},
			},
			{
				$project: {
					provider_code: "$_id",
					count: 1,
					_id: 0,
				},
			},
			{ $sort: { count: -1 } },
		]);

		// GameProvider'dan name bilgisini al
		const providerCodes = providers.map(p => p.provider_code).filter(Boolean);
		const gameProviders = await GameProvider.find(
			{ code: { $in: providerCodes } },
			{ code: 1, name: 1 }
		);
		
		// name map oluştur
		const nameMap = {};
		gameProviders.forEach(gp => {
			nameMap[gp.code] = gp.name || gp.code;
		});

		// Provider'lara name ekle
		const providersWithName = providers.map(p => ({
			...p,
			name: nameMap[p.provider_code] || p.provider_code
		}));

		res.json({ success: true, data: providersWithName });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};
