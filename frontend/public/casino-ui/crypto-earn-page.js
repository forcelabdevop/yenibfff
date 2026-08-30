/* Crypto & Earn page. Product configuration comes from CasinoContent,
   market prices from CryptoPrice, and loot boxes from the Box catalog. */
window.createCryptoEarnPage = function createCryptoEarnPage(ctx) {
  const { ref, onMounted, currentPage, toastMessage, apiUrl, backendAssetUrl } = ctx
  const isCryptoPage = currentPage === "crypto-and-earn"

  const ceAssets = {
    hero: "assets/ce/hero.png", bfg: "assets/ce/coin-bfg.png", btc: "assets/ce/coin-btc.png",
    eth: "assets/ce/coin-eth.png", bnb: "assets/ce/coin-bnb.png", usdt: "assets/coin-usdt.png",
    shib: "assets/coin-shib.png", boxYellow: "assets/ce/box-yellow.png", boxBlue: "assets/ce/box-blue.png",
    boxRed: "assets/ce/box-red.png",
  }
  const iconMap = { BFG: ceAssets.bfg, BTC: ceAssets.btc, ETH: ceAssets.eth, BNB: ceAssets.bnb, USDT: ceAssets.usdt, SHIB: ceAssets.shib }
  const ceStaking = ref([])
  const ceSwapCoins = ref([])
  const ceFutures = ref([])
  const ceLootboxes = ref([])
  const ceLoading = ref(false)
  const ceError = ref("")
  const ceInfoOpen = ref(2)

  function asset(path, fallback) {
    if (!path) return fallback
    return typeof backendAssetUrl === "function" ? backendAssetUrl(path) : path
  }
  async function ceLoad() {
    if (!isCryptoPage || typeof apiUrl !== "function") return
    ceLoading.value = true
    ceError.value = ""
    try {
      const response = await fetch(apiUrl("/content/crypto/earn"), { credentials: "include", headers: { Accept: "application/json" } })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error?.message || "Crypto Earn could not be loaded")
      const data = payload.data || {}
      const content = data.content || {}
      ceStaking.value = (content["crypto-staking"] || []).map(item => {
        const symbol = String(item.content?.symbol || item.category || "").toUpperCase()
        return { id: item._id, name: item.title, symbol, label: "Est.APR", rate: `${Number(item.rules?.apr || 0)}%`, duration: Number(item.rules?.lockDays || 0) ? `${item.rules.lockDays} Days` : "Flexible", icon: asset(item.image, iconMap[symbol] || "") }
      })
      const swapSymbols = new Set()
      ;(content["crypto-swap"] || []).forEach(item => { swapSymbols.add(item.content?.from); swapSymbols.add(item.content?.to) })
      ceSwapCoins.value = [...swapSymbols].filter(Boolean).map(symbol => ({ type: "img", src: iconMap[symbol] || "", alt: symbol }))
      const wanted = new Set((content["crypto-futures-display"]?.[0]?.content?.symbols || []).map(symbol => String(symbol).replace(/USDT$/i, "").toUpperCase()))
      ceFutures.value = (data.prices || []).filter(item => !wanted.size || wanted.has(String(item.name).replace(/USDT$/i, "").toUpperCase())).map(item => {
        const symbol = String(item.name || "").replace(/USDT$/i, "").toUpperCase()
        return { symbol, price: Number(item.price || 0).toLocaleString("en-US", { maximumFractionDigits: 8 }), icon: iconMap[symbol] || "" }
      })
      ceLootboxes.value = (data.boxes || []).map((box, index) => ({ id: box._id, name: box.name, items: Array.isArray(box.items) ? box.items.length : 0, price: `$${Number(box.amount || 0).toFixed(2)}`, art: index % 3 === 0 ? ceAssets.boxYellow : index % 3 === 1 ? ceAssets.boxBlue : ceAssets.boxRed, isNew: false }))
    } catch (error) {
      ceError.value = error.message || "Crypto Earn could not be loaded"
      ceStaking.value = []; ceSwapCoins.value = []; ceFutures.value = []; ceLootboxes.value = []
    } finally { ceLoading.value = false }
  }
  function ceToggleInfo(index) { ceInfoOpen.value = ceInfoOpen.value === index ? -1 : index }
  function ceSlide(event, direction) {
    const section = event.currentTarget.closest(".ce-section")
    const track = section && section.querySelector(".ce-track")
    if (track) track.scrollBy({ left: direction * 230, behavior: "smooth" })
  }
  function ceNotify(message) { toastMessage(message) }
  if (typeof onMounted === "function") onMounted(ceLoad)
  return { isCryptoPage, ceAssets, ceStaking, ceSwapCoins, ceFutures, ceLootboxes, ceLoading, ceError, ceInfoOpen, ceToggleInfo, ceSlide, ceNotify, ceLoad }
}
