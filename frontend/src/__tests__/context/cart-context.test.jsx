import { describe, it, vi, expect, beforeEach } from 'vitest'
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

  it.todo('cartCount increments when adding a product and stores cart_token in localStorage')
  it.todo('cartCount decrements when removing a product')
  it.todo('clearCart resets cartCount to zero and removes cart_token from localStorage')
})
