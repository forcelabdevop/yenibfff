const { providerRequest } = require("../utils/httpClient");
const { assertCanLaunchGame } = require("../services/launchGuards");

/**
 * BETCOLABS-tarzi saglayici: sportsbook (spor bahisleri) icin
 * session_token + query-string ile olusturulmus dogrudan bir iframe URL'i.
 *
 * - Digerlerinden farki: saglayici bize bir "launch API" DEGIL, bir
 *   `session_token` verir; biz bu token'i KENDIMIZ query-string olarak
 *   masaustu/mobil URL'ine ekleyip iframe'e koyariz. Yani "launch URL"
 *   saglayicidan gelmez, BIZIM tarafta insa edilir.
 * - Masaustu/mobil icin FARKLI base URL vardir (responsive degil, ayri
 *   bir mobil site).
 */
const DESKTOP_URL = process.env.BETCOLABS_DESKTOP_URL;
const MOBILE_URL = process.env.BETCOLABS_MOBILE_URL;
const AGENT_TOKEN = process.env.BETCOLABS_AGENT_TOKEN;

let cachedSessionByUser = new Map();

async function getOrCreateSession(user) {
	if (cachedSessionByUser.has(user.id)) {
		return cachedSessionByUser.get(user.id);
	}

	const response = await providerRequest({
		method: "POST",
		url: `${DESKTOP_URL}/api/session`,
		data: {
			agent_token: AGENT_TOKEN,
			user_id: user.id,
			user_name: user.username,
			currency: user.currency || "TRY",
		},
	});

	cachedSessionByUser.set(user.id, response.session_token);
	return response.session_token;
}

async function launchGame(user, { channel = "desktop", isLiveEvent = false, language = "tr" }) {
	assertCanLaunchGame(user);

	const sessionToken = await getOrCreateSession(user);
	const isMobile = channel === "mobile" || channel === "m";
	const baseUrl =
		(isMobile ? MOBILE_URL : DESKTOP_URL) +
		(isLiveEvent ? "/sports/live/event-view/" : "");

	const params = new URLSearchParams();
	params.append("session_token", sessionToken);
	if (language) params.append("lang", language);

	return { launchUrl: `${baseUrl}/?${params.toString()}`, provider: "betcolabs" };
}

module.exports = { launchGame };
