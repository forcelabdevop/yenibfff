<script setup>
import axios from '@/plugins/axios'
import { useCasinoUiSettings } from '@/composables/useCasinoUiSettings'
import { computed, onMounted, ref } from 'vue'

/**
 * CMS Yönetimi → Casino Arayüzü → Giriş Modalı
 *
 * Sitenin giriş / kayıt modalının (auth-dialog) sol tanıtım panelini yönetir:
 * tanıtım görseli, hoş geldin başlıkları, yasal metin ve hızlı giriş
 * butonlarının görünürlüğü. Görsel buradan yüklenir; kaydedilen URL
 * casinoUi.authModal.image alanında tutulur.
 */
const { casinoUi, loading, saving, alert, load, save, isDirty } = useCasinoUiSettings()

const BASE_URL = import.meta.env.VITE_API_BASE_URL

const authModal = computed(() => casinoUi.value.authModal)

const previewSrc = computed(() => {
  const image = authModal.value.image
  if (!image) return ''

  return image.startsWith('/') ? `${BASE_URL}${image}` : image
})

const uploading = ref(false)

const onImageSelected = async event => {
  const file = event?.target?.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await axios.post('/admin/site-settings/casino-ui-image', formData)
    authModal.value.image = response.data?.url || authModal.value.image
    alert.value = {
      type: 'success',
      text: 'Görsel yüklendi. Değişikliği kalıcı yapmak için Kaydet\'e basın.',
    }
  } catch (error) {
    alert.value = {
      type: 'error',
      text: error?.response?.data?.error || 'Görsel yüklenemedi.',
    }
  } finally {
    uploading.value = false
    if (event?.target) event.target.value = ''
  }
}

const clearImage = () => {
  authModal.value.image = ''
}

onMounted(load)
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

    <VCard class="mb-6">
      <VCardText class="d-flex flex-wrap align-center gap-4">
        <div class="flex-grow-1">
          <h5 class="text-h5 mb-1">
            Giriş Modalı
          </h5>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Giriş / kayıt penceresinin sol tanıtım paneli. Metin alanlarında
            <code v-pre>{{websiteName}}</code> yazarsanız site adıyla değiştirilir.
          </p>
        </div>

        <VChip
          v-if="isDirty()"
          color="warning"
          variant="tonal"
          size="small"
        >
          Kaydedilmemiş değişiklik
        </VChip>

        <VSwitch
          v-model="authModal.enabled"
          label="Tanıtım paneli aktif"
          hide-details
          density="compact"
        />

        <VBtn
          :loading="saving"
          :disabled="loading"
          prepend-icon="tabler-device-floppy"
          @click="save('Giriş modalı ayarları kaydedildi.')"
        >
          Kaydet
        </VBtn>
      </VCardText>

      <VProgressLinear
        v-if="loading"
        indeterminate
        color="primary"
      />
    </VCard>

    <VRow>
      <!-- Tanıtım görseli -->
      <VCol
        cols="12"
        md="5"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Tanıtım Görseli</VCardTitle>
            <VCardSubtitle>
              Modalın sol tarafında görünen maskot / kampanya görseli. PNG (şeffaf) önerilir.
            </VCardSubtitle>
          </VCardItem>

          <VCardText>
            <div class="auth-preview mb-4">
              <VImg
                v-if="previewSrc"
                :src="previewSrc"
                max-height="220"
                contain
              />
              <div
                v-else
                class="auth-preview__empty text-medium-emphasis"
              >
                <VIcon
                  icon="tabler-photo"
                  size="40"
                />
                <span class="text-body-2 mt-2">Henüz görsel yüklenmedi</span>
              </div>
            </div>

            <VFileInput
              label="Görsel yükle"
              accept="image/*"
              prepend-icon="tabler-camera"
              density="compact"
              :loading="uploading"
              hide-details
              class="mb-3"
              @change="onImageSelected"
            />

            <VBtn
              v-if="authModal.image"
              size="small"
              variant="tonal"
              color="error"
              prepend-icon="tabler-trash"
              @click="clearImage"
            >
              Görseli kaldır
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Metinler -->
      <VCol
        cols="12"
        md="7"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Tanıtım Metinleri</VCardTitle>
            <VCardSubtitle>Sol panelde görselin altında görünen hoş geldin metinleri.</VCardSubtitle>
          </VCardItem>

          <VCardText>
            <VTextField
              v-model="authModal.title"
              label="Başlık"
              placeholder="WELCOME BONUS"
              class="mb-4"
            />

            <VTextField
              v-model="authModal.highlight"
              label="Vurgu satırı"
              placeholder="UP TO 590%"
              hint="Büyük ve renkli gösterilir."
              persistent-hint
              class="mb-4"
            />

            <VTextField
              v-model="authModal.subtitle"
              label="Alt satır"
              placeholder="+ 225 Free Spins"
              class="mb-4"
            />

            <VTextarea
              v-model="authModal.termsText"
              label="Yasal / yaş metni"
              rows="3"
              hint="Formun altında küçük punto ile gösterilir."
              persistent-hint
              class="mb-4"
            />

            <VSwitch
              v-model="authModal.showSocialLogins"
              label="Hızlı giriş (sosyal) butonlarını göster"
              hide-details
              density="compact"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </section>
</template>

<style scoped>
.auth-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  padding: 16px;
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  background: linear-gradient(135deg, #2a0f16, #101923);
}

.auth-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
