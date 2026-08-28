/**
 * referans casino arayüzü ana sayfasında görülen, backend'de karşılığı olmayan (yani
 * gerçek Game koleksiyonundan gelmeyen) tamamen görsel/gösterim amaçlı
 * bölümler için sabit veri seti: mock kategori rafları, sağlayıcı logoları,
 * son büyük kazançlar, canlı bahis akışı ve turnuva bannerları.
 *
 * Bu dosyadaki hiçbir veri gerçek bahis/kazanç temsil etmez — sadece
 * referans casino arayüzü'in birebir görsel klonu için düzen/doku amaçlıdır.
 */

import {WEBSITE_NAME} from "@/lib/config";

export interface MockGame {
	id: string;
	name: string;
	provider: string;
	image: string;
	badge?: "HOT" | "TOP";
}

export interface MockRail {
	slug: string;
	name: string;
	total: number;
	games: MockGame[];
}

const A = "/casino-assets";

export const MOCK_RAILS: MockRail[] = [
	{
		slug: "top-slots",
		name: "Popüler Slotlar",
		total: 11842,
		games: [
			{id: "ts-1", name: "Sugar Rush Super Scatter", provider: "Pragmatic Play", image: `${A}/slot-sugar-rush-super-scatter.jpeg`, badge: "HOT"},
			{id: "ts-2", name: "Sweet Bonanza 2500", provider: "Pragmatic Play", image: `${A}/slot-sweet-bonanza-2500.jpeg`, badge: "TOP"},
			{id: "ts-3", name: "Merge Up", provider: "BGaming", image: `${A}/slot-merge-up.jpeg`},
			{id: "ts-4", name: "Clash of Gods: Power Duel", provider: "BGaming", image: `${A}/slot-clash-of-gods.jpeg`},
			{id: "ts-5", name: "Starlight Princess 1000", provider: "Pragmatic Play", image: `${A}/slot-starlight-princess-1000.jpeg`, badge: "HOT"},
			{id: "ts-6", name: "Gates of Olympus Super Scatter", provider: "Pragmatic Play", image: `${A}/slot-gates-of-olympus.jpeg`},
			{id: "ts-7", name: "Burning Coins 100", provider: "Endorphina", image: `${A}/slot-burning-coins-100.jpeg`},
			{id: "ts-8", name: "Alien Fruits", provider: "BGaming", image: `${A}/slot-alien-fruits.jpeg`},
			{id: "ts-9", name: "DanLudan's Fortune Bass", provider: "Belatra Games", image: `${A}/slot-danludans-fortune-bass.jpeg`},
			{id: "ts-10", name: "Lady Wolf Moon", provider: "BGaming", image: `${A}/slot-lady-wolf-moon.jpeg`},
			{id: "ts-11", name: "Wild Zombies", provider: "Popiplay", image: `${A}/slot-wild-zombies.jpeg`},
			{id: "ts-12", name: "Sons of Monarchy", provider: "Popiplay", image: `${A}/slot-sons-of-monarchy.jpeg`},
			{id: "ts-13", name: "Death Becomes You", provider: "Hacksaw Gaming", image: `${A}/slot-death-becomes-you.jpeg`},
			{id: "ts-14", name: "Blazing Coins Hold and Win", provider: "Popiplay", image: `${A}/slot-blazing-coins.jpeg`},
			{id: "ts-15", name: "Beauty and the Beast", provider: "Belatra Games", image: `${A}/slot-beauty-and-the-beast.jpeg`},
			{id: "ts-16", name: "Le Bunny", provider: "Hacksaw Gaming", image: `${A}/slot-le-bunny.jpeg`},
		],
	},
	{
		slug: "roulette",
		name: "Rulet",
		total: 254,
		games: [
			{id: "rl-1", name: "Roulette", provider: WEBSITE_NAME, image: `${A}/original-roulette.jpeg`},
			{id: "rl-2", name: "Blackjack 26", provider: "Pragmatic Play", image: `${A}/slot-blackjack-26.jpeg`},
			{id: "rl-3", name: "Bac Bo", provider: "Evolution", image: `${A}/slot-bac-bo.jpeg`},
		],
	},
	{
		slug: "blackjack",
		name: "Blackjack",
		total: 777,
		games: [
			{id: "bj-1", name: "Blackjack", provider: WEBSITE_NAME, image: `${A}/original-blackjack.jpeg`},
			{id: "bj-2", name: "Blackjack 26", provider: "Pragmatic Play", image: `${A}/slot-blackjack-26.jpeg`},
			{id: "bj-3", name: "Bac Bo", provider: "Evolution", image: `${A}/slot-bac-bo.jpeg`},
		],
	},
	{
		slug: "live-casino",
		name: "Canlı Casino",
		total: 1156,
		games: [
			{id: "lc-1", name: "Blackjack 26", provider: "Pragmatic Play", image: `${A}/slot-blackjack-26.jpeg`},
			{id: "lc-2", name: "Bac Bo", provider: "Evolution", image: `${A}/slot-bac-bo.jpeg`},
			{id: "lc-3", name: "Roulette", provider: WEBSITE_NAME, image: `${A}/original-roulette.jpeg`},
		],
	},
	{
		slug: "highroller",
		name: "Highroller Hall",
		total: 125,
		games: [
			{id: "hr-1", name: "Big Bang", provider: "Belatra Games", image: `${A}/slot-big-bang.jpeg`, badge: "TOP"},
			{id: "hr-2", name: "Dogmasons MegaWOOF", provider: "Popiplay", image: `${A}/slot-dogmasons-megawoof.jpeg`},
			{id: "hr-3", name: "Le Football Fan", provider: "Hacksaw Gaming", image: `${A}/slot-le-football-fan.jpeg`},
		],
	},
	{
		slug: "game-shows",
		name: "Oyun Şovları",
		total: 36,
		games: [
			{id: "gs-1", name: "Baba Yaga Tales", provider: "Spinomenal", image: `${A}/slot-baba-yaga-tales.jpeg`, badge: "HOT"},
			{id: "gs-2", name: "Sweet Bonanza 2500", provider: "Pragmatic Play", image: `${A}/slot-sweet-bonanza-2500.jpeg`},
			{id: "gs-3", name: "Bac Bo", provider: "Evolution", image: `${A}/slot-bac-bo.jpeg`},
		],
	},
];

export interface MockProvider {
	id: string;
	name: string;
}

export const MOCK_PROVIDERS: MockProvider[] = [
	{id: "p-1", name: "Pragmatic Play"},
	{id: "p-2", name: "Evolution"},
	{id: "p-3", name: "PG Soft"},
	{id: "p-4", name: "Playtech"},
	{id: "p-5", name: "Hacksaw Gaming"},
	{id: "p-6", name: "ELK Studios"},
	{id: "p-7", name: "Smartsoft Gaming"},
	{id: "p-8", name: "BGaming"},
];

export interface MockWin {
	id: string;
	game: string;
	image: string;
	amount: number;
	username: string;
}

export const MOCK_TOP_WINS: MockWin[] = [
	{id: "w-1", game: "Dice", image: `${A}/original-dice.jpeg`, amount: 48163.64, username: "Fatstack"},
	{id: "w-2", game: "Roulette", image: `${A}/original-roulette.jpeg`, amount: 56090.15, username: "Mattosdias"},
	{id: "w-3", game: "Keno", image: `${A}/original-keno.jpeg`, amount: 50560.09, username: "JG6473"},
	{id: "w-4", game: "Crash", image: `${A}/original-crash.jpeg`, amount: 79694.76, username: "Mattosdias"},
	{id: "w-5", game: "Mines", image: `${A}/original-mines.jpeg`, amount: 48216.02, username: "Fatstack"},
	{id: "w-6", game: "Limbo", image: `${A}/original-limbo.jpeg`, amount: 68476.55, username: "User119427"},
];

export interface MockBet {
	id: string;
	game: string;
	icon: "dice" | "limbo";
	avatarSeed: number;
	amount: number;
}

export const MOCK_LIVE_BETS: MockBet[] = [
	{id: "b-1", game: "Limbo", icon: "limbo", avatarSeed: 6, amount: 0},
	{id: "b-2", game: "Dice", icon: "dice", avatarSeed: 10, amount: 0},
	{id: "b-3", game: "Dice", icon: "dice", avatarSeed: 12, amount: 62.71},
	{id: "b-4", game: "Dice", icon: "dice", avatarSeed: 6, amount: 194.48},
	{id: "b-5", game: "Dice", icon: "dice", avatarSeed: 10, amount: 0},
	{id: "b-6", game: "Dice", icon: "dice", avatarSeed: 10, amount: 0},
	{id: "b-7", game: "Limbo", icon: "limbo", avatarSeed: 7, amount: 0},
	{id: "b-8", game: "Limbo", icon: "limbo", avatarSeed: 9, amount: 287.28},
];

export interface BattleBanner {
	id: string;
	timeLabel: string;
	title: string;
	description: string;
	image: string;
	accent: "red" | "blue";
}

export const BATTLE_BANNERS: BattleBanner[] = [
	{
		id: "battle-1",
		timeLabel: "02:45:29",
		title: "Ücretsiz Chip Battle",
		description: "Chip harcamadan katıl, ödül havuzundan payını al.",
		image: "/banners/battles.png",
		accent: "red",
	},
	{
		id: "battle-2",
		timeLabel: "5 gün",
		title: "Elite Battle · Rank 9",
		description: "Sıralamanı yükselt, büyük ödül havuzuna ulaş.",
		image: "/banners/elite-battle.png",
		accent: "blue",
	},
];

export interface GamePick {
	id: string;
	name: string;
	provider: string;
	image: string;
	top?: boolean;
}

export const GAME_PICKS: GamePick[] = [
	{id: "pick-1", name: "Mines", provider: WEBSITE_NAME, image: `${A}/original-mines.jpeg`, top: true},
	{id: "pick-2", name: "Tower", provider: WEBSITE_NAME, image: `${A}/original-tower.jpeg`},
	{id: "pick-3", name: "Cryptos", provider: WEBSITE_NAME, image: `${A}/original-cryptos.jpeg`},
];

/**
 * Ana sayfanın altındaki uzun SEO metin bloğu. referans casino arayüzü'teki bölüm
 * başlıkları ve akış aynen korunmuş, marka adı ve bazı platform detayları
 * dağıtımın marka adına uyarlanmıştır.
 */
export interface SeoSection {
	id: string;
	heading: string;
	body: string[];
}

export const SEO_SECTIONS: SeoSection[] = [
	{
		id: "intro",
		heading: `${WEBSITE_NAME} Online Kripto Casino ve Spor Bahis Platformu`,
		body: [
			`Sıra dışı bir Bitcoin casino deneyimi mi arıyorsunuz? Doğru yerdesiniz! ${WEBSITE_NAME}, özel Originals oyunları, geniş bir online slot seçkisi ve Spor Bahisleri sunan üst düzey bir kripto casinodur. Ayrıca platformumuzda Staking ve Futures trading gibi birçok kripto gelir seçeneği bulunur.`,
		],
	},
	{
		id: "advantages",
		heading: `${WEBSITE_NAME}'da Kripto Bahis Avantajları`,
		body: [
			`${WEBSITE_NAME}'yu diğer önde gelen online kripto casinolardan ayıran nedir? Cevap basit: kriptoya odaklanıyoruz. Ekibimiz günümüz dünyasında dijital varlıkların önemini anlıyor ve kripto bahis ihtiyaçlarınızı karşılayacak bir platform oluşturdu.`,
			"Gizlilik ve Anonim Oyun – Bitcoin ve diğer para birimlerinin gizliliği sayesinde, oyuncular gereksiz engeller olmadan favori oyunlarına erişebilir.",
			"Güvenlik – Platformumuz bağımsız olarak denetlenen akıllı sözleşme güvenliğine sahip nadir kripto casinolardan biridir. Oyuncu fonları soğuk cüzdanlarda saklanır ve tüm işlemler SSL şifrelemesiyle korunur.",
			"Anında Ödemeler – Çekim taleplerinin büyük bir kısmı dakikalar içinde işleme alınır.",
			"Çoklu Para Birimi – Kullanıcılar 50'den fazla popüler kripto varlıkla (BTC, ETH, USDT, TRX, DOGE, LTC, USDC vb.) para yatırıp çekebilir.",
		],
	},
	{
		id: "games",
		heading: "Online Oynanabilecek En İyi Bitcoin Casino Oyunları",
		body: [
			`${WEBSITE_NAME}, 70'in üzerinde önde gelen iGaming sağlayıcısından 13.000'den fazla oyuna ev sahipliği yapar. Slot veya masa oyunu arayın, zevkinize uygun bir şey bulacaksınız.`,
			"Slot kategorimiz, klasiklerden Megaways'e kadar 11.000'den fazla oyun içerir. Modern video slotlarının çoğunda bonus sembolleri, reel bonusları ve mega bonuslar gibi özellikler bulunur.",
			"Masa oyunları kategorisi, casino becerilerinizi geliştiren oyunları birleştirir. Rulet şansa dayanırken, Blackjack oyuncuları 21'i geçmeden ona ulaşmaya davet eder.",
		],
	},
	{
		id: "originals",
		heading: "Yüksek RTP'li Özel Originals Oyunları",
		body: [
			"Topluluğumuzun tüm isteklerini göz önünde bulundurarak, Originals oyunları büyük kazançlar ve eğlence için yaratıldı. Plinko, Dice, Crash, HiLo, Keno, Mines ve diğer Originals maksimum avantaj ve özel cazibe sunar.",
			"Originals oyunlarında minimum bahis miktarı herhangi bir para biriminde 0.00000001'dir. 1 dolardan daha az bahis yapıp yine de büyük bir çarpan kazanabilirsiniz.",
		],
	},
	{
		id: "sports",
		heading: `${WEBSITE_NAME}'da Bitcoin Sportsbook'un Tadını Çıkarın`,
		body: [
			`${WEBSITE_NAME} Spor Bahisleri ile sezgilerinizi ortaya çıkarın. 80'den fazla spor kategorisinde (Futbol, Basketbol, Tenis, Buz Hokeyi, Kriket, Beyzbol, Voleybol, At Yarışı ve eSpor) her ay 50.000'den fazla büyük spor etkinliği için tahmin becerilerinizi hazırlayın.`,
		],
	},
	{
		id: "earn",
		heading: "Bitcoin Casinomuzda Kazanmanın Daha Fazla Yolu",
		body: [
			"Kripto Staking – Pasif gelir aracının tadını çıkarın. %60 APR'ye kadar kripto stake edin! Esnek, Sabit Süreli ve Artırılmış Sabit Süreli mekanikler arasından seçim yapın.",
			"Futures Trading – Stratejinize ve hedeflerinize uygun bir para birimi seçin. Detaylı piyasa analiziyle bir kripto para biriminin gelecekteki fiyatını tahmin edin.",
			`Kripto Swap – Bir kripto para birimini doğrudan ${WEBSITE_NAME} üzerinde başka bir para birimiyle değiştirin.`,
			"Referans Programı – Her referans için bonus ve etkinliklerinden %30'a kadar komisyon kazanın.",
		],
	},
	{
		id: "bonuses",
		heading: "Bitcoin Casino Bonuslarının Tam Kapsamını Ortaya Çıkarın",
		body: [
			`${WEBSITE_NAME}, oyun deneyiminizi olabildiğince keyifli hale getirmeye kendini adamıştır. En cömert ve çeşitli kripto bonusları sunmaktan gurur duyuyoruz. Rank sistemimizde yükselin, favori oyunlarınızı oynayın ve ek ödüller kazanın.`,
			`Hoş Geldin Bonusları ve Ücretsiz Dönüşler – ${WEBSITE_NAME} tüm yeni gelenleri bir Hoş Geldin Paketi sunarak karşılar. Yatırım Bonusu ve Ücretsiz Dönüşler kazanın.`,
		],
	},
	{
		id: "mobile",
		heading: "Kripto Bahis Platformumuzu Herhangi Bir Mobil Cihazda Kullanın",
		body: [
			`${WEBSITE_NAME} tüm cihazlarda kusursuz bir oyun deneyimi sunar. Bilgisayar, akıllı telefon veya tablette oynamayı tercih etmeniz önemli değil, platformumuz tam olarak optimize edilmiştir.`,
		],
	},
	{
		id: "account",
		heading: "Nasıl Hesap Oluşturulur?",
		body: [
			`${WEBSITE_NAME}'da hesap oluşturmak erişilebilirlik ve kolaylık açısından en doğru şekilde tanımlanır. Kullanıcılar tercih ettikleri bir kayıt yöntemi seçebilir ve sadece birkaç tıklamayla heyecan verici yolculuğa başlayabilir.`,
		],
	},
	{
		id: "support",
		heading: `${WEBSITE_NAME} BTC Casino Müşteri Desteği`,
		body: [
			`Kullanıcılarımıza her zaman yardımcı oluyor ve online kripto casino deneyimlerini iyileştiriyoruz. Bu yüzden ${WEBSITE_NAME} 7/24 destek sunar. Herhangi bir zorlukla karşılaşırsanız bizimle iletişime geçin.`,
		],
	},
];

/**
 * Footer'daki akordiyon bölümleri (I-gaming / Features / Promo / About us /
 * Contact us / Help), referans casino arayüzü'teki gerçek link gruplarının Türkçe
 * karşılığı.
 */
export interface FooterAccordionGroup {
	id: string;
	title: string;
	links: {label: string; href: string}[];
}

export const FOOTER_ACCORDION_GROUPS: FooterAccordionGroup[] = [
	{
		id: "igaming",
		title: "I-Gaming",
		links: [
			{label: "Tüm Oyunlar", href: "/casino"},
			{label: "Dice", href: "/casino"},
			{label: "Slotlar", href: "/casino"},
			{label: "Rank Sistemi", href: "/profile"},
			{label: "Canlı Casino", href: "/casino"},
			{label: "Plinko", href: "/casino"},
			{label: "Poker", href: "/casino"},
		],
	},
	{
		id: "features",
		title: "Özellikler",
		links: [
			{label: "Staking", href: "/wallet"},
			{label: "Kripto Staking", href: "/wallet"},
			{label: "Günlük Görevler", href: "/missions"},
			{label: "Ortaklık Programı", href: "/affiliate"},
			{label: "Futures", href: "/wallet"},
		],
	},
	{
		id: "promo",
		title: "Promosyon",
		links: [
			{label: "Promosyonlar", href: "/promotions"},
			{label: "Promosyon Kodları", href: "/promotions"},
		],
	},
	{
		id: "about",
		title: "Hakkımızda",
		links: [
			{label: "Haberler", href: "/news"},
			{label: "Ekibimiz Hakkında", href: "/about"},
			{label: "Whitepaper", href: "/about"},
			{label: "Dokümantasyon", href: "/about"},
			{label: "Resmi Aynalar", href: "/about"},
			{label: "Uygulamayı İndir", href: "/app"},
		],
	},
	{
		id: "contact",
		title: "İletişim",
		links: [
			{label: "Canlı Destek", href: "/support"},
			{label: `support@${WEBSITE_NAME}.com`, href: `mailto:support@${WEBSITE_NAME}.com`},
			{label: `bugbounty@${WEBSITE_NAME}.com`, href: `mailto:bugbounty@${WEBSITE_NAME}.com`},
			{label: `pr@${WEBSITE_NAME}.com`, href: `mailto:pr@${WEBSITE_NAME}.com`},
			{label: `affiliate@${WEBSITE_NAME}.com`, href: `mailto:affiliate@${WEBSITE_NAME}.com`},
		],
	},
	{
		id: "help",
		title: "Yardım",
		links: [
			{label: "Adillik", href: "/fairness"},
			{label: "Gizlilik Politikası", href: "/legal/privacy"},
			{label: "Kullanım Şartları", href: "/legal/terms"},
			{label: "Spor Bahis Şartları", href: "/legal/sports-terms"},
			{label: "Hata Ödül Programı", href: "/legal/bug-bounty"},
			{label: "Ticari Başvurular", href: "/legal/business"},
			{label: "Sorumlu Oyun", href: "/legal/responsible-gambling"},
		],
	},
];
