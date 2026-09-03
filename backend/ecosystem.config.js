require("dotenv").config();

const websiteName = String(process.env.WEBSITE_NAME || "website").trim();
const projectId = String(process.env.PROJECT_ID || "local").trim();

module.exports = {
	apps: [
		{
			name: `${projectId}-${websiteName}-backend`,
			// DIKKAT: Giris dosyasi index.js'tir. Onceden "app.js" yaziyordu ama
			// boyle bir dosya yok — pm2 start/reload aninda "Script not found"
			// ile cokuyordu. Giris dosyasini tasirsaniz burayi da guncelleyin.
			script: "index.js",
			exec_mode: "cluster",
			// DIKKAT: Socket.IO (chat, admin panel bildirimleri, admin-panel
			// namespace'i) HTTP long-polling oturumunu (sid) ilk isteği alan
			// worker'in BELLEGINDE tutar. PM2 cluster modu gelen HTTP
			// isteklerini worker'lar arasinda round-robin dagitir ve hicbir
			// sticky-session/Redis adapter kurulmadigi icin ayni socket'in
			// sonraki polling isteği FARKLI bir worker'a düşünce o worker
			// "Session ID unknown" der ve engine.io 400 Bad Request döner —
			// tam olarak admin panelindeki "xhr poll/post error" / "transport
			// error" döngüsünün sebebi budur (instances=4 iken). Redis adapter
			// + sticky routing kurulana kadar instances=1 ile calistirmak,
			// tüm socket.io trafiğinin ayni process'te kalmasini garanti eder.
			instances: 1,
			// Zero-downtime reload: yeni instance "ready" olmadan eskisi
			// oldurulmez. index.js dinlemeye baslayinca pm2'ye haber verir.
			wait_ready: false,
			listen_timeout: 10000,
			kill_timeout: 5000,
			max_memory_restart: "1G",

			// PM2'nin pes etmesini engeller.
			//
			// Varsayilan max_restarts 16'dir. Atlas birkac saniye erisilemez
			// oldugunda dort worker da hizla olup yeniden basliyor, 16 deneme
			// saniyeler icinde tukeniyor ve PM2 uygulamayi "errored" isaretleyip
			// BIRAKIYORDU. Site, biri elle `pm2 restart` yazana kadar kapali
			// kaliyordu — nginx logundaki 2,8 saatlik kesintinin sebebi buydu.
			//
			// exp_backoff_restart_delay: yeniden baslatmalar arasi bekleme her
			// denemede artar (100ms -> ... -> ~15sn tavan). Bu, deneme butcesini
			// saniyeler yerine saatlere yayar; gecici bir kesinti artik kalici
			// bir durusa donusemez.
			max_restarts: 50,
			exp_backoff_restart_delay: 100,
			// Bu sureden uzun ayakta kalan surec "saglikli" sayilir ve yeniden
			// baslatma sayaci sifirlanir. Aksi halde aylar icinde biriken
			// bagimsiz cokmeler butceyi yavas yavas tuketirdi.
			min_uptime: 30000,
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
