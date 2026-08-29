/**
 * Profil modali (Profile / Details) mantigi.
 * casino-ui/index.html icindeki Vue setup() fonksiyonundan cagrilir.
 *
 * ============================================================================
 * BACKEND BAGLAMA NOTLARI  (su an TAMAMI STATIK — bilincli tercih)
 * ============================================================================
 * Bu modaldeki tum rakamlar STATIK. Kullanici adi, rank ve oyun kapaklari
 * mevcut canli verilerden (authUser + oyun katalogu) geliyor; geri kalan
 * metrikler placeholder. Gercek backend'e gecerken beklenen uclar:
 *
 *  1) GET /account/profile-stats
 *     -> { success, data: {
 *            memberSince: ISO date,
 *            chatActivity: { level, total, tier, lines:[{key,current,total}] },
 *            statistics:   { totalWagered, totalBets, earnedStaking },
 *            activity:     { totalTips, totalRains, totalCoindrops },
 *            futures:      { totalWagered, totalBets, totalWin },
 *            lootboxes:    { totalWagered, totalBets, totalWin }
 *          } }
 *     Kaynak onerisi: backend/database/models/User.js + Bet/Transaction
 *     toplamlari (aggregate). Tutarlar SUNUCUDA hesaplanmali, istemciden
 *     gelen degerlere guvenilmemeli.
 *
 *  2) GET /account/top-games?limit=4
 *     -> { success, data: [{ gameId, name, banner, wagered }] }
 *     Simdilik kapaklar `topSlots` katalogundan aliniyor, tutarlar statik.
 *
 *  3) GET /account/battle-rewards
 *     -> { success, data: [{ name, date, place, prize, coins:[icon] }] }
 *     Backend'de turnuva/battle modeli olusunca baglanir.
 *
 *  4) GET /account/wagered-breakdown?game=<all|slots|live|originals>
 *     -> { success, data: [{ currency, amount, bets, icon }] }
 *     "Details" ekranindaki tablo. `game` filtresi sunucu tarafinda
 *     uygulanmali (istemcide filtrelemek tum veriyi sizdirir).
 *
 * Ayrica bkz. /MOCK-BACKEND.md
 * ============================================================================
 */
window.createProfileModal = function createProfileModal(ctx) {
  const { ref, computed, nextTick, authUser, userRank, topSlots, toastMessage } = ctx

  // null | 'profile' | 'details'
  const pmView = ref(null)
  const pmActivityOpen = ref(false)
  const pmFilterOpen = ref(false)
  const pmFilter = ref("All games")
  const pmScroll = ref(null)

  const pmIsOpen = computed(() => pmView.value !== null)

  // ---- Kimlik (canli veriden) ----
  const pmUsername = computed(() => (authUser.value && authUser.value.username) || "Player")
  const pmRankLabel = computed(() => `${userRank.value} Rank`)

  const pmMemberAge = computed(() => {
    const raw = authUser.value && (authUser.value.createdAt || authUser.value.registeredAt)
    if (!raw) return "New member"
    const start = new Date(raw)
    if (Number.isNaN(start.getTime())) return "New member"
    let months = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    months = Math.max(0, Math.floor(months))
    const years = Math.floor(months / 12)
    const rest = months % 12
    if (!years && !rest) return "Less than a month"
    const parts = []
    if (years) parts.push(`${years} year${years > 1 ? "s" : ""}`)
    if (rest) parts.push(`${rest} month${rest > 1 ? "s" : ""}`)
    return parts.join(" ")
  })

  // ---- Statik veri (bkz. dosya basi notlari) ----
  const pmChatActivity = [
    { emoji: "\uD83D\uDCAC", label: "Total Messages", current: "4", total: "500", progress: 0.8 },
    { emoji: "\u2764\uFE0F", label: "Likes received", current: "1", total: "250", progress: 0.4 },
    { emoji: "\uD83D\uDCB8", label: "Coindrops", current: "0", total: "10", progress: 0 },
    { emoji: "\u2614", label: "Rains", current: "0", total: "10", progress: 0 },
  ]
  const pmChatLevel = "1/5"
  const pmChatTier = "Junior"

  const pmMetricSections = [
    {
      title: "Statistics",
      metrics: [
        { label: "Total Wagered", value: "$27,806.07" },
        { label: "Total Bets", value: "5263" },
        { label: "Earned Staking", value: "$0.36", help: true },
      ],
    },
    {
      title: "Activity",
      metrics: [
        { label: "Total Tips", value: "$0.00" },
        { label: "Total Rains", value: "$0.00" },
        { label: "Total Coindrops", value: "$0.00" },
      ],
    },
    {
      title: "Crypto Futures",
      metrics: [
        { label: "Total Wagered", value: "$0.07" },
        { label: "Total Bets", value: "1" },
        { label: "Total Win", value: "$0.00" },
      ],
    },
    {
      title: "Lootboxes",
      metrics: [
        { label: "Total Wagered", value: "$0.27" },
        { label: "Total Bets", value: "13" },
        { label: "Total Win", value: "$0.00" },
      ],
    },
  ]

  // Kapaklar canli katalogdan, tutarlar statik.
  const PM_TOP_WAGERED = ["$15,302.39", "$3,978.00", "$3,093.00", "$1,590.47"]
  const pmGames = computed(() => {
    const list = Array.isArray(topSlots.value) ? topSlots.value.slice(0, 4) : []
    return PM_TOP_WAGERED.map((amount, index) => {
      const game = list[index] || null
      return {
        key: `pm-top-${index}`,
        name: (game && (game.name || game.title)) || "Slot game",
        image: (game && (game.banner || game.background || game.img)) || "assets/slot-icon.png",
        amount,
      }
    })
  })

  const pmBattles = [
    { name: "Lucky Daily", date: "07/06/2024", place: "16", prize: "$2.12", coins: false },
    { name: "Free-to-play FunFury", date: "12/09/2023", place: "146", prize: "$0.37", coins: true },
    { name: "Daily", date: "08/02/2024", place: "362", prize: "$0.77", coins: false },
  ]

  const pmFilters = ["All games", "Slots", "Live Casino", "Originals"]
  const pmDetailRows = [
    { currency: "BNB", amount: "$1,120.76", bet: "53", icon: "assets/coin-bnb.png" },
    { currency: "BFG", amount: "$9.23", bet: "353", icon: "assets/coin-bfg.png" },
    { currency: "USDT", amount: "$26,415.33", bet: "4641", icon: "assets/coin-usdt.png" },
    { currency: "stBFG", amount: "$41.72", bet: "130", icon: "assets/coin-bfg.png" },
    { currency: "BTC", amount: "$0.10", bet: "4", icon: "assets/coin-btc.png" },
    { currency: "SHIB", amount: "$0.00", bet: "1", icon: "" },
  ]

  // ---- Aksiyonlar ----
  function pmResetScroll() {
    nextTick(() => {
      if (pmScroll.value) pmScroll.value.scrollTop = 0
    })
  }
  function openProfileModal() {
    pmView.value = "profile"
    pmActivityOpen.value = false
    pmFilterOpen.value = false
    pmResetScroll()
  }
  function closeProfileModal() {
    pmView.value = null
    pmFilterOpen.value = false
    pmActivityOpen.value = false
  }
  function openProfileDetails() {
    pmActivityOpen.value = false
    pmFilterOpen.value = false
    pmView.value = "details"
  }
  function backToProfileView() {
    pmView.value = "profile"
    pmFilterOpen.value = false
    pmResetScroll()
  }
  function toggleProfileActivity() {
    pmActivityOpen.value = !pmActivityOpen.value
  }
  function toggleProfileFilter() {
    pmFilterOpen.value = !pmFilterOpen.value
  }
  function selectProfileFilter(filter) {
    pmFilter.value = filter
    pmFilterOpen.value = false
  }
  function profileLeaveTip() {
    if (typeof toastMessage === "function") toastMessage("Bahsis gonderme yakinda aktif olacak")
  }

  return {
    pmView,
    pmIsOpen,
    pmActivityOpen,
    pmFilterOpen,
    pmFilter,
    pmScroll,
    pmUsername,
    pmRankLabel,
    pmMemberAge,
    pmChatActivity,
    pmChatLevel,
    pmChatTier,
    pmMetricSections,
    pmGames,
    pmBattles,
    pmFilters,
    pmDetailRows,
    openProfileModal,
    closeProfileModal,
    openProfileDetails,
    backToProfileView,
    toggleProfileActivity,
    toggleProfileFilter,
    selectProfileFilter,
    profileLeaveTip,
  }
}
