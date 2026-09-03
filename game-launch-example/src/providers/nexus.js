const { providerRequest } = require("../utils/httpClient");
const { assertCanLaunchGame } = require("../services/launchGuards");
const { MOCK_MODE, buildMockLaunchUrl } = require("../utils/mockMode");

/**
 * NEXUS-tarzi saglayici: Betinovi'ye benzer "seamless wallet" modeli,
 * ama bu saglayici hem slot/canli-casino oyunlarini HEM DE sportsbook
 * (spor bahisleri) launch'ini AYNI endpoint uzerinden sunar — sadece
 * `method` alani degisir (game_launch vs sportsbook_launch).
 *
 * Bu, "her saglayici birbirine benzer ama asla ayni degil" durumunun
 * iyi bir ornegi: ayni body sekli (agent_code/agent_token) kullanilir
 * ama alan adlari (userCode -> user_code, vendorCode -> provider_code)
 * farklidir. Bu yuzden HER saglayici icin kendi adapter'ini yazariz;
 * tek bir "genel" fonksiyonla hepsini kapsamaya calismak, saglayici
 * kucuk bir alan adi degistirdiginde kirilgan hale gelir.
 */
const BASE_URL = process.env.NEXUS_BASE_URL;
const AGENT_CODE = process.env.NEXUS_AGENT_CODE;
const AGENT_TOKEN = process.env.NEXUS_AGENT_TOKEN;

async function launchGame(user, { gameCode, vendorCode, language = "tr" }) {
	assertCanLaunchGame(user);

	if (MOCK_MODE) {
		return { launchUrl: buildMockLaunchUrl("nexus", user, gameCode), provider: "nexus" };
	}

	const response = await providerRequest({
		method: "POST",
		url: BASE_URL,
		data: {
			method: "game_launch",
			agent_code: AGENT_CODE,
			agent_token: AGENT_TOKEN,
			user_code: user.id,
			provider_code: vendorCode,
			game_code: gameCode || "",
			lang: language,
		},
	});

	if (response.status !== 1 || !response.launch_url) {
		throw new Error(response.msg || "Nexus oyunu baslatamadi");
	}

	return { launchUrl: response.launch_url, provider: "nexus" };
}

module.exports = { launchGame };
