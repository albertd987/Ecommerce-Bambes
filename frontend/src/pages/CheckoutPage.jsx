import React, { useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import api from "@/services/api"
import { useCart } from "@/context/cart-context"
import { useAuth } from "@/context/auth-context"

import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import CheckoutForm from "@/components/CheckoutForm"
import { useTranslation } from "react-i18next"

const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null

const SHIPPING_FLAT_RATE = 499 // 4.99€ en cèntims
const TAX_RATE = 0.21 // informatiu, IVA inclòs

const InputField = React.memo(function InputField({
  label,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  placeholder = "",
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary ${
          error ? "border-destructive" : "border-input"
        }`}
      />

      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  )
})

export default function CheckoutPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { items } = useCart()
  const { user } = useAuth()

  // ✅ Stripe UI locale sincronitzat amb i18next
  // Stripe accepta "en" i "ca" (Catalan). Si algun dia tens "en-US", ho normalitzem.
  const stripeLocale = i18n.language?.toLowerCase().startsWith("en") ? "en" : "ca"

  const [clientSecret, setClientSecret] = useState(null)
  const [serverTotals, setServerTotals] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})

  const [customer, setCustomer] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  })

  const [billing, setBilling] = useState({
    line_one: "",
    line_two: "",
    city: "",
    postcode: "",
    state: "",
    country_code: "ES",
  })

  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true)

  const [shipping, setShipping] = useState({
    line_one: "",
    line_two: "",
    city: "",
    postcode: "",
    state: "",
    country_code: "ES",
  })

  useEffect(() => {
    if (!user) return
    const nameParts = (user.name || "").trim().split(" ").filter(Boolean)

    setCustomer((prev) => ({
      ...prev,
      first_name: prev.first_name || nameParts[0] || "",
      last_name: prev.last_name || nameParts.slice(1).join(" ") || "",
      email: prev.email || user.email || "",
    }))
  }, [user])

  const lines = useMemo(() => {
    return (items ?? []).map((l) => ({
      product_id: l?.product?.id,
      qty: Number(l?.qty ?? 1),
    }))
  }, [items])

  // totals locals (fallback) — IVA inclòs
  const localSubtotal = useMemo(() => {
    return (items ?? []).reduce((acc, l) => {
      const price = Number(l?.product?.price || 0)
      const qty = Number(l?.qty || 0)
      return acc + price * qty * 100
    }, 0)
  }, [items])

  const localShipping = items.length > 0 ? SHIPPING_FLAT_RATE : 0
  const localGross = localSubtotal + localShipping
  const localTax =
    localGross > 0 ? Math.round(localGross - localGross / (1 + TAX_RATE)) : 0

  const displayTotals = serverTotals || {
    sub_total: localSubtotal,
    shipping_total: localShipping,
    tax_total: localTax,
    total: localGross,
    tax_included: true,
  }

  const money = (cents) => {
    if (cents === null || cents === undefined) return "—"
    return (Number(cents) / 100).toFixed(2) + "€"
  }

  const getPiFromClientSecret = (cs) => {
    if (!cs || typeof cs !== "string") return null
    const idx = cs.indexOf("_secret_")
    if (idx === -1) return null
    return cs.slice(0, idx)
  }

  const buildPayload = () => ({
    lines,
    customer,
    billing,
    shipping_same_as_billing: shippingSameAsBilling,
    shipping: shippingSameAsBilling ? billing : shipping,
     lang: i18n.language?.toLowerCase().startsWith("en") ? "en" : "ca",
  })

  const validateForm = () => {
    const errors = {}

    if (!customer.first_name.trim())
      errors["customer.first_name"] = t(
        "checkout.validation.firstNameRequired",
        "El nom és obligatori"
      )

    if (!customer.last_name.trim())
      errors["customer.last_name"] = t(
        "checkout.validation.lastNameRequired",
        "El cognom és obligatori"
      )

    if (!customer.email.trim())
      errors["customer.email"] = t(
        "checkout.validation.emailRequired",
        "L'email és obligatori"
      )

    if (!billing.line_one.trim())
      errors["billing.line_one"] = t(
        "checkout.validation.billingAddressRequired",
        "L'adreça és obligatòria"
      )

    if (!billing.city.trim())
      errors["billing.city"] = t(
        "checkout.validation.billingCityRequired",
        "La ciutat és obligatòria"
      )

    if (!billing.postcode.trim())
      errors["billing.postcode"] = t(
        "checkout.validation.billingPostcodeRequired",
        "El codi postal és obligatori"
      )

    if (!shippingSameAsBilling) {
      if (!shipping.line_one.trim())
        errors["shipping.line_one"] = t(
          "checkout.validation.shippingAddressRequired",
          "L'adreça d'enviament és obligatòria"
        )
      if (!shipping.city.trim())
        errors["shipping.city"] = t(
          "checkout.validation.shippingCityRequired",
          "La ciutat d'enviament és obligatòria"
        )
      if (!shipping.postcode.trim())
        errors["shipping.postcode"] = t(
          "checkout.validation.shippingPostcodeRequired",
          "El codi postal d'enviament és obligatori"
        )
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateIntent = async () => {
    setError(null)

    if (!stripePromise) {
      setError(
        t(
          "checkout.errors.missingStripeKey",
          "Falta VITE_STRIPE_PUBLISHABLE_KEY. Revisa el teu .env del frontend."
        )
      )
      return
    }

    if (!validateForm()) {
      setError(t("checkout.errors.reviewRequiredFields", "Revisa els camps obligatoris."))
      return
    }

    if (!lines.length) {
      setError(t("checkout.errors.cartEmpty", "El carret està buit."))
      return
    }

    if (lines.some((l) => !l.product_id)) {
      setError(
        t(
          "checkout.errors.missingProductId",
          "Hi ha productes al carret sense product_id."
        )
      )
      return
    }

    setLoading(true)
    setClientSecret(null)
    setServerTotals(null)

    try {
      const res = await api.post("/checkout/intent", buildPayload())

      const cs = res?.data?.client_secret
      if (!cs) {
        throw new Error(
          t(
            "checkout.errors.noClientSecret",
            "El servidor no ha retornat client_secret."
          )
        )
      }

      setClientSecret(cs)
      setServerTotals(res.data?.totals ?? null)
      setValidationErrors({})
    } catch (e) {
      const errorData = e?.response?.data

      if (errorData?.errors) {
        const mapped = {}
        for (const [key, msgs] of Object.entries(errorData.errors)) {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : msgs
        }
        setValidationErrors(mapped)
      }

      setError(errorData?.message || errorData?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!lines.length) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold">{t("checkout.title", "Checkout")}</h2>
          <p className="text-muted-foreground mt-2">
            {t("checkout.emptyCart", "No tens productes al carret.")}
          </p>
          <Link to="/">
            <Button className="mt-4" type="button">
              {t("checkout.backToProducts", "Tornar a productes")}
            </Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{t("checkout.title", "Checkout")}</h2>
          <Link to="/cart">
            <Button variant="outline" type="button">
              {t("checkout.backToCart", "Tornar al carret")}
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Formulari */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("checkout.contact.title", "Dades de contacte")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label={t("checkout.contact.firstName", "Nom")}
                    required
                    value={customer.first_name}
                    onChange={(e) =>
                      setCustomer((p) => ({ ...p, first_name: e.target.value }))
                    }
                    error={validationErrors["customer.first_name"]}
                    placeholder={t("checkout.placeholders.firstName", "Joan")}
                  />
                  <InputField
                    label={t("checkout.contact.lastName", "Cognom")}
                    required
                    value={customer.last_name}
                    onChange={(e) =>
                      setCustomer((p) => ({ ...p, last_name: e.target.value }))
                    }
                    error={validationErrors["customer.last_name"]}
                    placeholder={t("checkout.placeholders.lastName", "Garcia")}
                  />
                </div>

                <InputField
                  label={t("checkout.contact.email", "Email")}
                  required
                  type="email"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer((p) => ({ ...p, email: e.target.value }))
                  }
                  error={validationErrors["customer.email"]}
                  placeholder={t("checkout.placeholders.email", "joan@exemple.com")}
                />

                <InputField
                  label={t("checkout.contact.phone", "Telèfon")}
                  type="tel"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((p) => ({ ...p, phone: e.target.value }))
                  }
                  error={validationErrors["customer.phone"]}
                  placeholder={t("checkout.placeholders.phone", "+34 612 345 678")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("checkout.billing.title", "Adreça de facturació")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputField
                  label={t("checkout.billing.address1", "Adreça")}
                  required
                  value={billing.line_one}
                  onChange={(e) =>
                    setBilling((p) => ({ ...p, line_one: e.target.value }))
                  }
                  error={validationErrors["billing.line_one"]}
                  placeholder={t("checkout.placeholders.address1", "Carrer Major, 1")}
                />

                <InputField
                  label={t("checkout.billing.address2", "Adreça (línia 2)")}
                  value={billing.line_two}
                  onChange={(e) =>
                    setBilling((p) => ({ ...p, line_two: e.target.value }))
                  }
                  placeholder={t("checkout.placeholders.address2", "Pis 2n, Porta A")}
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label={t("checkout.billing.city", "Ciutat")}
                    required
                    value={billing.city}
                    onChange={(e) =>
                      setBilling((p) => ({ ...p, city: e.target.value }))
                    }
                    error={validationErrors["billing.city"]}
                    placeholder={t("checkout.placeholders.city", "Barcelona")}
                  />
                  <InputField
                    label={t("checkout.billing.postcode", "Codi postal")}
                    required
                    value={billing.postcode}
                    onChange={(e) =>
                      setBilling((p) => ({ ...p, postcode: e.target.value }))
                    }
                    error={validationErrors["billing.postcode"]}
                    placeholder={t("checkout.placeholders.postcode", "08001")}
                  />
                </div>

                <InputField
                  label={t("checkout.billing.state", "Província")}
                  value={billing.state}
                  onChange={(e) =>
                    setBilling((p) => ({ ...p, state: e.target.value }))
                  }
                  placeholder={t("checkout.placeholders.state", "Barcelona")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("checkout.shipping.title", "Adreça d'enviament")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shippingSameAsBilling}
                    onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">
                    {t(
                      "checkout.shipping.sameAsBilling",
                      "Mateixa adreça que la de facturació"
                    )}
                  </span>
                </label>

                {!shippingSameAsBilling && (
                  <div className="space-y-4 pt-2">
                    <InputField
                      label={t("checkout.shipping.address1", "Adreça")}
                      required
                      value={shipping.line_one}
                      onChange={(e) =>
                        setShipping((p) => ({ ...p, line_one: e.target.value }))
                      }
                      error={validationErrors["shipping.line_one"]}
                      placeholder={t("checkout.placeholders.address1", "Carrer Major, 1")}
                    />

                    <InputField
                      label={t("checkout.shipping.address2", "Adreça (línia 2)")}
                      value={shipping.line_two}
                      onChange={(e) =>
                        setShipping((p) => ({ ...p, line_two: e.target.value }))
                      }
                      placeholder={t("checkout.placeholders.address2", "Pis 2n, Porta A")}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label={t("checkout.shipping.city", "Ciutat")}
                        required
                        value={shipping.city}
                        onChange={(e) =>
                          setShipping((p) => ({ ...p, city: e.target.value }))
                        }
                        error={validationErrors["shipping.city"]}
                        placeholder={t("checkout.placeholders.city", "Barcelona")}
                      />
                      <InputField
                        label={t("checkout.shipping.postcode", "Codi postal")}
                        required
                        value={shipping.postcode}
                        onChange={(e) =>
                          setShipping((p) => ({ ...p, postcode: e.target.value }))
                        }
                        error={validationErrors["shipping.postcode"]}
                        placeholder={t("checkout.placeholders.postcode", "08001")}
                      />
                    </div>

                    <InputField
                      label={t("checkout.shipping.state", "Província")}
                      value={shipping.state}
                      onChange={(e) =>
                        setShipping((p) => ({ ...p, state: e.target.value }))
                      }
                      placeholder={t("checkout.placeholders.state", "Barcelona")}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PAGAMENT */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("checkout.payment.title", "Dades de pagament")}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {error && <p className="text-destructive text-sm">{error}</p>}

                {!clientSecret ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCreateIntent}
                    disabled={loading}
                    type="button"
                  >
                    {loading
                      ? t("checkout.payment.processing", "Processant...")
                      : t("checkout.payment.continue", "Continuar al pagament")}
                  </Button>
                ) : (
                  <>
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      {t(
                        "checkout.payment.intentCreated",
                        "✅ Intent creat. Ja pots completar el pagament."
                      )}
                    </div>

                    {/* ✅ IMPORTANT: locale + key per re-mount quan canvies idioma */}
                    <Elements
                      key={`${clientSecret}-${stripeLocale}`}
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        locale: stripeLocale,
                        // appearance opcional, però ajuda a consistència visual
                        appearance: { theme: "stripe" },
                      }}
                    >
                      <CheckoutForm
                        onSuccess={async (paymentIntent) => {
                          try {
                            let paymentIntentId =
                              paymentIntent?.id || getPiFromClientSecret(clientSecret)

                            if (!paymentIntentId) {
                              navigate("/checkout/success", {
                                state: { paymentStatus: "loading" },
                              })
                              return
                            }

                            const res = await api.post("/checkout/confirm", {
                              ...buildPayload(),
                              payment_intent_id: paymentIntentId,
                            })

                            navigate("/checkout/success", {
                              state: {
                                paymentStatus: paymentIntent?.status || "succeeded",
                                paymentIntentId,
                                order: res.data?.data ?? null,
                              },
                            })
                          } catch (e) {
                            const fallbackPi =
                              paymentIntent?.id || getPiFromClientSecret(clientSecret)
                            navigate("/checkout/success", {
                              state: {
                                paymentStatus: paymentIntent?.status || "succeeded",
                                paymentIntentId: fallbackPi || null,
                                confirmError:
                                  e?.response?.data?.error ||
                                  e?.response?.data?.message ||
                                  e.message,
                              },
                            })
                          }
                        }}
                      />
                    </Elements>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resum */}
          <div className="lg:sticky lg:top-6 h-fit">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("checkout.summary.title", "Resum de la comanda")}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {items.map((line) => {
                    const p = line.product || {}
                    const price = Number(p.price || 0)
                    const qty = Number(line.qty || 0)
                    return (
                      <div key={line.key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {p.name || t("checkout.summary.productFallback", "Producte")} x{qty}
                        </span>
                        <span>{(price * qty).toFixed(2)}€</span>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("checkout.summary.subtotal", "Subtotal (IVA inclòs)")}
                    </span>
                    <span>{money(displayTotals.sub_total)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("checkout.summary.shipping", "Enviament")}
                    </span>
                    <span>{money(displayTotals.shipping_total)}</span>
                  </div>

                  <div className="flex justify-between font-semibold text-base pt-2 border-t">
                    <span>{t("checkout.summary.total", "Total")}</span>
                    <span>{money(displayTotals.total)}</span>
                  </div>
                </div>

                {serverTotals ? (
                  <p className="text-xs text-muted-foreground">
                    {t("checkout.summary.confirmed", "* Totals confirmats pel servidor.")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "checkout.summary.estimated",
                      "* Estimació. El total definitiu es confirmarà al pagar."
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}