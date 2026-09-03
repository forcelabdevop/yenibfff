<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from '@/plugins/axios'
import ability from '@/plugins/casl/ability'

/**
 * Toplama (sweep) cuzdani yonetim ekrani.
 *
 * Kullanicilarin TRON adreslerine yatirdigi TRX/USDT, arka plandaki sweep
 * servisi tarafindan otomatik olarak BU sayfada gosterilen tek adrese
 * toplanir. Kullanici bakiyeleri (User.wallets) yalnizca ic muhasebe
 * kaydidir — zincirdeki gercek varlik burada, toplama adresinde durur.
 *
 * Bu ekran:
 *  1) Toplama adresinin CANLI zincir bakiyesini gosterir,
 *  2) Sweep'i manuel tetiklemeyi saglar (normalde arka planda otomatik calisir),
 *  3) Platform DISINA (borsa/kisisel cuzdan) gercek bir zincir cekimi yapar.
 *
 * Cekim islemi GERI ALINAMAZ ve backend'de requireSuperAdmin ile korunur;
 * bu yuzden formu yalnizca super admin gorur.
 */

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const address = ref('')
const balances = ref({ TRX: { formatted: null }, USDT_TRC20: { formatted: null } })
const sweepStats = ref({ pending: 0, gas_sent: 0, completed: 0, failed: 0 })
const recentSweeps = ref([])
const recentWithdrawals = ref([])

const sweeping = ref(false)

const canManage = computed(() => ability.can('manage', 'finance.cryptoWallet'))
const canWithdraw = computed(() => ability.can('manage', 'all'))

const withdrawDialog = ref(false)
const withdrawForm = ref({ currency: 'USDT_TRC20', toAddress: '', amount: '' })
const withdrawSubmitting = ref(false)
const withdrawError = ref('')

const sweepHeaders = [
  { title: 'Tarih', key: 'createdAt' },
  { title: 'Kaynak Adres', key: 'fromAddress', sortable: false },
  { title: 'Tutar', key: 'amount', sortable: false },
  { title: 'Durum', key: 'status' },
  { title: 'İşlem Hash', key: 'txHash', sortable: false },
]

const withdrawHeaders = [
  { title: 'Tarih', key: 'createdAt' },
  { title: 'Admin', key: 'admin', sortable: false },
  { title: 'Alıcı Adres', key: 'toAddress', sortable: false },
  { title: 'Tutar', key: 'amount', sortable: false },
  { title: 'Durum', key: 'status' },
  { title: 'İşlem Hash', key: 'txHash', sortable: false },
]

const statusChipColor = status => {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'gas_sent') return 'info'
  return 'warning'
}

const statusLabel = status => {
  const map = {
    pending: 'Bekliyor',
    gas_sent: 'Gaz Gönderildi',
    completed: 'Tamamlandı',
    failed: 'Başarısız',
  }
  return map[status] || status
}

const formatDate = date => (date ? new Date(date).toLocaleString('tr-TR') : '-')

const shorten = (value, head = 10, tail = 8) => {
  const text = String(value || '')
  if (text.length <= head + tail + 1) return text
  return `${text.slice(0, head)}…${text.slice(-tail)}`
}

const copy = async value => {
  try {
    await navigator.clipboard.writeText(String(value))
  } catch (error) {
    console.error('[v0] kopyalama hatasi:', error)
  }
}

const fetchWallet = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const { data: payload } = await axios.get('/admin/crypto-wallet')

    if (!payload?.success || !payload.data) {
      errorMessage.value = payload?.message || 'Cüzdan bilgisi alınamadı.'
      return
    }

    address.value = payload.data.address
    balances.value = payload.data.balances
    sweepStats.value = payload.data.sweepStats
    recentSweeps.value = payload.data.recentSweeps || []
    recentWithdrawals.value = payload.data.recentWithdrawals || []
  } catch (error) {
    console.error('[v0] kripto cuzdan hatasi:', error)
    errorMessage.value =
      error?.response?.data?.message ||
      (error?.response?.status === 403
        ? 'Bu sayfayı görüntüleme yetkiniz yok.'
        : 'Cüzdan bilgisi alınırken bir hata oluştu.')
  } finally {
    loading.value = false
  }
}

const triggerSweep = async () => {
  try {
    sweeping.value = true
    errorMessage.value = ''
    successMessage.value = ''

    const { data: payload } = await axios.post('/admin/crypto-wallet/sweep-now')

    if (!payload?.success) {
      errorMessage.value = payload?.message || 'Sweep tetiklenemedi.'
      return
    }

    successMessage.value = `Tarama tamamlandı: ${payload.data.queued} adres kuyruğa alındı, ${payload.data.completed} transfer işlendi.`
    await fetchWallet()
  } catch (error) {
    console.error('[v0] sweep tetikleme hatasi:', error)
    errorMessage.value = error?.response?.data?.message || 'Sweep tetiklenirken bir hata oluştu.'
  } finally {
    sweeping.value = false
  }
}

const openWithdrawDialog = () => {
  withdrawForm.value = { currency: 'USDT_TRC20', toAddress: '', amount: '' }
  withdrawError.value = ''
  withdrawDialog.value = true
}

const submitWithdraw = async () => {
  try {
    withdrawSubmitting.value = true
    withdrawError.value = ''

    const { data: payload } = await axios.post('/admin/crypto-wallet/withdraw', {
      currency: withdrawForm.value.currency,
      toAddress: withdrawForm.value.toAddress.trim(),
      amount: withdrawForm.value.amount,
    })

    if (!payload?.success) {
      withdrawError.value = payload?.message || 'Çekim gönderilemedi.'
      return
    }

    successMessage.value = `Çekim gönderildi: ${payload.data.amount} ${payload.data.displayCode} → ${shorten(payload.data.toAddress)}`
    withdrawDialog.value = false
    await fetchWallet()
  } catch (error) {
    console.error('[v0] cekim hatasi:', error)
    withdrawError.value = error?.response?.data?.message || 'Çekim gönderilirken bir hata oluştu.'
  } finally {
    withdrawSubmitting.value = false
  }
}

onMounted(fetchWallet)
</script>

<route lang="yaml">
meta:
  action: read
  subject: finance.cryptoWallet
</route>

<template>
  <div>
    <VAlert v-if="errorMessage" type="error" variant="tonal" class="mb-4" closable @click:close="errorMessage = ''">
      {{ errorMessage }}
    </VAlert>
    <VAlert v-if="successMessage" type="success" variant="tonal" class="mb-4" closable @click:close="successMessage = ''">
      {{ successMessage }}
    </VAlert>

    <VRow class="mb-4">
      <VCol cols="12" md="6">
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar color="primary" size="48" class="me-4">
              <VIcon icon="tabler-currency-bitcoin" color="white" />
            </VAvatar>
            <div>
              <p class="text-body-2 mb-0">TRX Bakiyesi (Toplama Adresi)</p>
              <h4 class="text-h5">{{ balances.TRX?.formatted ?? '—' }} TRX</h4>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" md="6">
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar color="success" size="48" class="me-4">
              <VIcon icon="tabler-currency-dollar" color="white" />
            </VAvatar>
            <div>
              <p class="text-body-2 mb-0">USDT (TRC20) Bakiyesi</p>
              <h4 class="text-h5">{{ balances.USDT_TRC20?.formatted ?? '—' }} USDT</h4>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard class="mb-4">
      <VCardTitle class="d-flex align-center justify-space-between flex-wrap gap-2">
        <span>Toplama Adresi</span>
        <div class="d-flex gap-2">
          <VBtn color="primary" variant="outlined" size="small" :loading="loading" @click="fetchWallet">
            <VIcon icon="tabler-refresh" class="me-1" />
            Yenile
          </VBtn>
          <VBtn
            v-if="canManage"
            color="secondary"
            size="small"
            :loading="sweeping"
            @click="triggerSweep"
          >
            <VIcon icon="tabler-arrows-shuffle" class="me-1" />
            Şimdi Topla (Sweep)
          </VBtn>
          <VBtn
            v-if="canWithdraw"
            color="warning"
            size="small"
            @click="openWithdrawDialog"
          >
            <VIcon icon="tabler-send" class="me-1" />
            Cüzdana Çek
          </VBtn>
        </div>
      </VCardTitle>
      <VCardText>
        <p class="text-sm text-medium-emphasis mb-2">
          Kullanıcıların TRX/USDT yatırdığı kişisel adresler, arka plandaki sweep servisi
          tarafından otomatik olarak aşağıdaki tek adrese toplanır. Sitenin gerçek zincir
          varlığı burada durur. "Cüzdana Çek" ile bu adresten platform dışına (borsa veya
          kişisel cüzdanınıza) gerçek bir zincir transferi yapılır — bu işlem geri alınamaz.
        </p>
        <div class="d-flex align-center gap-2">
          <span class="font-mono">{{ address || '—' }}</span>
          <VBtn
            v-if="address"
            icon="tabler-copy"
            variant="text"
            size="x-small"
            :aria-label="`Adres kopyala: ${address}`"
            @click="copy(address)"
          />
        </div>
        <VRow class="mt-4">
          <VCol cols="6" sm="3">
            <p class="text-caption text-medium-emphasis mb-0">Bekleyen Sweep</p>
            <h6 class="text-h6">{{ sweepStats.pending }}</h6>
          </VCol>
          <VCol cols="6" sm="3">
            <p class="text-caption text-medium-emphasis mb-0">Gaz Gönderildi</p>
            <h6 class="text-h6">{{ sweepStats.gas_sent }}</h6>
          </VCol>
          <VCol cols="6" sm="3">
            <p class="text-caption text-medium-emphasis mb-0">Tamamlanan</p>
            <h6 class="text-h6">{{ sweepStats.completed }}</h6>
          </VCol>
          <VCol cols="6" sm="3">
            <p class="text-caption text-medium-emphasis mb-0">Başarısız</p>
            <h6 class="text-h6">{{ sweepStats.failed }}</h6>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VCard class="mb-4">
      <VCardTitle>Son Toplama (Sweep) İşlemleri</VCardTitle>
      <VCardText>
        <VDataTable
          :headers="sweepHeaders"
          :items="recentSweeps"
          :loading="loading"
          hide-default-footer
          items-per-page="-1"
          no-data-text="Henüz sweep işlemi yok."
        >
          <template #item.createdAt="{ item }">
            {{ formatDate(item.createdAt) }}
          </template>
          <template #item.fromAddress="{ item }">
            <span class="font-mono text-caption" :title="item.fromAddress">
              {{ shorten(item.fromAddress) }}
            </span>
          </template>
          <template #item.amount="{ item }">
            <strong>{{ item.amount }}</strong> {{ item.displayCode }}
          </template>
          <template #item.status="{ item }">
            <VChip :color="statusChipColor(item.status)" size="small">
              {{ statusLabel(item.status) }}
            </VChip>
          </template>
          <template #item.txHash="{ item }">
            <template v-if="item.txHash">
              <span class="font-mono text-caption" :title="item.txHash">
                {{ shorten(item.txHash) }}
              </span>
              <VBtn
                icon="tabler-copy"
                variant="text"
                size="x-small"
                :aria-label="`İşlem hash kopyala: ${item.txHash}`"
                @click="copy(item.txHash)"
              />
            </template>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <VCard>
      <VCardTitle>Platform Dışına Yapılan Çekimler</VCardTitle>
      <VCardText>
        <VDataTable
          :headers="withdrawHeaders"
          :items="recentWithdrawals"
          :loading="loading"
          hide-default-footer
          items-per-page="-1"
          no-data-text="Henüz platform dışına çekim yapılmadı."
        >
          <template #item.createdAt="{ item }">
            {{ formatDate(item.createdAt) }}
          </template>
          <template #item.admin="{ item }">
            {{ item.admin?.username || item.admin?.email || '-' }}
          </template>
          <template #item.toAddress="{ item }">
            <span class="font-mono text-caption" :title="item.toAddress">
              {{ shorten(item.toAddress) }}
            </span>
            <VBtn
              icon="tabler-copy"
              variant="text"
              size="x-small"
              :aria-label="`Adres kopyala: ${item.toAddress}`"
              @click="copy(item.toAddress)"
            />
          </template>
          <template #item.amount="{ item }">
            <strong>{{ item.amount }}</strong> {{ item.displayCode }}
          </template>
          <template #item.status="{ item }">
            <VChip :color="statusChipColor(item.status)" size="small">
              {{ statusLabel(item.status) }}
            </VChip>
          </template>
          <template #item.txHash="{ item }">
            <template v-if="item.txHash">
              <span class="font-mono text-caption" :title="item.txHash">
                {{ shorten(item.txHash) }}
              </span>
              <VBtn
                icon="tabler-copy"
                variant="text"
                size="x-small"
                :aria-label="`İşlem hash kopyala: ${item.txHash}`"
                @click="copy(item.txHash)"
              />
            </template>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <VDialog v-model="withdrawDialog" max-width="480">
      <VCard>
        <VCardTitle>Platform Dışına Kripto Çek</VCardTitle>
        <VCardText>
          <VAlert type="warning" variant="tonal" class="mb-4">
            Bu işlem gerçek bir zincir transferidir ve GERİ ALINAMAZ. Alıcı adresi
            dikkatlice kontrol edin.
          </VAlert>
          <VAlert v-if="withdrawError" type="error" variant="tonal" class="mb-4">
            {{ withdrawError }}
          </VAlert>
          <VSelect
            v-model="withdrawForm.currency"
            :items="[
              { title: 'USDT (TRC20)', value: 'USDT_TRC20' },
              { title: 'TRX', value: 'TRX' },
            ]"
            label="Para Birimi"
            class="mb-4"
          />
          <VTextField
            v-model="withdrawForm.toAddress"
            label="Alıcı TRON Adresi"
            placeholder="T..."
            class="mb-4"
          />
          <VTextField
            v-model="withdrawForm.amount"
            label="Tutar"
            placeholder="Örn: 100.50"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="outlined" @click="withdrawDialog = false">Vazgeç</VBtn>
          <VBtn
            color="warning"
            :loading="withdrawSubmitting"
            :disabled="!withdrawForm.toAddress || !withdrawForm.amount"
            @click="submitWithdraw"
          >
            Çekimi Gönder
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
