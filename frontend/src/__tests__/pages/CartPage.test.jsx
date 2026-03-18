import { describe, it, vi } from 'vitest'

vi.mock('@/context/cart-context', () => ({
  useCart: vi.fn(() => ({
    items: [],
    cartCount: 0,
    cartSubtotal: 0,
    updateQty: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  })),
}))

vi.mock('@/components/Header', () => ({
  default: () => null,
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children }) => children,
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: (key, fallback) => fallback || key })),
}))

describe('CartPage', () => {
  it.todo('rapid multiple clicks on "+" does not fire simultaneous requests')
  it.todo('quantity reaching 0 removes item or asks confirmation')
})
