<script setup>
import { useCasinoUiSettings } from '@/composables/useCasinoUiSettings'
import { computed, onMounted } from 'vue'

/**
 * CMS Yönetimi → Casino Arayüzü → Lobi Bileşenleri
 *
 * Casino lobisine eklenen iki bileşeni yönetir:
 *  - Hero "oyun seçici" kartı (rastgele oyun öneren blok)
 *  - Canlı bahis tablosu (sekmeler ve satır sayısı)
 */
const { casinoUi, loading, saving, alert, load, save, isDirty } = useCasinoUiSettings()

const hero = computed(() => casinoUi.value.heroChooser)
const bets = computed(() => casinoUi.value.betsTable)

const rowCountText = computed({
  get: () => bets.value.rowCountOptions.join(', '),
  set: value => {
    bets.value.rowCountOptions = String(value)
      .split(',')
      .map(part => Number.parseInt(part.trim(), 10))
      .filter(number => Number.isFinite(number) && number > 0)
  },
})

/** Satır sayısı seçeneği listeden çıkarılırsa varsayılan geçersiz kalmasın. */
const defaultRowOptions = computed(() =>
  bets.value.rowCountOptions.map(option => ({ title: `${option} satır`, value: option })),
)

const addTab = () => {
  bets.value.tabs.push({ key: '', label: '', enabled: true, order: bets.value.tabs.length })
}

const removeTab = index => {
  bets.value.tabs.splice(index, 1)
}

const moveTab = (index, direction) => {
  const target = index + direction
  if (target < 0 || target >= bets.value.tabs.length) return
  ;[bets.value.tabs[index], bets.value.tabs[target]] = [bets.value.tabs[target], bets.value.tabs[index]]
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
            Lobi Bileşenleri
          </h5>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Casino lobisindeki hero oyun seçici ve canlı bahis tablosu ayarları.
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

        <VBtn
          :loading="saving"
          :disabled="loading"
          prepend-icon="tabler-device-floppy"
          @click="save('Lobi ayarları kaydedildi.')"
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
      <!-- Hero oyun seçici -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Hero Oyun Seçici</VCardTitle>
            <VCardSubtitle>
              Lobide kategori seçili değilken görünen, rastgele oyun öneren kart.
            </VCardSubtitle>

            <template #append>
              <VSwitch
                v-model="hero.enabled"
                hide-details
                density="compact"
              />
            </template>
          </VCardItem>

          <VCardText>
            <VTextField
              v-model="hero.title"
              label="Başlık"
              class="mb-4"
              :disabled="!hero.enabled"
            />

            <VTextarea
              v-model="hero.subtitle"
              label="Alt başlık"
              rows="3"
              class="mb-4"
              :disabled="!hero.enabled"
            />

            <VTextField
              v-model="hero.buttonText"
              label="Buton metni"
              class="mb-4"
              :disabled="!hero.enabled"
            />

            <VSwitch
              v-model="hero.backdropEnabled"
              label="Arka planda dağınık oyun kapakları görünsün"
              hide-details
              density="compact"
              :disabled="!hero.enabled"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Canlı bahis tablosu -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Canlı Bahis Tablosu</VCardTitle>
            <VCardSubtitle>Lobideki bahis listesinin sekmeleri ve satır sayısı.</VCardSubtitle>

            <template #append>
              <VSwitch
                v-model="bets.enabled"
                hide-details
                density="compact"
              />
            </template>
          </VCardItem>

          <VCardText>
            <VTextField
              v-model="bets.title"
              label="Başlık"
              class="mb-4"
              :disabled="!bets.enabled"
            />

            <VRow class="mb-2">
              <VCol
                cols="12"
                md="7"
              >
                <VTextField
                  v-model="rowCountText"
                  label="Satır sayısı seçenekleri"
                  placeholder="10, 20, 50"
                  hint="Virgülle ayırın."
                  persistent-hint
                  :disabled="!bets.enabled"
                />
              </VCol>

              <VCol
                cols="12"
                md="5"
              >
                <VSelect
                  v-model="bets.defaultRowCount"
                  :items="defaultRowOptions"
                  label="Varsayılan"
                  :disabled="!bets.enabled"
                />
              </VCol>
            </VRow>

            <VDivider class="mb-4" />

            <div class="d-flex align-center justify-space-between mb-3">
              <span class="text-body-2 font-weight-medium">Sekmeler</span>
              <VBtn
                size="small"
                variant="tonal"
                prepend-icon="tabler-plus"
                :disabled="!bets.enabled"
                @click="addTab"
              >
                Sekme Ekle
              </VBtn>
            </div>

            <VRow
              v-for="(tab, index) in bets.tabs"
              :key="`tab-${index}`"
              dense
              class="mb-2"
            >
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="tab.key"
                  label="Anahtar"
                  placeholder="all"
                  density="compact"
                  :disabled="!bets.enabled"
                />
              </VCol>

              <VCol
                cols="8"
                md="4"
              >
                <VTextField
                  v-model="tab.label"
                  label="Etiket"
                  placeholder="All bets"
                  density="compact"
                  :disabled="!bets.enabled"
                />
              </VCol>

              <VCol
                cols="4"
                md="4"
                class="d-flex align-center justify-end gap-1"
              >
                <VSwitch
                  v-model="tab.enabled"
                  hide-details
                  density="compact"
                  :disabled="!bets.enabled"
                />
                <VBtn
                  icon="tabler-arrow-up"
                  size="x-small"
                  variant="text"
                  :disabled="index === 0 || !bets.enabled"
                  @click="moveTab(index, -1)"
                />
                <VBtn
                  icon="tabler-arrow-down"
                  size="x-small"
                  variant="text"
                  :disabled="index === bets.tabs.length - 1 || !bets.enabled"
                  @click="moveTab(index, 1)"
                />
                <VBtn
                  icon="tabler-trash"
                  size="x-small"
                  variant="text"
                  color="error"
                  :disabled="!bets.enabled"
                  @click="removeTab(index)"
                />
              </VCol>
            </VRow>

            <VAlert
              type="info"
              variant="tonal"
              density="compact"
              class="mt-4"
            >
              <code>my</code> sekmesi yalnızca giriş yapmış kullanıcılara gösterilir.
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </section>
</template>
