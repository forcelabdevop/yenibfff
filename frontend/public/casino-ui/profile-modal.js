/**
 * Profil modali (Profile / Details) mantigi.
 * casino-ui/index.html icindeki Vue setup() fonksiyonundan cagrilir.
 *
 * Profil metrikleri /account/overview yanitindaki kullaniciya ait canli
 * stats alanindan gelir. Kaydi olmayan metrikler uydurulmaz ve sifir gosterilir.
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
  const { ref, computed, nextTick, authUser, userRank, accountStats, toastMessage, loadProfileStats } = ctx

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

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
  const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number(value))
  const userStats = computed(() => (accountStats && accountStats.value) || {})
  const pmChatActivity = computed(() => {
    const chat = userStats.value.chat || {}
    return [
      { label: "Total Messages", current: String(number(chat.messages)), total: String(number(chat.nextLevelAt)), progress: number(chat.nextLevelAt) ? Math.min(100, number(chat.messages) / number(chat.nextLevelAt) * 100) : 0 },
      { label: "Likes received", current: String(number(chat.likes)), total: String(number(chat.nextLikesAt)), progress: number(chat.nextLikesAt) ? Math.min(100, number(chat.likes) / number(chat.nextLikesAt) * 100) : 0 },
      { label: "Coindrops", current: String(number(chat.coindrops)), total: String(number(chat.nextCoindropsAt)), progress: number(chat.nextCoindropsAt) ? Math.min(100, number(chat.coindrops) / number(chat.nextCoindropsAt) * 100) : 0 },
      { label: "Rains", current: String(number(chat.rains)), total: String(number(chat.nextRainsAt)), progress: number(chat.nextRainsAt) ? Math.min(100, number(chat.rains) / number(chat.nextRainsAt) * 100) : 0 },
    ]
  })
  const pmChatLevel = computed(() => String(userStats.value.chat?.level || 0))
  const pmChatTier = computed(() => String(userStats.value.chat?.tier || "New member"))
  const pmMetricSections = computed(() => {
    const stats = userStats.value
    return [
      { title: "Statistics", metrics: [{ label: "Total Wagered", value: money(stats.totalWagered) }, { label: "Total Bets", value: String(number(stats.totalBets)) }, { label: "Earned Staking", value: money(stats.earnedStaking), help: true }] },
      { title: "Activity", metrics: [{ label: "Total Tips", value: money(stats.totalTips) }, { label: "Total Rains", value: money(stats.totalRains) }, { label: "Total Coindrops", value: money(stats.totalCoindrops) }] },
      { title: "Crypto Futures", metrics: [{ label: "Total Wagered", value: money(stats.futures?.totalWagered) }, { label: "Total Bets", value: String(number(stats.futures?.totalBets)) }, { label: "Total Win", value: money(stats.futures?.totalWin) }] },
      { title: "Lootboxes", metrics: [{ label: "Total Wagered", value: money(stats.lootboxes?.totalWagered) }, { label: "Total Bets", value: String(number(stats.lootboxes?.totalBets)) }, { label: "Total Win", value: money(stats.lootboxes?.totalWin) }] },
    ]
  })
  const pmGames = computed(() => Array.isArray(userStats.value.topGames) ? userStats.value.topGames.map((game, index) => ({ key: game.gameId || `pm-top-${index}`, name: game.name, image: game.banner || "", amount: money(game.wagered) })) : [])
  const pmBattles = computed(() => Array.isArray(userStats.value.battleRewards) ? userStats.value.battleRewards : [])
  const pmFilters = ["All games", "Slots", "Live Casino", "Originals"]
  const pmDetailRows = computed(() => {
    const rows = Array.isArray(userStats.value.wageredBreakdown) ? userStats.value.wageredBreakdown : []
    return rows.filter(row => pmFilter.value === "All games" || row.category === pmFilter.value).map(row => ({ currency: row.currency, amount: money(row.amount), bet: String(number(row.bets)), icon: row.icon || "" }))
  })

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
    // Metrikler agir aggregate'lerden gelir; sayfa yuklemesinde degil yalnizca
    // modal acilinca cekilir. Sunucu 30sn onbellekledigi icin modali arka arkaya
    // acmak veritabanini tekrar yormaz.
    if (typeof loadProfileStats === "function") loadProfileStats()
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
