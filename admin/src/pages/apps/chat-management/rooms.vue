<script setup>
import chatService from '@/services/chatService'
import { onMounted, ref } from 'vue'
import { VDataTable } from 'vuetify/labs/VDataTable'

/**
 * Chat / Rain / Tips → Odalar
 * Sohbet odalarının oluşturulması, düzenlenmesi ve kaldırılması.
 */
const rooms = ref([])
const loading = ref(false)
const saving = ref(false)
const isDialogOpen = ref(false)
const alert = ref({ type: 'success', text: '' })

const emptyRoom = () => ({
  _id: null,
  key: '',
  name: '',
  description: '',
  language: 'tr',
  flag: '🌐',
  order: 0,
  enabled: true,
  locked: false,
  minLevel: 0,
  minWager: 0,
  vipOnly: false,
})

const form = ref(emptyRoom())

const fetchRooms = async () => {
  loading.value = true
  try {
    const res = await chatService.getChatRooms()
    rooms.value = res.data || []
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Odalar alınamadı.' }
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  form.value = emptyRoom()
  isDialogOpen.value = true
}

const openEdit = room => {
  form.value = { ...room }
  isDialogOpen.value = true
}

const save = async () => {
  saving.value = true
  try {
    if (form.value._id)
      await chatService.updateChatRoom(form.value._id, form.value)
    else
      await chatService.createChatRoom(form.value)

    isDialogOpen.value = false
    alert.value = { type: 'success', text: 'Oda kaydedildi.' }
    fetchRooms()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Oda kaydedilemedi.' }
  } finally {
    saving.value = false
  }
}

const remove = async room => {
  if (!confirm(`"${room.name}" odası silinsin mi?`)) return
  try {
    await chatService.deleteChatRoom(room._id)
    alert.value = { type: 'success', text: 'Oda silindi.' }
    fetchRooms()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Oda silinemedi.' }
  }
}

onMounted(fetchRooms)
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
      <VCardTitle class="d-flex justify-space-between align-center">
        <span class="text-h5">Sohbet Odaları</span>
        <VBtn
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreate"
        >
          Yeni Oda
        </VBtn>
      </VCardTitle>

      <VDataTable
        :headers="[
          { title: 'Oda', key: 'name' },
          { title: 'Anahtar', key: 'key' },
          { title: 'Dil', key: 'language' },
          { title: 'Min. Seviye', key: 'minLevel' },
          { title: 'Mesaj', key: 'messageCount' },
          { title: 'Durum', key: 'enabled' },
          { title: 'İşlemler', key: 'actions', sortable: false, align: 'end' },
        ]"
        :items="rooms"
        :loading="loading"
        class="text-no-wrap"
      >
        <template #item.name="{ item }">
          <span class="me-2">{{ item.raw.flag }}</span>{{ item.raw.name }}
        </template>

        <template #item.enabled="{ item }">
          <VChip
            :color="item.raw.enabled ? 'success' : 'secondary'"
            size="small"
          >
            {{ item.raw.enabled ? 'Aktif' : 'Kapalı' }}
          </VChip>
          <VChip
            v-if="item.raw.vipOnly"
            color="warning"
            size="small"
            class="ms-2"
          >
            VIP
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <VBtn
            icon
            variant="text"
            size="small"
            @click="openEdit(item.raw)"
          >
            <VIcon icon="tabler-pencil" />
          </VBtn>
          <VBtn
            icon
            variant="text"
            size="small"
            color="error"
            @click="remove(item.raw)"
          >
            <VIcon icon="tabler-trash" />
          </VBtn>
        </template>
      </VDataTable>
    </VCard>

    <VDialog
      v-model="isDialogOpen"
      max-width="620"
    >
      <VCard :title="form._id ? 'Odayı Düzenle' : 'Yeni Oda'">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.name"
                label="Oda adı"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.key"
                label="Anahtar (ör. tr, en, vip)"
                :disabled="!!form._id"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.description"
                label="Açıklama"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.language"
                label="Dil kodu"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model.number="form.order"
                type="number"
                label="Sıra"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model.number="form.minLevel"
                type="number"
                label="Minimum seviye"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.flag"
                label="Bayrak / ikon"
                placeholder="🇹🇷"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model.number="form.minWager"
                type="number"
                label="Minimum bahis"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <VSwitch
                v-model="form.enabled"
                label="Aktif"
                color="primary"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <VSwitch
                v-model="form.vipOnly"
                label="Sadece VIP"
                color="primary"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <VSwitch
                v-model="form.locked"
                label="Kilitli (yazma kapalı)"
                color="primary"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="tonal"
            @click="isDialogOpen = false"
          >
            Vazgeç
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            @click="save"
          >
            Kaydet
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
