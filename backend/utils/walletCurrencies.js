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
 * Tek bir para birimi kaydi uretir.
 *
 * Arayuz sozlesmesi: `networks[]` her zaman `label` tasir. `name` ve `id`
 * eski surumlerle uyum icin korunur.
 */
const buildCurrencyEntry = ({ code, chain, type, balance }, { prices, depositable } = {}) => {
	const normalized = normalizeCode(code);
	const market = (prices && prices.get(normalized)) || { price: 0, fee: 0 };
	const icon = coinIconPath(normalized);

	return {
		code: normalized,
		name: normalized,
		chain,
		type,
		network: chain,
		networks: [{ id: type, name: chain, label: networkLabel(chain, type), icon }],
		balance: Number(balance) || 0,
		usd: market.price,
		fee: market.fee,
		precision: 8,
		fiat: false,
		depositable: depositable ? depositable.has(normalized) : false,
		icon,
	};
};

/**
 * Kullanicinin cuzdanlarindan + yatirilabilir kripto listesinden tam listeyi kurar.
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

	const data = (wallets || []).map((wallet) =>
		buildCurrencyEntry(
			{
				code: wallet.coinType,
				chain: wallet.chain,
				type: wallet.type,
				balance: wallet.balance,
			},
			{ prices, depositable }
		)
	);

	const known = new Set(data.map((entry) => entry.code));
	for (const currency of depositCurrencies) {
		const code = normalizeCode(currency.walletCode);
		if (known.has(code)) continue;
		known.add(code);
		data.push(
			buildCurrencyEntry(
				{ code, chain: currency.chain, type: currency.type, balance: 0 },
				{ prices, depositable }
			)
		);
	}

	return data;
};

module.exports = {
	normalizeCode,
	coinIconPath,
	networkLabel,
	buildCurrencyEntry,
	buildCurrencyList,
};
