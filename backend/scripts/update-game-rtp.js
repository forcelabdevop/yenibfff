/**
 * Populer oyunlara yayinlanmis (resmi) RTP degerlerini yazar.
 *
 * - Sadece asagidaki listede yer alan oyunlar guncellenir.
 * - Listede olmayan oyunlara dokunulmaz; frontend 90 ve altindaki
 *   yer tutucu degerleri gostermedigi icin onlarda RTP gizli kalir.
 *
 * Kullanim:
 *   node --env-file-if-exists=.env scripts/update-game-rtp.js          (dry run)
 *   node --env-file-if-exists=.env scripts/update-game-rtp.js --apply  (yazar)
 */

const mongoose = require("mongoose");

// Oyun adi (kucuk harf) -> yayinlanmis varsayilan RTP
const RTP_MAP = {
	// Hacksaw Gaming
	"hand of anubis": 96.24,
	"wanted dead or a wild": 96.38,
	"le bandit": 96.34,
	"chaos crew": 96.3,
	"stack'em": 96.2,
	"aztec twist": 96.36,
	"cash crew": 94.23,
	"dork unit": 96.24,
	"gladiator legends": 96.14,
	"le king": 96.14,
	xpander: 96.25,
	"rocket reels": 96.34,

	// Nolimit City
	"fire in the hole 2": 96.07,
	"mental ii": 96.06,
	"tombstone r.i.p": 96.08,
	"deadwood r.i.p": 96.09,
	"san quentin 2: death row": 96.04,

	// Pragmatic Play
	"gates of olympus": 96.5,
	"gates of olympus pop": 96.56,
	"sugar rush": 96.5,
	"sugar rush 1000": 96.55,
	"bigger bass splash": 96.5,
	"sweet bonanza": 96.51,
	"sweet bonanza 1000": 96.53,
	"starlight princess": 96.5,
	"big bass bonanza": 96.71,
	"the dog house": 96.51,
	"fruit party": 96.47,
	"wolf gold": 96.01,
};

const normalize = (value) =>
	String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.replace(/[’‘]/g, "'")
		.toLowerCase();

(async () => {
	const apply = process.argv.includes("--apply");
	const uri = process.env.DATABASE_URI;

	if (!uri) {
		console.error("[v0] DATABASE_URI tanimli degil");
		process.exit(1);
	}

	await mongoose.connect(uri);
	const games = mongoose.connection.collection("games");

	let matched = 0;
	let updated = 0;
	const missing = [];

	// Tum oyunlari bir kez okuyup normalize edilmis ada gore indeksle
	const all = await games
		.find({ game_name: { $exists: true } })
		.project({ game_name: 1, rtp: 1 })
		.toArray();

	const index = new Map();
	for (const doc of all) {
		const key = normalize(doc.game_name);
		if (!index.has(key)) index.set(key, []);
		index.get(key).push(doc);
	}

	for (const [name, rtp] of Object.entries(RTP_MAP)) {
		const docs = index.get(name) || [];

		if (!docs.length) {
			missing.push(name);
			continue;
		}

		matched += docs.length;
		if (apply) {
			const res = await games.updateMany(
				{ _id: { $in: docs.map((d) => d._id) } },
				{ $set: { rtp, updated_at: new Date() } },
			);
			updated += res.modifiedCount;
		}
		console.log(`[v0] ${name} -> ${rtp} (${docs.length} kayit)`);
	}

	console.log(
		`[v0] ${apply ? "GUNCELLENDI" : "DRY RUN"} | eslesen=${matched} yazilan=${updated} bulunamayan=${missing.length}`,
	);
	if (missing.length) console.log("[v0] bulunamayan:", missing.join(", "));

	await mongoose.connection.close();
	process.exit(0);
})().catch(async (err) => {
	console.error("[v0] hata:", err.message);
	process.exit(1);
});
