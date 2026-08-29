/* Promotions sayfasi (route: /promotions).
   Veri simdilik STATIK — kullanicinin referans tasarimiyla birebir. Backend hazir olunca:
     GET  /public/promotions          -> [{title,type,image}]
     POST /promo-code/redeem {code}   -> promo kodu (bkz. PROMO_CODE_API.md)
   index.html icindeki Edit geri-alinma tuzagina takilmasin diye mantik burada durur. */
window.createPromotionsPage = function createPromotionsPage(ctx) {
  const { ref, computed, currentPage, toastMessage } = ctx
  const isPromotionsPage = currentPage === "promotions"

  const prTab = ref("all")
  const prStatus = ref("Active")
  const prStatusOpen = ref(false)
  const prExpanded = ref(false)
  const prModal = ref(false)
  const prCode = ref("")

  const prStatusOptions = ["Active", "Upcoming", "Expired"]

  const prCards = [
    { title: "Promo Codes", type: "casino", image: "assets/promo/card-1.png" },
    { title: "Complete Missions - Get Rewards", type: "casino", image: "assets/promo/card-2.png" },
    { title: "Sports Bonuses", type: "sports", image: "assets/promo/card-3.png" },
    { title: "Million Drops: Summer Festival", type: "casino", image: "assets/promo/card-4.png" },
    { title: "Early Payout", type: "sports", image: "assets/promo/card-5.png" },
    { title: "Lucky Races", type: "casino", image: "assets/promo/card-6.png" },
    { title: "Drops & Wins", type: "casino", image: "assets/promo/card-7.png" },
    { title: "Sports Cashback", type: "sports", image: "assets/promo/card-8.png" },
    { title: "BetFury Battles", type: "casino", image: "assets/promo/card-9.png" },
  ]

  const prMoreCards = [
    { title: "Weekly Cashback", subtitle: "Get rewarded every week", type: "casino" },
    { title: "Crypto Boost", subtitle: "More rewards with crypto", type: "casino" },
    { title: "Weekend Sports", subtitle: "Boost your weekend bets", type: "sports" },
  ]

  const prVisibleCards = computed(() =>
    prTab.value === "all" ? prCards : prCards.filter((card) => card.type === prTab.value),
  )
  const prExtraCards = computed(() =>
    prExpanded.value ? prMoreCards.filter((card) => prTab.value === "all" || card.type === prTab.value) : [],
  )
  const prTotalCount = prCards.length + prMoreCards.length
  const prShownCount = computed(() => (prExpanded.value ? prTotalCount : prCards.length))

  function prSelectTab(tab) {
    prTab.value = tab
  }
  function prToggleStatus() {
    prStatusOpen.value = !prStatusOpen.value
  }
  function prSetStatus(option) {
    prStatus.value = option
    prStatusOpen.value = false
  }
  function prOpenCard(card) {
    toastMessage(card.title)
  }
  function prApplyCode() {
    prModal.value = false
    toastMessage(prCode.value.trim() ? `Promo code "${prCode.value.trim()}" submitted` : "Please enter a promo code")
    prCode.value = ""
  }

  return {
    isPromotionsPage,
    prTab,
    prStatus,
    prStatusOpen,
    prStatusOptions,
    prExpanded,
    prModal,
    prCode,
    prVisibleCards,
    prExtraCards,
    prTotalCount,
    prShownCount,
    prSelectTab,
    prToggleStatus,
    prSetStatus,
    prOpenCard,
    prApplyCode,
  }
}
