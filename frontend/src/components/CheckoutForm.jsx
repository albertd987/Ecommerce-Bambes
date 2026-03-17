import { useRef, useState } from "react"
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

export default function CheckoutForm({ onSuccess }) {
  const { t } = useTranslation()

  const stripe = useStripe()
  const elements = useElements()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ✅ Lock anti “doble confirm”
  const submittingRef = useRef(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!stripe || !elements) return

    // ✅ Evita doble submit (doble click / events duplicats / re-render)
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + "/checkout/success",
        },
        redirect: "if_required",
      })

      // Si Stripe retorna error (400), mirem si és el cas “ja s’ha confirmat”
      if (error) {
        // ✅ Cas exacte: payment_intent_unexpected_state (ja està succeeded)
        if (error.code === "payment_intent_unexpected_state") {
          onSuccess?.(paymentIntent || { status: "succeeded" })
          return
        }

        setError(error.message || t("checkoutForm.errors.generic"))
        return
      }

      // Si NO ha redirigit i tenim PI:
      onSuccess?.(paymentIntent)
    } catch (e2) {
      setError(e2?.message || t("checkoutForm.errors.unexpected"))
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button className="w-full" size="lg" disabled={!stripe || loading} type="submit">
        {loading ? t("checkoutForm.actions.processing") : t("checkoutForm.actions.payNow")}
      </Button>
    </form>
  )
}