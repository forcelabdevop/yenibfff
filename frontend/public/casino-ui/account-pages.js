/**
 * Kullanici hesap sayfalari (/wallet, /profile, /account, /transactions,
 * /game-history, /sessions, /vault) mantigi.
 * casino-ui/index.html icindeki Vue setup() fonksiyonundan cagrilir.
 *
 * Tum veriler backend'den gelir — mock/localStorage yok:
 *  - GET  /account/overview                 -> profil, guvenlik, cuzdan, kasa
 *  - GET  /account/sessions                 -> giris gecmisi
 *  - GET  /account/vault                    -> kasa durumu
 *  - POST /account/vault/deposit|withdraw   -> kasa transferi
 *  - GET  /transaction-history/:userId      -> odeme hareketleri
 *  - GET  /game-history/:identifier         -> oyun turlari
 */
window.createAccountPages = function createAccountPages(ctx) {
  const { ref, computed, currentPage, apiUrl, authUser, readAuthToken } = ctx

  // Bu sayfalar oturum gerektirir; index.html sablonu buna gore giris ekrani gosterir.
  const ACCOUNT_PAGES = ["wallet", "profile", "account", "transactions", "game-history", "sessions", "vault"]
  const isAccountPage = ACCOUNT_PAGES.includes(currentPage)
  const accountPageKey = currentPage

  const accountLoading = ref(false)
  const accountError = ref("")

  const profile = ref(null)
  const security = ref(null)
  const walletState = ref(null)
  const transactions = ref([])
  const gameHistory = ref([])
  const sessions = ref([])
  const vaultData = ref(null)

  const vaultAmount = ref("")
  const vaultBusy = ref(false)
  const vaultMessage = ref("")
  const vaultMessageType = ref("info") // info | success | error

  /** Yetkili istek yardimcisi. */
  async function authedFetch(path, options) {
    const token = readAuthToken()
    return fetch(apiUrl(path), {
      credentials: "include",
      ...options,
      headers: Object.assign(
        {},
        options && options.body ? { "Content-Type": "application/json" } : {},
        token ? { Authorization: "Bearer " + token } : {},
        (options && options.headers) || {},
      ),
    })
  }

  const activeCurrency = computed(() => {
    const fromWallet = walletState.value && walletState.value.activeWallet && walletState.value.activeWallet.coinType
    return fromWallet || (walletState.value && walletState.value.currency) || "TRY"
  })

  /** Cuzdan tablosu satirlari. */
  const walletRows = computed(() => {
    const state = walletState.value
    if (!state || !Array.isArray(state.wallets)) return []
    const active = state.activeWallet
    return state.wallets.map((wallet, index) => ({
      key: [wallet.coinType, wallet.chain, wallet.type, index].join("|"),
      coinType: wallet.coinType || "—",
      chain: wallet.chain || "",
      balance: Number(wallet.balance) || 0,
      active: !!(
        active &&
        active.coinType === wallet.coinType &&
        active.chain === wallet.chain &&
        active.type === wallet.type
      ),
    }))
  })

  /** Kasa tablosu satirlari. */
  const vaultRows = computed(() => {
    const balances = (vaultData.value && vaultData.value.balances) || []
    return balances
      .map((entry, index) => ({
        key: [entry.coinType, entry.chain, entry.type, index].join("|"),
        coinType: entry.coinType || "—",
        amount: Number(entry.amount) || 0,
      }))
      .filter((row) => row.amount > 0)
  })

  /**
   * Kasa sayfasindaki "Wallet" rakami. Tek dogruluk kaynagi /account/vault'un
   * `activeBalance` alanidir; yoksa overview'in cuzdan bloguna duseriz. Boylece
   * yukleyicilerin donus sirasi ekrandaki degeri etkilemez.
   */
  const vaultWalletBalance = computed(() => {
    const fromVault = vaultData.value && vaultData.value.activeBalance
    if (fromVault != null) return fromVault
    const wallet = walletState.value
    return (wallet && wallet.activeBalance) != null ? wallet.activeBalance : null
  })

  /** Account sayfasindaki dogrulama kontrol listesi. */
  const verificationRows = computed(() => {
    const p = profile.value
    const s = security.value
    if (!p) return []
    return [
      { label: "E-mail verified", done: !!p.emailVerified, value: p.emailVerified ? "Verified" : "Not verified" },
      { label: "Identity verified", done: !!p.identityVerified, value: p.identityVerified ? "Verified" : "Not verified" },
      { label: "Phone number", done: !!p.phone, value: p.phone ? "Added" : "Not added" },
      {
        label: "Two-factor authentication",
        done: !!(s && s.mfaEnabled),
        value: s && s.mfaEnabled ? (s.mfaMethodCount || 0) + " method(s)" : "Disabled",
      },
    ]
  })

  function accountFormatMoney(value, currency) {
    const amount = Number(value) || 0
    const code = currency || activeCurrency.value || "TRY"
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch (error) {
      // Bilinmeyen/kripto kodlari icin Intl hata verir — kodu sonuna ekleyerek gosteriyoruz.
      return amount.toLocaleString("tr-TR", { maximumFractionDigits: 8 }) + " " + code
    }
  }

  function accountFormatDate(value) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function accountFormatDateOnly(value) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })
  }

  function accountStatusTone(status) {
    const key = String(status || "").toLowerCase()
    if (["approved", "completed", "success", "done", "paid"].includes(key)) return "ok"
    if (["rejected", "failed", "cancelled", "canceled", "error"].includes(key)) return "bad"
    return "wait"
  }

  function accountStatusLabel(status) {
    const raw = String(status || "pending")
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  /** User-Agent'tan okunabilir cihaz aciklamasi uretir. */
  function accountDescribeDevice(userAgent) {
    const ua = String(userAgent || "")
    if (!ua) return "Unknown device"
    let browser = "Browser"
    if (/Edg\//i.test(ua)) browser = "Edge"
    else if (/OPR\/|Opera/i.test(ua)) browser = "Opera"
    else if (/Chrome\//i.test(ua)) browser = "Chrome"
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari"
    else if (/Firefox\//i.test(ua)) browser = "Firefox"

    let os = "Unknown OS"
    if (/Windows/i.test(ua)) os = "Windows"
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS"
    else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS"
    else if (/Android/i.test(ua)) os = "Android"
    else if (/Linux/i.test(ua)) os = "Linux"

    return browser + " · " + os
  }

  // -------------------------------------------------------------------------
  // Veri yukleme
  // -------------------------------------------------------------------------

  async function loadOverview() {
    const response = await authedFetch("/account/overview")
    if (!response.ok) throw new Error("overview")
    const payload = await response.json()
    const data = payload && payload.data
    if (!data) throw new Error("overview")
    profile.value = data.profile || null
    security.value = data.security || null
    walletState.value = data.wallet || null
    // DIKKAT: /account/overview'in `vault` nesnesi /account/vault'unkinden
    // DAHA AZ alan icerir — `activeBalance`/`activeWallet` yoktur. Duz atama
    // yapinca iki yukleyici (loadOverview + loadVault) paralel kostugu icin
    // hangisi sonra donerse kazaniyor ve kasa sayfasindaki "Wallet" degeri
    // rastgele 0'a dusuyordu. Bu yuzden mevcut alanlari koruyarak birlestir.
    if (data.vault) {
      vaultData.value = Object.assign({}, vaultData.value || {}, data.vault)
    }
  }

  async function loadTransactions() {
    const userId = authUser.value && authUser.value._id
    if (!userId) return
    const response = await authedFetch("/transaction-history/" + encodeURIComponent(userId) + "?limit=50")
    if (!response.ok) throw new Error("transactions")
    const payload = await response.json()
    transactions.value = (payload && payload.transactions) || []
  }

  async function loadGameHistory() {
    const userId = authUser.value && authUser.value._id
    if (!userId) return
    const response = await authedFetch("/game-history/" + encodeURIComponent(userId) + "?limit=50")
    if (!response.ok) throw new Error("game-history")
    const payload = await response.json()
    gameHistory.value = (payload && (payload.history || payload.data)) || []
  }

  async function loadSessions() {
    const response = await authedFetch("/account/sessions?limit=25")
    if (!response.ok) throw new Error("sessions")
    const payload = await response.json()
    sessions.value = (payload && payload.sessions) || []
  }

  async function loadVault() {
    const response = await authedFetch("/account/vault")
    if (!response.ok) throw new Error("vault")
    const payload = await response.json()
    vaultData.value = (payload && payload.data) || null
  }

  /** Aktif sayfaya gore gereken veriyi ceker. */
  async function loadAccountPage() {
    if (!isAccountPage || !authUser.value) return
    accountLoading.value = true
    accountError.value = ""
    try {
      // Tum sayfalar overview'a dayanir (para birimi formatlamasi dahil);
      // sayfaya ozel veri ek olarak paralel cekilir.
      const jobs = [loadOverview()]
      if (accountPageKey === "transactions") jobs.push(loadTransactions())
      if (accountPageKey === "game-history") jobs.push(loadGameHistory())
      if (accountPageKey === "sessions") jobs.push(loadSessions())
      if (accountPageKey === "vault") jobs.push(loadVault())
      await Promise.all(jobs)
    } catch (error) {
      accountError.value = "Bilgiler su an yuklenemiyor. Lutfen daha sonra tekrar dene."
    } finally {
      accountLoading.value = false
    }
  }

  // -------------------------------------------------------------------------
  // Kasa transferi
  // -------------------------------------------------------------------------

  async function runVaultTransfer(direction) {
    const amount = Number(vaultAmount.value)
    if (!Number.isFinite(amount) || amount <= 0) {
      vaultMessageType.value = "error"
      vaultMessage.value = "Lutfen gecerli bir tutar gir."
      return
    }

    vaultBusy.value = true
    vaultMessage.value = ""
    try {
      const response = await authedFetch("/account/vault/" + direction, {
        method: "POST",
        body: JSON.stringify({ amount }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.success) {
        vaultMessageType.value = "error"
        vaultMessage.value = payload.message || "Islem tamamlanamadi."
        return
      }

      vaultMessageType.value = "success"
      vaultMessage.value = direction === "deposit" ? "Tutar kasaya aktarildi." : "Tutar cuzdana aktarildi."
      vaultAmount.value = ""
      // Guncel bakiyeleri backend'den tekrar oku (tek dogruluk kaynagi).
      await Promise.all([loadVault(), loadOverview()])
    } catch (error) {
      vaultMessageType.value = "error"
      vaultMessage.value = "Sunucuya ulasilamiyor. Lutfen tekrar dene."
    } finally {
      vaultBusy.value = false
    }
  }

  const vaultDeposit = () => runVaultTransfer("deposit")
  const vaultWithdraw = () => runVaultTransfer("withdraw")

  return {
    isAccountPage,
    accountPageKey,
    accountLoading,
    accountError,
    profile,
    security,
    walletState,
    walletRows,
    activeCurrency,
    verificationRows,
    transactions,
    gameHistory,
    sessions,
    vaultData,
    vaultRows,
    vaultWalletBalance,
    vaultAmount,
    vaultBusy,
    vaultMessage,
    vaultMessageType,
    loadAccountPage,
    vaultDeposit,
    vaultWithdraw,
    accountFormatMoney,
    accountFormatDate,
    accountFormatDateOnly,
    accountStatusTone,
    accountStatusLabel,
    accountDescribeDevice,
  }
}
