const mongoose = require('mongoose');

/**
 * Kullanici adresinden toplama (sweep) adresine yapilan transfer kaydi.
 *
 * NEDEN AYRI MODEL: CryptoDeposit "paranin geldigini" kaydeder, CryptoSweep
 * "paranin toplama adresine tasindigini" kaydeder. Ikisi farkli olaylardir —
 * bir yatirim birden fazla sweep denemesi gorebilir (once gas gonderimi
 * basarisiz olabilir, sonra tekrar denenir).
 */
const cryptoSweepSchema = new mongoose.Schema({
	/** Sweep edilen kullanici adresi. */
	fromAddress: { type: String, required: true },

	/** m/44'/195'/0'/0/{derivationIndex} — imzalama icin gerekli. */
	derivationIndex: { type: Number, required: true },

	/** Toplama/ana adres (index 0). */
	toAddress: { type: String, required: true },

	/** config/crypto.js CURRENCIES anahtari (or. 'USDT_TRC20', 'TRX'). */
	currency: { type: String, required: true },

	/** En kucuk birimde tam sayi. */
	amountUnits: { type: Number, required: true },

	/**
	 * pending    → siraya alindi, henuz gonderilmedi
	 * gas_sent   → USDT sweep'i icin gerekli TRX gas gonderildi, ana transfer bekliyor
	 * completed  → ana transfer zincire yazildi ve basarili
	 * failed     → deneme basarisiz oldu (retriable)
	 */
	status: {
		type: String,
		enum: ['pending', 'gas_sent', 'completed', 'failed'],
		default: 'pending',
	},

	/** Gas (TRX) gonderim islem hash'i — yalniz USDT sweep'lerinde kullanilir. */
	gasTxHash: { type: String, default: null },

	/** Ana transfer islem hash'i. */
	txHash: { type: String, default: null },

	lastError: { type: String, default: null },

	attempts: { type: Number, default: 0 },

	createdAt: { type: Date, default: Date.now },
	completedAt: { type: Date, default: null },
});

cryptoSweepSchema.index({ status: 1, createdAt: 1 });
cryptoSweepSchema.index({ fromAddress: 1, currency: 1, createdAt: -1 });

module.exports = mongoose.model('CryptoSweep', cryptoSweepSchema);
