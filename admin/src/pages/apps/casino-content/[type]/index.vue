<script setup lang="ts">
import CasinoContentManager from "@/components/casino-content/CasinoContentManager.vue"
import MissionEditor from "@/components/casino-content/MissionEditor.vue"
import BonusEditor from "@/components/casino-content/BonusEditor.vue"
import { useCasinoLookups } from "@/components/casino-content/useCasinoLookups"
import { contentTypeBySlug } from "@/config/casino-content/types"
import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const config = computed(() => contentTypeBySlug[String(route.params.type || "")])

// Görev ve special bonus JSON yerine kendi yapılandırılmış editörlerini kullanır.
const editorComponent = computed(() => {
  if (config.value?.type === "mission") return MissionEditor
  if (config.value?.type === "bonus") return BonusEditor
  return null
})

const { options, loadOptions } = useCasinoLookups()
onMounted(loadOptions)
</script>

<template>
  <CasinoContentManager v-if="config" :key="config.type" :config="config">
    <template v-if="editorComponent" #editor="{ form, update }">
      <component :is="editorComponent" :model-value="form" :options="options" @update:model-value="update" />
    </template>
  </CasinoContentManager>
  <VAlert v-else type="error" variant="tonal" title="İçerik sayfası bulunamadı">Bu içerik türü tanımlı değil.</VAlert>
</template>
