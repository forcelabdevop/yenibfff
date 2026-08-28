<script setup>
import chatService from '@/services/chatService'
import { onMounted, ref, watch } from 'vue'
import { VDataTableServer } from 'vuetify/labs/VDataTable'

/**
 * Chat / Rain / Tips → Bahşiş Yönetimi
 * Bahşiş kuralları ve gönderilen bahşişlerin denetim listesi.
 */
const settings = ref(null)
const tips = ref([])
const total = ref(0)
const summary = ref({ totalAmount: 0, totalCount: 0 })
const loading = ref(false)
const saving = ref(false)
const alert = ref({ type: 'success', text: '' })

const options = ref({ page: 1, itemsPerPage: 25 })
const filters = ref({ search: '', minAmount: null })

const fetchSettings = async () => {
  try {
    const res = await chatService.getChatSettings()
    settings.value = res.data
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Ayarlar alınamadı.' }
  }
}

const fetchTips = async () => {
  loading.value = true
  try {
    const res = await chatService.getTips({
      page: options.value.page,
      limit: options.value.itemsPerPage,
      search: filters.value.search || undefined,
      minAmount: filters.value.minAmount || undefined,
    })

    tips.value = res.data || []
    total.value = res.pagination?.total || 0
    summary.value = res.summary || { totalAmount: 0, totalCount: 0 }
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Bahşiş listesi alınamadı.' }
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    const res = await chatService.updateChatSettings({ tip: settings.value.tip })
    settings.value = res.data
    alert.value = { type: 'success', text: 'Bahşiş ayarları kaydedildi.' }
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Ayarlar kaydedilemedi.' }
  } finally {
    saving.value = false
  }
}

const formatAmount = value => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format((value || 0) / 1000)
const formatDate = value => (value ? new Date(value).toLocaleString('tr-TR') : '-')

watch(filters, () => {
  options.value.page = 1
  fetchTips()
}, { deep: true })

onMounted(() => {
  fetchSettings()
  fetchTips()
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

    <VCard
      v-if="settings"
      title="Bahşiş Kuralları"
      class="mb-6"
    >
      <VCardText>
        <VRow>
          <VCol cols="12">
            <VSwitch
              v-model="settings.tip.enabled"
              label="Bahşiş sistemi aktif"
              color="primary"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="settings.tip.minAmount"
              type="number"
              label="Minimum tutar"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="settings.tip.maxAmount"
              type="number"
              label="Maksimum tutar"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="settings.tip.feePercent"
              type="number"
              label="Komisyon (%)"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="settings.tip.cooldownSeconds"
              type="number"
              label="Bekleme süresi (sn)"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="settings.tip.minLevelToTip"
              type="number"
              label="Minimum seviye"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="settings.tip.minWagerToTip"
              type="number"
              label="Minimum bahis"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="settings.tip.dailyLimit"
              type="number"
              label="Günlük limit (0 = sınırsız)"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <VSwitch
              v-model="settings.tip.announceInChat"
              label="Sohbette duyur"
              color="primary"
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

    <VCard>
      <VCardTitle class="d-flex justify-space-between align-center flex-wrap gap-2">
        <span class="text-h5">Bahşiş Geçmişi</span>
        <div class="d-flex gap-4">
          <VChip color="primary">
            Toplam: {{ formatAmount(summary.totalAmount) }}
          </VChip>
          <VChip color="secondary">
            Adet: {{ summary.totalCount }}
          </VChip>
        </div>
      </VCardTitle>

      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="4"
          >
            <AppTextField
              v-model="filters.search"
              placeholder="Gönderen / alan kullanıcı ara"
              prepend-inner-icon="tabler-search"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model.number="filters.minAmount"
              type="number"
              label="Minimum tutar"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        v-model:options="options"
        :headers="[
          { title: 'Tarih', key: 'createdAt' },
          { title: 'Gönderen', key: 'sender' },
          { title: 'Alan', key: 'receiver' },
          { title: 'Tutar', key: 'amount' },
          { title: 'Durum', key: 'state' },
        ]"
        :items="tips"
        :items-length="total"
        :loading="loading"
        class="text-no-wrap"
        @update:options="fetchTips"
      >
        <template #item.createdAt="{ item }">
          {{ formatDate(item.raw.createdAt) }}
        </template>
        <template #item.sender="{ item }">
          {{ item.raw.sender?.user?.username || '-' }}
        </template>
        <template #item.receiver="{ item }">
          {{ item.raw.receiver?.user?.username || '-' }}
        </template>
        <template #item.amount="{ item }">
          {{ formatAmount(item.raw.amount) }}
        </template>
        <template #item.state="{ item }">
          <VChip
            size="small"
            :color="item.raw.state === 'completed' ? 'success' : 'secondary'"
          >
            {{ item.raw.state || 'completed' }}
          </VChip>
        </template>
      </VDataTableServer>
    </VCard>
  </section>
</template>

<route lang="yaml">
meta:
  action: read
  subject: chat
</route>
