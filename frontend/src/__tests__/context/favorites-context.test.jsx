import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// Mock auth context
vi.mock('@/context/auth-context', () => ({
  useAuth: vi.fn(),
}))

// Mock API
vi.mock('@/services/api', () => ({
  getFavorites: vi.fn(),
  toggleFavorite: vi.fn(),
}))

import { useAuth } from '@/context/auth-context'
import { getFavorites, toggleFavorite } from '@/services/api'
import { FavoritesProvider, useFavorites } from '@/context/favorites-context'

const wrapper = ({ children }) => <FavoritesProvider>{children}</FavoritesProvider>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FavoritesContext', () => {
  it('loads favorites on mount when logged in', async () => {
    const product1 = { id: 1, name: 'Product A' }
    const product2 = { id: 2, name: 'Product B' }

    useAuth.mockReturnValue({ isLoggedIn: true, loading: false })
    getFavorites.mockResolvedValue({ data: [product1, product2] })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(2)
    })

    expect(getFavorites).toHaveBeenCalledTimes(1)
    expect(result.current.favorites).toEqual([product1, product2])
  })

  it('returns empty favorites when not logged in', async () => {
    useAuth.mockReturnValue({ isLoggedIn: false, loading: false })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(getFavorites).not.toHaveBeenCalled()
    expect(result.current.favorites).toHaveLength(0)
  })

  it('does not fetch while auth is loading', async () => {
    useAuth.mockReturnValue({ isLoggedIn: false, loading: true })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    // Give a tick for any async effects
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(getFavorites).not.toHaveBeenCalled()
    expect(result.current.favorites).toHaveLength(0)
  })

  it('toggleFavorite adds product optimistically when favorited is true', async () => {
    const existing = { id: 1, name: 'Existing' }
    const newFav = { id: 5, name: 'New Product' }

    useAuth.mockReturnValue({ isLoggedIn: true, loading: false })
    getFavorites.mockResolvedValue({ data: [existing] })
    toggleFavorite.mockResolvedValue({ data: { favorited: true, favorite: newFav } })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(1)
    })

    await act(async () => {
      await result.current.toggleFavorite(5)
    })

    expect(result.current.favorites).toHaveLength(2)
    expect(result.current.favorites.find((f) => f.id === 5)).toEqual(newFav)
  })

  it('toggleFavorite removes product when favorited is false', async () => {
    const product = { id: 3, name: 'To Remove' }

    useAuth.mockReturnValue({ isLoggedIn: true, loading: false })
    getFavorites.mockResolvedValue({ data: [product] })
    toggleFavorite.mockResolvedValue({ data: { favorited: false } })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(1)
    })

    await act(async () => {
      await result.current.toggleFavorite(3)
    })

    expect(result.current.favorites).toHaveLength(0)
  })

  it('isFavorite returns correct boolean', async () => {
    const product = { id: 7, name: 'Favorited Product' }

    useAuth.mockReturnValue({ isLoggedIn: true, loading: false })
    getFavorites.mockResolvedValue({ data: [product] })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(1)
    })

    expect(result.current.isFavorite(7)).toBe(true)
    expect(result.current.isFavorite(99)).toBe(false)
  })
})
