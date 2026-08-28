/**
 * Çoklu dil sözlükleri. Backend yanıtları Türkçe sabit metin döndürüyor
 * (ör. BONUS_TYPE_TITLES), bu yüzden frontend backend'in `title` alanını
 * değil `bonusType` / `method` kodunu anahtar olarak kullanır.
 */

export const LOCALES = ["en", "de", "es", "fr"] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
}

const en = {
  "nav.casino": "Casino",
  "nav.live": "Live Casino",
  "nav.sports": "Sports",
  "nav.originals": "Originals",
  "nav.promotions": "Promotions",
  "nav.vip": "VIP",

  "action.login": "Log in",
  "action.register": "Register",
  "action.deposit": "Deposit",
  "action.withdraw": "Withdraw",
  "action.logout": "Log out",

  "wallet.balance": "Balance",
  "wallet.selectCurrency": "Select currency",
  "wallet.displayCurrency": "Display currency",
  "wallet.network": "Network",

  "tx.status.pending": "Pending",
  "tx.status.completed": "Completed",
  "tx.status.approved": "Approved",
  "tx.status.rejected": "Rejected",
  "tx.status.cancelled": "Cancelled",
  "tx.type.deposit": "Deposit",
  "tx.type.withdraw": "Withdrawal",

  "bonus.welcome": "Welcome Bonus",
  "bonus.casino_welcome": "Casino Welcome Bonus",
  "bonus.sports_welcome": "Sports Welcome Bonus",
  "bonus.live_casino_welcome": "Live Casino Welcome Bonus",
  "bonus.freespin": "Free Spins",
  "bonus.promoCodeClaim": "Promo Code",
  "bonus.affiliateCommission": "Affiliate Commission",
  "bonus.rakebackClaim": "Rakeback",
  "bonus.deposit_bonus": "Deposit Bonus",
  "bonus.loss_bonus": "Cashback Bonus",
  "bonus.reload_bonus": "Reload Bonus",

  "compliance.responsibleGaming": "Responsible Gaming",
  "compliance.ageWarning": "18+ only. Gambling can be addictive. Play responsibly.",
  "compliance.selfExclusion": "Self-exclusion",
  "compliance.limits": "Deposit & loss limits",
  "compliance.kyc": "Identity verification",

  "state.maintenance": "We are currently under maintenance.",
  "state.loading": "Loading",
  "state.error": "Something went wrong.",
  "state.empty": "Nothing here yet.",
} as const

export type TranslationKey = keyof typeof en

const de: Partial<Record<TranslationKey, string>> = {
  "nav.casino": "Casino",
  "nav.live": "Live Casino",
  "nav.sports": "Sport",
  "nav.originals": "Originals",
  "nav.promotions": "Aktionen",
  "nav.vip": "VIP",
  "action.login": "Anmelden",
  "action.register": "Registrieren",
  "action.deposit": "Einzahlen",
  "action.withdraw": "Auszahlen",
  "action.logout": "Abmelden",
  "wallet.balance": "Guthaben",
  "wallet.selectCurrency": "Währung wählen",
  "wallet.displayCurrency": "Anzeigewährung",
  "wallet.network": "Netzwerk",
  "compliance.responsibleGaming": "Verantwortungsvolles Spielen",
  "compliance.ageWarning":
    "Nur ab 18. Glücksspiel kann süchtig machen. Spielen Sie verantwortungsvoll.",
  "state.maintenance": "Wir führen gerade Wartungsarbeiten durch.",
  "state.loading": "Lädt",
  "state.error": "Etwas ist schiefgelaufen.",
  "state.empty": "Noch nichts vorhanden.",
}

const es: Partial<Record<TranslationKey, string>> = {
  "nav.casino": "Casino",
  "nav.live": "Casino en vivo",
  "nav.sports": "Deportes",
  "nav.originals": "Originales",
  "nav.promotions": "Promociones",
  "nav.vip": "VIP",
  "action.login": "Iniciar sesión",
  "action.register": "Registrarse",
  "action.deposit": "Depositar",
  "action.withdraw": "Retirar",
  "action.logout": "Cerrar sesión",
  "wallet.balance": "Saldo",
  "wallet.selectCurrency": "Elegir moneda",
  "wallet.displayCurrency": "Moneda de visualización",
  "wallet.network": "Red",
  "compliance.responsibleGaming": "Juego responsable",
  "compliance.ageWarning":
    "Solo +18. El juego puede ser adictivo. Juega con responsabilidad.",
  "state.maintenance": "Estamos en mantenimiento.",
  "state.loading": "Cargando",
  "state.error": "Algo ha ido mal.",
  "state.empty": "Aún no hay nada.",
}

const fr: Partial<Record<TranslationKey, string>> = {
  "nav.casino": "Casino",
  "nav.live": "Casino en direct",
  "nav.sports": "Sports",
  "nav.originals": "Originaux",
  "nav.promotions": "Promotions",
  "nav.vip": "VIP",
  "action.login": "Connexion",
  "action.register": "S'inscrire",
  "action.deposit": "Déposer",
  "action.withdraw": "Retirer",
  "action.logout": "Déconnexion",
  "wallet.balance": "Solde",
  "wallet.selectCurrency": "Choisir la devise",
  "wallet.displayCurrency": "Devise d'affichage",
  "wallet.network": "Réseau",
  "compliance.responsibleGaming": "Jeu responsable",
  "compliance.ageWarning":
    "18+ uniquement. Le jeu peut être addictif. Jouez de manière responsable.",
  "state.maintenance": "Maintenance en cours.",
  "state.loading": "Chargement",
  "state.error": "Une erreur est survenue.",
  "state.empty": "Rien pour le moment.",
}

export const DICTIONARIES: Record<
  Locale,
  Partial<Record<TranslationKey, string>>
> = { en, de, es, fr }

/** Eksik çeviriler İngilizce'ye düşer. */
export function translate(locale: Locale, key: TranslationKey): string {
  return DICTIONARIES[locale]?.[key] ?? en[key] ?? key
}
