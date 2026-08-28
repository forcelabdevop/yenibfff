import axios from "@/plugins/axios";

/**
 * Chat / Rain / Tips Service
 *
 * Sohbet yönetimi paneli için API çağrıları:
 * - Genel ayarlar, odalar, sabit mesaj ve kurallar
 * - Mesaj moderasyonu, kelime filtresi, susturma/yasaklama
 * - Rain ve tip (bahşiş) geçmişi, istatistikler
 */

// ── Ayarlar ───────────────────────────────────────────────
export const getChatSettings = async () => {
	const { data } = await axios.get("/admin/chat/settings");
	return data;
};

export const updateChatSettings = async payload => {
	const { data } = await axios.put("/admin/chat/settings", payload);
	return data;
};

// ── Odalar ────────────────────────────────────────────────
export const getChatRooms = async () => {
	const { data } = await axios.get("/admin/chat/rooms");
	return data;
};

export const createChatRoom = async payload => {
	const { data } = await axios.post("/admin/chat/rooms", payload);
	return data;
};

export const updateChatRoom = async (id, payload) => {
	const { data } = await axios.put(`/admin/chat/rooms/${id}`, payload);
	return data;
};

export const deleteChatRoom = async id => {
	const { data } = await axios.delete(`/admin/chat/rooms/${id}`);
	return data;
};

// ── Mesajlar ──────────────────────────────────────────────
export const getChatMessages = async (params = {}) => {
	const { data } = await axios.get("/admin/chat/messages", { params });
	return data;
};

export const deleteChatMessage = async (id, reason) => {
	const { data } = await axios.delete(`/admin/chat/messages/${id}`, { data: { reason } });
	return data;
};

export const clearChatRoom = async room => {
	const { data } = await axios.post("/admin/chat/messages/clear", { room });
	return data;
};

export const sendSystemMessage = async payload => {
	const { data } = await axios.post("/admin/chat/messages/system", payload);
	return data;
};

// ── Kelime filtresi ───────────────────────────────────────
export const getChatFilters = async () => {
	const { data } = await axios.get("/admin/chat/filters");
	return data;
};

export const createChatFilter = async phrase => {
	const { data } = await axios.post("/admin/chat/filters", { phrase });
	return data;
};

export const deleteChatFilter = async id => {
	const { data } = await axios.delete(`/admin/chat/filters/${id}`);
	return data;
};

// ── Moderasyon ────────────────────────────────────────────
export const getChatModeration = async () => {
	const { data } = await axios.get("/admin/chat/moderation");
	return data;
};

export const muteChatUser = async payload => {
	const { data } = await axios.post("/admin/chat/moderation/mute", payload);
	return data;
};

export const unmuteChatUser = async id => {
	const { data } = await axios.post(`/admin/chat/moderation/unmute/${id}`);
	return data;
};

export const banChatUser = async payload => {
	const { data } = await axios.post("/admin/chat/moderation/ban", payload);
	return data;
};

export const unbanChatUser = async id => {
	const { data } = await axios.post(`/admin/chat/moderation/unban/${id}`);
	return data;
};

// ── Rain ──────────────────────────────────────────────────
export const getRains = async (params = {}) => {
	const { data } = await axios.get("/admin/chat/rains", { params });
	return data;
};

export const getRainDetail = async id => {
	const { data } = await axios.get(`/admin/chat/rains/${id}`);
	return data;
};

export const createSiteRain = async payload => {
	const { data } = await axios.post("/admin/chat/rains", payload);
	return data;
};

export const cancelRain = async id => {
	const { data } = await axios.post(`/admin/chat/rains/${id}/cancel`);
	return data;
};

// ── Tips ──────────────────────────────────────────────────
export const getTips = async (params = {}) => {
	const { data } = await axios.get("/admin/chat/tips", { params });
	return data;
};

// ── İstatistikler ─────────────────────────────────────────
export const getChatStats = async () => {
	const { data } = await axios.get("/admin/chat/stats");
	return data;
};

export default {
	getChatSettings,
	updateChatSettings,
	getChatRooms,
	createChatRoom,
	updateChatRoom,
	deleteChatRoom,
	getChatMessages,
	deleteChatMessage,
	clearChatRoom,
	sendSystemMessage,
	getChatFilters,
	createChatFilter,
	deleteChatFilter,
	getChatModeration,
	muteChatUser,
	unmuteChatUser,
	banChatUser,
	unbanChatUser,
	getRains,
	getRainDetail,
	createSiteRain,
	cancelRain,
	getTips,
	getChatStats,
};
