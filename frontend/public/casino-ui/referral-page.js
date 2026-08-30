/* Refer & Earn / Referral Cabinet sayfasi (route: /refer-and-earn).
   Kullanicinin referans HTML'inden (index-woOD5.html) birebir port edildi.
   Veri simdilik STATIK (referans tasarimiyla ayni). Backend hazir olunca beklenen uclar:
     GET  /referral/overview   -> { totalProfit, totalReferrals, balances[], campaign }
     GET  /referral/campaigns  -> [{ id, name, created, code, referrals, profit, default }]
     POST /referral/campaigns  -> { name } (yeni kampanya)
     DELETE /referral/campaigns/:id
     GET  /referral/referrals?campaign=&from=&to=&limit=
     GET  /referral/live-rewards -> [{ user, amount, avatar }]
   index.html icindeki Edit geri-alinma tuzagina takilmasin diye mantik burada durur. */
window.createReferralPage = function createReferralPage(ctx) {
  const { ref, computed, currentPage, toastMessage } = ctx
  const isReferralPage = currentPage === "refer-and-earn"

  const authUser = ctx.authUser
  const rfUsername = computed(function () {
    const user = authUser && authUser.value
    return (user && (user.username || user.name)) || "User6879552"
  })
  const rfCode = computed(function () {
    return "LUCKY" + rfUsername.value
  })
  const rfWebLink = computed(function () {
    return "https://betfury.is/?r=" + rfCode.value
  })
  const rfTelegramLink = "https://t.me/misterFury_bot"

  const rfTabs = ["Dashboard", "Campaigns", "Referrals"]
  const rfTab = ref("Dashboard")

  const rfReferralsRange = ref("1w")
  const rfProfitRange = ref("1w")
  const rfRanges = ["1w", "1m", "6m", "\u221E"]

  const rfModal = ref(false)
  const rfNewCampaignName = ref("")

  const rfCampaigns = ref([
    { id: 1, name: "Default Te...", created: "07/25/2024", code: "LUCKY1GB...", default: false },
    { id: 2, name: "Default Ca...", created: "12/09/2023", code: "LUCKYUse...", default: true },
  ])

  const rfLiveRewards = [
    { user: "User460548", amount: "$0.05" },
    { user: "User460548", amount: "$0.02" },
    { user: "hpdivslast", amount: "$23.01" },
    { user: "CryptoAce", amount: "$1.50" },
    { user: "BetPlayer", amount: "$0.75" },
  ]

  const rfCampaignCount = computed(function () {
    return rfCampaigns.value.length
  })

  function rfSelectTab(tab) {
    rfTab.value = tab
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }
  function rfNotify(message) {
    toastMessage(message)
  }
  function rfCopy(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(function () {})
    }
    toastMessage("Copied to clipboard")
  }
  function rfSetReferralsRange(range) {
    rfReferralsRange.value = range
  }
  function rfSetProfitRange(range) {
    rfProfitRange.value = range
  }
  function rfCreateCampaign() {
    const name = rfNewCampaignName.value.trim()
    if (!name) {
      toastMessage("Enter a campaign name")
      return
    }
    rfCampaigns.value = [
      {
        id: Date.now(),
        name: name,
        created: new Date().toLocaleDateString("en-US"),
        code: "LUCKYNew...",
        default: false,
      },
    ].concat(rfCampaigns.value)
    rfNewCampaignName.value = ""
    rfModal.value = false
    rfSelectTab("Campaigns")
    toastMessage("Campaign created")
  }
  function rfRemoveCampaign(campaign) {
    if (campaign.default) {
      toastMessage("The default campaign cannot be deleted")
      return
    }
    rfCampaigns.value = rfCampaigns.value.filter(function (item) {
      return item.id !== campaign.id
    })
    toastMessage("Campaign deleted")
  }

  return {
    isReferralPage,
    rfTabs,
    rfTab,
    rfCode,
    rfWebLink,
    rfTelegramLink,
    rfRanges,
    rfReferralsRange,
    rfProfitRange,
    rfModal,
    rfNewCampaignName,
    rfCampaigns,
    rfCampaignCount,
    rfLiveRewards,
    rfSelectTab,
    rfNotify,
    rfCopy,
    rfSetReferralsRange,
    rfSetProfitRange,
    rfCreateCampaign,
    rfRemoveCampaign,
  }
}
