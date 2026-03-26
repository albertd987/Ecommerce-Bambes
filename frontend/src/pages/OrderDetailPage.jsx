import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/context/auth-context"
import api from "@/services/api"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft,
  FileText,
  MapPin,
  Package,
  Receipt,
  RefreshCw,
  User,
} from "lucide-react"

function SectionCard({ icon: Icon, title, children }) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-6">
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

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-muted/30 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium text-foreground">{value || "—"}</p>
    </div>
  )
}

export default function OrderDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { isLoggedIn, user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)

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
      console.error("Error loading order:", e)
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

  const lines = order?.lines || []

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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto max-w-3xl px-4 py-10">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t(
                  "orderDetail.notLoggedIn",
                  "Has d’iniciar sessió per veure aquesta comanda."
                )}
              </p>
              <Link to="/login">
                <Button className="mt-4">
                  {t("auth.login.title", "Iniciar sessió")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("orderDetail.title", "Detall de comanda")}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
              {t("orderDetail.title", "Detall de comanda")}
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" className="w-full sm:w-auto min-h-[44px]" onClick={loadOrder} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading
                ? t("orderDetail.actions.refreshing", "Actualitzant...")
                : t("orderDetail.actions.refresh", "Actualitzar")}
            </Button>

            <Link to="/orders" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("orderDetail.actions.backToOrders", "Tornar a comandes")}
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t("orderDetail.loading", "Carregant comanda...")}
              </p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-destructive">
                {t("common.errorLabel", "Error")}: {error}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "orderDetail.unauthorizedHint",
                  "Si diu “No autoritzat”, és perquè la comanda no és teva o no estàs autenticat correctament."
                )}
              </p>
            </CardContent>
          </Card>
        ) : !order ? (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t("orderDetail.notFound", "No s’ha trobat la comanda.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Card className="rounded-3xl border shadow-sm">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                        <Receipt className="h-7 w-7" />
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold">
                          {t("orderDetail.summary.title", "Resum de la comanda")}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t(
                            "orderDetail.summary.subtitle",
                            "Consulta tota la informació relacionada amb aquesta compra."
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user?.name || user?.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

 <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <InfoPill
    label={t("orderDetail.fields.id", "ID")}
    value={order?.id}
  />

  <InfoPill
    label={t("orderDetail.fields.status", "Estat")}
    value={order?.status || "—"}
  />

  <div className="lg:col-span-2 rounded-2xl bg-muted/30 px-4 py-3 min-w-0">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {t("orderDetail.fields.reference", "Referència")}
    </p>
    <p className="mt-1 font-medium text-foreground break-all">
      {order?.reference || "—"}
    </p>
  </div>

  <div className="sm:col-span-2 lg:col-span-4 rounded-2xl bg-muted/30 px-4 py-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {t("orderDetail.fields.date", "Data")}
    </p>
    <p className="mt-1 font-medium text-foreground">
      {order?.created_at ? new Date(order.created_at).toLocaleString() : "—"}
    </p>
  </div>
</div>
                </CardContent>
              </Card>

              <SectionCard
                icon={Package}
                title={t("orderDetail.sections.products", "Productes")}
              >
                {lines.length ? (
                  <div className="space-y-3">
                    {lines.map((l) => (
                      <div
                        key={l.id || l.identifier}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-muted/30 px-4 py-3 text-sm"
                      >
                        <span className="min-w-0 break-words">
                          {l.name}{" "}
                          <span className="text-muted-foreground">x{l.quantity}</span>
                        </span>
                        <span className="shrink-0 font-medium">{money(lineTotal(l))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("orderDetail.noLines", "No hi ha línies.")}
                  </p>
                )}
              </SectionCard>

              <SectionCard
                icon={User}
                title={t("orderDetail.sections.customer", "Dades del client")}
              >
                {order?.customer ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPill
                      label={t("orderDetail.customer.name", "Nom")}
                      value={`${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()}
                    />
                    <InfoPill
                      label={t("orderDetail.customer.email", "Email")}
                      value={order.customer.email || "—"}
                    />
                    {order.customer.phone ? (
                      <div className="sm:col-span-2">
                        <InfoPill
                          label={t("orderDetail.customer.phone", "Telèfon")}
                          value={order.customer.phone}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "orderDetail.customer.noData",
                      "No hi ha dades de client per a aquesta comanda."
                    )}
                  </p>
                )}
              </SectionCard>

              {(order?.billing_address || order?.shipping_address) && (
                <SectionCard
                  icon={MapPin}
                  title={t("orderDetail.sections.addresses", "Adreces")}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {order.billing_address && (
                      <div className="rounded-2xl bg-muted/30 px-4 py-3">
                        <p className="mb-2 text-sm font-medium">
                          {t("orderDetail.addresses.billing", "Facturació")}
                        </p>
                        <div className="space-y-0.5 text-sm text-muted-foreground">
                          <p>{order.billing_address.line_one}</p>
                          {order.billing_address.line_two && (
                            <p>{order.billing_address.line_two}</p>
                          )}
                          <p>
                            {order.billing_address.postcode} {order.billing_address.city}
                          </p>
                          {order.billing_address.state && (
                            <p>{order.billing_address.state}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {order.shipping_address && (
                      <div className="rounded-2xl bg-muted/30 px-4 py-3">
                        <p className="mb-2 text-sm font-medium">
                          {t("orderDetail.addresses.shipping", "Enviament")}
                        </p>
                        <div className="space-y-0.5 text-sm text-muted-foreground">
                          <p>{order.shipping_address.line_one}</p>
                          {order.shipping_address.line_two && (
                            <p>{order.shipping_address.line_two}</p>
                          )}
                          <p>
                            {order.shipping_address.postcode} {order.shipping_address.city}
                          </p>
                          {order.shipping_address.state && (
                            <p>{order.shipping_address.state}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>

            <div className="h-fit space-y-6 xl:sticky xl:top-6">
              <SectionCard
                icon={FileText}
                title={t("orderDetail.sections.totals", "Totals")}
              >
                <div className="space-y-3 text-sm">
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

                  <div className="flex justify-between border-t pt-3 text-base font-semibold">
                    <span>{t("orderDetail.totals.total", "Total")}</span>
                    <span>{money(totals?.total)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}