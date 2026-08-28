<script setup>
import chatService from '@/services/chatService'
import { onMounted, ref } from 'vue'
import { VDataTable } from 'vuetify/labs/VDataTable'

/**
 * Chat / Rain / Tips → Genel Bakış
 * Son 24 saat ve 7 günlük sohbet, rain ve bahşiş istatistikleri.
 */
const loading = ref(false)
const stats = ref(null)
const error = ref('')

const fetchStats = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await chatService.getChatStats()
    stats.value = res.data
  } catch (err) {
    error.value = err?.response?.data?.message || 'İstatistikler alınamadı.'
  } finally {
    loading.value = false
  }
}

const formatAmount = value => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format((value || 0) / 1000)

onMounted(fetchStats)
</script>

<template>
  <section>
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h4 class="text-h4 mb-1">
          Chat / Rain / Tips
        </h4>
        <p class="text-body-1 mb-0">
          Sohbet, yağmur ve bahşiş sisteminin genel durumu
        </p>
      </div>
      <VBtn
        variant="tonal"
        prepend-icon="tabler-refresh"
        :loading="loading"
        @click="fetchStats"
      >
        Yenile
      </VBtn>
    </div>

    <VAlert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-6"
    >
      {{ error }}
    </VAlert>

    <VRow class="mb-2">
      <VCol
        v-for="card in [
          { title: 'Bugünkü Mesaj', value: stats?.messagesToday ?? 0, icon: 'tabler-message-2', color: 'primary' },
          { title: '7 Günlük Mesaj', value: stats?.messagesWeek ?? 0, icon: 'tabler-messages', color: 'info' },
          { title: 'Bugün Silinen', value: stats?.deletedToday ?? 0, icon: 'tabler-trash', color: 'error' },
          { title: 'Aktif Susturma', value: stats?.activeMutes ?? 0, icon: 'tabler-microphone-off', color: 'warning' },
        ]"
        :key="card.title"
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              :color="card.color"
              variant="tonal"
              rounded
              size="42"
            >
              <VIcon :icon="card.icon" />
            </VAvatar>
            <div>
              <div class="text-h5">
                {{ card.value }}
              </div>
              <div class="text-body-2">
                {{ card.title }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VRow>
      <VCol
        cols="12"
        md="6"
      >
        <VCard title="Son 7 Gün · Rain">
          <VCardText>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-body-2">Toplam rain</span>
              <strong>{{ stats?.rain?.count ?? 0 }}</strong>
            </div>
            <div class="d-flex justify-space-between">
              <span class="text-body-2">Dağıtılan tutar</span>
              <strong>{{ formatAmount(stats?.rain?.amount) }}</strong>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
      >
        <VCard title="Son 7 Gün · Bahşiş">
          <VCardText>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-body-2">Toplam bahşiş</span>
              <strong>{{ stats?.tips?.count ?? 0 }}</strong>
            </div>
            <div class="d-flex justify-space-between">
              <span class="text-body-2">Gönderilen tutar</span>
              <strong>{{ formatAmount(stats?.tips?.amount) }}</strong>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
      >
        <VCard title="Odalara Göre Mesaj (7 gün)">
          <VDataTable
            :headers="[
              { title: 'Oda', key: '_id' },
              { title: 'Mesaj', key: 'total', align: 'end' },
            ]"
            :items="stats?.perRoom || []"
            :items-per-page="10"
            class="text-no-wrap"
          />
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
      >
        <VCard title="En Aktif Kullanıcılar (7 gün)">
          <VDataTable
            :headers="[
              { title: 'Kullanıcı', key: '_id' },
              { title: 'Mesaj', key: 'total', align: 'end' },
            ]"
            :items="stats?.topChatters || []"
            :items-per-page="10"
            class="text-no-wrap"
          />
        </VCard>
      </VCol>
    </VRow>
  </section>
</template>

<route lang="yaml">
meta:
  action: read
  subject: chat
</route>
