<script setup>
import chatService from '@/services/chatService'
import { computed, onMounted, ref } from 'vue'
import { VDataTable } from 'vuetify/labs/VDataTable'

/**
 * Chat / Rain / Tips → Kelime Filtresi
 * Yasaklı kelimeler eklendiği anda canlı sohbet filtresine yansır.
 */
const phrases = ref([])
const loading = ref(false)
const adding = ref(false)
const newPhrase = ref('')
const search = ref('')
const alert = ref({ type: 'success', text: '' })

const fetchPhrases = async () => {
  loading.value = true
  try {
    const res = await chatService.getChatFilters()
    phrases.value = res.data || []
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Filtre listesi alınamadı.' }
  } finally {
    loading.value = false
  }
}

const addPhrase = async () => {
  const value = newPhrase.value.trim()
  if (!value) return

  adding.value = true
  try {
    await chatService.createChatFilter(value)
    newPhrase.value = ''
    alert.value = { type: 'success', text: 'Kelime filtreye eklendi.' }
    fetchPhrases()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Kelime eklenemedi.' }
  } finally {
    adding.value = false
  }
}

const removePhrase = async item => {
  try {
    await chatService.deleteChatFilter(item._id)
    alert.value = { type: 'success', text: 'Kelime kaldırıldı.' }
    fetchPhrases()
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Kelime kaldırılamadı.' }
  }
}

const filtered = computed(() => phrases.value.filter(item =>
  !search.value || item.phrase.includes(search.value.toLowerCase()),
))

const formatDate = value => (value ? new Date(value).toLocaleString('tr-TR') : '-')

onMounted(fetchPhrases)
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
      <VCardTitle class="text-h5">
        Yasaklı Kelime Filtresi
      </VCardTitle>

      <VCardText>
        <p class="text-body-2 mb-4">
          Listedeki ifadeler sohbet mesajlarında otomatik olarak yıldızlanır.
          Değişiklikler anında aktif olur.
        </p>

        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppTextField
              v-model="newPhrase"
              label="Yeni kelime / ifade"
              placeholder="ör. spamlink"
              @keyup.enter="addPhrase"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
            class="d-flex align-center"
          >
            <VBtn
              color="primary"
              :loading="adding"
              @click="addPhrase"
            >
              Ekle
            </VBtn>
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model="search"
              placeholder="Listede ara"
              prepend-inner-icon="tabler-search"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTable
        :headers="[
          { title: 'Kelime', key: 'phrase' },
          { title: 'Eklenme', key: 'createdAt' },
          { title: 'İşlem', key: 'actions', sortable: false, align: 'end' },
        ]"
        :items="filtered"
        :loading="loading"
        :items-per-page="25"
        class="text-no-wrap"
      >
        <template #item.createdAt="{ item }">
          {{ formatDate(item.raw.createdAt) }}
        </template>
        <template #item.actions="{ item }">
          <VBtn
            icon
            variant="text"
            size="small"
            color="error"
            @click="removePhrase(item.raw)"
          >
            <VIcon icon="tabler-trash" />
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
