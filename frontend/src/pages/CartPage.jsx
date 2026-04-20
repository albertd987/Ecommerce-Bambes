import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useCart } from "@/context/cart-context"
import { Link } from "react-router-dom"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"

const SHIPPING_FLAT_RATE = 499 // 4.99€ en cèntims
const TAX_RATE = 0.21 // 21% IVA (informatiu, ja inclòs)

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj)
}

function getSafeText(value) {
  if (value == null) return null
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)

  if (typeof value === "object") {
    if (typeof value.value === "string") return value.value
    if (typeof value.name === "string") return value.name
    if (typeof value.label === "string") return value.label
    if (typeof value.text === "string") return value.text

    if (value.attribute_data) {
      if (typeof value.attribute_data.value === "string") return value.attribute_data.value
      if (typeof value.attribute_data.name === "string") return value.attribute_data.name
    }
  }

  return null
}

function translateColor(color, t, scope = "cart") {
  if (!color) return ""
  const key = String(color).trim().toUpperCase()
  return t(`${scope}.colors.${key}`, color)
}

function extractOption(line, product, keys = []) {
  const candidates = [
    line?.variant,
    line?.meta,
    line?.options,
    line?.purchasable,
    product?.variant,
    product?.options,
    product?.attribute_data,
  ]

  for (const source of candidates) {
    if (!source || typeof source !== "object") continue

    for (const key of keys) {
      const direct = getSafeText(source[key])
      if (direct) return direct

      const nested = getSafeText(getNestedValue(source, key))
      if (nested) return nested
    }
  }

  if (Array.isArray(line?.options)) {
    for (const opt of line.options) {
      const name = String(opt?.name || opt?.label || "").toLowerCase()
      const value = getSafeText(opt?.value)

      if (!value) continue

      if (keys.includes("color") && name.includes("color")) return value
      if (keys.includes("size") && (name.includes("size") || name.includes("talla"))) return value
    }
  }

  return null
}

function DetailPill({ children }) {
  return (
    <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  )
}

export default function CartPage() {
  const { t } = useTranslation()
  const { items, cartCount, cartSubtotal, updateQty, removeItem, clearCart } = useCart()

  const subtotalNumber = Number(cartSubtotal || 0)
  const subtotalCents = useMemo(() => Math.round(subtotalNumber * 100), [subtotalNumber])

  const shippingCents = items.length > 0 ? SHIPPING_FLAT_RATE : 0
  const totalCents = subtotalCents + shippingCents

  const taxIncludedCents = useMemo(() => {
    if (!items.length || totalCents <= 0) return 0
    return Math.round(totalCents - totalCents / (1 + TAX_RATE))
  }, [items.length, totalCents])

  const money = (cents) => (Number(cents) / 100).toFixed(2) + "€"

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("cart.title", "Carret")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("cart.title", "Carret")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("cart.items", { count: cartCount, defaultValue: "{{count}} article(s)" })}
            </p>
          </div>

          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("cart.continueShopping", "Continuar comprant")}
            </Button>
          </Link>
        </div>

        {items.length === 0 ? (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle>{t("cart.empty.title", "El carret està buit")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t("cart.empty.subtitle", "Afegeix algun producte per començar.")}
              </p>
            </CardContent>
            <CardFooter>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                {t("cart.empty.cta", "Veure productes")}
              </Link>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              {items.map((line) => {
                const p = line.product || {}
                const price = Number(p.price || 0)
                const qty = Number(line.qty || 0)
                const lineTotal = price * qty

                const imgSrc =
                  typeof p.image === "string" && p.image.startsWith("http")
                    ? p.image
                    : typeof p.thumbnail === "string" && p.thumbnail.startsWith("http")
                      ? p.thumbnail
                      : "https://placehold.co/200x200?text=No+Image"

                const resolvedColor =
                  p.color ||
                  extractOption(line, p, [
                    "color",
                    "colour",
                    "attribute_data.color",
                    "values.color",
                  ]) ||
                  null

                const resolvedSize =
                  p.size ||
                  extractOption(line, p, [
                    "size",
                    "talla",
                    "attribute_data.size",
                    "values.size",
                  ]) ||
                  null

                return (
                  <Card
                    key={line.key}
                    className="rounded-3xl border shadow-sm transition-all hover:shadow-md"
                  >
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
                          <img
                            src={imgSrc}
                            alt={p.name || t("cart.productFallback", "Producte")}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm text-muted-foreground">{p.brand ?? "—"}</p>

                              <h3 className="mt-1 font-semibold leading-tight text-foreground">
                                {p.name ?? t("cart.productFallback", "Producte")}
                              </h3>

                              {(resolvedColor || resolvedSize) && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {resolvedColor && (
                                    <DetailPill>
                                      {t("cart.details.color", "Color")}:{" "}
                                      {translateColor(resolvedColor, t, "cart")}
                                    </DetailPill>
                                  )}

                                  {resolvedSize && (
                                    <DetailPill>
                                      {t("cart.details.size", "Talla")}: {resolvedSize}
                                    </DetailPill>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-lg font-bold">{price.toFixed(2)}€</p>
                              <p className="text-sm text-muted-foreground">
                                {t("cart.lineTotal", "Total")}: {lineTotal.toFixed(2)}€
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="inline-flex w-fit items-center rounded-2xl border bg-background p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateQty(line.key, qty - 1)}
                                aria-label={t("cart.qty.decrease", "Disminuir quantitat")}
                                disabled={qty <= 1}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>

                              <span className="min-w-10 text-center text-sm font-medium">
                                {qty}
                              </span>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateQty(line.key, qty + 1)}
                                aria-label={t("cart.qty.increase", "Augmentar quantitat")}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button variant="destructive" onClick={() => removeItem(line.key)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("cart.remove", "Eliminar")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              <div className="flex justify-end">
                <Button variant="outline" onClick={clearCart}>
                  {t("cart.clear", "Buidar carret")}
                </Button>
              </div>
            </div>

            <Card className="h-fit rounded-3xl border shadow-sm lg:sticky lg:top-6">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{t("cart.summary.title", "Resum")}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("cart.items", { count: cartCount, defaultValue: "{{count}} article(s)" })}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("cart.summary.subtotal", "Subtotal (IVA inclòs)")}
                  </span>
                  <span className="font-medium">{subtotalNumber.toFixed(2)}€</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("cart.summary.shipping", "Enviament")}
                  </span>
                  <span className="font-medium">{money(shippingCents)}</span>
                </div>

                <div className="border-t pt-4 flex justify-between">
                  <span className="font-semibold">{t("cart.summary.total", "Total")}</span>
                  <span className="text-lg font-bold">{money(totalCents)}</span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t(
                    "cart.summary.note",
                    "* Els preus ja inclouen IVA. L’enviament és tarifa plana."
                  )}
                </p>

                {/* IVA informatiu opcional
                <p className="text-xs text-muted-foreground">
                  {t("cart.summary.taxIncluded", "IVA inclòs")}: {money(taxIncludedCents)}
                </p>
                */}
              </CardContent>

              <CardFooter>
                <Button asChild className="w-full" size="lg">
                  <Link to="/checkout">{t("cart.checkout", "Anar a pagar")}</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}