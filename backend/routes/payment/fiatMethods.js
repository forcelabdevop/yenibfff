const express = require("express");
const router = express.Router();

const SiteSettings = require("../../database/models/SiteSettings");

/**
 * Cash (fiat) yatırma sekmesinde seçilebilecek para birimlerini + aktif
 * ödeme sağlayıcılarını döndürür.
 *
 * ÖNEMLİ: Bu uç dış API'lere hiç istek atmaz — sadece SiteSettings içindeki
 * `isActive` bayraklarını okur. Böylece sağlayıcı API'si yavaş/kapalı olsa
 * bile Cash sekmesi para birimi listesi anında yüklenir; asıl sağlayıcı
 * çağrısı (methods/prepare/deposit) kullanıcı bir yöntem seçtiğinde yapılır.
 *
 * GalaxyPay kasıtlı olarak dahil edilmez (bkz. v0_plans/sharp-technique.md —
 * kod tabanı bu kapsamda ele alınmayacak kadar dağınık).
 */
const PROVIDERS = [
	{ key: "forcelabFinance", slug: "forcelab-finance" },
	{ key: "meelDev", slug: "meeldev" },
	{ key: "fluxKripto", slug: "fluxkripto" },
	{ key: "xPayments", slug: "xpayments" },
];

router.get("/fiat-methods", async (req, res, next) => {
	try {
		const siteSettings = (await SiteSettings.findOne().lean()) || {};

		const providers = PROVIDERS.reduce((acc, { key, slug }) => {
			const settings = siteSettings[key];
			if (!settings || !settings.isActive) return acc;
			acc.push({
				slug,
				name: settings.name || slug,
				logo: settings.logo || "",
				currency: String(settings.currency || "TRY").toUpperCase(),
				minAmount: Number(settings.minAmount) || 0,
				maxAmount: Number(settings.maxAmount) || 0,
			});
			return acc;
		}, []);

		// Cash sekmesindeki para birimi seçici, yukarıda listelenen aktif
		// sağlayıcıların benzersiz `currency` alanlarından türetilir — sabit/
		// yanlış bir liste asla gösterilmez. Hiçbir sağlayıcı aktif değilse
		// bu liste boş döner ve arayüz "yapılandırılmamış" uyarısı gösterir.
		const seen = new Set();
		const currencies = [];
		for (const provider of providers) {
			if (seen.has(provider.currency)) continue;
			seen.add(provider.currency);
			currencies.push({ code: provider.currency, name: provider.currency });
		}

		res.json({ success: true, data: { currencies, providers } });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
