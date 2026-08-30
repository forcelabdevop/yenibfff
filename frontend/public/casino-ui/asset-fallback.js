/*
 * asset-fallback.js
 *
 * Bir gorsel yuklenemediginde tarayicinin varsayilan davranisi "kirik ikon + alt
 * metni" basmaktir. Canli sitede bu, sayfanin ortasinda duz yazi olarak
 * "Soccer ball" / "Dice" gorunmesine yol aciyordu.
 *
 * Bu modul capture fazinda global bir 'error' dinleyicisi kurar ve basarisiz her
 * <img>'i temaya uygun notr bir yer tutucuyla degistirir. Boylece bir asset
 * eksik/erisilemez oldugunda arayuz bozulmus gibi gorunmez, sadece sessizce
 * daha sade olur.
 *
 * Neden ayri dosya: index.html icine buyuk inline eklemeler bu projede birkac
 * kez geri alindi (bkz. game-detail.js / account-pages.js deseni).
 */
(function () {
  'use strict'

  // Basarisiz gorseli isaretleyen oznitelik; ayni img icin tekrar tekrar
  // calismayi (ve olasi sonsuz dongulari) engeller.
  var MARK = 'data-asset-fallback'

  // Temaya uygun, tamamen yerel (agdan bagimsiz) yer tutucu.
  // Kasitli olarak cok sade: kirik ikonun dikkat cekmesindense gorunmez olsun.
  var PLACEHOLDER =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        '<rect width="64" height="64" rx="12" fill="rgba(255,255,255,0.05)"/>' +
        '<path d="M20 40l7-9 5 6 4-5 8 8z" fill="rgba(255,255,255,0.16)"/>' +
        '<circle cx="24.5" cy="24.5" r="3.5" fill="rgba(255,255,255,0.16)"/>' +
      '</svg>'
    )

  function handle(img) {
    if (!img || img.tagName !== 'IMG') return
    if (img.hasAttribute(MARK)) return

    img.setAttribute(MARK, '')

    // Konsola tek satirlik iz birak; hangi asset'in dustugunu tespit etmek
    // icin canli sitede tek ihtiyacimiz olan sey bu.
    try {
      console.warn('[asset-fallback] yuklenemedi:', img.getAttribute('src'))
    } catch (e) {}

    // alt metnini bosalt: yer tutucu zaten gorsel olarak durumu anlatiyor,
    // aksi halde "Soccer ball" yazisi ekranda duz metin olarak kalir.
    img.setAttribute('alt', '')
    img.src = PLACEHOLDER
  }

  // 'error' olayi baloncuklanmaz; capture fazinda dinlemek zorunlu.
  document.addEventListener(
    'error',
    function (event) {
      handle(event.target)
    },
    true
  )

  // Dinleyici baglanmadan once yuklenmeyi bitirmis gorseller icin tek seferlik
  // tarama (script defer/async ile geldiginde bu mumkun).
  function sweep() {
    var imgs = document.images
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i]
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
        handle(img)
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sweep)
  } else {
    sweep()
  }
  window.addEventListener('load', sweep)
})()
