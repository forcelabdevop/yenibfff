<script setup lang="ts">
import axios from "@/plugins/axios"
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { VDataTable } from "vuetify/labs/VDataTable"

const types = [
  { title: "Missions", value: "mission" },
  { title: "Bonuses", value: "bonus" },
  { title: "Promotions", value: "promotion" },
  { title: "VIP Benefits", value: "vip-benefit" },
  { title: "VIP Managers", value: "vip-manager" },
  { title: "VIP FAQ", value: "vip-faq" },
  { title: "Referral Tiers", value: "referral-tier" },
  { title: "Site Navigation", value: "site-navigation" },
  { title: "Site Footer", value: "site-footer" },
  { title: "Help Articles", value: "help-article" },
  { title: "Homepage Hero", value: "home-hero" },
  { title: "Homepage Sections", value: "home-section" },
  { title: "Casino Rails", value: "casino-rail" },
  { title: "Provider Showcases", value: "provider-showcase" },
  { title: "Battle Showcases", value: "battle-showcase" },
  { title: "UI Copy", value: "ui-copy" },
  { title: "Crypto Staking", value: "crypto-staking" },
  { title: "Crypto Swap", value: "crypto-swap" },
  { title: "Crypto Futures", value: "crypto-futures-display" },
  { title: "Crypto Lootboxes", value: "crypto-lootbox-display" },
]
const statuses = ["draft", "scheduled", "published", "archived"]
const rewardTypes = ["none", "balance", "bonus", "free-spins", "xp"]
const route = useRoute()
const router = useRouter()
const validTypes = new Set(types.map(item => item.value))
const routeType = typeof route.query.type === "string" && validTypes.has(route.query.type) ? route.query.type : ""
const items = ref<any[]>([])
const loading = ref(false)
const dialog = ref(false)
const deleting = ref<any>(null)
const selectedType = ref(routeType)
const selectedStatus = ref("")
const search = ref("")
const page = ref(1)
const total = ref(0)
const error = ref("")
const form = ref<any>({})

const emptyForm = () => ({
  type: selectedType.value || "mission", slug: "", title: "", subtitle: "", description: "",
  image: "", mobileImage: "", category: "", locale: "en", status: "draft", order: 0,
  startsAt: null, endsAt: null, cta: { label: "", href: "" },
  reward: { type: "none", amount: 0, currency: "USD", wageringMultiplier: 0 },
  rulesJson: "{}", contentJson: "{}", reason: "",
})
const headers = [
  { title: "Order", key: "order", width: 80 }, { title: "Type", key: "type" },
  { title: "Title", key: "title" }, { title: "Locale", key: "locale", width: 90 },
  { title: "Status", key: "status", width: 120 }, { title: "Updated", key: "updatedAt" },
  { title: "Actions", key: "actions", sortable: false, width: 180 },
]
const editing = computed(() => Boolean(form.value._id))

async function load() {
  loading.value = true; error.value = ""
  try {
    const { data } = await axios.get("/admin/content", { params: { page: page.value, limit: 50, type: selectedType.value || undefined, status: selectedStatus.value || undefined, search: search.value || undefined } })
    items.value = data.data || []; total.value = data.meta?.total || 0
  } catch (err: any) { error.value = err.response?.data?.error?.message || "Content could not be loaded." }
  finally { loading.value = false }
}
function createItem() { form.value = emptyForm(); dialog.value = true }
function editItem(item: any) {
  form.value = { ...emptyForm(), ...item, cta: { ...emptyForm().cta, ...(item.cta || {}) }, reward: { ...emptyForm().reward, ...(item.reward || {}) }, rulesJson: JSON.stringify(item.rules || {}, null, 2), contentJson: JSON.stringify(item.content || {}, null, 2), reason: "" }
  dialog.value = true
}
async function save() {
  error.value = ""
  try {
    const payload = { ...form.value, rules: JSON.parse(form.value.rulesJson || "{}"), content: JSON.parse(form.value.contentJson || "{}") }
    delete payload.rulesJson; delete payload.contentJson; delete payload._id; delete payload.__v; delete payload.createdAt; delete payload.updatedAt
    if (editing.value) await axios.patch(`/admin/content/${form.value._id}`, payload)
    else await axios.post("/admin/content", payload)
    dialog.value = false; await load()
  } catch (err: any) { error.value = err.response?.data?.error?.message || err.message || "Save failed." }
}
async function togglePublish(item: any) {
  await axios.post(`/admin/content/${item._id}/publish`, { status: item.status === "published" ? "draft" : "published", reason: "Admin content publishing" }); await load()
}
async function removeItem() {
  if (!deleting.value) return
  await axios.delete(`/admin/content/${deleting.value._id}`, { data: { reason: "Removed from content administration" } }); deleting.value = null; await load()
}
watch(() => route.query.type, type => {
  const nextType = typeof type === "string" && validTypes.has(type) ? type : ""
  if (selectedType.value !== nextType) selectedType.value = nextType
})
watch(selectedType, type => {
  const query = { ...route.query }
  if (type) query.type = type
  else delete query.type
  if (route.query.type !== type) router.replace({ query })
})
watch([selectedType, selectedStatus], () => { page.value = 1; load() })
onMounted(load)
</script>

<template>
  <section class="d-flex flex-column ga-4">
    <VCard>
      <VCardItem><VCardTitle>Casino Content Management</VCardTitle><VCardSubtitle>Manage missions, bonuses, promotions, referrals, VIP Club and homepage content from MongoDB.</VCardSubtitle></VCardItem>
      <VCardText class="d-flex flex-wrap ga-3 align-center">
        <VSelect v-model="selectedType" :items="[{ title: 'All types', value: '' }, ...types]" label="Content type" hide-details style="max-inline-size: 240px" />
        <VSelect v-model="selectedStatus" :items="['', ...statuses]" label="Status" hide-details style="max-inline-size: 180px" />
        <VTextField v-model="search" label="Search" prepend-inner-icon="tabler-search" hide-details style="max-inline-size: 280px" @keyup.enter="load" />
        <VSpacer /><VBtn prepend-icon="tabler-plus" @click="createItem">New content</VBtn>
      </VCardText>
      <VAlert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</VAlert>
      <VDataTable :headers="headers" :items="items" :loading="loading" :items-per-page="50">
        <template #item.status="{ item }"><VChip :color="item.raw.status === 'published' ? 'success' : item.raw.status === 'scheduled' ? 'warning' : 'secondary'" size="small">{{ item.raw.status }}</VChip></template>
        <template #item.updatedAt="{ item }">{{ new Date(item.raw.updatedAt).toLocaleString() }}</template>
        <template #item.actions="{ item }"><div class="d-flex ga-1"><VBtn icon="tabler-edit" size="small" variant="text" @click="editItem(item.raw)" /><VBtn :icon="item.raw.status === 'published' ? 'tabler-eye-off' : 'tabler-send'" size="small" variant="text" @click="togglePublish(item.raw)" /><VBtn icon="tabler-trash" color="error" size="small" variant="text" @click="deleting = item.raw" /></div></template>
        <template #bottom><div class="pa-4 text-medium-emphasis">{{ total }} records</div></template>
      </VDataTable>
    </VCard>

    <VDialog v-model="dialog" max-width="920" persistent><VCard><VCardTitle class="pa-6">{{ editing ? 'Edit content' : 'Create content' }}</VCardTitle><VCardText><VRow>
      <VCol cols="12" md="4"><VSelect v-model="form.type" :items="types" label="Type" /></VCol><VCol cols="12" md="4"><VTextField v-model="form.slug" label="Slug" /></VCol><VCol cols="12" md="2"><VTextField v-model="form.locale" label="Locale" /></VCol><VCol cols="12" md="2"><VTextField v-model.number="form.order" type="number" label="Order" /></VCol>
      <VCol cols="12" md="8"><VTextField v-model="form.title" label="Title" /></VCol><VCol cols="12" md="4"><VSelect v-model="form.status" :items="statuses" label="Status" /></VCol>
      <VCol cols="12"><VTextField v-model="form.subtitle" label="Subtitle" /></VCol><VCol cols="12"><VTextarea v-model="form.description" label="Description / terms" rows="3" /></VCol>
      <VCol cols="12" md="6"><VTextField v-model="form.image" label="Desktop image URL" /></VCol><VCol cols="12" md="6"><VTextField v-model="form.mobileImage" label="Mobile image URL" /></VCol>
      <VCol cols="12" md="4"><VSelect v-model="form.reward.type" :items="rewardTypes" label="Reward type" /></VCol><VCol cols="12" md="4"><VTextField v-model.number="form.reward.amount" type="number" min="0" label="Reward amount" /></VCol><VCol cols="12" md="4"><VTextField v-model="form.reward.currency" label="Currency" /></VCol>
      <VCol cols="12" md="6"><VTextarea v-model="form.rulesJson" label="Eligibility / progress rules (JSON)" rows="7" class="font-monospace" /></VCol><VCol cols="12" md="6"><VTextarea v-model="form.contentJson" label="Structured page content (JSON)" rows="7" class="font-monospace" /></VCol>
      <VCol cols="12"><VTextField v-model="form.reason" label="Audit reason" /></VCol>
    </VRow></VCardText><VCardActions class="pa-6"><VSpacer/><VBtn variant="text" @click="dialog = false">Cancel</VBtn><VBtn @click="save">Save</VBtn></VCardActions></VCard></VDialog>
    <VDialog :model-value="Boolean(deleting)" max-width="460"><VCard><VCardTitle>Delete content?</VCardTitle><VCardText>Records with user activity cannot be deleted and must be archived.</VCardText><VCardActions><VSpacer/><VBtn variant="text" @click="deleting = null">Cancel</VBtn><VBtn color="error" @click="removeItem">Delete</VBtn></VCardActions></VCard></VDialog>
  </section>
</template>
