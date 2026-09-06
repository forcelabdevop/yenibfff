/**
 * "Display in currency" modali (bakiye dropdown'undaki "Display in Fiat"
 * satirina tiklaninca acilir). Kullanici burada bir fiat (USD/EUR/...) secince
 * -- kullanici giris yapmissa -- bu artik SADECE goruntu tercihi degil,
 * GERCEK cuzdan para birimini degistirir: backend'in
 * POST /exchange/switch-fiat-currency ucuna gidilir (bkz.
 * backend/routes/exchangeRates.js), tum cuzdan bakiyeleri o anki kurla
 * cevrilip kullanicinin user.currency.fiatCurrency alani guncellenir.
 * Oyun baslatma (betinoviApi.js -> GetGameUrl -> settlementCurrencyCode)
 * bu alani okudugu icin secim sonrasinda oyunlar da secilen fiat ile acilir.
 *
 * Giris yapilmamissa (henuz gercek bir cuzdan yoksa) secim SADECE
 * localStorage'a yazilan bir goruntu tercihidir.
 *
 * casino-ui/index.html icindeki Vue setup() fonksiyonundan cagrilir.
 * Buyuk mantik ayri dosyada tutuluyor cunku setup() icine yapilan buyuk
 * cok satirli Edit'ler sandbox yeniden olusturmalarinda sessizce kayboluyor
 * (bkz. proje hafizasi). Sadece kucuk bir "wiring" satiri index.html'de kalir.
 *
 * Persist: secim ayrica tarayicida localStorage'da tutulur (STORAGE_NAMESPACE
 * + '.displayCurrency') ki sayfa yenilendiginde/giris yapilmadan once de
 * modal son secimi hatirlasin.
 *
 * NOT: Liste kasitli olarak sadece USD/EUR/TRY/BRL ile sinirli -- bu,
 * backend'in gercek donusum endpoint'inin (GET /exchange/rates,
 * backend/routes/exchangeRates.js) destekledigi kod kumesiyle birebir
 * kesisiyor. Listeye backend'in desteklemedigi bir kod eklenirse, o kod
 * icin donusum orani hep 1 (USD ile ayni) kabul edilir ve gosterilen tutar
 * yanlis olur -- bu yuzden iki liste senkron tutulmali.
 */
window.createCurrencyDisplayModal = function createCurrencyDisplayModal(ctx) {
  const { ref, computed, walletFiat, storageKey, apiUrl, getAuthToken, isAuthenticated, onFiatSwitched } = ctx

  const FIAT_LIST = [
    { code: "USD", name: "US Dollar", flag: "assets/flag-usd.png", symbol: "$", locale: "en-US" },
    { code: "EUR", name: "Euro", flag: "assets/flag-eur.png", symbol: "€", locale: "de-DE" },
    { code: "TRY", name: "Turkish lira", flag: "assets/flag-try.png", symbol: "₺", locale: "tr-TR" },
    { code: "BRL", name: "Brazilian real", flag: "assets/flag-brl.png", symbol: "R$", locale: "pt-BR" },
  ]

  // USD bazli donusum oranlari. Backend'den gelene kadar USD:1 varsayilir
  // (yani gecici olarak diger fiat'lar da USD ile ayni gosterilir), bu bir
  // hataya degil sadece henuz yuklenmemis olmaya isaret eder.
  const currencyDisplayRates = ref({ USD: 1 })
  const currencyDisplayRatesLoaded = ref(false)

  async function loadCurrencyDisplayRates() {
    try {
      const url = typeof apiUrl === "function" ? apiUrl("/exchange/rates") : "/exchange/rates"
      const response = await fetch(url)
      const payload = await response.json().catch(() => null)
      if (payload && payload.success && payload.rates) {
        currencyDisplayRates.value = Object.assign({ USD: 1 }, payload.rates)
      }
    } catch (e) {
      /* Kur servisine ulasilamadi -- USD:1 varsayilaniyla devam edilir,
         oyun baslatma/bakiye gorunumu bu yuzden asla bozulmaz. */
    } finally {
      currencyDisplayRatesLoaded.value = true
    }
  }
  loadCurrencyDisplayRates()

  // `amount`, `fromCode` para biriminde varsayilir (backend'de bakiyeler
  // hep kullanicinin gercek cuzdan fiat'inda -- walletFiat -- tutulur, bkz.
  // backend/routes/exchangeRates.js switch-fiat-currency). USD bazli kur
  // tablosu uzerinden secili goruntu para birimine (currencyDisplayActive,
  // veya codeOverride) cevirip formatlar. Sadece GORUNUM icindir -- gercek
  // bakiye backend'de degismez, hesaplama sonucu hicbir yere yazilmaz.
  function formatDisplayFiat(amount, fromCode, codeOverride) {
    const code = codeOverride || currencyDisplayActive.value
    const meta = FIAT_LIST.find((c) => c.code === code) || FIAT_LIST[0]
    const rates = currencyDisplayRates.value
    const fromRate = rates[String(fromCode || "USD").toUpperCase()] || 1
    const toRate = rates[code] || 1
    const amountInUsd = (Number(amount) || 0) / fromRate
    const converted = amountInUsd * toRate
    try {
      return new Intl.NumberFormat(meta.locale, {
        style: "currency",
        currency: meta.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(converted)
    } catch (e) {
      return meta.symbol + converted.toFixed(2)
    }
  }

  function readStoredCode() {
    try {
      const key = (typeof storageKey === "function" ? storageKey() : storageKey) || "displayCurrency"
      const saved = window.localStorage.getItem(key)
      if (saved && FIAT_LIST.some((c) => c.code === saved)) return saved
    } catch (e) {
      /* localStorage kapali olabilir (gizli sekme vb.) -- yut ve varsayilana don */
    }
    return null
  }

  const currencyDisplayModal = ref(false)
  const currencyDisplaySearch = ref("")
  const currencyDisplayActive = ref(readStoredCode() || (walletFiat && walletFiat.value) || "USD")
  const currencyDisplaySwitching = ref(false)
  const currencyDisplayError = ref("")

  const currencyDisplayFiltered = computed(() => {
    const q = currencyDisplaySearch.value.trim().toUpperCase()
    if (!q) return FIAT_LIST
    return FIAT_LIST.filter((c) => c.code.includes(q) || c.name.toUpperCase().includes(q))
  })

  const currencyDisplayActiveMeta = computed(
    () => FIAT_LIST.find((c) => c.code === currencyDisplayActive.value) || FIAT_LIST[0],
  )

  function openCurrencyDisplayModal() {
    currencyDisplaySearch.value = ""
    currencyDisplayModal.value = true
  }
  function closeCurrencyDisplayModal() {
    currencyDisplayModal.value = false
  }
  function persistDisplayCode(code) {
    try {
      const key = (typeof storageKey === "function" ? storageKey() : storageKey) || "displayCurrency"
      window.localStorage.setItem(key, code)
    } catch (e) {
      /* localStorage kapali olabilir -- yut */
    }
  }

  // Kullanici giris yapmissa ve secilen kod gercek cuzdan fiat'indan farkliysa,
  // backend'e /exchange/switch-fiat-currency cagrisi yapip GERCEK cuzdani
  // (bakiyeleri o anki kurla cevirerek) secilen fiat'a tasir -- bu sayede
  // sonraki oyun launch'lari (settlementCurrencyCode) da bu fiat ile acilir.
  // Giris yapilmamissa (henuz gercek cuzdan yok) sadece goruntu tercihi olarak
  // kalir.
  async function selectDisplayCurrency(currency) {
    if (currencyDisplaySwitching.value) return
    currencyDisplayError.value = ""

    const loggedIn = typeof isAuthenticated === "function" ? isAuthenticated() : !!(isAuthenticated && isAuthenticated.value)
    const currentReal = (walletFiat && walletFiat.value) || null

    if (loggedIn && currentReal && currentReal !== currency.code) {
      currencyDisplaySwitching.value = true
      try {
        const token = typeof getAuthToken === "function" ? getAuthToken() : null
        const url = typeof apiUrl === "function" ? apiUrl("/exchange/switch-fiat-currency") : "/exchange/switch-fiat-currency"
        const response = await fetch(url, {
          method: "POST",
          headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: `Bearer ${token}` } : {}),
          credentials: "include",
          body: JSON.stringify({ newFiat: currency.code }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload || !payload.success) {
          currencyDisplayError.value = (payload && payload.message) || "Para birimi değiştirilemedi."
          currencyDisplaySwitching.value = false
          return
        }
        if (typeof onFiatSwitched === "function") await onFiatSwitched()
      } catch (e) {
        currencyDisplayError.value = "Para birimi değiştirilemedi. Lütfen tekrar deneyin."
        currencyDisplaySwitching.value = false
        return
      }
      currencyDisplaySwitching.value = false
    }

    currencyDisplayActive.value = currency.code
    persistDisplayCode(currency.code)
    closeCurrencyDisplayModal()
  }

  return {
    currencyDisplayModal,
    currencyDisplaySearch,
    currencyDisplayActive,
    currencyDisplayActiveMeta,
    currencyDisplayFiltered,
    currencyDisplayList: FIAT_LIST,
    currencyDisplayRates,
    currencyDisplayRatesLoaded,
    currencyDisplaySwitching,
    currencyDisplayError,
    formatDisplayFiat,
    openCurrencyDisplayModal,
    closeCurrencyDisplayModal,
    selectDisplayCurrency,
  }
}
