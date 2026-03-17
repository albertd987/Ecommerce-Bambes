import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useCart } from "@/context/cart-context"
import { Link } from "react-router-dom"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

const SHIPPING_FLAT_RATE = 499 // 4.99€ en cèntims
const TAX_RATE = 0.21 // 21% IVA (informatiu, ja inclòs)

export default function CartPage() {
  const { t } = useTranslation()
  const { items, cartCount, cartSubtotal, updateQty, removeItem, clearCart } = useCart()

  const subtotalNumber = Number(cartSubtotal || 0)
  const subtotalCents = useMemo(() => Math.round(subtotalNumber * 100), [subtotalNumber])

  const shippingCents = items.length > 0 ? SHIPPING_FLAT_RATE : 0
  const totalCents = subtotalCents + shippingCents

  // IVA inclòs (informatiu): gross - gross/(1+iva)
  const taxIncludedCents = useMemo(() => {
    if (!items.length || totalCents <= 0) return 0
    return Math.round(totalCents - totalCents / (1 + TAX_RATE))
  }, [items.length, totalCents])

  const money = (cents) => (Number(cents) / 100).toFixed(2) + "€"

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{t("cart.title", "Carret")}</h2>
            <p className="text-muted-foreground">
              {t("cart.items", { count: cartCount, defaultValue: "{{count}} article(s)" })}
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            {t("cart.continueShopping", "Continuar comprant")}
          </Link>
        </div>

        {items.length === 0 ? (
          <Card>
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
            {/* Llista */}
            <div className="space-y-4">
              {items.map((line) => {
                const p = line.product || {}
                const price = Number(p.price || 0)
                const qty = Number(line.qty || 0)
                const lineTotal = price * qty

                const imgSrc =
                  typeof p.image === "string" && p.image.startsWith("http")
                    ? p.image
                    : "https://placehold.co/200x200?text=No+Image"

                return (
                  <Card key={line.key}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                          <img
                            src={imgSrc}
                            alt={p.name || t("cart.productFallback", "Producte")}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{p.brand ?? "—"}</p>
                              <h3 className="font-semibold leading-tight">
                                {p.name ?? t("cart.productFallback", "Producte")}
                              </h3>
                            </div>

                            <div className="text-right">
                              <p className="text-lg font-bold">{price.toFixed(2)}€</p>
                              <p className="text-sm text-muted-foreground">
                                {t("cart.lineTotal", "Total")}: {lineTotal.toFixed(2)}€
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updateQty(line.key, qty - 1)}
                                aria-label={t("cart.qty.decrease", "Disminuir quantitat")}
                                disabled={qty <= 1}
                              >
                                −
                              </Button>

                              <span className="min-w-10 text-center font-medium">{qty}</span>

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updateQty(line.key, qty + 1)}
                                aria-label={t("cart.qty.increase", "Augmentar quantitat")}
                              >
                                +
                              </Button>
                            </div>

                            <Button variant="destructive" onClick={() => removeItem(line.key)}>
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

            {/* Resum */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>{t("cart.summary.title", "Resum")}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("cart.summary.subtotal", "Subtotal (IVA inclòs)")}
                  </span>
                  <span className="font-medium">{subtotalNumber.toFixed(2)}€</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("cart.summary.shipping", "Enviament")}
                  </span>
                  <span className="font-medium">{money(shippingCents)}</span>
                </div>

                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">{t("cart.summary.total", "Total")}</span>
                  <span className="font-bold text-lg">{money(totalCents)}</span>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t(
                    "cart.summary.note",
                    "* Els preus ja inclouen IVA. L’enviament és tarifa plana."
                  )}
                </p>

                {/* (Opcional) IVA informatiu (si el vols mostrar algun dia):
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