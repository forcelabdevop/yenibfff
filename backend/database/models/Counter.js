const mongoose = require('mongoose');

/**
 * Atomik sayac. HD turetme indeksi tahsisi icin kullanilir.
 *
 * KRITIK: Ayni indeksin iki kullaniciya verilmesi, iki kullanicinin AYNI
 * yatirma adresini paylasmasi demektir — biri otekinin parasini alir.
 * Bu yuzden indeks daima `findOneAndUpdate` + `$inc` ile tek atomik
 * islemde alinir; "oku sonra yaz" kalibi ASLA kullanilmaz.
 */
const counterSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	seq: { type: Number, default: -1 },
});

/**
 * Bir sonraki indeksi atomik olarak alir. 0'dan baslar.
 * @param {string} key Sayac adi (or. 'tron:derivationIndex')
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<number>}
 */
counterSchema.statics.next = async function next(key, session) {
	const doc = await this.findOneAndUpdate(
		{ _id: key },
		{ $inc: { seq: 1 } },
		{ new: true, upsert: true, session, setDefaultsOnInsert: true },
	).lean();
	return doc.seq;
};

/**
 * Genel amacli tam sayi kaydetme (or. EVM izleyicisinin "son taranan blok"
 * cursoru). `next()` ile aynı koleksiyonu paylasir ama farkli bir anahtar
 * ad-alani (key prefix) kullanilarak cakisma onlenmelidir (or.
 * 'evm:lastScannedBlock:BEP20').
 * @param {string} key
 * @param {number} value
 */
counterSchema.statics.setValue = async function setValue(key, value) {
	await this.findOneAndUpdate(
		{ _id: key },
		{ $set: { seq: value } },
		{ upsert: true },
	);
};

/**
 * @param {string} key
 * @param {number} defaultValue Kayit yoksa donulecek deger.
 * @returns {Promise<number>}
 */
counterSchema.statics.getValue = async function getValue(key, defaultValue = 0) {
	const doc = await this.findOne({ _id: key }).lean();
	return doc ? doc.seq : defaultValue;
};

module.exports = mongoose.model('Counter', counterSchema);
