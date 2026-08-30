<script setup lang="ts">
import CasinoContentManager from "@/components/casino-content/CasinoContentManager.vue"
import { contentTypeBySlug } from "@/config/casino-content/types"
import { computed } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const config = computed(() => contentTypeBySlug[String(route.params.type || "")])
</script>

<template>
  <CasinoContentManager v-if="config" :key="config.type" :config="config" />
  <VAlert v-else type="error" variant="tonal" title="İçerik sayfası bulunamadı">Bu içerik türü tanımlı değil.</VAlert>
</template>
