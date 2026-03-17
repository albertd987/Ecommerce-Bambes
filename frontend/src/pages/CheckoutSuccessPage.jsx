import { useEffect, useRef, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Link, useLocation } from "react-router-dom"
import { loadStripe } from "@stripe/stripe-js"
import { useCart } from "@/context/cart-context"
import api from "@/services/api"
import { useTranslation } from "react-i18next"

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export default function CheckoutSuccessPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const state = location.state

  const { clearCart } = useCart()

  const [status, setStatus] = useState(state?.paymentStatus || "loading")
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(state?.order || null)

  const cartClearedRef = useRef(false)
  const didRunRef = useRef(false)

  const toCents = (value) => {
    if (value === null || value === undefined) return null
    if (typeof value === "number") return Number.isNaN(value) ? null : value
    if (typeof value === "string") {
      const n = Number(value)
      if (!Number.isNaN(n)) return n
      const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".")
      const f = Number(cleaned)
      if (!Number.isNaN(f)) return Math.round(f * 100)
      return null
    }
    if (typeof value === "object") {
      if ("value" in value) {
        const n = Number(value.value)
        return Number.isNaN(n) ? null : n
      }
      if ("amount" in value) {
        const n = Number(value.amount)
        return Number.isNaN(n) ? null : n
      }
    }
    return null
  }

  const money = (maybeCents) => {
    const cents = toCents(maybeCents)
    if (cents === null) return "—"
    return (Number(cents) / 100).toFixed(2) + "€"
  }

  const renderMessage = () => {
    if (status === "loading") return t("checkoutSuccess.status.loading")
    if (status === "succeeded") return t("checkoutSuccess.status.succeeded")
    if (status === "processing") return t("checkoutSuccess.status.processing")
    if (status === "requires_payment_method") return t("checkoutSuccess.status.failed")
    if (status === "unknown") return t("checkoutSuccess.status.unknown")
    if (status === "error")
      return t("checkoutSuccess.status.error", { error: error || "" })
    return t("checkoutSuccess.status.generic", { status })
  }

  const maybeClear = async (nextStatus) => {
    if (nextStatus === "succeeded" && !cartClearedRef.current) {
      cartClearedRef.current = true
      try {
        await clearCart()
      } catch (e) {
        console.error("Error buidant carret:", e)
      }
    }
  }

  const loadOrderById = async (orderId) => {
    const res = await api.get(`/orders/${orderId}`)
    return res.data?.data
  }

  const findOrderByReference = async (reference) => {
    const res = await api.get("/orders", { params: { per_page: 50 } })
    const list = res.data?.data || []
    const match = list.find((o) => o?.reference === reference)
    if (!match?.id) return null
    return await loadOrderById(match.id)
  }

  useEffect(() => {
    const run = async () => {
      try {
        if (didRunRef.current) return
        didRunRef.current = true

        if (state?.order?.id) {
          setStatus(state?.paymentStatus || "succeeded")
          const fresh = await loadOrderById(state.order.id)
          if (fresh) setOrder(fresh)
          await maybeClear(state?.paymentStatus || "succeeded")
          return
        }

        if (state?.orderId) {
          setStatus(state?.paymentStatus || "succeeded")
          const fresh = await loadOrderById(state.orderId)
          if (fresh) setOrder(fresh)
          await maybeClear(state?.paymentStatus || "succeeded")
          return
        }

        if (state?.paymentIntentId) {
          setStatus(state?.paymentStatus || "succeeded")
          const found = await findOrderByReference(state.paymentIntentId)
          if (found) setOrder(found)
          await maybeClear(state?.paymentStatus || "succeeded")
          return
        }

        // Cas redirect real
        const stripe = await stripePromise
        if (!stripe) throw new Error(t("checkoutSuccess.errors.stripeNotInit"))

        const params = new URLSearchParams(window.location.search)
        const clientSecret = params.get("payment_intent_client_secret")

        if (!clientSecret) {
          setStatus("unknown")
          return
        }

        const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret)
        if (error) throw new Error(error.message)

        const nextStatus = paymentIntent?.status || "unknown"
        setStatus(nextStatus)

        if (nextStatus === "succeeded" && paymentIntent?.id) {
          const found = await findOrderByReference(paymentIntent.id)
          if (found) {
            setOrder(found)
            await maybeClear(nextStatus)
            return
          }

          // Intentar crear la comanda amb pending data
          const rawLines = localStorage.getItem("pending_checkout_lines")
          const rawCustomer = localStorage.getItem("pending_checkout_customer")
          const pendingLines = rawLines ? JSON.parse(rawLines) : null
          const pendingPayload = rawCustomer ? JSON.parse(rawCustomer) : null

          if (pendingLines?.length && pendingPayload) {
            try {
              const res = await api.post("/checkout/confirm", {
                ...pendingPayload,
                payment_intent_id: paymentIntent.id,
              })
              const createdOrder = res.data?.data
              if (createdOrder) setOrder(createdOrder)
              localStorage.removeItem("pending_checkout_lines")
              localStorage.removeItem("pending_checkout_customer")
            } catch (e) {
              console.error("confirm (redirect) ha fallat:", e)
            }
          }

          await maybeClear(nextStatus)
        }
      } catch (e) {
        setError(e.message)
        setStatus("error")
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, clearCart])

  const orderId = order?.id || state?.order?.id || state?.orderId || "—"
  const reference =
    order?.reference || state?.paymentIntentId || state?.order?.reference || null

  const totals =
    order?.totals ||
    (order
      ? {
          sub_total: order.sub_total,
          discount_total: order.discount_total,
          shipping_total: order.shipping_total,
          tax_total: order.tax_total,
          total: order.total,
        }
      : null)

  const lines = order?.lines || []
  const customer = order?.customer || null
  const billingAddress = order?.billing_address || null
  const shippingAddress = order?.shipping_address || null

  const lineTotal = (l) => {
    if (l?.total !== undefined && l?.total !== null) return l.total
    if (l?.sub_total !== undefined && l?.sub_total !== null) return l.sub_total
    if (l?.unit_price !== undefined && l?.unit_price !== null) {
      const up = toCents(l.unit_price)
      const q = Number(l.quantity || 1)
      if (up !== null && !Number.isNaN(q)) return up * q
    }
    return null
  }

  const formatAddress = (addr) => {
    if (!addr) return null
    const parts = [addr.line_one, addr.line_two, addr.city, addr.state, addr.postcode].filter(Boolean)
    return parts.join(", ")
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h2 className="text-2xl font-bold mb-2">
          {t("checkoutSuccess.title")}
        </h2>
        <p className="text-muted-foreground mb-6">{renderMessage()}</p>

        {state?.confirmError && (
          <div className="border border-destructive rounded-lg p-3 mb-4 text-sm text-destructive">
            {t("checkoutSuccess.confirmError", { error: state.confirmError })}
          </div>
        )}

        <div className="border rounded-lg p-4 space-y-3 bg-background">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{t("checkoutSuccess.orderSummary.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("checkoutSuccess.orderSummary.idLabel")} {orderId}
            </p>
          </div>

          {reference && (
            <p className="text-sm text-muted-foreground">
              {t("checkoutSuccess.orderSummary.referenceLabel")}{" "}
              <span className="font-medium text-foreground">{reference}</span>
            </p>
          )}

          {/* Productes */}
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">
              {t("checkoutSuccess.products.title")}
            </p>

            {lines.length ? (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div
                    key={l.id || l.identifier}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {l.name}{" "}
                      <span className="text-muted-foreground">
                        x{l.quantity}
                      </span>
                    </span>
                    <span>{money(lineTotal(l))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("checkoutSuccess.products.emptyNote")}
              </p>
            )}
          </div>

          {/* Totals */}
          <div className="border-t pt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("checkoutSuccess.totals.subtotal")}
              </span>
              <span>{money(totals?.sub_total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("checkoutSuccess.totals.discount")}
              </span>
              <span>{money(totals?.discount_total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("checkoutSuccess.totals.shipping")}
              </span>
              <span>{money(totals?.shipping_total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("checkoutSuccess.totals.vat")}
              </span>
              <span>{money(totals?.tax_total)}</span>
            </div>
            <div className="flex justify-between font-medium pt-2">
              <span>{t("checkoutSuccess.totals.total")}</span>
              <span>{money(totals?.total)}</span>
            </div>
          </div>

          {/* Dades del client */}
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">
              {t("checkoutSuccess.customer.title")}
            </p>

            {customer ? (
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">
                    {t("checkoutSuccess.customer.name")}{" "}
                  </span>
                  {customer.first_name} {customer.last_name}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("checkoutSuccess.customer.email")}{" "}
                  </span>
                  {customer.email}
                </p>
                {customer.phone && (
                  <p>
                    <span className="text-muted-foreground">
                      {t("checkoutSuccess.customer.phone")}{" "}
                    </span>
                    {customer.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("checkoutSuccess.customer.notAvailable")}
              </p>
            )}
          </div>

          {/* Adreces */}
          {(billingAddress || shippingAddress) && (
            <div className="border-t pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {billingAddress && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {t("checkoutSuccess.addresses.billing")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatAddress(billingAddress)}
                    </p>
                  </div>
                )}
                {shippingAddress && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {t("checkoutSuccess.addresses.shipping")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatAddress(shippingAddress)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Link to="/">
            <Button>{t("checkoutSuccess.actions.backToShop")}</Button>
          </Link>
          <Link to="/orders">
            <Button variant="outline">{t("checkoutSuccess.actions.viewOrders")}</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}