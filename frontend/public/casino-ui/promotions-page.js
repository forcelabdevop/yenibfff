window.createPromotionsPage = function createPromotionsPage(ctx) {
  const { ref, computed, onMounted, currentPage, toastMessage, apiUrl, backendAssetUrl, readAuthToken } = ctx
  const isPromotionsPage = currentPage === "promotions"

  const prTab = ref("all")
  const prStatus = ref("Active")
  const prStatusOpen = ref(false)
  const prExpanded = ref(false)
  const prModal = ref(false)
  const prDetails = ref(null)
  const prCode = ref("")
  const prLoading = ref(false)
  const prError = ref("")
  const prCodeLoading = ref(false)
  const prCards = ref([])

  const prStatusOptions = ["Active", "Upcoming", "Expired"]
  const fallbackCards = [
    { id: "promo-codes", title: "Promo Codes", type: "casino", image: "assets/promo/card-1.png", status: "Active", content: "Enter a promo code to unlock an available reward." },
    { id: "missions", title: "Complete Missions - Get Rewards", type: "casino", image: "assets/promo/card-2.png", status: "Active" },
    { id: "sports-bonuses", title: "Sports Bonuses", type: "sports", image: "assets/promo/card-3.png", status: "Active" },
    { id: "summer-festival", title: "Million Drops: Summer Festival", type: "casino", image: "assets/promo/card-4.png", status: "Active" },
    { id: "early-payout", title: "Early Payout", type: "sports", image: "assets/promo/card-5.png", status: "Active" },
    { id: "lucky-races", title: "Lucky Races", type: "casino", image: "assets/promo/card-6.png", status: "Active" },
    { id: "drops-wins", title: "Drops & Wins", type: "casino", image: "assets/promo/card-7.png", status: "Active" },
    { id: "sports-cashback", title: "Sports Cashback", type: "sports", image: "assets/promo/card-8.png", status: "Active" },
    { id: "battles", title: "BetFury Battles", type: "casino", image: "assets/promo/card-9.png", status: "Active" },
  ]

  const statusFor = (item) => {
    const now = Date.now()
    if (item.startsAt && new Date(item.startsAt).getTime() > now) return "Upcoming"
    if (item.endsAt && new Date(item.endsAt).getTime() < now) return "Expired"
    return "Active"
  }
  const normalizePromotion = (item) => ({
    id: item._id || item.id || item.slug,
    title: item.title,
    subtitle: item.subtitle || item.description || "",
    type: String(item.category || "casino").toLowerCase().includes("sport") ? "sports" : "casino",
    image: item.image ? backendAssetUrl(item.image) : item.banner ? backendAssetUrl(item.banner) : "assets/promo/card-1.png",
    content: item.description || item.content?.body || item.content || "",
    href: item.cta?.href || "",
    ctaLabel: item.cta?.label || "Explore promotion",
    status: statusFor(item),
  })
  async function prLoadPromotions() {
    if (!isPromotionsPage) return
    prLoading.value = true
    prError.value = ""
    try {
      const response = await fetch(apiUrl("/content/promotion"))
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || "Promotions could not be loaded")
      prCards.value = (payload.data || []).map(normalizePromotion)
      if (!prCards.value.length) {
        const legacyResponse = await fetch(apiUrl("/auth/promotions"))
        const legacyPayload = await legacyResponse.json()
        if (legacyResponse.ok) prCards.value = (legacyPayload.promotions || []).map(normalizePromotion)
      }
    } catch (error) {
      prError.value = error.message || "Promotions could not be loaded"
      prCards.value = fallbackCards
    } finally {
      prLoading.value = false
    }
  }

  const prFilteredCards = computed(() => prCards.value.filter((card) =>
    (prTab.value === "all" || card.type === prTab.value) && card.status === prStatus.value
  ))
  const prVisibleCards = computed(() => prExpanded.value ? prFilteredCards.value : prFilteredCards.value.slice(0, 9))
  const prExtraCards = computed(() => [])
  const prTotalCount = computed(() => prFilteredCards.value.length)
  const prShownCount = computed(() => prVisibleCards.value.length)

  function prSelectTab(tab) { prTab.value = tab }
  function prToggleStatus() { prStatusOpen.value = !prStatusOpen.value }
  function prSetStatus(option) { prStatus.value = option; prStatusOpen.value = false }
  function prOpenCard(card) {
    if (card.id === "promo-codes") { prModal.value = true; return }
    if (card.href) { window.location.href = card.href; return }
    prDetails.value = card
  }
  async function prApplyCode() {
    const code = prCode.value.trim()
    if (!code) { toastMessage("Please enter a promo code"); return }
    const token = typeof readAuthToken === "function" ? readAuthToken() : ""
    if (!token) { toastMessage("Please sign in to claim a promo code"); return }
    if (prCodeLoading.value) return
    prCodeLoading.value = true
    try {
      const response = await fetch(apiUrl("/promo-codes/claim"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || "Promo code could not be claimed")
      prModal.value = false
      prCode.value = ""
      toastMessage(`Promo code applied${payload.data?.amount ? `: ${payload.data.amount} ${payload.data.currency || ""}` : ""}`)
    } catch (error) {
      toastMessage(error.message || "Promo code could not be claimed")
    } finally {
      prCodeLoading.value = false
    }
  }

  if (typeof onMounted === "function") onMounted(prLoadPromotions)

  return {
    isPromotionsPage, prTab, prStatus, prStatusOpen, prStatusOptions, prExpanded, prModal, prDetails, prCode,
    prLoading, prError, prCodeLoading, prVisibleCards, prExtraCards, prTotalCount, prShownCount,
    prSelectTab, prToggleStatus, prSetStatus, prOpenCard, prApplyCode, prLoadPromotions,
  }
}
