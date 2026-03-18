import { describe, it, vi } from 'vitest'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('CartContext', () => {
  it.todo('cartCount increments when adding a product and stores cart_token in localStorage')
  it.todo('cartCount decrements when removing a product')
  it.todo('clearCart resets cartCount to zero and removes cart_token from localStorage')
})
