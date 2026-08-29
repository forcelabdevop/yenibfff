/**
 * Account sayfasinin arayuz katmani (BetFury referans tasarimi).
 *
 * Kapsam: /account, /transactions, /game-history, /sessions, /verification
 * rotalarinin ustunde duran ORTAK "Account" basligi + sekme cubugu, ayrica
 * /account sayfasinin govdesi (ozet kartlari, Mr. Fury Bot, kisisel ayarlar,
 * guvenlik kartlari).
 *
 * Veri durumu — hangisi canli, hangisi statik:
 *
 *   CANLI (account-pages.js -> GET /account/overview):
 *     - kullanici adi + avatar        profile.username / profile.avatar
 *     - rank adi                      profile.rank
 *     - e-posta + dogrulama durumu    profile.email / profile.emailVerified
 *     - telefon                       profile.phone
 *     - 2FA durumu                    security.mfaEnabled / mfaMethodCount
 *
 *   STATIK (backend'de karsiligi YOK — kullanici istegiyle simdilik sabit):
 *     - rank ilerleme yuzdesi         -> GET /account/rank olmali
 *     - cashback yuzdeleri            -> GET /account/cashback olmali
 *     - kisisel gizlilik ayarlari     -> GET+PUT /account/privacy olmali
 *     - sifre kartinin durumu         -> profile.hasPassword alani gerekiyor
 *     - Mr. Fury Bot baglantisi       -> POST /account/telegram/connect olmali
 *
 * Backend'e baglanirken: MOCK-BACKEND.md bolum 9.
 */
window.createAccountPage = function createAccountPage(ctx) {
  const { ref, computed, currentPage, navigate, profile, security, toastMessage } = ctx

  /** "Account" basligi + sekme cubugu bu rotalarda gorunur. */
  const AC_TABS = [
    { key: "account", label: "My Account", path: "/account", icon: "assets/tab-account.png" },
    { key: "transactions", label: "Transactions", path: "/transactions", icon: "assets/tab-transactions.png" },
    { key: "game-history", label: "Game History", path: "/game-history", icon: "assets/tab-game-history.png" },
    { key: "sessions", label: "Sessions", path: "/sessions", icon: "assets/tab-sessions.png" },
    { key: "verification", label: "Verification", path: "/verification", icon: "assets/tab-verification.png" },
  ]

  const acTabs = AC_TABS
  const acHasTabs = AC_TABS.some((tab) => tab.key === currentPage)
  const acActiveTab = currentPage

  function acSelectTab(tab) {
    if (tab.key === currentPage) return
    navigate(tab.path)
  }

  // --- STATIK: rank ilerlemesi ve cashback (backend ucu yok) ---
  const acRankProgress = 11.22
  const acRankCaption = "x3"
  const acCashbackCurrent = "5%"
  const acCashbackNext = "5%"

  const acRankName = computed(() => (profile.value && profile.value.rank) || "Rookie I")
  const acUsername = computed(() => {
    const p = profile.value
    return (p && (p.username || p.name)) || "Player"
  })
  const acAvatar = computed(() => (profile.value && profile.value.avatar) || "assets/user-avatar-raccoon.png")

  // --- STATIK: gizlilik ayarlari. Backend'e baglanirken her degisiklik
  // PUT /account/privacy'ye gonderilmeli; simdilik yalnizca yerel durum. ---
  const acSettings = ref([
    { label: "Hide my username", checked: true },
    { label: "Hide statistics", checked: true },
    { label: "Hide activity", checked: false },
    { label: "Hide played games", checked: false },
    { label: "Hide battles rewards", checked: false },
    { label: "Hide all Profile data", checked: false },
  ])

  function acToggleSetting(index) {
    const list = acSettings.value.slice()
    list[index] = { ...list[index], checked: !list[index].checked }
    acSettings.value = list
  }

  const acEmailPromos = ref(false)
  function acToggleEmailPromos() {
    acEmailPromos.value = !acEmailPromos.value
  }

  /**
   * Guvenlik kartlari. E-posta / telefon / 2FA CANLI; sifre karti statik
   * (backend `hasPassword` dondurmuyor).
   */
  const acSecurityCards = computed(() => {
    const p = profile.value || {}
    const s = security.value || {}
    const mfaOn = !!s.mfaEnabled

    return [
      {
        key: "email",
        icon: "fas fa-envelope",
        title: "My Email",
        ok: !!p.emailVerified,
        status: p.emailVerified ? "Verified" : "Not verified",
        description: "Set the email to have access to your account anytime from any device.",
        email: p.email || "",
        promo: true,
      },
      {
        key: "phone",
        icon: "fas fa-phone-alt",
        title: "My Phone",
        ok: !!p.phone,
        status: p.phone ? "Added" : "Not set",
        description:
          "Give us a phone number to keep your account safe — we'll only use it for verification and important notifications.",
        action: p.phone ? "Change" : "Set",
        actionTone: "blue",
      },
      {
        key: "password",
        icon: "fas fa-lock",
        title: "Password",
        // STATIK: backend `hasPassword` alani eklenene kadar sabit.
        ok: true,
        status: "Verified",
        description: "Must contain at least 8 characters: a combination of letters and characters",
        action: "Change",
        actionTone: "blue",
      },
      {
        key: "mfa",
        icon: "fas fa-shield-alt",
        title: "2FA",
        ok: mfaOn,
        status: mfaOn ? "Activated" : "Not set",
        description:
          "2nd security layer of your account. Set 2FA to protect your account (available only when email and password are set)",
        action: mfaOn ? "Deactivate" : "Activate",
        actionTone: mfaOn ? "red" : "blue",
      },
    ]
  })

  /** Sifre/telefon/2FA butonlari: gercek uc yok, durustce bildiriyoruz. */
  function acSecurityAction(card) {
    toastMessage(card.title + ": bu islem backend'e baglandiginda aktif olacak")
  }

  function acConnectBot() {
    toastMessage("Mr. Fury Bot baglantisi backend'e baglandiginda aktif olacak")
  }

  function acChangeUsername() {
    toastMessage("Kullanici adi degistirme backend'e baglandiginda aktif olacak")
  }

  function acNotify(message) {
    toastMessage(message)
  }

  return {
    acTabs,
    acHasTabs,
    acActiveTab,
    acSelectTab,
    acRankProgress,
    acRankCaption,
    acRankName,
    acCashbackCurrent,
    acCashbackNext,
    acUsername,
    acAvatar,
    acSettings,
    acToggleSetting,
    acEmailPromos,
    acToggleEmailPromos,
    acSecurityCards,
    acSecurityAction,
    acConnectBot,
    acChangeUsername,
    acNotify,
  }
}
