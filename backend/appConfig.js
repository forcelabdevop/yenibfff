const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

const WEBSITE_NAME = String(process.env.WEBSITE_NAME || "Forcelab").trim();
const PROJECT_ID = String(process.env.PROJECT_ID || "local").trim();
const API_BASE_URL = normalizeOrigin(
	process.env.SERVER_BACKEND_URL || "http://localhost:5000",
);

const publicApiUrl = (path) =>
	`${API_BASE_URL}${String(path).startsWith("/") ? path : `/${path}`}`;

module.exports = {
	API_BASE_URL,
	PROJECT_ID,
	WEBSITE_NAME,
	publicApiUrl,
};
