const crypto = require('node:crypto');

const CryptoAddress = require('../database/models/CryptoAddress');
const CryptoDeposit = require('../database/models/CryptoDeposit');
const JobLock = require('../database/models/JobLock');
const User = require('../database/models/User');

const hdWallet = require('../utils/crypto/hdWallet');
const tronClient = require('../utils/crypto/tronClient');
const {
	CURRENCIES,
	CONFIRMATIONS_REQUIRED,
	listCurrencies,
} = require('../config/crypto');

/**
 * TRON yatirma izleyicisi.
 *
 * TASARIM NOTLARI
 *  - PM2 cluster modda 4 instance calisiyor (ecosystem.config.js) ve
 *    index.js'teki cron'larda instance korumasi yok. Bu yuzden her tur
 *    JobLock ile leader-election yapar; ayni anda yalniz bir instance tarar.
 *  - Kredi verme islemi idempotenttir: koruma, bakiyeyle AYNI belgede
 *    ($ne + $inc tek atomik islem) oldugu icin yeniden denemeler guvenlidir.
 *  - Onay esiginin altindaki hicbir islem kredi EDILMEZ (reorg korumasi).
 */

const LOCK_KEY = 'tron:depositScanner';
const LOCK_TTL_MS = 120000;
const OWNER = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

/**
 * Her turda taranacak adres sayisi — TronGrid hiz sinirini asmamak icin.
 *
 * DIKKAT: Eski varsayilan (25) artik kullanici sayisiyla (6842 kullanici x
 * 2 TRON adresi = 13684 adres) olceklenmiyordu. "En eski taranan once"
 * kuyruguyla 25'lik turlarda TAM bir tur 13684/25 ≈ 548 dakika (~9 saat)
 * suruyordu — yani yeni bir yatirim, kotu sanslıysa taranmadan once
 * SAATLERCE beklemek zorunda kaliyordu (bkz. 02.09.2026 vakasi, 5 USDT
 * yatirimi gunlerce/saatlerce gorunmedi). TRON_API_KEY artik tanimli
 * oldugundan (TronGrid hiz siniri cok daha yuksek) batch boyutu guvenle
 * artirildi; 150 adres x 2 para birimi (TRX+USDT) x 120ms araliksa ~36
 * saniye/tur surer (1 dakikalik cron periyoduna sigar) ve tam kuyruk
 * turu ~91 dakikaya duser.
 */
const ADDRESS_BATCH = Number(process.env.TRON_SCAN_BATCH || 150);

/** Zincir sorgulari arasi bekleme (ms). */
const REQUEST_SPACING_MS = Number(process.env.TRON_SCAN_SPACING_MS || 120);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Yeni gelen transferleri tespit eder ve `pending` olarak kaydeder.
 * Kredi VERMEZ — kredi yalnizca onay esigi asildiginda verilir.
 */
async function discoverDeposits() {
	// En uzun suredir taranmayan adresler once. Kullanici sayisi artsa da
	// hicbir adres ac kalmaz.
	//
	// DIKKAT: chain: 'TRON' filtresi KRITIK. Bu filtre olmadan CryptoAddress
	// koleksiyonundaki TUM zincirlerin (ETHEREUM/BNB/POLYGON dahil, toplam
	// binlerce kayit) adresleri bu TRON taramasina giriyor ve global
	// lastScannedAt siralamasinda TRON adresleriyle ayni kuyrukta yariisiyordu
	// — sonuc: gercek TRON/USDT-TRC20 yatirimlari gunlerce taranamiyordu
	// (bkz. 02.09.2026 vakasi). EVM adresleri zaten ayri bir izleyicide
	// taraniyor (services/cryptoDepositWatcherEvm.js), burada TEKRAR
	// taranmalarina gerek yok — hem gereksiz hem de tronClient'a EVM (0x...)
	// adresi gonderildigi icin her seferinde hata/bos sonuc uretiyordu.
	const addresses = await CryptoAddress.find({ chain: 'TRON' })
		.sort({ lastScannedAt: 1 })
		.limit(ADDRESS_BATCH)
		.lean();

	if (addresses.length === 0) return 0;

	// Ayni sekilde yalniz TRON para birimleri (TRX, USDT_TRC20) taranir —
	// listCurrencies() TUM zincirleri dondurur, burada gereksiz.
	const currencies = listCurrencies().filter(
		(currency) => currency.family === 'TRON',
	);
	let discovered = 0;

	for (const record of addresses) {
		discovered += await scanAddress(record, currencies);
		// Turdaki bir sonraki adrese gecmeden once hiz siniri araligi.
		// scanAddress kendi ic dongusunde de para birimi basina bekler; bu ek
		// bekleme adresler ARASI icindir (scanAddressNow bunu ATLAR, bkz. asagi).
		await sleep(REQUEST_SPACING_MS);
	}

	return discovered;
}

/**
 * Tek bir adresi, verilen para birimleri icin tarar. `discoverDeposits`
 * (toplu tur) ve `scanAddressNow` (kullanici bekleme sayfasindan anlik
 * tetikleme) TARAFINDAN PAYLASILIR — mantik iki yerde AYRI YAZILMAZ.
 * @returns {Promise<number>} Yeni kesfedilen transfer sayisi.
 */
async function scanAddress(record, currencies) {
	let newestTimestamp = record.lastSeenTimestamp || 0;
	let discovered = 0;

	try {
		// Her adres, DESTEKLENEN TUM para birimleri icin taranir.
		// Kullanici USDT'yi TRX adresine gonderse bile para kredi edilir.
		for (const currency of currencies) {
			const transfers = currency.contract
				? await tronClient.getIncomingTrc20(
						record.address,
						currency.contract,
						record.lastSeenTimestamp,
					)
				: await tronClient.getIncomingTrx(
						record.address,
						record.lastSeenTimestamp,
					);

			for (const transfer of transfers) {
				if (transfer.timestamp > newestTimestamp) {
					newestTimestamp = transfer.timestamp;
				}
				const created = await recordTransfer(record, currency, transfer);
				if (created) discovered += 1;
			}

			await sleep(REQUEST_SPACING_MS);
		}

		await CryptoAddress.updateOne(
			{ _id: record._id },
			{
				$set: {
					lastScannedAt: new Date(),
					// 1ms ileri alinir; ayni transferin her turda yeniden
					// cekilmesini onler (min_timestamp dahil sinirdir).
					lastSeenTimestamp: newestTimestamp
						? newestTimestamp + 1
						: record.lastSeenTimestamp || 0,
				},
			},
		);
	} catch (error) {
		// Tek bir adresin hatasi tum turu durdurmamali.
		console.error(
			`[crypto] adres taranamadi ${record.address}:`,
			error.message,
		);
		await CryptoAddress.updateOne(
			{ _id: record._id },
			{ $set: { lastScannedAt: new Date() } },
		);
	}

	return discovered;
}

/**
 * Kullanicinin YATIRMA BEKLEME sayfasindaysa cagirilir: 150'lik toplu tur
 * kuyruguna girmeden, SADECE bu kullanicinin TRON adresini hemen tarar.
 *
 * NEDEN GEREKLI: discoverDeposits() "en eski taranan once" round-robin
 * kuyrugu kullanir; kotu sansla bir adres tam tur (~91 dakika) bekleyebilir
 * (bkz. dosya basi ADDRESS_BATCH notu). Kullanici yatirma sayfasinda
 * beklerken bu, "para gonderdim ama gorunmuyor" sikayetine yol acar.
 * Bu fonksiyon kuyruktan BAGIMSIZ, dogrudan o kullanicinin adresini tarar —
 * tespit edilen transfer yine de normal onay esigini bekler (reorg
 * korumasi ATLANMAZ), sadece "hic tespit edilmeme" bekleme suresi kalkar.
 *
 * Hiz siniri korumasi icin cagiran taraf (route) kullanici basina
 * kucuk bir throttle uygulamalidir (bkz. routes/crypto/deposit.js).
 *
 * @returns {Promise<{scanned: boolean, discovered: number}>}
 */
async function scanAddressNow(userId) {
	if (!hdWallet.isConfigured()) return { scanned: false, discovered: 0 };

	// Adres, para biriminden BAGIMSIZ olarak ayni TRON hesabini paylasir
	// (bkz. CryptoAddress.js). Tek bir kayit yeterli; TUM TRON para
	// birimleri (TRX + USDT_TRC20) o tek adres uzerinde taranir.
	const record = await CryptoAddress.findOne({ user: userId, chain: 'TRON' }).lean();
	if (!record) return { scanned: false, discovered: 0 };

	const currencies = listCurrencies().filter((currency) => currency.family === 'TRON');
	const discovered = await scanAddress(record, currencies);
	return { scanned: true, discovered };
}

/**
 * Tek bir transferi `pending` olarak kaydeder.
 * @returns {Promise<boolean>} Yeni kayit olustuysa true
 */
async function recordTransfer(record, currency, transfer) {
	// Tozlama (dust) filtresi: cok kucuk transferler islenmez.
	let units;
	try {
		units = BigInt(transfer.valueUnits);
	} catch {
		return false;
	}
	if (units < BigInt(currency.minDepositUnits)) return false;

	// Zaten kayitliysa zincire sormadan cik (hiz siniri tasarrufu).
	const exists = await CryptoDeposit.exists({
		txHash: transfer.txHash,
		address: record.address,
		currency: currency.code,
	});
	if (exists) return false;

	// Blok numarasi + BASARI kontrolu. Geri alinmis islem kredi edilmemeli.
	const info = await tronClient.getTransactionInfo(transfer.txHash);
	if (!info || !info.success) return false;

	try {
		await CryptoDeposit.create({
			user: record.user,
			chain: 'TRON',
			currency: currency.code,
			address: record.address,
			txHash: transfer.txHash,
			// Number'a burada cevrilir; TRON tutarlari (6 hane) guvenle
			// Number.MAX_SAFE_INTEGER altinda kalir.
			amountUnits: Number(units),
			decimals: currency.decimals,
			blockNumber: info.blockNumber,
			confirmations: 0,
			status: 'pending',
		});
		return true;
	} catch (error) {
		// 11000 = ayni transfer baska bir tur tarafindan yazilmis. Beklenen.
		if (error && error.code === 11000) return false;
		throw error;
	}
}

/**
 * Onay esigini asan `pending` yatirmalari bakiyeye ekler.
 */
async function creditConfirmed(currentBlock) {
	const maxBlock = currentBlock - CONFIRMATIONS_REQUIRED;

	const pending = await CryptoDeposit.find({ status: 'pending' })
		.sort({ blockNumber: 1 })
		.limit(100)
		.lean();

	let credited = 0;

	for (const deposit of pending) {
		const confirmations = Math.max(currentBlock - deposit.blockNumber, 0);

		if (deposit.blockNumber > maxBlock) {
			// Henuz olgunlasmadi: yalnizca sayaci guncelle, KREDI VERME.
			await CryptoDeposit.updateOne(
				{ _id: deposit._id },
				{ $set: { confirmations } },
			);
			continue;
		}

		const applied = await creditDeposit(deposit, confirmations);
		if (applied) credited += 1;
	}

	return credited;
}

/**
 * Tek bir yatirimi bakiyeye ekler — IDEMPOTENT.
 *
 * Koruma (`appliedDeposits: { $ne: id }`) ile bakiye artisi ($inc) AYNI
 * belgede tek atomik islemdir. Bu yuzden ayni yatirim iki kez islenmeye
 * calisilsa bile bakiye yalnizca bir kez artar.
 */
async function creditDeposit(deposit, confirmations) {
	const currency = CURRENCIES[deposit.currency];
	if (!currency) {
		console.error(`[crypto] bilinmeyen para birimi: ${deposit.currency}`);
		return false;
	}

	// Bakiye, coin biriminde ondalik olarak tutulur (mevcut wallets semasi).
	const amount = Number(deposit.amountUnits) / 10 ** currency.decimals;

	// 1) Cuzdan yoksa olustur. Idempotent: yalnizca eksikse ekler.
	await User.updateOne(
		{ _id: deposit.user, 'wallets.coinType': { $ne: currency.walletCode } },
		{
			$push: {
				wallets: {
					coinType: currency.walletCode,
					chain: currency.chain,
					type: currency.type,
					balance: 0,
				},
			},
		},
	);

	// 2) Korumali, atomik bakiye artisi.
	const result = await User.updateOne(
		{
			_id: deposit.user,
			appliedDeposits: { $ne: deposit._id },
			'wallets.coinType': currency.walletCode,
		},
		{
			$inc: {
				'wallets.$[w].balance': amount,
				'stats.deposit': amount,
			},
			$push: {
				// Son 500 kayit tutulur; sinirsiz buyume onlenir.
				appliedDeposits: { $each: [deposit._id], $slice: -500 },
			},
			$set: { updatedAt: Date.now() },
		},
		{ arrayFilters: [{ 'w.coinType': currency.walletCode }] },
	);

	// modifiedCount 0 ise: bu yatirim zaten islenmis (yeniden deneme) —
	// bakiye tekrar artirilmadi. Kaydi yine de nihai duruma tasi.
	await CryptoDeposit.updateOne(
		{ _id: deposit._id, status: 'pending' },
		{
			$set: {
				status: 'credited',
				confirmations,
				creditedAmount: amount,
				creditedAt: new Date(),
			},
		},
	);

	if (result.modifiedCount > 0) {
		console.log(
			`[crypto] yatirim kredi edildi: ${amount} ${currency.label} -> kullanici ${deposit.user}`,
		);
		return true;
	}
	return false;
}

/** Bir tarama turu. Kilit alinamazsa sessizce cikar. */
async function runOnce() {
	if (!hdWallet.isConfigured()) return;

	const locked = await JobLock.acquire(LOCK_KEY, OWNER, LOCK_TTL_MS);
	if (!locked) return;

	try {
		const currentBlock = await tronClient.getNowBlock();
		await discoverDeposits();
		await creditConfirmed(currentBlock);
	} catch (error) {
		console.error('[crypto] tarama turu basarisiz:', error.message);
	} finally {
		await JobLock.release(LOCK_KEY, OWNER).catch(() => {});
	}
}

module.exports = {
	LOCK_KEY,
	runOnce,
	discoverDeposits,
	scanAddressNow,
	creditConfirmed,
	creditDeposit,
};
