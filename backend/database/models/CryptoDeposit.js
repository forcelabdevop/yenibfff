const mongoose = require('mongoose');

/**
 * Zincir uzerinde tespit edilen yatirma islemi (kendi HD altyapimiz).
 *
 * NEDEN AYRI MODEL: Mevcut `CryptoTransaction` modeli saglayici tabanli eski
 * kasa akisina ait ve admin paneli (controllers/admin/cashier, admin/user) ile
 * rain ozelligi tarafindan `state` / `data.providerId` alanlariyla okunuyor.
 * O semayi degistirmek bu ekranlari bozardi; on-chain yatirmalar bu ayri
 * koleksiyonda tutulur.
 *
 * Tutarlar en kucuk birimde (SUN, 6 hane) TAM SAYI olarak saklanir.
 * Float kullanilmaz — yuvarlama hatasi dogrudan para farki demektir.
 */
const cryptoDepositSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },

	chain: { type: String, required: true, default: 'TRON' },

	/** config/crypto.js CURRENCIES anahtari (or. 'USDT_TRC20', 'TRX'). */
	currency: { type: String, required: true },

	/** Paranin geldigi kendi adresimiz. */
	address: { type: String, required: true },

	/** Zincir islem kimligi. Mukerrer krediye karsi unique. */
	txHash: { type: String, required: true },

	/** En kucuk birimde tam sayi (or. 1 USDT = 1000000). */
	amountUnits: { type: Number, required: true },

	/** Zincirdeki ondalik hane sayisi — gosterim icin. */
	decimals: { type: Number, required: true, default: 6 },

	blockNumber: { type: Number, required: true },

	confirmations: { type: Number, default: 0 },

	/**
	 * pending  → tespit edildi, onay esigi altinda (kredi YOK)
	 * credited → bakiyeye eklendi (nihai durum)
	 */
	status: { type: String, enum: ['pending', 'credited'], default: 'pending' },

	/** Bakiyeye eklenen tutar (kullanicinin coin bakiyesi cinsinden). */
	creditedAmount: { type: Number, default: 0 },

	creditedAt: { type: Date, default: null },

	createdAt: { type: Date, default: Date.now },
});

/**
 * MUKERRER KREDIYE KARSI SON SAVUNMA HATTI.
 * PM2 cluster'da 4 instance calisiyor. Leader-election kilidi herhangi bir
 * sebeple basarisiz olursa bile bu index ayni transferin ikinci kez
 * yazilmasini veritabani seviyesinde engeller.
 *
 * Neden yalniz txHash DEGIL: tek bir islem birden fazla Transfer olayi
 * icerebilir (or. bir sozlesme ayni tx icinde iki farkli kullanicimizin
 * adresine gonderim yapar). Yalniz txHash unique olsaydi ikinci kullanici
 * hicbir zaman kredi alamazdi. Adres + para birimi ile birlestirerek hem
 * mukerrer kredi engellenir hem de bu senaryo dogru calisir.
 */
cryptoDepositSchema.index(
	{ txHash: 1, address: 1, currency: 1 },
	{ unique: true },
);

cryptoDepositSchema.index({ user: 1, createdAt: -1 });
cryptoDepositSchema.index({ status: 1, blockNumber: 1 });
cryptoDepositSchema.index({ address: 1 });

module.exports = mongoose.model('CryptoDeposit', cryptoDepositSchema);
