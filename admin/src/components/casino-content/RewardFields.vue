<script setup lang="ts">
// Ortak ödül alanları (mission + bonus). Seçilen ödül tipine göre yalnızca
// backend `normalizeReward` / `validateReward` tarafından kullanılan alanlar
// gösterilir — böylece admin anlamsız alan doldurmaz.
import { computed } from "vue"
import GamePicker from "./GamePicker.vue"
import type { LookupOptions } from "./useCasinoLookups"

const props = defineProps<{ modelValue: any; options: LookupOptions }>()
const emit = defineEmits<{ (e: "update:modelValue", value: any): void }>()

const reward = computed(() => props.modelValue || {})
function set(key: string, value: any) {
  emit("update:modelValue", { ...reward.value, [key]: value })
}

const rewardLabels: Record<string, string> = {
  none: "Ödül yok",
  balance: "Gerçek bakiye",
  bonus: "Bonus bakiye (çevrimli)",
  "free-spins": "Free spin",
  xp: "XP / puan",
}
const rewardItems = computed(() => props.options.rewardTypes.map(value => ({ title: rewardLabels[value] || value, value })))

const isFreeSpins = computed(() => reward.value.type === "free-spins")
const isAmountReward = computed(() => ["balance", "bonus", "xp"].includes(reward.value.type))
</script>

<template>
  <VRow>
    <VCol cols="12" md="6">
      <VSelect :model-value="reward.type" :items="rewardItems" label="Ödül tipi" @update:model-value="set('type', $event)" />
    </VCol>

    <template v-if="isAmountReward">
      <VCol cols="12" md="3"><VTextField :model-value="reward.amount" type="number" min="0" label="Ödül tutarı" required @update:model-value="set('amount', $event)" /></VCol>
      <VCol cols="12" md="3"><VTextField :model-value="reward.currency" label="Para birimi" @update:model-value="set('currency', String($event || '').toUpperCase())" /></VCol>
      <VCol v-if="reward.type === 'bonus'" cols="12" md="4">
        <VTextField :model-value="reward.wageringMultiplier" type="number" min="0" label="Çevrim katı" hint="Örn. 30 = bonusun 30 katı çevrim" persistent-hint @update:model-value="set('wageringMultiplier', $event)" />
      </VCol>
    </template>

    <template v-if="isFreeSpins">
      <VCol cols="12" md="3"><VTextField :model-value="reward.spinCount" type="number" min="1" label="Spin adedi" required @update:model-value="set('spinCount', $event)" /></VCol>
      <VCol cols="12" md="3"><VTextField :model-value="reward.betAmount" type="number" min="0" step="0.01" label="Spin başına bahis" required @update:model-value="set('betAmount', $event)" /></VCol>
      <VCol cols="12" md="4">
        <VSelect :model-value="reward.providerCode" :items="options.providers" label="Sağlayıcı" required clearable @update:model-value="set('providerCode', $event)" />
      </VCol>
      <VCol cols="12" md="5">
        <GamePicker :model-value="reward.gameCode" label="Free spin oyunu" :provider-code="reward.providerCode" required @update:model-value="set('gameCode', $event)" />
      </VCol>
      <VCol cols="12" md="3"><VTextField :model-value="reward.currency" label="Para birimi" @update:model-value="set('currency', String($event || '').toUpperCase())" /></VCol>
      <VCol cols="12" md="4"><VTextField :model-value="reward.expireHours" type="number" min="1" label="Geçerlilik (saat)" hint="Sağlayıcıda spin'lerin geçerli kalacağı süre" persistent-hint @update:model-value="set('expireHours', $event)" /></VCol>
    </template>
  </VRow>
</template>
