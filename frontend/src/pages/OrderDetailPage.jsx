import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import api from "@/services/api"
import { useTranslation } from "react-i18next"

export default function OrderDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { isLoggedIn, user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)

  /**
   * ✅ Normalitza imports que poden venir com:
   * - number (15999)
   * - string ("15999")
   * - object ({ value: 15999, ... }) o ({ amount: 15999, ... })
   */
  const toCents = (value) => {
    if (value === null || value === undefined) return null

    if (typeof value === "number") return Number.isNaN(value) ? null : value
    if (typeof value === "string") {
      const n = Number(value)
      return Number.isNaN(n) ? null : n
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

  // ✅ Preu de línia: prioritat total -> sub_total -> unit_price * qty
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

  const loadOrder = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await api.get(`/orders/${id}`)
      setOrder(res.data?.data || null)
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return
    if (!id) return
    loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, id])

  // ✅ Línies: poden venir com order.lines
  const lines = order?.lines || []

  // ✅ Totals: si no ve order.totals, els agafem del root (Lunar)
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {t("orderDetail.title", "Detall de comanda")}
          </h2>

          <div className="flex gap-2">
            {isLoggedIn && (
              <Button variant="outline" onClick={loadOrder} disabled={loading}>
                {loading
                  ? t("orderDetail.actions.refreshing", "Actualitzant...")
                  : t("orderDetail.actions.refresh", "Actualitzar")}
              </Button>
            )}

            <Link to="/orders">
              <Button variant="outline">
                {t("orderDetail.actions.backToOrders", "Tornar a comandes")}
              </Button>
            </Link>
          </div>
        </div>

        {!isLoggedIn ? (
          <div className="border rounded-lg p-4">
            <p className="text-muted-foreground">
              {t(
                "orderDetail.notLoggedIn",
                "Has d’iniciar sessió per veure aquesta comanda."
              )}
            </p>
            <Link to="/login">
              <Button className="mt-3">
                {t("auth.login.title", "Iniciar sessió")}
              </Button>
            </Link>
          </div>
        ) : loading ? (
          <div className="border rounded-lg p-4">
            <p className="text-muted-foreground">
              {t("orderDetail.loading", "Carregant comanda...")}
            </p>
          </div>
        ) : error ? (
          <div className="border rounded-lg p-4">
            <p className="text-destructive">
              {t("common.errorLabel", "Error")}: {error}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {t(
                "orderDetail.unauthorizedHint",
                "Si diu “No autoritzat”, és perquè la comanda no és teva o no estàs autenticat correctament."
              )}
            </p>
          </div>
        ) : !order ? (
          <div className="border rounded-lg p-4">
            <p className="text-muted-foreground">
              {t("orderDetail.notFound", "No s’ha trobat la comanda.")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* INFO BÀSICA */}
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                {t("orderDetail.signedInAs", "Sessió iniciada com")}
              </p>
              <p className="font-medium truncate">{user?.name || user?.email}</p>

              <div className="h-px bg-border my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t("orderDetail.fields.id", "ID")}
                  </span>
                  <span className="font-medium">{order?.id}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t("orderDetail.fields.status", "Estat")}
                  </span>
                  <span className="font-medium">{order?.status || "—"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t("orderDetail.fields.reference", "Referència")}
                  </span>
                  <span className="font-medium">{order?.reference || "—"}</span>
                </div>

                {order?.created_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("orderDetail.fields.date", "Data")}
                    </span>
                    <span className="font-medium">
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* LÍNIES */}
            <div className="border rounded-lg p-4">
              <p className="font-semibold mb-3">
                {t("orderDetail.sections.products", "Productes")}
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
                  {t("orderDetail.noLines", "No hi ha línies.")}
                </p>
              )}
            </div>

            {/* TOTALS */}
            <div className="border rounded-lg p-4">
              <p className="font-semibold mb-3">
                {t("orderDetail.sections.totals", "Totals")}
              </p>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orderDetail.totals.subtotal", "Subtotal")}
                  </span>
                  <span>{money(totals?.sub_total)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orderDetail.totals.discount", "Descompte")}
                  </span>
                  <span>{money(totals?.discount_total)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orderDetail.totals.shipping", "Enviament")}
                  </span>
                  <span>{money(totals?.shipping_total)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orderDetail.totals.tax", "IVA")}
                  </span>
                  <span>{money(totals?.tax_total)}</span>
                </div>

                <div className="flex justify-between font-medium pt-2">
                  <span>{t("orderDetail.totals.total", "Total")}</span>
                  <span>{money(totals?.total)}</span>
                </div>
              </div>
            </div>

            {/* DADES DEL CLIENT */}
            <div className="border rounded-lg p-4">
              <p className="font-semibold mb-3">
                {t("orderDetail.sections.customer", "Dades del client")}
              </p>

              {order?.customer ? (
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">
                      {t("orderDetail.customer.name", "Nom")}:{" "}
                    </span>
                    {order.customer.first_name} {order.customer.last_name}
                  </p>

                  <p>
                    <span className="text-muted-foreground">
                      {t("orderDetail.customer.email", "Email")}:{" "}
                    </span>
                    {order.customer.email}
                  </p>

                  {order.customer.phone && (
                    <p>
                      <span className="text-muted-foreground">
                        {t("orderDetail.customer.phone", "Telèfon")}:{" "}
                      </span>
                      {order.customer.phone}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "orderDetail.customer.noData",
                    "No hi ha dades de client per a aquesta comanda."
                  )}
                </p>
              )}
            </div>

            {/* ADRECES */}
            {(order?.billing_address || order?.shipping_address) && (
              <div className="border rounded-lg p-4">
                <p className="font-semibold mb-3">
                  {t("orderDetail.sections.addresses", "Adreces")}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {order.billing_address && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("orderDetail.addresses.billing", "Facturació")}
                      </p>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p>{order.billing_address.line_one}</p>
                        {order.billing_address.line_two && (
                          <p>{order.billing_address.line_two}</p>
                        )}
                        <p>
                          {order.billing_address.postcode}{" "}
                          {order.billing_address.city}
                        </p>
                        {order.billing_address.state && (
                          <p>{order.billing_address.state}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {order.shipping_address && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("orderDetail.addresses.shipping", "Enviament")}
                      </p>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p>{order.shipping_address.line_one}</p>
                        {order.shipping_address.line_two && (
                          <p>{order.shipping_address.line_two}</p>
                        )}
                        <p>
                          {order.shipping_address.postcode}{" "}
                          {order.shipping_address.city}
                        </p>
                        {order.shipping_address.state && (
                          <p>{order.shipping_address.state}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}