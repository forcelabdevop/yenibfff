window.createMissionsPage = function createMissionsPage(ctx) {
  const { ref, computed, currentPage, toastMessage } = ctx
  const isMissionsPage = currentPage === "missions"

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

  const missions = [
    { id: 1, title: "Stack Odds x10 on Virtuals", deadline: "39:46:21", reward: "$5 Bet Refund", rewardIcon: "freebet", image: missionAssets.virtual, category: "virtual", status: "active" },
    { id: 2, title: "Score 3 in a Row on Top 5", deadline: "3 DAYS", reward: "$5 Bet Refund", rewardIcon: "freebet", image: missionAssets.top5, category: "sports", status: "active" },
    { id: 3, title: "Win 6 Singles on Soccer", deadline: "6 DAYS", reward: "$5 Bet Refund", rewardIcon: "freebet", image: missionAssets.soccer, category: "sports", status: "active" },
    { id: 4, title: "Win 6 Combos on Soccer", deadline: "6 DAYS", reward: "$5 Bet Refund", rewardIcon: "freebet", image: missionAssets.soccer, category: "sports", status: "active" },
    { id: 5, title: "Stack Odds x12 on Tennis", deadline: "9 DAYS", reward: "$5 Bet Refund", rewardIcon: "freebet", image: missionAssets.tennis, category: "sports", status: "active" },
    { id: 6, title: "Hit x40 multiplier in selected Forcelab Originals", deadline: "13 DAYS", reward: "10 Bonus Bets x $0.4", rewardIcon: "dice", image: missionAssets.originals, category: "casino", status: "active" },
    { id: 7, title: "Hit x50 multiplier in selected Slots", deadline: "29 DAYS", reward: "20 FS x $0.2", rewardIcon: "fs", image: missionAssets.slotsDog, category: "casino", status: "active" },
    { id: 8, title: "Hit x1000 multiplier in selected Slots", deadline: "29 DAYS", reward: "50 FS x $10", rewardIcon: "fs", image: missionAssets.slotsZeus, category: "casino", status: "active" },
    { id: 9, title: "Hit x2000 multiplier in selected Slots", deadline: "29 DAYS", reward: "100 FS x $10", rewardIcon: "fs", image: missionAssets.slotsZeus, category: "casino", status: "active" },
    { id: 10, title: "Win 8 Singles on Soccer", deadline: "30 DAYS", reward: "$10 Bet Refund", rewardIcon: "freebet", image: missionAssets.soccer, category: "sports", status: "active" },
    { id: 11, title: "Hit x100 multiplier in selected Slots", deadline: "30 DAYS", reward: "25 FS x $1", rewardIcon: "fs", image: missionAssets.slotsDog, category: "casino", status: "active" },
    { id: 12, title: "Complete a Virtual Sports Combo", deadline: "30 DAYS", reward: "$5 Bet Refund", rewardIcon: "freebet", image: missionAssets.virtual, category: "virtual", status: "active" },
  ]

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
  const filteredMissions = computed(() => missions.filter((mission) =>
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
  function joinMission() {
    selectedMission.value = null
    toastMessage("Mission joined successfully")
  }

  return {
    isMissionsPage, missionAssets, missionCategories, missionStatuses, missionFaqs,
    missionCategoryOpen, missionStatusOpen, missionExpanded, missionOpenFaq, selectedMission,
    missionCategoryLabel, missionStatusLabel, filteredMissions, visibleMissions,
    selectMissionCategory, selectMissionStatus, openMission, closeMissionMenus, joinMission,
  }
}
