/**
 * "Display in currency" modali (bakiye dropdown'undaki "Display in Fiat"
 * satirina tiklaninca acilir). Kullanici gosterim para birimini (USD/EUR/...)
 * secer; bu SADECE goruntu tercihidir, gercek bakiye/islemler backend'de
 * hep kullanicinin gercek cuzdan para biriminde tutulur (walletFiat).
 *
 * casino-ui/index.html icindeki Vue setup() fonksiyonundan cagrilir.
 * Buyuk mantik ayri dosyada tutuluyor cunku setup() icine yapilan buyuk
 * cok satirli Edit'ler sandbox yeniden olusturmalarinda sessizce kayboluyor
 * (bkz. proje hafizasi). Sadece kucuk bir "wiring" satiri index.html'de kalir.
 *
 * Persist: secim tarayicida localStorage'da tutulur (STORAGE_NAMESPACE +
 * '.displayCurrency'), backend'e yazilmaz -- cunku bu alan hicbir API
 * modelinde yok, sadece istemci tarafi bir goruntu tercihi.
 *
 * NOT: Liste kasitli olarak sadece USD/EUR/TRY/BRL ile sinirli -- bu,
 * backend'in gercek donusum endpoint'inin (GET /exchange/rates,
 * backend/routes/exchangeRates.js) destekledigi kod kumesiyle birebir
 * kesisiyor. Listeye backend'in desteklemedigi bir kod eklenirse, o kod
 * icin donusum orani hep 1 (USD ile ayni) kabul edilir ve gosterilen tutar
 * yanlis olur -- bu yuzden iki liste senkron tutulmali.
 */
window.createCurrencyDisplayModal = function createCurrencyDisplayModal(ctx) {
  const { ref, computed, walletFiat, storageKey, apiUrl } = ctx

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
  function selectDisplayCurrency(currency) {
    currencyDisplayActive.value = currency.code
    try {
      const key = (typeof storageKey === "function" ? storageKey() : storageKey) || "displayCurrency"
      window.localStorage.setItem(key, currency.code)
    } catch (e) {
      /* yut */
    }
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
    formatDisplayFiat,
    openCurrencyDisplayModal,
    closeCurrencyDisplayModal,
    selectDisplayCurrency,
  }
}
