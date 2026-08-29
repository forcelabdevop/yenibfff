const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notice = require('../../database/models/Notice');
const User = require('../../database/models/User');
const { authenticateAdmin } = require('../../middleware/permission');
const { authorizeUser } = require('../../middleware/auth');

// Bir kullanıcının görebileceği bildirimleri seçen sorgu.
//
// Notice üç şekilde hedeflenir (bkz. POST /admin/notices):
//   1. recipientId dolu            -> yalnızca o kullanıcıya özel bildirim
//   2. recipients[] dolu           -> audience online/offline/segment ile
//                                     gönderim anında hesaplanmış hedef liste
//   3. recipientId ve recipients boş -> herkese açık duyuru
//
// Eski sorgu yalnızca (1) ve "recipientId: null" bakıyordu; bu yüzden (2)
// ile hedeflenen bildirimler de herkese görünüyordu. Aşağıdaki koşul
// yayın bildirimini recipients listesi BOŞ olanlarla sınırlar.
const buildVisibilityQuery = (userId) => ({
	$or: [
		{ recipientId: userId },
		{
			$and: [
				{ $or: [{ recipientId: null }, { recipientId: { $exists: false } }] },
				{ recipients: userId },
			],
		},
		{
			$and: [
				{ $or: [{ recipientId: null }, { recipientId: { $exists: false } }] },
				{ $or: [{ recipients: { $size: 0 } }, { recipients: { $exists: false } }] },
			],
		},
	],
});

const isReadByUser = (notice, userId) =>
	Array.isArray(notice.readBy) &&
	notice.readBy.some((entry) => entry?.user && String(entry.user) === String(userId));

// Kullanıcının kendi bildirimleri.
// Kimlik token'dan okunur; URL'den gelen kullanıcı kimliğine güvenilmez.
router.get('/', authorizeUser(true), async (req, res) => {
	try {
		const userId = req.user._id;
		const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
		const page = Math.max(Number(req.query.page) || 1, 1);
		const scope = req.query.scope === 'personal' ? 'personal' : req.query.scope === 'platform' ? 'platform' : 'all';

		const visibility = buildVisibilityQuery(userId);

		// Platform = kişiye özel olmayan duyurular, Personal = yalnızca kendisine.
		let query = visibility;
		if (scope === 'personal') {
			query = { recipientId: userId };
		} else if (scope === 'platform') {
			query = {
				$and: [
					visibility,
					{ $or: [{ recipientId: null }, { recipientId: { $exists: false } }] },
				],
			};
		}

		const [total, notices, unreadTotal] = await Promise.all([
			Notice.countDocuments(query),
			Notice.find(query)
				.sort({ createdAt: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.lean(),
			Notice.countDocuments({
				...visibility,
				'readBy.user': { $ne: userId },
			}),
		]);

		const data = notices.map((notice) => ({
			_id: notice._id,
			title: notice.title,
			message: notice.message,
			image: notice.image || null,
			createdAt: notice.createdAt,
			personal: Boolean(notice.recipientId),
			read: isReadByUser(notice, userId),
		}));

		res.status(200).json({
			success: true,
			data,
			meta: {
				page,
				limit,
				total,
				pageCount: Math.max(Math.ceil(total / limit), 1),
				unread: unreadTotal,
			},
		});
	} catch (error) {
		console.error('Bildirimler getirilirken hata:', error);
		res.status(500).json({ success: false, message: 'Bildirimler getirilemedi.' });
	}
});

// Okunmamış sayısı (zil rozeti için hafif uç).
router.get('/unread-count', authorizeUser(true), async (req, res) => {
	try {
		const userId = req.user._id;
		const unread = await Notice.countDocuments({
			...buildVisibilityQuery(userId),
			'readBy.user': { $ne: userId },
		});

		res.status(200).json({ success: true, data: { unread } });
	} catch (error) {
		console.error('Okunmamış bildirim sayısı alınamadı:', error);
		res.status(500).json({ success: false, message: 'Okunmamış bildirim sayısı alınamadı.' });
	}
});

// Tek bir bildirimi okundu işaretle.
router.post('/:id/read', authorizeUser(true), async (req, res) => {
	try {
		const userId = req.user._id;
		const { id } = req.params;

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ success: false, message: 'Geçersiz bildirim kimliği.' });
		}

		// Kullanıcı yalnızca kendisine görünen bir bildirimi işaretleyebilir.
		const notice = await Notice.findOne({ _id: id, ...buildVisibilityQuery(userId) }).select('_id');

		if (!notice) {
			return res.status(404).json({ success: false, message: 'Bildirim bulunamadı.' });
		}

		// $ne koşulu aynı kullanıcının listeye iki kez eklenmesini engeller.
		await Notice.updateOne(
			{ _id: id, 'readBy.user': { $ne: userId } },
			{ $push: { readBy: { user: userId, readAt: new Date() } } },
		);

		res.status(200).json({ success: true });
	} catch (error) {
		console.error('Bildirim okundu işaretlenemedi:', error);
		res.status(500).json({ success: false, message: 'Bildirim okundu işaretlenemedi.' });
	}
});

// Görünen tüm bildirimleri okundu işaretle.
router.post('/read-all', authorizeUser(true), async (req, res) => {
	try {
		const userId = req.user._id;

		const result = await Notice.updateMany(
			{ ...buildVisibilityQuery(userId), 'readBy.user': { $ne: userId } },
			{ $push: { readBy: { user: userId, readAt: new Date() } } },
		);

		res.status(200).json({
			success: true,
			data: { updated: result.modifiedCount || 0 },
		});
	} catch (error) {
		console.error('Bildirimler okundu işaretlenemedi:', error);
		res.status(500).json({ success: false, message: 'Bildirimler okundu işaretlenemedi.' });
	}
});

// Tüm kullanıcıları çekme - sadece admin, hassas veriler gizli.
// NOT: Bu rota "/:userId" parametrik rotasından ÖNCE tanımlanmalıdır; aksi
// halde "users" bir kullanıcı kimliği sanılır ve bu uç hiç çalışmaz.
router.get('/users', authenticateAdmin, async (req, res) => {
	try {
		const users = await User.find({}, '_id username local.email');
		res.status(200).json(users);
	} catch (error) {
		console.error('Kullanıcılar getirilirken hata:', error);
		res.status(500).json({ message: 'Kullanıcılar getirilemedi.' });
	}
});

// Bireysel bildirim gönderme - sadece admin.
router.post('/individual', authenticateAdmin, async (req, res) => {
	const { title, message, recipientId } = req.body;

	if (!title || !message || !recipientId) {
		return res.status(400).json({ message: 'Title, message, and recipientId are required' });
	}

	try {
		const notice = new Notice({ title, message, recipientId });
		await notice.save();

		res.status(201).json(notice);
	} catch (error) {
		console.error('Bildirim oluşturma hatası:', error);
		res.status(500).json({ success: false, message: 'Bildirim oluşturulamadı.' });
	}
});

// Toplu bildirim gönderme - sadece admin.
// Kullanıcı başına ayrı doküman üretmek yerine tek bir yayın bildirimi
// oluşturur; hedefleme okuma sorgusunda yapılır.
router.post('/bulk', authenticateAdmin, async (req, res) => {
	const { title, message } = req.body;

	if (!title || !message) {
		return res.status(400).json({ message: 'Title and message are required' });
	}

	try {
		const notice = new Notice({
			title,
			message,
			audience: { type: 'all', conditions: [] },
		});
		await notice.save();

		res.status(201).json({ success: true, data: notice });
	} catch (error) {
		console.error('Toplu bildirim oluşturma hatası:', error);
		res.status(500).json({ message: 'Toplu bildirim oluşturulamadı.' });
	}
});

// Geriye dönük uyumluluk: eski istemciler /notice/:userId çağırıyordu.
// Kimlik artık token'dan gelir; başkasının kimliği istenirse reddedilir.
router.get('/:userId', authorizeUser(true), async (req, res) => {
	try {
		if (String(req.params.userId) !== String(req.user._id)) {
			return res.status(403).json({ success: false, message: 'Bu bildirimlere erişim yetkiniz yok.' });
		}

		const notices = await Notice.find(buildVisibilityQuery(req.user._id))
			.sort({ createdAt: -1 })
			.limit(50)
			.lean();

		res.status(200).json(notices);
	} catch (error) {
		console.error('Bildirimler getirilirken hata:', error);
		res.status(500).json({ success: false, message: 'Bildirimler getirilemedi.' });
	}
});

module.exports = router;
