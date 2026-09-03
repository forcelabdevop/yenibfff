const { providerRequest } = require("../utils/httpClient");
const { assertCanLaunchGame } = require("../services/launchGuards");

/**
 * POKER-tarzi saglayici: Basic-auth ile token degisimi + Bearer launch.
 *
 * - Once `agent_token:agent_secret` base64'e cevrilip Basic auth header'i
 *   olarak bir /auth endpoint'ine gonderilir; donen `access_token` bellekte
 *   tutulur (Drakon'a benzer ama token ALMA yontemi farkli: Basic auth vs
 *   client_credentials body).
 * - ONEMLI: gercek projede AGENT_TOKEN/AGENT_SECRET dosyaya HARDCODE
 *   edilmisti — bu, kimlik bilgilerini repoya sizdirir ve ortam
 *   degistiginde (test/prod) kod degisikligi gerektirir. Bu ornekte
 *   dogru yontemi gosteriyoruz: SADECE process.env'den okumak.
 */
const API_BASE_URL = process.env.POKER_API_BASE_URL;
const AGENT_TOKEN = process.env.POKER_AGENT_TOKEN;
const AGENT_SECRET = process.env.POKER_AGENT_SECRET;

let accessToken = null;

async function authenticate() {
	const encoded = Buffer.from(`${AGENT_TOKEN}:${AGENT_SECRET}`).toString(
		"base64",
	);

	const response = await providerRequest({
		method: "POST",
		url: `${API_BASE_URL}/auth/token`,
		headers: { Authorization: `Basic ${encoded}` },
	});

	if (!response.access_token) {
		throw new Error("Authentication failed - no access_token received");
	}

	accessToken = response.access_token;
	return accessToken;
}

async function ensureToken() {
	if (!accessToken) {
		return authenticate();
	}
	return accessToken;
}

async function launchGame(user, { gameCode, language = "tr" }) {
	assertCanLaunchGame(user);

	const token = await ensureToken();

	const response = await providerRequest({
		method: "POST",
		url: `${API_BASE_URL}/games/game_launch`,
		headers: { Authorization: `Bearer ${token}` },
		data: {
			agent_token: AGENT_TOKEN,
			user_id: user.id,
			user_name: user.username,
			game_id: gameCode,
			lang: language,
		},
	});

	const gameUrl = response?.game_url || response?.data?.game_url;
	if (!gameUrl) {
		throw new Error("INVALID_LAUNCH_RESPONSE");
	}

	return { launchUrl: gameUrl, provider: "poker" };
}

module.exports = { launchGame };
