<script setup>
import { useCasinoUiSettings } from '@/composables/useCasinoUiSettings'
import { computed, onMounted } from 'vue'

/**
 * CMS Yönetimi → Casino Arayüzü → Footer
 *
 * Sitenin her sayfasında görünen footer'ın tüm içeriğini yönetir:
 * menü sütunları, iletişim adresleri, yasal metinler, partner rozetleri,
 * sosyal medya butonları ve telif satırı.
 */
const { casinoUi, loading, saving, alert, load, save, isDirty } = useCasinoUiSettings()

const footer = computed(() => casinoUi.value.footer)

const SOCIAL_VARIANTS = [
  { title: 'Telegram (mavi)', value: 'tg' },
  { title: 'X (siyah)', value: 'xnet' },
  { title: 'Instagram (gradyan)', value: 'ig' },
  { title: 'Turuncu / Bitcoin', value: 'orange' },
  { title: 'Discord (mor)', value: 'discord' },
  { title: 'Reddit (kırmızı)', value: 'reddit' },
  { title: 'TikTok (koyu)', value: 'tiktok' },
  { title: 'YouTube (kırmızı)', value: 'youtube' },
  { title: 'Marka rengi', value: 'bicon' },
]

const addColumn = () => {
  footer.value.columns.push({ title: 'YENİ SÜTUN', order: footer.value.columns.length, enabled: true, links: [] })
}

const removeColumn = index => {
  footer.value.columns.splice(index, 1)
}

const moveColumn = (index, direction) => {
  const target = index + direction
  if (target < 0 || target >= footer.value.columns.length) return

  const columns = footer.value.columns
  ;[columns[index], columns[target]] = [columns[target], columns[index]]
}

const addLink = column => {
  column.links.push({ label: '', url: '#', external: false, order: column.links.length })
}

const removeLink = (column, index) => {
  column.links.splice(index, 1)
}

const moveLink = (column, index, direction) => {
  const target = index + direction
  if (target < 0 || target >= column.links.length) return
  ;[column.links[index], column.links[target]] = [column.links[target], column.links[index]]
}

const addContactItem = () => {
  footer.value.contact.items.push({ label: '', mailbox: 'support', description: '', order: footer.value.contact.items.length })
}

const addPartner = () => {
  footer.value.partners.push({ label: '', url: '', big: false, order: footer.value.partners.length })
}

const addSocial = () => {
  footer.value.socials.push({ name: '', variant: 'tg', icon: '', text: '', url: '', enabled: true, order: footer.value.socials.length })
}

const removeAt = (list, index) => list.splice(index, 1)

const totalLinks = computed(() =>
  footer.value.columns.reduce((sum, column) => sum + column.links.length, 0),
)

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
            Footer Yönetimi
          </h5>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Footer sitenin <strong>her sayfasında</strong> görünür. Metin alanlarında
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
          v-model="footer.enabled"
          label="Footer aktif"
          hide-details
          density="compact"
        />

        <VBtn
          :loading="saving"
          :disabled="loading"
          prepend-icon="tabler-device-floppy"
          @click="save('Footer ayarları kaydedildi.')"
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
      <!-- Menü sütunları -->
      <VCol cols="12">
        <VCard>
          <VCardItem>
            <VCardTitle>Menü Sütunları</VCardTitle>
            <VCardSubtitle>
              {{ footer.columns.length }} sütun, toplam {{ totalLinks }} bağlantı.
              Sıralama buradaki sıraya göre kaydedilir.
            </VCardSubtitle>

            <template #append>
              <VBtn
                size="small"
                variant="tonal"
                prepend-icon="tabler-plus"
                @click="addColumn"
              >
                Sütun Ekle
              </VBtn>
            </template>
          </VCardItem>

          <VCardText>
            <VExpansionPanels variant="accordion">
              <VExpansionPanel
                v-for="(column, columnIndex) in footer.columns"
                :key="`column-${columnIndex}`"
              >
                <VExpansionPanelTitle>
                  <div class="d-flex align-center gap-3 flex-grow-1">
                    <VIcon
                      icon="tabler-layout-columns"
                      size="18"
                    />
                    <span class="font-weight-medium">{{ column.title || 'İsimsiz sütun' }}</span>
                    <VChip
                      size="x-small"
                      variant="tonal"
                    >
                      {{ column.links.length }} bağlantı
                    </VChip>
                    <VChip
                      v-if="!column.enabled"
                      size="x-small"
                      color="warning"
                      variant="tonal"
                    >
                      Gizli
                    </VChip>
                  </div>
                </VExpansionPanelTitle>

                <VExpansionPanelText>
                  <VRow class="mb-2">
                    <VCol
                      cols="12"
                      md="5"
                    >
                      <VTextField
                        v-model="column.title"
                        label="Sütun başlığı"
                        placeholder="I-GAMING"
                      />
                    </VCol>

                    <VCol
                      cols="12"
                      md="3"
                      class="d-flex align-center"
                    >
                      <VSwitch
                        v-model="column.enabled"
                        label="Görünür"
                        hide-details
                        density="compact"
                      />
                    </VCol>

                    <VCol
                      cols="12"
                      md="4"
                      class="d-flex align-center justify-end gap-2"
                    >
                      <VBtn
                        icon="tabler-arrow-up"
                        size="small"
                        variant="text"
                        :disabled="columnIndex === 0"
                        @click="moveColumn(columnIndex, -1)"
                      />
                      <VBtn
                        icon="tabler-arrow-down"
                        size="small"
                        variant="text"
                        :disabled="columnIndex === footer.columns.length - 1"
                        @click="moveColumn(columnIndex, 1)"
                      />
                      <VBtn
                        icon="tabler-trash"
                        size="small"
                        variant="text"
                        color="error"
                        @click="removeColumn(columnIndex)"
                      />
                    </VCol>
                  </VRow>

                  <VDivider class="mb-4" />

                  <div
                    v-for="(link, linkIndex) in column.links"
                    :key="`link-${columnIndex}-${linkIndex}`"
                    class="mb-3"
                  >
                    <VRow dense>
                      <VCol
                        cols="12"
                        md="4"
                      >
                        <VTextField
                          v-model="link.label"
                          label="Bağlantı metni"
                          density="compact"
                        />
                      </VCol>

                      <VCol
                        cols="12"
                        md="4"
                      >
                        <VTextField
                          v-model="link.url"
                          label="Adres"
                          placeholder="/casino veya #originals"
                          density="compact"
                        />
                      </VCol>

                      <VCol
                        cols="8"
                        md="2"
                        class="d-flex align-center"
                      >
                        <VSwitch
                          v-model="link.external"
                          label="↗ dış bağlantı"
                          hide-details
                          density="compact"
                        />
                      </VCol>

                      <VCol
                        cols="4"
                        md="2"
                        class="d-flex align-center justify-end"
                      >
                        <VBtn
                          icon="tabler-arrow-up"
                          size="x-small"
                          variant="text"
                          :disabled="linkIndex === 0"
                          @click="moveLink(column, linkIndex, -1)"
                        />
                        <VBtn
                          icon="tabler-arrow-down"
                          size="x-small"
                          variant="text"
                          :disabled="linkIndex === column.links.length - 1"
                          @click="moveLink(column, linkIndex, 1)"
                        />
                        <VBtn
                          icon="tabler-trash"
                          size="x-small"
                          variant="text"
                          color="error"
                          @click="removeLink(column, linkIndex)"
                        />
                      </VCol>
                    </VRow>
                  </div>

                  <VBtn
                    size="small"
                    variant="tonal"
                    prepend-icon="tabler-plus"
                    @click="addLink(column)"
                  >
                    Bağlantı Ekle
                  </VBtn>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>
          </VCardText>
        </VCard>
      </VCol>

      <!-- İletişim -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>İletişim Sütunu</VCardTitle>
            <VCardSubtitle>
              Adresler <code>kutu@alanadi.com</code> biçiminde kurulur.
            </VCardSubtitle>

            <template #append>
              <VSwitch
                v-model="footer.contact.enabled"
                hide-details
                density="compact"
              />
            </template>
          </VCardItem>

          <VCardText>
            <VRow class="mb-2">
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="footer.contact.title"
                  label="Başlık"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="footer.contact.emailDomain"
                  label="E-posta alan adı"
                  placeholder="forcelab"
                  hint="Sonuna .com eklenir. Boşsa site adı kullanılır."
                  persistent-hint
                />
              </VCol>
            </VRow>

            <VDivider class="mb-4" />

            <div
              v-for="(item, index) in footer.contact.items"
              :key="`contact-${index}`"
              class="mb-4"
            >
              <VRow dense>
                <VCol
                  cols="12"
                  md="4"
                >
                  <VTextField
                    v-model="item.mailbox"
                    label="Kutu adı"
                    placeholder="support"
                    density="compact"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="4"
                >
                  <VTextField
                    v-model="item.label"
                    label="Görünen metin"
                    placeholder="Boşsa adres yazılır"
                    density="compact"
                  />
                </VCol>

                <VCol
                  cols="10"
                  md="3"
                >
                  <VTextField
                    v-model="item.description"
                    label="Açıklama"
                    density="compact"
                  />
                </VCol>

                <VCol
                  cols="2"
                  md="1"
                  class="d-flex align-center justify-end"
                >
                  <VBtn
                    icon="tabler-trash"
                    size="x-small"
                    variant="text"
                    color="error"
                    @click="removeAt(footer.contact.items, index)"
                  />
                </VCol>
              </VRow>
            </div>

            <VBtn
              size="small"
              variant="tonal"
              prepend-icon="tabler-plus"
              @click="addContactItem"
            >
              Adres Ekle
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Yasal -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Yasal Bilgi ve Lisans</VCardTitle>
            <VCardSubtitle>Yaş rozeti, lisans rozeti ve footer açıklama metinleri.</VCardSubtitle>

            <template #append>
              <VSwitch
                v-model="footer.legal.enabled"
                hide-details
                density="compact"
              />
            </template>
          </VCardItem>

          <VCardText>
            <VRow class="mb-2">
              <VCol
                cols="6"
                md="4"
              >
                <VTextField
                  v-model="footer.legal.ageBadge"
                  label="Yaş rozeti"
                  placeholder="18+"
                />
              </VCol>

              <VCol
                cols="6"
                md="4"
              >
                <VTextField
                  v-model="footer.legal.licenseBadge"
                  label="Lisans rozeti"
                  placeholder="SIO"
                />
              </VCol>
            </VRow>

            <VTextarea
              v-model="footer.legal.riskText"
              label="Risk / yaş uyarısı"
              rows="4"
              class="mb-4"
            />

            <VTextarea
              v-model="footer.legal.brandText"
              label="Marka ve lisans metni"
              rows="5"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Partnerler -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Partner Rozetleri</VCardTitle>
            <VCardSubtitle>Footer'daki kripto / listeleme partneri satırı.</VCardSubtitle>

            <template #append>
              <VBtn
                size="small"
                variant="tonal"
                prepend-icon="tabler-plus"
                @click="addPartner"
              >
                Ekle
              </VBtn>
            </template>
          </VCardItem>

          <VCardText>
            <VRow
              v-for="(partner, index) in footer.partners"
              :key="`partner-${index}`"
              dense
              class="mb-2"
            >
              <VCol
                cols="12"
                md="5"
              >
                <VTextField
                  v-model="partner.label"
                  label="Etiket"
                  placeholder="◉ CoinGecko"
                  density="compact"
                />
              </VCol>

              <VCol
                cols="8"
                md="4"
              >
                <VTextField
                  v-model="partner.url"
                  label="Adres (opsiyonel)"
                  density="compact"
                />
              </VCol>

              <VCol
                cols="3"
                md="2"
                class="d-flex align-center"
              >
                <VSwitch
                  v-model="partner.big"
                  label="Büyük"
                  hide-details
                  density="compact"
                />
              </VCol>

              <VCol
                cols="1"
                class="d-flex align-center justify-end"
              >
                <VBtn
                  icon="tabler-trash"
                  size="x-small"
                  variant="text"
                  color="error"
                  @click="removeAt(footer.partners, index)"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Sosyal medya -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Sosyal Medya</VCardTitle>
            <VCardSubtitle>
              Simge alanına Font Awesome sınıfı yazın; boş bırakırsanız metin gösterilir.
            </VCardSubtitle>

            <template #append>
              <VBtn
                size="small"
                variant="tonal"
                prepend-icon="tabler-plus"
                @click="addSocial"
              >
                Ekle
              </VBtn>
            </template>
          </VCardItem>

          <VCardText>
            <VRow
              v-for="(social, index) in footer.socials"
              :key="`social-${index}`"
              dense
              class="mb-2"
            >
              <VCol
                cols="12"
                md="3"
              >
                <VTextField
                  v-model="social.name"
                  label="Ad"
                  density="compact"
                />
              </VCol>

              <VCol
                cols="12"
                md="3"
              >
                <VTextField
                  v-model="social.url"
                  label="Bağlantı"
                  density="compact"
                />
              </VCol>

              <VCol
                cols="6"
                md="3"
              >
                <VSelect
                  v-model="social.variant"
                  :items="SOCIAL_VARIANTS"
                  label="Renk"
                  density="compact"
                />
              </VCol>

              <VCol
                cols="6"
                md="2"
              >
                <VTextField
                  v-model="social.icon"
                  label="Simge"
                  placeholder="fab fa-discord"
                  density="compact"
                />
              </VCol>

              <VCol
                cols="12"
                md="1"
                class="d-flex align-center justify-end gap-1"
              >
                <VSwitch
                  v-model="social.enabled"
                  hide-details
                  density="compact"
                />
                <VBtn
                  icon="tabler-trash"
                  size="x-small"
                  variant="text"
                  color="error"
                  @click="removeAt(footer.socials, index)"
                />
              </VCol>

              <VCol
                v-if="!social.icon"
                cols="12"
                md="3"
              >
                <VTextField
                  v-model="social.text"
                  label="Simge yerine metin"
                  placeholder="₿"
                  density="compact"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Alt satır -->
      <VCol cols="12">
        <VCard>
          <VCardItem>
            <VCardTitle>Alt Satır</VCardTitle>
            <VCardSubtitle>Token widget'ları ve telif hakkı metni.</VCardSubtitle>
          </VCardItem>

          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="footer.tokenWidgets.walletLabel"
                  label="Cüzdan widget metni"
                  :disabled="!footer.tokenWidgets.enabled"
                />
              </VCol>

              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="footer.tokenWidgets.rateLabel"
                  label="Kur widget metni"
                  :disabled="!footer.tokenWidgets.enabled"
                />
              </VCol>

              <VCol
                cols="12"
                md="4"
                class="d-flex align-center"
              >
                <VSwitch
                  v-model="footer.tokenWidgets.enabled"
                  label="Token widget'ları görünsün"
                  hide-details
                  density="compact"
                />
              </VCol>

              <VCol cols="12">
                <VTextField
                  v-model="footer.copyright"
                  label="Telif hakkı metni"
                />
              </VCol>
            </VRow>
          </VCardText>

          <VCardText class="d-flex justify-end">
            <VBtn
              :loading="saving"
              :disabled="loading"
              prepend-icon="tabler-device-floppy"
              @click="save('Footer ayarları kaydedildi.')"
            >
              Kaydet
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </section>
</template>
