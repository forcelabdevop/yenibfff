const { providerRequest } = require("../utils/httpClient");
const { assertCanLaunchGame } = require("../services/launchGuards");
const { MOCK_MODE, buildMockLaunchUrl } = require("../utils/mockMode");

/**
 * DRAKON-tarzi saglayici: OAuth Bearer token modeli.
 *
 * - Kimlik dogrulama IKI ASAMALI: once client_id/client_secret ile bir
 *   access token alinir (OAuth client-credentials benzeri), sonra HER
 *   asil istek bu token'i `Authorization: Bearer <token>` header'inda
 *   tasir.
 * - Token bir sureligine (genelde birkac saat) gecerlidir; bu yuzden
 *   bellekte tutulur ve suresi dolana kadar yeniden istenmez
 *   (bkz. gercek projedeki ensureDrakonToken()).
 * - Launch cagrisi GET + query-string parametreleriyle yapilir (bazi
 *   saglayicilar POST+body yerine bunu tercih eder).
 */
const BASE_URL = process.env.DRAKON_BASE_URL;
const AGENT_CODE = process.env.DRAKON_AGENT_CODE;
const AGENT_TOKEN = process.env.DRAKON_AGENT_TOKEN;
const CLIENT_ID = process.env.DRAKON_CLIENT_ID;
const CLIENT_SECRET = process.env.DRAKON_CLIENT_SECRET;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function ensureDrakonToken() {
	const now = Date.now();
	if (cachedToken && now < cachedTokenExpiresAt) {
		return cachedToken;
	}

	const authResponse = await providerRequest({
		method: "POST",
		url: `${BASE_URL}/oauth/token`,
		data: {
			grant_type: "client_credentials",
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
		},
	});

	cachedToken = authResponse.access_token;
	// Saglayici genelde `expires_in` (saniye) doner; %90'ini kullanip
	// erken yenileyerek sinirda kalan isteklerin 401 almasini onleriz.
	cachedTokenExpiresAt = now + (authResponse.expires_in || 3600) * 900;

	return cachedToken;
}

async function launchGame(user, { gameCode, language = "tr", currency = "TRY" }) {
	assertCanLaunchGame(user);

	if (MOCK_MODE) {
		return { launchUrl: buildMockLaunchUrl("drakon", user, gameCode), provider: "drakon" };
	}

	const token = await ensureDrakonToken();

	const response = await providerRequest({
		method: "GET",
		url: `${BASE_URL}/games/game_launch`,
		headers: { Authorization: `Bearer ${token}` },
		params: {
			agent_code: AGENT_CODE,
			agent_token: AGENT_TOKEN,
			game_id: gameCode,
			type: "CHARGED",
			currency,
			lang: language,
			user_id: user.id,
			user_name: user.username || "guest",
		},
	});

	if (!response.game_url) {
		throw new Error(response.msg || "Drakon oyunu baslatamadi");
	}

	return { launchUrl: response.game_url, provider: "drakon" };
}

module.exports = { launchGame };
