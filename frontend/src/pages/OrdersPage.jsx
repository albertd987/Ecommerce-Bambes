import { useEffect, useRef, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import api, { downloadInvoice } from "@/services/api"
import { useTranslation } from "react-i18next"

export default function OrdersPage() {
  const { t } = useTranslation()
  const { isLoggedIn, user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [orders, setOrders] = useState([])
  const didRunRef = useRef(false)

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

  const loadOrders = async () => {
    setLoading(true)
    setError(null)

    try {
      // Portem un grapat (si després vols paginació, ho fem)
      const res = await api.get("/orders", { params: { per_page: 20 } })
      setOrders(res.data?.data || [])
    } catch (e) {
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {t("orders.title", "Les meves comandes")}
          </h2>

          <div className="flex gap-2">
            {isLoggedIn && (
              <Button variant="outline" onClick={loadOrders} disabled={loading}>
                {loading
                  ? t("orders.actions.refreshing", "Actualitzant...")
                  : t("orders.actions.refresh", "Actualitzar")}
              </Button>
            )}

            <Link to="/profile">
              <Button variant="outline">
                {t("orders.actions.backToProfile", "Tornar al perfil")}
              </Button>
            </Link>
          </div>
        </div>

        {!isLoggedIn ? (
          <div className="border rounded-lg p-4">
            <p className="text-muted-foreground">
              {t("orders.notLoggedIn", "Has d’iniciar sessió per veure les comandes.")}
            </p>
            <Link to="/login">
              <Button className="mt-3">
                {t("auth.login.title", "Iniciar sessió")}
              </Button>
            </Link>
          </div>
        ) : error ? (
          <div className="border rounded-lg p-4">
            <p className="text-destructive">
              {t("common.errorLabel", "Error")}: {error}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                {t("orders.signedInAs", "Sessió iniciada com")}
              </p>
              <p className="font-medium truncate">{user?.name || user?.email}</p>
            </div>

            {orders.length ? (
              orders.map((o) => {
                // ✅ Total robust: pot venir com o.totals.total o o.total (root)
                const total =
                  o?.totals?.total !== undefined && o?.totals?.total !== null
                    ? o.totals.total
                    : o?.total

                const createdAt = o?.created_at ? new Date(o.created_at) : null

                return (
                  <div key={o.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          {t("orders.orderLabel", "Comanda")} #{o.id}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {t("orders.fields.status", "Estat")}: {o?.status || "—"} ·{" "}
                          {t("orders.fields.referenceShort", "Ref")}: {o?.reference || "—"}
                        </p>

                        {createdAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {createdAt.toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {t("orders.fields.total", "Total")}
                        </p>
                        <p className="font-semibold">{money(total)}</p>
                      </div>
                    </div>

                    <div className="h-px bg-border my-4" />

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {t("orders.fields.lines", "Línies")}: {o?.lines_count ?? "—"}
                      </div>

<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={async () => {
      try {
        await downloadInvoice(o.id)
      } catch (e) {
        console.error("Error downloading invoice:", e)
        alert(
          e?.message ||
            t("orders.actions.downloadInvoiceError", "Could not download the invoice.")
        )
      }
    }}
  >
    {t("orders.actions.downloadInvoice", "Download invoice")}
  </Button>

  <Link to={`/orders/${o.id}`}>
    <Button variant="outline" size="sm">
      {t("orders.actions.viewDetail", "View details")}
    </Button>
  </Link>
</div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="border rounded-lg p-4">
                <p className="text-muted-foreground">
                  {t("orders.empty", "Encara no tens cap comanda.")}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}