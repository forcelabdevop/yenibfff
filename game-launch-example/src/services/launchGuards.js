/**
 * Oyun baslatma ONCESI, HER saglayici icin AYNI sekilde calisan
 * paylasilan guvenlik kontrolleri.
 *
 * Gercek projede (backend/routes/betinoviApi.js, drakonApi.js, goldApi.js,
 * pokerApi.js, betcolabsApi.js) bu kontroller her dosyada TEKRAR EDILIR:
 *   1) Kullanici var mi?
 *   2) Kullanicinin bahis erisimi engellenmis mi? (isUserBetAccessBlocked)
 *   3) Aktif bir cuzdani var mi? (getActiveWallet)
 *   4) Bakiyesi, sistemin tanimladigi ust siniri (bonus/AML esigi) asiyor mu?
 *      (getMaxAccountBalance)
 *
 * Bu ornekte ayni 4 kontrolu TEK bir yerde topluyoruz — her provider
 * adapter'i bunu kendi launchGame() fonksiyonunun basinda cagirir.
 * Boylece yeni bir saglayici eklerken bu kontrolleri kopyala-yapistir
 * yapmaya gerek kalmaz; sadece saglayiciya OZGU launch cagrisini yazarsiniz.
 */

const MAX_ACCOUNT_BALANCE = 50000; // Gercekte veritabanindan/ayarlardan okunur.

class LaunchGuardError extends Error {
	constructor(code, message, httpStatus = 400) {
		super(message);
		this.code = code;
		this.httpStatus = httpStatus;
	}
}

function assertCanLaunchGame(user) {
	if (!user) {
		throw new LaunchGuardError("INVALID_USER", "Kullanici bulunamadi.", 200);
	}

	if (user.betAccessBlocked) {
		throw new LaunchGuardError(
			"BET_ACCESS_BLOCKED",
			"Bu kullanicinin bahis/oyun erisimi yonetici tarafindan engellenmis.",
			403,
		);
	}

	if (typeof user.balance !== "number") {
		throw new LaunchGuardError(
			"WALLET_NOT_FOUND",
			"Aktif cuzdan bulunamadi.",
			400,
		);
	}

	if (user.balance >= MAX_ACCOUNT_BALANCE) {
		throw new LaunchGuardError(
			"INVALID_BALANCE",
			`Bakiye ${MAX_ACCOUNT_BALANCE}${user.currency || ""} bonus/AML esigine ulasti. Oyun acilamiyor.`,
			400,
		);
	}
}

module.exports = { assertCanLaunchGame, LaunchGuardError, MAX_ACCOUNT_BALANCE };
