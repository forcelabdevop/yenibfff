const { ethers } = require('ethers');
const { EVM_NETWORKS } = require('../../config/crypto');

/**
 * EVM (BSC + Polygon) okuma istemcisi.
 *
 * Anahtarlar bizde (self-custody); zinciri OKUMAK icin RPC saglayicisi
 * kullanilir. Bu modul yalnizca okuma yapar — imzalama/gonderme icermez
 * (bkz. evmSigner.js).
 *
 * ERC20 Transfer olayi imzasi (tum ERC20 tokenlarda ayni):
 *   Transfer(address indexed from, address indexed to, uint256 value)
 */
const TRANSFER_EVENT_TOPIC = ethers.id('Transfer(address,address,uint256)');

const ERC20_ABI = [
	'function balanceOf(address owner) view returns (uint256)',
	'function decimals() view returns (uint8)',
];

const providers = new Map();
/** Ag basina HAM (fallback-sarmalanmamis) JsonRpcProvider listesi. */
const rawProviderLists = new Map();

/**
 * @param {'BEP20'|'POLYGON'} network
 *
 * Birden fazla RPC uc noktasi varsa (config/crypto.js -> resolveRpcUrls)
 * bir `ethers.FallbackProvider` kurulur: her cagriyi ONCE listenin basindaki
 * saglayiciya gonderir, o BASARISIZ olursa (timeout, 401/403, hiz siniri,
 * agdan dusme) OTOMATIK olarak siradaki saglayiciya gecer. `quorum: 1`
 * bilerek secildi — amac BIRDEN FAZLA saglayicinin BIRBIRINI dogrulamasi
 * degil (bu, ayni okumayi N kat tekrar gonderip RPC kullanimini N'e katlar),
 * sadece TEK bir saglayicinin gecici arizasinin/anti-abuse blogunun butun
 * yatirma taramasini durdurmasini ONLEMEKTIR. Kredi guvenligi zaten baska
 * katmanlarla saglanir: getTransactionReceipt basari kontrolu, atomik
 * $inc bakiye guncellemesi ve confirmationsRequired esigi (bkz. dosya basi
 * ve cryptoDepositWatcher.js notlari).
 */
function getProvider(network) {
	const config = EVM_NETWORKS[network];
	if (!config) throw new Error(`Bilinmeyen EVM agi: ${network}`);

	if (!providers.has(network)) {
		const ethersNetwork = ethers.Network.from(config.chainId);
		const jsonRpcProviders = config.rpcUrls.map(
			(url) => new ethers.JsonRpcProvider(url, ethersNetwork, { staticNetwork: true }),
		);

		const provider =
			jsonRpcProviders.length > 1
				? new ethers.FallbackProvider(jsonRpcProviders, ethersNetwork, { quorum: 1 })
				: jsonRpcProviders[0];

		providers.set(network, provider);
		rawProviderLists.set(network, jsonRpcProviders);
	}
	return providers.get(network);
}

/** Ag basina HAM JsonRpcProvider listesi (bkz. getBlockWithTransactionsRaw). */
function getRawProviders(network) {
	getProvider(network); // Liste bos ise doldurur (lazy init).
	return rawProviderLists.get(network) || [];
}

/**
 * Bir bloku TAM islem objeleriyle birlikte HAM JSON-RPC cagrisiyla getirir.
 *
 * NEDEN FallbackProvider.getBlock(num, true) KULLANILMAZ: ethers v6'da
 * FallbackProvider, coklu saglayicidan gelen sonuclari normallestirirken
 * "prefetched transactions" iceren agir Block objelerini guvenilir bir
 * sekilde tasiyamiyor — bazi durumlarda basarili bir yanit alinsa da
 * `block.prefetchedTransactions` erisiminde "transactions were not
 * prefetched with block request" hatasi firlatiliyor (bkz. 05.09.2026
 * vakasi: ETHEREUM taramasi AYNI blok araligini turlerce basarisiz
 * tekrarladi, cunku scanNetwork hata sonrasi cursor'u ilerletmiyor).
 * Bu yuzden burada HER saglayiciyi TEK TEK, dogrudan `send()` ile deneriz
 * ve ethers'in Block sarmalayicisini hic kullanmadan ham JSON-RPC sonucunu
 * kendimiz ayristiririz.
 *
 * @returns {Promise<{hash: string, from: string, to: string|null, value: bigint}[]>}
 */
async function getBlockWithTransactionsRaw(network, blockNumber) {
	const rawProviders = getRawProviders(network);
	const hexBlock = ethers.toQuantity(blockNumber);

	let lastError = null;
	for (const rawProvider of rawProviders) {
		try {
			const block = await rawProvider.send('eth_getBlockByNumber', [hexBlock, true]);
			if (!block) return [];
			const txs = Array.isArray(block.transactions) ? block.transactions : [];
			return txs
				.filter((tx) => tx && typeof tx === 'object' && tx.to)
				.map((tx) => ({
					hash: tx.hash,
					from: ethers.getAddress(tx.from),
					to: ethers.getAddress(tx.to),
					value: BigInt(tx.value || '0x0'),
				}));
		} catch (error) {
			lastError = error;
			// Bu saglayici basarisiz oldu (403/429/timeout) — siradakini dene.
		}
	}
	throw lastError || new Error(`[evmClient] ${network} blok ${blockNumber} icin tum saglayicilar basarisiz.`);
}

const contractCache = new Map();
function getContract(network, address) {
	const key = `${network}:${address}`;
	if (!contractCache.has(key)) {
		contractCache.set(key, new ethers.Contract(address, ERC20_ABI, getProvider(network)));
	}
	return contractCache.get(key);
}

/** Agdaki guncel blok numarasi. */
async function getCurrentBlock(network) {
	return getProvider(network).getBlockNumber();
}

/**
 * BSC icin "finalized" etiketli blok numarasi (Fast Finality).
 * Bu, sabit bir onay sayisi DEGIL — zincirin kendisinin geri alinamaz kabul
 * ettigi en son bloktur. Saglayici bu etiketi desteklemiyorsa (nadir) null
 * doner; cagiran taraf bu durumda krediyi ERTELEMELIDIR (asla tahmine
 * dayali kredi vermemeli).
 */
async function getFinalizedBlockNumber(network) {
	try {
		const block = await getProvider(network).getBlock('finalized');
		return block ? block.number : null;
	} catch {
		return null;
	}
}

/** Adresin native bakiyesi (wei, BigInt). Sweep gas kontrolu icin. */
async function getNativeBalance(network, address) {
	return getProvider(network).getBalance(address);
}

/** Adresin bir ERC20 sozlesmesindeki bakiyesi (ham zincir birimi, BigInt). */
async function getErc20Balance(network, contractAddress, address) {
	return getContract(network, contractAddress).balanceOf(address);
}

/**
 * Bir adrese GELEN ERC20 transferlerini (Transfer event log) tarar.
 *
 * `topics[2]` = to-adresi (32 byte'a doldurulmus) — saglayici sunucu
 * tarafinda indeksli filtreler, bu yuzden adres basina tek bir getLogs
 * cagrisi yeterlidir (TronGrid'in `only_to=true` REST parametresine denk).
 *
 * @returns {Promise<Array<{txHash: string, from: string, to: string, valueUnitsRaw: string, blockNumber: number}>>}
 */
async function getIncomingErc20(network, address, contractAddress, fromBlock, toBlock) {
	const provider = getProvider(network);
	const paddedTo = ethers.zeroPadValue(ethers.getAddress(address), 32);

	const logs = await provider.getLogs({
		address: contractAddress,
		fromBlock,
		toBlock,
		topics: [TRANSFER_EVENT_TOPIC, null, paddedTo],
	});

	return logs.map((log) => {
		// data alani tek bir uint256 (value) icerir — indekslenmemis parametre.
		const [value] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);
		return {
			txHash: log.transactionHash,
			from: ethers.getAddress('0x' + log.topics[1].slice(26)),
			to: ethers.getAddress('0x' + log.topics[2].slice(26)),
			// String olarak birakilir; BigInt ile islenecek (18 ondalikli tokenlarda
			// Number hassasiyet kaybi/tasma riski tasir — bkz. config/crypto.js).
			valueUnitsRaw: value.toString(),
			blockNumber: log.blockNumber,
			logIndex: log.index,
		};
	});
}

/**
 * BIRDEN FAZLA adrese GELEN ERC20 transferlerini TEK bir getLogs cagrisinda
 * tarar. `topics[2]` OR-filtresi olarak bir adres DIZISI kabul eder (JSON-RPC
 * eth_getLogs standardi) — bu, TronGrid'in adres-basina sorgu gerektiren
 * yapisindan farkli olarak, EVM'de N kullaniciyi TEK istekte taramamizi
 * saglar (RPC hiz siniri acisindan cok daha verimli).
 *
 * @param {'BEP20'|'POLYGON'} network
 * @param {string[]} addresses Taranacak kullanici adresleri (checksum'li)
 * @param {string} contractAddress
 * @param {number} fromBlock
 * @param {number} toBlock
 */
async function getIncomingNativeBatch(network, addresses, fromBlock, toBlock) {
	if (!addresses || addresses.length === 0) return [];
	const wanted = new Set(addresses.map((address) => ethers.getAddress(address).toLowerCase()));
	const transfers = [];
	let failedBlocks = 0;

	for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
		let txs;
		try {
			txs = await getBlockWithTransactionsRaw(network, blockNumber);
		} catch (error) {
			// TEK bir blok icin TUM saglayicilar basarisiz olabilir (gecici
			// ariza/hiz siniri). Bu bloku ATLAYIP devam ederiz — aksi halde
			// scanNetwork() cursor'u HICBIR ZAMAN ilerletemez ve ayni araligi
			// sonsuza kadar tekrar dener (bkz. 05.09.2026 vakasi).
			failedBlocks += 1;
			continue;
		}
		for (const tx of txs) {
			if (!tx.to || tx.value <= 0n || !wanted.has(tx.to.toLowerCase())) continue;
			transfers.push({
				txHash: tx.hash,
				from: tx.from,
				to: tx.to,
				valueUnitsRaw: tx.value.toString(),
				blockNumber,
				logIndex: -1,
			});
		}
	}

	if (failedBlocks > 0) {
		console.error(
			`[crypto-evm] ${network}: ${failedBlocks} blok atlandi (tum RPC saglayicilari basarisiz oldu, bir sonraki turda tekrar denenecek).`,
		);
	}

	return transfers;
}

async function getIncomingErc20Batch(network, addresses, contractAddress, fromBlock, toBlock) {
	if (!addresses || addresses.length === 0) return [];
	const provider = getProvider(network);
	const paddedAddresses = addresses.map((a) => ethers.zeroPadValue(ethers.getAddress(a), 32));

	const logs = await provider.getLogs({
		address: contractAddress,
		fromBlock,
		toBlock,
		topics: [TRANSFER_EVENT_TOPIC, null, paddedAddresses],
	});

	return logs.map((log) => {
		const [value] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);
		return {
			txHash: log.transactionHash,
			from: ethers.getAddress('0x' + log.topics[1].slice(26)),
			to: ethers.getAddress('0x' + log.topics[2].slice(26)),
			valueUnitsRaw: value.toString(),
			blockNumber: log.blockNumber,
			logIndex: log.index,
		};
	});
}

/**
 * Bir islemin basarili olup olmadigini dogrular.
 * Geri alinmis (reverted) bir islem de log uretebilir gibi gorunse de aslinda
 * uretmez — ETH/BSC/Polygon'da revert eden bir islemin loglari yazilmaz.
 * Ancak yine de status kontrolu, ag/saglayici tutarsizliklarina karsi ek
 * bir guvenlik katmanidir.
 */
async function getTransactionReceipt(network, txHash) {
	const receipt = await getProvider(network).getTransactionReceipt(txHash);
	if (!receipt) return null;
	return { blockNumber: receipt.blockNumber, success: receipt.status === 1 };
}

/**
 * Ham zincir birimini (chainDecimals) KANONIK birime (config'teki `decimals`,
 * her zaman 6) DAIMA asagi yuvarlayarak (floor) cevirir.
 *
 * NEDEN FLOOR: Yukari yuvarlama, kullaniciya zincirde gercekte alinandan
 * FAZLA kredi vermek demektir — asla yapilmaz. Kaybedilen tek sey, kanonik
 * birimin altindaki toz (USDT_BEP20 icin 10^-6 USDT'nin altindaki miktar).
 *
 * @param {string|bigint} rawValue Ham zincir degeri
 * @param {number} chainDecimals Sozlesmenin gercek ondalik sayisi
 * @param {number} canonicalDecimals Hedef kanonik ondalik sayisi (config decimals)
 * @returns {bigint}
 */
function toCanonicalUnits(rawValue, chainDecimals, canonicalDecimals) {
	const raw = BigInt(rawValue);
	if (chainDecimals === canonicalDecimals) return raw;
	if (chainDecimals < canonicalDecimals) {
		throw new Error(
			'chainDecimals canonicalDecimals\'tan kucuk olamaz (yukari yuvarlama gerektirir, desteklenmiyor).',
		);
	}
	const divisor = 10n ** BigInt(chainDecimals - canonicalDecimals);
	return raw / divisor; // BigInt bolmesi zaten floor yapar (pozitif sayilarda).
}

/**
 * Sozlesmenin zincirdeki GERCEK ondalik sayisini config'teki `chainDecimals`
 * ile karsilastirir. Uyusmazlik varsa (or. sozlesme adresi yanlis girildi)
 * SESSIZCE gecmez — yatirma/sweep akisinda tutar hesaplarini bozacagi icin
 * yuksek sesle hata firlatilir. Baslangicta bir kez cagirilmasi onerilir.
 */
async function verifyChainDecimals(network, contractAddress, expectedDecimals) {
	const actual = await getContract(network, contractAddress).decimals();
	if (Number(actual) !== expectedDecimals) {
		throw new Error(
			`[evmClient] ${network} sozlesmesi ${contractAddress} icin decimals() ${actual} dondu, config'te ${expectedDecimals} bekleniyordu. Tutarlar YANLIS hesaplanir — DUZELTILMEDEN devam edilmemeli.`,
		);
	}
}

module.exports = {
	getProvider,
	getCurrentBlock,
	getFinalizedBlockNumber,
	getNativeBalance,
	getErc20Balance,
	getIncomingErc20,
	getIncomingNativeBatch,
	getIncomingErc20Batch,
	getTransactionReceipt,
	toCanonicalUnits,
	verifyChainDecimals,
};
