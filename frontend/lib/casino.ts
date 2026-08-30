/**
 * Casino / slot katalog tipleri ve backend uçları.
 * Kaynak: backend/controllers/apiController.js, backend/routes/apiRoutes.js
 */

export interface CasinoGame {
  _id: string
  game_name: string
  game_code: string
  banner?: string | null
  background?: string | null
  views?: number
  featured?: number
  provider_code?: string | null
  provider?: { _id: string; name?: string } | null
  categories?: string[]
  category?: string | null
  distribution?: string
}

/** /public/games/detail/:code yanıtındaki genişletilmiş oyun alanları. */
export interface CasinoGameDetail extends CasinoGame {
  game_type?: string
  technology?: string
  is_mobile?: number
  has_freespins?: number
  has_tables?: number
  has_lobby?: number
  only_demo?: number
  description?: string | null
  rtp?: number
  created_at?: string
}

export interface CasinoTopWin {
  username: string
  bet_money: number
  win_money: number
  multiplier: number | null
  created_at: string
}

export interface CasinoGameDetailPayload {
  game: CasinoGameDetail
  provider: { code: string | null; name: string | null }
  categories: CasinoCategory[]
  topWins: CasinoTopWin[]
  providerGames: CasinoGame[]
  popularGames: CasinoGame[]
}

export interface CasinoCategory {
  _id: string
  name: string
  slug: string
  img: string
}

export interface CategoryWithGames extends CasinoCategory {
  total_games: number
  games: CasinoGame[]
}

interface GamesByCategoryResponse {
  success: boolean
  data: CasinoGame[]
  total: number
}

interface CategoriesWithGamesResponse {
  data: CategoryWithGames[]
}

/** Bir kategori/sağlayıcı/oyun sayfasında gösterilecek varsayılan sayfa boyutu. */
export const CASINO_PAGE_SIZE = 24

export const casinoEndpoints = {
  categoriesWithGames: "/public/games/categories/with-games",
  categories: "/public/categories",
  gamesByCategory: (slug: string) => `/public/games/category/${encodeURIComponent(slug)}`,
  gameDetail: (code: string) => `/public/games/detail/${encodeURIComponent(code)}`,
  search: "/public/games/search",
  featured: "/public/games/featured/list",
}

export type { GamesByCategoryResponse, CategoriesWithGamesResponse }
