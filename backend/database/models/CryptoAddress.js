const mongoose = require('mongoose');

/**
 * Kullaniciya ait kalici yatirma adresi (Stake modeli).
 *
 * GUVENLIK: Burada ASLA private key veya mnemonic saklanmaz. Yalnizca adres ve
 * turetme indeksi tutulur; imzalama gerektiginde anahtar, ortam degiskenindeki
 * seed'den yeniden turetilir.
 */
const cryptoAddressSchema = new mongoose.Schema({
    /** Zincir. v1'de yalniz 'TRON'. */
    chain: { type: String, required: true, default: 'TRON' },

    /** config/crypto.js CURRENCIES anahtari (or. 'USDT_TRC20', 'TRX'). */
    currency: { type: String, required: true },

    address: { type: String, required: true },

    /** m/44'/195'/0'/0/{derivationIndex} */
    derivationIndex: { type: Number, required: true },

    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },

    /**
     * Izleyicinin bu adresi en son ne zaman taradigi.
     * Adresler bu alana gore en eskiden yeniye siralanarak taranir; boylece
     * kullanici sayisi arttikca hicbir adres ac kalmaz (round-robin).
     */
    lastScannedAt: { type: Date, default: null },

    /**
     * Bu adres icin islenmis en son transferin zaman damgasi (ms).
     * TronGrid sorgularinda min_timestamp olarak kullanilir; her taramada tum
     * gecmisi yeniden cekmemek icin.
     */
    lastSeenTimestamp: { type: Number, default: 0 },

    /**
     * Sweep servisinin bu adresin bakiyesini en son ne zaman kontrol ettigi.
     * lastScannedAt (yatirma izleyicisi) ile karistirilmamali — ayri bir
     * round-robin sirasi saglar.
     */
    lastSweepScannedAt: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now }
});

// Round-robin tarama sirasi icin.
cryptoAddressSchema.index({ lastScannedAt: 1 });
cryptoAddressSchema.index({ lastSweepScannedAt: 1 });

// Ayni adresin iki kayda girmesini engeller.
cryptoAddressSchema.index({ address: 1 }, { unique: true });

// Ayni turetme indeksinin iki kez tahsisini engeller. Bu koruma olmadan iki
// kullanici AYNI adresi paylasabilir ve biri otekinin parasini alir.
cryptoAddressSchema.index({ chain: 1, derivationIndex: 1 }, { unique: true });

// Kullanici basina, zincir+para birimi basina TEK kalici adres.
cryptoAddressSchema.index({ user: 1, chain: 1, currency: 1 }, { unique: true });

cryptoAddressSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CryptoAddress',  cryptoAddressSchema);
