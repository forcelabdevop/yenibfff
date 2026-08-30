window.createBonusesPage = function createBonusesPage(ctx) {
  const { ref, computed, onMounted, currentPage, toastMessage, apiUrl, backendAssetUrl, readAuthToken } = ctx
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

  const fallbackVipCards = [
    { title: "VIP Bounty", image: bonusAssets.vip1, copy: "Play Games and bet on Sports to increase the bonus." },
    { title: "Welcome VIP", image: bonusAssets.vip2, copy: "Join the VIP club to get a welcome bonus." },
    { title: "Personal VIP", image: bonusAssets.vip3, copy: "Get Personal VIP bonuses based on your activity." },
    { title: "Birthday", image: bonusAssets.vip4, copy: "Sweeten your birthday celebration with a bonus ready for you." },
  ]
  const fallbackOtherCards = [
    { title: "Coindrops", image: bonusAssets.drops, class: "coins", copy: "Get free coins in the Internal chat in one simple action." },
    { title: "Crypto Rains", image: bonusAssets.rains, class: "rains", copy: "Send crypto to random active users in the Internal Chat." },
    { title: "Tips", image: bonusAssets.tips, class: "tips", copy: "Communicate in the chat to get some crypto treats." },
  ]
  const bonusItems = ref([])
  const bonusLoading = ref(false)
  const bonusError = ref("")
  const bonusActionLoading = ref("")
  const vipCards = computed(() => {
    const items = bonusItems.value.filter((item) => item.category === "vip")
    return items.length ? items : fallbackVipCards
  })
  const otherCards = computed(() => {
    const items = bonusItems.value.filter((item) => item.category === "other")
    return items.length ? items : fallbackOtherCards
  })
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

  const normalizeBonus = (item) => ({
    id: item._id || item.id || item.slug,
    title: item.title,
    image: item.image ? backendAssetUrl(item.image) : item.img ? backendAssetUrl(item.img) : bonusAssets.bonusChest,
    copy: item.description || item.subtitle || "",
    description: item.description || item.modalDescription || "",
    category: String(item.category || item.content?.section || item.bonusType || "regular").toLowerCase(),
    reward: item.reward || { type: item.bonusType || "bonus", amount: Number(item.percentage || 0), currency: "%" },
    userState: item.userState || null,
    managedContent: Boolean(item.slug),
  })
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
  function bonusNotify(message) { toastMessage(message) }
  function openRegularInfo(type) { regularBonusModal.value = type }
  function toggleFaq(id) { openFaq.value = openFaq.value === id ? "" : id }
  function closeBonusModals() { bonusDepositModal.value = false; historyModal.value = false; specialHistoryModal.value = false; statisticModal.value = false; shareModal.value = false; calendarDetailsModal.value = false; regularBonusModal.value = null }

  if (typeof onMounted === "function") onMounted(loadBonuses)
  return { isBonusesPage, bonusAssets, vipCards, otherCards, specialBonuses, regularBonuses, bonusItems, bonusLoading, bonusError, bonusActionLoading, historyRows, statisticRows, specialHistoryRows, displayedFaq, faqTab, openFaq, bonusDepositModal, historyModal, specialHistoryModal, statisticModal, shareModal, calendarDetailsModal, regularBonusModal, bonusExpanded, bonusNotify, claimBonus, loadBonuses, openRegularInfo, toggleFaq, closeBonusModals }
}
