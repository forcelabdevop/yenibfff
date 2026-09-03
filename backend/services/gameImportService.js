const axios = require("axios");
const Game = require("../database/models/Game");

// ==================== ORTAK: GÜVENLİ UPSERT ====================
//
// Sorun: Betinovi/Nexus/Drakon senkronizasyonları mevcut oyunların
// game_name / banner / cover alanlarını HER seferinde koşulsuz üzerine
// yazıyordu. Admin panelinden elle düzenlenmiş görseller, yeni bir oyun
// senkronize edildiğinde kayboluyordu.
//
// Kural: Var olan bir oyunun meta alanları (durum, tip, rtp, teknoloji vb.)
// her zaman güncellenir. Görsel/isim alanları ise SADECE:
//   - Oyun daha önce hiç yoksa (yeni oluşturuluyorsa), VEYA
//   - Admin "forceUpdateImages" seçeneğini açıkça işaretlemişse VE
//     oyun "imageLocked" ile korunmuyorsa
// güncellenir.
async function safeUpsertGame(gameCode, fields, { forceUpdateImages = false } = {}) {
	if (!gameCode) {
		throw new Error("game_code eksik, kayıt atlandı");
	}

	const { game_name, banner, cover, ...metaFields } = fields;

	const existing = await Game.findOne({ game_code: gameCode }).select(
		"_id imageLocked",
	);

	if (!existing) {
		// Sağlayıcılar (özellikle Betinovi/Nexus) provider_id/technology/
		// game_id gibi alanları hiç göndermiyor. Orijinal kod da bu yüzden
		// updateOne+upsert kullanıyordu (Mongoose bu yolda tam şema
		// validasyonu çalıştırmaz) — aynı davranış korunuyor, ama artık
		// eksik zorunlu alanlar için güvenli varsayılanlar veriliyor.
		const setFields = {
			game_code: gameCode,
			game_name: game_name || gameCode,
			banner: banner ?? null,
			cover: cover ?? banner ?? "/img/games/default.png",
			imageLocked: false,
			...metaFields,
		};

		const insertDefaults = {
			provider_id: 0,
			technology: "html5",
			game_id: gameCode,
		};
		const setOnInsert = {};
		for (const [key, value] of Object.entries(insertDefaults)) {
			if (!(key in setFields)) setOnInsert[key] = value;
		}

		await Game.updateOne(
			{ game_code: gameCode },
			Object.keys(setOnInsert).length
				? { $set: setFields, $setOnInsert: setOnInsert }
				: { $set: setFields },
			{ upsert: true },
		);
		return "created";
	}

	// Var olan oyun: meta alanlar her zaman güncellenir.
	const update = { ...metaFields };

	const canUpdateImages = forceUpdateImages && existing.imageLocked !== true;
	if (canUpdateImages) {
		if (game_name !== undefined) update.game_name = game_name;
		if (banner !== undefined) update.banner = banner;
		if (cover !== undefined) update.cover = cover;
	}

	await Game.updateOne({ _id: existing._id }, { $set: update });

	if (!forceUpdateImages) return "metadata_only";
	if (!canUpdateImages) return "skipped_locked";
	return "images_updated";
}

function makeCounters() {
	return {
		created: 0,
		images_updated: 0,
		metadata_only: 0,
		skipped_locked: 0,
		errors: [],
	};
}

function tally(counters, result) {
	counters[result] = (counters[result] || 0) + 1;
}

// ==================== BETINOVI ====================

const BETINOVI_BASE_URL = process.env.BETINOVI_API_ENDPOINT;
const BETINOVI_AGENT_CODE = process.env.BETINOVI_AGENT_CODE;
const BETINOVI_AGENT_TOKEN = process.env.BETINOVI_AGENT_TOKEN;

const SINGLE_GAME_VENDORS = {
	"sport-bbbet": {
		game_name: "Sports Betting",
		game_type: "sport",
		banner: "",
	},
};

async function betinoviRequest(payload) {
	const response = await axios.post(
		BETINOVI_BASE_URL,
		{
			...payload,
			token: BETINOVI_AGENT_TOKEN,
			agentCode: BETINOVI_AGENT_CODE,
		},
		{ headers: { "Content-Type": "application/json" }, timeout: 30000 },
	);
	return response.data;
}

function parseBetinoviLocalizedField(value, fallback) {
	if (!value) return fallback;
	try {
		const obj = JSON.parse(value);
		return obj.en || obj.tr || Object.values(obj)[0] || fallback;
	} catch (e) {
		return value;
	}
}

async function fetchBetinoviVendors() {
	const response = await betinoviRequest({ method: "GetVendors" });
	if (response.status !== 0 || !response.vendors) {
		throw new Error(response.msg || "Betinovi: vendor listesi alınamadı");
	}
	return response.vendors;
}

async function importBetinoviVendorGames(
	vendorCode,
	{ forceUpdateImages = false } = {},
	counters = makeCounters(),
) {
	const singleGameInfo = SINGLE_GAME_VENDORS[vendorCode];
	if (singleGameInfo) {
		try {
			const result = await safeUpsertGame(
				vendorCode,
				{
					provider_code: vendorCode,
					game_name: singleGameInfo.game_name,
					banner: singleGameInfo.banner,
					status: 1,
					distribution: "betinovi",
					game_type: singleGameInfo.game_type,
				},
				{ forceUpdateImages },
			);
			tally(counters, result);
		} catch (err) {
			counters.errors.push({ game_code: vendorCode, message: err.message });
		}
		return counters;
	}

	const response = await betinoviRequest({
		method: "GetVendorGames",
		vendorCode,
	});

	if (response.status !== 0 || !response.vendorGames) {
		throw new Error(response.msg || `Betinovi: ${vendorCode} oyunları alınamadı`);
	}

	for (const game of response.vendorGames) {
		try {
			const gameName = parseBetinoviLocalizedField(game.gameName, game.gameCode);
			const imageUrl = parseBetinoviLocalizedField(game.imageUrl, "");

			const result = await safeUpsertGame(
				game.gameCode,
				{
					provider_code: vendorCode,
					game_name: gameName,
					banner: imageUrl,
					status: 1,
					distribution: "betinovi",
					game_type:
						game.gameType === 1
							? "slot"
							: game.gameType === 2
								? "live"
								: "other",
				},
				{ forceUpdateImages },
			);
			tally(counters, result);
		} catch (err) {
			counters.errors.push({ game_code: game.gameCode, message: err.message });
		}
	}

	return counters;
}

async function importAllBetinoviGames({ forceUpdateImages = false } = {}) {
	const counters = makeCounters();
	const vendors = await fetchBetinoviVendors();

	for (const vendor of vendors) {
		try {
			await importBetinoviVendorGames(
				vendor.vendorCode,
				{ forceUpdateImages },
				counters,
			);
			// Betinovi API rate limit koruması
			await new Promise((resolve) => setTimeout(resolve, 1000));
		} catch (err) {
			counters.errors.push({
				vendor_code: vendor.vendorCode,
				message: err.message,
			});
		}
	}

	return counters;
}

// ==================== NEXUS ====================

const NEXUS_BASE_URL = process.env.NEXUS_API_ENDPOINT;
const NEXUS_AGENT_CODE = process.env.NEXUS_AGENT_CODE;
const NEXUS_AGENT_TOKEN = process.env.NEXUS_AGENT_TOKEN;

async function fetchNexusProviders() {
	const response = await axios.post(NEXUS_BASE_URL, {
		method: "provider_list",
		agent_code: NEXUS_AGENT_CODE,
		agent_token: NEXUS_AGENT_TOKEN,
	});

	if (response.data?.status !== 1) {
		throw new Error(response.data?.msg || "Nexus: sağlayıcı listesi alınamadı");
	}

	return response.data?.providers || response.data?.provider_list || [];
}

async function importNexusProviderGames(
	providerCode,
	{ forceUpdateImages = false } = {},
	counters = makeCounters(),
) {
	const response = await axios.post(NEXUS_BASE_URL, {
		method: "game_list",
		agent_code: NEXUS_AGENT_CODE,
		agent_token: NEXUS_AGENT_TOKEN,
		provider_code: providerCode,
	});

	const { status, msg, games } = response.data || {};
	if (status !== 1) {
		throw new Error(msg || `Nexus: ${providerCode} oyunları alınamadı`);
	}

	for (const game of games || []) {
		try {
			const banner = (game.banner || "").replaceAll(
				"assets.bd34fgabh.com",
				"assets.wkuytxcg8.com",
			);

			const result = await safeUpsertGame(
				game.game_code,
				{
					provider_code: providerCode,
					game_name: game.game_name,
					banner,
					status: game.status,
					distribution: "nexus",
					game_type: "gameshow",
				},
				{ forceUpdateImages },
			);
			tally(counters, result);
		} catch (err) {
			counters.errors.push({ game_code: game.game_code, message: err.message });
		}
	}

	return counters;
}

async function importAllNexusGames({ forceUpdateImages = false } = {}) {
	const counters = makeCounters();
	const providers = await fetchNexusProviders();

	for (const provider of providers) {
		const providerCode = provider.provider_code || provider.code;
		try {
			await importNexusProviderGames(
				providerCode,
				{ forceUpdateImages },
				counters,
			);
		} catch (err) {
			counters.errors.push({
				provider_code: providerCode,
				message: err.message,
			});
		}
	}

	return counters;
}

// ==================== DRAKON ====================

const DRAKON_BASE_URL = process.env.DRAKON_API_URL;
const DRAKON_AGENT_TOKEN = process.env.DRAKON_AGENT_TOKEN;
const DRAKON_AGENT_SECRET = process.env.DRAKON_AGENT_SECRET;

async function drakonAuthenticate() {
	const token = Buffer.from(
		`${DRAKON_AGENT_TOKEN}:${DRAKON_AGENT_SECRET}`,
	).toString("base64");

	const { data } = await axios.post(
		`${DRAKON_BASE_URL}/auth/authentication`,
		{},
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	if (!data?.access_token) {
		throw new Error("Drakon: kimlik doğrulama başarısız (access_token yok)");
	}

	return data.access_token;
}

async function drakonFetchAllGames(accessToken) {
	const { data } = await axios.get(`${DRAKON_BASE_URL}/games/all`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!data?.status) {
		throw new Error(`Drakon: oyun listesi alınamadı (${JSON.stringify(data)})`);
	}

	return data.games || data.result || [];
}

async function importAllDrakonGames({ forceUpdateImages = false } = {}) {
	const counters = makeCounters();

	if (!DRAKON_BASE_URL || !DRAKON_AGENT_TOKEN || !DRAKON_AGENT_SECRET) {
		throw new Error(
			"Drakon ortam değişkenleri eksik: DRAKON_API_URL, DRAKON_AGENT_TOKEN, DRAKON_AGENT_SECRET",
		);
	}

	const accessToken = await drakonAuthenticate();
	const games = await drakonFetchAllGames(accessToken);

	for (const game of games) {
		if (!game.game_id || !game.game_code) {
			counters.errors.push({
				game_code: game.game_code || null,
				message: "game_id veya game_code eksik, atlandı",
			});
			continue;
		}

		try {
			const providerCode =
				typeof game.provider_code === "string"
					? game.provider_code
					: typeof game.provider === "object" && game.provider?.code
						? game.provider.code
						: typeof game.provider === "string"
							? game.provider
							: null;

			const result = await safeUpsertGame(
				game.game_code,
				{
					provider_code: providerCode,
					game_name: game.game_name || game.game_code,
					game_id: game.game_id,
					banner: game.banner || null,
					cover:
						game.cover || game.image || game.banner || "/img/games/default.png",
					status: game.status ?? 1,
					distribution: "drakon",
					game_type: game.game_type || "slot",
					provider_id: game.provider_id || 0,
					technology: game.technology || "html5",
					is_mobile: game.is_mobile || 1,
					rtp: game.rtp || 0,
				},
				{ forceUpdateImages },
			);
			tally(counters, result);
		} catch (err) {
			counters.errors.push({ game_code: game.game_code, message: err.message });
		}
	}

	return counters;
}

module.exports = {
	safeUpsertGame,
	fetchBetinoviVendors,
	importBetinoviVendorGames,
	importAllBetinoviGames,
	fetchNexusProviders,
	importNexusProviderGames,
	importAllNexusGames,
	importAllDrakonGames,
};
