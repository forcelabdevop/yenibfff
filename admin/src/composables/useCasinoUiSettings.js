import axios from '@/plugins/axios'
import { ref } from 'vue'

/**
 * Casino arayüzü (casino-ui) ayarlarını yönetir.
 *
 * Okuma/yazma mevcut, yetki kontrollü uçlar üzerinden yapılır:
 *   GET  /admin/site-settings  -> platform.read
 *   PUT  /admin/site-settings  -> platform.update
 *
 * Kaydederken yalnızca `casinoUi` bloğu gönderilir; backend'deki PUT
 * `Object.assign` yaptığı için diğer site ayarları etkilenmez.
 *
 * Metin alanlarında {{websiteName}} yer tutucusu kullanılabilir; casino-ui
 * bunu çalışma anında site adıyla değiştirir.
 */

const clone = value => JSON.parse(JSON.stringify(value ?? null))

/**
 * Boş bir kurulumda ya da eski bir kayıtta alanlar eksik gelebilir.
 * Sayfaların her zaman düzenlenebilir bir yapı görmesi için iskeleti garanti ediyoruz.
 */
const withShape = casinoUi => {
  const source = casinoUi || {}
  const footer = source.footer || {}
  const heroChooser = source.heroChooser || {}
  const betsTable = source.betsTable || {}

  return {
    footer: {
      enabled: footer.enabled !== false,
      columns: (footer.columns || []).map(column => ({
        title: column?.title || '',
        order: column?.order ?? 0,
        enabled: column?.enabled !== false,
        links: (column?.links || []).map(link => ({
          label: link?.label || '',
          url: link?.url || '#',
          external: !!link?.external,
          order: link?.order ?? 0,
        })),
      })),
      contact: {
        enabled: footer.contact?.enabled !== false,
        title: footer.contact?.title || 'CONTACT US',
        emailDomain: footer.contact?.emailDomain || '',
        items: (footer.contact?.items || []).map(item => ({
          label: item?.label || '',
          mailbox: item?.mailbox || '',
          description: item?.description || '',
          order: item?.order ?? 0,
        })),
      },
      legal: {
        enabled: footer.legal?.enabled !== false,
        ageBadge: footer.legal?.ageBadge || '',
        licenseBadge: footer.legal?.licenseBadge || '',
        riskText: footer.legal?.riskText || '',
        brandText: footer.legal?.brandText || '',
      },
      partners: (footer.partners || []).map(partner => ({
        label: partner?.label || '',
        url: partner?.url || '',
        big: !!partner?.big,
        order: partner?.order ?? 0,
      })),
      socials: (footer.socials || []).map(social => ({
        name: social?.name || '',
        variant: social?.variant || 'tg',
        icon: social?.icon || '',
        text: social?.text || '',
        url: social?.url || '',
        enabled: social?.enabled !== false,
        order: social?.order ?? 0,
      })),
      tokenWidgets: {
        enabled: footer.tokenWidgets?.enabled !== false,
        walletLabel: footer.tokenWidgets?.walletLabel || '',
        rateLabel: footer.tokenWidgets?.rateLabel || '',
      },
      copyright: footer.copyright || '',
    },
    heroChooser: {
      enabled: heroChooser.enabled !== false,
      title: heroChooser.title || '',
      subtitle: heroChooser.subtitle || '',
      buttonText: heroChooser.buttonText || '',
      backdropEnabled: heroChooser.backdropEnabled !== false,
    },
    betsTable: {
      enabled: betsTable.enabled !== false,
      title: betsTable.title || '',
      defaultRowCount: betsTable.defaultRowCount || 10,
      rowCountOptions: betsTable.rowCountOptions?.length
        ? [...betsTable.rowCountOptions]
        : [10, 20, 50],
      tabs: (betsTable.tabs || []).map(tab => ({
        key: tab?.key || '',
        label: tab?.label || '',
        enabled: tab?.enabled !== false,
        order: tab?.order ?? 0,
      })),
    },
  }
}

export function useCasinoUiSettings() {
  const casinoUi = ref(withShape(null))
  const loading = ref(false)
  const saving = ref(false)
  const alert = ref({ type: 'success', text: '' })

  /** Kaydedilmemiş değişiklik uyarısı için son kaydedilen hali tutar. */
  const savedSnapshot = ref('')

  const isDirty = () => JSON.stringify(casinoUi.value) !== savedSnapshot.value

  const apply = data => {
    casinoUi.value = withShape(data)
    savedSnapshot.value = JSON.stringify(casinoUi.value)
  }

  const load = async () => {
    loading.value = true
    try {
      const response = await axios.get('/admin/site-settings')

      apply(response.data?.casinoUi)
    } catch (error) {
      alert.value = {
        type: 'error',
        text:
          error?.response?.data?.error ||
          'Casino arayüz ayarları yüklenemedi. Yetkinizi ve bağlantınızı kontrol edin.',
      }
    } finally {
      loading.value = false
    }
  }

  const save = async successText => {
    saving.value = true
    try {
      // Sıralama alanlarını listedeki güncel konuma göre normalize et.
      const payload = clone(casinoUi.value)

      payload.footer.columns.forEach((column, index) => {
        column.order = index
        column.links.forEach((link, linkIndex) => {
          link.order = linkIndex
        })
      })
      payload.footer.contact.items.forEach((item, index) => {
        item.order = index
      })
      payload.footer.partners.forEach((partner, index) => {
        partner.order = index
      })
      payload.footer.socials.forEach((social, index) => {
        social.order = index
      })
      payload.betsTable.tabs.forEach((tab, index) => {
        tab.order = index
      })

      const response = await axios.put('/admin/site-settings', { casinoUi: payload })

      apply(response.data?.settings?.casinoUi ?? payload)
      alert.value = {
        type: 'success',
        text: successText || 'Ayarlar kaydedildi ve siteye uygulandı.',
      }
    } catch (error) {
      alert.value = {
        type: 'error',
        text: error?.response?.data?.error || 'Ayarlar kaydedilemedi.',
      }
    } finally {
      saving.value = false
    }
  }

  return { casinoUi, loading, saving, alert, load, save, isDirty }
}
