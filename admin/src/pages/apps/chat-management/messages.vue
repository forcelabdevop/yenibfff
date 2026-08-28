<script setup>
import chatService from '@/services/chatService'
import { onMounted, ref, watch } from 'vue'
import { VDataTableServer } from 'vuetify/labs/VDataTable'

/**
 * Chat / Rain / Tips → Mesaj Moderasyonu
 * Mesaj geçmişi, arama, silme, oda temizleme ve sistem duyurusu.
 */
const messages = ref([])
const rooms = ref([])
const total = ref(0)
const loading = ref(false)
const alert = ref({ type: 'success', text: '' })

const options = ref({ page: 1, itemsPerPage: 25 })
const filters = ref({ search: '', room: null, type: null, deleted: null })

const systemDialog = ref(false)
const systemForm = ref({ message: '', room: null })
const sending = ref(false)

const TYPE_OPTIONS = [
  { title: 'Kullanıcı', value: 'user' },
  { title: 'Sistem', value: 'system' },
  { title: 'Rain', value: 'rain' },
  { title: 'Bahşiş', value: 'tip' },
]

const DELETED_OPTIONS = [
  { title: 'Sadece görünenler', value: 'false' },
  { title: 'Sadece silinenler', value: 'true' },
]

const fetchRooms = async () => {
  try {
    const res = await chatService.getChatRooms()
    rooms.value = (res.data || []).map(room => ({ title: room.name, value: room.key }))
  } catch {
    rooms.value = []
  }
}

const fetchMessages = async () => {
  loading.value = true
  try {
    const res = await chatService.getChatMessages({
      page: options.value.page,
      limit: options.value.itemsPerPage,
      search: filters.value.search || undefined,
      room: filters.value.room || undefined,
      type: filters.value.type || undefined,
      deleted: filters.value.deleted || undefined,
    })

    messages.value = res.data || []
    total.value = res.pagination?.total || 0
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Mesajlar alınamadı.' }
  } finally {
    loading.value = false
  }
}

const removeMessage = async message => {
  const reason = prompt('Silme gerekçesi (opsiyonel):') ?? ''
  try {
    await chatService.deleteChatMessage(message._id, reason)
    alert.value = { type: 'success', text: 'Mesaj silindi ve canlı sohbetten kaldırıldı.' }
    fetchMessages()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Mesaj silinemedi.' }
  }
}

const clearRoom = async () => {
  if (!filters.value.room) {
    alert.value = { type: 'warning', text: 'Önce temizlenecek odayı seçin.' }
    return
  }
  if (!confirm(`"${filters.value.room}" odasındaki tüm mesajlar silinsin mi?`)) return

  try {
    await chatService.clearChatRoom(filters.value.room)
    alert.value = { type: 'success', text: 'Oda temizlendi.' }
    fetchMessages()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Oda temizlenemedi.' }
  }
}

const sendSystem = async () => {
  if (!systemForm.value.message.trim()) return
  sending.value = true
  try {
    await chatService.sendSystemMessage({
      message: systemForm.value.message.trim(),
      room: systemForm.value.room || undefined,
    })
    systemDialog.value = false
    systemForm.value = { message: '', room: null }
    alert.value = { type: 'success', text: 'Sistem mesajı sohbete gönderildi.' }
    fetchMessages()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Mesaj gönderilemedi.' }
  } finally {
    sending.value = false
  }
}

const formatDate = value => (value ? new Date(value).toLocaleString('tr-TR') : '-')

watch(filters, () => {
  options.value.page = 1
  fetchMessages()
}, { deep: true })

onMounted(() => {
  fetchRooms()
  fetchMessages()
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

    <VCard>
      <VCardTitle class="d-flex justify-space-between align-center flex-wrap gap-4">
        <span class="text-h5">Mesaj Moderasyonu</span>
        <div class="d-flex gap-3">
          <VBtn
            variant="tonal"
            color="error"
            prepend-icon="tabler-eraser"
            @click="clearRoom"
          >
            Odayı Temizle
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="tabler-speakerphone"
            @click="systemDialog = true"
          >
            Sistem Mesajı
          </VBtn>
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
              placeholder="Mesaj veya kullanıcı ara"
              prepend-inner-icon="tabler-search"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppSelect
              v-model="filters.room"
              :items="rooms"
              label="Oda"
              clearable
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
            />
          </VCol>
          <VCol
            cols="12"
            md="2"
          >
            <AppSelect
              v-model="filters.deleted"
              :items="DELETED_OPTIONS"
              label="Durum"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        v-model:options="options"
        :headers="[
          { title: 'Tarih', key: 'createdAt' },
          { title: 'Oda', key: 'room' },
          { title: 'Kullanıcı', key: 'username' },
          { title: 'Mesaj', key: 'message' },
          { title: 'Tür', key: 'type' },
          { title: 'İşlem', key: 'actions', sortable: false, align: 'end' },
        ]"
        :items="messages"
        :items-length="total"
        :loading="loading"
        class="text-no-wrap"
        @update:options="fetchMessages"
      >
        <template #item.createdAt="{ item }">
          {{ formatDate(item.raw.createdAt) }}
        </template>

        <template #item.username="{ item }">
          <div class="d-flex align-center gap-2">
            <VAvatar
              size="28"
              :image="item.raw.avatar || undefined"
            >
              <span v-if="!item.raw.avatar">{{ (item.raw.username || '?').charAt(0) }}</span>
            </VAvatar>
            <span>{{ item.raw.username || 'Sistem' }}</span>
          </div>
        </template>

        <template #item.message="{ item }">
          <span :class="item.raw.deleted ? 'text-decoration-line-through text-disabled' : ''">
            {{ item.raw.message }}
          </span>
        </template>

        <template #item.type="{ item }">
          <VChip
            size="small"
            :color="item.raw.type === 'system' ? 'info' : item.raw.type === 'rain' ? 'success' : 'secondary'"
          >
            {{ item.raw.type }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <VBtn
            v-if="!item.raw.deleted"
            icon
            variant="text"
            size="small"
            color="error"
            @click="removeMessage(item.raw)"
          >
            <VIcon icon="tabler-trash" />
          </VBtn>
          <VTooltip
            v-else
            :text="item.raw.deletedReason || 'Silindi'"
          >
            <template #activator="{ props }">
              <VIcon
                v-bind="props"
                icon="tabler-info-circle"
                size="20"
                class="text-disabled"
              />
            </template>
          </VTooltip>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog
      v-model="systemDialog"
      max-width="520"
    >
      <VCard title="Sistem Mesajı Gönder">
        <VCardText>
          <AppSelect
            v-model="systemForm.room"
            :items="rooms"
            label="Oda (boş = tüm odalar)"
            clearable
            class="mb-4"
          />
          <AppTextarea
            v-model="systemForm.message"
            label="Mesaj"
            rows="3"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="tonal"
            @click="systemDialog = false"
          >
            Vazgeç
          </VBtn>
          <VBtn
            color="primary"
            :loading="sending"
            @click="sendSystem"
          >
            Gönder
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
