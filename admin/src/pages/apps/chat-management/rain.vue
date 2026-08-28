<script setup>
import chatService from '@/services/chatService'
import { onMounted, ref } from 'vue'
import { VDataTableServer } from 'vuetify/labs/VDataTable'

/**
 * Chat / Rain / Tips → Rain Yönetimi
 * Rain kuralları, site rain başlatma ve geçmiş rain kayıtları.
 */
const settings = ref(null)
const rains = ref([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const alert = ref({ type: 'success', text: '' })

const options = ref({ page: 1, itemsPerPage: 20 })
const filters = ref({ state: null, type: null })

const siteRainDialog = ref(false)
const siteRainAmount = ref(100)

const detailDialog = ref(false)
const detail = ref(null)

const STATE_OPTIONS = [
  { title: 'Bekliyor', value: 'pending' },
  { title: 'Devam ediyor', value: 'running' },
  { title: 'Tamamlandı', value: 'completed' },
]

const TYPE_OPTIONS = [
  { title: 'Site', value: 'site' },
  { title: 'Kullanıcı', value: 'user' },
]

const fetchSettings = async () => {
  try {
    const res = await chatService.getChatSettings()
    settings.value = res.data
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Ayarlar alınamadı.' }
  }
}

const fetchRains = async () => {
  loading.value = true
  try {
    const res = await chatService.getRains({
      page: options.value.page,
      limit: options.value.itemsPerPage,
      state: filters.value.state || undefined,
      type: filters.value.type || undefined,
    })

    rains.value = res.data || []
    total.value = res.pagination?.total || 0
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Rain listesi alınamadı.' }
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    const res = await chatService.updateChatSettings({ rain: settings.value.rain })
    settings.value = res.data
    alert.value = { type: 'success', text: 'Rain ayarları kaydedildi.' }
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Ayarlar kaydedilemedi.' }
  } finally {
    saving.value = false
  }
}

const startSiteRain = async () => {
  try {
    const res = await chatService.createSiteRain({ amount: siteRainAmount.value })
    siteRainDialog.value = false
    alert.value = { type: 'success', text: res.message }
    fetchRains()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Rain başlatılamadı.' }
  }
}

const cancel = async rain => {
  if (!confirm('Bu rain sonlandırılsın mı?')) return
  try {
    const res = await chatService.cancelRain(rain._id)
    alert.value = { type: 'success', text: res.message }
    fetchRains()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'İşlem başarısız.' }
  }
}

const openDetail = async rain => {
  try {
    const res = await chatService.getRainDetail(rain._id)
    detail.value = res.data
    detailDialog.value = true
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Detay alınamadı.' }
  }
}

const formatAmount = value => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format((value || 0) / 1000)
const formatDate = value => (value ? new Date(value).toLocaleString('tr-TR') : '-')

onMounted(() => {
  fetchSettings()
  fetchRains()
})
</script>

<template>
  <section>
    <VAlert
      v-if="alert.text"
      :type="alert.type"
      variant="tonal"
      closable
      class="mb-6"
      @click:close="alert.text = ''"
    >
      {{ alert.text }}
    </VAlert>

    <VRow class="mb-2">
      <VCol
        cols="12"
        md="7"
      >
        <VCard
          v-if="settings"
          title="Rain Kuralları"
        >
          <VCardText>
            <VRow>
              <VCol cols="12">
                <VSwitch
                  v-model="settings.rain.enabled"
                  label="Rain sistemi aktif"
                  color="primary"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.minAmount"
                  type="number"
                  label="Minimum tutar"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.maxAmount"
                  type="number"
                  label="Maksimum tutar"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.durationSeconds"
                  type="number"
                  label="Süre (saniye)"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.maxParticipants"
                  type="number"
                  label="Maksimum katılımcı"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.joinMinLevel"
                  type="number"
                  label="Katılım için min. seviye"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.joinMinWager"
                  type="number"
                  label="Katılım için min. bahis"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.joinMinDepositCount"
                  type="number"
                  label="Min. yatırım adedi"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.accountAgeMinutes"
                  type="number"
                  label="Min. hesap yaşı (dk)"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.rain.hostFeePercent"
                  type="number"
                  label="Host komisyonu (%)"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSwitch
                  v-model="settings.rain.captchaRequired"
                  label="Katılımda captcha iste"
                  color="primary"
                />
              </VCol>

              <VCol cols="12">
                <VDivider class="my-2" />
                <div class="text-subtitle-1 mb-2">
                  Otomatik Site Rain
                </div>
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VSwitch
                  v-model="settings.rain.auto.enabled"
                  label="Otomatik rain"
                  color="primary"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <AppTextField
                  v-model.number="settings.rain.auto.amount"
                  type="number"
                  label="Tutar"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <AppTextField
                  v-model.number="settings.rain.auto.intervalMinutes"
                  type="number"
                  label="Periyot (dakika)"
                />
              </VCol>
            </VRow>
          </VCardText>
          <VCardActions>
            <VBtn
              color="primary"
              :loading="saving"
              @click="saveSettings"
            >
              Kaydet
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="5"
      >
        <VCard title="Site Rain Başlat">
          <VCardText>
            <p class="text-body-2 mb-4">
              Site kasasından anında rain başlatır ve sohbete duyuru düşer.
            </p>
            <VBtn
              color="success"
              prepend-icon="tabler-cloud-rain"
              block
              @click="siteRainDialog = true"
            >
              Rain Başlat
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardTitle class="text-h5">
        Rain Geçmişi
      </VCardTitle>
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="filters.state"
              :items="STATE_OPTIONS"
              label="Durum"
              clearable
              @update:model-value="fetchRains"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="filters.type"
              :items="TYPE_OPTIONS"
              label="Tür"
              clearable
              @update:model-value="fetchRains"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        v-model:options="options"
        :headers="[
          { title: 'Tarih', key: 'createdAt' },
          { title: 'Tür', key: 'type' },
          { title: 'Sahibi', key: 'creator' },
          { title: 'Tutar', key: 'amount' },
          { title: 'Katılımcı', key: 'participantCount' },
          { title: 'Durum', key: 'state' },
          { title: 'İşlem', key: 'actions', sortable: false, align: 'end' },
        ]"
        :items="rains"
        :items-length="total"
        :loading="loading"
        class="text-no-wrap"
        @update:options="fetchRains"
      >
        <template #item.createdAt="{ item }">
          {{ formatDate(item.raw.createdAt) }}
        </template>
        <template #item.creator="{ item }">
          {{ item.raw.creator?.username || 'Site' }}
        </template>
        <template #item.amount="{ item }">
          {{ formatAmount(item.raw.amount) }}
        </template>
        <template #item.state="{ item }">
          <VChip
            size="small"
            :color="item.raw.state === 'completed' ? 'success' : item.raw.state === 'running' ? 'info' : 'secondary'"
          >
            {{ item.raw.state }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <VBtn
            icon
            variant="text"
            size="small"
            @click="openDetail(item.raw)"
          >
            <VIcon icon="tabler-eye" />
          </VBtn>
          <VBtn
            v-if="item.raw.state !== 'completed'"
            icon
            variant="text"
            size="small"
            color="error"
            @click="cancel(item.raw)"
          >
            <VIcon icon="tabler-player-stop" />
          </VBtn>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog
      v-model="siteRainDialog"
      max-width="420"
    >
      <VCard title="Site Rain Başlat">
        <VCardText>
          <AppTextField
            v-model.number="siteRainAmount"
            type="number"
            label="Rain tutarı"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="tonal"
            @click="siteRainDialog = false"
          >
            Vazgeç
          </VBtn>
          <VBtn
            color="primary"
            @click="startSiteRain"
          >
            Başlat
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="detailDialog"
      max-width="640"
    >
      <VCard title="Rain Detayı">
        <VCardText v-if="detail">
          <div class="d-flex justify-space-between mb-2">
            <span>Tutar</span><strong>{{ formatAmount(detail.amount) }}</strong>
          </div>
          <div class="d-flex justify-space-between mb-4">
            <span>Katılımcı</span><strong>{{ detail.participants?.length || 0 }}</strong>
          </div>
          <VDivider class="mb-4" />
          <VList density="compact">
            <VListItem
              v-for="participant in detail.participants || []"
              :key="participant._id"
              :title="participant.user?.username || 'Bilinmiyor'"
            >
              <template #append>
                {{ formatAmount(participant.amount) }}
              </template>
            </VListItem>
          </VList>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="tonal"
            @click="detailDialog = false"
          >
            Kapat
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<route lang="yaml">
meta:
  action: read
  subject: chat
</route>
