import { useEffect, useRef, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import api, { downloadInvoice } from "@/services/api"
import { useTranslation } from "react-i18next"
import { ArrowLeft, FileText, Package, Receipt, RefreshCw, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

function OrderInfoPill({ label, value }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  )
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const { isLoggedIn, user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [orders, setOrders] = useState([])
  const didRunRef = useRef(false)

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

  const loadOrders = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await api.get("/orders", { params: { per_page: 20 } })
      setOrders(res.data?.data || [])
    } catch (e) {
      console.error("Error loading orders:", e)
      setError(e?.response?.data?.message || e.message)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return
    if (didRunRef.current) return
    didRunRef.current = true
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto max-w-3xl px-4 py-10">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t("orders.notLoggedIn", "Has d’iniciar sessió per veure les comandes.")}
              </p>

              <div className="mt-4">
                <Link to="/login">
                  <Button>{t("auth.login.title", "Iniciar sessió")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("profile.sections.orders", "Comandes")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("orders.title", "Les meves comandes")}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadOrders} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading
                ? t("orders.actions.refreshing", "Actualitzant...")
                : t("orders.actions.refresh", "Actualitzar")}
            </Button>

            <Link to="/profile">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("orders.actions.backToProfile", "Tornar al perfil")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Package className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("orders.title", "Les meves comandes")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "orders.subtitle",
                        "Consulta l’historial de compres i descarrega les teves factures."
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
            </CardContent>
          </Card>

          {error ? (
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-6">
                <p className="text-destructive">
                  {t("common.errorLabel", "Error")}: {error}
                </p>
              </CardContent>
            </Card>
          ) : orders.length ? (
            <div className="space-y-4">
              {orders.map((o) => {
                const total =
                  o?.totals?.total !== undefined && o?.totals?.total !== null
                    ? o.totals.total
                    : o?.total

                const createdAt = o?.created_at ? new Date(o.created_at) : null

                return (
                  <Card
                    key={o.id}
                    className="rounded-3xl border shadow-sm transition-all hover:shadow-md"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                              <Receipt className="h-5 w-5" />
                            </div>

                            <div>
                              <h3 className="font-semibold text-foreground">
                                {t("orders.orderLabel", "Comanda")} #{o.id}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {t("orders.fields.referenceShort", "Ref")}: {o?.reference || "—"}
                              </p>
                            </div>
                          </div>

                          {createdAt && (
                            <p className="mt-4 text-sm text-muted-foreground">
                              {createdAt.toLocaleString()}
                            </p>
                          )}

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <OrderInfoPill
                              label={t("orders.fields.status", "Estat")}
                              value={o?.status || "—"}
                            />
                            <OrderInfoPill
                              label={t("orders.fields.lines", "Línies")}
                              value={o?.lines_count ?? "—"}
                            />
                            <OrderInfoPill
                              label={t("orders.fields.total", "Total")}
                              value={money(total)}
                            />
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                await downloadInvoice(o.id)
                              } catch (e) {
                                console.error("Error downloading invoice:", e)
                                alert(
                                  e?.message ||
                                    t(
                                      "orders.actions.downloadInvoiceError",
                                      "Could not download the invoice."
                                    )
                                )
                              }
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {t("orders.actions.downloadInvoice", "Download invoice")}
                          </Button>

                          <Link to={`/orders/${o.id}`}>
                            <Button variant="outline" className="w-full">
                              {t("orders.actions.viewDetail", "View details")}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  {t("orders.empty", "Encara no tens cap comanda.")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}