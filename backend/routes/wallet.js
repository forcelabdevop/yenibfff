const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../database/models/User');
const CryptoPrice = require('../database/models/CryptoPrice');
const { authorizeUser } = require('../middleware/auth');
const { listCurrencies: listDepositCurrencies } = require('../config/crypto');

const coinGeckoIds = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  TRX: 'tron',
  USDT: 'tether',
  ZELO: 'zelo'
};

const normalizeCode = (value) => String(value || '').trim().toUpperCase();
const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

async function loadPriceMap() {
  const rows = await CryptoPrice.find({ price: { $gt: 0 } }).select('name price fee').lean();
  return new Map(rows.map((row) => [normalizeCode(row.name), { price: Number(row.price), fee: Number(row.fee) || 0 }]));
}

router.get('/currencies', authorizeUser(true), async (req, res, next) => {
  try {
    const [user, prices] = await Promise.all([User.findById(req.user._id).select('wallets').lean(), loadPriceMap()]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Yatirilabilir cuzdan kodlari (USDT, TRX). Rivo gibi ic bakiye birimlerinin
    // zincir uzerinde adresi YOKTUR; yatirma ekraninda sunulurlarsa kullanici
    // "Desteklenmeyen para birimi" hatasi alir.
    const depositable = new Set(
      listDepositCurrencies().map((currency) => normalizeCode(currency.walletCode))
    );

    // Kullaniciya gosterilecek ag adi. Arayuz `label` okur; `name` geriye
    // donuk uyumluluk icin korunur.
    //
    // ONEMLI: Yanlis agda gonderilen kripto GERI ALINAMAZ. Bu yuzden etiket
    // yalnizca zinciri ("TRON") degil token standardini da ("TRC-20")
    // icermelidir; kullanici cuzdanindan bu ikisini birlikte secer.
    const networkLabel = (chain, type) => {
      const chainName = String(chain || '').toUpperCase();
      const standard = String(type || '').toUpperCase();
      if (!standard || standard === 'NATIVE') return chainName;
      return `${chainName} (${standard})`;
    };

    const buildEntry = ({ code, chain, type, balance }) => {
      const market = prices.get(code) || { price: 0, fee: 0 };
      const icon = `/casino-ui/assets/coin-${code.toLowerCase()}.png`;
      return {
        code,
        name: code,
        chain,
        type,
        network: chain,
        networks: [{ id: type, name: chain, label: networkLabel(chain, type), icon }],
        balance,
        usd: market.price,
        fee: market.fee,
        precision: 8,
        fiat: false,
        depositable: depositable.has(code),
        icon,
      };
    };

    const data = (user.wallets || []).map((wallet) =>
      buildEntry({
        code: normalizeCode(wallet.coinType),
        chain: wallet.chain,
        type: wallet.type,
        balance: Number(wallet.balance) || 0,
      })
    );

    // Yatirilabilir kripto para birimleri, kullanicinin HENUZ cuzdani olmasa
    // bile listeye eklenir. Cuzdan ilk yatirim kredi edildiginde olusur; aksi
    // halde kullanici yatirma ekraninda USDT'yi hic goremez ve para
    // yatiramazdi (tavuk-yumurta problemi).
    const known = new Set(data.map((entry) => entry.code));
    for (const currency of listDepositCurrencies()) {
      const code = normalizeCode(currency.walletCode);
      if (known.has(code)) continue;
      known.add(code);
      data.push(buildEntry({ code, chain: currency.chain, type: currency.type, balance: 0 }));
    }

    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/quote', authorizeUser(true), async (req, res, next) => {
  try {
    const from = normalizeCode(req.query.from);
    const to = normalizeCode(req.query.to);
    const amount = Number(req.query.amount);
    if (!from || !to || from === to || !finitePositive(amount)) return res.status(400).json({ success: false, message: 'Invalid quote request' });
    const prices = await loadPriceMap();
    const source = prices.get(from);
    const target = prices.get(to);
    if (!source || !target) return res.status(422).json({ success: false, message: 'Live price is unavailable' });
    const feeRate = Math.max(source.fee, target.fee, 0) / 100;
    const rate = source.price / target.price;
    const receive = amount * rate * (1 - feeRate);
    res.json({ success: true, data: { from, to, amount, rate, receive, feeRate, expiresAt: new Date(Date.now() + 15000).toISOString(), provider: 'CryptoPrice' } });
  } catch (error) { next(error); }
});

router.post('/swap', authorizeUser(true), async (req, res, next) => {
  try {
    const from = normalizeCode(req.body.from);
    const to = normalizeCode(req.body.to);
    const amount = Number(req.body.amount);
    if (!from || !to || from === to || !finitePositive(amount)) return res.status(400).json({ success: false, message: 'Invalid swap request' });
    const prices = await loadPriceMap();
    const source = prices.get(from);
    const target = prices.get(to);
    if (!source || !target) return res.status(422).json({ success: false, message: 'Live price is unavailable' });
    const feeRate = Math.max(source.fee, target.fee, 0) / 100;
    const receive = amount * (source.price / target.price) * (1 - feeRate);
    const result = await User.updateOne(
      { _id: req.user._id, wallets: { $elemMatch: { coinType: from, balance: { $gte: amount } } }, 'wallets.coinType': to },
      { $inc: { 'wallets.$[source].balance': -amount, 'wallets.$[target].balance': receive } },
      { arrayFilters: [{ 'source.coinType': from }, { 'target.coinType': to }], runValidators: true },
    );
    if (!result.modifiedCount) return res.status(409).json({ success: false, message: 'Wallet unavailable or insufficient balance' });
    const user = await User.findById(req.user._id).select('wallets').lean();
    res.json({ success: true, data: { from, to, amount, receive, balances: user.wallets } });
  } catch (error) { next(error); }
});

// Kullanıcı giriş yapmalı ve yalnız kendi cüzdanını değiştirebilir.
router.post('/convert-to-fiat', authorizeUser(true), async (req, res, next) => {
  try {
    const { fiatCurrency } = req.body;
    // ⚠️ GÜVENLİK: userId'yi token'dan al (IDOR koruması)
    const userId = req.user._id;
    
    const supported = ['TRY', 'USD', 'EUR', 'INR', 'IDR', 'RUB', 'BRL', 'JPY', 'CNY'];

    if (!supported.includes(fiatCurrency)) {
      return res.status(400).json({ message: 'Unsupported fiat currency' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.balance || !Array.isArray(user.balance.data)) {
      return res.status(400).json({ message: 'User balance structure is invalid or missing' });
    }

    // Öncelikle kullanıcıdaki mevcut fiat para birimini al
    const currentFiat = user.currency.fiatCurrency || 'USD';

    if (currentFiat === fiatCurrency) {
      // Zaten aynı fiat, dönüşüm yapmaya gerek yok
      return res.json({
        message: `Balances are already in ${fiatCurrency}`,
        balances: user.balance.data
      });
    }

    // Kullanıcının balance.data'daki coin tiplerini al ve CoinGecko ID'lerine çevir
    const uniqueCoins = [...new Set(user.balance.data.map(e => e.coinType))];
    const ids = uniqueCoins.map(coin => coinGeckoIds[coin]).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ message: 'No valid coins for exchange rates' });
    }

    // Önce mevcut fiat'a karşı USD kuru (veya baz para) alacağız, sonra seçilen fiat kuru,
    // Çünkü elimizdeki balance değerleri mevcut fiat cinsinden, diğer fiat'a dönüştürmek için oran hesaplamamız gerekiyor.

    // 1) Mevcut fiat -> USD kuru
    const currentToUsdResponse = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
    );
    const currentToUsdRates = currentToUsdResponse.data;

    // 2) Seçilen fiat -> USD kuru
    const targetToUsdResponse = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${fiatCurrency.toLowerCase()}`
    );
    const targetToUsdRates = targetToUsdResponse.data;

    // 3) Her coin için mevcut fiat cinsinden balance'ı USD'ye çevir, sonra USD'den seçilen fiat'a
    user.balance.data = user.balance.data.map(entry => {
      const coinId = coinGeckoIds[entry.coinType];
      if (!coinId) return entry;

      // currentFiat to USD oranı (örn: TRY->USD)
      const currentFiatRate = currentToUsdRates[coinId]?.usd ?? 0;

      // targetFiat to USD oranı (örn: CNY->USD)
      const targetFiatRate = targetToUsdRates[coinId]?.[fiatCurrency.toLowerCase()] ?? 0;

      if (currentFiatRate === 0 || targetFiatRate === 0) return entry; // hata durumunda dönüşüm yok

      // Mevcut balance (mevcut fiat cinsinden)
      const currentBalanceFiat = entry.balance;

      // USD miktarı: mevcut fiat'tan USD'ye
      const balanceInUsd = currentBalanceFiat / currentFiatRate;

      // USD'den hedef fiat'a
      const convertedBalance = parseFloat((balanceInUsd * targetFiatRate).toFixed(2));

      return { ...entry, balance: convertedBalance };
    });

    user.currency.fiatCurrency = fiatCurrency;
    user.markModified('balance');
    user.markModified('currency');

    await user.save();

    res.json({
      message: `All balances converted from ${currentFiat} to ${fiatCurrency}`,
      balances: user.balance.data
    });
  } catch (err) {
    console.error('Conversion error:', err);
    next(err);
  }
});

module.exports = router;
