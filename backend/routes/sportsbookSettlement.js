const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const User = require("../database/models/User");
const Transaction = require("../database/models/Transaction");
const SportsBet = require("../database/models/SportsBet");
const SportsBetEvent = require("../database/models/SportsBetEvent");
const { getActiveWallet, updateUserBalance } = require("../utils/wallet");

const router = express.Router();

const SETTLE_STATUS_ALIASES = {
	won: "won",
	win: "won",
	lost: "lost",
	lose: "lost",
	cancelled: "cancelled",
	canceled: "cancelled",
	void: "cancelled",
	cashout: "cashout",
};

const sha256 = (value) =>
	crypto.createHash("sha256").update(String(value)).digest();

const keyMatches = (provided, expected) =>
	crypto.timingSafeEqual(sha256(provided), sha256(expected));

/**
 * x-sportsbook-key doğrulaması.
 * - Header yoksa ya da SPORTSBOOK_API_KEY tanımlı değilse bu router devre dışı
 *   kalır ve istek normal admin JWT akışına düşer (next("router")).
 * - Header var ve yanlışsa 401 INVALID_API_KEY döner.
 */
const requireSportsbookKey = (req, res, next) => {
	const provided = req.headers["x-sportsbook-key"];
	const expected = process.env.SPORTSBOOK_API_KEY;

	if (!provided || !expected) return next("router");

	if (!keyMatches(provided, expected)) {
		return res.status(401).json({
			success: false,
			error: "INVALID_API_KEY",
			message: "Geçersiz x-sportsbook-key.",
		});
	}

	req.isSportsbookKeyAuth = true;
	return next();
};

router.use(requireSportsbookKey);

const findBet = (id) => {
	const conditions = [{ externalCouponId: id }, { externalBetId: id }];
	if (mongoose.Types.ObjectId.isValid(id) && String(id).length === 24) {
		conditions.push({ _id: id });
	}
	return SportsBet.findOne({ $or: conditions });
};

const respondBetNotFound = (res) =>
	res.status(404).json({
		success: false,
		error: "BET_NOT_FOUND",
		message: "Kupon bulunamadı.",
	});

const toNumber = (value) => {
	if (value === undefined || value === null || value === "") return NaN;
	return Number(value);
};

const formatBet = (bet, balanceAfter) => ({
	id: String(bet._id),
	couponId: bet.externalCouponId,
	userNumericId: bet.userNumericId,
	status: bet.status,
	amount: bet.amount,
	actualWin: bet.actualWin,
	settledAt: bet.settledAt || null,
	balanceAfter: balanceAfter ?? null,
});

const recordTransaction = async ({
	action,
	bet,
	user,
	winMoney,
	balanceBefore,
	balanceAfter,
}) => {
	try {
		await Transaction.create({
			txn_id: `sportsbook_${action}_${bet._id}_${Date.now()}`,
			user_code: String(bet.userNumericId),
			game_type: "sports",
			provider_code: "sportsbook",
			game_code: bet.externalCouponId,
			round_id: bet.externalCouponId,
			bet_money: 0,
			win_money: winMoney,
			txn_type: action === "unsettle" ? "rollback" : action === "void" ? "refund" : winMoney > 0 ? "credit" : "settled",
			balance_before: balanceBefore,
			balance_after: balanceAfter,
			extra: { action, sportsBetId: bet._id, userId: user._id },
		});
	} catch (err) {
		console.error("Sportsbook transaction kaydı yazılamadı:", err.message);
	}
};

/**
 * Kupona bakiye etkisini uygular. Hata olursa kuponu eski haline döndürür.
 * delta = 0 ise bakiyeye dokunmaz.
 */
const applyBalanceChange = async ({ bet, delta, rollbackUpdate }) => {
	const user = await User.findById(bet.user);
	if (!user) {
		await SportsBet.updateOne({ _id: bet._id }, { $set: rollbackUpdate });
		return { error: { code: "USER_NOT_FOUND", message: "Kullanıcı bulunamadı." } };
	}

	const wallet = getActiveWallet(user);
	const balanceBefore = wallet?.balance ?? 0;
	let balanceAfter = balanceBefore;

	if (delta !== 0) {
		try {
			const result = await updateUserBalance(user, delta, { emitSocket: true });
			if (result === false) throw new Error("Bakiye güncellenemedi");
			balanceAfter = result;
		} catch (err) {
			console.error("Sportsbook bakiye güncelleme hatası:", err.message);
			await SportsBet.updateOne({ _id: bet._id }, { $set: rollbackUpdate });
			return { error: { code: "BALANCE_UPDATE_FAILED", message: err.message } };
		}
	}

	return { user, balanceBefore, balanceAfter };
};

const eventStatusFor = (betStatus) =>
	betStatus === "cashout" ? "won" : betStatus;

// POST /admin/sports-bets/:id/settle
// body: { status: "won"|"lost"|"cancelled"|"cashout", winAmount?: number }
router.post("/:id/settle", async (req, res) => {
	try {
		const bet = await findBet(req.params.id);
		if (!bet) return respondBetNotFound(res);

		const targetStatus =
			SETTLE_STATUS_ALIASES[String(req.body?.status ?? req.body?.result ?? "").toLowerCase()];
		if (!targetStatus) {
			return res.status(400).json({
				success: false,
				error: "INVALID_STATUS",
				message: "status şunlardan biri olmalı: won, lost, cancelled, cashout.",
			});
		}

		let winAmount = 0;
		if (targetStatus === "won" || targetStatus === "cashout") {
			winAmount = toNumber(req.body?.winAmount ?? req.body?.win_amount);
			if (!Number.isFinite(winAmount) || winAmount < 0) {
				return res.status(400).json({
					success: false,
					error: "INVALID_WIN_AMOUNT",
					message: "won/cashout için winAmount (>= 0) zorunlu.",
				});
			}
		} else if (targetStatus === "cancelled") {
			winAmount = bet.amount;
		}

		if (bet.status !== "pending") {
			// Aynı sonuçla tekrar gelen istek (retry) idempotent kabul edilir.
			if (bet.status === targetStatus && bet.actualWin === winAmount) {
				return res.json({
					success: true,
					idempotent: true,
					data: formatBet(bet, bet.settlementBalanceAfter),
				});
			}
			return res.status(409).json({
				success: false,
				error: "ALREADY_SETTLED",
				message: `Kupon zaten '${bet.status}' durumunda. Önce /unsettle çağırın.`,
			});
		}

		// Atomik sahiplenme: aynı anda gelen iki isteğin çift ödeme yapmasını önler.
		const claimed = await SportsBet.findOneAndUpdate(
			{ _id: bet._id, status: "pending" },
			{ $set: { status: targetStatus, actualWin: winAmount, settledAt: new Date() } },
			{ new: true },
		);
		if (!claimed) {
			return res.status(409).json({
				success: false,
				error: "ALREADY_SETTLED",
				message: "Kupon eşzamanlı bir istekle sonuçlandırıldı.",
			});
		}

		const applied = await applyBalanceChange({
			bet: claimed,
			delta: winAmount,
			rollbackUpdate: { status: "pending", actualWin: 0, settledAt: null },
		});
		if (applied.error) {
			return res.status(500).json({ success: false, error: applied.error.code, message: applied.error.message });
		}

		claimed.settlementBalanceBefore = applied.balanceBefore;
		claimed.settlementBalanceAfter = applied.balanceAfter;
		await claimed.save();

		await SportsBetEvent.updateMany(
			{ bet: claimed._id },
			{ $set: { status: eventStatusFor(targetStatus) } },
		);

		if (targetStatus === "won" || targetStatus === "cashout") {
			await User.updateOne({ _id: applied.user._id }, { $inc: { "stats.won": winAmount } });
		}

		await recordTransaction({
			action: targetStatus === "cancelled" ? "void" : "settle",
			bet: claimed,
			user: applied.user,
			winMoney: winAmount,
			balanceBefore: applied.balanceBefore,
			balanceAfter: applied.balanceAfter,
		});

		return res.json({ success: true, data: formatBet(claimed, applied.balanceAfter) });
	} catch (error) {
		console.error("Sportsbook settle hatası:", error);
		return res.status(500).json({ success: false, error: "INTERNAL_ERROR", message: error.message });
	}
});

// POST /admin/sports-bets/:id/void  -> stake iade edilir, kupon "cancelled" olur
router.post("/:id/void", async (req, res) => {
	try {
		const bet = await findBet(req.params.id);
		if (!bet) return respondBetNotFound(res);

		if (bet.status === "cancelled") {
			return res.json({
				success: true,
				idempotent: true,
				data: formatBet(bet, bet.settlementBalanceAfter),
			});
		}
		if (bet.status !== "pending") {
			return res.status(409).json({
				success: false,
				error: "ALREADY_SETTLED",
				message: `Kupon zaten '${bet.status}' durumunda. Önce /unsettle çağırın.`,
			});
		}

		const refund = bet.amount;
		const claimed = await SportsBet.findOneAndUpdate(
			{ _id: bet._id, status: "pending" },
			{ $set: { status: "cancelled", actualWin: refund, settledAt: new Date() } },
			{ new: true },
		);
		if (!claimed) {
			return res.status(409).json({
				success: false,
				error: "ALREADY_SETTLED",
				message: "Kupon eşzamanlı bir istekle sonuçlandırıldı.",
			});
		}

		const applied = await applyBalanceChange({
			bet: claimed,
			delta: refund,
			rollbackUpdate: { status: "pending", actualWin: 0, settledAt: null },
		});
		if (applied.error) {
			return res.status(500).json({ success: false, error: applied.error.code, message: applied.error.message });
		}

		claimed.settlementBalanceBefore = applied.balanceBefore;
		claimed.settlementBalanceAfter = applied.balanceAfter;
		await claimed.save();

		await SportsBetEvent.updateMany({ bet: claimed._id }, { $set: { status: "cancelled" } });

		await recordTransaction({
			action: "void",
			bet: claimed,
			user: applied.user,
			winMoney: refund,
			balanceBefore: applied.balanceBefore,
			balanceAfter: applied.balanceAfter,
		});

		return res.json({ success: true, data: formatBet(claimed, applied.balanceAfter) });
	} catch (error) {
		console.error("Sportsbook void hatası:", error);
		return res.status(500).json({ success: false, error: "INTERNAL_ERROR", message: error.message });
	}
});

// POST /admin/sports-bets/:id/unsettle -> sonuçlandırmayı geri alır, kupon "pending" olur
router.post("/:id/unsettle", async (req, res) => {
	try {
		const bet = await findBet(req.params.id);
		if (!bet) return respondBetNotFound(res);

		if (bet.status === "pending") {
			return res.status(409).json({
				success: false,
				error: "NOT_SETTLED",
				message: "Kupon zaten 'pending' durumunda.",
			});
		}

		const previous = {
			status: bet.status,
			actualWin: bet.actualWin,
			settledAt: bet.settledAt,
		};
		const reverseAmount = previous.status === "lost" ? 0 : previous.actualWin || 0;

		const claimed = await SportsBet.findOneAndUpdate(
			{ _id: bet._id, status: previous.status },
			{ $set: { status: "pending", actualWin: 0, settledAt: null } },
			{ new: true },
		);
		if (!claimed) {
			return res.status(409).json({
				success: false,
				error: "STATE_CHANGED",
				message: "Kupon durumu eşzamanlı olarak değişti, tekrar deneyin.",
			});
		}

		const applied = await applyBalanceChange({
			bet: claimed,
			delta: -reverseAmount,
			rollbackUpdate: previous,
		});
		if (applied.error) {
			return res.status(500).json({ success: false, error: applied.error.code, message: applied.error.message });
		}

		claimed.settlementBalanceBefore = undefined;
		claimed.settlementBalanceAfter = undefined;
		await claimed.save();

		await SportsBetEvent.updateMany({ bet: claimed._id }, { $set: { status: "pending" } });

		if (previous.status === "won" || previous.status === "cashout") {
			await User.updateOne({ _id: applied.user._id }, { $inc: { "stats.won": -reverseAmount } });
		}

		await recordTransaction({
			action: "unsettle",
			bet: claimed,
			user: applied.user,
			winMoney: -reverseAmount,
			balanceBefore: applied.balanceBefore,
			balanceAfter: applied.balanceAfter,
		});

		return res.json({ success: true, data: formatBet(claimed, applied.balanceAfter) });
	} catch (error) {
		console.error("Sportsbook unsettle hatası:", error);
		return res.status(500).json({ success: false, error: "INTERNAL_ERROR", message: error.message });
	}
});

module.exports = router;
