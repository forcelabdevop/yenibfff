/**
 * referans casino arayüzü sayfasının birebir klonu için gereken, backend'de
 * karşılığı olmayan görsel/gösterim verileri: üst promo carousel'i, sekme
 * çubuğu, raf tanımları, "Get Bonus" katmanları, sağlayıcı kartları, bahis
 * tablosu satırları ve SEO metinleri.
 *
 * Buradaki tutarlar/oranlar gerçek bahis veya kazanç temsil etmez; yalnızca
 * referans düzeni doldurmak içindir. Gerçek oyun verisi geldiğinde raflar
 * backend kategorileriyle beslenir, bu set yalnızca yedek olarak kalır.
 */

import {WEBSITE_NAME} from "@/lib/config";

const A = "/casino-assets";

/* -------------------------------------------------------------------------- */
/* Üst promo carousel                                                          */
/* -------------------------------------------------------------------------- */

export interface CasinoPromo {
	id: string;
	/** Sol üstte gösterilen küçük durum etiketi (ör. "5 GÜN KALDI"). */
	flag?: string;
	title: string;
	/** Başlığın altındaki tek satırlık destek metni. */
	subtitle?: string;
	/** Turnuva kartlarındaki sıralama bilgisi. */
	rank?: string;
	/** Ödül havuzu rozeti. */
	prize?: string;
	/** Ödül havuzu rozetinin sağındaki ek kazanç etiketi. */
	prizeExtra?: string;
	image: string;
	/** Kartın zemin gradyanı — referanstaki renk sırasını taklit eder. */
	gradient: string;
	href: string;
}

export const CASINO_PROMOS: CasinoPromo[] = [
	{
		id: "welcome",
		title: "HOŞ GELDİN BONUSU %590'A KADAR",
		subtitle: "+225 Ücretsiz Spin",
		image: `${A}/hero-welcome-banner.jpeg`,
		gradient: "linear-gradient(100deg, #7d0f2b 0%, #b81440 48%, #e01d52 100%)",
		href: "/promotions",
	},
	{
		id: "missions",
		title: "GÖREVLERİ TAMAMLA — ÖDÜLLERİ KAP",
		image: "/banners/elite-battle.png",
		gradient: "linear-gradient(100deg, #2a1350 0%, #46208a 52%, #6b2fd0 100%)",
		href: "/promotions",
	},
	{
		id: "elite",
		flag: "5 GÜN KALDI",
		title: "ELİT STRATEJİ SAVAŞI",
		rank: "Sıra 9-13",
		prize: "$15,000",
		prizeExtra: "+1000 FS",
		image: "/banners/battles.png",
		gradient: "linear-gradient(100deg, #4a0d1c 0%, #8c1226 50%, #c2172f 100%)",
		href: "/contests",
	},
	{
		id: "cashback",
		title: "HER HAFTA %25 NAKİT İADE",
		subtitle: "Kaybının bir kısmı her pazartesi geri gelir",
		image: "/banners/casino-slots.png",
		gradient: "linear-gradient(100deg, #0d3352 0%, #14588c 52%, #1c86cf 100%)",
		href: "/promotions",
	},
	{
		id: "originals",
		title: "ORIGINALS'TA %99.28 RTP",
		subtitle: "Sadece bize özel 24 oyun",
		image: "/banners/originals.png",
		gradient: "linear-gradient(100deg, #0c3d33 0%, #14705c 52%, #1aa37f 100%)",
		href: "/casino",
	},
	{
		id: "vip",
		flag: "VIP",
		title: "SEVİYE ATLA, ÖDÜL TOPLA",
		subtitle: "Her bahis seni bir üst kademeye taşır",
		image: "/banners/mascot.png",
		gradient: "linear-gradient(100deg, #3d2a06 0%, #8a5f0c 52%, #d19a17 100%)",
		href: "/vip",
	},
];

/* -------------------------------------------------------------------------- */
/* Sekme çubuğu                                                                */
/* -------------------------------------------------------------------------- */

export type CasinoTabId = "lobby" | "originals" | "slots" | "live" | "table";

export interface CasinoTab {
	id: CasinoTabId;
	label: string;
	/** Yalnız Lobi sekmesinde görünen toplam oyun rozeti. */
	count?: string;
	icon: string;
}

export const CASINO_TABS: CasinoTab[] = [
	{id: "lobby", label: "Lobi", count: "13b", icon: "gamepad"},
	{id: "originals", label: "Originals", count: undefined, icon: "sparkles"},
	{id: "slots", label: "Slotlar", count: undefined, icon: "cherry"},
	{id: "live", label: "Canlı", count: undefined, icon: "radio"},
	{id: "table", label: "Masa", count: undefined, icon: "dices"},
];

/* -------------------------------------------------------------------------- */
/* Oyun havuzu — raflar için yedek içerik                                      */
/* -------------------------------------------------------------------------- */

export interface FallbackGame {
	id: string;
	name: string;
	provider: string;
	image: string;
	badge?: "HOT" | "TOP";
	rtp?: number;
}

const SLOT_POOL: Array<[string, string, string]> = [
	["Sugar Rush Super Scatter", "Pragmatic Play", "slot-sugar-rush-super-scatter"],
	["Sweet Bonanza 2500", "Pragmatic Play", "slot-sweet-bonanza-2500"],
	["Merge Up", "BGaming", "slot-merge-up"],
	["Clash of Gods", "BGaming", "slot-clash-of-gods"],
	["Starlight Princess 1000", "Pragmatic Play", "slot-starlight-princess-1000"],
	["Gates of Olympus", "Pragmatic Play", "slot-gates-of-olympus"],
	["Burning Coins 100", "Endorphina", "slot-burning-coins-100"],
	["Alien Fruits", "BGaming", "slot-alien-fruits"],
	["Fortune Bass", "Belatra Games", "slot-danludans-fortune-bass"],
	["Lady Wolf Moon", "BGaming", "slot-lady-wolf-moon"],
	["Wild Zombies", "Popiplay", "slot-wild-zombies"],
	["Sons of Monarchy", "Popiplay", "slot-sons-of-monarchy"],
	["Death Becomes You", "Hacksaw Gaming", "slot-death-becomes-you"],
	["Blazing Coins Hold and Win", "Popiplay", "slot-blazing-coins"],
	["Beauty and the Beast", "Belatra Games", "slot-beauty-and-the-beast"],
	["Le Bunny", "Hacksaw Gaming", "slot-le-bunny"],
	["Big Bang", "Belatra Games", "slot-big-bang"],
	["Dogmasons MegaWOOF", "Popiplay", "slot-dogmasons-megawoof"],
	["Le Football Fan", "Hacksaw Gaming", "slot-le-football-fan"],
	["Baba Yaga Tales", "Spinomenal", "slot-baba-yaga-tales"],
];

const ORIGINAL_POOL: Array<[string, string]> = [
	["Dice", "original-dice"],
	["Limbo", "original-limbo"],
	["Mines", "original-mines"],
	["Plinko", "original-plinko"],
	["Crash", "original-crash"],
	["Keno", "original-keno"],
	["Hilo", "original-hilo"],
	["Tower", "original-tower"],
	["Stairs", "original-stairs"],
	["Coinflip", "original-coinflip"],
	["Ring", "original-ring"],
	["Circle", "original-circle"],
	["Triple", "original-triple"],
	["Space Dice", "original-spacedice"],
	["Lite Crash", "original-litecrash"],
	["Heist", "original-heist"],
	["Pharaoh", "original-pharaoh"],
	["Wild", "original-wild"],
	["Cryptos", "original-cryptos"],
	["Futures", "original-futures"],
];

/**
 * Masa/canlı rafları için havuz. Elimizde dört gerçek masa görseli var; bunları
 * 14 kartlık raflarda döngüye sokmak aynı kartın defalarca tekrarlanmasına yol
 * açıyordu. Görsel çeşitliliği korumak için havuza tematik olarak masa oyunuyla
 * uyumlu diğer gerçek varlıklar da eklendi.
 */
const TABLE_POOL: Array<[string, string, string]> = [
	["Blackjack 26", "Pragmatic Play", "slot-blackjack-26"],
	["Bac Bo", "Evolution", "slot-bac-bo"],
	["Roulette", WEBSITE_NAME, "original-roulette"],
	["Blackjack", WEBSITE_NAME, "original-blackjack"],
	["Hilo", WEBSITE_NAME, "original-hilo"],
	["Keno", WEBSITE_NAME, "original-keno"],
	["Coinflip", WEBSITE_NAME, "original-coinflip"],
	["Ring of Fortune", WEBSITE_NAME, "original-ring"],
	["Circle", WEBSITE_NAME, "original-circle"],
	["Triple", WEBSITE_NAME, "original-triple"],
	["Dice", WEBSITE_NAME, "original-dice"],
	["Space Dice", WEBSITE_NAME, "original-spacedice"],
	["Cryptos", WEBSITE_NAME, "original-cryptos"],
	["Futures", WEBSITE_NAME, "original-futures"],
];

/** Havuz bir turu tamamladığında adları ayrıştırmak için kullanılan ekler. */
const VARIANTS = ["", " II", " Deluxe", " Megaways", " Bonus Buy", " Xmas", " Gold"];

/**
 * Bir raf için deterministik yedek oyun listesi üretir.
 *
 * Havuzda basitçe `offset + i` ile ilerlemek, art arda gelen rafların büyük
 * ölçüde aynı sırayı paylaşmasına yol açıyordu. Bunun yerine havuz boyutuyla
 * aralarında asal bir adımla dolaşılır; böylece her raf havuzun tamamını farklı
 * bir sırayla gezer. Havuz tükenip başa döndüğünde de ada bir varyant eki
 * gelir, dolayısıyla aynı kart birebir tekrar etmez. Tüm hesap saf ve
 * deterministik olduğundan sunucu/istemci render'ları uyuşur.
 */
function buildFallback(kind: "slots" | "originals" | "table", offset: number, count: number): FallbackGame[] {
	const games: FallbackGame[] = [];
	const pool = kind === "originals" ? ORIGINAL_POOL : kind === "table" ? TABLE_POOL : SLOT_POOL;
	const size = pool.length;
	// Havuz boyutuyla aralarında asal bir adım seç: her raf havuzu farklı gezer.
	const step = size % 3 === 0 ? (size % 2 === 0 ? 5 : 2) : 3;

	for (let i = 0; i < count; i += 1) {
		const badge: FallbackGame["badge"] = i % 7 === 3 ? "HOT" : i < 6 ? "TOP" : undefined;
		const rtp = 95 + ((offset + i * 7) % 450) / 100;
		const index = (offset + i * step) % size;
		// Kaçıncı tur olduğumuz: havuz başa sardıkça ad varyantı değişir.
		const lap = Math.floor((offset + i * step) / size) % VARIANTS.length;
		const suffix = VARIANTS[lap];

		const entry = pool[index];
		const name = entry[0];
		const file = entry[entry.length - 1];
		const provider = kind === "originals" ? WEBSITE_NAME : (entry[1] as string);

		games.push({
			id: `${kind}-${offset}-${i}`,
			name: `${name}${suffix}`,
			provider,
			image: `${A}/${file}.jpeg`,
			badge,
			rtp,
		});
	}

	return games;
}

/* -------------------------------------------------------------------------- */
/* Raf tanımları — referanstaki sıra ve başlıklar                              */
/* -------------------------------------------------------------------------- */

export type RailIcon = "cherry" | "sparkles" | "flame" | "radio" | "crown" | "clapperboard" | "gem" | "target" | "spade" | "star";

export interface CasinoRailDef {
	id: string;
	title: string;
	icon: RailIcon;
	total: number;
	/** Originals rafındaki "RTP %99.28'e kadar" tipi vurgu rozeti. */
	badge?: string;
	/** Backend kategorisiyle eşleşmesi denenecek anahtar kelimeler. */
	match: string[];
	games: FallbackGame[];
}

/** "Get Bonus" bannerından önce gelen raflar. */
export const CASINO_RAILS_TOP: CasinoRailDef[] = [
	{
		id: "slots",
		title: "Slotlar",
		icon: "cherry",
		total: 10777,
		match: ["slot"],
		games: buildFallback("slots", 0, 14),
	},
	{
		id: "originals",
		title: `${WEBSITE_NAME} Originals`,
		icon: "sparkles",
		total: 24,
		badge: "RTP %99.28'e kadar",
		match: ["original", "özel"],
		games: buildFallback("originals", 0, 14),
	},
	{
		id: "hot",
		title: "Öne Çıkanlar",
		icon: "flame",
		total: 35,
		match: ["popüler", "hot", "featured"],
		games: buildFallback("slots", 6, 14),
	},
];

/** "Battles & Tournaments" bölümünden sonra gelen raflar. */
export const CASINO_RAILS_BOTTOM: CasinoRailDef[] = [
	{
		id: "live",
		title: "Canlı Casino",
		icon: "radio",
		total: 1154,
		match: ["canlı", "live"],
		games: buildFallback("table", 0, 14),
	},
	{
		id: "highroller",
		title: "Highroller Hall",
		icon: "crown",
		total: 124,
		match: ["highroller", "vip"],
		games: buildFallback("slots", 11, 14),
	},
	{
		id: "gameshows",
		title: "Oyun Şovları",
		icon: "clapperboard",
		total: 36,
		match: ["şov", "show"],
		games: buildFallback("table", 2, 14),
	},
	{
		id: "exclusives",
		title: `${WEBSITE_NAME} Özel`,
		icon: "gem",
		total: 48,
		match: ["exclusive", "özel"],
		games: buildFallback("originals", 7, 14),
	},
	{
		id: "roulette",
		title: "Rulet",
		icon: "target",
		total: 214,
		match: ["rulet", "roulette"],
		games: buildFallback("table", 1, 14),
	},
	{
		id: "blackjack",
		title: "Blackjack",
		icon: "spade",
		total: 186,
		match: ["blackjack"],
		games: buildFallback("table", 3, 14),
	},
	{
		id: "new",
		title: "Yeni Çıkanlar",
		icon: "star",
		total: 320,
		match: ["yeni", "new"],
		games: buildFallback("slots", 3, 14),
	},
];

export const CASINO_RAILS: CasinoRailDef[] = [...CASINO_RAILS_TOP, ...CASINO_RAILS_BOTTOM];

/* -------------------------------------------------------------------------- */
/* Get Bonus banner                                                            */
/* -------------------------------------------------------------------------- */

export interface BonusTier {
	id: string;
	label: string;
	percent: string;
	freeSpins: string;
	/** İlk kademe referansta vurgulu (kırmızı CTA), diğerleri sönük. */
	highlighted: boolean;
}

export const BONUS_TIERS: BonusTier[] = [
	{id: "t1", label: "1. YATIRIM | 100₺'DEN", percent: "%150", freeSpins: "50 Ücretsiz Spin", highlighted: true},
	{id: "t2", label: "2. YATIRIM | 500₺'DEN", percent: "%180", freeSpins: "75 Ücretsiz Spin", highlighted: false},
	{id: "t3", label: "3. YATIRIM | 2500₺'DEN", percent: "%200", freeSpins: "100 Ücretsiz Spin", highlighted: false},
];

/* -------------------------------------------------------------------------- */
/* Sağlayıcılar                                                                */
/* -------------------------------------------------------------------------- */

export interface CasinoProvider {
	id: string;
	name: string;
	games: number;
}

export const CASINO_PROVIDERS: CasinoProvider[] = [
	{id: "system", name: WEBSITE_NAME, games: 24},
	{id: "100hp", name: "100HP Gaming", games: 29},
	{id: "beplay", name: "BePlay", games: 26},
	{id: "pragmatic", name: "Pragmatic Play", games: 1048},
	{id: "evolution", name: "Evolution", games: 586},
	{id: "bgaming", name: "BGaming", games: 272},
	{id: "hacksaw", name: "Hacksaw Gaming", games: 214},
	{id: "endorphina", name: "Endorphina", games: 178},
	{id: "belatra", name: "Belatra Games", games: 156},
	{id: "popiplay", name: "Popiplay", games: 94},
	{id: "spinomenal", name: "Spinomenal", games: 312},
	{id: "pgsoft", name: "PG Soft", games: 148},
];

export const CASINO_PROVIDERS_TOTAL = 75;

/* -------------------------------------------------------------------------- */
/* Battles & Tournaments                                                       */
/* -------------------------------------------------------------------------- */

export interface CasinoBattle {
	id: string;
	countdown: string;
	countdownLabel?: string;
	title: string;
	prize: string;
	/** Ödül rozetinin yanındaki turnuva tipi etiketi. */
	tag?: string;
	image: string;
	gradient: string;
	/** Kart altındaki liderlik tablosu sütun başlıkları. */
	columns: [string, string, string];
	rows: Array<{place: string; player: string; value: string; prize: string}>;
}

export const CASINO_BATTLES: CasinoBattle[] = [
	{
		id: "community",
		countdown: "05:36:20",
		title: `${WEBSITE_NAME} Community Battle`,
		prize: "$150",
		image: "/banners/community-battle.png",
		gradient: "linear-gradient(115deg, #760d29 0%, #b50f36 58%, #241523 100%)",
		columns: ["Sıra", "Oyuncu · Kâr", "Ödül"],
		rows: [
			{place: "1", player: "User6903218", value: "2270500.00", prize: "$19.50"},
			{place: "2", player: "User7937897", value: "1130306.48", prize: "$10.50"},
			{place: "3", player: "User4989497", value: "454033.35", prize: "$4.50"},
		],
	},
	{
		id: "elite",
		countdown: "01:36:20",
		countdownLabel: "5 Gün",
		title: "Elite Strategy Battle",
		prize: "$15 000",
		tag: "+ BONUSLAR",
		image: "/banners/battle-strategy.png",
		gradient: "linear-gradient(115deg, #3d1227 0%, #8f1235 60%, #301524 100%)",
		columns: ["Sıra", "Oyuncu · Bahis", "Ödül"],
		rows: [
			{place: "1", player: "AZquarious", value: "$272,921.68", prize: "$3 000 · +100 FS"},
			{place: "2", player: "Fatstack", value: "$180,564.17", prize: "$2 250 · +100 FS"},
			{place: "3", player: "Kalashaa", value: "$144,716.04", prize: "$1 500 · +100 FS"},
		],
	},
	{
		id: "ladder",
		countdown: "01:36:20",
		countdownLabel: "1 Gün",
		title: "Sports Ladder Battle",
		prize: "$20 000",
		tag: "ÇARPAN",
		image: "/banners/battle-sports.png",
		gradient: "linear-gradient(115deg, #142d48 0%, #1261a4 58%, #17253a 100%)",
		columns: ["Sıra", "Oyuncu · Çarpan", "Ödül"],
		rows: [
			{place: "1", player: "0x00001", value: "6798.20", prize: "$10 000"},
			{place: "2", player: "byeyeyeye", value: "6287.54", prize: "$3 000"},
			{place: "3", player: "User8750005", value: "5809.47", prize: "$1 000"},
		],
	},
	{
		id: "master-spin",
		countdown: "01:36:20",
		title: "Master Spin Battle",
		prize: "$10 000",
		tag: "+ BONUSLAR",
		image: "/banners/battle-master-spin.png",
		gradient: "linear-gradient(115deg, #411728 0%, #7c1734 58%, #25141e 100%)",
		columns: ["Sıra", "Oyuncu · Bahis", "Ödül"],
		rows: [
			{place: "1", player: "User6800550", value: "$329,856.43", prize: "$4 000"},
			{place: "2", player: "User5616153", value: "$326,352.02", prize: "$2 500"},
			{place: "3", player: "User4953905", value: "$313,312.41", prize: "$1 250"},
		],
	},
];

/* -------------------------------------------------------------------------- */
/* Son büyük kazançlar                                                         */
/* -------------------------------------------------------------------------- */

export interface CasinoWin {
	id: string;
	game: string;
	image: string;
	amount: string;
	username: string;
}

export const CASINO_WINS: CasinoWin[] = [
	{id: "w1", game: "Dice", image: `${A}/original-dice.jpeg`, amount: "$1,310.80", username: "Mattosdias"},
	{id: "w2", game: "Limbo", image: `${A}/original-limbo.jpeg`, amount: "$4,660.64", username: "Mattosdias"},
	{id: "w3", game: "Crash", image: `${A}/original-crash.jpeg`, amount: "$1,335.08", username: "User8522571"},
	{id: "w4", game: "Mines", image: `${A}/original-mines.jpeg`, amount: "$1,046.09", username: "Chitirijr"},
	{id: "w5", game: "Plinko", image: `${A}/original-plinko.jpeg`, amount: "$7,275.30", username: "LUCKYPLAYER"},
	{id: "w6", game: "Keno", image: `${A}/original-keno.jpeg`, amount: "$1,062.44", username: "Fatstack"},
	{id: "w7", game: "Tower", image: `${A}/original-tower.jpeg`, amount: "$2,918.71", username: "JG6473"},
	{id: "w8", game: "Hilo", image: `${A}/original-hilo.jpeg`, amount: "$1,884.25", username: "User119427"},
	{id: "w9", game: "Stairs", image: `${A}/original-stairs.jpeg`, amount: "$3,401.66", username: "Abarotas"},
	{id: "w10", game: "Ring", image: `${A}/original-ring.jpeg`, amount: "$5,127.90", username: "Diihcasino"},
	{id: "w11", game: "Coinflip", image: `${A}/original-coinflip.jpeg`, amount: "$1,209.33", username: "User2076192"},
	{id: "w12", game: "Circle", image: `${A}/original-circle.jpeg`, amount: "$2,340.18", username: "User1912134"},
];

/* -------------------------------------------------------------------------- */
/* Bahis tablosu                                                               */
/* -------------------------------------------------------------------------- */

export type BetTabId = "all" | "high" | "rare";

export const BET_TABS: Array<{id: BetTabId; label: string; icon: string}> = [
	{id: "all", label: "Tüm Bahisler", icon: "coins"},
	{id: "high", label: "Yüksek Oyuncular", icon: "trending"},
	{id: "rare", label: "Nadir Kazançlar", icon: "sparkles"},
];

export interface CasinoBetRow {
	id: string;
	game: string;
	time: string;
	user: string;
	level: number;
	bet: string;
	multiplier: string;
	payout: string;
	/** Ödeme 0 ise satır kayıp sayılır ve sönük gösterilir. */
	won: boolean;
}

function buildBets(seed: number, count: number): CasinoBetRow[] {
	const games = ["Dice", "Limbo", "Mines", "Plinko", "Crash", "Keno", "Hilo", "Tower"];
	const users = ["diihcasino", "User2076192", "User1912134", "Abarotas", "Mattosdias", "Fatstack", "JG6473", "LUCKYPLAYER", "Chitirijr", "User119427"];
	const rows: CasinoBetRow[] = [];

	for (let i = 0; i < count; i += 1) {
		const n = seed + i * 13;
		const bet = 0.5 + ((n * 37) % 900) / 100;
		const mult = ((n * 53) % 5000) / 1000;
		const won = mult >= 1;
		const payout = won ? bet * mult : 0;
		const minute = 56 - ((seed + i) % 40);
		const second = 59 - ((n * 7) % 60);

		rows.push({
			id: `bet-${seed}-${i}`,
			game: games[n % games.length],
			time: `02:${String(Math.max(minute, 10)).padStart(2, "0")}:${String(Math.max(second, 10)).padStart(2, "0")}`,
			user: users[n % users.length],
			level: 5 + (n % 12),
			bet: `$${bet.toFixed(2)}`,
			multiplier: `x${mult.toFixed(3)}`,
			payout: `$${payout.toFixed(2)}`,
			won,
		});
	}

	return rows;
}

export const CASINO_BETS: Record<BetTabId, CasinoBetRow[]> = {
	all: buildBets(3, 10),
	high: buildBets(41, 10),
	rare: buildBets(77, 10),
};

/* -------------------------------------------------------------------------- */
/* SEO içeriği                                                                 */
/* -------------------------------------------------------------------------- */

export interface CasinoSeoBlock {
	heading: string;
	level: 2 | 3;
	paragraphs: string[];
}

export const CASINO_SEO_TITLE = `${WEBSITE_NAME} Kripto Casino Oyunlarını Oyna`;

export const CASINO_SEO_INTRO = `${WEBSITE_NAME}, 75'ten fazla sağlayıcının 10.000'i aşkın oyununu tek çatı altında toplayan bir kripto casino platformudur. Slotlardan canlı krupiyeli masalara, kendi geliştirdiğimiz Originals oyunlarından oyun şovlarına kadar her kategoride anında oynanabilir içerik bulursun.`;

export const CASINO_SEO_BLOCKS: CasinoSeoBlock[] = [
	{
		heading: "Casino Oyunlarımız Neden Öne Çıkıyor?",
		level: 2,
		paragraphs: [
			"Kütüphanemizdeki her oyun lisanslı sağlayıcılardan gelir ve bağımsız denetimden geçer. Oyun sonuçları sağlayıcının sertifikalı rastgele sayı üreteci tarafından belirlenir; platform bu sonuçlara müdahale edemez.",
		],
	},
	{
		heading: "Gelişmiş Kripto Ödemeleri ve Güvenlik",
		level: 3,
		paragraphs: [
			"Yatırım ve çekim işlemleri onlarca kripto para biriminde desteklenir. Cüzdan bakiyeleri soğuk depolamada tutulur, oturumlar uçtan uca şifreli bağlantı üzerinden yürütülür ve hesap erişimi iki adımlı doğrulama ile korunabilir.",
		],
	},
	{
		heading: "Şeffaf Algoritmalarla Adil Oyun",
		level: 3,
		paragraphs: [
			"Originals oyunlarımız provably fair mimarisiyle çalışır. Her turun sunucu tohumunu, istemci tohumunu ve sıra numarasını görebilir, sonucun oyun başlamadan önce belirlendiğini kendin doğrulayabilirsin.",
		],
	},
	{
		heading: "Anında Yatırım, Hızlı Çekim",
		level: 3,
		paragraphs: [
			"Yatırımlar ağ onayından hemen sonra bakiyene geçer. Çekim talepleri otomatik risk kontrolünden geçtikten sonra genellikle dakikalar içinde işlenir; ek belge istenmediği sürece manuel onay beklemezsin.",
		],
	},
	{
		heading: "Oyun Kütüphanesi — Geniş Bir Casino Oyunu Yelpazesi",
		level: 2,
		paragraphs: [
			"Katalog beş ana başlıkta toplanır: Originals, slotlar, masa oyunları, canlı casino ve özel oyunlar. Her başlık kendi rafında listelenir ve sağlayıcı, oynaklık veya RTP'ye göre filtrelenebilir.",
		],
	},
	{
		heading: "Özel Originals Oyunları",
		level: 3,
		paragraphs: [
			"Dice, Limbo, Mines, Plinko, Crash ve Keno gibi 24 oyunu kendi ekibimiz geliştirdi. Bu oyunlarda RTP %99.28'e kadar çıkar ve tur başına bahis limitleri diğer kategorilere g��re daha esnektir.",
		],
	},
	{
		heading: "Slot Oyunları",
		level: 3,
		paragraphs: [
			"10.000'den fazla slot arasında klasik üç makaralı oyunlardan Megaways mekaniğine, bonus satın alma özellikli başlıklardan jackpot havuzlu oyunlara kadar geniş bir seçki yer alır. Her oyunun RTP ve oynaklık bilgisi kart üzerinde görünür.",
		],
	},
	{
		heading: "Masa Oyunları — Blackjack ve Rulet Klasikleri",
		level: 3,
		paragraphs: ["Rulet, blackjack, bakara ve poker varyantları hem tekli hem çoklu el modunda oynanabilir. Masa limitleri düşük bahisten yüksek oyuncu seviyesine kadar kademelendirilmiştir."],
	},
	{
		heading: "Canlı Casino — Gerçek Krupiyeler",
		level: 3,
		paragraphs: ["Canlı stüdyolardan yayınlanan 1.150'den fazla masada gerçek krupiyelerle oynayabilirsin. Yayınlar çoklu kamera açısıyla gelir, sohbet üzerinden krupiyeyle iletişim kurulabilir."],
	},
	{
		heading: "Özel Oyunlar — Bingo, Oyun Şovları ve Crash",
		level: 3,
		paragraphs: ["Oyun şovları, bingo, keno ve crash tarzı hızlı turlu oyunlar ayrı bir kategoride toplanır. Bu oyunlar kısa tur süreleri ve yüksek çarpan potansiyeliyle öne çıkar."],
	},
	{
		heading: "Demo Modunda Dene",
		level: 2,
		paragraphs: [
			"Çoğu slot ve Originals oyunu gerçek para yatırmadan demo modunda oynanabilir. Demo turları sanal bakiye kullanır, kazanç veya kayıp gerçek hesabına yansımaz — mekaniği öğrenmek için idealdir.",
		],
	},
	{
		heading: "Mobil Casino Deneyimi",
		level: 2,
		paragraphs: [
			"Platform mobil öncelikli tasarlanmıştır; uygulama indirmene gerek yoktur. Tüm oyunlar tarayıcı üzerinden dikey ve yatay modda çalışır, bakiye ve bahis geçmişi cihazlar arasında senkron kalır.",
		],
	},
	{
		heading: "Yazılım Sağlayıcıları",
		level: 2,
		paragraphs: [
			"Pragmatic Play, Evolution, BGaming, Hacksaw Gaming, Endorphina, Belatra Games, Spinomenal ve PG Soft dahil 75 sağlayıcıyla çalışıyoruz. Sağlayıcı rafından herhangi bir stüdyoya tıklayarak yalnızca o stüdyonun oyunlarını listeleyebilirsin.",
		],
	},
	{
		heading: "Savaşlar ve Turnuvalar",
		level: 2,
		paragraphs: ["Haftalık savaşlar ve turnuvalar kâr, bahis hacmi veya en yüksek çarpan üzerinden sıralama yapar. Katılım ücretsizdir; ödül havuzları nakit ve ücretsiz spin olarak dağıtılır."],
	},
	{
		heading: "Güvenli Oyun İçin Öneriler",
		level: 2,
		paragraphs: [
			"Oynamaya başlamadan önce bir bütçe belirle ve bu bütçeyi aşma. Hesap ayarlarından yatırım limiti, kayıp limiti, oturum süresi hatırlatıcısı ve kendini dışlama araçlarını etkinleştirebilirsin. Kumar bir gelir kaynağı değil, eğlence biçimidir.",
		],
	},
];
