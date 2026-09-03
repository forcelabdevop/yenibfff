const { providerRequest } = require("../utils/httpClient");
const { assertCanLaunchGame } = require("../services/launchGuards");
const { MOCK_MODE, buildMockLaunchUrl } = require("../utils/mockMode");

/**
 * BETINOVI-tarzi saglayici: "seamless wallet" modeli.
 *
 * - Kimlik dogrulama: her istekte body icinde agentCode + token gonderilir
 *   (ayri bir oturum/token alma adimi YOK).
 * - Tum metodlar TEK bir endpoint'e POST edilir; hangi islemin yapilacagi
 *   body icindeki `method` alaniyla secilir (GetGameUrl, GetVendors, ...).
 * - Bahis sirasinda saglayici, bizim sitemize (backend) bir "callback"
 *   göndererek bakiye dusme/yatirma islemini gercek zamanli yapar
 *   (bkz. gercek projede POST /betinovi/callback). Bu örnekte callback
 *   akisi gösterilmiyor; sadece launch (oyunu acma) adimi var.
 */
const BASE_URL = process.env.BETINOVI_API_ENDPOINT;
const AGENT_CODE = process.env.BETINOVI_AGENT_CODE;
const AGENT_TOKEN = process.env.BETINOVI_AGENT_TOKEN;

async function launchGame(user, { gameCode, vendorCode, language = "tr" }) {
	assertCanLaunchGame(user);

	if (MOCK_MODE) {
		return { launchUrl: buildMockLaunchUrl("betinovi", user, gameCode), provider: "betinovi" };
	}

	const response = await providerRequest({
		method: "POST",
		url: BASE_URL,
		data: {
			method: "GetGameUrl",
			token: AGENT_TOKEN,
			agentCode: AGENT_CODE,
			userCode: user.id,
			nickname: user.username,
			vendorCode,
			gameCode,
			currencyCode: user.currency || "TRY",
			language,
		},
	});

	if (response.status !== 0 || !response.launchUrl) {
		throw new Error(response.msg || "Betinovi oyunu baslatamadi");
	}

	return { launchUrl: response.launchUrl, provider: "betinovi" };
}

module.exports = { launchGame };
