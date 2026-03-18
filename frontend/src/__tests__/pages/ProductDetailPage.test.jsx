import { describe, it, vi } from 'vitest'

vi.mock('react-router-dom', () => ({
  useParams: vi.fn(() => ({ id: '1' })),
  useNavigate: vi.fn(() => vi.fn()),
}))

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/context/cart-context', () => ({
  useCart: vi.fn(() => ({ addItem: vi.fn() })),
}))

vi.mock('@/context/auth-context', () => ({
  useAuth: vi.fn(() => ({ isLoggedIn: false })),
}))

vi.mock('@/context/favorites-context', () => ({
  useFavorites: vi.fn(() => ({ isFavorite: vi.fn(() => false), toggleFavorite: vi.fn() })),
}))

vi.mock('@/components/Header', () => ({
  default: () => null,
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: (key, fallback) => fallback || key })),
}))

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock('@/utils/variantParser', () => ({
  organizeVariants: vi.fn(() => ({ colors: [], sizes: [], variantMap: {} })),
  findVariant: vi.fn(() => null),
}))

describe('ProductDetailPage', () => {
  it.todo('add button disabled without size selected')
  it.todo('add button disabled during API call (prevents double click)')
  it.todo('favorite button disabled during toggle')
  it.todo('unauthenticated user + favorite click → redirects to /login')
})
