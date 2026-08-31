/**
 * Migration: CryptoAddress.address uzerindeki TEKIL (unique) index'i kaldirir
 * ve yerine (address, currency) bilesik unique index'ini ekler.
 *
 * Neden: Ayni kullanicinin TRX ve USDT_TRC20 kayitlari BILEREK ayni adresi
 * paylasir (bkz. cryptoAddressService.js). Eski `address_1` unique index'i bu
 * paylasima izin vermiyordu ve ikinci para biriminin adres kaydi olusturulurken
 * E11000 hatasi firlatiyordu.
 *
 * Guvenlik: Gercek kisit `(chain, derivationIndex)` unique index'i ile zaten
 * saglaniyor — adres, derivationIndex'ten deterministik turetildigi icin iki
 * FARKLI kullanici asla ayni adresi alamaz. Bu migration o index'e dokunmaz.
 *
 * Kullanim: node scripts/migrateCryptoAddressIndex.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
	await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
	const collection = mongoose.connection.db.collection('cryptoaddresses');

	const indexes = await collection.indexes();
	console.log('Mevcut index\'ler:', indexes.map((i) => i.name));

	const oldIndex = indexes.find(
		(i) => i.name === 'address_1' || (i.key && Object.keys(i.key).join(',') === 'address' && i.unique)
	);

	if (oldIndex) {
		console.log(`Eski unique index kaldiriliyor: ${oldIndex.name}`);
		await collection.dropIndex(oldIndex.name);
	} else {
		console.log('Eski tekil "address" unique index bulunamadi, atlaniyor.');
	}

	const hasNewIndex = (await collection.indexes()).some(
		(i) => i.key && i.key.address === 1 && i.key.currency === 1 && i.unique
	);

	if (!hasNewIndex) {
		console.log('Yeni bilesik index olusturuluyor: (address, currency) unique');
		await collection.createIndex({ address: 1, currency: 1 }, { unique: true });
	} else {
		console.log('Yeni bilesik index zaten mevcut, atlaniyor.');
	}

	console.log('Migration tamamlandi. Guncel index\'ler:');
	console.log((await collection.indexes()).map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })));

	await mongoose.disconnect();
	process.exit(0);
}

main().catch((err) => {
	console.error('Migration HATA:', err.message);
	process.exit(1);
});
