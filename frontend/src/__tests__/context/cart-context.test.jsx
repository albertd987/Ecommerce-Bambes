import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { CartProvider, useCart } from '@/context/cart-context'

// Mutable auth state to simulate login/logout
let mockIsLoggedIn = false
let mockLoading = false

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ isLoggedIn: mockIsLoggedIn, loading: mockLoading }),
}))

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: null }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('CartContext', () => {
  beforeEach(() => {
    mockIsLoggedIn = false
    mockLoading = false
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('clears cart_token from localStorage when user logs out', async () => {
    mockIsLoggedIn = true
    localStorage.setItem('cart_token', 'test-uuid-token')

    const { rerender } = renderHook(() => useCart(), { wrapper: CartProvider })

    // Simulate logout
    act(() => { mockIsLoggedIn = false })
    rerender()

    await waitFor(() => {
      expect(localStorage.getItem('cart_token')).toBeNull()
    })
  })

  it('clears cart_token when page loads with no session but stale token in localStorage', async () => {
    // Simulates: user's session cookie expired / cleared manually,
    // but cart_token from a previous login is still in localStorage.
    mockIsLoggedIn = false
    mockLoading = false
    localStorage.setItem('cart_token', 'stale-uuid-token')

    renderHook(() => useCart(), { wrapper: CartProvider })

    await waitFor(() => {
      expect(localStorage.getItem('cart_token')).toBeNull()
    })
  })

  it('calls fetchCart when isLoggedIn changes to true', async () => {
    const api = (await import('@/services/api')).default
    mockIsLoggedIn = false

    const { rerender } = renderHook(() => useCart(), { wrapper: CartProvider })

    // Initially not logged in: api.get should NOT have been called
    expect(api.get).not.toHaveBeenCalled()

    // Simulate login
    act(() => { mockIsLoggedIn = true })
    rerender()

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/cart', expect.any(Object))
    })
  })

  it.todo('cartCount increments when adding a product and stores cart_token in localStorage')
  it.todo('cartCount decrements when removing a product')
  it.todo('clearCart resets cartCount to zero and removes cart_token from localStorage')
})
