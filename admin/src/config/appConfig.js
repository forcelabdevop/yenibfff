export const WEBSITE_NAME =
	String(import.meta.env.VITE_WEBSITE_NAME || "Forcelab").trim();

export const PROJECT_ID = String(
	import.meta.env.VITE_PROJECT_ID || "local",
).trim();

export const API_BASE_URL = String(
	import.meta.env.VITE_API_BASE_URL || "",
).replace(/\/+$/, "");
