<script setup lang="ts">
// Special bonus editörü: kullanıcıya gösterilen bonus kartı/modalındaki her
// satırı JSON yazmadan yönetir. Alanlar backend
// `casinoRewardSchema.normalizeBonusRules` sözleşmesiyle birebir eşleşir.
import { computed } from "vue"
import RewardFields from "./RewardFields.vue"
import type { LookupOptions } from "./useCasinoLookups"

const props = defineProps<{ modelValue: any; options: LookupOptions }>()
const emit = defineEmits<{ (e: "update:modelValue", value: any): void }>()

const form = computed(() => props.modelValue)
const rules = computed(() => form.value.rules || {})
const content = computed(() => form.value.content || {})
const reward = computed(() => form.value.reward || {})

function setRoot(key: string, value: any) {
  emit("update:modelValue", { ...form.value, [key]: value })
}
function setRule(key: string, value: any) {
  emit("update:modelValue", { ...form.value, rules: { ...rules.value, [key]: value } })
}
function setContent(key: string, value: any) {
  emit("update:modelValue", { ...form.value, content: { ...content.value, [key]: value } })
}

const activationLabels: Record<string, string> = {
  deposit: "Yatırım sonrası aktifleşir",
  instant: "Seçer seçmez anında verilir",
}
const periodLabels: Record<string, string> = {
  lifetime: "Tek sefer (ömür boyu)",
  daily: "Her gün yenilenir",
  weekly: "Her hafta yenilenir",
  monthly: "Her ay yenilenir",
}
const activationItems = computed(() => props.options.activations.map(value => ({ title: activationLabels[value] || value, value })))
const periodItems = computed(() => props.options.periods.map(value => ({ title: periodLabels[value] || value, value })))

const isDeposit = computed(() => rules.value.activation === "deposit")
const hasWagering = computed(() => Number(rules.value.wagerMultiplier) > 0)

// Kullanıcıya görünecek kartın canlı önizlemesi.
const preview = computed(() => {
  const lines: { label: string; value: string }[] = []
  if (isDeposit.value && rules.value.minimumDeposit) lines.push({ label: "Min. yatırım", value: `${rules.value.minimumDeposit} ${(rules.value.currencies || [])[0] || reward.value.currency || "USD"}` })
  if (rules.value.maxBonusAmount) lines.push({ label: "Maks. bonus", value: String(rules.value.maxBonusAmount) })
  if (rules.value.maxClaimMultiplier) lines.push({ label: "Maks. çekim", value: `${rules.value.maxClaimMultiplier}x` })
  if (reward.value.type === "free-spins") {
    lines.push({ label: "Free spin", value: `${reward.value.spinCount || 0} adet` })
    if (reward.value.betAmount) lines.push({ label: "Spin başına bahis", value: String(reward.value.betAmount) })
    if (reward.value.gameCode) lines.push({ label: "Oyun", value: `${reward.value.gameCode}${reward.value.providerCode ? ` (${reward.value.providerCode})` : ""}` })
  }
  if (hasWagering.value) lines.push({ label: "Çevrim", value: `${rules.value.wagerMultiplier}x` })
  if (rules.value.wagerMinBet || rules.value.wagerMaxBet) lines.push({ label: "Çevrim bahis aralığı", value: `${rules.value.wagerMinBet || 0} – ${rules.value.wagerMaxBet || "∞"}` })
  return lines
})

// Backend `validateBonus` ile aynı kurallar — kaydetmeden önce uyarır.
const warnings = computed(() => {
  const list: string[] = []
  if (isDeposit.value && !(Number(rules.value.minimumDeposit) > 0)) list.push("Yatırım bonusu için minimum yatırım tutarı zorunludur.")
  if (isDeposit.value && !(Number(rules.value.windowHours) > 0)) list.push("Yatırım bonusu için geçerlilik penceresi zorunludur.")
  if (rules.value.maximumDeposit && Number(rules.value.maximumDeposit) < Number(rules.value.minimumDeposit)) list.push("Maksimum yatırım, minimum yatırımdan küçük olamaz.")
  if (rules.value.wagerMaxBet && rules.value.wagerMinBet && Number(rules.value.wagerMaxBet) < Number(rules.value.wagerMinBet)) list.push("Maksimum çevrim bahsi, minimum çevrim bahsinden küçük olamaz.")
  if (rules.value.perUserLimit && rules.value.globalLimit && Number(rules.value.globalLimit) < Number(rules.value.perUserLimit)) list.push("Global limit, kullanıcı limitinden küçük olamaz.")
  if (!reward.value.type || reward.value.type === "none") list.push("Special bonus için bir ödül tipi seçin.")
  return list
})
</script>

<template>
  <div class="d-flex flex-column ga-6">
    <section>
      <div class="section-title">Kart görünümü</div>
      <VRow>
        <VCol cols="12" md="6"><VTextField :model-value="form.title" label="Bonus başlığı" placeholder="Friday Bonus" required @update:model-value="setRoot('title', $event)" /></VCol>
        <VCol cols="12" md="6"><VTextField :model-value="form.slug" label="Slug" required @update:model-value="setRoot('slug', $event)" /></VCol>
        <VCol cols="12" md="6"><VTextField :model-value="content.highlight" label="Vurgu metni" placeholder="50 Free Spins" hint="Kartta büyük gösterilen ödül metni" persistent-hint @update:model-value="setContent('highlight', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="content.label" label="Rozet / etiket" placeholder="HAFTALIK" @update:model-value="setContent('label', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="content.accent" label="Vurgu rengi" placeholder="#f5a524" @update:model-value="setContent('accent', $event)" /></VCol>
        <VCol cols="12" md="6"><VTextField :model-value="form.image" label="Masaüstü görsel URL" prepend-inner-icon="tabler-photo" @update:model-value="setRoot('image', $event)" /></VCol>
        <VCol cols="12" md="6"><VTextField :model-value="form.mobileImage" label="Mobil görsel URL" prepend-inner-icon="tabler-photo" @update:model-value="setRoot('mobileImage', $event)" /></VCol>
        <VCol cols="12"><VTextarea :model-value="content.infoText" label="Bilgi metni" rows="3" counter="600" hint="Modalda gösterilen açıklama / koşul metni" persistent-hint @update:model-value="setContent('infoText', $event)" /></VCol>
      </VRow>
    </section>

    <VDivider />

    <section>
      <div class="section-title">Aktivasyon</div>
      <VRow>
        <VCol cols="12" md="6"><VSelect :model-value="rules.activation" :items="activationItems" label="Nasıl aktifleşsin?" required @update:model-value="setRule('activation', $event)" /></VCol>
        <VCol cols="12" md="6"><VSelect :model-value="rules.currencies || []" :items="['TRY', 'USD', 'EUR', 'BRL', 'GBP']" label="Geçerli para birimleri" multiple chips closable-chips clearable hint="Boş = tümü" persistent-hint @update:model-value="setRule('currencies', $event)" /></VCol>

        <template v-if="isDeposit">
          <VCol cols="12" md="3"><VTextField :model-value="rules.minimumDeposit" type="number" min="0" label="Min. yatırım" required @update:model-value="setRule('minimumDeposit', $event)" /></VCol>
          <VCol cols="12" md="3"><VTextField :model-value="rules.maximumDeposit" type="number" min="0" label="Maks. yatırım" hint="0 = sınırsız" persistent-hint @update:model-value="setRule('maximumDeposit', $event)" /></VCol>
          <VCol cols="12" md="3"><VTextField :model-value="rules.depositSequence" type="number" min="0" label="Kaçıncı yatırım" hint="0 = herhangi biri, 1 = ilk yatırım" persistent-hint @update:model-value="setRule('depositSequence', $event)" /></VCol>
          <VCol cols="12" md="3"><VTextField :model-value="rules.windowHours" type="number" min="1" label="Yatırım penceresi (saat)" required hint="Seçimden sonra yatırım için süre" persistent-hint @update:model-value="setRule('windowHours', $event)" /></VCol>
        </template>

        <VCol cols="12" md="3"><VTextField :model-value="rules.activeHours" type="number" min="0" label="Bonus aktif süresi (saat)" @update:model-value="setRule('activeHours', $event)" /></VCol>
        <VCol cols="12" md="3"><VSelect :model-value="rules.period" :items="periodItems" label="Tekrar" @update:model-value="setRule('period', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="rules.perUserLimit" type="number" min="0" label="Kullanıcı limiti" hint="0 = sınırsız" persistent-hint @update:model-value="setRule('perUserLimit', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="rules.globalLimit" type="number" min="0" label="Global limit" hint="0 = sınırsız" persistent-hint @update:model-value="setRule('globalLimit', $event)" /></VCol>
      </VRow>
    </section>

    <VDivider />

    <section>
      <div class="section-title">Ödül</div>
      <RewardFields :model-value="reward" :options="options" @update:model-value="emit('update:modelValue', { ...form, reward: $event })" />
    </section>

    <VDivider />

    <section>
      <div class="section-title">Çevrim ve limitler</div>
      <VRow>
        <VCol cols="12" md="3"><VTextField :model-value="rules.wagerMultiplier" type="number" min="0" label="Çevrim çarpanı" hint="0 = çevrim yok" persistent-hint @update:model-value="setRule('wagerMultiplier', $event)" /></VCol>
        <VCol v-if="hasWagering" cols="12" md="3"><VTextField :model-value="rules.wagerMinBet" type="number" min="0" label="Min. çevrim bahsi" @update:model-value="setRule('wagerMinBet', $event)" /></VCol>
        <VCol v-if="hasWagering" cols="12" md="3"><VTextField :model-value="rules.wagerMaxBet" type="number" min="0" label="Maks. çevrim bahsi" @update:model-value="setRule('wagerMaxBet', $event)" /></VCol>
        <VCol v-if="hasWagering" cols="12" md="3"><VSelect :model-value="rules.wagerCategories || []" :items="options.categories" label="Çevrime sayan kategoriler" multiple chips closable-chips clearable hint="Boş = tümü" persistent-hint @update:model-value="setRule('wagerCategories', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="rules.maxBonusAmount" type="number" min="0" label="Maks. bonus tutarı" @update:model-value="setRule('maxBonusAmount', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="rules.maxClaimMultiplier" type="number" min="0" label="Maks. çekim çarpanı" hint="Örn. 5 = bonusun 5 katı" persistent-hint @update:model-value="setRule('maxClaimMultiplier', $event)" /></VCol>
        <VCol cols="12" md="6"><VCombobox :model-value="rules.excludedCountries || []" label="Hariç tutulan ülkeler" multiple chips closable-chips hint="ISO kodu, örn. TR" persistent-hint @update:model-value="setRule('excludedCountries', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="form.startsAt" type="datetime-local" label="Başlangıç" @update:model-value="setRoot('startsAt', $event)" /></VCol>
        <VCol cols="12" md="3"><VTextField :model-value="form.endsAt" type="datetime-local" label="Bitiş" @update:model-value="setRoot('endsAt', $event)" /></VCol>
      </VRow>
    </section>

    <VCard v-if="preview.length" variant="tonal" color="success">
      <VCardText>
        <div class="font-weight-medium mb-2">Kullanıcı kartı önizlemesi</div>
        <div class="d-flex flex-column ga-1">
          <div v-for="line in preview" :key="line.label" class="d-flex justify-space-between text-body-2">
            <span class="text-medium-emphasis">{{ line.label }}</span><span class="font-weight-medium">{{ line.value }}</span>
          </div>
        </div>
      </VCardText>
    </VCard>

    <VAlert v-if="warnings.length" type="warning" variant="tonal" density="comfortable">
      <ul class="ps-4 mb-0"><li v-for="warning in warnings" :key="warning" class="text-body-2">{{ warning }}</li></ul>
    </VAlert>
  </div>
</template>

<style scoped>
.section-title { font-weight: 600; font-size: 0.95rem; margin-block-end: 0.75rem; }
</style>
