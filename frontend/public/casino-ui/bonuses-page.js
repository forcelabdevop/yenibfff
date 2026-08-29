/**
 * Bonus Cabinet — referans tasarimin (BetFury Bonus Cabinet) birebir portu.
 * index.html icindeki setup() bu modulu cagirir:
 *   const bonusesPage = window.createBonusesPage({ ref, computed, currentPage, toastMessage })
 * Donen her anahtar setup return'une spread edilir; sablondaki her binding burada olmalidir.
 */
window.createBonusesPage = function createBonusesPage(ctx) {
  const { ref, computed, currentPage, toastMessage } = ctx
  const isBonusesPage = currentPage === "bonuses"

  const bonusAssets = {
    rankAvatar: "assets/bonus-rank.png",
    fs: "assets/bonus-fs.png",
    wheel: "assets/bonus-wheel.png",
    rake: "assets/bonus-rakeback.png",
    cash: "assets/bonus-cashback.png",
    weekly: "assets/bonus-weekly.png",
    sport: "assets/bonus-sport.png",
    monthly: "assets/bonus-monthly.png",
    vip1: "assets/bonus-calendar.png",
    vip2: "assets/bonus-party.png",
    vip3: "assets/bonus-gift.png",
    vip4: "assets/bonus-birthday.png",
    drops: "assets/bonus-coins.png",
    rains: "assets/bonus-rains.png",
    tips: "assets/bonus-tips.png",
    bannerLeft: "assets/bonus-banner-left.png",
    bannerRight: "assets/bonus-banner-right.png",
    bonusChest: "assets/bonus-chest.png",
    smallAvatar: "assets/bonus-avatar.png",
    tether: "assets/bonus-tether.png",
    ukFlag: "assets/bonus-uk-flag.png",
    trophy: "assets/bonus-trophy.png",
    rankCoin: "assets/bonus-rank-coin.png",
    crown: "assets/bonus-crown.png",
    calendarIcon: "assets/bonus-calendar-icon.png",
    usFlag: "assets/bonus-us-flag.png",
    avatar: "assets/bonus-avatar.png",
  }

  const vipCards = [
    { title: "VIP Bounty", image: bonusAssets.vip1, copy: "Play 🎰 Games and bet on ⚽ Sports to increase the bonus." },
    { title: "Welcome VIP", image: bonusAssets.vip2, copy: "Join the 👑VIP club to get a welcome bonus." },
    { title: "Personal VIP", image: bonusAssets.vip3, copy: "Get Personal VIP bonuses based on your activity." },
    { title: "Birthday", image: bonusAssets.vip4, copy: "More fun on Big day! Sweeten your B-day celebration with tasty bonus ready for you." },
  ]

  const otherCards = [
    { title: "Coindrops", image: bonusAssets.drops, class: "coins", copy: "Get free coins in the Internal chat in one simple action." },
    { title: "Crypto Rains", image: bonusAssets.rains, class: "rains", copy: "Send crypto to random active users in the Internal Chat." },
    { title: "Tips", image: bonusAssets.tips, class: "tips", copy: "Communicate in the chat to get some crypto treats." },
  ]

  const faqs = [
    {
      left: [
        { icon: "∞", q: "Are there limits on the amount of bonus withdrawals?", a: "Withdrawal limits depend on the bonus type and its individual terms." },
        { icon: "🗒️", q: "A percentage of some bonuses is credited to the calendar upon withdrawal. What are these bonuses?", a: "Eligible regular bonuses are automatically shown in your Bonus Calendar.", tall: true },
        { icon: "🔥", q: "Do the bonuses that were distributed to the calendar expire?", a: "Calendar rewards display their expiration date before you claim them." },
      ],
      right: [
        { icon: "🎁", q: "Can regular bonuses expire?", a: "Yes. Each available regular bonus has its own claim period." },
        { icon: "📅", q: "Where can I find bonus expiration date?", a: "The expiration time is displayed on the relevant bonus card." },
        { icon: "❎", q: "Are there any restrictions or prohibitions?", a: "Bonus eligibility and regional restrictions are explained in the terms." },
      ],
    },
    {
      left: [
        { icon: "🎰", q: "How can I activate Free Spins?", a: "Open the active Free Spins offer and follow its deposit conditions." },
        { icon: "💵", q: "What is the minimum deposit amount?", a: "The required amount appears directly on each offer card.", tall: true },
        { icon: "🔁", q: "What are the wagering requirements?", a: "Wagering requirements vary by promotion." },
      ],
      right: [
        { icon: "⏳", q: "How long are Free Spins available?", a: "The remaining time is shown on the bonus card." },
        { icon: "🎁", q: "Can I use several deposit bonuses?", a: "Only one active deposit bonus can be used at a time." },
        { icon: "✅", q: "Where can I see the bonus terms?", a: "Open the information icon on an offer." },
      ],
    },
  ]

  const statisticRows = [
    { name: "Rakeback", image: bonusAssets.rake },
    { name: "Weekly Bonus", image: bonusAssets.weekly },
    { name: "Monthly Bonus", image: bonusAssets.monthly },
    { name: "Weekly Sport Bonus", image: bonusAssets.sport },
  ]

  const historyRows = [
    { name: "Cashback", image: bonusAssets.cash, amount: "$24.63", percent: "20.6%" },
    { name: "Rakeback", image: bonusAssets.rake, amount: "$20.88", percent: "17.4%" },
    { name: "Weekly Bonus", image: bonusAssets.weekly, amount: "$8.12", percent: "6.8%" },
    { name: "Monthly Bonus", image: bonusAssets.monthly, amount: "$32.76", percent: "27.4%" },
    { name: "VIP Bonuses", image: bonusAssets.vip1, amount: "$0.00", percent: "0.0%" },
    { name: "Staking", image: bonusAssets.tips, amount: "$0.36", percent: "0.3%", help: true },
    { name: "Other", image: bonusAssets.bonusChest, amount: "$33.01", percent: "27.6%" },
  ]

  const specialHistoryRows = [
    { title: "SPECIAL BONUS", value: "$223.50 USDT", status: "Canceled", image: bonusAssets.cash },
    { title: "TG BOT BONUS", value: "100FS * $0.2 in Sweet Bonanza slot", status: "Canceled", image: bonusAssets.fs },
    { title: "TG BOT BONUS", value: "100FS * $0.2 in Green Chilli 2 (3Oaks)", status: "Canceled", image: bonusAssets.fs },
    { title: "PARADISE BONUS", value: "$0.24 USDT", status: "Canceled", image: bonusAssets.fs },
    { title: "WELCOME PACK", value: "$0.00 USDT", status: "Canceled", image: bonusAssets.fs },
    { title: "WELCOME PACK", value: "$0.07 USDT", status: "Canceled", image: bonusAssets.fs },
    { title: "SPECIAL BONUS", value: "$0.56 USDT", status: "Canceled", image: bonusAssets.fs },
    { title: "FOR LUCKY WEEKEND", value: "25 FS x $0.4", status: "Time is out", image: bonusAssets.fs },
    { title: "PERSONAL BONUS", value: "50 FS x $0.2", status: "Time is out", image: bonusAssets.fs },
    { title: "PERSONAL BONUS", value: "50 FS x $0.2", status: "Time is out", image: bonusAssets.fs },
  ]

  const bonusDepositModal = ref(false)
  const historyModal = ref(false)
  const specialHistoryModal = ref(false)
  const statisticModal = ref(false)
  const shareModal = ref(false)
  const calendarDetailsModal = ref(false)
  const regularBonusModal = ref(null)
  const bonusExpanded = ref(true)
  const faqTab = ref(0)
  const openFaq = ref("")

  const displayedFaq = computed(() => faqs[faqTab.value])

  function bonusNotify(message) {
    toastMessage(message)
  }
  function openRegularInfo(type) {
    regularBonusModal.value = type
  }
  function toggleFaq(id) {
    openFaq.value = openFaq.value === id ? "" : id
  }
  function closeBonusModals() {
    bonusDepositModal.value = false
    historyModal.value = false
    specialHistoryModal.value = false
    statisticModal.value = false
    shareModal.value = false
    calendarDetailsModal.value = false
    regularBonusModal.value = null
  }

  return {
    isBonusesPage,
    bonusAssets,
    vipCards,
    otherCards,
    historyRows,
    statisticRows,
    specialHistoryRows,
    displayedFaq,
    faqTab,
    openFaq,
    bonusDepositModal,
    historyModal,
    specialHistoryModal,
    statisticModal,
    shareModal,
    calendarDetailsModal,
    regularBonusModal,
    bonusExpanded,
    bonusNotify,
    openRegularInfo,
    toggleFaq,
    closeBonusModals,
  }
}
