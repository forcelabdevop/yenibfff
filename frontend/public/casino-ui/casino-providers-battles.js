/*
 * Casino sayfasindaki "Providers" + "Battles & Tournaments" bloklari.
 *
 * index.html cok buyuk oldugu icin (bkz. v0_memories/user/yenibfff.md) mantik
 * burada tutulur, index.html icinde sadece kucuk bir wiring stub bulunur:
 *   const casinoPT = window.createCasinoProvidersBattles({ ref, navigate });
 *   ...casinoPT  (setup return icine yayilir)
 *
 * VERI SUAN STATIK. Backend uclari hazir oldugunda buradaki diziler
 * fetch sonuclariyla degistirilebilir:
 *   GET <apiBase>/public/providers            -> ptProviders
 *   GET <apiBase>/public/tournaments/active   -> ptTournaments
 * Kart yapisini bozmamak icin alan adlarini ayni tutun.
 */
(function () {
  const ASSETS = 'assets/pt/';

  function createCasinoProvidersBattles(ctx) {
    const ref = ctx.ref;
    const computed = ctx.computed;
    const navigate = typeof ctx.navigate === 'function' ? ctx.navigate : function () {};
    const notify = typeof ctx.notify === 'function' ? ctx.notify : function () {};
    const onOpenGame = typeof ctx.onOpenGame === 'function' ? ctx.onOpenGame : null;

    const ptProviders = ref([
      { name: 'BETFURY', games: '24', logo: ASSETS + 'image-5.png', width: 142, height: 25 },
      { name: '100HP', games: '29', logo: ASSETS + 'image-6.png', width: 116, height: 30 },
      { name: 'Abeplay', games: '26', logo: ASSETS + 'image-7.png', width: 114, height: 31 },
      { name: 'Pragmatic Play', games: '1050', logo: ASSETS + 'image-8.png', width: 117, height: 53 },
      { name: 'Evolution', games: '588', logo: ASSETS + 'image-9.png', width: 118, height: 24 },
      { name: 'BGAMING', games: '274', logo: ASSETS + 'image-10.png', width: 122, height: 28 },
      { name: 'Hacksaw Gaming', games: '247', logo: ASSETS + 'image-11.png', width: 128, height: 38 },
      { name: 'Pocket Games Soft', games: '166', logo: ASSETS + 'image-12.png', width: 119, height: 35 },
      { name: 'Top Games', games: '318', logo: '', mark: '🏆' }
    ]);

    const ptProviderTotal = ref(75);

    // ===== "Recent Top Wins" rayi =====
    // VERI ODAKLI: her kart, gercek bir oyunun gorseli + uzerine bindirilen
    // kazanc verisidir (tutar + oyuncu + avatar). Boylece "Gates of Olympus"ta
    // bir kazanc olunca O oyunun gorseli overlay ile burada gorunur.
    //
    // Kaynak: ctx.games (canli oyun listesi / topSlots). Backend'de gercek
    // "recent wins" ucu hazir oldugunda ctx.wins ile hazir kayit gecilebilir
    // (alanlar: game{banner|background|image, game_name|name}, amount, user, avatar).
    const ptWinIcon = ASSETS + 'win/medal.png';
    const WIN_AVATAR = 'assets/user-avatar-raccoon.png';
    const WIN_USERS = [
      'Loochoomus', 'Mattosdias', 'FloridaMan', 'AZquarious', 'AlonInda',
      'User8400859', 'Kryptonic', 'NovaRider', 'ZenMaster', 'BigWinBob',
      'CryptoKing', 'LuckyLuna'
    ];

    // Isimden deterministik seed — her renderda ayni tutar/oyuncu cikar.
    function ptSeed(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return h;
    }
    function ptWinFromGame(game, i) {
      const name = game.game_name || game.name || 'Game';
      const seed = ptSeed(name + '#' + i);
      const amount = 250 + (seed % 480000) / 100; // ~$250 - $5050
      return {
        name: name,
        image: game.banner || game.background || game.image || '',
        amount: '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        user: WIN_USERS[seed % WIN_USERS.length],
        avatar: game.userAvatar || WIN_AVATAR,
        top: i < 3,
        game: game
      };
    }

    const ptWinsFallback = ref([]);
    const ptWins = computed
      ? computed(function () {
          // Backend hazir kayit verdiyse onu kullan.
          if (ctx.wins && ctx.wins.value && ctx.wins.value.length) {
            return ctx.wins.value.map(function (w, i) {
              const g = w.game || w;
              return {
                name: w.name || g.game_name || g.name || 'Game',
                image: w.image || g.banner || g.background || g.image || '',
                amount: w.amount || '',
                user: w.user || w.username || '',
                avatar: w.avatar || WIN_AVATAR,
                top: typeof w.top === 'boolean' ? w.top : i < 3,
                game: g
              };
            });
          }
          const pool = (ctx.games && ctx.games.value && ctx.games.value.length)
            ? ctx.games.value
            : ptWinsFallback.value;
          return pool.slice(0, 12).map(ptWinFromGame);
        })
      : ptWinsFallback;

    const ptTournaments = ref([
      {
        title: 'Pro Players Battle', titleHtml: 'Pro Players<br>Battle', days: '4 Days', time: '16:52:40',
        pool: '$20 000', mode: 'battle', button: 'Slide to Battle', theme: '',
        art: ASSETS + 'image-13.jpg', rank: ASSETS + 'image-14.png',
        players: [
          { name: 'AlonInda', wager: '$3,520,426.75', prize: '$6 000', avatar: '👨🏻‍🦳', avatarBg: '#ead27c' },
          { name: 'Loochoomus', wager: '$3,506,937.85', prize: '$4 000', raccoon: true },
          { name: 'FloridaMan', wager: '$1,640,849.63', prize: '$2 600', raccoon: true }
        ]
      },
      {
        title: 'Elite Strategy Battle', titleHtml: 'Elite Strategy<br>Battle', days: '2 Days', time: '16:52:40',
        pool: '$15 000', mode: 'battle', button: 'Slide to Battle', theme: 'pt-theme-2', bonus: true,
        art: ASSETS + 'image-15.jpg', rank: ASSETS + 'image-16.png',
        players: [
          { name: 'User8400859', wager: '$1,545,675.38', prize: '$3 000', fs: '+100 FS', raccoon: true },
          { name: 'User955229', wager: '$1,438,073.55', prize: '$2 250', fs: '+100 FS', avatar: '👱‍♀️', avatarBg: '#e54bd4' },
          { name: 'AZquarious', wager: '$286,360.44', prize: '$1 500', fs: '+100 FS', raccoon: true }
        ]
      },
      {
        title: 'Million Drops: Summer Festival', titleHtml: 'Million Drops:<br>Summer<br>Festival',
        days: '2 Days', time: '04:52:40', pool: '€80 000', mode: 'tournament',
        button: 'Slide to Tournament', theme: 'pt-theme-3', art: ASSETS + 'image-17.jpg'
      },
      {
        title: 'Lucky Races', titleHtml: 'Lucky Races', days: '131 Days', time: '00:52:40',
        pool: '€2 500 000', mode: 'tournament', button: 'Slide to Tournament', theme: 'pt-theme-4',
        wide: true, oaks: true, oaksLogo: ASSETS + 'image-4.png', art: ASSETS + 'image-18.jpg'
      },
      {
        title: 'Fury Tournament', titleHtml: 'Fury<br>Tournament', days: '8 Days', time: '09:12:18',
        pool: '$100 000', mode: 'tournament', button: 'Slide to Tournament', theme: 'pt-theme-5'
      }
    ]);

    const ptRaccoon = ASSETS + 'image-3.png';

    // Ok butonlari: en yakin .pt-section icindeki .pt-track'i kaydirir.
    function ptSlide(event, direction) {
      const section = event.currentTarget.closest('.pt-section');
      const track = section && section.querySelector('.pt-track');
      if (!track) return;
      const card = track.querySelector('.pt-provider, .pt-tour');
      const gap = parseFloat(getComputedStyle(track).columnGap || '14') || 14;
      const step = card ? (card.getBoundingClientRect().width + gap) * 2 : 356;
      track.scrollBy({ left: direction * step, behavior: 'smooth' });
    }

    function ptOpenProvider(provider) {
      notify(provider.name + ' oyunlari yakinda filtrelenebilecek.');
    }

    function ptOpenWin(win) {
      if (onOpenGame && win && win.game) { onOpenGame(win.game); return; }
      navigate('/casino');
    }

    function ptOpenTournament(tour) {
      notify(tour.title);
    }

    function ptAllProviders() {
      navigate('/casino');
    }

    return {
      ptProviders, ptProviderTotal, ptTournaments, ptRaccoon,
      ptWins, ptWinIcon, ptOpenWin,
      ptSlide, ptOpenProvider, ptOpenTournament, ptAllProviders
    };
  }

  window.createCasinoProvidersBattles = createCasinoProvidersBattles;
})();
