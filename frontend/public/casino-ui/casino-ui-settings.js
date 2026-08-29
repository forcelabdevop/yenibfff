/**
 * casino-ui: admin tarafından yönetilen arayüz ayarları.
 *
 * Veri kaynağı: GET <apiBase>/public/casino-ui-settings
 * Yönetim: Admin > CMS Yönetimi > Casino Arayüzü (Footer / Lobi Bileşenleri)
 *
 * Bu modül index.html'in setup() bloğuna küçük bir stub ile bağlanır; büyük
 * satır içi düzenlemeler bu dosyada sessizce geri alınabildiği için mantık
 * kasıtlı olarak burada, ayrı bir dosyada tutulur.
 *
 * Tasarım kararı: istek başarısız olursa (backend kapalı, ağ hatası) hiçbir şey
 * gizlenmez — ayarlar `null` kalır ve şablon mevcut sabit içeriğe geri döner.
 */
window.createCasinoUiSettings = function createCasinoUiSettings(ctx) {
  const { ref, computed, apiUrl, websiteName } = ctx

  const settings = ref(null)

  /** {{websiteName}} yer tutucusunu gerçek site adıyla değiştirir. */
  const fill = value =>
    typeof value === 'string' ? value.split('{{websiteName}}').join(websiteName) : value

  const enabled = (node, fallback = true) =>
    node && typeof node.enabled === 'boolean' ? node.enabled : fallback

  const footer = computed(() => settings.value?.footer || null)

  /** Footer tamamen kapatılabilir; kapalıysa şablon <footer> render etmez. */
  const footerEnabled = computed(() => enabled(footer.value))

  const footerColumns = computed(() => {
    const columns = footer.value?.columns
    if (!Array.isArray(columns) || !columns.length) return null

    return columns
      .filter(column => enabled(column) && column?.title)
      .map(column => ({
        title: fill(column.title),
        links: (column.links || [])
          .filter(link => link?.label)
          .map(link => ({
            label: fill(link.label) + (link.external ? ' ↗' : ''),
            url: link.url || '#',
          })),
      }))
  })

  const contact = computed(() => {
    const node = footer.value?.contact
    if (!node || !enabled(node)) return null

    const domain =
      (node.emailDomain || '').trim() ||
      websiteName.toLowerCase().replace(/[^a-z0-9.-]+/g, '') ||
      'example'

    return {
      title: fill(node.title || 'CONTACT US'),
      items: (node.items || [])
        .filter(item => item?.mailbox)
        .map(item => {
          const address = `${item.mailbox}@${domain}.com`

          return {
            address,
            // Etiket boşsa adresin kendisi gösterilir (mevcut davranış).
            label: item.label ? fill(item.label) : address,
            description: fill(item.description || ''),
          }
        }),
    }
  })

  const legal = computed(() => {
    const node = footer.value?.legal
    if (!node || !enabled(node)) return null

    return {
      ageBadge: node.ageBadge || '',
      licenseBadge: node.licenseBadge || '',
      riskText: fill(node.riskText || ''),
      brandText: fill(node.brandText || ''),
    }
  })

  const partners = computed(() => {
    const list = footer.value?.partners
    if (!Array.isArray(list) || !list.length) return null

    return list
      .filter(partner => partner?.label)
      .map(partner => ({
        label: fill(partner.label),
        url: partner.url || '',
        big: !!partner.big,
      }))
  })

  const socials = computed(() => {
    const list = footer.value?.socials
    if (!Array.isArray(list) || !list.length) return null

    return list
      .filter(social => enabled(social))
      .map(social => ({
        name: fill(social.name || ''),
        variant: social.variant || 'tg',
        icon: social.icon || '',
        text: social.text || '',
        url: social.url || '',
      }))
  })

  const tokenWidgets = computed(() => {
    const node = footer.value?.tokenWidgets
    if (!node || !enabled(node)) return null

    return {
      walletLabel: fill(node.walletLabel || ''),
      rateLabel: fill(node.rateLabel || ''),
    }
  })

  const copyrightText = computed(() => {
    const value = footer.value?.copyright
    return value ? fill(value) : ''
  })

  // Hero oyun seçici
  const hero = computed(() => settings.value?.heroChooser || null)
  const heroEnabled = computed(() => enabled(hero.value))
  const heroBackdropEnabled = computed(() => enabled(hero.value, true) && hero.value?.backdropEnabled !== false)
  const heroTitleText = computed(() => fill(hero.value?.title || ''))
  const heroSubtitleText = computed(() => fill(hero.value?.subtitle || ''))
  const heroButtonText = computed(() => fill(hero.value?.buttonText || ''))

  // Canlı bahis tablosu
  const bets = computed(() => settings.value?.betsTable || null)
  const betsEnabled = computed(() => enabled(bets.value))
  const betsTitleText = computed(() => fill(bets.value?.title || ''))

  /** Admin'de tanımlıysa sekme etiketlerini uygular; yoksa null döner. */
  const betsTabOverrides = computed(() => {
    const tabs = bets.value?.tabs
    if (!Array.isArray(tabs) || !tabs.length) return null

    return tabs.filter(tab => enabled(tab) && tab?.key)
  })

  const betsRowOptions = computed(() => {
    const options = bets.value?.rowCountOptions
    return Array.isArray(options) && options.length ? options : null
  })

  const betsDefaultRowCount = computed(() => bets.value?.defaultRowCount || null)

  async function loadCasinoUiSettings() {
    try {
      const response = await fetch(apiUrl('/public/casino-ui-settings'))
      if (!response.ok) return null

      const payload = await response.json()
      if (payload && payload.data) settings.value = payload.data

      return settings.value
    } catch (error) {
      // Ayarlar okunamazsa sabit içerik gösterilmeye devam eder.
      console.warn('[casino-ui] settings unavailable, using built-in defaults', error)

      return null
    }
  }

  return {
    casinoUiSettings: settings,
    loadCasinoUiSettings,
    footerEnabled,
    footerColumns,
    footerContact: contact,
    footerLegal: legal,
    footerPartners: partners,
    footerSocials: socials,
    footerTokenWidgets: tokenWidgets,
    footerCopyright: copyrightText,
    heroEnabled,
    heroBackdropEnabled,
    heroTitleText,
    heroSubtitleText,
    heroButtonText,
    betsEnabled,
    betsTitleText,
    betsTabOverrides,
    betsRowOptions,
    betsDefaultRowCount,
  }
}
