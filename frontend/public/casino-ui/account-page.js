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
  // Sekme durumu account-pages.js'deki REAKTIF `accountPageKey`den okunur, boylece
  // sekmeye tiklamak rota degistirmek (= iframe'i yeniden yuklemek) yerine aninda
  // gorunumu degistirir. `setAccountPage` yoksa eski davranisa (navigate) duseriz.
  const acPageKey = ctx.accountPageKey
  const acSetPage = ctx.setAccountPage
  const acCurrentKey = () => (acPageKey && acPageKey.value !== undefined ? acPageKey.value : currentPage)

  const acHasTabs = computed(() => AC_TABS.some((tab) => tab.key === acCurrentKey()))
  const acActiveTab = computed(() => acCurrentKey())

  function acSelectTab(tab) {
    if (tab.key === acCurrentKey()) return
    if (typeof acSetPage === "function") acSetPage(tab.key, tab.path)
    else navigate(tab.path)
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

  /* =========================================================================
   * Transactions sekmesi (/transactions)
   *
   * Veri CANLI: account-pages.js -> GET /transaction-history/:userId?limit=50
   * Satir alanlari: createdAt, type (deposit|withdraw), method
   * (crypto|bank|bonus|forcelab|...), status (pending|completed|approved|
   * rejected|cancelled), amount, currency, title ve saglayiciya gore
   * transaction / uuid / externalTransactionId referanslari.
   *
   * Tarih ve tur filtreleri backend'de karsiligi olmadigi icin istemci
   * tarafinda, cekilen 50 kayit uzerinde calisir. Sunucu tarafi filtre/
   * sayfalama gerekince: GET /transaction-history?type=&from=&to= eklenmeli.
   * ========================================================================= */
  const { transactions, activeCurrency, accountFormatMoney, accountStatusLabel, accountStatusTone, accountFormatDateOnly } = ctx

  const TX_RANGES = [
    { key: "all", label: "All time", days: 0 },
    { key: "7d", label: "Last 7 days", days: 7 },
    { key: "30d", label: "Last 30 days", days: 30 },
    { key: "90d", label: "Last 90 days", days: 90 },
  ]

  /** Backend `type` + `method` alanlarini tek bir filtre listesine indiriyoruz. */
  const TX_TYPES = [
    { key: "all", label: "All types" },
    { key: "deposit", label: "Deposit", match: (tx) => tx.type === "deposit" && tx.method !== "bonus" },
    { key: "withdraw", label: "Withdrawal", match: (tx) => tx.type === "withdraw" },
    { key: "bonus", label: "Bonus", match: (tx) => tx.method === "bonus" },
    { key: "bank", label: "Bank transfer", match: (tx) => tx.method === "bank" },
    { key: "crypto", label: "Crypto", match: (tx) => tx.method === "crypto" },
  ]

  const txRanges = TX_RANGES
  const txTypes = TX_TYPES
  const txRange = ref("all")
  const txType = ref("all")
  const txRangeOpen = ref(false)
  const txTypeOpen = ref(false)

  function txToggleRange() {
    txRangeOpen.value = !txRangeOpen.value
    txTypeOpen.value = false
  }
  function txToggleType() {
    txTypeOpen.value = !txTypeOpen.value
    txRangeOpen.value = false
  }
  function txSelectRange(key) {
    txRange.value = key
    txRangeOpen.value = false
  }
  function txSelectType(key) {
    txType.value = key
    txTypeOpen.value = false
  }
  function txResetFilters() {
    txRange.value = "all"
    txType.value = "all"
    txRangeOpen.value = false
    txTypeOpen.value = false
  }
  function txCloseMenus() {
    txRangeOpen.value = false
    txTypeOpen.value = false
  }

  function txPad(value) {
    return String(value).padStart(2, "0")
  }
  function txFormatDay(date) {
    return txPad(date.getDate()) + "/" + txPad(date.getMonth() + 1) + "/" + date.getFullYear()
  }
  function txRangeStart(key) {
    const range = TX_RANGES.find((item) => item.key === key)
    if (!range || !range.days) return null
    const start = new Date()
    start.setDate(start.getDate() - range.days)
    start.setHours(0, 0, 0, 0)
    return start
  }
  function txMethodLabel(method) {
    const map = { crypto: "Crypto", bank: "Bank", bonus: "Bonus", forcelab: "Forcelab" }
    if (!method) return ""
    return map[method] || String(method).charAt(0).toUpperCase() + String(method).slice(1)
  }
  /** Kisaltilmis islem referansi (hash / uuid / harici id). */
  function txReference(tx) {
    const value = String(tx.transaction || tx.uuid || tx.externalTransactionId || "")
    if (!value) return ""
    if (value.length <= 13) return value
    return value.slice(0, 6) + "…" + value.slice(-4)
  }

  /** Tur filtresi uygulanmis liste (tarih filtresi haric). */
  const txByType = computed(() => {
    const list = transactions.value || []
    const option = TX_TYPES.find((item) => item.key === txType.value)
    if (!option || !option.match) return list
    return list.filter(option.match)
  })

  /** Tabloya basilan son liste: tur + tarih filtresi. */
  const txRows = computed(() => {
    const start = txRangeStart(txRange.value)
    return txByType.value
      .filter((tx) => {
        if (!start) return true
        const date = new Date(tx.createdAt)
        return !Number.isNaN(date.getTime()) && date >= start
      })
      .map((tx) => {
        const date = new Date(tx.createdAt)
        const valid = !Number.isNaN(date.getTime())
        const isWithdraw = tx.type === "withdraw"
        return {
          id: String(tx._id),
          date: valid ? txFormatDay(date) : "—",
          time: valid ? txPad(date.getHours()) + ":" + txPad(date.getMinutes()) + ":" + txPad(date.getSeconds()) : "",
          label: tx.title || (isWithdraw ? "Withdrawal" : "Deposit"),
          method: txMethodLabel(tx.method),
          amount: (isWithdraw ? "−" : "+") + accountFormatMoney(tx.amount, tx.currency || activeCurrency.value),
          negative: isWithdraw,
          status: accountStatusLabel(tx.status),
          tone: accountStatusTone(tx.status),
          info: txReference(tx),
        }
      })
  })

  /** Kaydi olmayan turler menude soluk gorunur (referans tasarim). */
  const txTypeCounts = computed(() => {
    const list = transactions.value || []
    const counts = {}
    TX_TYPES.forEach((option) => {
      counts[option.key] = option.match ? list.filter(option.match).length : list.length
    })
    return counts
  })

  const txRangeLabel = computed(() => {
    const start = txRangeStart(txRange.value)
    const end = new Date()
    if (start) return txFormatDay(start) + " - " + txFormatDay(end)
    const list = transactions.value || []
    const oldest = list.length ? new Date(list[list.length - 1].createdAt) : null
    if (!oldest || Number.isNaN(oldest.getTime())) return "All time"
    return txFormatDay(oldest) + " - " + txFormatDay(end)
  })

  const txTypeLabel = computed(() => {
    const option = TX_TYPES.find((item) => item.key === txType.value)
    return option ? option.label : "All types"
  })

  const txIsFiltered = computed(() => txType.value !== "all" || txRange.value !== "all")

  function txCopyInfo(row) {
    if (row.info) toastMessage("Islem referansi: " + row.info)
  }


  /* ===== Game History / Sessions / Verification ===== */
  const { gameHistory, sessions, backendAssetUrl } = ctx

  /* --- Game History -------------------------------------------------------
   * Veri CANLI: account-pages.js -> GET /game-history/:identifier
   * Satir alanlari: txn_id, created_at, game_name, game_type, banner,
   * bet_money, win_money, balance_after, provider_code.
   *
   * DIKKAT: `provider` populate EDILMEZ (duz ObjectId) — asla basilmaz,
   * insan-okunur etiket `provider_code`. Filtre `game_type` uzerinden
   * ISTEMCI tarafinda calisir; sunucu filtresi gerekince
   * GET /game-history?type= eklenmeli.
   * --------------------------------------------------------------------- */
  const ghFilter = ref("all")
  const ghFilterOpen = ref(false)

  function ghToggleFilter() {
    ghFilterOpen.value = !ghFilterOpen.value
  }
  function ghCloseMenu() {
    ghFilterOpen.value = false
  }
  function ghSelectFilter(key) {
    ghFilter.value = key
    ghFilterOpen.value = false
  }

  function ghTypeLabel(type) {
    const raw = String(type || "other")
    if (raw === "other") return "Other"
    return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[-_]/g, " ")
  }

  /** "All games" + yuklenen kayitlarda gecen benzersiz game_type degerleri. */
  const ghFilters = computed(() => {
    const seen = []
    ;(gameHistory.value || []).forEach((row) => {
      const type = String(row.game_type || "other")
      if (!seen.includes(type)) seen.push(type)
    })
    return [{ key: "all", label: "All games" }].concat(
      seen.map((type) => ({ key: type, label: ghTypeLabel(type) })),
    )
  })

  const ghFilterLabel = computed(() => {
    const option = ghFilters.value.find((item) => item.key === ghFilter.value)
    return option ? option.label : "All games"
  })

  const ghRows = computed(() => {
    const currency = activeCurrency.value
    return (gameHistory.value || [])
      .filter((row) => ghFilter.value === "all" || String(row.game_type || "other") === ghFilter.value)
      .map((row, index) => {
        const bet = Number(row.bet_money) || 0
        const win = Number(row.win_money) || 0
        const date = new Date(row.created_at)
        const valid = !Number.isNaN(date.getTime())
        return {
          id: String(row.txn_id || row.round_id || index),
          game: row.game_name || "Unknown",
          image: (row.banner && backendAssetUrl(row.banner)) || "assets/loot-icon.png",
          time: valid
            ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "—",
          bet: accountFormatMoney(bet, currency),
          // Carpan yalnizca gecerli bir bahis varsa anlamli
          multiplier: bet > 0 ? "x " + (win / bet).toFixed(2) : "—",
          payout: accountFormatMoney(win, currency),
          balance: accountFormatMoney(row.balance_after, currency),
          hasWin: win > 0,
        }
      })
  })

  /* --- Sessions -----------------------------------------------------------
   * Veri CANLI: account-pages.js -> GET /account/sessions?limit=25
   * Satir alanlari: _id, at, ip, userAgent.
   *
   * Ilk kayit (en yeni) "Current" kabul edilir — backend oturumu isaretleyen
   * bir alan dondurmuyor. Tek oturumu kapatmak icin de uc YOK; eklenince
   * ssLogout() gercek cagriya baglanmali:
   *   DELETE /account/sessions/:id  ->  { success: true }
   * --------------------------------------------------------------------- */
  function ssLogout(row) {
    toastMessage("Oturum kapatma ucu henuz yok: DELETE /account/sessions/" + row.id)
  }

  const ssRows = computed(() =>
    (sessions.value || []).map((entry, index) => {
      const date = new Date(entry.at)
      const valid = !Number.isNaN(date.getTime())
      const current = index === 0
      return {
        id: String(entry._id || index),
        date: valid
          ? String(date.getMonth() + 1).padStart(2, "0") +
            "/" +
            String(date.getDate()).padStart(2, "0") +
            "/" +
            String(date.getFullYear()).slice(-2)
          : "—",
        // Referans tasarim tam User-Agent dizesini gosteriyor
        agent: entry.userAgent || "Unknown device",
        state: current ? "Current" : "Active",
        tone: current ? "current" : "active",
        current,
      }
    }),
  )

  /* --- Verification (KYC) -------------------------------------------------
   * Kimlik alanlari CANLI: /account/overview -> profile
   *
   * ADRES SEMA UYUSMAZLIGI: gercek backend'de `user.address` Brezilya
   * sablonudur (cep / estado / cidade / bairro / rua / numeroEnd /
   * complemento), mock ise { country, city } donuyor. Asagidaki normalizasyon
   * IKISINI de destekler — birini kaldirmayin.
   *
   * "Politically Exposed Person" backend'de YOK, statik "No" gosterilir.
   * Alan eklenince: profile.politicallyExposed -> Yes/No.
   * --------------------------------------------------------------------- */
  function kycPick() {
    for (let i = 0; i < arguments.length; i += 1) {
      const value = arguments[i]
      if (value != null && String(value).trim() !== "") return String(value).trim()
    }
    return ""
  }

  const kycRows = computed(() => {
    const p = profile.value
    if (!p) return []
    const address = p.address || {}
    const living = [
      kycPick(address.rua, address.line1, address.street),
      kycPick(address.numeroEnd, address.number),
      kycPick(address.bairro, address.district),
      kycPick(address.complemento),
    ].filter(Boolean)

    return [
      { label: "Your name", value: kycPick(p.name, p.username) || "—" },
      { label: "Date of Birth", value: p.birthday ? accountFormatDateOnly(p.birthday) : "Not added" },
      { label: "Your country", value: kycPick(address.country, address.estado) || "Not added" },
      { label: "Living Address", value: living.length ? living.join(", ") : "Not added" },
      { label: "City", value: kycPick(address.city, address.cidade) || "Not added" },
      { label: "Postal Code", value: kycPick(address.postalCode, address.cep) || "Not added" },
      // Backend'de karsiligi yok — statik
      { label: "Politically Exposed Person", value: "No", help: true },
    ]
  })

  /**
   * Adim gostergesi: 1) hesap acildi 2) e-posta dogrulandi 3) kimlik onaylandi.
   * Backend ayri bir KYC adim alani dondurmuyor, mevcut bayraklardan turetiyoruz.
   */
  const kycStep = computed(() => {
    const p = profile.value
    if (!p) return 1
    if (p.identityVerified) return 3
    if (p.emailVerified) return 2
    return 1
  })

  const kycComplete = computed(() => kycStep.value >= 3)

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
    txRanges,
    txTypes,
    txRange,
    txType,
    txRangeOpen,
    txTypeOpen,
    txToggleRange,
    txToggleType,
    txSelectRange,
    txSelectType,
    txResetFilters,
    txCloseMenus,
    txRows,
    txRangeLabel,
    txTypeLabel,
    txTypeCounts,
    txIsFiltered,
    txCopyInfo,
    ghFilter,
    ghFilterOpen,
    ghFilters,
    ghFilterLabel,
    ghRows,
    ghToggleFilter,
    ghCloseMenu,
    ghSelectFilter,
    ssRows,
    ssLogout,
    kycRows,
    kycStep,
    kycComplete,
  }
}
