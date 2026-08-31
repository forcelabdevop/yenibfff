/**
 * Tek seferlik migration: gecmiste kullanici basina PARA BIRIMI basina ayri
 * adres uretilmisti (TRX ve USDT_TRC20 icin farkli HD indeksi/adres). Bu
 * script her kullanicinin TRON zincirindeki tum CryptoAddress kayitlarini
 * TEK bir adrese (en dusuk derivationIndex'e sahip olana) sabitler.
 *
 * Neden guvenli:
 *  - TRON'da bir adres/hesap ayni anda hem TRX hem herhangi bir TRC20 token
 *    (USDT dahil) bakiyesi tutabilir; para birimi basina ayri adres teknik
 *    olarak gereksizdir.
 *  - cryptoDepositWatcher.js zaten HER adresi TUM desteklenen para birimleri
 *    icin tarar (adresin `currency` alanina bakmadan), dolayisiyla adres
 *    degisikligi yatirim tespitini bozmaz.
 *  - Script calistirilmadan once hicbir gercek yatirim/tx olmadigi
 *    dogrulanmalidir (cryptodeposits koleksiyonu bos olmali). Aksi halde
 *    dusurulen adrese ait gecmis yatirimlarin adres referansi tutarsizlasir.
 *
 * Kullanim:
 *   node scripts/consolidateCryptoAddresses.js            # gercekten uygular
 *   node scripts/consolidateCryptoAddresses.js --dry-run   # sadece raporlar
 */
require('dotenv').config();
const mongoose = require('mongoose');

const CryptoAddress = require('../database/models/CryptoAddress');
const CryptoDeposit = require('../database/models/CryptoDeposit');

const dryRun = process.argv.includes('--dry-run');

async function main() {
	const uri = process.env.MONGODB_CONNECTION_STRING || process.env.DATABASE_URI;
	if (!uri) {
		console.error('MONGODB_CONNECTION_STRING / DATABASE_URI tanimli degil.');
		process.exit(1);
	}

	await mongoose.connect(uri);
	console.log('[consolidate] DB baglantisi kuruldu.');

	const depositCount = await CryptoDeposit.countDocuments({});
	if (depositCount > 0) {
		console.error(
			`[consolidate] DURDURULDU: cryptodeposits koleksiyonunda ${depositCount} kayit var. ` +
				'Gercek yatirim referansi olan adresleri degistirmek guvenli degil. Elle inceleyin.',
		);
		process.exit(1);
	}

	const groups = await CryptoAddress.aggregate([
		{ $match: { chain: 'TRON' } },
		{
			$group: {
				_id: '$user',
				docs: {
					$push: {
						_id: '$_id',
						currency: '$currency',
						address: '$address',
						derivationIndex: '$derivationIndex',
					},
				},
				distinctAddresses: { $addToSet: '$address' },
			},
		},
		{ $match: { $expr: { $gt: [{ $size: '$distinctAddresses' }, 1] } } },
	]);

	console.log(
		`[consolidate] Birden fazla farkli adrese sahip kullanici sayisi: ${groups.length}.`,
	);

	let updated = 0;
	for (const group of groups) {
		const canonical = group.docs.reduce((min, doc) =>
			doc.derivationIndex < min.derivationIndex ? doc : min,
		);

		const toFix = group.docs.filter((doc) => doc.address !== canonical.address);

		for (const doc of toFix) {
			console.log(
				`[consolidate] user=${group._id} currency=${doc.currency}: ` +
					`${doc.address} (idx ${doc.derivationIndex}) -> ${canonical.address} (idx ${canonical.derivationIndex})`,
			);
			if (!dryRun) {
				await CryptoAddress.updateOne(
					{ _id: doc._id },
					{ $set: { address: canonical.address, derivationIndex: canonical.derivationIndex } },
				);
				updated += 1;
			}
		}
	}

	console.log(
		`[consolidate] Tamamlandi. ${dryRun ? 'DRY-RUN — hicbir yazma yapilmadi.' : `${updated} kayit guncellendi.`}`,
	);

	await mongoose.disconnect();
	process.exit(0);
}

main().catch((error) => {
	console.error('[consolidate] beklenmeyen hata:', error);
	process.exit(1);
});
