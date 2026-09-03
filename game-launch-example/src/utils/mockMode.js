/**
 * MOCK_MODE anahtari.
 *
 * Bu ornek repo, sahte api.example-*.com adreslerine isaret eder —
 * gercek saglayici kimlik bilgileri (API key/secret) olmadan bu
 * adresler dogal olarak ENOTFOUND/401 doner. Arkadasinizin gercek
 * saglayici bilgisi gelene kadar UCTAN UCA akisi (istek -> guard
 * kontrolleri -> "saglayici" cevabi -> launchUrl) canli gorebilmesi
 * icin, MOCK_MODE=true oldugunda (.env.example varsayilani budur)
 * her adaptor GERCEK HTTP cagrisini atlayip sahte ama gercekci bir
 * yanit uretir. MOCK_MODE=false yapip gercek BASE_URL/kimlik
 * bilgilerini .env'e yazdiginizda kod hicbir degisiklik gerektirmeden
 * gercek saglayiciya gider — bkz. her provider dosyasindaki kullanim.
 */
const MOCK_MODE = String(process.env.MOCK_MODE || "true").toLowerCase() !== "false";

function buildMockLaunchUrl(provider, user, gameCode) {
	const params = new URLSearchParams({
		mock: "1",
		provider,
		user: user.id,
		game: gameCode || "demo-game",
		ts: String(Date.now()),
	});
	return `https://mock-${provider}.example.com/launch?${params.toString()}`;
}

module.exports = { MOCK_MODE, buildMockLaunchUrl };
