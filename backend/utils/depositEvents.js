const { createAdminNotification } = require("./adminNotification");

/**
 * TÜM ödeme sağlayıcıların (GalaxyPay, MeelDev, FluxKripto, xPayments, Pix)
 * yatırım TALEBİ oluşturduğu (transaction "processing"/"pending" durumuna
 * geçtiği) an tek çağırdığı ortak nokta. Sağlayıcının ödemeyi gerçekten
 * onaylamasını (webhook/callback) BEKLEMEZ — çekim talebinde olduğu gibi
 * kullanıcı işlemi başlattığı anda admin paneline anında bildirim + ses
 * düşürür. Bu sayede admin, ödeme sağlayıcısının callback'i bu ortama hiç
 * ulaşmasa/gecikse bile talebi anında görür.
 *
 * Ana yatırım akışını ASLA bloklamaz veya başarısız etmez; tüm hatalar
 * yutulup sadece loglanır (fire-and-forget).
 *
 * @param {object} user - En az `_id` ve `username` içeren User nesnesi.
 * @param {number} amount - Talep edilen yatırım tutarı (₺).
 * @param {string} provider - Sağlayıcı adı (örn. "GalaxyPay", "MeelDev").
 */
const notifyDepositRequestCreated = (user, amount, provider) => {
	const userId = user?._id;
	const username = user?.username || "Kullanıcı";

	try {
		createAdminNotification(
			"deposit",
			"Yeni Yatırım Talebi",
			`${username} kullanıcısı ${amount} ₺ tutarında ${provider} ile yatırım talebi oluşturdu.`,
			"/apps/finance/deposit",
			{ provider, amount, username, userId, stage: "requested" }
		);
	} catch (err) {
		console.error(
			"❌ notifyDepositRequestCreated → admin bildirimi hatası:",
			err.message
		);
	}
};

/**
 * TÜM ödeme sağlayıcı yatırım onay noktalarının (GalaxyPay, MeelDev,
 * ForcelabFinance, FluxKripto, xPayments, Pix, Oxapay/Kripto) tek çağırdığı
 * ortak nokta. Kullanıcıya GERÇEK bir yatırım tutarı kredilendiğinde
 * (bakiye güncellemesinden SONRA) çağrılmalıdır. İki şey yapar:
 *
 *  1) Admin paneline "Yatırım Onaylandı" bildirimi gönderir (socket +
 *     veritabanı kaydı + admin panelinde ses — bkz. useAdminNotifications.js).
 *     Bu, `notifyDepositRequestCreated` ile aynı işlemin İKİNCİ (onay)
 *     bildirimidir — admin talebi anında görür, onayı da ayrıca görür.
 *  2) Kullanıcının hâlâ tamamlanmamış bir Deneme Bonusu çevrim kilidi varsa
 *     GÜVENLİK NEDENİYLE anında sonlandırır (bkz. trialBonusService.js →
 *     handleRealDepositCredited) — kullanıcı bir dahaki oyun açılışında
 *     normal (varsayılan) Betinovi agent'ına döner.
 *  3) Casino ödül motoruna `deposit` olayını yayınlar (bkz.
 *     casinoRewardEngine.js) — yatırım hedefli görevlerin ilerlemesini artırır
 *     ve kullanıcının seçtiği Special Bonus'u uygunluk kontrolünden geçirip
 *     ödülü (ör. free spin) teslim eder.
 *
 * Ana yatırım/callback akışını ASLA bloklamaz veya başarısız etmez; tüm
 * hatalar yutulup sadece loglanır (fire-and-forget).
 *
 * @param {object} user - En az `_id` ve `username` içeren User nesnesi.
 * @param {number} amount - Yatırım tutarı (₺, kullanıcının fiat cinsinden).
 * @param {string} provider - Sağlayıcı adı (örn. "GalaxyPay", "MeelDev").
 * @param {object} [options] - `reference` (sağlayıcı işlem kimliği) ve `currency`.
 */
const notifyRealDepositCredited = (user, amount, provider, options = {}) => {
	const userId = user?._id;
	const username = user?.username || "Kullanıcı";

	try {
		createAdminNotification(
			"deposit",
			"Yatırım Onaylandı",
			`${username} kullanıcısının ${amount} ₺ tutarındaki ${provider} yatırımı onaylandı ve bakiyesine eklendi.`,
			"/apps/finance/deposit",
			{ provider, amount, username, userId, stage: "credited" }
		);
	} catch (err) {
		console.error(
			"❌ notifyRealDepositCredited → admin bildirimi hatası:",
			err.message
		);
	}

	try {
		require("../services/trialBonusService")
			.handleRealDepositCredited(userId)
			.catch((err) =>
				console.error(
					"❌ notifyRealDepositCredited → deneme bonusu kilidi sonlandırma hatası:",
					err.message
				)
			);
	} catch (err) {
		console.error(
			"❌ notifyRealDepositCredited → deneme bonusu kilidi sonlandırma kurulamadı:",
			err.message
		);
	}

	// 🎁 Casino ödül motoru: mission ilerlemesi + special bonus aktivasyonu.
	try {
		require("../services/casinoRewardEngine").emitDeposit({
			userId,
			amount: Number(amount) || 0,
			currency: options.currency || "TRY",
			reference:
				options.reference ||
				`${String(provider || "deposit").toLowerCase()}:${userId}:${Number(amount) || 0}:${Date.now()}`,
		});
	} catch (err) {
		console.error(
			"❌ notifyRealDepositCredited → casino ödül motoru olayı yayınlanamadı:",
			err.message
		);
	}
};

module.exports = { notifyDepositRequestCreated, notifyRealDepositCredited };
