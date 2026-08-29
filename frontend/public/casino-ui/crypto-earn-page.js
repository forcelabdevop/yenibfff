/* Crypto & Earn sayfasi (route: /crypto-and-earn).
   Veri simdilik STATIK — referans tasarimla birebir. Backend hazir olunca:
     GET /public/staking          -> [{name,symbol,label,rate,duration,icon}]
     GET /public/futures/tickers  -> [{symbol,price,leverage}]
     GET /public/lootboxes        -> [{name,items,price,art,isNew,included:[{icon,label,amount}]}]
   index.html icindeki markup revert tuzagina takilmasin diye mantik burada durur. */
window.createCryptoEarnPage = function createCryptoEarnPage(ctx) {
  const { ref, currentPage, toastMessage } = ctx
  const isCryptoPage = currentPage === "crypto-and-earn"

  const ceAssets = {
    hero: "assets/ce/hero.png",
    bfg: "assets/ce/coin-bfg.png",
    btc: "assets/ce/coin-btc.png",
    eth: "assets/ce/coin-eth.png",
    bnb: "assets/ce/coin-bnb.png",
    usdt: "assets/coin-usdt.png",
    shib: "assets/coin-shib.png",
    boxYellow: "assets/ce/box-yellow.png",
    boxBlue: "assets/ce/box-blue.png",
    boxRed: "assets/ce/box-red.png",
  }

  const ceStaking = [
    { name: "BFG Staking", symbol: "BFG", label: "APY", rate: "39.1%", duration: "Flexible", icon: ceAssets.bfg },
    { name: "Binance Coin", symbol: "BNB", label: "Est.APR", rate: "60%", duration: "365 Days", icon: ceAssets.bnb },
    { name: "Bitcoin", symbol: "BTC", label: "Est.APR", rate: "60%", duration: "365 Days", icon: ceAssets.btc },
    { name: "Ethereum", symbol: "ETH", label: "Est.APR", rate: "60%", duration: "365 Days", icon: ceAssets.eth },
  ]

  const ceSwapCoins = [
    { type: "img", src: ceAssets.bfg, alt: "BFG" },
    { type: "img", src: ceAssets.btc, alt: "BTC" },
    { type: "img", src: ceAssets.usdt, alt: "USDT" },
    { type: "img", src: ceAssets.shib, alt: "SHIB" },
    { type: "img", src: ceAssets.eth, alt: "ETH" },
    { type: "img", src: ceAssets.bnb, alt: "BNB" },
    { type: "glyph", glyph: "$", bg: "#2e75ba" },
  ]

  const ceFutures = [
    { symbol: "BTC", price: "78,167.53", icon: ceAssets.btc },
    { symbol: "ETH", price: "2,451.560", icon: ceAssets.eth },
    { symbol: "BNB", price: "693.1250", icon: ceAssets.bnb },
    { symbol: "XRP", price: "1.392400", kind: "is-xrp" },
    { symbol: "DOGE", price: "0.085090", kind: "is-doge", glyph: "\u00D0" },
  ]

  // NOT: Montserrat'ta XRP'nin ⌁ isareti ve ≋ YOK (tofu kutusu cizilir),
  // bu yuzden XRP inline SVG, digerleri gercek coin gorseli olarak veriliyor.
  const ceLootboxes = [
    { name: "1 BNB", items: 4, price: "$181.88", art: ceAssets.boxYellow, isNew: true },
    { name: "Up to $2K in ETH", items: 4, price: "$130.09", art: ceAssets.boxBlue, isNew: true },
    { name: "10 TRX", items: 2, price: "$0.51", art: ceAssets.boxRed, isNew: true },
    { name: "10,000 TRX", items: 5, price: "$26.12", art: ceAssets.boxRed, isNew: true },
    { name: "$2,000 in ETH", items: 5, price: "$94.77", art: ceAssets.boxBlue, isNew: false },
  ]

  const ceInfoOpen = ref(2)

  function ceToggleInfo(index) {
    ceInfoOpen.value = ceInfoOpen.value === index ? -1 : index
  }
  function ceSlide(event, direction) {
    const track = event.currentTarget.closest(".ce-section").querySelector(".ce-track")
    if (track) track.scrollBy({ left: direction * 230, behavior: "smooth" })
  }
  function ceNotify(message) {
    toastMessage(message)
  }

  return {
    isCryptoPage,
    ceAssets,
    ceStaking,
    ceSwapCoins,
    ceFutures,
    ceLootboxes,
    ceInfoOpen,
    ceToggleInfo,
    ceSlide,
    ceNotify,
  }
}
