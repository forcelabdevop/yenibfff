// Puppeteer config hatası için geçici çözüm - dotenv'den ÖNCE ayarlanmalı
process.env.XDG_CONFIG_HOME = "/tmp";
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true";
process.env.PUPPETEER_CACHE_DIR = "/tmp/puppeteer";

require("dotenv").config();

/**
 * Surec seviyesi hata yakalayicilar — mumkun olan en erken noktada kurulur ki
 * baslangic sirasindaki hatalari da yakalayabilsinler.
 *
 * Bunlar olmadan yakalanmamis bir promise reddi Node 16+ uzerinde sureci
 * SESSIZCE sonlandiriyordu: nginx logunda yalnizca "Connection refused"
 * goruluyor, sebep hicbir yere yazilmiyordu.
 *
 * Davranis farki bilincli:
 *  - unhandledRejection: loglanir, surec YASAR. Genelde tek bir istegin
 *    hatasidir; tum siteyi dusurmesi icin sebep yok.
 *  - uncaughtException: loglanir ve surec KONTROLLU sekilde biter. Bu
 *    noktada uygulama durumu guvenilmezdir; PM2 temiz bir worker baslatir.
 */
process.on("unhandledRejection", (reason) => {
	const detail = reason instanceof Error ? reason.stack : String(reason);
	console.error(`[unhandledRejection] ${detail}`);
});

process.on("uncaughtException", (err) => {
	console.error(`[uncaughtException] ${err.stack || err.message}`);
	// Cikmadan once loglarin diske yazilmasina firsat ver.
	setTimeout(() => process.exit(1), 100).unref();
});

const path = require("path");
const express = require("express");
const http = require("http");
const hpp = require("hpp");
const cors = require("cors");
const socket = require("socket.io");
const apiRoutes = require("./routes/api");
const cron = require("node-cron");
const { getClientIp } = require("./utils/ip");
// const { initTelegramBot } = require("./utils/telegramBot");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
	process.env.SERVER_FRONTEND_URL, // http://localhost:8080
	process.env.SERVER_ADMIN_URL, // http://localhost:5173
	...((process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()) ||
		[]),
];
const isProduction = process.env.NODE_ENV === "production";

// Geliştirme/önizleme ortamlarında (v0 sandbox, preview tünelleri vb.) origin
// önceden bilinemez ve her oturumda değişebilir; bu nedenle prod DIŞINDA
// gelen origin'i olduğu gibi yansıtıyoruz. Production'da ise sadece
// allowedOrigins listesindeki origin'lere izin veriyoruz.
const isOriginAllowed = (origin) => {
	if (!origin) return true;
	if (!isProduction) return true;
	return allowedOrigins.includes(origin);
};

app.use(
	cors({
		origin: function (origin, callback) {
			callback(null, isOriginAllowed(origin));
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		optionsSuccessStatus: 200,
	}),
);

const io = socket(server, {
	cors: {
		origin: function (origin, callback) {
			callback(null, isOriginAllowed(origin));
		},
		credentials: true,
	},
});
io.engine.use((req, res, next) => {
	req.headers["cf-connecting-ip"] = getClientIp(req);
	next();
});
app.set("io", io);
require("./utils/io").init(io);

//initTelegramBot(io);

// Bilincli olarak beklenmiyor (await): sunucu, veritabani hazir olmadan da
// dinlemeye baslar. /health ucu readyState'i kontrol ettigi icin yuk
// dengeleyici hazir olmayan instance'a trafik gondermez.
// .catch() sart: bagli olmayan bir promise reddi sureci sessizce oldururdu.
require("./database")().catch((err) => {
	console.error(`Veritabani baslangici basarisiz: ${err.stack || err.message}`);
});
require("./utils/setting").settingInitDatabase();

// Initialize avatar helper (preload fallback cache)
require("./utils/avatar").initAvatarHelper();

const parseTrustProxy = (value) => {
	if (value === undefined || value === "") return 2;
	if (value === "true") return true;
	if (value === "false") return false;
	const numericValue = Number(value);
	return Number.isNaN(numericValue) ? value : numericValue;
};

// Cloudflare + nginx means Express needs to trust two proxy hops by default.
app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

// Set other middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(hpp());

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 🩺 Sağlık kontrolü — kimlik doğrulaması YOK, kasıtlı olarak halka açık.
//
// KONUM KRİTİK: bu tanım, aşağıdaki `app.use("/", routes)` satırından ÖNCE
// gelmek ZORUNDA. routes/index.js sonunda her isteği yakalayan bir 404
// handler var (`router.use(...)` → {"success":false,"message":"Endpoint not
// found"}). Express sırayla eşleştirdiği için, /health o mount'tan sonra
// tanımlanırsa catch-all onu yutar ve uç ERİŞİLEMEZ hale gelir.
//
// Bu gerçekten yaşandı: /health mount'tan sonra tanımlanmıştı, dolayısıyla
// her zaman 404 dönüyordu. deploy.sh 200 beklediği için (scripts/deploy.sh:241)
// otomatik dağıtım her seferinde sağlık kontrolünde kalıp GERİ ALINIRDI.
//
// deploy.sh bu ucu kullanır. Bu yüzden UCUZ olmalı — ağır sorgu veya dış
// servis çağrısı EKLEMEYİN, yoksa her dağıtımda yanlış alarm verir.
//
// Veritabanı bağlı değilse 503 döner; süreç ayakta ama iş göremez durumdadır
// ve yük dengeleyici/deploy script'i bunu başarısızlık saymalıdır.
app.get("/health", (req, res) => {
	const mongoose = require("mongoose");
	// 1 = connected, 2 = connecting
	const dbReady = mongoose.connection && mongoose.connection.readyState === 1;
	res.status(dbReady ? 200 : 503).json({
		ok: dbReady,
		db: dbReady ? "up" : "down",
		// Dağıtım sonrası "hangi sürüm canlıda?" sorusunu yanıtlar.
		commit: process.env.GIT_COMMIT || "unknown",
		uptime: Math.round(process.uptime()),
		pid: process.pid,
	});
});

// Mount routes
app.use("/", require("./routes")(io));
app.use("/public", express.static(path.join(__dirname, "public")));

// 🌍 Site genelinde aktif kullanıcı takibi
// Not: Set kendisi burada tutuluyor (yerel emit sayacı için), ama gerçek
// User ObjectId'leri de utils/io.js'teki merkezi sete yazılıyor — Notice
// segmentasyonu (audience: "online"/"offline") bunu okur.
const onlineUsers = new Set();
const ioUtils = require("./utils/io");

io.on("connection", (socket) => {
	// console.log("🌍 Yeni ziyaretçi bağlandı:", socket.id);

	// Eğer kullanıcı login olmuşsa token'dan userId gönder
	const userId = socket.handshake.auth?.userId || socket.id;
	onlineUsers.add(userId);
	ioUtils.addOnlineUser(userId);

	// herkese gönder
	io.emit("siteOnline", { online: onlineUsers.size });

	socket.on("disconnect", () => {
		onlineUsers.delete(userId);
		ioUtils.removeOnlineUser(userId);
		io.emit("siteOnline", { online: onlineUsers.size });
		// console.log("❌ Kullanıcı ayrıldı:", userId);
	});
});

// Mount sockets (namespace’ler burada açılıyor)
require("./sockets")(io);

// ✅ Döviz güncelleyici cron job
const { updateExchangeRates } = require("./utils/exchangeUpdater");

// Sunucu açıldığında bir defa çalıştır
updateExchangeRates();

// Her gün saat 03:00'te çalıştır
cron.schedule("0 3 * * *", () => {
	updateExchangeRates();
});

// 🎟️ Bilet Etkinliği: onaylanmış yatırımları tarayıp bilet üretir (her dakika)
const { syncApprovedDeposits } = require("./services/ticketService");
cron.schedule("* * * * *", () => {
	syncApprovedDeposits().catch((err) =>
		console.error("❌ Ticket sync hatası:", err.message)
	);
});

// 🏁 Çevrim Turnuvası (Race): durum geçişleri + manuel katılımcı otomatik artışı (her dakika)
const raceService = require("./services/raceService");
cron.schedule("* * * * *", () => {
	raceService.advanceTournamentStates().catch((err) =>
		console.error("❌ Race durum güncelleme hatası:", err.message)
	);
	raceService.tickManualEntries().catch((err) =>
		console.error("❌ Race manuel katılımcı artış hatası:", err.message)
	);
});

// ⚽ Spor Turnuvası (manuel): durum geçişleri + süresi bitenlerin sonuçlandırılması (her dakika)
const sportsTournamentService = require("./services/sportsTournamentService");
cron.schedule("* * * * *", () => {
	sportsTournamentService.advanceTournamentStates().catch((err) =>
		console.error("❌ Spor Turnuvası durum güncelleme hatası:", err.message)
	);
});

// 🎁 Casino ödül motoru: sağlayıcıya teslim edilemeyen bonus ödüllerini (free
// spin vb.) üstel geri çekilme ile yeniden dener + süresi dolan seçimleri kapatır.
const casinoRewardEngine = require("./services/casinoRewardEngine");
cron.schedule("* * * * *", () => {
	casinoRewardEngine
		.processDeliveryQueue()
		.catch((err) =>
			console.error("❌ Casino bonus teslim kuyruğu hatası:", err.message),
		);
	casinoRewardEngine
		.expireStaleStates()
		.catch((err) =>
			console.error("❌ Casino bonus süre aşımı taraması hatası:", err.message),
		);
});

// 🪙 TRON yatırma izleyicisi: kendi HD adreslerimize gelen transferleri tespit
// eder ve onay eşiği aşıldığında bakiyeye ekler.
//
// GÜVENLİK: Bu cron 4 PM2 instance'ının HEPSİNDE kurulur; mükerrer kredi
// koruması servisin kendi içindeki JobLock leader-election'ı ile sağlanır
// (services/cryptoDepositWatcher.js). Buraya ek bir instance kontrolü
// EKLEMEYİN — kilit zaten tek çalıştırıcıyı garanti eder ve kilidi tutan
// instance çökerse süre dolunca bir diğeri devralır.
const cryptoDepositWatcher = require("./services/cryptoDepositWatcher");
cron.schedule("* * * * *", () => {
	cryptoDepositWatcher
		.runOnce()
		.catch((err) =>
			console.error("❌ Kripto yatırma tarama hatası:", err.message),
		);
});

// Set app port
const PORT = process.env.SERVER_PORT || 5000;

server.listen(PORT, () =>
	console.log(
		`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`,
	),
);
