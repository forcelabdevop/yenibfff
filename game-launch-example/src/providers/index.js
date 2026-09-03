/**
 * Provider registry — yeni bir saglayici eklemek istediginizde
 * TEK yapmaniz gereken sey: bu dosyaya bir satir eklemek.
 *
 * Her adapter, ayni sozlesmeyi (contract) uygular:
 *   launchGame(user, params) -> Promise<{ launchUrl, provider }>
 *
 * Bu sayede routes/launch.js (asagida) hangi saglayicinin nasil
 * calistigini BILMEK ZORUNDA DEGILDIR — sadece dogru adapter'i
 * secip cagirir. Gercek projede bu tam olarak yok; her provider'in
 * kendi router dosyasi (betinoviApi.js, drakonApi.js, ...) vardir ve
 * frontend hangi endpoint'e istek atacagini bilmek zorundadir. Bu
 * ornekteki registry deseni, TEK bir "/api/games/launch" endpoint'i
 * ile ayni sonucu daha temiz elde etmenin bir yolunu gosterir.
 */
const betinovi = require("./betinovi");
const drakon = require("./drakon");
const nexus = require("./nexus");
const poker = require("./poker");
const betcolabs = require("./betcolabs");

const PROVIDERS = {
	betinovi,
	drakon,
	nexus,
	poker,
	betcolabs,
};

function getProviderAdapter(providerKey) {
	const adapter = PROVIDERS[providerKey];
	if (!adapter) {
		throw new Error(`Bilinmeyen saglayici: ${providerKey}`);
	}
	return adapter;
}

module.exports = { getProviderAdapter, PROVIDERS };
