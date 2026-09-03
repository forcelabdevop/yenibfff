/**
 * Bellek-ici (in-memory) sahte kullanici deposu.
 *
 * Gercek projede bu, MongoDB'deki User modeli + Wallet alt-belgeleridir.
 * Burada sadece mimariyi gostermek icin ayni SEKLI (shape) taklit eden
 * basit bir Map kullaniyoruz: her kullanicinin id'si, bakiyesi ve
 * bahis-erisimi engellenmis mi bilgisi var.
 */

const users = new Map();

function seedDemoUsers() {
	users.set("demo-user-1", {
		id: "demo-user-1",
		username: "demoPlayer",
		balance: 250.5,
		currency: "TRY",
		betAccessBlocked: false,
	});

	users.set("demo-user-blocked", {
		id: "demo-user-blocked",
		username: "blockedPlayer",
		balance: 40,
		currency: "TRY",
		betAccessBlocked: true,
	});
}

seedDemoUsers();

function findUserById(userId) {
	return users.get(userId) || null;
}

module.exports = { findUserById, users };
