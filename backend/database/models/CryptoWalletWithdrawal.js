const mongoose = require('mongoose');

/**
 * Admin panelinden, toplama (sweep) cuzdanindan (HD index 0) DISARIYA —
 * platformun kontrolu disindaki bir adrese — yapilan kripto cekim kaydi.
 *
 * NEDEN AYRI MODEL: CryptoSweep kullanici adreslerinden toplama adresine
 * yapilan (platform ICI) transferleri kaydeder. Bu model ise toplama
 * adresinden platform DISINA (borsa, kişisel cuzdan vb.) yapilan, bir admin
 * tarafindan bilinçli olarak tetiklenen transferleri kaydeder. Ikisi
 * karistirilmamali: biri otomatik/ic, digeri manuel/dis hareket.
 */
const cryptoWalletWithdrawalSchema = new mongoose.Schema({
	/** Cekimi tetikleyen admin kullanici. */
	admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

	/** Gonderen (toplama) adres — bilgi/dogrulama amacli, her zaman index 0. */
	fromAddress: { type: String, required: true },

	/** Alici adres (kullanicinin kendi/harici cuzdani). */
	toAddress: { type: String, required: true },

	/** config/crypto.js CURRENCIES anahtari (or. 'USDT_TRC20', 'TRX'). */
	currency: { type: String, required: true },

	/** En kucuk birimde tam sayi. */
	amountUnits: { type: Number, required: true },

	/**
	 * pending   → siraya alindi, zincire henuz yayinlanmadi
	 * completed → zincire yazildi ve basarili
	 * failed    → deneme basarisiz oldu
	 */
	status: {
		type: String,
		enum: ['pending', 'completed', 'failed'],
		default: 'pending',
	},

	txHash: { type: String, default: null },
	lastError: { type: String, default: null },

	createdAt: { type: Date, default: Date.now },
	completedAt: { type: Date, default: null },
});

cryptoWalletWithdrawalSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
	'CryptoWalletWithdrawal',
	cryptoWalletWithdrawalSchema,
);
