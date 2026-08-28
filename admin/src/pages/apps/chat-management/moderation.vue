<script setup>
import chatService from '@/services/chatService'
import { onMounted, ref } from 'vue'
import { VDataTable } from 'vuetify/labs/VDataTable'

/**
 * Chat / Rain / Tips → Susturma & Yasaklama
 * Kullanıcıları sohbette susturur veya sohbetten yasaklar; aktif cezaları listeler.
 */
const list = ref([])
const loading = ref(false)
const busy = ref(false)
const alert = ref({ type: 'success', text: '' })

const muteForm = ref({ user: '', minutes: 10, reason: '' })
const banForm = ref({ user: '', days: 7, reason: '' })

const fetchList = async () => {
  loading.value = true
  try {
    const res = await chatService.getChatModeration()
    list.value = res.data || []
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Liste alınamadı.' }
  } finally {
    loading.value = false
  }
}

const mute = async () => {
  if (!muteForm.value.user.trim()) return
  busy.value = true
  try {
    const res = await chatService.muteChatUser(muteForm.value)
    alert.value = { type: 'success', text: res.message }
    muteForm.value = { user: '', minutes: 10, reason: '' }
    fetchList()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'İşlem başarısız.' }
  } finally {
    busy.value = false
  }
}

const ban = async () => {
  if (!banForm.value.user.trim()) return
  busy.value = true
  try {
    const res = await chatService.banChatUser(banForm.value)
    alert.value = { type: 'success', text: res.message }
    banForm.value = { user: '', days: 7, reason: '' }
    fetchList()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'İşlem başarısız.' }
  } finally {
    busy.value = false
  }
}

const lift = async (item, kind) => {
  try {
    const res = kind === 'mute'
      ? await chatService.unmuteChatUser(item._id)
      : await chatService.unbanChatUser(item._id)

    alert.value = { type: 'success', text: res.message }
    fetchList()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'İşlem başarısız.' }
  }
}

const isActive = value => value && new Date(value) > new Date()
const formatDate = value => (value ? new Date(value).toLocaleString('tr-TR') : '-')

onMounted(fetchList)
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
        md="6"
      >
        <VCard title="Kullanıcıyı Sustur">
          <VCardText>
            <AppTextField
              v-model="muteForm.user"
              label="Kullanıcı adı veya ID"
              class="mb-4"
            />
            <AppTextField
              v-model.number="muteForm.minutes"
              type="number"
              label="Süre (dakika)"
              class="mb-4"
            />
            <AppTextField
              v-model="muteForm.reason"
              label="Gerekçe"
              class="mb-4"
            />
            <VBtn
              color="warning"
              :loading="busy"
              @click="mute"
            >
              Sustur
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
      >
        <VCard title="Sohbetten Yasakla">
          <VCardText>
            <AppTextField
              v-model="banForm.user"
              label="Kullanıcı adı veya ID"
              class="mb-4"
            />
            <AppTextField
              v-model.number="banForm.days"
              type="number"
              label="Süre (gün)"
              class="mb-4"
            />
            <AppTextField
              v-model="banForm.reason"
              label="Gerekçe"
              class="mb-4"
            />
            <VBtn
              color="error"
              :loading="busy"
              @click="ban"
            >
              Yasakla
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardTitle class="d-flex justify-space-between align-center">
        <span class="text-h5">Aktif Cezalar</span>
        <VBtn
          variant="tonal"
          prepend-icon="tabler-refresh"
          :loading="loading"
          @click="fetchList"
        >
          Yenile
        </VBtn>
      </VCardTitle>

      <VDataTable
        :headers="[
          { title: 'Kullanıcı', key: 'username' },
          { title: 'Susturma Bitiş', key: 'mute' },
          { title: 'Yasak Bitiş', key: 'ban' },
          { title: 'Gerekçe', key: 'reason' },
          { title: 'İşlem', key: 'actions', sortable: false, align: 'end' },
        ]"
        :items="list"
        :loading="loading"
        :items-per-page="25"
        class="text-no-wrap"
      >
        <template #item.username="{ item }">
          <div class="d-flex align-center gap-2">
            <VAvatar
              size="28"
              :image="item.raw.avatar || undefined"
            >
              <span v-if="!item.raw.avatar">{{ (item.raw.username || '?').charAt(0) }}</span>
            </VAvatar>
            <span>{{ item.raw.username }}</span>
          </div>
        </template>

        <template #item.mute="{ item }">
          <VChip
            v-if="isActive(item.raw.mute?.expire)"
            color="warning"
            size="small"
          >
            {{ formatDate(item.raw.mute.expire) }}
          </VChip>
          <span v-else>-</span>
        </template>

        <template #item.ban="{ item }">
          <VChip
            v-if="isActive(item.raw.ban?.expire)"
            color="error"
            size="small"
          >
            {{ formatDate(item.raw.ban.expire) }}
          </VChip>
          <span v-else>-</span>
        </template>

        <template #item.reason="{ item }">
          {{ item.raw.mute?.reason || item.raw.ban?.reason || '-' }}
        </template>

        <template #item.actions="{ item }">
          <VBtn
            v-if="isActive(item.raw.mute?.expire)"
            size="small"
            variant="tonal"
            class="me-2"
            @click="lift(item.raw, 'mute')"
          >
            Susturmayı Kaldır
          </VBtn>
          <VBtn
            v-if="isActive(item.raw.ban?.expire)"
            size="small"
            variant="tonal"
            color="error"
            @click="lift(item.raw, 'ban')"
          >
            Yasağı Kaldır
          </VBtn>
        </template>
      </VDataTable>
    </VCard>
  </section>
</template>

<route lang="yaml">
meta:
  action: read
  subject: chat
</route>
