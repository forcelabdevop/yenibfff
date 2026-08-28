<script setup>
import chatService from '@/services/chatService'
import { onMounted, ref } from 'vue'

/**
 * Chat / Rain / Tips → Sohbet Ayarları
 * Genel sohbet davranışı, sabit (pinned) mesaj ve sohbet kuralları.
 */
const loading = ref(false)
const saving = ref(false)
const alert = ref({ type: 'success', text: '' })

const settings = ref(null)
const rooms = ref([])
const rulesText = ref('')

const MODE_OPTIONS = [
  { title: 'Normal', value: 'normal' },
  { title: 'Yavaş Mod', value: 'slow' },
  { title: 'Sadece VIP', value: 'vipOnly' },
  { title: 'Salt Okunur', value: 'readonly' },
]

const fetchSettings = async () => {
  loading.value = true
  try {
    const res = await chatService.getChatSettings()
    settings.value = res.data
    rooms.value = res.rooms || []
    rulesText.value = (res.data?.rules?.items || []).join('\n')
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Ayarlar alınamadı.' }
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!settings.value) return
  saving.value = true
  try {
    const payload = {
      chat: settings.value.chat,
      pinned: settings.value.pinned,
      rules: {
        ...settings.value.rules,
        items: rulesText.value.split('\n').map(line => line.trim()).filter(Boolean),
      },
    }

    const res = await chatService.updateChatSettings(payload)
    settings.value = res.data
    rulesText.value = (res.data?.rules?.items || []).join('\n')
    alert.value = { type: 'success', text: 'Ayarlar kaydedildi ve canlı sohbete uygulandı.' }
  } catch (err) {
    alert.value = { type: 'error', text: err?.response?.data?.message || 'Ayarlar kaydedilemedi.' }
  } finally {
    saving.value = false
  }
}

onMounted(fetchSettings)
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

    <VRow v-if="settings">
      <VCol
        cols="12"
        md="7"
      >
        <VCard
          title="Genel Sohbet Ayarları"
          class="mb-6"
        >
          <VCardText>
            <VRow>
              <VCol cols="12">
                <VSwitch
                  v-model="settings.chat.enabled"
                  label="Sohbet aktif"
                  color="primary"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppSelect
                  v-model="settings.chat.mode"
                  :items="MODE_OPTIONS"
                  label="Sohbet Modu"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.chat.slowSeconds"
                  type="number"
                  label="Yavaş mod bekleme (sn)"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.chat.cooldownSeconds"
                  type="number"
                  label="Mesaj bekleme süresi (sn)"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.chat.maxMessageLength"
                  type="number"
                  label="Maksimum karakter"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.chat.historySize"
                  type="number"
                  label="Geçmişte tutulan mesaj"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.chat.minXpToChat"
                  type="number"
                  label="Yazmak için minimum XP"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.chat.minLevelToChat"
                  type="number"
                  label="Minimum seviye"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model.number="settings.chat.maxEmojiPerMessage"
                  type="number"
                  label="Mesaj başına emoji limiti"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSwitch
                  v-model="settings.chat.blockLinks"
                  label="Link paylaşımını engelle"
                  color="primary"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSwitch
                  v-model="settings.chat.blockCaps"
                  label="Tamamı büyük harfi engelle"
                  color="primary"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSwitch
                  v-model="settings.chat.emojiEnabled"
                  label="Emoji seçici açık"
                  color="primary"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSwitch
                  v-model="settings.chat.repliesEnabled"
                  label="Mesaja yanıt verme açık"
                  color="primary"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSwitch
                  v-model="settings.chat.showLevelRing"
                  label="Avatarda seviye halkası"
                  color="primary"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <VCard title="Sohbet Kuralları">
          <VCardText>
            <AppTextField
              v-model="settings.rules.title"
              label="Başlık"
              class="mb-4"
            />
            <AppTextarea
              v-model="rulesText"
              label="Kurallar (her satır bir madde)"
              rows="7"
              class="mb-4"
            />
            <AppTextarea
              v-model="settings.rules.footer"
              label="Alt not"
              rows="2"
            />
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="5"
      >
        <VCard
          title="Sabit Mesaj (Pinned)"
          class="mb-6"
        >
          <VCardText>
            <VSwitch
              v-model="settings.pinned.enabled"
              label="Sabit mesajı göster"
              color="primary"
              class="mb-4"
            />
            <AppTextarea
              v-model="settings.pinned.text"
              label="Mesaj metni"
              rows="3"
              class="mb-4"
            />
            <AppTextField
              v-model="settings.pinned.linkLabel"
              label="Buton metni (opsiyonel)"
              class="mb-4"
            />
            <AppTextField
              v-model="settings.pinned.linkUrl"
              label="Buton linki (opsiyonel)"
              class="mb-4"
            />
            <AppSelect
              v-model="settings.pinned.rooms"
              :items="rooms.map(room => ({ title: room.name, value: room.key }))"
              label="Gösterilecek odalar (boş = tümü)"
              multiple
              chips
            />
          </VCardText>
        </VCard>

        <VCard title="Kaydet">
          <VCardText>
            <p class="text-body-2 mb-4">
              Değişiklikler kaydedildiği anda canlı sohbete uygulanır; kullanıcıların
              sayfayı yenilemesine gerek yoktur.
            </p>
            <VBtn
              color="primary"
              block
              :loading="saving"
              @click="save"
            >
              Ayarları Kaydet
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard v-else>
      <VCardText class="text-center py-10">
        <VProgressCircular
          v-if="loading"
          indeterminate
          color="primary"
        />
        <span v-else>Ayarlar yüklenemedi.</span>
      </VCardText>
    </VCard>
  </section>
</template>

<route lang="yaml">
meta:
  action: read
  subject: chat
</route>
