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
  it.todo('cartCount increments when adding a product')
  it.todo('cartCount decrements when removing a product')
  it.todo('clearCart resets cartCount to zero')
})
