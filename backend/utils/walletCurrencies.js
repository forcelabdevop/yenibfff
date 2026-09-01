/**
 * Yatirma ekraninin para birimi / ag listesini uretir.
 *
 * Bu mantik daha once routes/wallet.js icinde gomuluydu; disari alindi cunku
 * arayuz sozlesmesi (ozellikle `networks[].label`) sessizce bozulup yatirma
 * ekranindaki ag kutusunun HEP bos gorunmesine yol acmisti. Ayri modul olunca
 * testler gercek fonksiyonu cagirabiliyor.
 */

const { listCurrencies } = require('../config/crypto');

const normalizeCode = (value) => String(value || '').trim().toUpperCase();

// Yatirma altyapisi henuz hazir olmasa da cüzdan secicisinde görünmesi gereken
// temel varliklar. Desteklenmeyenler UI'da pasif / "Yakinda" olarak sunulur.
const DISPLAY_CURRENCY_CATALOG = ['BTC', 'ETH', 'BNB', 'POL', 'USDT', 'USDC', 'BFG'];

/**
 * Coin ikonunun genel (public) yolu.
 * Dosya `frontend/public/casino-ui/assets/` altinda bulunmalidir; eksikse
 * arayuzde kirik gorsel cikar.
 */
const coinIconPath = (code) =>
	`/casino-ui/assets/coin-${String(code).toLowerCase()}.png`;

/**
 * Kullaniciya gosterilecek ag adi.
 *
 * ONEMLI: Yanlis agda gonderilen kripto GERI ALINAMAZ. Bu yuzden etiket
 * yalnizca zinciri ("TRON") degil, token standardini da ("TRC-20") icermeli;
 * kullanici gonderim agini bu metne bakarak seciyor.
 */
const networkLabel = (chain, type) => {
	const chainName = String(chain || '').toUpperCase();
	const standard = String(type || '').toUpperCase();
	if (!standard || standard === 'NATIVE') return chainName;
	return `${chainName} (${standard})`;
};

/**
 * Bir (chain, type) ciftinden ag kimligi ve ikonuyla birlikte bir `networks[]`
 * girdisi uretir. `id` alani genelde `type` ile ayni tutulur; deposit.js
 * route'unun kabul ettigi TAM para birimi kodu (or. "USDT_BEP20") burada
 * `currencyCode` alaninda ayrica tasinir — arayuz Network secildiginde bu
 * kodu /crypto/deposit/address?currency=... sorgusuna gonderir.
 */
const buildNetworkEntry = (chain, type, currencyCode, coinCode) => ({
	id: type,
	name: chain,
	label: networkLabel(chain, type),
	icon: coinIconPath(coinCode),
	currencyCode,
});

/**
 * Kullanicinin cuzdanlarindan + yatirilabilir kripto listesinden tam listeyi kurar.
 *
 * ONEMLI (coklu-ag destegi): Ayni kullaniciya gosterilen kod (or. "USDT")
 * ARTIK birden fazla zincirde (TRC20/BEP20/POLYGON) var olabilir. Bunlar
 * TEK bir `currencies[]` girdisinde birlestirilir; `balance` TUM aglardaki
 * bakiyelerin TOPLAMIDIR (aym USDT, farkli zincirlerde tutuluyor — kullanici
 * gozunde tek bir varlik), `networks[]` ise kullanicinin Network secicisinde
 * gorecegi TUM secenekleri (yatirilabilir olsun/olmasin, mevcut cuzdani
 * olsun/olmasin) icerir.
 *
 * Yatirilabilir kripto birimleri, kullanicinin HENUZ cuzdani olmasa bile
 * eklenir: cuzdan ilk yatirim kredi edildiginde olusuyor, aksi halde kullanici
 * USDT'yi hic goremeden para yatiramazdi (tavuk-yumurta problemi).
 */
const buildCurrencyList = (wallets, prices) => {
	const depositCurrencies = listCurrencies();
	const depositable = new Set(
		depositCurrencies.map((currency) => normalizeCode(currency.walletCode))
	);

	/** normalizedCode -> { balance, networksByKey: Map<chain+type, entry> } */
	const groups = new Map();

	const ensureGroup = (code) => {
		if (!groups.has(code)) {
			groups.set(code, { balance: 0, networksByKey: new Map() });
		}
		return groups.get(code);
	};

	for (const wallet of wallets || []) {
		const code = normalizeCode(wallet.coinType);
		const group = ensureGroup(code);
		group.balance += Number(wallet.balance) || 0;
		const key = `${wallet.chain}|${wallet.type}`;
		if (!group.networksByKey.has(key)) {
			// Var olan bir cuzdanin ag girdisi icin, eslesen deposit para birimi
			// koduna asagida depositCurrencies dongusunde tekrar bakip
			// currencyCode alanini tamamlayacagiz (henuz bilinmiyorsa null).
			group.networksByKey.set(key, buildNetworkEntry(wallet.chain, wallet.type, null, code));
		}
	}

	for (const currency of depositCurrencies) {
		const code = normalizeCode(currency.walletCode);
		const group = ensureGroup(code);
		const key = `${currency.chain}|${currency.type}`;
		// Yatirilabilir bir ag her zaman TAM kodu (currencyCode) tasimalidir —
		// var olan bir cuzdan girdisi bulunsa bile bu deger tamamlanir/uzerine yazilir.
		group.networksByKey.set(key, buildNetworkEntry(currency.chain, currency.type, currency.code, code));
	}

	// Kullanici bu varliklarda henuz wallet kaydina sahip olmasa bile liste
	// eksilmemeli. Ag/adres destegi gelene kadar networks bos ve depositable false.
	for (const code of DISPLAY_CURRENCY_CATALOG) ensureGroup(code);

	const data = [];
	for (const [code, group] of groups) {
		const market = (prices && prices.get(code)) || { price: 0, fee: 0 };
		const icon = coinIconPath(code);
		const networks = [...group.networksByKey.values()];
		const primary = networks[0] || {};

		data.push({
			code,
			name: code,
			chain: primary.name,
			type: primary.id,
			network: primary.name,
			networks,
			balance: group.balance,
			usd: market.price,
			fee: market.fee,
			precision: 8,
			fiat: false,
			depositable: depositable.has(code),
			status: depositable.has(code) ? 'available' : 'coming-soon',
			icon,
		});
	}

	return data;
};

module.exports = {
	normalizeCode,
	coinIconPath,
	networkLabel,
	buildNetworkEntry,
	buildCurrencyList,
};
