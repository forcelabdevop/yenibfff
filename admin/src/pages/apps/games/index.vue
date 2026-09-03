<script setup>
import { paginationMeta } from "@/@fake-db/utils";
import { useProviderDisplayNames } from "@/composables/useProviderDisplayNames";
import { useGameListStore } from "@/pages/apps/games/useGameListStore";
import axios from "@axios";
import { useRouter } from "vue-router";
import { VDataTableServer } from "vuetify/labs/VDataTable";

const gameListStore = useGameListStore();
const searchQuery = ref("");
const selectedCategory = ref();
const selectedProvider = ref();
const selectedDistribution = ref();
const totalGames = ref(0);
const games = ref([]);
const categoryOptions = ref([]);
const editCategoryOptions = ref([]);
const providerOptions = ref([]);
const router = useRouter();
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const {
	formatProviderDisplayName,
	getProviderDisplayItems,
	loadProviderDisplayNames,
} = useProviderDisplayNames();

const options = ref({
	page: 1,
	itemsPerPage: 10,
	sortBy: [],
});

const distributionCodes = ["drakon", "nexus", "betinovi", "betcolabs"];
const distributionOptions = computed(() => getProviderDisplayItems(distributionCodes));
const providerOptionItems = computed(() => getProviderDisplayItems(providerOptions.value));

const headers = [
	{ title: "Banner", key: "raw.banner" },
	{ title: "Game", key: "raw.game_name" },
	{ title: "Categories", key: "raw.categories" },
	{ title: "Type", key: "raw.game_type" },
	{ title: "Provider", key: "raw.provider_code" },
	{ title: "Source", key: "raw.distribution" },
	{ title: "Featured", key: "raw.featured" },
	{ title: "Status", key: "raw.status" },
	{ title: "Actions", key: "raw.actions", sortable: false },
];

const isAddNewGameDrawerVisible = ref(false);
const isEditGameModalVisible = ref(false);
const gameToEdit = ref(null);
const bannerFile = ref(null);
const backgroundFile = ref(null);
const backgroundImageUrl = ref("");

const resolveImageUrl = (value) => {
	if (!value) return "";
	if (!value.startsWith("/")) return value;

	return BASE_URL ? `${BASE_URL}${value}` : value;
};

const getSingleFile = (value) => (Array.isArray(value) ? value[0] : value);

const closeEditGameModal = () => {
	isEditGameModalVisible.value = false;
	bannerFile.value = null;
	backgroundFile.value = null;
	backgroundImageUrl.value = "";
	gameToEdit.value = null;
};

const fetchGames = () => {
	const sort = options.value.sortBy.length
		? {
				key: options.value.sortBy[0].key.replace("raw.", ""),
				order: options.value.sortBy[0].order === "desc" ? -1 : 1,
		  }
		: null;

	gameListStore
		.fetchGames({
			search: searchQuery.value,
			category: selectedCategory.value,
			provider: selectedProvider.value,
			distribution: selectedDistribution.value,
			page: options.value.page,
			limit: options.value.itemsPerPage,
			sort_by: sort?.key,
			order: sort?.order === 1 ? "asc" : "desc",
		})
		.then((res) => {
			const data = res?.data || [];
			const mapped = data.map((g) => ({
				...g,
				provider_code:
					g.provider_code || g.provider?.provider_code || "—",
			}));
			games.value = mapped;
			totalGames.value = typeof res.total === "number" ? res.total : 0;
		})
		.catch((err) => {
			console.error("❌ API Hatası:", err);
		});
};

const fetchGameMeta = async () => {
	try {
		const res = await axios.get("/admin/games/meta");
		categoryOptions.value = res.data.categories || [];
		providerOptions.value = res.data.providerCodes || [];
	} catch (err) {
		console.error("Meta veriler alınamadı:", err);
	}
};

onMounted(async () => {
	await loadProviderDisplayNames({ force: true });
	fetchGameMeta();
	loadAllCategoryOptions();
});

const getDistributionColor = (distribution) => {
	const colors = {
		drakon: "primary",
		betinovi: "warning",
		betcolabs: "info",
		nexus: "success",
	};

	return colors[String(distribution || "").toLowerCase()] || "secondary";
};

watchEffect(fetchGames);
watch(
	[selectedCategory, selectedProvider, selectedDistribution, searchQuery],
	fetchGames
);

const deleteGame = (id) => {
	gameListStore.deleteGame(id).then(() => fetchGames());
};

const saveGameEdits = () => {
	const selectedBannerFile = getSingleFile(bannerFile.value);
	const selectedBackgroundFile = getSingleFile(backgroundFile.value);
	const formData = new FormData();
	Object.keys(gameToEdit.value).forEach((key) => {
		if (
			(key !== 'banner' || !selectedBannerFile) &&
			(key !== 'background' ||
				(!selectedBackgroundFile && !backgroundImageUrl.value.trim()))
		) {
			const val = gameToEdit.value[key];
			formData.append(key, Array.isArray(val) ? JSON.stringify(val) : val);
		}
	});
	if (selectedBannerFile) {
		formData.append('bannerFile', selectedBannerFile);
	}
	if (selectedBackgroundFile) {
		formData.append('backgroundFile', selectedBackgroundFile);
	} else if (backgroundImageUrl.value.trim()) {
		formData.append('backgroundImageUrl', backgroundImageUrl.value.trim());
	}
	axios
		.put(
			`/admin/games/${gameToEdit.value._id}`,
			formData,
			{ headers: { 'Content-Type': 'multipart/form-data' } }
		)
		.then(() => {
			closeEditGameModal();
			fetchGames();
		})
		.catch((err) => {
			console.error("❌ Game update error:", err);
		});
};

const editGame = async (game) => {
	// Ensure categories array exists (migrate from legacy category field if needed)
	const categories = game.categories?.length
		? game.categories
		: game.category
		? [game.category]
		: [];

	// themes/features her oyunda mevcut olmayabilir (eski kayıtlar) — VCombobox'ın
	// hata vermemesi için dizi garanti edilir.
	gameToEdit.value = {
		...game,
		categories,
		themes: Array.isArray(game.themes) ? game.themes : [],
		features: Array.isArray(game.features) ? game.features : [],
	};
	bannerFile.value = null;
	backgroundFile.value = null;
	backgroundImageUrl.value = "";
	isEditGameModalVisible.value = true;

	try {
		const res = await axios.get("/admin/categories");
		editCategoryOptions.value = res.data.data.map((cat) => ({
			title: cat.name,
			value: cat.slug,
		}));
	} catch (err) {
		console.error("Kategori listesi alınamadı:", err);
		editCategoryOptions.value = [];
	}
};

// -------------------- Sağlayıcı → Kategori Toplu Atama --------------------
// "slot-fazi" gibi bir provider_code'a sahip yüzlerce oyunu tek tek
// açmadan tek istekle bir kategoriye atamak/kaldırmak için. Bir sağlayıcı
// hem Slot hem Canlı Casino hem Hızlı Oyun barındırabildiğinden, "Oyun
// Tipi" çoklu seçimiyle bu ayrımı da yapabiliyoruz (boş = sağlayıcının
// TÜM oyun tipleri).
const bulkProvider = ref();
const bulkCategory = ref();
const bulkAction = ref("add");
const bulkGameTypeGroups = ref([]);
const bulkApplying = ref(false);
const bulkResult = ref(null); // { success, message } | { error }
const allCategoryOptions = ref([]);

// game_type verileri sağlayıcılar arasında tutarsız yazıldığından
// (Slot/slot/Slots, Baccarat/baccarat vb.) ham değerler yerine backend'in
// GAME_TYPE_GROUPS ile eşleştirdiği anlamlı gruplar sunuluyor.
const gameTypeGroupOptions = [
	{ title: "Slot", value: "slot" },
	{ title: "Canlı Casino", value: "live_casino" },
	{ title: "Hızlı Oyunlar", value: "fast_games" },
	{ title: "Diğer", value: "other" },
];

const bulkPreview = ref(null); // { matched, byType: [{game_type, count}] }
const bulkPreviewLoading = ref(false);

const loadAllCategoryOptions = async () => {
	try {
		const res = await axios.get("/admin/categories");
		allCategoryOptions.value = res.data.data.map((cat) => ({
			title: cat.name,
			value: cat.slug,
		}));
	} catch (err) {
		console.error("Kategori listesi alınamadı:", err);
		allCategoryOptions.value = [];
	}
};

// Seçili sağlayıcı + oyun tipi grubuna kaç oyunun düştüğünü, hiçbir şeyi
// güncellemeden gösterir — onay diyaloğundan önce admin'in etkiyi görmesi
// için.
const fetchBulkPreview = async () => {
	if (!bulkProvider.value) {
		bulkPreview.value = null;
		return;
	}
	bulkPreviewLoading.value = true;
	try {
		const { data } = await axios.get(
			"/admin/games/bulk-assign-category/preview",
			{
				params: {
					provider_code: bulkProvider.value,
					game_type_groups: bulkGameTypeGroups.value.join(",") || undefined,
				},
			},
		);
		bulkPreview.value = data.data;
	} catch (err) {
		console.error("Toplu atama önizlemesi alınamadı:", err);
		bulkPreview.value = null;
	} finally {
		bulkPreviewLoading.value = false;
	}
};

watch([bulkProvider, bulkGameTypeGroups], fetchBulkPreview, { deep: true });

const applyBulkCategoryAssign = async () => {
	if (!bulkProvider.value || !bulkCategory.value) return;

	const providerLabel =
		providerOptionItems.value.find((p) => p.value === bulkProvider.value)
			?.title || bulkProvider.value;
	const categoryLabel =
		allCategoryOptions.value.find((c) => c.value === bulkCategory.value)
			?.title || bulkCategory.value;
	const actionLabel = bulkAction.value === "remove" ? "kaldırılsın" : "eklensin";
	const typeLabel = bulkGameTypeGroups.value.length
		? bulkGameTypeGroups.value
				.map(
					(v) => gameTypeGroupOptions.find((o) => o.value === v)?.title || v,
				)
				.join(", ")
		: "tüm oyun tipleri";
	const matchedCount = bulkPreview.value?.matched;
	const countText =
		typeof matchedCount === "number" ? `${matchedCount} oyun` : "eşleşen oyunlar";

	if (
		!window.confirm(
			`"${providerLabel}" sağlayıcısının [${typeLabel}] kapsamındaki ${countText}na "${categoryLabel}" kategorisi ${actionLabel} mı?`,
		)
	) {
		return;
	}

	bulkApplying.value = true;
	bulkResult.value = null;
	try {
		const { data } = await axios.post("/admin/games/bulk-assign-category", {
			provider_code: bulkProvider.value,
			category: bulkCategory.value,
			action: bulkAction.value,
			game_type_groups: bulkGameTypeGroups.value,
		});
		bulkResult.value = { success: true, message: data.message };
		fetchGameMeta();
		fetchGames();
		fetchBulkPreview();
	} catch (err) {
		bulkResult.value = {
			success: false,
			message: err.response?.data?.message || err.message,
		};
	} finally {
		bulkApplying.value = false;
	}
};
</script>

<template>
	<section>
		<VRow>
			<VCol
				v-for="meta in [
					{
						icon: 'tabler-device-gamepad',
						color: 'primary',
						title: 'Games',
						stats: totalGames,
						percentage: +12,
						subtitle: 'Total Games',
					},
					{
						icon: 'tabler-star',
						color: 'success',
						title: 'Featured',
						stats: '12',
						percentage: +5,
						subtitle: 'Featured games',
					},
					{
						icon: 'tabler-eye',
						color: 'info',
						title: 'Viewed',
						stats: '3546',
						percentage: +8,
						subtitle: 'Total views',
					},
					{
						icon: 'tabler-activity',
						color: 'warning',
						title: 'Status',
						stats: 'Active',
						percentage: 0,
						subtitle: 'Current filter',
					},
				]"
				:key="meta.title"
				cols="12"
				sm="6"
				lg="3"
			>
				<VCard>
					<VCardText class="d-flex justify-space-between">
						<div>
							<span>{{ meta.title }}</span>
							<div class="d-flex align-center gap-2 my-1">
								<h6 class="text-h4">
									{{ meta.stats }}
								</h6>
								<span
									:class="
										meta.percentage > 0
											? 'text-success'
											: 'text-error'
									"
								>
									( {{ meta.percentage > 0 ? "+" : "" }}
									{{ meta.percentage }}%)
								</span>
							</div>
							<span>{{ meta.subtitle }}</span>
						</div>
						<VAvatar
							rounded
							variant="tonal"
							:color="meta.color"
							:icon="meta.icon"
						/>
					</VCardText>
				</VCard>
			</VCol>

			<VCol cols="12">
				<VCard title="Sağlayıcı → Kategori Toplu Atama">
					<VCardText>
						<p class="text-body-2 text-medium-emphasis mb-4">
							Bir sağlayıcının (örn. <code>slot-fazi</code>) oyunlarına tek
							seferde bir kategori ekleyin veya kaldırın — tek tek oyun açıp
							kategori seçmenize gerek kalmaz. Sağlayıcının Slot, Canlı Casino
							ve Hızlı Oyun gibi farklı türleri tek kategoriye karışmasın diye
							"Oyun Tipi" ile daraltabilirsiniz (boş bırakılırsa sağlayıcının
							TÜM oyunları hedeflenir).
						</p>
						<VRow align="center">
							<VCol cols="12" sm="3">
								<AppSelect
									v-model="bulkProvider"
									label="Sağlayıcı Seç"
									:items="providerOptionItems"
									item-title="title"
									item-value="value"
									clearable
									clear-icon="tabler-x"
								/>
							</VCol>
							<VCol cols="12" sm="3">
								<AppSelect
									v-model="bulkGameTypeGroups"
									label="Oyun Tipi (boş = tümü)"
									:items="gameTypeGroupOptions"
									item-title="title"
									item-value="value"
									multiple
									chips
									closable-chips
									clearable
									clear-icon="tabler-x"
								/>
							</VCol>
							<VCol cols="12" sm="3">
								<AppSelect
									v-model="bulkCategory"
									label="Kategori Seç"
									:items="allCategoryOptions"
									item-title="title"
									item-value="value"
									clearable
									clear-icon="tabler-x"
								/>
							</VCol>
							<VCol cols="12" sm="1">
								<AppSelect
									v-model="bulkAction"
									label="İşlem"
									:items="[
										{ title: 'Ekle', value: 'add' },
										{ title: 'Kaldır', value: 'remove' },
									]"
									item-title="title"
									item-value="value"
								/>
							</VCol>
							<VCol cols="12" sm="2">
								<VBtn
									block
									:color="bulkAction === 'remove' ? 'error' : 'primary'"
									:loading="bulkApplying"
									:disabled="!bulkProvider || !bulkCategory"
									@click="applyBulkCategoryAssign"
								>
									Uygula
								</VBtn>
							</VCol>
						</VRow>

						<div v-if="bulkProvider" class="mt-2">
							<span
								v-if="bulkPreviewLoading"
								class="text-body-2 text-medium-emphasis"
							>
								Eşleşen oyun sayısı hesaplanıyor...
							</span>
							<template v-else-if="bulkPreview">
								<span class="text-body-2">
									Bu seçimle
									<strong>{{ bulkPreview.matched }}</strong>
									oyun eşleşiyor.
								</span>
								<span
									v-if="bulkPreview.byType?.length"
									class="text-body-2 text-medium-emphasis ms-2"
								>
									({{
										bulkPreview.byType
											.map((t) => `${t.game_type}: ${t.count}`)
											.join(", ")
									}})
								</span>
							</template>
						</div>

						<VAlert
							v-if="bulkResult"
							:type="bulkResult.success ? 'success' : 'error'"
							variant="tonal"
							class="mt-4"
							closable
							@click:close="bulkResult = null"
						>
							{{ bulkResult.message }}
						</VAlert>
					</VCardText>
				</VCard>
			</VCol>

			<VCol cols="12">
				<VCard title="Search Filter">
					<VCardText>
						<VRow>
							<VCol cols="12" sm="4">
								<AppSelect
									v-model="selectedCategory"
									label="Select Category"
									:items="categoryOptions"
									item-title="title"
									item-value="value"
									clearable
									clear-icon="tabler-x"
								/>
							</VCol>
							<VCol cols="12" sm="4">
								<AppSelect
									v-model="selectedProvider"
									label="Select Provider"
									:items="providerOptionItems"
									item-title="title"
									item-value="value"
									clearable
									clear-icon="tabler-x"
								/>
							</VCol>
							<VCol cols="12" sm="4">
								<AppSelect
									v-model="selectedDistribution"
									label="Select Source"
									:items="distributionOptions"
									item-title="title"
									item-value="value"
									clearable
									clear-icon="tabler-x"
								/>
							</VCol>
						</VRow>
					</VCardText>

					<VDivider />

					<VCardText class="d-flex flex-wrap py-4 gap-4">
						<div class="me-3 d-flex gap-3">
							<AppSelect
								:model-value="options.itemsPerPage"
								:items="[
									{ value: 10, title: '10' },
									{ value: 25, title: '25' },
									{ value: 50, title: '50' },
									{ value: 100, title: '100' },
									{ value: -1, title: 'All' },
								]"
								style="width: 6.25rem"
								@update:model-value="
									options.itemsPerPage = parseInt($event, 10)
								"
							/>
						</div>

						<VSpacer />

						<div
							class="app-user-search-filter d-flex align-center flex-wrap gap-4"
						>
							<div style="inline-size: 10rem">
								<AppTextField
									v-model="searchQuery"
									placeholder="Search"
									density="compact"
								/>
							</div>

							<VBtn
								variant="tonal"
								color="secondary"
								prepend-icon="tabler-screen-share"
							>
								Export
							</VBtn>
						</div>
					</VCardText>

					<VDivider />

					<VDataTableServer
						v-model:items-per-page="options.itemsPerPage"
						v-model:page="options.page"
						v-model:sort-by="options.sortBy"
						:items="games"
						:items-length="totalGames"
						:headers="headers"
						class="text-no-wrap"
					>
						<template #item.raw.banner="{ item }">
							<div class="position-relative d-inline-block">
								<VAvatar
									size="38"
									variant="tonal"
									:rounded="0"
									style="border-radius: 5px"
								>
									<VImg
										:src="resolveImageUrl(item.raw.banner)"
										alt="Banner"
										height="38"
										width="70"
										cover
									/>
								</VAvatar>
								<VIcon
									v-if="item.raw.imageLocked"
									icon="tabler-lock"
									size="14"
									color="warning"
									class="banner-lock-badge"
								>
									<VTooltip activator="parent">
										Görsel/isim içe aktarımdan korunuyor
									</VTooltip>
								</VIcon>
							</div>
						</template>

						<template #item.raw.game_name="{ item }">
							<span>{{ item.raw.game_name }}</span>
						</template>

						<template #item.raw.categories="{ item }">
							<div class="d-flex flex-wrap gap-1">
								<VChip
									v-for="cat in (
										item.raw.categories || [
											item.raw.category,
										]
									).filter(Boolean)"
									:key="cat"
									size="small"
									label
									color="info"
									class="text-capitalize"
								>
									{{ cat }}
								</VChip>
								<span
									v-if="
										!item.raw.categories?.length &&
										!item.raw.category
									"
									class="text-disabled"
									>—</span
								>
							</div>
						</template>

						<template #item.raw.game_type="{ item }">
							<span class="text-capitalize">{{
								item.raw.game_type
							}}</span>
						</template>

						<template #item.raw.provider_code="{ item }">
							<span>{{ formatProviderDisplayName(item.raw.provider_code) }}</span>
						</template>

						<template #item.raw.distribution="{ item }">
							<VChip
								:color="getDistributionColor(item.raw.distribution)"
								size="small"
								label
							>
								{{ formatProviderDisplayName(item.raw.distribution) }}
							</VChip>
						</template>

						<template #item.raw.featured="{ item }">
							<VSwitch
								density="compact"
								:model-value="item.raw.featured === 1"
								@update:model-value="
									(val) =>
										gameListStore.updateGameFeature(
											item.raw._id,
											val ? 1 : 0
										)
								"
							/>
						</template>

						<template #item.raw.status="{ item }">
							<VChip
								:color="
									item.raw.status === 1 ? 'success' : 'error'
								"
								size="small"
								label
								class="text-capitalize"
							>
								{{
									item.raw.status === 1
										? "Active"
										: "Inactive"
								}}
							</VChip>
						</template>

						<template #item.raw.actions="{ item }">
							<IconBtn @click="editGame(item.raw)">
								<VIcon icon="tabler-edit" />
							</IconBtn>
							<IconBtn @click="deleteGame(item.raw._id)">
								<VIcon icon="tabler-trash" />
							</IconBtn>
						</template>

						<template #bottom>
							<VDivider />
							<div
								class="d-flex align-center justify-sm-space-between justify-center flex-wrap gap-3 pa-5 pt-3"
							>
								<p class="text-sm text-disabled mb-0">
									{{ paginationMeta(options, totalGames) }}
								</p>

								<VPagination
									v-model="options.page"
									:length="
										Math.ceil(
											totalGames / options.itemsPerPage
										)
									"
									:total-visible="5"
								>
									<template #prev="slotProps">
										<VBtn
											variant="tonal"
											color="default"
											v-bind="slotProps"
											:icon="false"
										>
											Previous
										</VBtn>
									</template>

									<template #next="slotProps">
										<VBtn
											variant="tonal"
											color="default"
											v-bind="slotProps"
											:icon="false"
										>
											Next
										</VBtn>
									</template>
								</VPagination>
							</div>
						</template>
					</VDataTableServer>
					<VDialog v-model="isEditGameModalVisible" max-width="800">
						<VCard title="Edit Game">
							<VCardText>
								<VRow>
									<VCol cols="12" sm="6">
										<AppTextField
											v-model="gameToEdit.game_name"
											label="Game Name"
										/>
									</VCol>
									<VCol cols="12" sm="6">
										<AppTextField
											v-model="gameToEdit.game_code"
											label="Game Code"
										/>
									</VCol>
									<VCol cols="12" sm="6">
										<VFileInput
											v-model="bannerFile"
											label="Banner Image"
											accept="image/*"
											prepend-icon="tabler-photo"
										/>
										<div v-if="gameToEdit.banner" class="mt-1">
											<small class="text-disabled">Mevcut: {{ gameToEdit.banner }}</small>
										</div>
									</VCol>
									<VCol cols="12" sm="6">
										<AppTextField
											v-model="backgroundImageUrl"
											label="Background Image URL"
											placeholder="https://example.com/background.jpg"
										/>
										<div v-if="gameToEdit.background" class="mt-1">
											<small class="text-disabled">Mevcut background: {{ gameToEdit.background }}</small>
										</div>
									</VCol>
									<VCol cols="12" sm="6">
										<VFileInput
											v-model="backgroundFile"
											label="Background Image"
											accept="image/*"
											prepend-icon="tabler-photo-scan"
										/>
										<div class="mt-1">
											<small class="text-disabled">Dosya seçilirse URL alanı yok sayılır.</small>
										</div>
									</VCol>
									<VCol v-if="gameToEdit.background" cols="12">
										<VImg
											:src="resolveImageUrl(gameToEdit.background)"
											alt="Background"
											class="rounded"
											max-height="160"
											cover
										/>
									</VCol>
									<VCol cols="12" sm="6">
										<AppTextField
											v-model="gameToEdit.cover"
											label="Cover Path"
										/>
									</VCol>
									<VCol cols="12" sm="6">
										<AppSelect
											v-model="gameToEdit.categories"
											label="Categories"
											:items="editCategoryOptions"
											multiple
											chips
											closable-chips
										/>
									</VCol>
									<VCol cols="12" sm="6">
										<AppSelect
											v-model="gameToEdit.provider_code"
											label="Provider"
											:items="providerOptionItems"
											item-title="title"
											item-value="value"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VSwitch
											v-model="gameToEdit.featured"
											label="Featured"
											:true-value="1"
											:false-value="0"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VSwitch
											v-model="gameToEdit.status"
											label="Status"
											:true-value="1"
											:false-value="0"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VSwitch
											v-model="gameToEdit.has_freespins"
											label="Freespins"
											:true-value="1"
											:false-value="0"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VSwitch
											v-model="gameToEdit.has_lobby"
											label="Lobby"
											:true-value="1"
											:false-value="0"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VSwitch
											v-model="gameToEdit.has_tables"
											label="Tables"
											:true-value="1"
											:false-value="0"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VSwitch
											v-model="gameToEdit.is_mobile"
											label="Mobile"
											:true-value="1"
											:false-value="0"
										/>
									</VCol>
									<VCol cols="12">
										<VDivider class="mb-4" />
										<p class="text-body-2 font-weight-medium mb-1">
											Game Attributes (detay sayfası)
										</p>
										<p class="text-caption text-medium-emphasis mb-4">
											Sitedeki oyun detay sayfasının "Game Attributes"
											bölümünde gösterilir. Sağlayıcı listesinden
											otomatik gelmez, elle girilir ya da ayrı bir
											içe aktarma ile doldurulur. Canlı Casino/masa
											oyunlarında Layout, Bet Range, Max Win gibi
											alanlar boş bırakılabilir — boş alan detay
											sayfasında hiç gösterilmez.
										</p>
									</VCol>
									<VCol cols="12" sm="3">
										<AppTextField
											v-model="gameToEdit.layout"
											label="Layout"
											placeholder="örn: 6x5"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<AppTextField
											v-model="gameToEdit.paylines"
											label="Paylines"
											placeholder="örn: Pay Anywhere"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<AppSelect
											v-model="gameToEdit.volatility"
											label="Volatility"
											:items="['Low', 'Medium', 'High', 'Very High']"
											clearable
											clear-icon="tabler-x"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<AppTextField
											v-model.number="gameToEdit.max_win_multiplier"
											label="Max Win (x)"
											type="number"
											placeholder="örn: 25000"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<AppTextField
											v-model.number="gameToEdit.bet_min"
											label="Min Bahis"
											type="number"
											placeholder="örn: 0.2"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<AppTextField
											v-model.number="gameToEdit.bet_max"
											label="Maks. Bahis"
											type="number"
											placeholder="örn: 240"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VCombobox
											v-model="gameToEdit.themes"
											label="Themes"
											multiple
											chips
											closable-chips
											hide-no-data
											placeholder="Yazıp Enter'a bas"
										/>
									</VCol>
									<VCol cols="12" sm="3">
										<VCombobox
											v-model="gameToEdit.features"
											label="Features"
											multiple
											chips
											closable-chips
											hide-no-data
											placeholder="Yazıp Enter'a bas"
										/>
									</VCol>
									<VCol cols="12">
										<VDivider class="mb-4" />
										<VSwitch
											v-model="gameToEdit.imageLocked"
											color="warning"
											label="Görseli/İsmi İçe Aktarımdan Koru"
											hide-details
										/>
										<small class="text-disabled">
											Açık olduğunda, Betinovi/Drakon/Nexus içe aktarma
											işlemleri "Görselleri de güncelle" seçili olsa
											bile bu oyunun banner/isim bilgisini değiştirmez.
											Banner dosyası elle yüklendiğinde bu otomatik
											olarak açılır.
										</small>
									</VCol>
								</VRow>
							</VCardText>
							<VCardActions>
								<VSpacer />
								<VBtn
									color="secondary"
									variant="tonal"
									@click="closeEditGameModal"
									>Cancel</VBtn
								>
								<VBtn
									color="primary"
									@click="saveGameEdits"
								>
									Save Changes
								</VBtn>
							</VCardActions>
						</VCard>
					</VDialog>
				</VCard>
			</VCol>
		</VRow>
	</section>
</template>

<style lang="scss">
.app-user-search-filter {
	inline-size: 31.6rem;
}

.text-capitalize {
	text-transform: capitalize;
}

.banner-lock-badge {
	position: absolute;
	inset-block-end: -4px;
	inset-inline-end: -4px;
	background: rgb(var(--v-theme-surface));
	border-radius: 50%;
	padding: 2px;
	box-shadow: 0 0 0 1px rgba(var(--v-theme-on-surface), 0.12);
}
</style>
