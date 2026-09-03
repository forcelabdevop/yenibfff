// Gerçek bir oyun listesi, veritabanından `distribution` alanına göre
// gruplanır. Burada sadece 5 sağlayıcıyı temsil eden birer demo kart var.
const DEMO_GAMES = [
	{ provider: "betinovi", gameCode: "sweet-bonanza", vendorCode: "pragmatic", label: "Sweet Bonanza", sub: "Betinovi (seamless wallet)" },
	{ provider: "drakon", gameCode: "fortune-tiger", label: "Fortune Tiger", sub: "Drakon (OAuth Bearer)" },
	{ provider: "nexus", gameCode: "gates-of-olympus", vendorCode: "pragmatic", label: "Gates of Olympus", sub: "Nexus (seamless wallet)" },
	{ provider: "poker", gameCode: "texas-holdem", label: "Texas Hold'em", sub: "Poker (Basic auth → Bearer)" },
	{ provider: "betcolabs", gameCode: "live-sports", label: "Canlı Bahis", sub: "Betcolabs (session_token)" },
];

const DEMO_USER_ID = "demo-user-1";

const grid = document.getElementById("game-grid");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("modal-overlay");
const frame = document.getElementById("modal-frame");
const modalTitle = document.getElementById("modal-title");
const closeBtn = document.getElementById("modal-close");

function renderGrid() {
	grid.innerHTML = "";
	for (const game of DEMO_GAMES) {
		const card = document.createElement("div");
		card.className = "card";
		card.innerHTML = `
			<h3>${game.label}</h3>
			<p>${game.sub}</p>
			<span class="badge">${game.provider}</span>
		`;
		card.addEventListener("click", () => launchGame(game));
		grid.appendChild(card);
	}
}

async function launchGame(game) {
	statusEl.textContent = `${game.label} başlatılıyor...`;

	try {
		const response = await fetch("/api/games/launch", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				userId: DEMO_USER_ID,
				provider: game.provider,
				gameCode: game.gameCode,
				vendorCode: game.vendorCode,
				channel: "desktop",
				language: "tr",
			}),
		});

		const data = await response.json();

		if (!data.success) {
			statusEl.textContent = `Hata: ${data.error} — ${data.details || ""}`;
			return;
		}

		statusEl.textContent = `${game.label} başlatıldı (${data.provider}).`;
		openModal(game.label, data.launchUrl);
	} catch (err) {
		statusEl.textContent = `İstek başarısız: ${err.message}`;
	}
}

function openModal(title, url) {
	modalTitle.textContent = title;
	frame.src = url;
	overlay.classList.add("open");
}

function closeModal() {
	overlay.classList.remove("open");
	frame.src = "about:blank";
}

closeBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
	if (e.target === overlay) closeModal();
});

// Gerçek projedeki safePostToParent deseninin küçük bir örneği: iframe
// içindeki oyun sayfası (veya bir cüzdan eklentisi) window.postMessage
// gönderdiğinde, bunu try/catch içinde işleyip üst sayfanın çökmesini
// önlüyoruz.
window.addEventListener("message", (event) => {
	try {
		if (!event.data || event.data.source !== "game-frame") return;
		console.log("[game-launch-example] iframe mesajı:", event.data);
	} catch (err) {
		console.warn("[game-launch-example] mesaj işlenemedi:", err);
	}
});

renderGrid();
