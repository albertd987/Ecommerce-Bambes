import { describe, it, vi } from 'vitest'

vi.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: () => null,
  useStripe: vi.fn(() => null),
  useElements: vi.fn(() => null),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: (key, fallback) => fallback || key })),
}))

describe('CheckoutForm', () => {
  it.todo('pay button disabled while Stripe Elements has not loaded')
  it.todo('pay button disabled during payment processing')
  it.todo('Stripe error shows error message and re-enables form')
})
