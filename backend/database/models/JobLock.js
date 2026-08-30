const mongoose = require('mongoose');

/**
 * Dagitik is kilidi (leader election).
 *
 * NEDEN GEREKLI: ecosystem.config.js PM2'yi cluster modda 4 instance ile
 * calistiriyor ve index.js'teki cron'larda instance korumasi yok. Yatirma
 * izleyicisi korumasiz calisirsa ayni yatirim 4 kez kredi edilir.
 *
 * Calisma sekli: `acquire` tek atomik upsert ile kilidi almaya calisir.
 * Yalniz bir instance basarili olur. Kilit `expiresAt` ile suresizdir degildir;
 * kilidi tutan instance cokerse sure dolunca baskasi devralabilir.
 */
const jobLockSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	owner: { type: String, required: true },
	expiresAt: { type: Date, required: true },
	acquiredAt: { type: Date, default: Date.now },
});

/**
 * Kilidi almaya calisir.
 * @param {string} key Is adi (or. 'tron:depositScanner')
 * @param {string} owner Bu instance'i tanimlayan benzersiz kimlik
 * @param {number} ttlMs Kilit suresi (ms)
 * @returns {Promise<boolean>} Kilit alindiysa true
 */
jobLockSchema.statics.acquire = async function acquire(key, owner, ttlMs) {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlMs);
	try {
		// Yalniz kilit yoksa VEYA suresi dolmussa yazar. Iki kosul da tek
		// atomik islemde degerlendirilir; yaris durumu olusmaz.
		const res = await this.findOneAndUpdate(
			{ _id: key, $or: [{ expiresAt: { $lte: now } }, { owner }] },
			{ $set: { owner, expiresAt, acquiredAt: now } },
			{ new: true, upsert: true },
		).lean();
		return Boolean(res);
	} catch (err) {
		// Duplicate key = baska bir instance ayni anda kilidi aldi. Beklenen durum.
		if (err && err.code === 11000) return false;
		throw err;
	}
};

/** Kilidi uzatir (uzun suren tarama sirasinda dusmemesi icin). */
jobLockSchema.statics.renew = async function renew(key, owner, ttlMs) {
	const res = await this.updateOne(
		{ _id: key, owner },
		{ $set: { expiresAt: new Date(Date.now() + ttlMs) } },
	);
	return res.modifiedCount > 0;
};

/** Kilidi birakir. Yalniz sahibi birakabilir. */
jobLockSchema.statics.release = async function release(key, owner) {
	await this.deleteOne({ _id: key, owner });
};

module.exports = mongoose.model('JobLock', jobLockSchema);
