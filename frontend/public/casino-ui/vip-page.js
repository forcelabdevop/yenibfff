(function () {
  'use strict';
  window.createVipPage = function ({ ref, computed, onMounted, currentPage, toastMessage, openChat, apiUrl, readAuthToken }) {
    const isVipPage = currentPage === 'vip';
    const vpTab = ref('Special Treats');
    const vpFaqOpen = ref(null);
    const vpLoading = ref(false);
    const vpApplying = ref(false);
    const vpError = ref('');
    const vpProgress = ref(null);
    const vpCmsBenefits = ref([]);
    const vpCmsManagers = ref([]);
    const vpCmsFaq = ref([]);
    const vpTabs = [
      { label: 'Special Treats', icon: 'fas fa-gift' },
      { label: 'Additional Perks', icon: 'fas fa-rocket' },
      { label: 'Higher Bonuses', icon: 'fas fa-gift' },
      { label: 'Personal Manager', icon: 'fas fa-comment' }
    ];
    const benefit = (title, description, image, conditions) => ({ title, description, image: 'assets/vip/' + image, conditions: !!conditions });
    const vpBenefitGroups = {
      'Special Treats': [
        benefit('VIP Welcome Bonus', 'Contact your personal manager to claim your VIP Welcome Bonus and unlock your royal status.', 'treat-6.png'),
        benefit('Bounty Bonus', 'VIP Club entry sweetens your life three times a week with a tasty crypto bonus based on your activity and profit.', 'treat-7.png'),
        benefit('Personal VIP Bonuses', 'Get special Bonuses from VIP managers in addition to the regular ones.', 'treat-8.png'),
        benefit('VIP Birthday Bonus', 'More fun on Big day! Sweeten your B-day celebration with tasty bonus ready for you.', 'treat-9.png'),
        benefit('Promo codes', 'Catch exclusive Promo codes in VIP Notices Channel to get free BFG.', 'treat-10.png'),
        benefit('Various special bonuses', 'Play games and have encouraging bonuses for your huge wins.', 'treat-11.png')
      ],
      'Additional Perks': [
        benefit('Huge Payouts', 'Win more with the increased Max Bet. Max payouts are also sky-high for our VIP users.', 'treat-12.png'),
        benefit('Withdrawal Priority', 'No more waiting. Your withdrawals will be processed almost immediately.', 'treat-7.png'),
        benefit('Exclusive Pre-releases', 'Experience the brand new games prior to other players.', 'treat-9.png'),
        benefit('VIP Customization', 'Be unique with a personalized User Profile.', 'treat-13.png'),
        benefit('VIP Lounge', 'Receive your bonuses and enjoy all the VIP benefits in one place.', 'treat-14.png'),
        benefit('VIP Chat', 'Join us in our exclusive VIP chat room for discreet and elite discussions.', 'treat-15.png')
      ],
      'Higher Bonuses': [
        benefit('Cashback', 'Get up to 25% of your money back twice a week.', 'treat-12.png', true),
        benefit('Monthly Bonus', 'Receive monthly bonuses based on your activity.', 'treat-7.png', true),
        benefit('Rakeback', 'Enjoy a bonus every 20 minutes and multiply it with a Rakeback boost.', 'treat-16.png', true),
        benefit('Calendar Bonus', 'Claim calendar bonuses three times a day and activate a Rakeback boost.', 'treat-9.png', true),
        benefit('Weekly Bonus', 'Catch weekly bonuses based on your activity.', 'treat-8.png', true)
      ]
    };
    const vpBenefits = computed(() => {
      const cms = vpCmsBenefits.value.filter((item) => (item.category || 'Special Treats') === vpTab.value);
      if (cms.length) return cms.map((item) => ({ title: item.title, description: item.description || item.subtitle, image: item.image || 'assets/vip/treat-6.png', conditions: Boolean(item.content?.conditions) }));
      return vpBenefitGroups[vpTab.value] || vpBenefitGroups['Special Treats'];
    });
    const vpDefaultManagers = [
      { name: 'Chloe', crop: { left: '-14px', top: '-22px' }, description: 'Chloe is very calm, responsible, and constructive. She enjoys dancing and knitting, and her knowledge of BetFury will surprise you.' },
      { name: 'Freya', crop: { left: '-154px', top: '-22px' }, description: 'Freya is an open-minded and friendly person with a good sense of humor. Her biggest passions are sports, traveling and animals.' },
      { name: 'Kim', crop: { left: '-14px', top: '-235px' }, description: 'A smiley girl with a good sense of humour. She likes jokes, music and never misses new releases of her favourite artists.' },
      { name: 'Dakota', crop: { left: '-154px', top: '-235px' }, description: 'Dakota always tries to understand each user and find the best way to connect with them, making sure they feel heard and valued.' },
      { name: 'Jenny', crop: { left: '-299px', top: '-235px' }, description: 'Jenny manages with a gentle hand and a listening ear, having an ever-present smile and a surprisingly quick-witted approach.' }
    ];
    const vpManagers = computed(() => vpCmsManagers.value.length
      ? vpCmsManagers.value.map((item) => ({ name: item.title, description: item.description || item.subtitle, image: item.image, crop: item.content?.crop || { left: '0', top: '0' } }))
      : vpDefaultManagers);
    const vpSuperPerks = [
      benefit('Super VIP Lounge', 'Elevate your experience with an exclusive haven for Super VIP members.', 'treat-14.png'),
      benefit('Super VIP Welcome Bonus', 'Welcome to the pinnacle! Contact your personal manager to claim your exclusive Super VIP Welcome Bonus and start your elite journey.', 'treat-18.png'),
      benefit('Instant Bonuses', 'Receive bonuses directly to your balance without calendar distribution, except the Weekly Sport Bonus.', 'treat-12.png'),
      benefit('VIP Concierge', 'Make a personal request not related to the platform: order a pizza, book tickets, etc.', 'treat-16.png'),
      benefit('Highest Bonuses', 'Unlock the highest platform bonus percentages and enhanced VIP rewards as a tribute to your outstanding activity.', 'treat-13.png'),
      benefit('Rakeback Booster', 'Request a supercharge of your winnings any time during the day.', 'treat-15.png')
    ];
    const vpDefaultFaqLeft = [
      ['Why should I become a VIP on BetFury?', 'VIP Club members receive exclusive bonuses, premium support and access to special community events.'],
      ['What is a Bounty Bonus? How is it calculated?', 'The Bounty Bonus is a personal crypto reward based on your platform activity and profit.'],
      ['Why do I need to contact my VIP Manager?', 'Your VIP Manager helps you claim personal rewards and resolves VIP-related questions.'],
      ['When will the new VIP members have access to the closed VIP Community?', 'Access is provided after your VIP status has been verified by your personal manager.'],
      ['What is the difference between VIP Manager and Live Support?', 'Live Support handles general requests, while a VIP Manager provides personalized VIP assistance.'],
      ['What is the difference between VIP and SVIP statuses?', 'Super VIP status unlocks the highest rewards, instant bonuses and additional concierge privileges.']
    ];
    const vpDefaultFaqRight = [
      ['What are the VIP bonuses based on?', 'VIP bonuses are based on rank, activity, wagering and overall platform performance.'],
      ['What should I do to get a VIP Welcome Bonus?', 'Reach VIP status and contact your personal VIP Manager to claim the welcome reward.'],
      ['What is the VIP Transfer?', 'VIP Transfer lets eligible players move their VIP status to BetFury and receive VIP perks instantly.'],
      ['How do I enter the VIP Transfer?', 'Choose “Become a VIP” and follow the verification instructions from the VIP team.'],
      ['What are the requirements for starting a VIP Transfer?', 'You need verified VIP status on an eligible platform and supporting account information.'],
      ['What are the requirements to pass VIP Transfer?', 'Complete verification and meet the activity requirements shared by the BetFury VIP team.']
    ];
    const vpFaqItems = computed(() => vpCmsFaq.value.length
      ? vpCmsFaq.value.map((item) => [item.title, item.description || item.content?.answer || ''])
      : [...vpDefaultFaqLeft, ...vpDefaultFaqRight]);
    const vpFaqLeft = computed(() => vpFaqItems.value.filter((_, index) => index % 2 === 0));
    const vpFaqRight = computed(() => vpFaqItems.value.filter((_, index) => index % 2 === 1));
    const vpSelectTab = (tab) => { vpTab.value = typeof tab === 'string' ? tab : tab.label; };
    const vpToggleFaq = (key) => { vpFaqOpen.value = vpFaqOpen.value === key ? null : key; };
    const vpNotify = (message) => toastMessage(message);
    const vpOpenChat = () => { if (typeof openChat === 'function') openChat(); else toastMessage('Live support opened'); };
    const vpHeaders = () => {
      const token = typeof readAuthToken === 'function' ? readAuthToken() : '';
      return token ? { Authorization: `Bearer ${token}` } : {};
    };
    async function vpLoad() {
      if (!isVipPage || typeof apiUrl !== 'function') return;
      vpLoading.value = true;
      vpError.value = '';
      try {
        const response = await fetch(apiUrl('/vip/page'), { credentials: 'include', headers: vpHeaders() });
        const payload = await response.json();
        if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error?.message || 'VIP data could not be loaded');
        const data = payload.data || {};
        vpProgress.value = data.progress || null;
        vpCmsBenefits.value = data.content?.benefits || [];
        vpCmsManagers.value = data.content?.managers || [];
        vpCmsFaq.value = data.content?.faq || [];
      } catch (error) { vpError.value = error.message || 'VIP data could not be loaded'; }
      finally { vpLoading.value = false; }
    }
    async function vpApplyTransfer() {
      if (vpApplying.value) return;
      if (!vpHeaders().Authorization) { toastMessage('Sign in to apply for VIP transfer'); return; }
      vpApplying.value = true;
      try {
        const response = await fetch(apiUrl('/vip/transfer/apply'), { method: 'POST', credentials: 'include', headers: { ...vpHeaders(), 'Content-Type': 'application/json' }, body: '{}' });
        const payload = await response.json();
        if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error?.message || 'Application failed');
        toastMessage('VIP transfer application received');
      } catch (error) { toastMessage(error.message || 'Application failed'); }
      finally { vpApplying.value = false; }
    }
    if (typeof onMounted === 'function') onMounted(vpLoad);
    return { isVipPage, vpTab, vpTabs, vpBenefits, vpManagers, vpSuperPerks, vpFaqLeft, vpFaqRight, vpFaqOpen, vpLoading, vpApplying, vpError, vpProgress, vpSelectTab, vpToggleFaq, vpNotify, vpOpenChat, vpApplyTransfer, vpLoad };
  };
})();
