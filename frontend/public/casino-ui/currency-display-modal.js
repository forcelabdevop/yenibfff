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
 */
window.createCurrencyDisplayModal = function createCurrencyDisplayModal(ctx) {
  const { ref, computed, walletFiat, storageKey } = ctx

  const FIAT_LIST = [
    { code: "USD", name: "US Dollar", flag: "assets/flag-usd.png" },
    { code: "EUR", name: "Euro", flag: "assets/flag-eur.png" },
    { code: "BRL", name: "Brazilian real", flag: "assets/flag-brl.png" },
    { code: "GBP", name: "Pound sterling", flag: "assets/flag-gbp.png" },
    { code: "JPY", name: "Japanese yen", flag: "assets/flag-jpy.png" },
    { code: "PLN", name: "Polish zloty", flag: "assets/flag-pln.png" },
    { code: "TRY", name: "Turkish lira", flag: "assets/flag-try.png" },
  ]

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
    openCurrencyDisplayModal,
    closeCurrencyDisplayModal,
    selectDisplayCurrency,
  }
}
