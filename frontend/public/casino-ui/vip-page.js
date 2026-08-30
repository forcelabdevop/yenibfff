(function () {
  'use strict';
  window.createVipPage = function ({ ref, computed, currentPage, toastMessage, openChat }) {
    const isVipPage = currentPage === 'vip';
    const vpTab = ref('Special Treats');
    const vpFaqOpen = ref(0);
    const vpTabs = ['Special Treats', 'Additional Perks', 'Higher Bonuses', 'Personal Manager'];
    const allBenefits = {
      'Special Treats': [
        ['icon-6.png', 'Premium Bonus', 'Enjoy exclusive rewards tailored to your play.'],
        ['icon-7.png', 'Monthly Bonus', 'Receive a special bonus every month.'],
        ['icon-8.png', 'Weekly Gift', 'A fresh reward is waiting every week.'],
        ['icon-9.png', 'Birthday Gift', 'Celebrate your day with a personal surprise.']
      ],
      'Additional Perks': [
        ['icon-10.png', 'VIP Tickets', 'Access private tournaments and events.'],
        ['icon-11.png', 'Fury Points', 'Earn more loyalty points as you play.'],
        ['icon-12.png', 'Fast Cashback', 'Get enhanced cashback with priority processing.'],
        ['icon-18.png', 'Surprise Gifts', 'Unlock gifts made especially for VIP members.']
      ],
      'Higher Bonuses': [
        ['icon-13.png', 'Boosted Rewards', 'Receive increased bonuses on selected offers.'],
        ['icon-14.png', 'Level Privileges', 'Your VIP status unlocks stronger benefits.'],
        ['icon-15.png', 'Recharge Bonus', 'Stay in the game with exclusive recharge offers.'],
        ['icon-16.png', 'Private Drops', 'Join limited rewards available only to VIPs.']
      ],
      'Personal Manager': [
        ['managers.png', 'Personal VIP Manager', 'Dedicated help, tailored offers and priority care.'],
        ['manager-banner.jpg', 'Priority Support', 'Get quick assistance whenever you need it.'],
        ['icon-8.png', 'Custom Offers', 'Your manager prepares rewards around your preferences.'],
        ['icon-18.png', 'Private Service', 'A premium experience designed around you.']
      ]
    };
    const vpBenefits = computed(() => allBenefits[vpTab.value] || allBenefits['Special Treats']);
    const vpFaqs = [
      ['How can I become a VIP?', 'Play regularly and progress through the loyalty levels. Our VIP team will contact eligible players.'],
      ['What is the VIP transfer program?', 'Qualified players can transfer their status from another casino and receive an equivalent VIP offer.'],
      ['How do I contact my personal manager?', 'Once assigned, your manager is available directly through our live chat service.'],
      ['Are VIP rewards available to everyone?', 'Benefits depend on your current VIP level and account activity.'],
      ['Can VIP benefits change?', 'Offers are personalized and may evolve as your level and activity change.']
    ];
    const vpSelectTab = (tab) => { vpTab.value = tab; };
    const vpToggleFaq = (index) => { vpFaqOpen.value = vpFaqOpen.value === index ? -1 : index; };
    const vpNotify = (message) => toastMessage(message);
    const vpOpenChat = () => { if (typeof openChat === 'function') openChat(); else toastMessage('Live support opened'); };
    return { isVipPage, vpTab, vpTabs, vpBenefits, vpFaqs, vpFaqOpen, vpSelectTab, vpToggleFaq, vpNotify, vpOpenChat };
  };
})();
