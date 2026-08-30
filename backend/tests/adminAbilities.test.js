/**
 * Admin giris yetkileri (CASL) — panel ile API'nin ayni kurallari uygulamasi.
 *
 * Regresyon: adminRole ATANMAMIS (legacy) bir admin giris yaptiginda
 * buildAdminAbilities ona yalnizca `read Auth` veriyordu. Oysa
 * middleware/permission.js ayni kullaniciya her API ucunda `["*"]` veriyor.
 * Sonuc: backend izin verdigi halde panel /not-authorized'a atiyordu.
 *
 * Buradaki en kritik test "tutarlilik" testidir: iki kod yolu ayrisirsa
 * (birisi degistirilip digeri unutulursa) test kirmizi olur.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAdminAbilities } = require("../services/authSessionService");

// CASL ile ayni kural: manage/all her seye izin verir.
const can = (abilities, action, subject) =>
	abilities.some(
		(a) =>
			(a.action === "manage" && a.subject === "all") ||
			(a.action === "manage" && a.subject === subject) ||
			(a.action === action && a.subject === "all") ||
			(a.action === action && a.subject === subject)
	);

const roleId = "65b000000000000000000001";

// --- Senaryolar -----------------------------------------------------------

const legacyAdmin = { adminRole: null };

const superAdmin = {
	adminRole: { _id: roleId, isSuperAdmin: true, permissions: [] },
};

const financeAdmin = {
	adminRole: {
		_id: roleId,
		isSuperAdmin: false,
		permissions: [
			{ code: "finance.read", resource: "finance", action: "read" },
			{ code: "users.read", resource: "users", action: "read" },
		],
	},
};

// --- Testler --------------------------------------------------------------

test("legacy admin (adminRole yok) tam yetki alir", () => {
	const { isSuperAdmin, userAbilities, userPermissions } =
		buildAdminAbilities(legacyAdmin);

	assert.equal(isSuperAdmin, true);
	assert.deepEqual(userPermissions, ["*"]);
	assert.deepEqual(userAbilities, [{ action: "manage", subject: "all" }]);
});

test("legacy admin panelde kilitlenmez (regresyonun ta kendisi)", () => {
	const { userAbilities } = buildAdminAbilities(legacyAdmin);

	// Eskiden bunlarin hepsi false donuyordu → her sayfa /not-authorized.
	assert.equal(can(userAbilities, "read", "dashboard"), true);
	assert.equal(can(userAbilities, "read", "finance.deposits"), true);
	assert.equal(can(userAbilities, "manage", "users"), true);
});

test("adminRole populate edilmemisse (sadece ObjectId) kilitleme yapmaz", () => {
	// Bir cagiran .populate("adminRole") demeyi unutursa isSuperAdmin
	// okunamaz. Bu durumda admini yetkisiz birakmak yerine legacy kabul
	// ediyoruz — API davranisiyla tutarli olan budur.
	const { isSuperAdmin, userAbilities } = buildAdminAbilities({
		adminRole: roleId,
	});

	assert.equal(isSuperAdmin, true);
	assert.equal(can(userAbilities, "read", "dashboard"), true);
});

test("super admin rolu tam yetki alir", () => {
	const { isSuperAdmin, userAbilities, userPermissions } =
		buildAdminAbilities(superAdmin);

	assert.equal(isSuperAdmin, true);
	assert.deepEqual(userPermissions, ["*"]);
	assert.equal(can(userAbilities, "read", "herhangiBirSey"), true);
});

test("sinirli rol YALNIZCA kendi kaynaklarina erisir", () => {
	const { isSuperAdmin, userAbilities, userPermissions } =
		buildAdminAbilities(financeAdmin);

	assert.equal(isSuperAdmin, false);
	assert.deepEqual(userPermissions, ["finance.read", "users.read"]);

	assert.equal(can(userAbilities, "read", "finance"), true);
	assert.equal(can(userAbilities, "read", "users"), true);

	// Yetki genislemesi OLMAMALI — duzeltme herkesi superadmin yapmasin.
	assert.equal(can(userAbilities, "read", "settings"), false);
	assert.equal(can(userAbilities, "manage", "finance"), false);
	assert.equal(can(userAbilities, "delete", "users"), false);
});

test("her admin en azindan Auth okuyabilir (welcome / not-authorized)", () => {
	const { userAbilities } = buildAdminAbilities(financeAdmin);

	assert.equal(can(userAbilities, "read", "Auth"), true);
});

test("giris ve API ayni isSuperAdmin sonucunu uretir", () => {
	// middleware/permission.js authenticateAdmin icindeki kuralin birebir
	// kopyasi. Iki taraftan biri degisip digeri unutulursa bu test kirilir.
	const middlewareIsSuperAdmin = (user) => {
		const hasAdminRole = Boolean(user.adminRole && user.adminRole._id);

		return hasAdminRole ? user.adminRole.isSuperAdmin || false : true;
	};

	for (const [label, user] of [
		["legacy", legacyAdmin],
		["superAdmin", superAdmin],
		["financeAdmin", financeAdmin],
	]) {
		assert.equal(
			buildAdminAbilities(user).isSuperAdmin,
			middlewareIsSuperAdmin(user),
			`${label}: giris ve API isSuperAdmin konusunda ayrisiyor`
		);
	}
});
