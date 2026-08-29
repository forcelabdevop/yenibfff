window.createBonusesPage = function createBonusesPage(ctx) {
  const { ref, computed, currentPage, toastMessage } = ctx
  const isBonusesPage = currentPage === "bonuses"
  const bonusFaqTab = ref(0)
  const bonusOpenFaq = ref(null)
  const bonusModal = ref(null)
  const promoCode = ref("")
  const bonusAssets = {
    rank: "assets/bonus-rank.png", fs: "assets/bonus-fs.png", wheel: "assets/bonus-wheel.png",
    rakeback: "assets/bonus-rakeback.png", cashback: "assets/bonus-cashback.png", weekly: "assets/bonus-weekly.png",
    sport: "assets/bonus-sport.png", monthly: "assets/bonus-monthly.png", calendar: "assets/bonus-calendar.png",
    party: "assets/bonus-party.png", gift: "assets/bonus-gift.png", birthday: "assets/bonus-birthday.png",
    coins: "assets/bonus-coins.png", rains: "assets/bonus-rains.png", tips: "assets/bonus-tips.png",
    bannerLeft: "assets/bonus-banner-left.png", bannerRight: "assets/bonus-banner-right.png", chest: "assets/bonus-chest.png",
    avatar: "assets/bonus-avatar.png", token: "assets/bonus-token.png", tether: "assets/bonus-tether.png",
    ukFlag: "assets/bonus-uk-flag.png", usFlag: "assets/bonus-us-flag.png", trophy: "assets/bonus-trophy.png",
    rankCoin: "assets/bonus-rank-coin.png", crown: "assets/bonus-crown.png", calendarIcon: "assets/bonus-calendar-icon.png",
  }
  const regularBonuses = [
    {title:"Free Fury Wheel",sub:"Spin every 12h",image:bonusAssets.wheel,tone:"#312495",middle:"Win up to 1 BTC",action:"Spin the Wheel",red:true,description:"Spin the Fury Wheel once every 12 hours for a chance to win crypto, Free Spins and instant cash prizes.",terms:["Available once every 12 hours","Prize is credited instantly","One spin per eligible account"]},
    {title:"Rakeback",sub:"$0.00",image:bonusAssets.rakeback,tone:"#8b1f3c",middle:"BOOST X2 | INACTIVE",action:"Place bets to get a bonus",description:"Get a percentage of eligible wagers returned to your balance. Your rate grows as your rank increases.",terms:["Calculated from settled eligible bets","Updated automatically","Boost periods can double your rate"]},
    {title:"Cashback",sub:"$0.00",image:bonusAssets.cashback,tone:"#816d29",middle:"5%  ›  6%",action:"Claim in: 2 d 04:18:43",description:"Receive weekly cashback based on your net casino and sports result during the calculation period.",terms:["Minimum cashback is $1","Claim before the timer expires","Rate depends on your rank"]},
    {title:"Weekly Bonus",sub:"$0.00",image:bonusAssets.weekly,tone:"#235e98",middle:"Wager to unlock: $0 / $150",action:"Claim in: 6 d 03:18:43",description:"Your weekly reward is calculated from eligible activity and becomes available after the weekly reset.",terms:["Complete the wagering target","Casino play contributes to progress","Reward resets weekly"]},
    {title:"Weekly Sport Bonus",sub:"No bonus",image:bonusAssets.sport,tone:"#0a50a5",middle:"Wager to next bonus: $0 / $150",action:"Claim in: 1 d 16:18:43",description:"Place qualifying sports bets during the week to unlock a dedicated sports reward.",terms:["Only settled sports bets qualify","Minimum odds may apply","Reward resets weekly"]},
    {title:"Monthly Bonus",sub:"$0.00",image:bonusAssets.monthly,tone:"#1c6a35",middle:"Play Casino and Sports to increase it",action:"Claim in: 2 d 03:18:43",description:"A monthly loyalty reward based on your eligible casino and sports activity throughout the month.",terms:["Calculated once per month","Both casino and sports can contribute","Claim within the availability period"]},
  ]
  const vipBonuses = [
    {title:"VIP Cashback",image:bonusAssets.calendar,copy:"Up to <b>25%</b> cashback every week"},
    {title:"Weekly VIP Bonus",image:bonusAssets.party,copy:"Exclusive weekly reward for VIP members"},
    {title:"Level Up Bonus",image:bonusAssets.gift,copy:"Unlock rewards whenever your rank grows"},
    {title:"Birthday Bonus",image:bonusAssets.birthday,copy:"A personal reward on your special day"},
  ]
  const otherBonuses = [
    {title:"Coin Drops",image:bonusAssets.coins,copy:"Catch surprise crypto drops in chat."},
    {title:"Crypto Rains",image:bonusAssets.rains,copy:"Community rewards can rain at any time."},
    {title:"Tips",image:bonusAssets.tips,copy:"Send and receive tips with other players."},
  ]
  const faqSets = [
    ["How do I get regular bonuses?","What is the Bonus Calendar?","When can I claim Cashback?","How does the Fury Wheel work?"],
    ["How do deposit bonuses work?","Where can I use Free Spins?","What is the wagering requirement?","Can I cancel an active bonus?"],
  ]
  const bonusFaqs = computed(() => faqSets[bonusFaqTab.value])
  const historyItems = [
    {title:"Friday Bonus",date:"Aug 23, 2026",amount:"50 Free Spins",status:"Claimed"},
    {title:"Weekly Bonus",date:"Aug 17, 2026",amount:"$24.80",status:"Claimed"},
    {title:"Cashback",date:"Aug 10, 2026",amount:"$14.25",status:"Claimed"},
  ]
  function bonusNotify(message) { toastMessage(message) }
  function openBonusModal(type, bonus) { bonusModal.value = { type, bonus: bonus || null } }
  function closeBonusModal() { bonusModal.value = null }
  function submitPromo() {
    const code = promoCode.value.trim()
    if (!code) return toastMessage("Enter a promo code")
    toastMessage("Promo code applied")
    promoCode.value = ""
    closeBonusModal()
  }
  function toggleBonusFaq(index) { bonusOpenFaq.value = bonusOpenFaq.value === index ? null : index }
  return { isBonusesPage, bonusAssets, regularBonuses, vipBonuses, otherBonuses, historyItems, bonusFaqTab, bonusOpenFaq, bonusFaqs, bonusModal, promoCode, bonusNotify, openBonusModal, closeBonusModal, submitPromo, toggleBonusFaq }
}
