window.createBonusesPage = function createBonusesPage(ctx) {
  const { ref, computed, onMounted, currentPage, toastMessage, apiUrl, backendAssetUrl, readAuthToken, openDeposit } = ctx
  const isBonusesPage = currentPage === "bonuses"

  const bonusAssets = {
    rankAvatar: "assets/bonus-rank.png", fs: "assets/bonus-fs.png", wheel: "assets/bonus-wheel.png",
    rake: "assets/bonus-rakeback.png", cash: "assets/bonus-cashback.png", weekly: "assets/bonus-weekly.png",
    sport: "assets/bonus-sport.png", monthly: "assets/bonus-monthly.png", vip1: "assets/bonus-calendar.png",
    vip2: "assets/bonus-party.png", vip3: "assets/bonus-gift.png", vip4: "assets/bonus-birthday.png",
    drops: "assets/bonus-coins.png", rains: "assets/bonus-rains.png", tips: "assets/bonus-tips.png",
    bannerLeft: "assets/bonus-banner-left.png", bannerRight: "assets/bonus-banner-right.png",
    bonusChest: "assets/bonus-chest.png", smallAvatar: "assets/bonus-avatar.png", tether: "assets/bonus-tether.png",
    ukFlag: "assets/bonus-uk-flag.png", trophy: "assets/bonus-trophy.png", rankCoin: "assets/bonus-rank-coin.png",
    crown: "assets/bonus-crown.png", calendarIcon: "assets/bonus-calendar-icon.png", usFlag: "assets/bonus-us-flag.png",
    avatar: "assets/bonus-avatar.png",
  }

  const bonusItems = ref([])
  const bonusLoading = ref(false)
  const bonusError = ref("")
  const bonusActionLoading = ref("")
  const vipCards = computed(() => bonusItems.value.filter((item) => item.category === "vip"))
  const otherCards = computed(() => bonusItems.value.filter((item) => item.category === "other"))
  const specialBonuses = computed(() => bonusItems.value.filter((item) => item.category === "special"))
  const regularBonuses = computed(() => bonusItems.value.filter((item) => !["vip", "other", "special"].includes(item.category)))

  const faqs = [
    { left: [{ icon: "∞", q: "Are there limits on the amount of bonus withdrawals?", a: "Withdrawal limits depend on the bonus type and its individual terms." }, { icon: "i", q: "Which bonuses are credited to the calendar?", a: "Eligible regular bonuses are automatically shown in your Bonus Calendar.", tall: true }, { icon: "!", q: "Do calendar bonuses expire?", a: "Calendar rewards display their expiration date before you claim them." }], right: [{ icon: "i", q: "Can regular bonuses expire?", a: "Yes. Each available regular bonus has its own claim period." }, { icon: "i", q: "Where can I find bonus expiration date?", a: "The expiration time is displayed on the relevant bonus card." }, { icon: "!", q: "Are there any restrictions?", a: "Bonus eligibility and regional restrictions are explained in the terms." }] },
    { left: [{ icon: "i", q: "How can I activate Free Spins?", a: "Open the active Free Spins offer and follow its deposit conditions." }, { icon: "$", q: "What is the minimum deposit amount?", a: "The required amount appears directly on each offer card.", tall: true }, { icon: "x", q: "What are the wagering requirements?", a: "Wagering requirements vary by promotion." }], right: [{ icon: "i", q: "How long are Free Spins available?", a: "The remaining time is shown on the bonus card." }, { icon: "i", q: "Can I use several deposit bonuses?", a: "Only one active deposit bonus can be used at a time." }, { icon: "i", q: "Where can I see the bonus terms?", a: "Open the information icon on an offer." }] },
  ]
  const statisticRows = [{ name: "Rakeback", image: bonusAssets.rake }, { name: "Weekly Bonus", image: bonusAssets.weekly }, { name: "Monthly Bonus", image: bonusAssets.monthly }, { name: "Weekly Sport Bonus", image: bonusAssets.sport }]
  const historyRows = [{ name: "Cashback", image: bonusAssets.cash, amount: "$24.63", percent: "20.6%" }, { name: "Rakeback", image: bonusAssets.rake, amount: "$20.88", percent: "17.4%" }, { name: "Weekly Bonus", image: bonusAssets.weekly, amount: "$8.12", percent: "6.8%" }, { name: "Monthly Bonus", image: bonusAssets.monthly, amount: "$32.76", percent: "27.4%" }]
  const specialHistoryRows = [{ title: "SPECIAL BONUS", value: "$223.50 USDT", status: "Canceled", image: bonusAssets.cash }, { title: "WELCOME PACK", value: "$0.07 USDT", status: "Canceled", image: bonusAssets.fs }]

  const bonusDepositModal = ref(false), historyModal = ref(false), specialHistoryModal = ref(false), statisticModal = ref(false)
  const shareModal = ref(false), calendarDetailsModal = ref(false), regularBonusModal = ref(null), bonusExpanded = ref(true)
  const faqTab = ref(0), openFaq = ref("")
  const displayedFaq = computed(() => faqs[faqTab.value])

  // Kullanıcıya gösterilen durum etiketleri, motorun CasinoUserState
  // durumlarıyla birebir eşleşir; hiçbiri "sessizce" gizlenmez.
  const stateLabels = {
    "awaiting-deposit": { label: "DEPOSIT REQUIRED", tone: "pending" },
    eligible: { label: "ACTIVATING", tone: "pending" },
    "delivery-pending": { label: "DELIVERING…", tone: "pending" },
    "delivery-failed": { label: "DELIVERY ISSUE", tone: "error" },
    wagering: { label: "WAGERING", tone: "active" },
    claimed: { label: "ACTIVE", tone: "done" },
    completed: { label: "COMPLETED", tone: "done" },
    expired: { label: "EXPIRED", tone: "error" },
    rejected: { label: "CANCELLED", tone: "error" },
  }
  const money = (amount, currency) => `${Number(amount || 0).toLocaleString("en-US")} ${currency || ""}`.trim()

  // Kartta gösterilecek satırlar admin kaydından türetilir — sabit metin yok.
  const bonusDetailRows = (rules, reward) => {
    const rows = []
    const currency = (rules.currencies || [])[0] || reward.currency || ""
    if (reward.type === "free-spins") {
      if (reward.spinCount) rows.push({ label: "Free spins", value: `${reward.spinCount}` })
      if (reward.gameCode) rows.push({ label: "Game", value: reward.gameCode })
      if (reward.betAmount) rows.push({ label: "Bet per spin", value: money(reward.betAmount, currency) })
    } else if (reward.amount) {
      rows.push({ label: "Reward", value: money(reward.amount, reward.currency) })
    }
    if (rules.activation === "deposit" && rules.minimumDeposit) rows.push({ label: "Min. deposit", value: money(rules.minimumDeposit, currency) })
    if (rules.maxBonusAmount) rows.push({ label: "Max. bonus", value: money(rules.maxBonusAmount, currency) })
    if (rules.wagerMultiplier) rows.push({ label: "Wager", value: `x${rules.wagerMultiplier}` })
    if (rules.maxClaimMultiplier) rows.push({ label: "Max. claim", value: `x${rules.maxClaimMultiplier}` })
    return rows
  }

  const normalizeBonus = (item) => {
    const rules = item.rules || {}
    const reward = item.reward || { type: item.bonusType || "bonus", amount: Number(item.percentage || 0), currency: "%" }
    const content = item.content || {}
    const state = item.userState || null
    const status = state?.status || ""
    const badge = stateLabels[status] || { label: "AVAILABLE", tone: "idle" }
    return {
      id: item._id || item.id || item.slug,
      title: item.title,
      // Admin "vurgu metni" girmişse kartın büyük satırı odur (örn. "50 Free Spins").
      highlight: content.highlight || item.subtitle || item.title,
      label: content.label || "Special Bonus",
      infoText: content.infoText || item.description || "",
      image: item.image ? backendAssetUrl(item.image) : item.img ? backendAssetUrl(item.img) : bonusAssets.bonusChest,
      copy: item.description || item.subtitle || "",
      description: item.description || item.modalDescription || "",
      category: String(item.category || content.section || item.bonusType || "regular").toLowerCase(),
      reward,
      rules,
      rows: bonusDetailRows(rules, reward),
      userState: state,
      status,
      statusLabel: badge.label,
      statusTone: badge.tone,
      // Seçim yapılmamışsa CTA yatırım bonusunda "Select", anında bonusta "Claim".
      action: state ? "view" : rules.activation === "instant" ? "claim" : "select",
      expiresAt: state?.expiresAt || null,
      wagerProgress: Number(state?.progress || 0),
      wagerTarget: Number(state?.target || 0),
      wagerPercent: state?.target > 0 ? Math.min(100, Math.round((state.progress / state.target) * 100)) : 0,
      deliveryError: status === "delivery-failed" ? state?.lastError || "" : "",
      managedContent: Boolean(item.slug),
    }
  }
  async function loadBonuses() {
    if (!isBonusesPage) return
    bonusLoading.value = true
    bonusError.value = ""
    try {
      const response = await fetch(apiUrl("/content/bonus"), { headers: authHeaders() })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || "Bonuses could not be loaded")
      bonusItems.value = (payload.data || []).map(normalizeBonus)
      if (!bonusItems.value.length) {
        const legacyResponse = await fetch(apiUrl("/bonus"))
        if (legacyResponse.ok) bonusItems.value = (await legacyResponse.json()).map(normalizeBonus)
      }
    } catch (error) {
      bonusError.value = error.message || "Bonuses could not be loaded"
      bonusItems.value = []
    } finally { bonusLoading.value = false }
  }
  function authHeaders() {
    const token = typeof readAuthToken === "function" ? readAuthToken() : ""
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  async function claimBonus(item) {
    if (!authHeaders().Authorization) { toastMessage("Please sign in to claim a bonus"); return }
    if (!item?.id || bonusActionLoading.value) return
    bonusActionLoading.value = item.id
    try {
      const managedContent = item.managedContent
      const path = managedContent ? `/content/bonus/${item.id}/claim` : "/bonus/claim"
      const headers = { ...authHeaders(), "Content-Type": "application/json", "Idempotency-Key": `bonus-${item.id}-${Date.now()}` }
      const response = await fetch(apiUrl(path), { method: "POST", credentials: "include", headers, body: managedContent ? undefined : JSON.stringify({ bonusId: item.id }) })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || payload.message || "Bonus could not be claimed")
      toastMessage("Bonus claimed successfully")
      await loadBonuses()
    } catch (error) { toastMessage(error.message || "Bonus could not be claimed") }
    finally { bonusActionLoading.value = "" }
  }
  // Special bonus seçimi. Motor "instant" bonusu anında teslim eder;
  // "deposit" bonusu yatırım beklemeye alınır.
  async function selectBonus(item) {
    if (!authHeaders().Authorization) { toastMessage("Please sign in to select a bonus"); return }
    if (!item?.id || bonusActionLoading.value) return
    bonusActionLoading.value = item.id
    try {
      const response = await fetch(apiUrl(`/content/bonuses/${item.id}/select`), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || "Bonus could not be selected")
      const status = payload.data?.status
      toastMessage(
        payload.meta?.duplicate ? "You already selected this bonus"
          : status === "awaiting-deposit" ? "Bonus selected — make a qualifying deposit to activate it"
            : "Bonus activated",
      )
      await loadBonuses()
    } catch (error) { toastMessage(error.message || "Bonus could not be selected") }
    finally { bonusActionLoading.value = "" }
  }

  // Kart CTA'sı: seçilmemiş bonusu seçtirir, yatırım bekleyeni deposit modalına
  // götürür, anında bonusu claim eder.
  function runBonusAction(item) {
    if (!item) return
    // Tek gercek deposit ekrani cuzdan modalindaki (wallet-modal.js) ekrandir —
    // sahte/statik bir kopya modal yerine onu aciyoruz.
    if (item.status === "awaiting-deposit") {
      if (typeof openDeposit === "function") { openDeposit("crypto"); return }
      bonusDepositModal.value = true
      return
    }
    if (item.action === "claim") { claimBonus(item); return }
    if (item.action === "select") { selectBonus(item); return }
    openRegularInfo(item)
  }

  // Yatırım penceresi / bonus süresi geri sayımı. Saniyede bir tetiklenir.
  const bonusNow = ref(Date.now())
  if (isBonusesPage && typeof setInterval === "function") setInterval(() => { bonusNow.value = Date.now() }, 1000)
  const countdownFor = (expiresAt) => {
    if (!expiresAt) return ""
    const remaining = new Date(expiresAt).getTime() - bonusNow.value
    if (remaining <= 0) return "00:00:00"
    const days = Math.floor(remaining / 86400000)
    const hours = String(Math.floor(remaining / 3600000) % 24).padStart(2, "0")
    const minutes = String(Math.floor(remaining / 60000) % 60).padStart(2, "0")
    const seconds = String(Math.floor(remaining / 1000) % 60).padStart(2, "0")
    return `${days ? `${days}d ` : ""}${hours}:${minutes}:${seconds}`
  }
  // Deposit modalındaki "Active Deposit Bonus" satırı gerçek seçimi gösterir.
  const activeDepositBonus = computed(() => bonusItems.value.find((item) => item.status === "awaiting-deposit") || null)

  function bonusNotify(message) { toastMessage(message) }
  function openRegularInfo(type) { regularBonusModal.value = type }
  function toggleFaq(id) { openFaq.value = openFaq.value === id ? "" : id }
  function closeBonusModals() { bonusDepositModal.value = false; historyModal.value = false; specialHistoryModal.value = false; statisticModal.value = false; shareModal.value = false; calendarDetailsModal.value = false; regularBonusModal.value = null }

  if (typeof onMounted === "function") onMounted(loadBonuses)
  return { isBonusesPage, bonusAssets, vipCards, otherCards, specialBonuses, regularBonuses, bonusItems, bonusLoading, bonusError, bonusActionLoading, historyRows, statisticRows, specialHistoryRows, displayedFaq, faqTab, openFaq, bonusDepositModal, historyModal, specialHistoryModal, statisticModal, shareModal, calendarDetailsModal, regularBonusModal, bonusExpanded, bonusNotify, claimBonus, loadBonuses, openRegularInfo, toggleFaq, closeBonusModals, selectBonus, runBonusAction, countdownFor, activeDepositBonus }
}
