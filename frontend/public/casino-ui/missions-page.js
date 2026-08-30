window.createMissionsPage = function createMissionsPage(ctx) {
  const { ref, computed, onMounted, currentPage, toastMessage, apiUrl, backendAssetUrl, readAuthToken } = ctx
  const isMissionsPage = currentPage === "missions"
  const missionLoading = ref(false)
  const missionError = ref("")
  const missionActionLoading = ref(false)

  const missionAssets = {
    virtual: "assets/mission-virtual.png",
    top5: "assets/mission-top5.png",
    soccer: "assets/mission-soccer.png",
    tennis: "assets/mission-tennis.png",
    originals: "assets/mission-originals.png",
    slotsDog: "assets/mission-slots-dog.png",
    slotsZeus: "assets/mission-slots-zeus.png",
    freebet: "assets/mission-freebet.png",
    fs: "assets/mission-fs.png",
  }

  const missions = ref([])

  const authHeaders = () => {
    const token = typeof readAuthToken === "function" ? readAuthToken() : ""
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  const deadlineLabel = (endsAt) => {
    if (!endsAt) return "ONGOING"
    const remaining = new Date(endsAt).getTime() - Date.now()
    if (remaining <= 0) return "EXPIRED"
    const days = Math.ceil(remaining / 86400000)
    return days === 1 ? "1 DAY" : `${days} DAYS`
  }
  const normalizeMission = (item) => ({
    id: item._id,
    title: item.title,
    deadline: deadlineLabel(item.endsAt),
    reward: `${item.reward?.amount || 0} ${item.reward?.currency || "USD"}`,
    rewardIcon: item.reward?.type === "free-spins" ? "fs" : "freebet",
    image: item.image ? backendAssetUrl(item.image) : missionAssets.originals,
    category: item.category || "casino",
    status: ["claimed", "completed"].includes(item.userState?.status) ? "completed" : "active",
    description: item.description || "",
    rules: item.rules || {},
    userState: item.userState || null,
    progress: Number(item.userState?.progress || 0),
    target: Number(item.userState?.target || item.rules?.target || 1),
    action: item.userState?.status === "completed" ? "claim" : item.userState ? "progress" : "join",
  })
  async function loadMissions() {
    if (!isMissionsPage) return
    missionLoading.value = true
    missionError.value = ""
    try {
      const response = await fetch(apiUrl("/content/mission"), { headers: authHeaders() })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || "Missions could not be loaded")
      missions.value = (payload.data || []).map(normalizeMission)
    } catch (error) {
      missionError.value = error.message || "Missions could not be loaded"
      missions.value = []
    } finally {
      missionLoading.value = false
    }
  }

  const missionCategories = [
    { label: "Category", value: "all" },
    { label: "Sports", value: "sports" },
    { label: "Casino", value: "casino" },
    { label: "Virtual Sports", value: "virtual" },
  ]
  const missionStatuses = [
    { label: "Active", value: "active" },
    { label: "All missions", value: "all" },
    { label: "Completed", value: "completed" },
  ]
  const missionFaqs = [
    { question: "How do I participate in Missions?", answer: "Choose an active mission, review its requirements, and activate it before placing eligible bets." },
    { question: "How do I claim my mission reward?", answer: "Completed mission rewards can be claimed directly from the mission card and are credited to your account." },
    { question: "Can I activate multiple Missions at the same time?", answer: "Yes, you can have multiple eligible missions active at the same time." },
    { question: "Can I cancel a mission in progress?", answer: "An active mission cannot be cancelled after qualifying progress has started." },
  ]

  const missionCategory = ref("all")
  const missionStatus = ref("active")
  const missionCategoryOpen = ref(false)
  const missionStatusOpen = ref(false)
  const missionExpanded = ref(false)
  const missionOpenFaq = ref(null)
  const selectedMission = ref(null)
  const missionCategoryLabel = computed(() => missionCategories.find((item) => item.value === missionCategory.value)?.label || "Category")
  const missionStatusLabel = computed(() => missionStatuses.find((item) => item.value === missionStatus.value)?.label || "Active")
  const filteredMissions = computed(() => missions.value.filter((mission) =>
    (missionCategory.value === "all" || mission.category === missionCategory.value) &&
    (missionStatus.value === "all" || mission.status === missionStatus.value)
  ))
  const visibleMissions = computed(() => missionExpanded.value ? filteredMissions.value : filteredMissions.value.slice(0, 9))

  function selectMissionCategory(option) {
    missionCategory.value = option.value
    missionCategoryOpen.value = false
    missionExpanded.value = true
  }
  function selectMissionStatus(option) {
    missionStatus.value = option.value
    missionStatusOpen.value = false
  }
  function openMission(mission) {
    selectedMission.value = {
      ...mission,
      condition: mission.category === "casino" ? mission.title.replace("Hit ", "") : "Total Multiplier X10",
      sports: mission.category === "virtual" ? ["eSoccer", "eSoccer: Volta", "eBasketball"] : mission.category === "sports" ? ["Soccer", "Tennis"] : [],
    }
  }
  function closeMissionMenus() {
    missionCategoryOpen.value = false
    missionStatusOpen.value = false
  }
  async function runMissionAction() {
    const mission = selectedMission.value
    if (!mission || missionActionLoading.value || mission.action === "progress") return
    if (!authHeaders().Authorization) {
      toastMessage("Please sign in to join missions")
      return
    }
    missionActionLoading.value = true
    const isClaim = mission.action === "claim"
    try {
      const headers = { ...authHeaders(), "Content-Type": "application/json" }
      if (isClaim) headers["Idempotency-Key"] = `mission-${mission.id}-${Date.now()}`
      const path = isClaim ? `/content/mission/${mission.id}/claim` : `/content/missions/${mission.id}/join`
      const response = await fetch(apiUrl(path), { method: "POST", headers })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || `Mission could not be ${isClaim ? "claimed" : "joined"}`)
      selectedMission.value = null
      toastMessage(isClaim ? "Mission reward claimed" : "Mission joined successfully")
      await loadMissions()
    } catch (error) {
      toastMessage(error.message || "Mission action failed")
    } finally {
      missionActionLoading.value = false
    }
  }

  if (typeof onMounted === "function") onMounted(loadMissions)

  return {
    isMissionsPage, missionAssets, missionCategories, missionStatuses, missionFaqs,
    missionCategoryOpen, missionStatusOpen, missionExpanded, missionOpenFaq, selectedMission,
    missionCategoryLabel, missionStatusLabel, filteredMissions, visibleMissions, missionLoading, missionError, missionActionLoading,
    selectMissionCategory, selectMissionStatus, openMission, closeMissionMenus, runMissionAction, loadMissions,
  }
}
