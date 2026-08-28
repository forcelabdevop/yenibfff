/**
 * Backend Mongoose modellerinden türetilmiş tipler.
 * Kaynak: backend/database/models/*, backend/routes/index.js
 */

export type FiatCode =
  | "EUR"
  | "USD"
  | "GBP"
  | "TRY"
  | "BRL"
  | "INR"
  | "IDR"
  | "RUB"
  | "JPY"
  | "CNY"

/**
 * Backend'de şu an tek bir dahili cüzdan (Rivo) kullanılıyor — çok kripto
 * cüzdan seçici altyapı henüz canlı değil (bkz. backend/utils/rivoWallet.js).
 */
export type CoinCode = "Rivo"

/** User.wallets[] — backend/database/models/User.js → walletSchema. */
export interface WalletEntry {
  coinType: string
  balance: number
  chain: string
  type: string
}

export interface UserCurrency {
  fiatCurrency: FiatCode
  coinType: string
  chain: string
  type: string
  coins?: number
}

export interface User {
  _id: string
  username: string
  name?: string
  email?: string
  avatar?: string
  rank?: string
  numericId?: number
  accountNumber?: string | null
  phone?: string
  currency: UserCurrency
  wallets: WalletEntry[]
  xp?: number
  level?: number
  rakeback?: { name?: string; percentage?: number; earned?: number; available?: number }
  stats?: { bet?: number; won?: number }
  anonymous?: boolean
  mute?: { active?: boolean }
  ban?: { active?: boolean }
  verifiedAt?: string | null
  mfa?: { enabled?: boolean }
  createdAt?: string
}

/** GET /transaction-history/:userId — yedi kaynağın normalize edilmiş hâli. */
export interface Transaction {
  _id: string
  amount: number
  title: string
  type: "deposit" | "withdraw"
  status: "pending" | "completed" | "approved" | "rejected" | "cancelled"
  method:
    | "crypto"
    | "bank"
    | "bonus"
    | "forcelab"
    | "galaxypay"
    | "fluxkripto"
    | "xpayments"
  currency?: string
  cryptoAmount?: number | null
  bonusAmount?: number
  bonusType?: string
  createdAt: string
  updatedAt: string
}

/** Ödeme sağlayıcısı — GET /site-settings içinde public olarak gelir. */
export interface PaymentProvider {
  isActive: boolean
  name: string
  logo: string
  minAmount: number
  maxAmount: number
  currency: string
  lang?: string
  methods?: Record<string, boolean>
  currencies?: Record<string, boolean>
}

/** GET /site-settings — sanitize edilmiş public yanıt. */
export interface SiteSettings {
  logo?: string
  logoMini?: string
  favicon?: string
  footerText?: string
  footerDescription?: string
  socialLinks: Record<string, string>
  licenses: unknown[]
  partners: unknown[]
  seo: Record<string, string>
  maintenanceMode: boolean
  maintenanceMessage: string
  originalGames: Record<string, unknown>
  customCSS: string
  customJS: string
  customHTML: string
  forcelabFinance: PaymentProvider
  meelDev: PaymentProvider
  galaxyPay: PaymentProvider
  fluxKripto: PaymentProvider
  xPayments: PaymentProvider
  sportsbookProvider: "betcolabs" | "nexusggr"
}

export interface Game {
  _id: string
  game_code: string
  game_name?: string
  provider?: string
  image?: string
  category?: string
}

/**
 * Crash oyunu — namespace: /crash (backend/sockets/crash, controllers/crash).
 * Çarpanlar (outcome, multiplier, autoCashout, tick "multiplier") backend'de
 * x100 ölçekte tutulur: 100 = 1.00x, 250 = 2.50x. Frontend her zaman /100 ile
 * gösterir.
 */
export type CrashGameState = "created" | "pending" | "rolling" | "completed"

export interface CrashGameUser {
  _id: string
  roblox?: { id?: string }
  username: string
  avatar?: string
  rank?: string
  level?: number
  rakeback?: string
  stats?: { bet?: number; won?: number }
  createdAt?: string
}

export interface CrashGame {
  _id: string
  state: CrashGameState
  /** Sadece state === "completed" olduğunda gelir (anti-cheat). */
  outcome?: number
  fair?: { seed?: { seedServer?: string; hash?: string } }
  createdAt: string
  updatedAt: number
}

export interface CrashBet {
  _id: string
  amount: number
  autoCashout: number
  /** Cashout yapılınca dolar; yapılmazsa undefined kalır (round biterse kaybeder). */
  multiplier?: number
  payout?: number
  game: string
  user: CrashGameUser
  fiatCurrency?: string
  createdAt?: string
}

export interface CrashInitPayload {
  game: CrashGame | null
  bets: CrashBet[]
  history: CrashGame[]
}
