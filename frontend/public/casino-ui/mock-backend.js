/* =============================================================================
 * GECICI OFFLINE KATMANI — "backend bagi cozulmus" frontend modu
 * =============================================================================
 *
 * NEDEN VAR?
 *   Sandbox/onizleme ortamindan gercek backend'e (NEXT_PUBLIC_API_BASE_URL)
 *   erisilemiyor. Bu yuzden giris yapilamiyor ve oturum gerektiren sayfalar
 *   (wallet / profile / account / transactions / game-history / sessions /
 *   vault + oyun sayfasi) hic render edilemiyordu. Bu dosya, backend
 *   YERINE GECMEZ; sadece frontend'i tasarim/akis olarak bitirebilmek icin
 *   "giris yapilmis" bir oturum ve backend kontratiyla ayni SEKILDE yanit
 *   veren sahte uclar saglar.
 *
 * TASARIM KURALI (onemli):
 *   Buradaki her yanit, backend'in gercek yanit sekliyle BIREBIR ayni alan
 *   adlarini kullanir. Kaynaklar:
 *     - backend/routes/account/index.js      (/account/*)
 *     - backend/routes/index.js              (/user/:id, /transaction-history,
 *                                             /game-history)
 *     - backend/controllers/apiController.js (/public/games/*)
 *     - backend/utils/rivoWallet.js          (cuzdan/currency sabitleri)
 *   Uygulama kodunda "mock" diye bir dal YOKTUR — hicbir bilesen bu dosyayi
 *   bilmez. Katman yalnizca window.fetch'i sarar. Bu sayede backend'e geri
 *   baglanmak = bu katmani kapatmak, kod degistirmek degil.
 *
 * ---------------------------------------------------------------------------
 * BACKEND'E GERI BAGLAMA (tek adim)
 * ---------------------------------------------------------------------------
 *   Asagidaki MOCK_ENABLED_BY_DEFAULT degerini false yap. Baska hicbir sey
 *   degismez. Tam kontrol listesi ve kalan is maddeleri: MOCK-BACKEND.md
 *
 *   Gecici kapatma/acma (kod degistirmeden):
 *     - URL'ye ?mock=0  -> kapat   |  ?mock=1 -> ac
 *     - localStorage: "<namespace>.mockBackend" = "0" | "1"
 *
 * ---------------------------------------------------------------------------
 * KAPSAM DISI (bilincli olarak mocklanmadi)
 * ---------------------------------------------------------------------------
 *   - socket.io: casino-ui icin window.io stub'lanir (asagida). Next tarafi
 *     npm'den import ettigi icin lib/socket.ts icinde ayri bir guard var.
 *     Yani canli chat/online sayaci/canli bahis akisi bu modda AKMAZ.
 *   - Gercek oyun baslatma (POST /betinovi_api): saglayici URL'si uretmek
 *     imkansiz; mock "saglayici bu modda kapali" hatasi dondurur ki oyun
 *     sayfasinin hata durumu da test edilebilsin.
 *   - Odeme/cekim akislari (cashier) mocklanmadi.
 *   Mocklanmamis bir uca istek gidince console'a
 *   "[mock-backend] eslesmeyen uc" uyarisi + 503 doner; boylece eksikler
 *   sessizce kaybolmaz.
 * =========================================================================== */
;(() => {
  "use strict"

  // >>> BACKEND'E BAGLANIRKEN BUNU false YAP <<<
  const MOCK_ENABLED_BY_DEFAULT = true

  const script = document.currentScript
  const params = new URLSearchParams(window.location.search)

  // Namespace: iframe'de ?storageNamespace, Next dokumaninda script'in
  // data-storage-namespace attribute'u ile gelir (bkz. app/layout.tsx).
  const NS = String(
    (script && script.dataset.storageNamespace) || params.get("storageNamespace") || "website",
  )
  const API_BASE = String(
    (script && script.dataset.apiBase) || params.get("apiBase") || "http://localhost:5000",
  ).replace(/\/$/, "")

  const FLAG_KEY = NS + ".mockBackend"
  const TOKEN_KEY = NS + ".token"
  const USER_ID_KEY = NS + ".userId"

  const readFlag = () => {
    try {
      return window.localStorage.getItem(FLAG_KEY)
    } catch {
      return null
    }
  }

  const urlFlag = params.get("mock")
  const storedFlag = readFlag()
  const ENABLED =
    urlFlag === "1" ? true : urlFlag === "0" ? false
    : storedFlag === "1" ? true : storedFlag === "0" ? false
    : MOCK_ENABLED_BY_DEFAULT

  // Bayragi kalici yap: iframe URL'sinde ?mock parametresi olmasa da alt
  // dokumanlar ayni kararla calisir.
  if (urlFlag === "1" || urlFlag === "0") {
    try {
      window.localStorage.setItem(FLAG_KEY, urlFlag)
    } catch {}
  }

  window.__MOCK_BACKEND__ = ENABLED
  if (!ENABLED) return

  // ---------------------------------------------------------------------------
  // 1) Sahte oturum — "giris yapilmis" hali
  // ---------------------------------------------------------------------------
  // Hem casino-ui hem Next tarafi ayni localStorage anahtarlarini okur, bu
  // yuzden token/userId yazmak iki tarafta da isAuthenticated = true yapar.
  const USER_ID = "000000000000000000000001"
  const TOKEN = "mock.session.token"
  try {
    if (!window.localStorage.getItem(TOKEN_KEY)) window.localStorage.setItem(TOKEN_KEY, TOKEN)
    if (!window.localStorage.getItem(USER_ID_KEY)) window.localStorage.setItem(USER_ID_KEY, USER_ID)
  } catch {}

  // ---------------------------------------------------------------------------
  // 2) Sabit veri — backend alan adlariyla
  // ---------------------------------------------------------------------------
  const ORIGIN = window.location.origin
  const asset = (n) => ORIGIN + "/casino-ui/assets/image-" + n + ".png"
  // Oyun thumbnail'i olarak kullanilabilecek asset numaralari.
  const THUMBS = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]

  // Rivo tek cuzdan modeli — backend/utils/rivoWallet.js RIVO_WALLET.
  const WALLET_KEY = { coinType: "Rivo", chain: "TRON", type: "trc-20" }
  const state = {
    walletBalance: 1284.5,
    vaultAmount: 250,
  }

  const ISO = (daysAgo, hoursAgo) =>
    new Date(Date.now() - (daysAgo || 0) * 864e5 - (hoursAgo || 0) * 36e5).toISOString()

  const PROVIDERS = [
    { code: "pragmatic", name: "Pragmatic Play" },
    { code: "evolution", name: "Evolution" },
    { code: "hacksaw", name: "Hacksaw Gaming" },
    { code: "nolimit", name: "Nolimit City" },
    { code: "playngo", name: "Play'n GO" },
  ]

  const GAME_SEED = [
    ["Gates of Olympus", "gates-of-olympus", "pragmatic", "slot", 96.5],
    ["Sweet Bonanza", "sweet-bonanza", "pragmatic", "slot", 96.51],
    ["Sugar Rush", "sugar-rush", "pragmatic", "slot", 96.5],
    ["Big Bass Bonanza", "big-bass-bonanza", "pragmatic", "slot", 96.71],
    ["Starlight Princess", "starlight-princess", "pragmatic", "slot", 96.5],
    ["Wanted Dead or a Wild", "wanted-dead-or-a-wild", "hacksaw", "slot", 96.38],
    ["Le Bandit", "le-bandit", "hacksaw", "slot", 96.34],
    ["Hand of Anubis", "hand-of-anubis", "hacksaw", "slot", 96.24],
    ["Mental", "mental", "nolimit", "slot", 96.08],
    ["San Quentin xWays", "san-quentin-xways", "nolimit", "slot", 96.03],
    ["Book of Dead", "book-of-dead", "playngo", "slot", 96.21],
    ["Rise of Olympus", "rise-of-olympus", "playngo", "slot", 96.5],
    ["Lightning Roulette", "lightning-roulette", "evolution", "live", 97.3],
    ["Crazy Time", "crazy-time", "evolution", "live", 95.5],
    ["Blackjack Party", "blackjack-party", "evolution", "live", 99.29],
    ["Monopoly Big Baller", "monopoly-big-baller", "evolution", "live", 96.1],
    ["Sweet Bonanza Candyland", "sweet-bonanza-candyland", "evolution", "live", 96.23],
    ["Gonzo's Treasure Hunt", "gonzos-treasure-hunt", "evolution", "live", 96.4],
  ]

  const makeGame = (seed, index) => {
    const [game_name, game_code, provider_code, game_type, rtp] = seed
    const provider = PROVIDERS.find((p) => p.code === provider_code)
    return {
      _id: "mockgame" + String(index).padStart(16, "0"),
      game_name,
      game_code,
      provider_code,
      provider: { _id: "mockprov-" + provider_code, name: provider ? provider.name : provider_code },
      banner: asset(THUMBS[index % THUMBS.length]),
      background: asset(THUMBS[(index + 3) % THUMBS.length]),
      game_type,
      technology: "HTML5",
      rtp,
      views: 9000 - index * 137,
      featured: index < 6,
      is_mobile: true,
      has_freespins: game_type === "slot",
      has_tables: game_type === "live",
      has_lobby: true,
      categories: [game_type === "live" ? "live-casino" : "slots"],
      created_at: ISO(30 + index),
    }
  }

  const GAMES = GAME_SEED.map(makeGame)
  const gameByCode = (code) => GAMES.find((g) => g.game_code === code) || null

  const CATEGORIES = [
    { _id: "mockcat-1", name: "Slots", slug: "slots", img: asset(THUMBS[0]) },
    { _id: "mockcat-2", name: "Live Casino", slug: "live-casino", img: asset(THUMBS[4]) },
    { _id: "mockcat-3", name: "Game Shows", slug: "game-shows", img: asset(THUMBS[7]) },
    { _id: "mockcat-4", name: "New Releases", slug: "new-releases", img: asset(THUMBS[2]) },
  ]

  const gamesForCategory = (slug) => {
    if (slug === "slots") return GAMES.filter((g) => g.game_type === "slot")
    if (slug === "live-casino") return GAMES.filter((g) => g.game_type === "live")
    if (slug === "game-shows") return GAMES.filter((g) => /crazy|monopoly|candyland|treasure/i.test(g.game_name))
    return GAMES.slice(0, 8)
  }

  // GET /user/:id — backend User dokumaninin frontend'e donen hali.
  const buildUser = () => ({
    _id: USER_ID,
    numericId: 100241,
    username: "demo_player",
    name: "Demo Player",
    email: "demo@example.com",
    local: { email: "demo@example.com", emailVerified: true },
    avatar: null,
    // backend/database/models/User.js -> rank bir ROL alanidir ("user"),
    // VIP seviyesi degil. Bilerek oldugu gibi birakildi.
    rank: "user",
    phone: "+905550000000",
    currency: { fiatCurrency: "EUR", coinType: "Rivo", chain: "TRON", type: "trc-20", coins: 0 },
    wallets: [Object.assign({}, WALLET_KEY, { balance: state.walletBalance })],
    xp: 4280,
    stats: { bet: 18450.25, won: 17220.8 },
    anonymous: false,
    mute: { active: false },
    ban: { active: false },
    mfa: { enabled: false },
    verifiedAt: ISO(40),
    createdAt: ISO(120),
  })

  const activeWallet = () => Object.assign({}, WALLET_KEY, { balance: state.walletBalance })
  const vaultBalances = () =>
    state.vaultAmount > 0 ? [Object.assign({}, WALLET_KEY, { amount: state.vaultAmount })] : []

  const TRANSACTIONS = [
    { _id: "mocktx1", amount: 500, title: "Kripto Para Transferi", type: "deposit", status: "completed", method: "crypto", currency: "USDT", cryptoAmount: 500, createdAt: ISO(1), updatedAt: ISO(1) },
    { _id: "mocktx2", amount: 250, title: "Banka Para Transferi", type: "withdraw", status: "pending", method: "bank", bankName: "Demo Bank", createdAt: ISO(3), updatedAt: ISO(3) },
    { _id: "mocktx3", amount: 1000, title: "Kripto Para Transferi", type: "deposit", status: "completed", method: "crypto", currency: "USDT", cryptoAmount: 1000, createdAt: ISO(9), updatedAt: ISO(9) },
    { _id: "mocktx4", amount: 120, title: "Banka Para Transferi", type: "withdraw", status: "rejected", method: "bank", bankName: "Demo Bank", createdAt: ISO(14), updatedAt: ISO(13) },
  ]

  const GAME_HISTORY = GAMES.slice(0, 10).map((game, i) => {
    const bet = [10, 25, 5, 50, 2.5][i % 5]
    const win = [0, 62.5, 18.75, 0, 240][i % 5]
    const before = 1000 + i * 37
    return {
      txn_id: "mocktxn-" + (i + 1),
      round_id: "mockround-" + (i + 1),
      bet_money: bet,
      win_money: win,
      balance_before: before,
      balance_after: before - bet + win,
      created_at: ISO(0, i * 5 + 1),
      txn_type: "bet",
      game_code: game.game_code,
      game_name: game.game_name,
      game_type: game.game_type,
      banner: game.banner,
      provider: game.provider,
    }
  })

  const SESSIONS = [
    { _id: "mocksess1", at: ISO(0, 2), ip: "88.230.14.***", userAgent: navigator.userAgent },
    { _id: "mocksess2", at: ISO(1, 6), ip: "88.230.14.***", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/605.1.15" },
    { _id: "mocksess3", at: ISO(4, 1), ip: "31.142.90.***", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36" },
  ]

  const topWinsFor = (game) => {
    const base = Math.max(1, (game.views || 1000) % 7)
    return [
      { username: "pla***91", bet_money: 20, win_money: 20 * (140 + base), multiplier: 140 + base, created_at: ISO(0, 3) },
      { username: "luc***07", bet_money: 5, win_money: 5 * (90 + base), multiplier: 90 + base, created_at: ISO(1, 4) },
      { username: "kaz***33", bet_money: 50, win_money: 50 * (12 + base), multiplier: 12 + base, created_at: ISO(2, 9) },
    ]
  }

  // ---------------------------------------------------------------------------
  // 3) Uc tablosu — [method, pathname pattern, handler]
  // ---------------------------------------------------------------------------
  const json = (body, status) =>
    new Response(JSON.stringify(body), {
      status: status || 200,
      headers: { "content-type": "application/json" },
    })

  const ROUTES = [
    // --- oturum / kullanici ---
    ["GET", /^\/user\/[^/]+$/, () => json(buildUser())],
    ["POST", /^\/auth\/credentials$/, () => json({ token: TOKEN, userId: USER_ID, user: buildUser() })],
    ["POST", /^\/auth\/credentials\/register$/, () => json({ token: TOKEN, userId: USER_ID, user: buildUser() })],
    ["POST", /^\/auth\/credentials\/mfa\/validate-otp$/, () => json({ token: TOKEN, userId: USER_ID })],

    // --- lobi / oyunlar (backend/controllers/apiController.js) ---
    [
      "GET",
      /^\/public\/games\/categories\/with-games$/,
      () =>
        json({
          data: CATEGORIES.map((cat) => {
            const games = gamesForCategory(cat.slug)
            return Object.assign({}, cat, { total_games: games.length, games })
          }),
        }),
    ],
    ["GET", /^\/public\/categories$/, () => json(CATEGORIES)],
    ["GET", /^\/public\/games\/featured\/list$/, () => json(GAMES.filter((g) => g.featured))],
    [
      "GET",
      /^\/public\/games\/category\/([^/]+)$/,
      (_req, url, m) => json(gamesForCategory(decodeURIComponent(m[1]))),
    ],
    [
      "GET",
      /^\/public\/games\/search$/,
      (_req, url) => {
        const q = String(url.searchParams.get("query") || "").toLowerCase().trim()
        if (!q) return json([])
        return json(GAMES.filter((g) => g.game_name.toLowerCase().includes(q)))
      },
    ],
    [
      "GET",
      /^\/public\/games\/detail\/([^/]+)$/,
      (_req, url, m) => {
        const game = gameByCode(decodeURIComponent(m[1]))
        if (!game) return json({ success: false, message: "Game not found" }, 404)
        const provider = PROVIDERS.find((p) => p.code === game.provider_code) || null
        return json({
          success: true,
          data: {
            game,
            provider: { code: game.provider_code, name: provider ? provider.name : game.provider_code },
            categories: CATEGORIES.filter((c) => (game.categories || []).includes(c.slug)),
            topWins: topWinsFor(game),
            providerGames: GAMES.filter(
              (g) => g.provider_code === game.provider_code && g.game_code !== game.game_code,
            ),
            popularGames: GAMES.filter((g) => g.game_code !== game.game_code).slice(0, 12),
          },
        })
      },
    ],

    // --- hesap sayfalari (backend/routes/account/index.js) ---
    [
      "GET",
      /^\/account\/overview$/,
      () => {
        const user = buildUser()
        return json({
          success: true,
          data: {
            profile: {
              _id: user._id,
              numericId: user.numericId,
              username: user.username,
              name: user.name,
              email: user.email,
              emailVerified: true,
              phone: user.phone,
              birthday: null,
              avatar: null,
              rank: user.rank,
              xp: user.xp,
              createdAt: user.createdAt,
              verifiedAt: user.verifiedAt,
              identityVerified: false,
              address: { country: "TR", city: "Istanbul" },
            },
            security: { mfaEnabled: false, mfaMethodCount: 0, mfaLastVerifiedAt: null },
            wallet: {
              wallets: [activeWallet()],
              currency: user.currency,
              activeWallet: activeWallet(),
              activeBalance: state.walletBalance,
            },
            vault: {
              balances: vaultBalances(),
              total: state.vaultAmount,
              locked: false,
              expireAt: null,
            },
            stats: user.stats,
          },
        })
      },
    ],
    ["GET", /^\/account\/sessions$/, () => json({ success: true, sessions: SESSIONS })],
    [
      "GET",
      /^\/account\/vault$/,
      () =>
        json({
          success: true,
          data: {
            balances: vaultBalances(),
            total: state.vaultAmount,
            locked: false,
            expireAt: null,
            activeWallet: activeWallet(),
            activeBalance: state.walletBalance,
          },
        }),
    ],
    [
      "POST",
      /^\/account\/vault\/(deposit|withdraw)$/,
      async (req, _url, m) => {
        const direction = m[1]
        let amount = 0
        try {
          amount = Number((JSON.parse(await req.text() || "{}") || {}).amount) || 0
        } catch {}
        if (!Number.isFinite(amount) || amount <= 0)
          return json({ success: false, message: "Gecersiz tutar girdiniz." }, 400)
        // Backend'deki kosullu atomik guncellemenin karsiligi: bakiye asilamaz.
        if (direction === "deposit") {
          if (amount > state.walletBalance)
            return json({ success: false, message: "Bu islem icin yeterli bakiyeniz yok." }, 400)
          state.walletBalance -= amount
          state.vaultAmount += amount
        } else {
          if (amount > state.vaultAmount)
            return json({ success: false, message: "Kasanizda yeterli bakiye yok." }, 400)
          state.vaultAmount -= amount
          state.walletBalance += amount
        }
        return json({
          success: true,
          data: { balances: vaultBalances(), total: state.vaultAmount, activeBalance: state.walletBalance },
        })
      },
    ],

    // --- gecmis uclari (backend/routes/index.js) ---
    ["GET", /^\/transaction-history\/[^/]+$/, () => json({ transactions: TRANSACTIONS })],
    [
      "GET",
      /^\/game-history\/[^/]+$/,
      () =>
        json({
          history: GAME_HISTORY,
          pagination: {
            totalRecords: GAME_HISTORY.length,
            totalPages: 1,
            currentPage: 1,
            pageSize: GAME_HISTORY.length,
          },
        }),
    ],

    // --- oyun baslatma ---
    // Gercek launch URL'si uretilemez; oyun sayfasinin hata durumu gorunur.
    [
      "POST",
      /^\/betinovi_api$/,
      () =>
        json({
          status: 0,
          msg: "Oyun saglayicisi offline modda kapali (mock-backend).",
          details: "Gercek oyun baslatma icin backend baglantisi gerekir.",
        }),
    ],

    // --- site ayarlari / stil uclari ---
    ["GET", /^\/custom\.css$/, () => new Response("", { headers: { "content-type": "text/css" } })],
  ]

  // ---------------------------------------------------------------------------
  // 4) fetch sarmalayici
  // ---------------------------------------------------------------------------
  const nativeFetch = window.fetch.bind(window)
  const API_ORIGIN = (() => {
    try {
      return new URL(API_BASE, ORIGIN).origin
    } catch {
      return null
    }
  })()

  const warned = new Set()
  const warnOnce = (key, ...rest) => {
    if (warned.has(key)) return
    warned.add(key)
    console.warn(...rest)
  }

  window.fetch = async function mockFetch(input, init) {
    let url
    const raw = typeof input === "string" ? input : input && input.url
    try {
      url = new URL(raw, ORIGIN)
    } catch {
      return nativeFetch(input, init)
    }

    const method = String(
      (init && init.method) || (typeof input !== "string" && input && input.method) || "GET",
    ).toUpperCase()

    // Yalnizca backend'e giden istekler ele alinir. Ayni origin'deki statik
    // dosyalar (/_next/*, /casino-ui/*, gorseller) dokunulmadan gecer.
    // API_ORIGIN cozulemediyse (bozuk env) tum eslesen uclari mock uzerine al.
    const isApiCall = API_ORIGIN === null || url.origin === API_ORIGIN
    const pathname = url.pathname.replace(/\/+$/, "") || "/"

    if (!isApiCall) return nativeFetch(input, init)

    for (const [routeMethod, pattern, handler] of ROUTES) {
      if (routeMethod !== method) continue
      const match = pattern.exec(pathname)
      if (!match) continue
      const request = typeof input === "string" ? new Request(url.href, init) : input
      try {
        return await handler(request, url, match)
      } catch (error) {
        console.error("[mock-backend] handler hatasi:", pathname, error)
        return json({ success: false, message: "mock handler error" }, 500)
      }
    }

    // API base uygulamayla ayni origin'de ise (proxy kurulumu) eslesmeyen
    // istekler Next'in kendi uclari olabilir — onlari asla kesmiyoruz.
    if (isApiCall && url.origin !== ORIGIN) {
      warnOnce(
        method + pathname,
        "[mock-backend] eslesmeyen uc:",
        method,
        pathname,
        "— bu uc mocklanmadi, 503 donuyor. Gerekliyse mock-backend.js ROUTES tablosuna ekle.",
      )
      return json({ success: false, message: "mock-backend: unmapped endpoint" }, 503)
    }

    return nativeFetch(input, init)
  }

  // ---------------------------------------------------------------------------
  // 5) socket.io stub (yalnizca casino-ui iframe'i icin)
  // ---------------------------------------------------------------------------
  // index.html socket.io-client'i global "io" olarak yukler. Offline modda
  // baglanti denemesi konsolu doldurdugu icin sessiz bir stub ile degistiriyoruz.
  if (typeof window.io === "function") {
    window.io = function mockIo() {
      const noop = () => stub
      const stub = {
        id: "mock-socket",
        connected: false,
        on: noop,
        once: noop,
        off: noop,
        emit: noop,
        removeAllListeners: noop,
        disconnect: noop,
        connect: noop,
      }
      return stub
    }
  }

  console.info(
    "[mock-backend] AKTIF — backend bagi kesildi, oturum sahte. " +
      "Kapatmak icin URL'ye ?mock=0 ekle veya mock-backend.js icindeki " +
      "MOCK_ENABLED_BY_DEFAULT = false yap. Notlar: MOCK-BACKEND.md",
  )
})()
