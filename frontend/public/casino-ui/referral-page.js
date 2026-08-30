window.createReferralPage = function createReferralPage(ctx) {
  const { ref, computed, onMounted, currentPage, toastMessage, apiUrl, readAuthToken } = ctx
  const isReferralPage = currentPage === "refer-and-earn"
  const authUser = ctx.authUser
  const rfTabs = ["Dashboard", "Campaigns", "Referrals"]
  const rfTab = ref("Dashboard")
  const rfReferralsRange = ref("1w")
  const rfProfitRange = ref("1w")
  const rfRanges = ["1w", "1m", "6m", "∞"]
  const rfModal = ref(false)
  const rfNewCampaignName = ref("")
  const rfCampaigns = ref([])
  const rfReferrals = ref([])
  const rfLiveRewards = ref([])
  const rfOverview = ref({ totalProfit: 0, available: 0, locked: 0, totalReferrals: 0, minimumClaim: 1.5, campaign: null })
  const rfLoading = ref(false)
  const rfActionLoading = ref(false)
  const rfError = ref("")

  const rfUsername = computed(() => authUser?.value?.username || authUser?.value?.name || "Player")
  const rfDefaultCampaign = computed(() => rfOverview.value.campaign || rfCampaigns.value.find((item) => item.default) || null)
  const rfCode = computed(() => rfDefaultCampaign.value?.code || "")
  const rfWebLink = computed(() => `${window.location.origin}/?r=${encodeURIComponent(rfCode.value)}`)
  const rfTelegramLink = computed(() => `https://t.me/misterFury_bot?start=${encodeURIComponent(rfCode.value)}`)
  const rfCampaignCount = computed(() => rfCampaigns.value.length)
  const rfCanClaim = computed(() => rfOverview.value.available >= rfOverview.value.minimumClaim)
  const rfMoney = (value) => `$${Number(value || 0).toFixed(2)}`

  function authHeaders(json) {
    const token = typeof readAuthToken === "function" ? readAuthToken() : ""
    return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  }
  async function rfFetch(path, options = {}) {
    const response = await fetch(apiUrl(path), { credentials: "include", ...options, headers: { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) } })
    const payload = await response.json()
    if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error?.message || "Referral request failed")
    return payload.data
  }
  async function rfLoad() {
    if (!isReferralPage) return
    if (!authHeaders().Authorization) { rfError.value = "Sign in to view your referral cabinet."; return }
    rfLoading.value = true
    rfError.value = ""
    try {
      const [overview, campaigns, referrals] = await Promise.all([
        rfFetch("/affiliate/overview"), rfFetch("/affiliate/campaigns"), rfFetch("/affiliate/referrals?limit=100"),
      ])
      rfOverview.value = overview
      rfCampaigns.value = campaigns
      rfReferrals.value = referrals
      rfLiveRewards.value = (overview.recentRewards || []).map((item) => ({ user: item.user, amount: rfMoney(item.amount), createdAt: item.createdAt }))
    } catch (error) { rfError.value = error.message || "Referral data could not be loaded" }
    finally { rfLoading.value = false }
  }
  function rfSelectTab(tab) { rfTab.value = tab; window.scrollTo?.({ top: 0, behavior: "smooth" }) }
  function rfNotify(message) { toastMessage(message) }
  async function rfCopy(text) {
    try { await navigator.clipboard.writeText(text); toastMessage("Copied to clipboard") }
    catch { toastMessage("Copy failed") }
  }
  function rfSetReferralsRange(range) { rfReferralsRange.value = range }
  function rfSetProfitRange(range) { rfProfitRange.value = range }
  async function rfCreateCampaign() {
    const name = rfNewCampaignName.value.trim()
    if (!name) { toastMessage("Enter a campaign name"); return }
    if (rfActionLoading.value) return
    rfActionLoading.value = true
    try {
      const campaign = await rfFetch("/affiliate/campaigns", { method: "POST", body: JSON.stringify({ name }) })
      rfCampaigns.value.unshift(campaign)
      rfNewCampaignName.value = ""
      rfModal.value = false
      rfSelectTab("Campaigns")
      toastMessage("Campaign created")
    } catch (error) { toastMessage(error.message || "Campaign could not be created") }
    finally { rfActionLoading.value = false }
  }
  async function rfRemoveCampaign(campaign) {
    if (campaign.default) { toastMessage("The default campaign cannot be deleted"); return }
    if (rfActionLoading.value) return
    rfActionLoading.value = true
    try {
      await rfFetch(`/affiliate/campaigns/${campaign.id}`, { method: "DELETE" })
      rfCampaigns.value = rfCampaigns.value.filter((item) => item.id !== campaign.id)
      toastMessage("Campaign deleted")
    } catch (error) { toastMessage(error.message || "Campaign could not be deleted") }
    finally { rfActionLoading.value = false }
  }
  async function rfClaimCommission() {
    if (!rfCanClaim.value || rfActionLoading.value) return
    rfActionLoading.value = true
    try {
      const result = await rfFetch("/affiliate/claim", { method: "POST", body: JSON.stringify({}) })
      rfOverview.value = { ...rfOverview.value, available: 0 }
      toastMessage(`${rfMoney(result.amount)} commission claimed`)
    } catch (error) { toastMessage(error.message || "Commission could not be claimed") }
    finally { rfActionLoading.value = false }
  }
  function rfDownloadCsv() {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
    const rows = [["Username", "Joined", "Campaign", "Deposits", "Wagered"], ...rfReferrals.value.map((item) => [item.username, item.joinedAt, item.campaignCode, item.deposits, item.wagered])]
    const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const href = URL.createObjectURL(blob)
    const link = document.createElement("a"); link.href = href; link.download = "referrals.csv"; link.click(); URL.revokeObjectURL(href)
  }

  if (typeof onMounted === "function") onMounted(rfLoad)
  return { isReferralPage, rfTabs, rfTab, rfUsername, rfCode, rfWebLink, rfTelegramLink, rfRanges, rfReferralsRange, rfProfitRange, rfModal, rfNewCampaignName, rfCampaigns, rfCampaignCount, rfReferrals, rfLiveRewards, rfOverview, rfDefaultCampaign, rfLoading, rfActionLoading, rfError, rfCanClaim, rfMoney, rfSelectTab, rfNotify, rfCopy, rfSetReferralsRange, rfSetProfitRange, rfCreateCampaign, rfRemoveCampaign, rfClaimCommission, rfDownloadCsv, rfLoad }
}
