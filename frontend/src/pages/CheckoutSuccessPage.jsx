import { useEffect, useRef, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link, useLocation } from "react-router-dom"
import { loadStripe } from "@stripe/stripe-js"
import { useCart } from "@/context/cart-context"
import api from "@/services/api"
import { useTranslation } from "react-i18next"
import {
  CheckCircle2,
  FileText,
  MapPin,
  Package,
  ShoppingBag,
  User,
} from "lucide-react"

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

function SectionCard({ icon: Icon, title, children }) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
        </div>

        {children}
      </CardContent>
    </Card>
  )
}

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
    if (status === "error") {
      return t("checkoutSuccess.status.error", { error: error || "" })
    }
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

      <main className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>

            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {t("checkoutSuccess.title")}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                {t("checkoutSuccess.title")}
              </h1>
            </div>
          </div>

          <p className="mt-3 sm:mt-4 text-sm text-muted-foreground">{renderMessage()}</p>
        </div>

        {state?.confirmError && (
          <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {t("checkoutSuccess.confirmError", { error: state.confirmError })}
          </div>
        )}

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("checkoutSuccess.orderSummary.title")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {t("checkoutSuccess.orderSummary.idLabel")} {orderId}
                    </h2>
                  </div>

                  {reference ? (
                    <div className="rounded-2xl bg-muted/40 px-3 py-2 sm:px-4 sm:py-3 text-sm break-all sm:break-normal">
                      <span className="text-muted-foreground">
                        {t("checkoutSuccess.orderSummary.referenceLabel")}{" "}
                      </span>
                      <span className="font-medium text-foreground">{reference}</span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <SectionCard icon={Package} title={t("checkoutSuccess.products.title")}>
              {lines.length ? (
                <div className="space-y-3">
                  {lines.map((l) => (
                    <div
                      key={l.id || l.identifier}
                      className="flex items-start justify-between gap-2 sm:gap-4 rounded-2xl bg-muted/30 px-3 sm:px-4 py-3 text-sm"
                    >
                      <span className="min-w-0">
                        {l.name}{" "}
                        <span className="text-muted-foreground">x{l.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium">{money(lineTotal(l))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("checkoutSuccess.products.emptyNote")}
                </p>
              )}
            </SectionCard>

            <SectionCard icon={User} title={t("checkoutSuccess.customer.title")}>
              {customer ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/30 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("checkoutSuccess.customer.name")}
                    </p>
                    <p className="mt-1 font-medium">
                      {customer.first_name} {customer.last_name}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/30 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("checkoutSuccess.customer.email")}
                    </p>
                    <p className="mt-1 font-medium">{customer.email}</p>
                  </div>

                  {customer.phone ? (
                    <div className="rounded-2xl bg-muted/30 px-4 py-3 sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("checkoutSuccess.customer.phone")}
                      </p>
                      <p className="mt-1 font-medium">{customer.phone}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("checkoutSuccess.customer.notAvailable")}
                </p>
              )}
            </SectionCard>

            {(billingAddress || shippingAddress) && (
              <SectionCard icon={MapPin} title={t("checkoutSuccess.addresses.title")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {billingAddress && (
                    <div className="rounded-2xl bg-muted/30 px-4 py-3">
                      <p className="text-sm font-medium mb-2">
                        {t("checkoutSuccess.addresses.billing")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatAddress(billingAddress)}
                      </p>
                    </div>
                  )}

                  {shippingAddress && (
                    <div className="rounded-2xl bg-muted/30 px-4 py-3">
                      <p className="text-sm font-medium mb-2">
                        {t("checkoutSuccess.addresses.shipping")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatAddress(shippingAddress)}
                      </p>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 h-fit order-first lg:order-none">
            <SectionCard icon={ShoppingBag} title={t("checkoutSuccess.totals.title")}>
              <div className="space-y-3 text-sm">
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

                <div className="flex justify-between border-t pt-3 text-base font-semibold">
                  <span>{t("checkoutSuccess.totals.total")}</span>
                  <span>{money(totals?.total)}</span>
                </div>
              </div>
            </SectionCard>

            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-4 sm:p-6 space-y-3">
                <Link to="/">
                  <Button className="w-full">{t("checkoutSuccess.actions.backToShop")}</Button>
                </Link>

                <Link to="/orders">
                  <Button variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    {t("checkoutSuccess.actions.viewOrders")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}