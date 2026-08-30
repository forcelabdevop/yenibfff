// Casino ödül motoru doğrulama betiği.
// İZOLE, bellek içi bir MongoDB örneği başlatır — gerçek/üretim veritabanına
// hiçbir şekilde bağlanmaz ve hiçbir canlı veriye dokunmaz.
//
// Çalıştırma:
//   node scripts/verify-casino-reward-engine.js

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const CasinoContent = require("../database/models/CasinoContent");
const CasinoUserState = require("../database/models/CasinoUserState");
const CasinoRewardEvent = require("../database/models/CasinoRewardEvent");
const FreeSpinGrant = require("../database/models/FreeSpinGrant");
const engine = require("../services/casinoRewardEngine");

const created = { contents: [], states: [], events: [], grants: [] };
let memoryServer = null;
let passed = 0;
let failed = 0;

const check = (label, condition, detail = "") => {
	if (condition) {
		passed += 1;
		console.log(`  PASS  ${label}`);
	} else {
		failed += 1;
		console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
	}
};

const makeContent = async (payload) => {
	const doc = await CasinoContent.create({
		slug: payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
		...payload,
	});
	created.contents.push(doc._id);
	return doc;
};

async function main() {
	memoryServer = await MongoMemoryServer.create();
	await mongoose.connect(memoryServer.getUri("casino_reward_engine_test"));
	console.log("İzole test MongoDB bağlandı\n");

	// Gerçek bir kullanıcıyı ASLA kullanma: sentetik ObjectId yeterli, çünkü
	// mission/bonus akışları user alanını yalnızca referans olarak kullanır.
	const userId = new mongoose.Types.ObjectId();

	// Indeksleri şemadaki tanıma göre kur — partial/unique davranışı test edilir.
	await CasinoUserState.syncIndexes();

	// ------------------------------------------------------- 0) İndeks regresyonu
	// `sparse` unique index, şema varsayılanı null olan alanlarda ikinci kaydı
	// yanlışlıkla reddeder. Bir kullanıcının birden fazla bonus/görev kaydı
	// olabilmeli — partial index bunu garanti eder.
	console.log("0) Çoklu kayıt indeks regresyonu");
	const idxUser = new mongoose.Types.ObjectId();
	const first = await CasinoUserState.create({ user: idxUser, content: new mongoose.Types.ObjectId(), kind: "bonus", periodKey: "lifetime" });
	created.states.push(first._id);
	let multiRecordOk = true;
	let multiRecordError = "";
	try {
		const second = await CasinoUserState.create({ user: idxUser, content: new mongoose.Types.ObjectId(), kind: "bonus", periodKey: "lifetime" });
		created.states.push(second._id);
	} catch (error) {
		multiRecordOk = false;
		multiRecordError = error.message.slice(0, 120);
	}
	check("Aynı kullanıcı birden fazla bonus kaydı tutabilir", multiRecordOk, multiRecordError);

	// ---------------------------------------------------------- 1) Mission
	console.log("\n1) Mission ilerlemesi ve idempotency");
	const mission = await makeContent({
		type: "mission",
		title: `__test_wager_mission_${Date.now()}`,
		status: "published",
		rules: { eventType: "wager", metric: "amount", target: 100, autoJoin: true, period: "daily" },
		reward: { type: "xp", amount: 50 },
	});

	await engine.recordEvent({
		userId, eventType: "wager", eventKey: "test:wager:1",
		amount: 60, category: "casino", reference: "test:wager:1",
	});
	let state = await CasinoUserState.findOne({ user: userId, content: mission._id });
	if (state) created.states.push(state._id);
	check("İlk bahis ilerlemeyi 60 yapar", state?.progress === 60, `progress=${state?.progress}`);
	check("Hedefe ulaşılmadığı için durum 'active'", state?.status === "active", `status=${state?.status}`);

	// Aynı eventKey tekrar gönderilir — ilerleme DEĞİŞMEMELİ.
	await engine.recordEvent({
		userId, eventType: "wager", eventKey: "test:wager:1",
		amount: 60, category: "casino", reference: "test:wager:1",
	});
	state = await CasinoUserState.findById(state._id);
	check("Tekrarlanan eventKey ilerlemeyi artırmaz", state?.progress === 60, `progress=${state?.progress}`);

	await engine.recordEvent({
		userId, eventType: "wager", eventKey: "test:wager:2",
		amount: 40, category: "casino", reference: "test:wager:2",
	});
	state = await CasinoUserState.findById(state._id);
	check("Hedefe ulaşınca durum 'completed'", state?.status === "completed", `status=${state?.status}`);
	check("İlerleme hedefte sabitlenir", state?.progress === 100, `progress=${state?.progress}`);

	// ------------------------------------------------ 2) Filtre uyuşmazlığı
	console.log("\n2) Sağlayıcı/kategori filtreleri");
	const filtered = await makeContent({
		type: "mission",
		title: `__test_filtered_mission_${Date.now()}`,
		status: "published",
		rules: { eventType: "wager", metric: "count", target: 3, autoJoin: true, period: "daily", providerCodes: ["PRAGMATIC"] },
		reward: { type: "xp", amount: 10 },
	});
	await engine.recordEvent({
		userId, eventType: "wager", eventKey: "test:wager:3",
		amount: 10, providerCode: "EVOLUTION", category: "casino", reference: "test:wager:3",
	});
	const filteredState = await CasinoUserState.findOne({ user: userId, content: filtered._id });
	if (filteredState) created.states.push(filteredState._id);
	check("Eşleşmeyen sağlayıcı ilerleme üretmez", !filteredState, `state=${filteredState?.progress}`);

	// -------------------------------------------- 3) Yatırım bonusu akışı
	console.log("\n3) Yatırım tetikli bonus aktivasyonu");
	const bonus = await makeContent({
		type: "bonus",
		title: `__test_deposit_bonus_${Date.now()}`,
		status: "published",
		rules: { activation: "deposit", minimumDeposit: 100, windowHours: 48, wagerMultiplier: 2 },
		reward: { type: "bonus", amount: 200, wageringMultiplier: 2 },
	});
	const selection = await engine.selectBonus({ userId, contentId: bonus._id });
	created.states.push(selection.state._id);
	check("Seçim 'awaiting-deposit' durumunda başlar", selection.state.status === "awaiting-deposit", `status=${selection.state.status}`);

	// Minimumun altındaki yatırım bonusu aktive ETMEMELİ.
	await engine.recordEvent({
		userId, eventType: "deposit", eventKey: "test:dep:small",
		amount: 50, currency: "TRY", reference: "test:dep:small",
	});
	let bonusState = await CasinoUserState.findById(selection.state._id);
	check("Minimum altı yatırım bonusu aktive etmez", bonusState.status === "awaiting-deposit", `status=${bonusState.status}`);

	await engine.recordEvent({
		userId, eventType: "deposit", eventKey: "test:dep:ok",
		amount: 500, currency: "TRY", reference: "test:dep:ok",
	});
	bonusState = await CasinoUserState.findById(selection.state._id);
	check("Uygun yatırım bonusu çevrime alır", bonusState.status === "wagering", `status=${bonusState.status}`);
	check("Çevrim hedefi 200x2=400 olur", bonusState.target === 400, `target=${bonusState.target}`);

	// ------------------------------------------------ 4) Çevrim tamamlama
	console.log("\n4) Bonus çevrim ilerlemesi");
	await engine.recordEvent({
		userId, eventType: "wager", eventKey: "test:wager:w1",
		amount: 150, category: "casino", reference: "test:wager:w1",
	});
	bonusState = await CasinoUserState.findById(selection.state._id);
	check("Çevrim ilerlemesi bahisle artar", bonusState.progress === 150, `progress=${bonusState.progress}`);
	check("Çevrim tamamlanmadan durum 'wagering' kalır", bonusState.status === "wagering", `status=${bonusState.status}`);

	// Kalan çevrim tamamlanır: bonus bakiyesi serbest bırakılıp "claimed" olmalı.
	await engine.recordEvent({
		userId, eventType: "wager", eventKey: "test:wager:w2",
		amount: 250, category: "casino", reference: "test:wager:w2",
	});
	bonusState = await CasinoUserState.findById(selection.state._id);
	check("Çevrim tamamlanınca durum 'claimed'", bonusState.status === "claimed", `status=${bonusState.status}`);

	// ------------------------------------- 5) Free-spin teslim kuyruğu / backoff
	console.log("\n5) Free-spin teslim kuyruğu ve yeniden deneme");
	const fsBonus = await makeContent({
		type: "bonus",
		title: `__test_freespin_bonus_${Date.now()}`,
		status: "published",
		rules: { activation: "instant", windowHours: 48 },
		reward: { type: "free-spins", providerCode: "PRAGMATIC", gameCode: "vs20fruit", spinCount: 20, betAmount: 1, currency: "TRY", expireHours: 72 },
	});

	// Sağlayıcı çağrısını taklit et: önce gövdede hata (HTTP 200 + status!=0).
	const providerModule = require("../services/betinoviAdminApiService");
	const realRequest = providerModule.betinoviAdminRequest;
	providerModule.betinoviAdminRequest = async () => ({ status: 5, msg: "AGENT_LIMIT" });

	const fsUser = new mongoose.Types.ObjectId();
	const fsSelection = await engine.selectBonus({ userId: fsUser, contentId: fsBonus._id });
	created.states.push(fsSelection.state._id);
	check("Sağlayıcı gövde hatası teslimi başarısız sayar", fsSelection.state.status === "delivery-pending", `status=${fsSelection.state.status}`);
	check("Yeniden deneme zamanı planlanır", !!fsSelection.state.nextDeliveryAt, `next=${fsSelection.state.nextDeliveryAt}`);
	check("Deneme sayacı 1 olur", fsSelection.state.deliveryAttempts === 1, `attempts=${fsSelection.state.deliveryAttempts}`);

	// Kuyruk henüz zamanı gelmemiş kaydı işlememeli.
	const notDue = await engine.processDeliveryQueue();
	check("Zamanı gelmemiş kayıt işlenmez", notDue.processed === 0, `processed=${notDue.processed}`);

	// Zamanı geriye alıp sağlayıcıyı başarılı hale getir → teslim tamamlanmalı.
	await CasinoUserState.updateOne({ _id: fsSelection.state._id }, { $set: { nextDeliveryAt: new Date(Date.now() - 1000) } });
	providerModule.betinoviAdminRequest = async () => ({ status: 0, msg: "SUCCESS" });
	const queueResult = await engine.processDeliveryQueue();
	const fsState = await CasinoUserState.findById(fsSelection.state._id);
	check("Kuyruk zamanı gelen kaydı işler", queueResult.processed === 1, `processed=${queueResult.processed}`);
	check("Başarılı yeniden denemede durum 'claimed'", fsState.status === "claimed", `status=${fsState.status}`);

	const grant = await FreeSpinGrant.findOne({ deliveryKey: `state:${fsSelection.state._id}` });
	if (grant) created.grants.push(grant._id);
	check("FreeSpinGrant kaydı 'delivered'", grant?.deliveryStatus === "delivered", `status=${grant?.deliveryStatus}`);
	check("Free spin adedi doğru kaydedilir", grant?.spinCount === 20, `spinCount=${grant?.spinCount}`);

	providerModule.betinoviAdminRequest = realRequest;

	// Kalıcı hata: MAX_DELIVERY_ATTEMPTS aşılınca kuyrukta sonsuza dek dönmemeli.
	providerModule.betinoviAdminRequest = async () => { throw new Error("provider down"); };
	const deadUser = new mongoose.Types.ObjectId();
	const deadSelection = await engine.selectBonus({ userId: deadUser, contentId: fsBonus._id });
	created.states.push(deadSelection.state._id);
	// Yalnızca HÂLÂ bekleyen kayıtların zamanını öne al; kalıcı hataya düşen
	// kaydın nextDeliveryAt'ini test ezmemeli ki motorun temizlediği görülebilsin.
	for (let i = 0; i < engine.MAX_DELIVERY_ATTEMPTS + 2; i += 1) {
		const moved = await CasinoUserState.updateOne(
			{ _id: deadSelection.state._id, status: "delivery-pending" },
			{ $set: { nextDeliveryAt: new Date(Date.now() - 1000) } }
		);
		if (!moved.modifiedCount && !moved.matchedCount) break;
		await engine.processDeliveryQueue();
	}
	const deadState = await CasinoUserState.findById(deadSelection.state._id);
	check("Maksimum denemeden sonra 'delivery-failed'", deadState.status === "delivery-failed", `status=${deadState.status}`);
	check("Kalıcı hatada yeniden deneme planlanmaz", deadState.nextDeliveryAt === null, `next=${deadState.nextDeliveryAt}`);
	const afterDead = await engine.processDeliveryQueue();
	check("Kalıcı hatalı kayıt kuyrukta dönmez", afterDead.processed === 0, `processed=${afterDead.processed}`);

	// Admin manuel yeniden deneme: sağlayıcı düzelince teslim tamamlanmalı.
	providerModule.betinoviAdminRequest = async () => ({ status: 0, msg: "SUCCESS" });
	await engine.retryDelivery({ stateId: deadSelection.state._id });
	const revived = await CasinoUserState.findById(deadSelection.state._id);
	check("Admin retry kalıcı hatayı kurtarır", revived.status === "claimed", `status=${revived.status}`);
	providerModule.betinoviAdminRequest = realRequest;

	// Admin iptali: kayıt kuyruktan düşer.
	const cancelUser = new mongoose.Types.ObjectId();
	const cancelState = await CasinoUserState.create({
		user: cancelUser, content: fsBonus._id, kind: "bonus", status: "delivery-failed", periodKey: "cancel-test",
	});
	created.states.push(cancelState._id);
	const cancelled = await engine.cancelDelivery({ stateId: cancelState._id, reason: "test" });
	check("Admin iptali durumu 'rejected' yapar", cancelled.status === "rejected", `status=${cancelled.status}`);

	// ---------------------------------------------- 6) Süre aşımı taraması
	console.log("\n6) Süresi dolan seçimlerin kapatılması");
	const staleUser = new mongoose.Types.ObjectId();
	const stale = await CasinoUserState.create({
		user: staleUser, content: bonus._id, kind: "bonus", status: "awaiting-deposit",
		periodKey: "expired-test", expiresAt: new Date(Date.now() - 60000),
	});
	created.states.push(stale._id);
	await engine.expireStaleStates();
	const staleAfter = await CasinoUserState.findById(stale._id);
	check("Süresi dolan seçim 'expired' olur", staleAfter.status === "expired", `status=${staleAfter.status}`);

	const claimedStill = await CasinoUserState.findById(fsSelection.state._id);
	check("Süre aşımı taraması teslim edilmiş kayda dokunmaz", claimedStill.status === "claimed", `status=${claimedStill.status}`);

	// --------------------------------------------- 7) Global event defteri
	console.log("\n7) Global olay defteri");
	const dupes = await CasinoRewardEvent.countDocuments({ user: userId, eventKey: "test:wager:1" });
	check("Aynı eventKey defterde tek kayıt", dupes === 1, `count=${dupes}`);

	const ledger = await CasinoRewardEvent.find({ user: userId }).select("_id").lean();
	created.events = ledger.map((doc) => doc._id);

	console.log(`\n${passed} geçti, ${failed} başarısız`);
}

async function cleanup() {
	// Test verisinin tamamı geri alınır.
	const states = await CasinoUserState.deleteMany({
		$or: [{ content: { $in: created.contents } }, { _id: { $in: created.states } }],
	});
	const events = await CasinoRewardEvent.deleteMany({ _id: { $in: created.events } });
	const contents = await CasinoContent.deleteMany({ _id: { $in: created.contents } });
	const grants = await FreeSpinGrant.deleteMany({ sourceContent: { $in: created.contents } });
	console.log(`Temizlik: ${contents.deletedCount} içerik, ${states.deletedCount} durum, ${events.deletedCount} olay, ${grants.deletedCount} freespin kaydı silindi`);
}

main()
	.catch((error) => {
		failed += 1;
		console.error("\nBetik hatası:", error);
	})
	.finally(async () => {
		await cleanup().catch((error) => console.error("Temizlik hatası:", error.message));
		await mongoose.disconnect().catch(() => {});
		if (memoryServer) await memoryServer.stop().catch(() => {});
		process.exit(failed > 0 ? 1 : 0);
	});
