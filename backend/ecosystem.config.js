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
			instances: 4,
			// Zero-downtime reload: yeni instance "ready" olmadan eskisi
			// oldurulmez. index.js dinlemeye baslayinca pm2'ye haber verir.
			wait_ready: false,
			listen_timeout: 10000,
			kill_timeout: 5000,
			max_memory_restart: "1G",
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
