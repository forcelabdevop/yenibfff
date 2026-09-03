const axios = require("axios");
const Game = require("../database/models/Game");

// ==================== BETFURY GÖRSEL EŞLEŞTİRME ====================
//
// Amaç: BetFury'nin herkese açık /api/_/games kataloğunu tarayıp, orada
// bulunan oyun kapak görsellerini (bfstatic.io CDN) kendi veritabanımızdaki
// AYNI oyunlarla (isim eşleştirmesiyle) ilişkilendirmek. Bu servis BetFury'yi
// bir oyun SAĞLAYICISI gibi görmez — hiçbir zaman yeni Game kaydı oluşturmaz,
// sadece var olan kayıtların `banner`/`cover` alanı için daha kaliteli bir
// görsel ADAYI önerir. Gerçek uygulama admin onayından geçer (bkz.
// applyBetfuryImages) — otomatik/toplu, gözetimsiz bir yazma işlemi YOKTUR.
//
// safeUpsertGame'deki (gameImportService.js) imageLocked kuralı burada da
// aynen geçerlidir: kilitli bir oyunun görseli asla değiştirilmez.

const SITE_BASE = (process.env.BETFURY_SITE_BASE || "https://betfury.is").replace(/\/$/, "");
const CDN_BASE = (process.env.BETFURY_CDN_BASE || "https://bfstatic.io").replace(/\/$/, "");
const CATALOGUE_PAGE_LIMIT = 500;
const CATALOGUE_MAX_PAGES = 40; // güvenlik sınırı: en fazla ~20.000 kayıt
const CATALOGUE_PAGE_DELAY_MS = 400;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 dakika

const API_HEADERS = {
	Accept: "application/json, text/plain, */*",
	Origin: SITE_BASE,
	Referer: `${SITE_BASE}/casino`,
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

let catalogueCache = { fetchedAt: 0, games: [] };

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function catalogueUrl(skip) {
	const params = new URLSearchParams({
		skip: String(skip),
		limit: String(CATALOGUE_PAGE_LIMIT),
		bonusEnabled: "false",
		isMobile: "false",
		host: SITE_BASE,
	});
	return `${SITE_BASE}/api/_/games?${params}`;
}

// BetFury'nin herkese açık kataloğunu skip/limit ile sayfalayarak tamamını
// çeker. Sonuç kısa süreliğine (CACHE_TTL_MS) belleğe alınır — admin panelden
// arka arkaya "Eşleşmeleri Getir" tıklaması BetFury'yi gereksiz yormasın.
async function fetchBetfuryCatalogue({ force = false } = {}) {
	if (!force && catalogueCache.games.length && Date.now() - catalogueCache.fetchedAt < CACHE_TTL_MS) {
		return catalogueCache.games;
	}

	const games = new Map();
	let skip = 0;

	for (let page = 0; page < CATALOGUE_MAX_PAGES; page += 1) {
		const { data } = await axios.get(catalogueUrl(skip), {
			headers: API_HEADERS,
			timeout: 30000,
		});

		const items = data?.types?.all;
		if (!Array.isArray(items)) {
			throw new Error("BetFury: kataloğun beklenmeyen bir formatı döndü");
		}

		for (const game of items) {
			const key = game?._id || game?.uuid;
			if (key) games.set(String(key), game);
		}

		skip += items.length;
		if (!items.length || items.length < CATALOGUE_PAGE_LIMIT) break;
		await delay(CATALOGUE_PAGE_DELAY_MS);
	}

	const list = [...games.values()];
	catalogueCache = { fetchedAt: Date.now(), games: list };
	return list;
}

// Karşılaştırma için isimleri normalize eder: aksan/diakritik işaretleri,
// noktalama ve boşluk farklarını yok sayar. Örn. "Sweet Bonanza™" ve
// "sweet-bonanza" aynı normalize değere ("sweetbonanza") indirgenir.
function normalizeName(value) {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

function previewUrl(imageId, variant = "2x.webp") {
	const encodedId = encodeURIComponent(String(imageId)).replaceAll("%3A", ":");
	return `${CDN_BASE}/preview/${encodedId}@${variant}`;
}

function hasUsableBanner(banner) {
	if (!banner || typeof banner !== "string") return false;
	const trimmed = banner.trim();
	if (!trimmed) return false;
	return !/default\.(png|jpe?g|webp)$/i.test(trimmed);
}

// Kendi oyun kataloğumuzu BetFury kataloğuyla isim bazlı eşleştirir.
// - onlyMissingBanner=true (varsayılan): sadece görseli boş/placeholder olan
//   oyunlar için aday önerir — bu, yanlışlıkla iyi bir görselin daha kötü bir
//   BetFury görseliyle değiştirilmesi riskini azaltır.
// - Sonuçta DB'ye HİÇBİR yazma yapılmaz; admin panel bu listeyi süzüp
//   applyBetfuryImages'a gönderir.
async function matchGamesWithBetfury({ onlyMissingBanner = true, force = false } = {}) {
	const [catalogue, ourGames] = await Promise.all([
		fetchBetfuryCatalogue({ force }),
		Game.find()
			.select("_id game_name game_code provider_code banner cover imageLocked")
			.lean(),
	]);

	const byName = new Map();
	for (const game of catalogue) {
		if (game.image_id == null || !String(game.image_id).length) continue;
		const key = normalizeName(game.name);
		if (!key) continue;
		if (!byName.has(key)) byName.set(key, []);
		byName.get(key).push(game);
	}

	const matches = [];
	for (const ours of ourGames) {
		// Kilitli oyunlar hiçbir zaman uygulanamayacağı için (applyBetfuryImages
		// bunları zaten reddediyor) baştan listeye dahil edilmiyor -- admin
		// panelinde seçilemeyecek satırlar göstermenin bir anlamı yok.
		if (ours.imageLocked) continue;
		if (onlyMissingBanner && hasUsableBanner(ours.banner)) continue;

		const key = normalizeName(ours.game_name);
		const candidates = key ? byName.get(key) || [] : [];
		if (!candidates.length) continue;

		const matchType = candidates.length === 1 ? "exact" : "ambiguous";
		const candidate = candidates[0];

		matches.push({
			gameId: String(ours._id),
			gameName: ours.game_name,
			gameCode: ours.game_code,
			providerCode: ours.provider_code,
			currentBanner: ours.banner || null,
			matchType,
			candidateCount: candidates.length,
			betfuryName: candidate.name,
			betfuryProvider: candidate.providerPublicName || candidate.provider || null,
			imageId: candidate.image_id,
			previewUrl: previewUrl(candidate.image_id, "2x.webp"),
		});
	}

	return {
		matches,
		catalogueCount: catalogue.length,
		ourGameCount: ourGames.length,
		fetchedAt: catalogueCache.fetchedAt,
	};
}

// Admin'in onayladığı seçimleri uygular. Güvenlik: istemciden tam bir URL
// değil sadece `imageId` alınır ve önizleme URL'i burada, sabit CDN_BASE ile
// sunucu tarafında yeniden inşa edilir — böylece istemci keyfi bir URL
// enjekte edip banner alanına yazdıramaz (SSRF/açık yönlendirme riski yok).
// Kilitli oyunlar her koşulda atlanır. Uygulanan görsel, varsayılan olarak
// aynı manuel-yükleme davranışıyla (bkz. gameImportService.js) imageLocked'a
// çekilir — sonraki bir sağlayıcı senkronizasyonu bu görseli ezmesin.
async function applyBetfuryImages(selections, { lockAfterApply = true } = {}) {
	const counters = { updated: 0, skipped_locked: 0, not_found: 0, errors: [] };

	for (const selection of selections || []) {
		const { gameId, imageId, variant } = selection || {};
		if (!gameId || imageId == null || !String(imageId).length) {
			counters.errors.push({ gameId, message: "gameId veya imageId eksik" });
			continue;
		}

		try {
			const game = await Game.findById(gameId).select("_id imageLocked");
			if (!game) {
				counters.not_found += 1;
				continue;
			}
			if (game.imageLocked) {
				counters.skipped_locked += 1;
				continue;
			}

			const bannerUrl = previewUrl(imageId, variant || "2x.webp");
			await Game.updateOne(
				{ _id: game._id },
				{ $set: { banner: bannerUrl, cover: bannerUrl, imageLocked: !!lockAfterApply } },
			);
			counters.updated += 1;
		} catch (err) {
			counters.errors.push({ gameId, message: err.message });
		}
	}

	return counters;
}

module.exports = {
	fetchBetfuryCatalogue,
	matchGamesWithBetfury,
	applyBetfuryImages,
	normalizeName,
	previewUrl,
};
