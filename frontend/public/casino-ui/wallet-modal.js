/**
 * Cuzdan modali (Wallet / Crypto Swap / Deposit) mantigi.
 * casino-ui/index.html icindeki Vue setup() fonksiyonundan cagrilir.
 *
 * Cuzdan verileri ve islemleri canli backend API'lerinden gelir:
 *
 *  1) GET /wallet/currencies
 *     -> { success, data: [{ code, name, icon, network, networks[], balance,
 *                            minDeposit, precision, fiat:boolean }] }
 *     Kaynak: backend/database/models/Wallet.js + GameProvider bagimsiz.
 *     DIKKAT: `icon` alani BACKEND'DEN gelmeli. Simdilik mock, dosya adini
 *     kendisi uretiyor (assets/coin-<code>.png). Backend baglanirken ya ayni
 *     isimlendirmeyi kullanin ya da `icon` alanini mutlaka doldurun.
 *
 *  2) GET /crypto/deposit/address?currency=USDT   [CANLI]
 *     -> { success, data: { address, qr, currency, chain, network, decimals,
 *                           minDeposit, confirmationsRequired } }
 *     Kaynak: backend/routes/crypto/deposit.js (kendi HD cuzdanimiz).
 *     Adres kullanici + para birimi basina KALICIDIR; her cagrida ayni adres
 *     doner (Stake modeli). `network` parametresi GONDERILMEZ — zincir para
 *     biriminin kendi tanimindan gelir.
 *     `qr` sunucuda uretilen bir data-URI'dir; adres ucuncu parti bir QR
 *     servisine gonderilmez.
 *
 *  3) GET /wallet/quote?from=USD&to=BTC&amount=100&kind=buy|swap
 *     -> { success, data: { rate, receive, provider, methods:[
 *            { id, kind:'credit'|'debit', label, receive, best:boolean,
 *              recommended:boolean } ] } }
 *     Mock sabit kur kullaniyor. Gercekte saglayici (Moonpay vb.) fiyat
 *     servisinden gelir ve TTL'i vardir — kullaniciya gosterilen tutar
 *     onaylanirken sunucuda YENIDEN dogrulanmali.
 *
 *  4) POST /wallet/swap   body: { from, to, amount }
 *     -> { success, data:{ balances } } | { success:false, message }
 *     Bakiye degistirdigi icin ATOMIK olmali (bkz. account/vault transferi:
 *     mongoose session + withTransaction). Idempotency key onerilir.
 *
 *  5) POST /wallet/buy    body: { fiat, crypto, amount, methodId }
 *     -> { success, data:{ redirectUrl } }
 *     Odeme saglayicisina yonlendirme; tutari ASLA istemciden guvenmeyin,
 *     sunucuda yeniden hesaplayin.
 *
 * Ayrica bkz. /MOCK-BACKEND.md (bolum 8).
 * ============================================================================
 */
window.createWalletModal = function createWalletModal(ctx) {
  const { ref, computed, watch, apiUrl, authUser, readAuthToken, requestAuth, toastMessage } = ctx

  // null | 'wallet' | 'swap' | 'deposit'
  const walletView = ref(null)
  const depositTab = ref("crypto") // crypto | cash | buy
  const walletDropdown = ref(null) // hangi dropdown acik
  const walletLoading = ref(false)
  const walletError = ref("")

  const currencies = ref([])
  const depositAddress = ref(null)
  const addressLoading = ref(false)
  const depositAddressError = ref("")
  // Gec gelen adres yanitlarinin yeni secimi ezmesini onleyen istek sayaci.
  let depositAddressRequestId = 0

  // Secimler
  const depositCurrency = ref(null)
  const depositNetwork = ref(null)
  const cashCurrency = ref(null)
  const cashAmount = ref("")

  // Buy Crypto
  const buyFiat = ref(null)
  const buyCrypto = ref(null)
  const buyAmount = ref("100")
  const buyQuote = ref(null)
  const buyAgree = ref(false)
  const buyMethod = ref(null)
  const buyBusy = ref(false)

  // Swap
  const swapFrom = ref(null)
  const swapTo = ref(null)
  const swapAmount = ref("")
  const swapAgree = ref(false)
  const swapBusy = ref(false)

  const walletIsOpen = computed(() => walletView.value !== null)

  const cryptoCurrencies = computed(() => currencies.value.filter((c) => !c.fiat))
  const fiatCurrencies = computed(() => currencies.value.filter((c) => c.fiat))

  /**
   * Yatirma ekraninda sunulabilecek para birimleri.
   *
   * Rivo gibi ic bakiye birimlerinin zincir uzerinde adresi YOKTUR; listede
   * birakilirlarsa varsayilan secim onlara duser ve kullanici yatirma adresi
   * yerine "Desteklenmeyen para birimi" hatasi gorur.
   *
   * Backend `depositable` gondermiyorsa (eski surum) listeyi bosaltmamak icin
   * tum kriptolara geri duseriz.
   */
  const depositCurrencies = computed(() => {
    const list = cryptoCurrencies.value
    const flagged = list.filter((c) => c.depositable)
    return flagged.length ? flagged : list
  })

  /** Yetkili istek yardimcisi — account-pages.js ile ayni desen. */
  async function walletFetch(path, options) {
    const token = readAuthToken()
    const response = await fetch(apiUrl(path), {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...((options && options.headers) || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || "Istek basarisiz oldu.")
    }
    return payload.data
  }

  function coinIcon(currency) {
    if (!currency) return "assets/coin-usdt.png"
    // Backend `icon` gonderirse onu kullan; yoksa dosya adini koddan uret.
    // Backend baglanirken bu fallback'i kaldirmak icin `icon` alanini doldurun.
    return currency.icon || "assets/coin-" + String(currency.code).toLowerCase() + ".png"
  }

  function findCurrency(code) {
    return currencies.value.find((c) => c.code === code) || null
  }

  function formatAmount(value, precision) {
    const num = Number(value)
    if (!Number.isFinite(num)) return "0"
    return num.toFixed(precision == null ? 8 : precision).replace(/\.?0+$/, "")
  }

  /** Kullanicinin secili para biriminin bakiyesi (etikette gosterilir). */
  function balanceOf(currency) {
    if (!currency) return "0"
    return formatAmount(currency.balance, currency.precision) + " " + currency.code
  }

  const networkOptions = computed(() => {
    const cur = depositCurrency.value
    if (!cur || !Array.isArray(cur.networks)) return []
    return cur.networks
  })

  const buyReceive = computed(() => {
    if (!buyQuote.value) return "0"
    return buyQuote.value.receive
  })

  const buyMethods = computed(() => (buyQuote.value && buyQuote.value.methods) || [])

  const selectedBuyMethod = computed(
    () => buyMethods.value.find((m) => m.id === buyMethod.value) || buyMethods.value[0] || null,
  )

  const swapRateLabel = computed(() => {
    if (!swapFrom.value || !swapTo.value) return ""
    return "1 " + swapFrom.value.code + " ≈ " + formatAmount(swapRate.value, 8) + " " + swapTo.value.code
  })

  const swapRate = computed(() => {
    const from = swapFrom.value
    const to = swapTo.value
    if (!from || !to || !from.usd || !to.usd) return 0
    return from.usd / to.usd
  })

  const swapReceive = computed(() => {
    const amount = Number(swapAmount.value)
    if (!Number.isFinite(amount) || amount <= 0 || !swapRate.value) return ""
    return formatAmount(amount * swapRate.value, 8)
  })

  /** Deposit sekmesine gore modal yuksekligi (referans tasarim olculeri). */
  const depositModalClass = computed(() => ({
    "wm-modal--deposit-crypto": depositTab.value === "crypto",
    "wm-modal--deposit-cash": depositTab.value === "cash",
    "wm-modal--deposit-buy": depositTab.value === "buy",
  }))

  async function loadCurrencies() {
    if (currencies.value.length) return
    walletLoading.value = true
    walletError.value = ""
    try {
      const data = await walletFetch("/wallet/currencies")
      currencies.value = Array.isArray(data) ? data : []
      const crypto = cryptoCurrencies.value
      const fiat = fiatCurrencies.value
      // Liste yenilendiginde secili ref'ler eski nesnelere bakiyor; kodla yeniden
      // bagla, aksi halde takas sonrasi bakiyeler ekranda guncellenmez.
      const resync = (target) => {
        if (!target.value) return
        const fresh = currencies.value.find((c) => c.code === target.value.code)
        if (fresh) target.value = fresh
      }
      ;[depositCurrency, cashCurrency, buyFiat, buyCrypto, swapFrom, swapTo].forEach(resync)
      if (depositNetwork.value && depositCurrency.value) {
        const freshNetwork = (depositCurrency.value.networks || []).find(
          (n) => n.id === depositNetwork.value.id,
        )
        if (freshNetwork) depositNetwork.value = freshNetwork
      }
      // Yatirma varsayilani YATIRILABILIR listeden secilmeli; aksi halde
      // varsayilan Rivo'ya duser ve adres alinamaz.
      if (!depositCurrency.value || !depositCurrencies.value.includes(depositCurrency.value)) {
        depositCurrency.value = depositCurrencies.value[0] || null
      }
      if (!depositNetwork.value && depositCurrency.value) {
        depositNetwork.value = (depositCurrency.value.networks || [])[0] || null
      }
      if (!cashCurrency.value) cashCurrency.value = fiat[0] || null
      if (!buyFiat.value) buyFiat.value = fiat[0] || null
      if (!buyCrypto.value) buyCrypto.value = crypto.find((c) => c.code === "BTC") || crypto[0] || null
      if (!swapFrom.value) swapFrom.value = crypto[0] || null
      if (!swapTo.value) swapTo.value = crypto[1] || crypto[0] || null
    } catch (error) {
      walletError.value = error.message || "Cuzdan bilgileri yuklenemedi."
    } finally {
      walletLoading.value = false
    }
  }

  /**
   * Kullanicinin kalici yatirma adresini alir.
   *
   * Adres kullanici + para birimi basina SABITTIR; her cagrida ayni adres
   * doner. Bu yuzden ag (network) parametresi gonderilmez: zincir zaten para
   * biriminin kendi tanimindan gelir.
   */
  async function loadDepositAddress() {
    const cur = depositCurrency.value
    if (!cur) return

    // Istek sirasi korumasi: kullanici hizlica para birimi degistirirse geç
    // gelen eski yanit, yeni secimin adresinin uzerine YAZMAMALI. Yanlis
    // adres gosterimi paranin kaybi demektir.
    const requestId = ++depositAddressRequestId
    const requestedCode = cur.code

    addressLoading.value = true
    depositAddressError.value = ""
    try {
      const data = await walletFetch("/crypto/deposit/address?currency=" + encodeURIComponent(cur.code))
      if (requestId !== depositAddressRequestId) return
      depositAddress.value = data
    } catch (error) {
      if (requestId !== depositAddressRequestId) return
      depositAddress.value = null
      // Hata yatirma bolumunde gosterilir; genel cuzdan hatasini ezmez.
      depositAddressError.value =
        error.message || requestedCode + " yatirma adresi alinamadi."
    } finally {
      if (requestId === depositAddressRequestId) addressLoading.value = false
    }
  }

  async function loadBuyQuote() {
    const fiat = buyFiat.value
    const crypto = buyCrypto.value
    const amount = Number(buyAmount.value)
    if (!fiat || !crypto || !Number.isFinite(amount) || amount <= 0) {
      buyQuote.value = null
      return
    }
    try {
      buyQuote.value = await walletFetch(
        "/wallet/quote?kind=buy&from=" + fiat.code + "&to=" + crypto.code + "&amount=" + amount,
      )
      if (!buyMethod.value && buyQuote.value.methods && buyQuote.value.methods.length) {
        const recommended = buyQuote.value.methods.find((m) => m.recommended)
        buyMethod.value = (recommended || buyQuote.value.methods[0]).id
      }
    } catch (error) {
      buyQuote.value = null
    }
  }

  /** Cuzdan modalini acar. Oturum yoksa giris modalini acar. */
  function openWallet(view) {
    if (!authUser.value) {
      requestAuth("login")
      return
    }
    walletView.value = view || "wallet"
    walletDropdown.value = null
    loadCurrencies()
  }

  function openDeposit(tab) {
    depositTab.value = tab || "crypto"
    walletView.value = "deposit"
    walletDropdown.value = null
    loadCurrencies().then(() => {
      if (depositTab.value === "crypto") loadDepositAddress()
      if (depositTab.value === "buy") loadBuyQuote()
    })
  }

  function closeWallet() {
    walletView.value = null
    walletDropdown.value = null
  }

  function toggleWalletDropdown(name) {
    walletDropdown.value = walletDropdown.value === name ? null : name
  }

  function selectDepositCurrency(currency) {
    depositCurrency.value = currency
    depositNetwork.value = (currency.networks || [])[0] || null
    walletDropdown.value = null
    loadDepositAddress()
  }

  function selectDepositNetwork(network) {
    depositNetwork.value = network
    walletDropdown.value = null
    loadDepositAddress()
  }

  function selectCashCurrency(currency) {
    cashCurrency.value = currency
    walletDropdown.value = null
  }

  function selectBuyFiat(currency) {
    buyFiat.value = currency
    walletDropdown.value = null
    loadBuyQuote()
  }

  function selectBuyCrypto(currency) {
    buyCrypto.value = currency
    walletDropdown.value = null
    loadBuyQuote()
  }

  function selectSwapFrom(currency) {
    swapFrom.value = currency
    walletDropdown.value = null
  }

  function selectSwapTo(currency) {
    swapTo.value = currency
    walletDropdown.value = null
  }

  function swapDirection() {
    const from = swapFrom.value
    swapFrom.value = swapTo.value
    swapTo.value = from
  }

  function swapMax() {
    if (swapFrom.value) swapAmount.value = String(swapFrom.value.balance || 0)
  }

  function cashMax() {
    if (cashCurrency.value) cashAmount.value = String(cashCurrency.value.balance || 0)
  }

  async function copyDepositAddress() {
    const address = depositAddress.value && depositAddress.value.address
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
    } catch (error) {
      /* clipboard izni yoksa sessizce gec */
    }
    toastMessage("Yatirma adresi kopyalandi")
  }

  async function submitSwap() {
    if (!swapAgree.value) {
      toastMessage("Devam etmek icin sartlari onaylayin")
      return
    }
    const amount = Number(swapAmount.value)
    if (!Number.isFinite(amount) || amount <= 0) {
      toastMessage("Gecerli bir tutar girin")
      return
    }
    swapBusy.value = true
    try {
      await walletFetch("/wallet/swap", {
        method: "POST",
        body: JSON.stringify({ from: swapFrom.value.code, to: swapTo.value.code, amount }),
      })
      toastMessage("Takas tamamlandi")
      swapAmount.value = ""
      currencies.value = []
      await loadCurrencies()
    } catch (error) {
      toastMessage(error.message || "Takas basarisiz oldu")
    } finally {
      swapBusy.value = false
    }
  }

  async function submitBuy() {
    if (!buyAgree.value) {
      toastMessage("Devam etmek icin bilgilendirmeyi onaylayin")
      return
    }
    buyBusy.value = true
    try {
      const data = await walletFetch("/wallet/buy", {
        method: "POST",
        body: JSON.stringify({
          fiat: buyFiat.value.code,
          crypto: buyCrypto.value.code,
          amount: Number(buyAmount.value),
          methodId: buyMethod.value,
        }),
      })
      // Gercek entegrasyonda saglayiciya yonlendirilir.
      toastMessage(data && data.redirectUrl ? "Odeme sayfasi aciliyor" : "Odeme talebi olusturuldu")
    } catch (error) {
      toastMessage(error.message || "Odeme baslatilamadi")
    } finally {
      buyBusy.value = false
    }
  }

  // Sekme degisince acik dropdown'i kapat ve o sekmenin verisini yukle.
  watch(depositTab, (tab) => {
    walletDropdown.value = null
    if (tab === "crypto") loadDepositAddress()
    if (tab === "buy") loadBuyQuote()
  })

  watch(buyAmount, () => loadBuyQuote())

  return {
    walletView,
    walletIsOpen,
    depositTab,
    walletDropdown,
    walletLoading,
    walletError,
    currencies,
    cryptoCurrencies,
    fiatCurrencies,
    depositCurrency,
    depositNetwork,
    networkOptions,
    depositAddress,
    depositCurrencies,
    addressLoading,
    depositAddressError,
    loadDepositAddress,
    cashCurrency,
    cashAmount,
    buyFiat,
    buyCrypto,
    buyAmount,
    buyQuote,
    buyReceive,
    buyMethods,
    buyMethod,
    selectedBuyMethod,
    buyAgree,
    buyBusy,
    swapFrom,
    swapTo,
    swapAmount,
    swapAgree,
    swapBusy,
    swapReceive,
    swapRateLabel,
    depositModalClass,
    coinIcon,
    balanceOf,
    formatAmount,
    findCurrency,
    openWallet,
    openDeposit,
    closeWallet,
    toggleWalletDropdown,
    selectDepositCurrency,
    selectDepositNetwork,
    selectCashCurrency,
    selectBuyFiat,
    selectBuyCrypto,
    selectSwapFrom,
    selectSwapTo,
    swapDirection,
    swapMax,
    cashMax,
    copyDepositAddress,
    submitSwap,
    submitBuy,
  }
}
