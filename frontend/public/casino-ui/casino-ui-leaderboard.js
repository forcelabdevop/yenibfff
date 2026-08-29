/**
 * casino-ui: leaderboard çekmecesinin veri katmanı.
 *
 * Veri kaynağı: GET <apiBase>/public/leaderboard?category=&period=&page=
 * Yönetim: Admin > Leaderboard (kategori + ay/yıl alanları)
 *
 * casino-ui-settings.js ile aynı desen: mantık ayrı bir dosyada tutulur, çünkü
 * index.html içindeki büyük satır içi düzenlemeler sessizce geri alınabiliyor.
 *
 * Tasarım kararı: istek başarısız olursa (backend kapalı, ağ hatası) tablo
 * boşalmaz — aşağıdaki sabit liste gösterilmeye devam eder.
 */
window.createCasinoUiLeaderboard = function createCasinoUiLeaderboard(ctx) {
  const { ref, computed, watch, apiUrl } = ctx

  // Backend erişilemezse gösterilen orijinal içerik.
  const DEFAULT_LEADERS = [
    { place: 1, badge: 'assets/leaderboard/badge-1.png', image: 'av-1.png', name: 'CircleKing', wager: '$12,018,592.29' },
    { place: 2, badge: 'assets/leaderboard/badge-2.png', image: 'av-2.png', name: 'Alolnnda', wager: '$8,381,919.85' },
    { place: 3, badge: 'assets/leaderboard/badge-3.png', image: 'raccoon', name: 'User2037358', wager: '$8,260,119.43' },
    { place: 4, image: 'raccoon', name: 'Mattosdias', wager: '$5,890,886.99' },
    { place: 5, image: 'av-3.png', name: 'User8353646', wager: '$4,955,739.66' },
    { place: 6, image: 'raccoon', name: 'Loochoomus', wager: '$4,779,211.61' },
    { place: 7, image: 'av-4.png', name: 'sa619', wager: '$4,699,422.63' },
    { place: 8, image: 'av-5.png', name: 'Michel74', wager: '$4,325,511.94' },
    { place: 9, image: 'av-6.png', name: 'Mia', wager: '$4,279,952.76' },
    { place: 10, image: 'raccoon', name: 'User8476234', wager: '$4,132,633.76' },
  ]

  const DEFAULT_MONTHS = ['August', 'July', 'June']
  const FALLBACK_AVATAR = 'assets/user-avatar-raccoon.png'

  const leaderCategories = [
    { name: 'General', icon: '\u265F', value: 'general' },
    { name: 'Casino', icon: '\u2B55', value: 'casino' },
    { name: 'Sport', icon: '\u26BD', value: 'sport' },
  ]

  const leaderCategory = ref('General')
  const leaderMonth = ref(DEFAULT_MONTHS[0])
  const leaderMonthMenu = ref(false)
  const leaderPage = ref(1)

  // API'den gelen veri; null ise sabit içerik gösterilir.
  const payload = ref(null)
  const loading = ref(false)

  /** Sunucudan gelen dönemler: [{ key, label, month, year }] */
  const periods = computed(() =>
    Array.isArray(payload.value?.periods) ? payload.value.periods : [],
  )

  const leaderMonths = computed(() => {
    const labels = periods.value.map(period => period.label).filter(Boolean)

    // Aynı ay farklı yıllarda tekrar edebilir; menüde bir kez görünsün.
    const unique = [...new Set(labels)]

    return unique.length ? unique : DEFAULT_MONTHS
  })

  const currentCategory = computed(() => {
    const match = leaderCategories.find(cat => cat.name === leaderCategory.value)

    return match ? match.value : 'general'
  })

  /** Seçili ay etiketinin karşılık geldiği dönem anahtarı (ör. "2026-8"). */
  const currentPeriodKey = computed(() => {
    const match = periods.value.find(period => period.label === leaderMonth.value)

    return match ? match.key : ''
  })

  /** Milli-unit tutarı $12,018,592.29 biçimine çevirir. */
  const formatWager = amount => {
    const value = Number(amount || 0) / 1000

    return '$' + value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  /** Şablon tek bir hazır src bekler; hem yerel hem uzak avatarı karşılar. */
  const avatarSrc = row => {
    if (row.avatar) {
      return /^(?:https?:|data:|blob:)/i.test(row.avatar)
        ? row.avatar
        : apiUrl(row.avatar)
    }

    if (!row.image || row.image === 'raccoon') return FALLBACK_AVATAR

    return 'assets/leaderboard/' + row.image
  }

  const decorate = row => ({
    ...row,
    // İlk üç sıra rozet alır; sonrası sıra numarasını gösterir.
    badge: row.badge || (row.place <= 3 ? 'assets/leaderboard/badge-' + row.place + '.png' : null),
    avatarSrc: avatarSrc(row),
  })

  const leaders = computed(() => {
    const rows = payload.value?.rows

    if (!Array.isArray(rows) || !rows.length) return DEFAULT_LEADERS.map(decorate)

    return rows.map(row => decorate({
      place: row.place,
      name: row.name || 'Unknown',
      avatar: row.avatar || null,
      wager: formatWager(row.wager),
    }))
  })

  /** Gerçek veri gösteriliyor mu? (sabit içerik yerine) */
  const leaderLive = computed(() => Boolean(payload.value?.rows?.length))

  const leaderPages = computed(() => {
    const count = payload.value?.pageCount

    if (!count || count < 2) return leaderLive.value ? [1] : [1, 2, 3, 10]

    // Uzun listelerde ilk sayfalar + son sayfa gösterilir.
    const pages = []
    for (let page = 1; page <= Math.min(count, 3); page += 1) pages.push(page)
    if (count > 3) pages.push(count)

    return pages
  })

  const leaderPageCount = computed(() => payload.value?.pageCount || 1)

  async function loadLeaderboard() {
    if (loading.value) return null
    loading.value = true

    try {
      const params = new URLSearchParams({
        category: currentCategory.value,
        page: String(leaderPage.value),
        limit: '10',
      })

      if (currentPeriodKey.value) params.set('period', currentPeriodKey.value)

      const response = await fetch(apiUrl('/public/leaderboard?' + params.toString()))
      if (!response.ok) return null

      const body = await response.json()
      if (!body || !body.data) return null

      payload.value = body.data

      // İlk yüklemede sunucunun seçtiği dönemi menüye yansıt.
      const active = body.data.leaderboard?.period?.label
      if (active && !currentPeriodKey.value) leaderMonth.value = active

      return payload.value
    } catch (error) {
      // Sıralama okunamazsa sabit liste gösterilmeye devam eder.
      console.warn('[casino-ui] leaderboard unavailable, using built-in defaults', error)

      return null
    } finally {
      loading.value = false
    }
  }

  // Kategori veya ay değişince ilk sayfaya dönüp yeniden yükle.
  watch([currentCategory, leaderMonth], () => {
    leaderPage.value = 1
    loadLeaderboard()
  })

  watch(leaderPage, () => loadLeaderboard())

  const setLeaderPage = page => {
    const target = Math.min(Math.max(Number(page) || 1, 1), leaderPageCount.value)

    leaderPage.value = target
  }

  const stepLeaderPage = delta => setLeaderPage(leaderPage.value + delta)

  return {
    leaders,
    leaderLive,
    leaderCategory,
    leaderCategories,
    leaderMonth,
    leaderMonths,
    leaderMonthMenu,
    leaderPage,
    leaderPages,
    leaderPageCount,
    setLeaderPage,
    stepLeaderPage,
    loadLeaderboard,
  }
}
