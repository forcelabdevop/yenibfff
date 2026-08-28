require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../database/index");
const User = require("../database/models/User");

const legacyImageDomain = String(process.env.LEGACY_IMAGE_DOMAIN || "").trim();
const imageBaseUrl = String(
	process.env.IMAGE_BASE_URL || process.env.SERVER_BACKEND_URL || "",
)
	.trim()
	.replace(/\/+$/, "");
const escapeRegExp = (value) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

(async () => {
	try {
		if (!legacyImageDomain || !imageBaseUrl) {
			throw new Error(
				"LEGACY_IMAGE_DOMAIN and IMAGE_BASE_URL (or SERVER_BACKEND_URL) must be set.",
			);
		}

		await connectDB();
		console.log(
			`Starting avatar domain replacement: ${legacyImageDomain} -> ${imageBaseUrl}`,
		);

		const domainRegex = new RegExp(escapeRegExp(legacyImageDomain));
		const globalDomainRegex = new RegExp(
			escapeRegExp(legacyImageDomain),
			"g",
		);

		const users = await User.find({
			$or: [
				{ avatar: { $type: "string", $regex: domainRegex } },
				{ "avatar.url": { $type: "string", $regex: domainRegex } },
			],
		}).select("_id avatar");

		console.log(
			`Found ${users.length} users with avatar containing ${legacyImageDomain}`,
		);

		let updated = 0;
		for (const u of users) {
			let newAvatar = u.avatar;

			try {
				if (!newAvatar) continue;

				if (typeof newAvatar === "string") {
					if (newAvatar.includes(legacyImageDomain)) {
						newAvatar = newAvatar.replace(
							globalDomainRegex,
							imageBaseUrl,
						);
					} else {
						continue;
					}
				} else if (
					typeof newAvatar === "object" &&
					newAvatar !== null
				) {
					// If avatar is an object and has a url field
					if (
						typeof newAvatar.url === "string" &&
						newAvatar.url.includes(legacyImageDomain)
					) {
						newAvatar = {
							...newAvatar,
							url: newAvatar.url.replace(
								globalDomainRegex,
								imageBaseUrl,
							),
						};
					} else {
						// no change needed
						continue;
					}
				} else {
					continue;
				}

				await User.updateOne(
					{ _id: u._id },
					{ $set: { avatar: newAvatar } },
				);
				updated++;

				if (updated % 100 === 0) {
					console.log(`Updated ${updated} users...`);
				}
			} catch (innerErr) {
				console.error(
					`Failed to update user ${u._id}:`,
					innerErr.message || innerErr,
				);
			}
		}

		console.log(`\nCompleted. Updated ${updated} users.`);

		const remaining = await User.countDocuments({
			$or: [
				{ avatar: { $type: "string", $regex: domainRegex } },
				{ "avatar.url": { $type: "string", $regex: domainRegex } },
			],
		});
		console.log("Remaining users with old domain in avatar:", remaining);

		await mongoose.disconnect();
		console.log("Disconnected from database.");
		process.exit(0);
	} catch (err) {
		console.error(
			"Error during avatar domain replacement:",
			err.message || err,
		);
		await mongoose.disconnect().catch(() => {});
		process.exit(1);
	}
})();
