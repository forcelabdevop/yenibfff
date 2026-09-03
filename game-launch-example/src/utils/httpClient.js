const axios = require("axios");

/**
 * Tum saglayici cagrilarinin gectigi tek nokta.
 * Timeout + tutarli hata loglama burada merkezilestirilir, boylece her
 * provider dosyasinda ayni try/catch tekrarlanmaz.
 */
async function providerRequest({ method = "POST", url, data, params, headers }) {
	try {
		const response = await axios({
			method,
			url,
			data,
			params,
			headers,
			timeout: 15000,
		});
		return response.data;
	} catch (error) {
		const details = error.response?.data || error.message;
		console.error(`[provider-request] ${method} ${url} basarisiz:`, details);
		throw new Error(
			typeof details === "string" ? details : JSON.stringify(details),
		);
	}
}

module.exports = { providerRequest };
