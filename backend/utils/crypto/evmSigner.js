const { ethers } = require('ethers');
const { getProvider } = require('./evmClient');
const { derivePrivateKey } = require('./evmWallet');

/**
 * EVM (BSC + Polygon) sweep imzalama.
 *
 * tronSigner.js ile ayni guvenlik kurallarina uyar: private key yalniz bu
 * modul icinde, imzalama aninda bellekte turetilir; kalici yazilmaz,
 * loglanmaz, hata mesajina konmaz.
 */

const ERC20_TRANSFER_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

/**
 * Kullanicinin adresinden ana (sweep) cuzdana native coin (BNB/MATIC) gonderir.
 * ERC20 transferi gas gerektirdigi icin, gas'i olmayan kullanici adresine
 * once bir miktar native coin gonderilir (bkz. cryptoSweepServiceEvm.js).
 *
 * @param {'BEP20'|'POLYGON'} network
 * @param {number} fromIndex Kullanicinin turetme indeksi (gas'i gonderen: SWEEP cuzdani)
 * @param {string} toAddress Gas'in gonderilecegi adres (kullanicinin adresi)
 * @param {bigint} amountWei
 * @returns {Promise<string>} txHash
 */
async function sendNativeGas(network, fromIndex, toAddress, amountWei) {
	const provider = getProvider(network);
	const wallet = new ethers.Wallet(derivePrivateKey(fromIndex), provider);
	const tx = await wallet.sendTransaction({ to: toAddress, value: amountWei });
	const receipt = await tx.wait();
	if (!receipt || receipt.status !== 1) {
		throw new Error(`[evmSigner] Native gas transferi basarisiz oldu (tx: ${tx.hash}).`);
	}
	return tx.hash;
}

/**
 * Kullanicinin adresinden ana (sweep) cuzdana ERC20 token (USDT) gonderir.
 * Kullanicinin adresinde imzalamak icin onceden gas gonderilmis olmasi
 * ZORUNLUDUR (bkz. sendNativeGas). Aksi halde islem gas yetersizliginden
 * basarisiz olur.
 *
 * @param {'BEP20'|'POLYGON'} network
 * @param {number} fromIndex Kullanicinin turetme indeksi
 * @param {string} contractAddress USDT sozlesme adresi
 * @param {string} toAddress Sweep hedef adresi
 * @param {bigint} amountRawUnits Ham zincir birimi (chainDecimals olceginde)
 * @returns {Promise<string>} txHash
 */
async function sweepNative(network, fromIndex, toAddress) {
	const provider = getProvider(network);
	const wallet = new ethers.Wallet(derivePrivateKey(fromIndex), provider);
	const balance = await provider.getBalance(wallet.address);
	const feeData = await provider.getFeeData();
	const gasLimit = 21_000n;
	const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
	if (!gasPrice) throw new Error(`[evmSigner] ${network} gas fiyati alinamadi.`);
	const fee = gasLimit * gasPrice;
	if (balance <= fee) return null;
	const tx = await wallet.sendTransaction({ to: toAddress, value: balance - fee, gasLimit, gasPrice });
	const receipt = await tx.wait();
	if (!receipt || receipt.status !== 1) throw new Error(`[evmSigner] Native sweep basarisiz (${tx.hash}).`);
	return tx.hash;
}

async function sweepErc20(network, fromIndex, contractAddress, toAddress, amountRawUnits) {
	const provider = getProvider(network);
	const wallet = new ethers.Wallet(derivePrivateKey(fromIndex), provider);
	const contract = new ethers.Contract(contractAddress, ERC20_TRANSFER_ABI, wallet);

	const tx = await contract.transfer(toAddress, amountRawUnits);
	const receipt = await tx.wait();
	if (!receipt || receipt.status !== 1) {
		throw new Error(`[evmSigner] USDT sweep islemi basarisiz oldu (tx: ${tx.hash}).`);
	}
	return tx.hash;
}

module.exports = {
	sendNativeGas,
	sweepNative,
	sweepErc20,
};
