/**
 * Bildirim çekmecesi verisi — Admin > Bildirimler ile beslenir.
 *
 * Mantık index.html yerine ayrı dosyada tutuluyor (casino-ui-settings.js ve
 * casino-ui-leaderboard.js ile aynı gerekçe: index.html'deki büyük
 * düzenlemeler geri alınabiliyor).
 *
 * Uçlar (kullanıcı JWT'si ile):
 *   GET  /notices?scope=platform|personal&page&limit
 *   POST /notices/:id/read
 *   POST /notices/read-all
 *
 * Oturum yoksa veya backend'e ulaşılamazsa aşağıdaki varsayılan kartlar
 * gösterilir; böylece bir kesinti çekmeceyi boşaltmaz.
 */
(function () {
  // "08/27/26, 06:07 PM" biçimi — mevcut kart tasarımıyla aynı.
  const formatDate = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    let hours = date.getHours();
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return (
      pad(date.getMonth() + 1) +
      '/' +
      pad(date.getDate()) +
      '/' +
      String(date.getFullYear()).slice(-2) +
      ', ' +
      pad(hours) +
      ':' +
      pad(date.getMinutes()) +
      ' ' +
      suffix
    );
  };

  window.createCasinoUiNotifications = function createCasinoUiNotifications(deps) {
    const { ref, computed, apiUrl, readAuthToken, backendAssetUrl, toastMessage } = deps;

    const notifTab = ref('platform');
    const notifViewMenuOpen = ref(false);
    const notifView = ref('All');
    const notifLive = ref(false);
    const notifLoading = ref(false);

    const platformItems = ref([]);
    const personalItems = ref([]);
    const notifUnread = ref(0);

    const mapNotice = (notice) => ({
      id: notice._id,
      date: formatDate(notice.createdAt),
      title: notice.title || '',
      // Yönetici görseli göreli yol olarak gelir; mutlak URL'ye çevrilir.
      image: notice.image ? backendAssetUrl(notice.image) : '',
      description: notice.message || '',
      action: '',
      expanded: false,
      read: Boolean(notice.read),
      personal: Boolean(notice.personal),
    });

    const authHeaders = () => {
      const token = readAuthToken();

      return token ? { Authorization: `Bearer ${token}` } : null;
    };

    const request = async (path, options = {}) => {
      const headers = authHeaders();
      if (!headers) return null;

      try {
        const res = await fetch(apiUrl(path), {
          ...options,
          headers: { ...headers, ...(options.headers || {}) },
          credentials: 'include',
        });
        if (!res.ok) return null;

        return await res.json();
      } catch {
        return null;
      }
    };

    const loadNotifications = async () => {
      if (notifLoading.value) return;
      notifLoading.value = true;

      try {
        const [platform, personal] = await Promise.all([
          request('/notices?scope=platform&limit=20'),
          request('/notices?scope=personal&limit=20'),
        ]);

        if (!platform && !personal) {
          notifLive.value = false;
          platformItems.value = [];
          personalItems.value = [];
          notifUnread.value = 0;
          return;
        }

        notifLive.value = true;

        if (platform && Array.isArray(platform.data)) {
          platformItems.value = platform.data.map(mapNotice);
        }
        if (personal && Array.isArray(personal.data)) {
          personalItems.value = personal.data.map(mapNotice);
        }

        const meta = (platform && platform.meta) || (personal && personal.meta);
        if (meta && typeof meta.unread === 'number') notifUnread.value = meta.unread;
      } finally {
        notifLoading.value = false;
      }
    };

    // "Unread only" seçiliyken okunmuşları gizle.
    const applyView = (items) =>
      notifView.value === 'Unread' ? items.filter((item) => !item.read) : items;

    const notifCards = computed(() => applyView(platformItems.value));
    const notifPersonalCards = computed(() => applyView(personalItems.value));

    const notifPlatformCount = computed(() =>
      platformItems.value.filter((item) => !item.read).length,
    );
    const notifPersonalCount = computed(() =>
      personalItems.value.filter((item) => !item.read).length,
    );

    // Zil rozeti. Canlı veride sunucunun toplam okunmamış sayısı kullanılır
    // (sayfa limitinin ötesindekiler de dahil); aksi halde eldeki kartlardan
    // hesaplanır.
    const notifBadge = computed(() =>
      notifLive.value ? notifUnread.value : notifPlatformCount.value + notifPersonalCount.value,
    );

    const notifChooseView = (view) => {
      notifViewMenuOpen.value = false;
      notifView.value = view === 'Unread' ? 'Unread' : 'All';
    };

    // Kart açıldığında okundu sayılır.
    const notifToggleCard = async (card) => {
      card.expanded = !card.expanded;

      if (!card.expanded || card.read || !notifLive.value) return;

      card.read = true;
      notifUnread.value = Math.max(notifUnread.value - 1, 0);
      await request(`/notices/${card.id}/read`, { method: 'POST' });
    };

    const notifMarkAllRead = async () => {
      if (!notifLive.value) {
        if (toastMessage) toastMessage('All notifications marked as read');

        return;
      }

      platformItems.value.forEach((item) => { item.read = true; });
      personalItems.value.forEach((item) => { item.read = true; });
      notifUnread.value = 0;

      const result = await request('/notices/read-all', { method: 'POST' });
      if (toastMessage) {
        toastMessage(result ? 'All notifications marked as read' : 'Could not mark notifications as read');
      }
    };

    return {
      notifTab,
      notifViewMenuOpen,
      notifView,
      notifCards,
      notifPersonalCards,
      notifPlatformCount,
      notifPersonalCount,
      notifUnread,
      notifBadge,
      notifLive,
      notifChooseView,
      notifToggleCard,
      notifMarkAllRead,
      loadNotifications,
    };
  };
})();
