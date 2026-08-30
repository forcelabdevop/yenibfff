<script setup lang="ts">
import axios from "@/plugins/axios"
import { contentTypeByValue, contentTypes } from "@/config/casino-content/types"
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref("")
const summary = ref<any[]>([])
const search = ref("")
const filteredTypes = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase("tr-TR")
  return needle ? contentTypes.filter(item => `${item.title} ${item.description}`.toLocaleLowerCase("tr-TR").includes(needle)) : contentTypes
})
const counts = computed(() => summary.value.reduce((result: any, item: any) => {
  result[item.type] ||= { total: 0, published: 0, draft: 0, scheduled: 0, archived: 0 }
  result[item.type].total += Number(item.count) || 0
  if (result[item.type][item.status] !== undefined) result[item.type][item.status] += Number(item.count) || 0
  return result
}, {}))
function go(config: any) { router.push(`/apps/casino-content/${config.slug}`) }
async function load() {
  loading.value = true; error.value = ""
  try { const { data } = await axios.get("/admin/content/summary"); summary.value = data.data || [] }
  catch (err: any) { error.value = err.response?.data?.error?.message || "İçerik özeti yüklenemedi." }
  finally { loading.value = false }
}
onMounted(() => {
  const legacyType = typeof route.query.type === "string" ? contentTypeByValue[route.query.type] : null
  if (legacyType) return router.replace(`/apps/casino-content/${legacyType.slug}`)
  load()
})
</script>

<template>
  <section class="d-flex flex-column ga-5">
    <VCard class="overview-hero" variant="flat"><VCardText class="d-flex flex-wrap align-center ga-5 pa-7"><VAvatar color="primary" variant="tonal" size="64"><VIcon icon="tabler-layout-grid" size="34" /></VAvatar><div class="flex-grow-1"><div class="text-h3 font-weight-bold">Casino İçerikleri</div><div class="text-body-1 text-medium-emphasis mt-2">Her içerik alanı artık kendi detaylı yönetim sayfasında.</div></div><VTextField v-model="search" label="Sayfa ara" prepend-inner-icon="tabler-search" hide-details clearable class="overview-search" /></VCardText></VCard>
    <VAlert v-if="error" type="error" variant="tonal">{{ error }}</VAlert>
    <VRow v-if="loading"><VCol v-for="index in 8" :key="index" cols="12" sm="6" lg="4"><VSkeletonLoader type="article" /></VCol></VRow>
    <VRow v-else>
      <VCol v-for="config in filteredTypes" :key="config.type" cols="12" sm="6" lg="4">
        <VCard class="content-card h-100" hover @click="go(config)"><VCardText class="d-flex flex-column ga-4 pa-5"><div class="d-flex align-center justify-space-between"><VAvatar :color="config.accent" variant="tonal" size="48"><VIcon :icon="config.icon" /></VAvatar><VIcon icon="tabler-arrow-up-right" class="text-medium-emphasis" /></div><div><div class="text-h6 font-weight-bold">{{ config.title }}</div><div class="text-body-2 text-medium-emphasis mt-1 description">{{ config.description }}</div></div><div class="d-flex flex-wrap ga-2 mt-auto"><VChip size="small" variant="tonal">{{ counts[config.type]?.total || 0 }} kayıt</VChip><VChip size="small" color="success" variant="tonal">{{ counts[config.type]?.published || 0 }} yayında</VChip><VChip v-if="counts[config.type]?.scheduled" size="small" color="warning" variant="tonal">{{ counts[config.type].scheduled }} planlı</VChip></div></VCardText></VCard>
      </VCol>
    </VRow>
  </section>
</template>

<style scoped>
.overview-hero { background: linear-gradient(110deg, rgba(var(--v-theme-surface), 1), rgba(var(--v-theme-primary), .11)); border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.overview-search { min-inline-size: 240px; max-inline-size: 320px; }
.content-card { cursor: pointer; transition: transform .2s ease, border-color .2s ease; border: 1px solid transparent; }
.content-card:hover { transform: translateY(-3px); border-color: rgba(var(--v-theme-primary), .45); }
.description { min-block-size: 42px; }
@media (max-width: 600px) { .overview-search { inline-size: 100%; max-inline-size: none; } }
</style>
