<script setup lang="ts">
import axios from "@/plugins/axios"
import type { ContentField, ContentTypeConfig } from "@/config/casino-content/types"
import { computed, onMounted, ref, watch } from "vue"
import { VDataTable } from "vuetify/labs/VDataTable"

const props = defineProps<{ config: ContentTypeConfig }>()
const statuses = ["draft", "scheduled", "published", "archived"]
const items = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const dialog = ref(false)
const deleting = ref<any>(null)
const auditDialog = ref(false)
const auditLoading = ref(false)
const auditItems = ref<any[]>([])
const auditSubject = ref<any>(null)
const selectedStatus = ref("")
const selectedLocale = ref("")
const search = ref("")
const page = ref(1)
const total = ref(0)
const error = ref("")
const form = ref<any>({})
const editing = computed(() => Boolean(form.value._id))
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 25)))

// mission/bonus için varsayılanlar backend normalize katmanının ürettiği
// değerlerle aynı; böylece yeni kayıt formu boş/geçersiz açılmaz.
const defaultRules = () => {
  if (props.config.type === "mission") return { eventType: "wager", metric: "count", target: 1, currency: "USD", minimumAmount: 0, gameCodes: [], providerCodes: [], categories: [], period: "lifetime", autoJoin: false, perUserLimit: 1, globalLimit: 0 }
  if (props.config.type === "bonus") return { activation: "deposit", minimumDeposit: 0, maximumDeposit: 0, depositSequence: 0, windowHours: 48, activeHours: 72, currencies: [], period: "lifetime", perUserLimit: 1, globalLimit: 0, wagerMultiplier: 0, wagerMinBet: 0, wagerMaxBet: 0, wagerCategories: [], maxBonusAmount: 0, maxClaimMultiplier: 0, excludedCountries: [] }
  return {}
}
const emptyForm = () => ({
  // Frontend (canlı site) sadece "en" locale'i sorguluyor (casino-ui script'leri
  // hiç ?locale= parametresi göndermiyor, backend varsayılan olarak "en" kullanıyor).
  // Varsayılanı "tr" bırakmak, kayıt published olsa bile sitede asla görünmemesine
  // yol açıyordu — burada elle "en" seçilmediği sürece.
  type: props.config.type, slug: "", title: "", subtitle: "", description: "", image: "", mobileImage: "",
  category: "", locale: "en", status: "published", order: 0, startsAt: null, endsAt: null,
  cta: { label: "", href: "" }, reward: { type: "none", amount: 0, currency: "USD", wageringMultiplier: 0, spinCount: 0, betAmount: 0, gameCode: "", providerCode: "", expireHours: 72 },
  rules: defaultRules(), content: {}, reason: "",
})
const headers = computed(() => [
  { title: "Sıra", key: "order", width: 72 },
  { title: props.config.singular, key: "title" },
  ...props.config.fields.filter(field => !["title", "slug", "description", "subtitle", "locale", "order", "image", "mobileImage"].includes(field.key)).slice(0, 2).map(field => ({ title: field.label, key: `${field.scope}.${field.key}` })),
  { title: "Dil", key: "locale", width: 72 }, { title: "Durum", key: "status", width: 120 },
  { title: "Güncellendi", key: "updatedAt", width: 170 }, { title: "İşlemler", key: "actions", sortable: false, width: 150 },
])

function fieldValue(field: ContentField) {
  if (field.scope === "root") return form.value[field.key]
  return form.value[field.scope]?.[field.key]
}
function setField(field: ContentField, value: any) {
  if (field.kind === "tags" && typeof value === "string") value = value.split(",").map(item => item.trim()).filter(Boolean)
  if (field.scope === "root") form.value[field.key] = value
  else form.value[field.scope] = { ...(form.value[field.scope] || {}), [field.key]: value }
}
function displayValue(item: any, key: string) {
  const value = key.split(".").reduce((result, part) => result?.[part], item)
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "boolean") return value ? "Evet" : "Hayır"
  return value ?? "—"
}
async function load() {
  loading.value = true; error.value = ""
  try {
    const { data } = await axios.get("/admin/content", { params: { page: page.value, limit: 25, type: props.config.type, status: selectedStatus.value || undefined, locale: selectedLocale.value || undefined, search: search.value || undefined } })
    items.value = data.data || []; total.value = data.meta?.total || 0
  } catch (err: any) { error.value = err.response?.data?.error?.message || "İçerikler yüklenemedi." }
  finally { loading.value = false }
}
function createItem() { form.value = emptyForm(); dialog.value = true }
function editItem(item: any) {
  const base = emptyForm()
  // Eski kayıtlarda eksik olan alanlar varsayılanlarla tamamlanır; aksi halde
  // editör tanımsız değerlerle açılır ve kaydetmede alanlar sıfırlanırdı.
  form.value = { ...base, ...item, type: props.config.type, cta: { ...base.cta, ...(item.cta || {}) }, reward: { ...base.reward, ...(item.reward || {}) }, rules: { ...base.rules, ...(item.rules || {}) }, content: { ...(item.content || {}) }, reason: "" }
  dialog.value = true
}
async function save() {
  saving.value = true; error.value = ""
  try {
    // form bir ref olduğundan form.value derin reaktif bir Proxy'dir;
    // structuredClone bu Proxy'yi klonlarken tarayıcıya göre
    // "#<Object> could not be cloned" hatasıyla çökebiliyordu. Bu veri
    // zaten JSON olarak API'ye gönderileceği için JSON tabanlı klonlama
    // hem sorunu çözer hem de serileştirilemeyen değerleri sessizce atar.
    const payload = JSON.parse(JSON.stringify(form.value))
    payload.type = props.config.type
    for (const key of ["_id", "__v", "createdAt", "updatedAt", "createdBy", "updatedBy"]) delete payload[key]
    if (!String(payload.reason || "").trim()) throw new Error("Değişiklik nedeni zorunludur.")
    if (editing.value) await axios.patch(`/admin/content/${form.value._id}`, payload)
    else await axios.post("/admin/content", payload)
    dialog.value = false; await load()
  } catch (err: any) { error.value = err.response?.data?.error?.message || err.message || "Kayıt başarısız." }
  finally { saving.value = false }
}
async function togglePublish(item: any) {
  try { await axios.post(`/admin/content/${item._id}/publish`, { status: item.status === "published" ? "draft" : "published", reason: `${props.config.title} yayın durumu değiştirildi` }); await load() }
  catch (err: any) { error.value = err.response?.data?.error?.message || "Yayın durumu değiştirilemedi." }
}
async function archiveItem(item: any) {
  try { await axios.patch(`/admin/content/${item._id}`, { type: props.config.type, status: "archived", reason: `${props.config.title} kaydı arşivlendi` }); await load() }
  catch (err: any) { error.value = err.response?.data?.error?.message || "Kayıt arşivlenemedi." }
}
async function showAudit(item: any) {
  auditSubject.value = item; auditDialog.value = true; auditLoading.value = true; auditItems.value = []
  try { const { data } = await axios.get(`/admin/content/${item._id}/audit`); auditItems.value = data.data || [] }
  catch (err: any) { error.value = err.response?.data?.error?.message || "Audit geçmişi yüklenemedi." }
  finally { auditLoading.value = false }
}
async function removeItem() {
  if (!deleting.value) return
  try { await axios.delete(`/admin/content/${deleting.value._id}`, { data: { reason: form.value.deleteReason || "İçerik yönetiminden kalıcı olarak silindi" } }); deleting.value = null; await load() }
  catch (err: any) { error.value = err.response?.data?.error?.message || "Kayıt silinemedi." }
}
watch([selectedStatus, selectedLocale], () => { page.value = 1; load() })
watch(page, load)
onMounted(load)
</script>

<template>
  <section class="content-workspace d-flex flex-column ga-5">
    <VCard class="hero-card" variant="flat">
      <VCardText class="d-flex flex-wrap align-center ga-4 pa-6">
        <VAvatar :color="config.accent" variant="tonal" size="56"><VIcon :icon="config.icon" size="30" /></VAvatar>
        <div class="flex-grow-1"><div class="text-h4 font-weight-bold">{{ config.title }}</div><div class="text-body-1 text-medium-emphasis mt-1">{{ config.description }}</div></div>
        <VBtn :color="config.accent" size="large" prepend-icon="tabler-plus" @click="createItem">Yeni {{ config.singular }}</VBtn>
      </VCardText>
    </VCard>

    <VCard>
      <VCardText class="d-flex flex-wrap ga-3 align-center">
        <VTextField v-model="search" label="Ara" prepend-inner-icon="tabler-search" hide-details clearable class="filter-search" @keyup.enter="load" @click:clear="load" />
        <VSelect v-model="selectedStatus" :items="[{ title: 'Tüm durumlar', value: '' }, ...statuses.map(value => ({ title: value, value }))]" label="Durum" hide-details class="filter-select" />
        <VSelect v-model="selectedLocale" :items="[{ title: 'Tüm diller', value: '' }, 'tr', 'en', 'de', 'ru']" label="Dil" hide-details class="filter-select" />
        <VBtn variant="tonal" prepend-icon="tabler-refresh" @click="load">Yenile</VBtn>
      </VCardText>
      <VAlert v-if="error" type="error" variant="tonal" class="mx-5 mb-4" closable @click:close="error = ''">{{ error }}</VAlert>
      <VDataTable :headers="headers" :items="items" :loading="loading" :items-per-page="25" hover>
        <template #item="{ item, columns }"><tr><td v-for="column in columns" :key="column.key">
          <template v-if="column.key === 'status'"><VChip :color="item.raw.status === 'published' ? 'success' : item.raw.status === 'scheduled' ? 'warning' : item.raw.status === 'archived' ? 'secondary' : 'info'" size="small" variant="tonal">{{ item.raw.status }}</VChip></template>
          <template v-else-if="column.key === 'updatedAt'">{{ new Date(item.raw.updatedAt).toLocaleString('tr-TR') }}</template>
          <template v-else-if="column.key === 'actions'"><div class="d-flex ga-1"><VBtn icon="tabler-edit" size="small" variant="text" aria-label="Düzenle" @click="editItem(item.raw)" /><VBtn :icon="item.raw.status === 'published' ? 'tabler-eye-off' : 'tabler-send'" size="small" variant="text" aria-label="Yayın durumunu değiştir" @click="togglePublish(item.raw)" /><VMenu><template #activator="{ props: menuProps }"><VBtn v-bind="menuProps" icon="tabler-dots-vertical" size="small" variant="text" aria-label="Diğer işlemler" /></template><VList><VListItem prepend-icon="tabler-history" title="Değişiklik geçmişi" @click="showAudit(item.raw)" /><VListItem prepend-icon="tabler-archive" title="Arşivle" @click="archiveItem(item.raw)" /><VListItem prepend-icon="tabler-trash" title="Kalıcı sil" class="text-error" @click="form.deleteReason = ''; deleting = item.raw" /></VList></VMenu></div></template>
          <template v-else>{{ displayValue(item.raw, String(column.key)) }}</template>
        </td></tr></template>
        <template #no-data><div class="empty-state pa-12 text-center"><VIcon :icon="config.icon" size="48" class="text-disabled mb-3" /><div class="text-h6">Henüz {{ config.singular.toLocaleLowerCase('tr-TR') }} yok</div><div class="text-body-2 text-medium-emphasis mt-1">İlk kaydı oluşturmak için sağ üstteki butonu kullanın.</div></div></template>
        <template #bottom><div class="d-flex align-center justify-space-between flex-wrap ga-3 pa-4 border-t"><span class="text-body-2 text-medium-emphasis">{{ total }} kayıt</span><VPagination v-if="pageCount > 1" v-model="page" :length="pageCount" density="comfortable" /></div></template>
      </VDataTable>
    </VCard>

    <VDialog v-model="dialog" max-width="1040" persistent scrollable>
      <VCard>
        <VCardItem class="pa-6 border-b"><template #prepend><VAvatar :color="config.accent" variant="tonal"><VIcon :icon="config.icon" /></VAvatar></template><VCardTitle>{{ editing ? `${config.singular} düzenle` : `Yeni ${config.singular}` }}</VCardTitle><VCardSubtitle>Yalnız {{ config.title }} alanları gösteriliyor.</VCardSubtitle></VCardItem>
        <!-- mission/bonus gibi türler kendi yapılandırılmış editörünü verir;
             diğer türler jenerik alan döngüsünü kullanmaya devam eder. -->
        <VCardText v-if="$slots.editor" class="pa-6">
          <slot name="editor" :form="form" :update="(value: any) => (form = value)" />
          <VRow class="mt-2">
            <VCol cols="12" md="6"><VSelect v-model="form.status" :items="statuses" label="Yayın durumu" /></VCol>
            <VCol cols="12" md="6"><VTextField v-model="form.reason" label="Değişiklik nedeni" required prepend-inner-icon="tabler-history" hint="Audit kaydında görünecek kısa açıklama." persistent-hint /></VCol>
          </VRow>
        </VCardText>
        <VCardText v-else class="pa-6"><VRow>
          <VCol v-for="field in config.fields" :key="`${field.scope}.${field.key}`" cols="12" :md="field.kind === 'textarea' ? 12 : field.kind === 'switch' ? 4 : 6">
            <VTextarea v-if="field.kind === 'textarea'" :model-value="fieldValue(field)" :label="field.label" :hint="field.hint" :persistent-hint="Boolean(field.hint)" :required="field.required" rows="4" @update:model-value="setField(field, $event)" />
            <VSelect v-else-if="field.kind === 'select'" :model-value="fieldValue(field)" :items="field.items" :label="field.label" :required="field.required" clearable @update:model-value="setField(field, $event)" />
            <VSwitch v-else-if="field.kind === 'switch'" :model-value="Boolean(fieldValue(field))" :label="field.label" color="primary" inset @update:model-value="setField(field, $event)" />
            <VCombobox v-else-if="field.kind === 'tags'" :model-value="fieldValue(field) || []" :label="field.label" multiple chips closable-chips @update:model-value="setField(field, $event)" />
            <VTextField v-else :model-value="fieldValue(field)" :label="field.label" :type="field.kind === 'number' ? 'number' : field.kind === 'date' ? 'datetime-local' : 'text'" :min="field.min" :max="field.max" :required="field.required" :prepend-inner-icon="field.kind === 'image' ? 'tabler-photo' : undefined" @update:model-value="setField(field, $event)" />
            <VImg v-if="field.kind === 'image' && fieldValue(field)" :src="fieldValue(field)" height="120" cover class="rounded border mt-n3" />
          </VCol>
          <VCol cols="12" md="6"><VSelect v-model="form.status" :items="statuses" label="Yayın durumu" /></VCol>
          <VCol cols="12"><VTextField v-model="form.reason" label="Değişiklik nedeni" required prepend-inner-icon="tabler-history" hint="Audit kaydında görünecek kısa açıklama." persistent-hint /></VCol>
        </VRow></VCardText>
        <!-- Kaydetme hataları diyalog içinde gösterilir; liste kartındaki alert
             modalın arkasında kalıp görünmez oluyordu. -->
        <VAlert v-if="error && dialog" type="error" variant="tonal" class="mx-6 mb-2" closable @click:close="error = ''">{{ error }}</VAlert>
        <VCardActions class="pa-6 border-t"><VSpacer /><VBtn variant="text" @click="dialog = false; error = ''">Vazgeç</VBtn><VBtn :color="config.accent" :loading="saving" prepend-icon="tabler-device-floppy" @click="save">Kaydet</VBtn></VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="auditDialog" max-width="760" scrollable><VCard><VCardItem class="pa-6 border-b"><template #prepend><VAvatar color="primary" variant="tonal"><VIcon icon="tabler-history" /></VAvatar></template><VCardTitle>Değişiklik geçmişi</VCardTitle><VCardSubtitle>{{ auditSubject?.title }}</VCardSubtitle></VCardItem><VCardText class="pa-0"><VProgressLinear v-if="auditLoading" indeterminate /><VList v-else-if="auditItems.length" lines="three"><VListItem v-for="entry in auditItems" :key="entry._id" :title="entry.action" :subtitle="`${entry.reason || 'Neden belirtilmedi'} · ${new Date(entry.createdAt).toLocaleString('tr-TR')}`"><template #prepend><VAvatar size="34" variant="tonal"><VIcon icon="tabler-history-toggle" size="18" /></VAvatar></template></VListItem></VList><div v-else class="pa-10 text-center text-medium-emphasis">Bu kayıt için audit geçmişi yok.</div></VCardText><VCardActions class="pa-4 border-t"><VSpacer /><VBtn @click="auditDialog = false">Kapat</VBtn></VCardActions></VCard></VDialog>

    <VDialog :model-value="Boolean(deleting)" max-width="500"><VCard><VCardTitle class="pa-6">{{ config.singular }} kalıcı olarak silinsin mi?</VCardTitle><VCardText>Kullanıcı aktivitesi bulunan kayıtlar silinemez; bunun yerine arşivleyebilirsiniz.<VTextField v-model="form.deleteReason" label="Silme nedeni" class="mt-5" /></VCardText><VCardActions class="pa-6"><VSpacer /><VBtn variant="text" @click="deleting = null">Vazgeç</VBtn><VBtn color="error" @click="removeItem">Kalıcı sil</VBtn></VCardActions></VCard></VDialog>
  </section>
</template>

<style scoped>
.hero-card { background: linear-gradient(110deg, rgba(var(--v-theme-surface), 1), rgba(var(--v-theme-primary), .09)); border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.filter-search { min-inline-size: 240px; max-inline-size: 360px; }
.filter-select { inline-size: 170px; max-inline-size: 100%; }
.empty-state { min-block-size: 250px; }
@media (max-width: 600px) { .filter-search, .filter-select { inline-size: 100%; max-inline-size: none; } }
</style>
