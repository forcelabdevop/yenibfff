<script setup lang="ts">
// Görev editörü: admin JSON yazmadan, alan alan görev kurar.
// Gösterilen alanlar backend `casinoRewardSchema.normalizeMissionRules`
// sözleşmesiyle birebir eşleşir; seçilen etkinlik/ödül tipine göre
// yalnızca anlamlı alanlar görünür.
import { computed } from "vue"
import RewardFields from "./RewardFields.vue"
import GamePicker from "./GamePicker.vue"
import type { LookupOptions } from "./useCasinoLookups"

const props = defineProps<{ modelValue: any; options: LookupOptions }>()
const emit = defineEmits<{ (e: "update:modelValue", value: any): void }>()

const form = computed(() => props.modelValue)
const rules = computed(() => form.value.rules || {})

function setRoot(key: string, value: any) {
  emit("update:modelValue", { ...form.value, [key]: value })
}
function setRule(key: string, value: any) {
  emit("update:modelValue", { ...form.value, rules: { ...rules.value, [key]: value } })
}

const eventLabels: Record<string, string> = {
  deposit: "Yatırım yaptığında",
  wager: "Bahis oynadığında",
  win: "Kazandığında",
  "game-round": "Oyun turu tamamladığında",
  login: "Giriş yaptığında",
}
const periodLabels: Record<string, string> = {
  lifetime: "Tek sefer (ömür boyu)",
  daily: "Her gün sıfırlanır",
  weekly: "Her hafta sıfırlanır",
  monthly: "Her ay sıfırlanır",
}
const metricLabels: Record<string, string> = { count: "Adet / kez", amount: "Toplam tutar" }

const eventItems = computed(() => props.options.eventTypes.map(value => ({ title: eventLabels[value] || value, value })))
const periodItems = computed(() => props.options.periods.map(value => ({ title: periodLabels[value] || value, value })))
const metricItems = computed(() => props.options.metrics.map(value => ({ title: metricLabels[value] || value, value })))

// login görevlerinde tutar/filtre alanları anlamsızdır; motor da yok sayar.
const isLogin = computed(() => rules.value.eventType === "login")
const isAmount = computed(() => rules.value.metric === "amount")

// Adminin kaydetmeden önce kuralı doğal dilde görebilmesi için özet.
const summary = computed(() => {
  const target = Number(rules.value.target) || 1
  const unit = isAmount.value ? `${target} ${rules.value.currency || "USD"}` : `${target} kez`
  const action = eventLabels[rules.value.eventType] || rules.value.eventType || "—"
  const scope: string[] = []
  if (rules.value.minimumAmount > 0) scope.push(`işlem başına min. ${rules.value.minimumAmount} ${rules.value.currency || "USD"}`)
  if (rules.value.providerCodes?.length) scope.push(`sağlayıcı: ${rules.value.providerCodes.join(", ")}`)
  if (rules.value.gameCodes?.length) scope.push(`oyun: ${rules.value.gameCodes.join(", ")}`)
  if (rules.value.categories?.length) scope.push(`kategori: ${rules.value.categories.join(", ")}`)
  const period = periodLabels[rules.value.period] || rules.value.period
  return `Kullanıcı ${action.toLocaleLowerCase("tr-TR")} ilerler; hedef ${unit}. ${period}.${scope.length ? ` Yalnızca ${scope.join("; ")}.` : ""}`
})

// Backend `validateMission` ile aynı çapraz alan kuralları — kaydetmeden uyarır.
const warnings = computed(() => {
  const list: string[] = []
  if (!(Number(rules.value.target) >= 1)) list.push("Hedef en az 1 olmalıdır.")
  if (isLogin.value && rules.value.period === "lifetime" && Number(rules.value.target) > 1) {
    list.push("Tekrarlayan giriş görevleri için günlük veya haftalık dönem seçin.")
  }
  if (rules.value.perUserLimit && rules.value.globalLimit && Number(rules.value.globalLimit) < Number(rules.value.perUserLimit)) {
    list.push("Global limit, kullanıcı limitinden küçük olamaz.")
  }
  return list
})
</script>

<template>
  <div class="d-flex flex-column ga-6">
    <section>
      <div class="section-title">Kimlik ve görünüm</div>
      <VRow>
        <VCol cols="12" md="6"><VTextField :model-value="form.title" label="Görev başlığı" required @update:model-value="setRoot('title', $event)" /></VCol>
        <VCol cols="12" md="6"><VTextField :model-value="form.slug" label="Slug" required hint="Benzersiz kısa anahtar" persistent-hint @update:model-value="setRoot('slug', $event)" /></VCol>
        <VCol cols="12" md="6"><VTextField :model-value="form.subtitle" label="Alt başlık" @update:model-value="setRoot('subtitle', $event)" /></VCol>
        <VCol cols="12" md="3"><VSelect :model-value="form.locale" :items="['tr', 'en', 'de', 'ru']" label="Dil" @update:model-value="setRoot('locale', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="form.order" type="number" min="0" label="Sıra" @update:model-value="setRoot('order', $event)" /></VCol>
        <VCol cols="12"><VTextarea :model-value="form.description" label="Açıklama" rows="3" @update:model-value="setRoot('description', $event)" /></VCol>
      </VRow>
    </section>

    <VDivider />

    <section>
      <div class="section-title">İlerleme koşulu</div>
      <VRow>
        <VCol cols="12" md="6">
          <VSelect :model-value="rules.eventType" :items="eventItems" label="Ne zaman ilerlesin?" required @update:model-value="setRule('eventType', $event)" />
        </VCol>
        <VCol v-if="!isLogin" cols="12" md="3">
          <VSelect :model-value="rules.metric" :items="metricItems" label="Ölçüm" @update:model-value="setRule('metric', $event)" />
        </VCol>
        <VCol cols="12" :md="isLogin ? 6 : 3">
          <VTextField :model-value="rules.target" type="number" min="1" label="Hedef" required @update:model-value="setRule('target', $event)" />
        </VCol>
        <VCol v-if="isAmount || rules.minimumAmount" cols="12" md="4">
          <VTextField :model-value="rules.currency" label="Para birimi" @update:model-value="setRule('currency', String($event || '').toUpperCase())" />
        </VCol>
        <VCol v-if="!isLogin" cols="12" md="4">
          <VTextField :model-value="rules.minimumAmount" type="number" min="0" label="İşlem başına minimum tutar" hint="0 = sınır yok" persistent-hint @update:model-value="setRule('minimumAmount', $event)" />
        </VCol>
      </VRow>
    </section>

    <template v-if="!isLogin">
      <VDivider />
      <section>
        <div class="section-title">Kapsam filtreleri <span class="text-medium-emphasis text-body-2">— boş bırakırsanız tüm oyunlar sayılır</span></div>
        <VRow>
          <VCol cols="12" md="6">
            <VSelect :model-value="rules.providerCodes || []" :items="options.providers" label="Sağlayıcılar" multiple chips closable-chips clearable @update:model-value="setRule('providerCodes', $event)" />
          </VCol>
          <VCol cols="12" md="6">
            <VSelect :model-value="rules.categories || []" :items="options.categories" label="Kategoriler" multiple chips closable-chips clearable @update:model-value="setRule('categories', $event)" />
          </VCol>
          <VCol cols="12">
            <GamePicker :model-value="rules.gameCodes || []" label="Oyunlar" multiple :provider-code="(rules.providerCodes || [])[0]" @update:model-value="setRule('gameCodes', $event)" />
          </VCol>
        </VRow>
      </section>
    </template>

    <VDivider />

    <section>
      <div class="section-title">Dönem ve katılım</div>
      <VRow>
        <VCol cols="12" md="6"><VSelect :model-value="rules.period" :items="periodItems" label="Tekrar / sıfırlama" @update:model-value="setRule('period', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="rules.perUserLimit" type="number" min="0" label="Kullanıcı başına limit" hint="0 = sınırsız" persistent-hint @update:model-value="setRule('perUserLimit', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="rules.globalLimit" type="number" min="0" label="Global limit" hint="0 = sınırsız" persistent-hint @update:model-value="setRule('globalLimit', $event)" /></VCol>
        <VCol cols="12" md="6"><VSwitch :model-value="Boolean(rules.autoJoin)" label="Otomatik katılım (kullanıcı 'Katıl' demeden ilerler)" color="primary" inset @update:model-value="setRule('autoJoin', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="form.startsAt" type="datetime-local" label="Başlangıç" @update:model-value="setRoot('startsAt', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="form.endsAt" type="datetime-local" label="Bitiş" @update:model-value="setRoot('endsAt', $event)" /></VCol>
      </VRow>
    </section>

    <VDivider />

    <section>
      <div class="section-title">Ödül</div>
      <RewardFields :model-value="form.reward || {}" :options="options" @update:model-value="emit('update:modelValue', { ...form, reward: $event })" />
    </section>

    <VAlert type="info" variant="tonal" density="comfortable">
      <div class="font-weight-medium mb-1">Koşul özeti</div>
      <div class="text-body-2">{{ summary }}</div>
    </VAlert>

    <VAlert v-if="warnings.length" type="warning" variant="tonal" density="comfortable">
      <ul class="ps-4 mb-0"><li v-for="warning in warnings" :key="warning" class="text-body-2">{{ warning }}</li></ul>
    </VAlert>
  </div>
</template>

<style scoped>
.section-title { font-weight: 600; font-size: 0.95rem; margin-block-end: 0.75rem; }
</style>
