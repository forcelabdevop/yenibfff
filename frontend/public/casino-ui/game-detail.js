/**
 * Oyun detay sayfasi (/game/?code=...) mantigi.
 * casino-ui/index.html icindeki Vue setup() fonksiyonundan cagrilir.
 *
 * Tum veriler backend'den gelir:
 *  - GET  /public/games/detail/:code  -> oyun, saglayici, kategoriler, top kazanclar, ilgili oyunlar
 *  - POST /betinovi_api (GetGameUrl)  -> gercek saglayici launch URL'i
 */
window.createGameDetail = function createGameDetail(ctx) {
  const { ref, computed, currentPage, runtimeParams, apiUrl, backendAssetUrl, websiteName, knownRtp, normalizeGameName, authUser, readAuthToken } = ctx

  const isGamePage = currentPage === "game"
  const routeGameCode = String(runtimeParams.get("code") || "").trim()

  const gameDetail = ref(null)
  const gameDetailLoading = ref(false)
  const gameDetailError = ref("")
  const launchState = ref("idle") // idle | loading | ready | error
  const launchUrl = ref("")
  const launchError = ref("")
  const launchTheatre = ref(false)
  const gameFavorite = ref(false)
  const gameCurrencyOpen = ref(false)

  // --- Referans tasarimin arayuz durumu ---
  // Demo modu backend'de desteklenmiyor (GetGameUrl'in demo parametresi yok),
  // bu yuzden varsayilan Real Play. Kullanici Demo'ya basarsa durumu bildiriyoruz.
  const demoMode = ref(false)
  const detailsOpen = ref(false)
  const bestOffset = ref(0)
  const popularOffset = ref(0)
  const gameToast = ref("")
  let toastTimer = null

  const detailGame = computed(() => (gameDetail.value ? gameDetail.value.game : null))
  const detailLaunchArtwork = computed(() => {
    const game = detailGame.value
    if (!game) return ""
    return game.background || game.cover || game.banner || ""
  })

  const detailProviderName = computed(() => {
    const provider = gameDetail.value && gameDetail.value.provider
    const raw = (provider && (provider.name || provider.code)) || ""
    return String(raw)
      .replace(/^(slot|live|casino|table)[-_]/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .trim()
  })

  const detailRtp = computed(() => {
    const game = detailGame.value
    if (!game) return ""
    const raw = Number(game.rtp)
    if (Number.isFinite(raw) && raw > 90 && raw <= 99.5) return raw.toFixed(2)
    const fallback = knownRtp[normalizeGameName(game.game_name)]
    return fallback ? fallback.toFixed(2) : ""
  })

  // Admin panelinden elle (veya bir sağlayıcı/agregatör içe aktarımından)
  // doldurulan zenginleştirilmiş alanlar — çoğunlukla Slot'larda dolu olur,
  // Canlı Casino/masa oyunlarında admin boş bırakabilir; bu durumda satır
  // hiç gösterilmez (BetFury'deki gibi "—" yerine tamamen gizliyoruz, çünkü
  // aşağıdaki .filter zaten boş değerleri eliyor).
  const detailBetRange = computed(() => {
    const game = detailGame.value
    if (!game) return ""
    const min = Number(game.bet_min)
    const max = Number(game.bet_max)
    if (!Number.isFinite(min) && !Number.isFinite(max)) return ""
    const fmt = (n) => "\u20ba" + n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })
    if (Number.isFinite(min) && Number.isFinite(max)) return fmt(min) + " - " + fmt(max)
    return fmt(Number.isFinite(min) ? min : max)
  })

  const detailMaxWin = computed(() => {
    const game = detailGame.value
    const value = Number(game && game.max_win_multiplier)
    return Number.isFinite(value) && value > 0 ? value.toLocaleString("tr-TR") + "x" : ""
  })

  // "Game Attributes" tablosu — yalnizca backend'den gercekten gelen alanlar gosterilir.
  const detailAttributes = computed(() => {
    const game = detailGame.value
    if (!game) return []
    return [
      { label: "Layout", value: game.layout },
      { label: "Paylines", value: game.paylines },
      { label: "Bet Range", value: detailBetRange.value },
      { label: "Max Win", value: detailMaxWin.value },
      { label: "Volatility", value: game.volatility },
      { label: "Themes", value: Array.isArray(game.themes) ? game.themes.join(", ") : "" },
      { label: "Features", value: Array.isArray(game.features) ? game.features.join(", ") : "" },
      { label: "Provider", value: detailProviderName.value },
      { label: "Game type", value: game.game_type },
      { label: "Technology", value: game.technology },
      { label: "RTP", value: detailRtp.value ? detailRtp.value + "%" : "" },
      { label: "Mobile ready", value: game.is_mobile ? "Yes" : "" },
      { label: "Free spins", value: game.has_freespins ? "Yes" : "" },
      { label: "Live tables", value: game.has_tables ? "Yes" : "" },
      { label: "Lobby support", value: game.has_lobby ? "Yes" : "" },
      {
        label: "Release",
        value: game.created_at
          ? new Date(game.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short" })
          : "",
      },
    ].filter((row) => row.value)
  })

  const detailBreadcrumb = computed(() => {
    const game = detailGame.value
    const trail = [
      { label: websiteName, path: "/" },
      { label: "All Games", path: "/casino" },
    ]
    const category = gameDetail.value && gameDetail.value.categories && gameDetail.value.categories[0]
    if (category) trail.push({ label: category.name, path: "/casino" })
    if (detailProviderName.value) trail.push({ label: detailProviderName.value, path: "/casino" })
    if (game) trail.push({ label: game.game_name || game.game_code, path: "" })
    return trail
  })

  function formatWinAmount(value) {
    const amount = Number(value) || 0
    try {
      return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(
        amount,
      )
    } catch (error) {
      return amount.toFixed(2) + "\u20ba"
    }
  }

  function mapDetailGame(game) {
    return Object.assign({}, game, {
      banner: backendAssetUrl(game.banner),
      background: backendAssetUrl(game.background),
      cover: backendAssetUrl(game.cover),
    })
  }

  async function loadGameDetail() {
    if (!routeGameCode) {
      gameDetailError.value = "Oyun kodu bulunamadi."
      return
    }
    gameDetailLoading.value = true
    gameDetailError.value = ""
    try {
      const response = await fetch(apiUrl("/public/games/detail/" + encodeURIComponent(routeGameCode)), {
        credentials: "include",
      })
      if (!response.ok) throw new Error("detail")
      const payload = await response.json()
      const data = payload && payload.data
      if (!data || !data.game) throw new Error("detail")
      gameDetail.value = Object.assign({}, data, {
        game: mapDetailGame(data.game),
        categories: (data.categories || []).map((category) =>
          Object.assign({}, category, { img: backendAssetUrl(category.img) }),
        ),
        topWins: data.topWins || [],
        providerGames: (data.providerGames || []).map(mapDetailGame),
        popularGames: (data.popularGames || []).map(mapDetailGame),
      })
      document.title = (data.game.game_name || "Game") + " \u2014 " + websiteName
    } catch (error) {
      gameDetailError.value = "Oyun bilgileri su an yuklenemiyor."
    } finally {
      gameDetailLoading.value = false
    }
  }

  // Gercek saglayicidan launch URL ister. Demo yok — oyun kullanicinin gercek bakiyesiyle acilir.
  async function startGame() {
    const game = detailGame.value
    if (!game) return
    if (!authUser.value) {
      window.parent.postMessage({ source: "casino-frame", type: "open-auth", mode: "login" }, window.location.origin)
      return
    }
    if (!game.provider_code) {
      launchState.value = "error"
      launchError.value = "Bu oyun icin saglayici bilgisi eksik, su an baslatilamiyor."
      return
    }
    launchState.value = "loading"
    launchError.value = ""
    try {
      const token = readAuthToken()
      const response = await fetch(apiUrl("/betinovi_api"), {
        method: "POST",
        credentials: "include",
        headers: Object.assign(
          { "Content-Type": "application/json" },
          token ? { Authorization: "Bearer " + token } : {},
        ),
        body: JSON.stringify({
          method: "GetGameUrl",
          user_id: authUser.value._id,
          vendorCode: game.provider_code,
          gameCode: game.game_code,
          language: "tr",
          channel: "desktop",
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (payload && payload.status === 1 && payload.launch_url) {
        launchUrl.value = payload.launch_url
        launchState.value = "ready"
      } else {
        launchState.value = "error"
        launchError.value = payload.details || payload.msg || "Oyun saglayicisindan yanit alinamadi."
      }
    } catch (error) {
      launchState.value = "error"
      launchError.value = "Oyun saglayicisina su an ulasilamiyor. Lutfen daha sonra tekrar dene."
    }
  }

  function exitGame() {
    launchState.value = "idle"
    launchUrl.value = ""
    launchError.value = ""
    launchTheatre.value = false
  }

  function toggleTheatre() {
    launchTheatre.value = !launchTheatre.value
  }

  function notifyGame(message) {
    gameToast.value = message
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      gameToast.value = ""
    }, 2600)
  }

  // Demo modu saglayici tarafinda desteklenmedigi icin gercekten acilamiyor;
  // sahte bir demo baslatmak yerine durumu durust sekilde bildiriyoruz.
  function setDemoMode(next) {
    if (next) {
      demoMode.value = false
      notifyGame("Demo mode is not available for this game yet — it opens with your real balance.")
      return
    }
    demoMode.value = false
  }

  // --- Karusel: CSS'teki kart genisligi + bosluk ile ayni adim ---
  function railPitch() {
    return window.innerWidth <= 700 ? 172 : 211
  }

  function railViewport() {
    // .gl-catalog__shell max-width:1035px, kucuk ekranlarda viewport genisligi
    return Math.max(200, Math.min(1035, window.innerWidth - 32))
  }

  // Son kart gorunur olana kadar kaydirilabilecek en fazla mesafe
  function railMax(count) {
    const pitch = railPitch()
    const visible = Math.max(1, Math.floor(railViewport() / pitch))
    return Math.max(0, (Number(count) || 0) - visible) * pitch
  }

  const bestRailMax = computed(() => railMax(gameDetail.value?.providerGames?.length || 0))
  const popularRailMax = computed(() => railMax(gameDetail.value?.popularGames?.length || 0))

  function slideRail(which, direction) {
    const isBest = which === "best"
    const target = isBest ? bestOffset : popularOffset
    const max = isBest ? bestRailMax.value : popularRailMax.value
    target.value = Math.max(0, Math.min(max, target.value + direction * railPitch()))
  }

  async function openGameFullscreen() {
    const viewport = document.getElementById("glViewport")
    if (!document.fullscreenElement && viewport && viewport.requestFullscreen) {
      try {
        await viewport.requestFullscreen()
      } catch (error) {
        launchTheatre.value = true
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }

  return {
    demoMode,
    detailsOpen,
    bestOffset,
    popularOffset,
    gameToast,
    notifyGame,
    setDemoMode,
    slideRail,
    bestRailMax,
    popularRailMax,
    openGameFullscreen,
    isGamePage,
    gameDetail,
    gameDetailLoading,
    gameDetailError,
    detailGame,
    detailProviderName,
    detailRtp,
    detailAttributes,
    detailBreadcrumb,
    launchState,
    launchUrl,
    launchError,
    launchTheatre,
    gameFavorite,
    gameCurrencyOpen,
    detailLaunchArtwork,
    loadGameDetail,
    startGame,
    exitGame,
    toggleTheatre,
    formatWinAmount,
  }
}
