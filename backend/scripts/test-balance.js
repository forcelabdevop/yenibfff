require("dotenv").config();
const axios = require("axios");
const { publicApiUrl } = require("../appConfig");

const BASE_URL = publicApiUrl("/gold_api/");
const requiredEnv = (name) => {
	const value = String(process.env[name] || "").trim();
	if (!value) throw new Error(`${name} must be set.`);
	return value;
};

async function fetchBalance() {
	try {
		const { data } = await axios.post(
			BASE_URL,
			{
				method: "user_balance",
				agent_code: requiredEnv("NEXUS_AGENT_CODE"),
				agent_secret: requiredEnv("NEXUS_AGENT_SECRET"),
				user_code: requiredEnv("TEST_USER_CODE"),
				user_token: requiredEnv("TEST_USER_TOKEN"),
				game_code: requiredEnv("TEST_GAME_CODE"),
			},
			{ headers: { "Content-Type": "application/json" } },
		);
		return data;
	} catch (err) {
		if (err.response) {
			const msg =
				err.response.data?.message || err.response.statusText || "";
			throw new Error(`Request failed: ${err.response.status} ${msg}`);
		}
		throw new Error(`Network error: ${err.message}`);
	}
}

(async () => {
	console.log(await fetchBalance());
})();
