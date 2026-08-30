<script setup lang="ts">
// Gerçek oyun kataloğundan arama yaparak game_code seçtirir. Admin elle kod
// yazmaz; yanlış/olmayan bir oyun kodu yüzünden free-spin teslimi başarısız
// olmasın diye seçenekler backend lookup'ından gelir.
import axios from "@/plugins/axios"
import { ref, watch } from "vue"

const props = withDefaults(defineProps<{
  modelValue: string | string[] | null
  label?: string
  providerCode?: string | null
  multiple?: boolean
  required?: boolean
}>(), { label: "Oyun", providerCode: null, multiple: false, required: false })

const emit = defineEmits<{ (e: "update:modelValue", value: any): void }>()

const items = ref<{ title: string; value: string }[]>([])
const loading = ref(false)
const search = ref("")
let debounce: ReturnType<typeof setTimeout> | undefined

async function load() {
  loading.value = true
  try {
    const { data } = await axios.get("/admin/content/lookups/games", {
      params: { search: search.value || undefined, providerCode: props.providerCode || undefined },
    })
    const options = (data.data || []).map((game: any) => ({
      title: `${game.game_name} · ${game.game_code}${game.provider_code ? ` (${game.provider_code})` : ""}`,
      value: game.game_code,
    }))
    // Seçili değerler arama sonucunda yoksa listeden düşmesinler.
    const selected = Array.isArray(props.modelValue) ? props.modelValue : props.modelValue ? [props.modelValue] : []
    const missing = selected.filter(code => !options.some((option: any) => option.value === code)).map(code => ({ title: code, value: code }))
    items.value = [...missing, ...options]
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(search, () => {
  clearTimeout(debounce)
  debounce = setTimeout(load, 300)
})
watch(() => props.providerCode, load)
load()
</script>

<template>
  <VAutocomplete
    :model-value="modelValue"
    :items="items"
    :loading="loading"
    :label="label"
    :multiple="multiple"
    :chips="multiple"
    :closable-chips="multiple"
    :required="required"
    clearable
    no-filter
    :search="search"
    hint="Yazarak oyun arayın"
    persistent-hint
    @update:search="search = $event"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #no-data>
      <div class="pa-4 text-body-2 text-medium-emphasis">{{ loading ? "Aranıyor…" : "Eşleşen oyun yok." }}</div>
    </template>
  </VAutocomplete>
</template>
