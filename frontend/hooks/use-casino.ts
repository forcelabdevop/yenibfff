"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/api"
import {
  CASINO_PAGE_SIZE,
  casinoEndpoints,
  type CasinoGame,
  type CategoriesWithGamesResponse,
  type GamesByCategoryResponse,
} from "@/lib/casino"

/** Lobi görünümü: her kategori için ilk 20 oyunluk bir raf. */
export function useCategoriesWithGames() {
  const { data, error, isLoading } = useSWR<CategoriesWithGamesResponse>(
    casinoEndpoints.categoriesWithGames,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    categories: data?.data ?? [],
    isLoading,
    error,
  }
}

/** Tek bir kategorinin tüm oyunları, "daha fazla yükle" ile sayfalanır. */
export function useGamesByCategory(slug: string | null, page: number) {
  const shouldFetch = !!slug
  const offset = page * CASINO_PAGE_SIZE
  const { data, error, isLoading } = useSWR<GamesByCategoryResponse>(
    shouldFetch
      ? `${casinoEndpoints.gamesByCategory(slug!)}?limit=${CASINO_PAGE_SIZE}&offset=${offset}`
      : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  return {
    games: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
  }
}

/** Arama kutusu — 2+ karakterden itibaren. */
export function useGameSearch(query: string) {
  const trimmed = query.trim()
  const shouldFetch = trimmed.length >= 2
  const { data, error, isLoading } = useSWR<CasinoGame[]>(
    shouldFetch ? `${casinoEndpoints.search}?query=${encodeURIComponent(trimmed)}` : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  return {
    results: data ?? [],
    isLoading: shouldFetch && isLoading,
    error,
  }
}
