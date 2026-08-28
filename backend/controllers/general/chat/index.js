const mongoose = require("mongoose");
const validator = require("validator");

// Load database models
const FilterPhrase = require("../../../database/models/FilterPhrase");
const ChatMessage = require("../../../database/models/ChatMessage");
const {
	getChatSettings,
} = require("../../../database/models/ChatSettings");

// Load utils
const { socketRemoveAntiSpam } = require("../../../utils/socket");
const { settingGet, settingSetValue } = require("../../../utils/setting");
const {
	generalCheckGetChatMessagesData,
	generalCheckSendChatMessageData,
	generalCheckSendChatMessageRoom,
	generalCheckSendChatMessageUser,
	generalCheckSendChatRemoveData,
	generalCheckSendChatRemoveRoom,
	generalCheckSendChatRemoveMessage,
	generalCheckSendChatClearRoom,
	generalCheckSendChatLockData,
	generalCheckSendChatLockRoom,
	generalGetChatOnlineCount,
	generalFilterMessage,
} = require("../../../utils/general/chat");
const {
	generalUserGetLevel,
	generalUserGetRakeback,
} = require("../../../utils/general/user");

// General chat variables
let generalChatMessages = {
	en: [],
	tr: [],
	de: [],
	es: [],
	beg: [],
	whale: [],
};
let generalChatUserCooldowns = [];
let generalChatFilter = [];
// Admin panelinden yönetilen sohbet yapılandırması (ChatSettings koleksiyonu)
let generalChatConfig = null;

const generalChatGetConfig = () => generalChatConfig;

/**
 * Admin panelinde ayarlar güncellendiğinde bellek içi kopyayı tazeler.
 */
const generalChatRefreshSettings = async () => {
	try {
		const settings = await getChatSettings();
		generalChatConfig = settings.toObject ? settings.toObject() : settings;
	} catch (err) {
		console.error("chat settings refresh:", err.message);
	}

	return generalChatConfig;
};

/**
 * Admin panelinden yönetilen kurallar (mesaj uzunluğu, link engeli, mod, XP vb.)
 */
const generalChatValidateConfig = (user, message) => {
	const config = generalChatConfig;
	if (!config) return;

	if (config.chat.enabled === false && ["admin", "mod"].includes(user.rank) === false) {
		throw new Error("Sohbet şu anda kapalı.");
	}

	if (config.chat.mode === "readonly" && ["admin", "mod"].includes(user.rank) === false) {
		throw new Error("Sohbet salt okunur modda.");
	}

	if (
		config.chat.mode === "vipOnly" &&
		["admin", "mod"].includes(user.rank) === false &&
		(user.vipLevel || 0) <= 0
	) {
		throw new Error("Sohbet şu anda sadece VIP üyelere açık.");
	}

	if (message.length > (config.chat.maxMessageLength || 300)) {
		throw new Error(
			`Mesajınız en fazla ${config.chat.maxMessageLength} karakter olabilir.`
		);
	}

	if (
		config.chat.minXpToChat > 0 &&
		user.rank === "user" &&
		(user.xp || 0) < config.chat.minXpToChat
	) {
		throw new Error(
			`Sohbeti kullanmak için en az ${config.chat.minXpToChat} XP gerekiyor.`
		);
	}

	if (
		config.chat.blockLinks === true &&
		["admin", "mod"].includes(user.rank) === false &&
		/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|tr)\b)/i.test(message)
	) {
		throw new Error("Sohbette link paylaşımı yasaktır.");
	}

	if (
		config.chat.blockCaps === true &&
		message.length > 10 &&
		message === message.toUpperCase()
	) {
		throw new Error("Lütfen tamamı büyük harf yazmayın.");
	}

	const cooldownSeconds =
		config.chat.mode === "slow"
			? config.chat.slowSeconds || 6
			: config.chat.cooldownSeconds || 3;

	const last = generalChatUserCooldowns[user._id.toString()];
	if (
		user.rank === "user" &&
		last !== undefined &&
		last > Date.now() - cooldownSeconds * 1000
	) {
		throw new Error(`${cooldownSeconds} saniyede bir mesaj gönderebilirsiniz.`);
	}
};

/**
 * Mesajı kalıcı olarak kaydeder (admin moderasyon ekranı için).
 */
const generalChatPersistMessage = (message) => {
	try {
		ChatMessage.create({
			_id: message._id,
			room: message.room || "all",
			type: message.type || "user",
			message: message.message,
			user: message.user?._id,
			username: message.user?.username,
			avatar: message.user?.avatar,
			rank: message.user?.rank,
			level: message.user?.level || 0,
			meta: message.meta || {},
			createdAt: new Date(),
		}).catch((err) => console.error("chat persist:", err.message));
	} catch (err) {
		console.error("chat persist:", err.message);
	}
};

const generalGetChatMessagesSocket = async (
	io,
	socket,
	user,
	data,
	callback
) => {
	try {
		// Validate sent data
		generalCheckGetChatMessagesData(data);

		// Leave current room if socket is in one
		const currentRoom = [...socket.rooms][1];
		if (currentRoom !== undefined) {
			socket.leave(currentRoom);
		}

		// Join the new chat room and update user online count
		socket.join(data.room);

		// Get chat room online count and send to frontend
		const onlineData = await generalGetChatOnlineCount(io);
		io.of("/general").emit("chatOnline", { online: onlineData });

		callback({ success: true, messages: generalChatMessages[data.room] });
	} catch (err) {
		callback({
			success: false,
			error: { type: "error", message: err.message },
		});
	}
};

const generalSendChatMessageSocket = (io, socket, user, data, callback) => {
	try {
		// Validate sent data
		generalCheckSendChatMessageData(data);

		// Get page settings
		const settings = settingGet();

		// Validate chat room
		let chatRoom = [...socket.rooms][1];
		generalCheckSendChatMessageRoom(user, settings, chatRoom);

		// Validate sending user
		generalCheckSendChatMessageUser(
			user,
			settings,
			generalChatUserCooldowns
		);

		// Admin panelinden yönetilen kuralları uygula
		generalChatValidateConfig(user, data.message.trim());

		// Add time to user cooldown array
		generalChatUserCooldowns[user._id.toString()] = new Date().getTime();

		let message;
		if (
			user.rank === "admin" &&
			data.message.trim().startsWith("/system") === true
		) {
			// Create system message object
			message = {
				message: validator.escape(
					data.message.replace("/system", "").trim()
				),
				type: "system",
			};
		} else {
			// Get user level
			const level = generalUserGetLevel(user);

			// Get user rakeback
			const rakeback = generalUserGetRakeback(user);

			// Create user message object
			message = {
				message: generalFilterMessage(data.message, generalChatFilter),
				room: chatRoom,
				user: {
					_id: user._id,
					roblox: user.roblox,
					username: user.username,
					avatar: user.avatar,
					rank: user.rank,
					level: level,
					rakeback: rakeback.name,
					stats: user.anonymous === true ? null : user.stats,
					createdAt: user.createdAt,
				},
				type: "user",
			};
		}

		// Add message to specific chat room/s and send to frontend
		generalChatAddMessage(io, message);

		callback({ success: true });

		socketRemoveAntiSpam(user._id);
	} catch (err) {
		socketRemoveAntiSpam(socket.decoded._id);
		callback({
			success: false,
			error: { type: "error", message: err.message },
		});
	}
};

const generalSendChatRemoveSocket = async (
	io,
	socket,
	user,
	data,
	callback
) => {
	try {
		// Validate sent data
		generalCheckSendChatRemoveData(data);

		// Validate chat room
		let chatRoom = [...socket.rooms][1];
		generalCheckSendChatRemoveRoom(chatRoom);

		// Validate chat message
		generalCheckSendChatRemoveMessage(data, generalChatMessages[chatRoom]);

		// Remove message from chat messages array
		const index = generalChatMessages[chatRoom].findIndex(
			(element) => element._id.toString() === data.messageId.toString()
		);
		generalChatMessages[chatRoom].splice(index, 1);

		// Sent the removed message to the room connected users
		io.of("/general")
			.to(chatRoom)
			.emit("chatRemove", { messageId: data.messageId });

		callback({ success: true });

		socketRemoveAntiSpam(user._id);
	} catch (err) {
		socketRemoveAntiSpam(socket.decoded._id);
		callback({
			success: false,
			error: { type: "error", message: err.message },
		});
	}
};

const generalSendChatClearSocket = async (io, socket, user, data, callback) => {
	try {
		// Validate chat room
		let chatRoom = [...socket.rooms][1];
		generalCheckSendChatClearRoom(chatRoom);

		// Clear chat room array
		generalChatMessages[chatRoom] = [];

		// Sent the removed message to the room connected users
		io.of("/general").to(chatRoom).emit("chatClear", {});

		// Create system message object
		message = {
			room: chatRoom,
			message: `Chat has been cleared by an administrator.`,
			type: "system",
		};

		// Add message to specific chat room/s and send to frontend
		generalChatAddMessage(io, message);

		callback({ success: true });

		socketRemoveAntiSpam(user._id);
	} catch (err) {
		socketRemoveAntiSpam(socket.decoded._id);
		callback({
			success: false,
			error: { type: "error", message: err.message },
		});
	}
};

const generalSendChatLockSocket = async (io, socket, user, data, callback) => {
	try {
		// Validate sent data
		generalCheckSendChatLockData(data);

		// Get app settings
		let settings = settingGet();

		// Validate chat room
		let chatRoom = [...socket.rooms][1];
		generalCheckSendChatLockRoom(data, settings, chatRoom);

		// Update chat room setting in database
		settings = await settingSetValue(
			`chat.rooms.${chatRoom}.enabled`,
			data.value
		);

		// Sent the updated settings to all connected users
		io.of("/general").emit("settings", { settings: settings });

		// Create system message object
		message = {
			message: `Chat has been ${
				data.value === true ? "unlocked" : "locked"
			} by an administrator.`,
			room: chatRoom,
			type: "system",
		};

		// Add message to specific chat room/s and send to frontend
		generalChatAddMessage(io, message);

		callback({ success: true });

		socketRemoveAntiSpam(user._id);
	} catch (err) {
		socketRemoveAntiSpam(socket.decoded._id);
		callback({
			success: false,
			error: { type: "error", message: err.message },
		});
	}
};

const generalChatAddMessage = (io, message) => {
	try {
		// Create chat rooms array
		const rooms =
			message.type === "user" || message.room !== undefined
				? [message.room]
				: Object.keys(generalChatMessages);

		// Create message object
		message = {
			_id: new mongoose.Types.ObjectId(),
			...message,
		};

		// Mesajı veritabanına yaz (moderasyon/geçmiş)
		generalChatPersistMessage({
			...message,
			room: message.room || (rooms.length === 1 ? rooms[0] : "all"),
		});

		for (const room of rooms) {
			if (generalChatMessages[room] === undefined) {
				generalChatMessages[room] = [];
			}

			// Remove oldest message specifc each room if there are more then 50 messages
			if (generalChatMessages[room].length > 50) {
				generalChatMessages[room].shift();
			}

			// Add message to the specifc room array
			generalChatMessages[room].push(message);

			// Sent the message to frontend
			io.of("/general")
				.to(room)
				.emit("chatMessage", { message: message });
		}
	} catch (err) {
		console.error(err);
	}
};

/**
 * Admin panelinden bir mesajı sohbetten kaldırır.
 */
const generalChatRemoveMessage = (io, room, messageId) => {
	try {
		const rooms = room && room !== "all" ? [room] : Object.keys(generalChatMessages);

		for (const key of rooms) {
			if (generalChatMessages[key] === undefined) continue;

			const index = generalChatMessages[key].findIndex(
				(element) => element._id.toString() === messageId.toString()
			);
			if (index !== -1) {
				generalChatMessages[key].splice(index, 1);
			}

			if (io) {
				io.of("/general").to(key).emit("chatRemove", { messageId });
			}
		}
	} catch (err) {
		console.error("chat remove:", err.message);
	}
};

/**
 * Admin panelinden bir odayı temizler.
 */
const generalChatClearRoom = (io, room) => {
	try {
		const rooms = room && room !== "all" ? [room] : Object.keys(generalChatMessages);

		for (const key of rooms) {
			generalChatMessages[key] = [];
			if (io) {
				io.of("/general").to(key).emit("chatClear", {});
			}
		}
	} catch (err) {
		console.error("chat clear:", err.message);
	}
};

const generalChatAddFilter = (phrase) => {
	// Add phrase to chat filter array
	generalChatFilter.push(phrase);
};

const generalChatRemoveFilter = (phrase) => {
	// Get phrase index and remove from chat filter array
	const index = generalChatFilter.indexOf(phrase);
	if (index !== -1) {
		generalChatFilter.splice(index, 1);
	}
};

const generalChatInit = async (io) => {
	try {
		// Get filters phrases from database
		const filterDatabase = await FilterPhrase.find({})
			.select("phrase")
			.lean();

		// Format filter phrases
		generalChatFilter = filterDatabase.map((element) => element.phrase);

		// Admin panelinden yönetilen sohbet ayarlarını yükle
		await generalChatRefreshSettings();

		// Get page settings
		const settings = settingGet();

		// Create system message object
		message = {
			message: "Chat has been locked by an administrator.",
			type: "system",
		};

		// Check if chat rooms are locked and if true add info message to room
		for (const room of Object.keys(generalChatMessages)) {
			if (settings.chat.rooms[room].enabled === false) {
				// Add chat room to message object
				message.room = room;

				// Add message to specific chat room/s and send to frontend
				generalChatAddMessage(io, message);
			}
		}
	} catch (err) {
		console.error(err);
	}
};

module.exports = {
	generalGetChatMessagesSocket,
	generalSendChatMessageSocket,
	generalSendChatRemoveSocket,
	generalSendChatClearSocket,
	generalSendChatLockSocket,
	generalChatAddMessage,
	generalChatAddFilter,
	generalChatRemoveFilter,
	generalChatRemoveMessage,
	generalChatClearRoom,
	generalChatRefreshSettings,
	generalChatGetConfig,
	generalChatInit,
};
