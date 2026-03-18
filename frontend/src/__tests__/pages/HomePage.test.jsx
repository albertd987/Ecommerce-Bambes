import { describe, it, vi } from 'vitest'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('../components/ProductCard', () => ({
  default: () => null,
}))

vi.mock('../components/Header', () => ({
  default: () => null,
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: (key, fallback) => fallback || key })),
}))

describe('HomePage', () => {
  it.todo('empty search loads all products')
  it.todo('search with no results shows "no results" message')
  it.todo('back navigation restores previous search from URL')
})
