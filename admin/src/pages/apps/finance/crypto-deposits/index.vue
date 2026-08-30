<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/plugins/axios'

/**
 * On-chain kripto yatirmalarinin IZLEME ekrani (salt okunur).
 *
 * Manuel onay dugmesi bilincli olarak YOK: yatirmalar zincirde dogrulanip
 * izleyici tarafindan otomatik kredi edilir. Panelden elle kredi vermek
 * zincirde karsiligi olmayan bakiye yaratirdi.
 */

const tab = ref('deposits')

const deposits = ref([])
const addresses = ref([])
const stats = ref({ pending: 0, credited: 0 })
const loading = ref(false)
const errorMessage = ref('')

const depositPage = ref({ page: 1, limit: 20, total: 0, pages: 1 })
const addressPage = ref({ page: 1, limit: 20, total: 0, pages: 1 })

const selectedStatus = ref('')
const search = ref('')

const depositHeaders = [
  { title: 'Tarih', key: 'createdAt' },
  { title: 'Kullanıcı', key: 'user', sortable: false },
  { title: 'Tutar', key: 'amount', sortable: false },
  { title: 'Onay', key: 'confirmations', sortable: false },
  { title: 'Durum', key: 'status' },
  { title: 'İşlem Hash', key: 'txHash', sortable: false },
]

const addressHeaders = [
  { title: 'Oluşturma', key: 'createdAt' },
  { title: 'Kullanıcı', key: 'user', sortable: false },
  { title: 'Para Birimi', key: 'displayCode', sortable: false },
  { title: 'Adres', key: 'address', sortable: false },
  { title: 'Son Tarama', key: 'lastScannedAt' },
]

const fetchDeposits = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const params = { page: depositPage.value.page, limit: depositPage.value.limit }
    if (selectedStatus.value) params.status = selectedStatus.value
    if (search.value) params.search = search.value.trim()

    const { data: payload } = await axios.get('/admin/crypto-deposits', { params })

    if (!payload?.success || !payload.data) {
      // Sessizce bos tablo gostermek, kullaniciya "hic yatirim yok" yalanini
      // soyler. Hatayi acikca belirtiyoruz.
      errorMessage.value = 'Yatırma listesi alınamadı.'
      deposits.value = []
      return
    }

    deposits.value = payload.data.deposits || []
    depositPage.value = payload.data.pagination || depositPage.value
    stats.value = payload.data.stats || { pending: 0, credited: 0 }
  } catch (error) {
    console.error('[v0] kripto yatirma listesi hatasi:', error)
    errorMessage.value =
      error?.response?.status === 403
        ? 'Bu sayfayı görüntüleme yetkiniz yok.'
        : 'Yatırma listesi alınırken bir hata oluştu.'
    deposits.value = []
  } finally {
    loading.value = false
  }
}

const fetchAddresses = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const params = { page: addressPage.value.page, limit: addressPage.value.limit }
    const { data: payload } = await axios.get('/admin/crypto-deposits/addresses', { params })

    if (!payload?.success || !payload.data) {
      errorMessage.value = 'Adres listesi alınamadı.'
      addresses.value = []
      return
    }

    addresses.value = payload.data.addresses || []
    addressPage.value = payload.data.pagination || addressPage.value
  } catch (error) {
    console.error('[v0] kripto adres listesi hatasi:', error)
    errorMessage.value =
      error?.response?.status === 403
        ? 'Bu sayfayı görüntüleme yetkiniz yok.'
        : 'Adres listesi alınırken bir hata oluştu.'
    addresses.value = []
  } finally {
    loading.value = false
  }
}

const applyFilter = () => {
  depositPage.value.page = 1
  fetchDeposits()
}

const clearFilter = () => {
  selectedStatus.value = ''
  search.value = ''
  depositPage.value.page = 1
  fetchDeposits()
}

const onDepositPage = page => {
  depositPage.value.page = page
  fetchDeposits()
}

const onAddressPage = page => {
  addressPage.value.page = page
  fetchAddresses()
}

const onTabChange = value => {
  if (value === 'addresses' && !addresses.value.length) fetchAddresses()
}

const formatDate = date => (date ? new Date(date).toLocaleString('tr-TR') : '-')

/** Uzun hash/adresleri kisaltir; tam degeri tooltip'te tutariz. */
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

onMounted(fetchDeposits)
</script>

<template>
  <div>
    <VRow class="mb-4">
      <VCol cols="12" sm="6" md="3">
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar color="warning" size="48" class="me-4">
              <VIcon icon="mdi-clock-outline" color="white" />
            </VAvatar>
            <div>
              <p class="text-body-2 mb-0">Onay Bekleyen</p>
              <h4 class="text-h5">{{ stats.pending }}</h4>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" sm="6" md="3">
        <VCard>
          <VCardText class="d-flex align-center">
            <VAvatar color="success" size="48" class="me-4">
              <VIcon icon="mdi-check-circle" color="white" />
            </VAvatar>
            <div>
              <p class="text-body-2 mb-0">Bakiyeye Eklenen</p>
              <h4 class="text-h5">{{ stats.credited }}</h4>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between">
        <span>Kripto Yatırmalar</span>
        <VBtn
          color="primary"
          variant="outlined"
          size="small"
          :loading="loading"
          @click="tab === 'deposits' ? fetchDeposits() : fetchAddresses()"
        >
          <VIcon icon="mdi-refresh" class="me-1" />
          Yenile
        </VBtn>
      </VCardTitle>

      <div class="px-4">
        <p class="text-sm text-medium-emphasis my-2">
          Yatırmalar zincir üzerinde doğrulanıp otomatik olarak bakiyeye eklenir.
          Bu ekran yalnızca izleme amaçlıdır; manuel onay veya reddetme yapılamaz.
        </p>
      </div>

      <VTabs v-model="tab" @update:model-value="onTabChange">
        <VTab value="deposits">Yatırmalar</VTab>
        <VTab value="addresses">Kullanıcı Adresleri</VTab>
      </VTabs>

      <VCardText>
        <VAlert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
          {{ errorMessage }}
        </VAlert>

        <VWindow v-model="tab">
          <VWindowItem value="deposits">
            <VRow class="mb-4">
              <VCol cols="12" md="4">
                <VSelect
                  v-model="selectedStatus"
                  :items="[
                    { title: 'Tümü', value: '' },
                    { title: 'Onay Bekleyen', value: 'pending' },
                    { title: 'Bakiyeye Eklenen', value: 'credited' },
                  ]"
                  label="Durum"
                  density="compact"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model="search"
                  label="Adres veya işlem hash"
                  density="compact"
                  clearable
                  @keyup.enter="applyFilter"
                />
              </VCol>
              <VCol cols="12" md="4" class="d-flex align-center gap-2">
                <VBtn color="primary" @click="applyFilter">Filtrele</VBtn>
                <VBtn color="secondary" variant="outlined" @click="clearFilter">Temizle</VBtn>
              </VCol>
            </VRow>

            <VDataTable
              :headers="depositHeaders"
              :items="deposits"
              :loading="loading"
              :items-per-page="depositPage.limit"
              hide-default-footer
              no-data-text="Kayıtlı kripto yatırma bulunmuyor."
            >
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>

              <template #item.user="{ item }">
                <div v-if="item.user">
                  <strong>{{ item.user.username || '-' }}</strong>
                  <br>
                  <small class="text-medium-emphasis">{{ item.user.email || '' }}</small>
                </div>
                <span v-else class="text-medium-emphasis">-</span>
              </template>

              <template #item.amount="{ item }">
                <strong>{{ item.amount }}</strong> {{ item.displayCode }}
                <br>
                <small class="text-medium-emphasis">{{ item.chain }}</small>
              </template>

              <template #item.confirmations="{ item }">
                {{ item.confirmations }}
              </template>

              <template #item.status="{ item }">
                <VChip
                  :color="item.status === 'credited' ? 'success' : 'warning'"
                  size="small"
                >
                  {{ item.status === 'credited' ? 'Bakiyeye Eklendi' : 'Onay Bekliyor' }}
                </VChip>
              </template>

              <template #item.txHash="{ item }">
                <span class="font-mono text-caption" :title="item.txHash">
                  {{ shorten(item.txHash) }}
                </span>
                <VBtn
                  icon="mdi-content-copy"
                  variant="text"
                  size="x-small"
                  :aria-label="`İşlem hash kopyala: ${item.txHash}`"
                  @click="copy(item.txHash)"
                />
              </template>
            </VDataTable>

            <div v-if="depositPage.pages > 1" class="d-flex justify-center mt-4">
              <VPagination
                :model-value="depositPage.page"
                :length="depositPage.pages"
                :total-visible="7"
                @update:model-value="onDepositPage"
              />
            </div>
          </VWindowItem>

          <VWindowItem value="addresses">
            <VDataTable
              :headers="addressHeaders"
              :items="addresses"
              :loading="loading"
              :items-per-page="addressPage.limit"
              hide-default-footer
              no-data-text="Henüz tahsis edilmiş adres yok."
            >
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>

              <template #item.user="{ item }">
                <div v-if="item.user">
                  <strong>{{ item.user.username || '-' }}</strong>
                  <br>
                  <small class="text-medium-emphasis">{{ item.user.email || '' }}</small>
                </div>
                <span v-else class="text-medium-emphasis">-</span>
              </template>

              <template #item.displayCode="{ item }">
                {{ item.displayCode }}
                <br>
                <small class="text-medium-emphasis">{{ item.chain }}</small>
              </template>

              <template #item.address="{ item }">
                <span class="font-mono text-caption" :title="item.address">
                  {{ shorten(item.address) }}
                </span>
                <VBtn
                  icon="mdi-content-copy"
                  variant="text"
                  size="x-small"
                  :aria-label="`Adres kopyala: ${item.address}`"
                  @click="copy(item.address)"
                />
              </template>

              <template #item.lastScannedAt="{ item }">
                {{ formatDate(item.lastScannedAt) }}
              </template>
            </VDataTable>

            <div v-if="addressPage.pages > 1" class="d-flex justify-center mt-4">
              <VPagination
                :model-value="addressPage.page"
                :length="addressPage.pages"
                :total-visible="7"
                @update:model-value="onAddressPage"
              />
            </div>
          </VWindowItem>
        </VWindow>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
