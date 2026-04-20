import React, { useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import api from "@/services/api"
import { useCart } from "@/context/cart-context"
import { useAuth } from "@/context/auth-context"

import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import CheckoutForm from "@/components/CheckoutForm"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  ArrowLeft,
  CreditCard,
  MapPin,
  Package,
  Plus,
  Truck,
  User,
} from "lucide-react"

const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null

const SHIPPING_FLAT_RATE = 499
const TAX_RATE = 0.21

const EMPTY_BILLING = {
  line_one: "",
  line_two: "",
  city: "",
  postcode: "",
  state: "",
  country_code: "ES",
}

const EMPTY_SHIPPING = {
  line_one: "",
  line_two: "",
  city: "",
  postcode: "",
  state: "",
  country_code: "ES",
}

const EMPTY_SAVE_ADDRESS = {
  enabled: false,
  label: "",
  is_default: false,
}

const cityStateRegex = /^[A-Za-zÀ-ÿ\u00f1\u00d1\s'-]{2,}$/
const postcodeRegex = /^\d{5}$/
const addressRegex = /^.{5,}$/
const labelRegex = /^.{2,}$/

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
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary ${error ? "border-destructive" : "border-input"
          }`}
      />

      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  )
})

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-6 md:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {children}
      </CardContent>
    </Card>
  )
}

function addressToBilling(address) {
  if (!address) return EMPTY_BILLING
  return {
    line_one: address.line_one || "",
    line_two: address.line_two || "",
    city: address.city || "",
    postcode: address.postcode || "",
    state: address.state || "",
    country_code: address.country_code || "ES",
  }
}

function addressToShipping(address) {
  if (!address) return EMPTY_SHIPPING
  return {
    line_one: address.line_one || "",
    line_two: address.line_two || "",
    city: address.city || "",
    postcode: address.postcode || "",
    state: address.state || "",
    country_code: address.country_code || "ES",
  }
}

function AddressSelectableCard({ address, selected, onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-all ${selected
        ? "border-foreground ring-2 ring-foreground/20 bg-muted/20"
        : "border-border hover:border-foreground/40 hover:bg-muted/10"
        }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <p className="font-medium">{address.label}</p>
        {address.is_default && (
          <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
            {t("checkout.addressBook.defaultBadge", "Predeterminada")}
          </span>
        )}
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          {address.first_name} {address.last_name}
        </p>
        <p>{address.line_one}</p>
        {address.line_two ? <p>{address.line_two}</p> : null}
        <p>
          {address.postcode} · {address.city}
        </p>
      </div>
    </button>
  )
}

function NewAddressCard({ selected, onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full h-full min-h-[160px] rounded-2xl border p-4 transition-all flex flex-col items-center justify-center text-center ${selected
        ? "border-foreground ring-2 ring-foreground/20 bg-muted/20"
        : "border-dashed border-border hover:border-foreground/40 hover:bg-muted/10"
        }`}
    >
      <Plus className="h-6 w-6 mb-2" />
      <p className="font-medium">{t("checkout.addressBook.newAddress", "Nova direcció")}</p>
      <p className="text-sm text-muted-foreground mt-1">
        {t("checkout.addressBook.newAddressHelp", "Introdueix una nova adreça manualment")}
      </p>
    </button>
  )
}

function AddressSummaryBox({ title, address }) {
  if (!address) return null

  return (
    <div className="border rounded-2xl p-4 bg-muted/20">
      <p className="font-medium mb-2">{title}</p>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>{address.line_one}</p>
        {address.line_two ? <p>{address.line_two}</p> : null}
        <p>
          {address.postcode} · {address.city}
        </p>
        {address.state ? <p>{address.state}</p> : null}
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { items } = useCart()
  const { user } = useAuth()

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

  const [billing, setBilling] = useState(EMPTY_BILLING)
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true)
  const [shipping, setShipping] = useState(EMPTY_SHIPPING)

  const [savedAddresses, setSavedAddresses] = useState([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)

  const [selectedAddressId, setSelectedAddressId] = useState("")
  const [useNewAddress, setUseNewAddress] = useState(false)

  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState("")
  const [useNewShippingAddress, setUseNewShippingAddress] = useState(false)

  const [saveAddress, setSaveAddress] = useState(EMPTY_SAVE_ADDRESS)

  const selectedSavedAddress = useMemo(() => {
    return savedAddresses.find((addr) => String(addr.id) === String(selectedAddressId)) || null
  }, [savedAddresses, selectedAddressId])

  const selectedSavedShippingAddress = useMemo(() => {
    return (
      savedAddresses.find((addr) => String(addr.id) === String(selectedShippingAddressId)) || null
    )
  }, [savedAddresses, selectedShippingAddressId])

  useEffect(() => {
    if (!user) return

    const nameParts = (user.name || "").trim().split(" ").filter(Boolean)

    setCustomer((prev) => ({
      ...prev,
      first_name: prev.first_name || nameParts[0] || "",
      last_name: prev.last_name || nameParts.slice(1).join(" ") || "",
      email: prev.email || user.email || "",
      phone: prev.phone || user.phone || "",
    }))
  }, [user])

  useEffect(() => {
    const loadAddresses = async () => {
      if (!user) return

      try {
        setLoadingAddresses(true)
        const res = await api.get("/user/addresses")
        const data = res.data?.data ?? []
        setSavedAddresses(data)

        const defaultAddress = data.find((addr) => addr.is_default)
        if (defaultAddress) {
          setSelectedAddressId(String(defaultAddress.id))
          setBilling(addressToBilling(defaultAddress))
          setUseNewAddress(false)

          setSelectedShippingAddressId(String(defaultAddress.id))
          setShipping(addressToShipping(defaultAddress))
          setUseNewShippingAddress(false)
        } else {
          setUseNewAddress(true)
          setUseNewShippingAddress(true)
        }
      } catch (e) {
        console.error("Error loading saved addresses:", e)
        setUseNewAddress(true)
        setUseNewShippingAddress(true)
      } finally {
        setLoadingAddresses(false)
      }
    }

    loadAddresses()
  }, [user])

  const lines = useMemo(() => {
    return (items ?? []).map((l) => ({
      product_id: l?.product?.id,
      qty: Number(l?.qty ?? 1),
    }))
  }, [items])

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

    if (!customer.first_name.trim()) {
      errors["customer.first_name"] = t(
        "checkout.validation.firstNameRequired",
        "El nom és obligatori"
      )
    }

    if (!customer.last_name.trim()) {
      errors["customer.last_name"] = t(
        "checkout.validation.lastNameRequired",
        "El cognom és obligatori"
      )
    }

    if (!customer.email.trim()) {
      errors["customer.email"] = t(
        "checkout.validation.emailRequired",
        "L'email és obligatori"
      )
    }

    if (useNewAddress) {
      if (!billing.line_one.trim()) {
        errors["billing.line_one"] = t(
          "checkout.validation.billingAddressRequired",
          "L'adreça és obligatòria"
        )
      } else if (!addressRegex.test(billing.line_one.trim())) {
        errors["billing.line_one"] = t(
          "checkout.validation.addressInvalid",
          "L'adreça ha de tenir com a mínim 5 caràcters"
        )
      }

      if (!billing.city.trim()) {
        errors["billing.city"] = t(
          "checkout.validation.billingCityRequired",
          "La ciutat és obligatòria"
        )
      } else if (!cityStateRegex.test(billing.city.trim())) {
        errors["billing.city"] = t(
          "checkout.validation.cityInvalid",
          "La ciutat només pot contenir lletres i espais"
        )
      }

      if (!billing.postcode.trim()) {
        errors["billing.postcode"] = t(
          "checkout.validation.billingPostcodeRequired",
          "El codi postal és obligatori"
        )
      } else if (!postcodeRegex.test(billing.postcode.trim())) {
        errors["billing.postcode"] = t(
          "checkout.validation.postcodeInvalid",
          "El codi postal ha de tenir 5 dígits"
        )
      }

      if (billing.state.trim() && !cityStateRegex.test(billing.state.trim())) {
        errors["billing.state"] = t(
          "checkout.validation.stateInvalid",
          "La província només pot contenir lletres i espais"
        )
      }
    }

    if (!shippingSameAsBilling && useNewShippingAddress) {
      if (!shipping.line_one.trim()) {
        errors["shipping.line_one"] = t(
          "checkout.validation.shippingAddressRequired",
          "L'adreça d'enviament és obligatòria"
        )
      } else if (!addressRegex.test(shipping.line_one.trim())) {
        errors["shipping.line_one"] = t(
          "checkout.validation.addressInvalid",
          "L'adreça ha de tenir com a mínim 5 caràcters"
        )
      }

      if (!shipping.city.trim()) {
        errors["shipping.city"] = t(
          "checkout.validation.shippingCityRequired",
          "La ciutat d'enviament és obligatòria"
        )
      } else if (!cityStateRegex.test(shipping.city.trim())) {
        errors["shipping.city"] = t(
          "checkout.validation.cityInvalid",
          "La ciutat només pot contenir lletres i espais"
        )
      }

      if (!shipping.postcode.trim()) {
        errors["shipping.postcode"] = t(
          "checkout.validation.shippingPostcodeRequired",
          "El codi postal d'enviament és obligatori"
        )
      } else if (!postcodeRegex.test(shipping.postcode.trim())) {
        errors["shipping.postcode"] = t(
          "checkout.validation.postcodeInvalid",
          "El codi postal ha de tenir 5 dígits"
        )
      }

      if (shipping.state.trim() && !cityStateRegex.test(shipping.state.trim())) {
        errors["shipping.state"] = t(
          "checkout.validation.stateInvalid",
          "La província només pot contenir lletres i espais"
        )
      }
    }

    if (useNewAddress && saveAddress.enabled) {
      if (!saveAddress.label.trim()) {
        errors["save_address.label"] = t(
          "checkout.addressBook.validation.labelRequired",
          "Posa un nom a la direcció"
        )
      } else if (!labelRegex.test(saveAddress.label.trim())) {
        errors["save_address.label"] = t(
          "checkout.addressBook.validation.labelInvalid",
          "Posa un nom de com a mínim 2 caràcters"
        )
      }
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

  const handleSelectSavedAddress = (address) => {
    setSelectedAddressId(String(address.id))
    setBilling(addressToBilling(address))
    setUseNewAddress(false)
    setSaveAddress(EMPTY_SAVE_ADDRESS)
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next["billing.line_one"]
      delete next["billing.city"]
      delete next["billing.postcode"]
      delete next["billing.state"]
      delete next["save_address.label"]
      return next
    })
  }

  const handleSelectNewAddress = () => {
    setSelectedAddressId("")
    setUseNewAddress(true)
    setBilling(EMPTY_BILLING)
  }

  const handleSelectSavedShippingAddress = (address) => {
    setSelectedShippingAddressId(String(address.id))
    setShipping(addressToShipping(address))
    setUseNewShippingAddress(false)
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next["shipping.line_one"]
      delete next["shipping.city"]
      delete next["shipping.postcode"]
      delete next["shipping.state"]
      return next
    })
  }

  const handleSelectNewShippingAddress = () => {
    setSelectedShippingAddressId("")
    setUseNewShippingAddress(true)
    setShipping(EMPTY_SHIPPING)
  }

  const handleSaveCurrentAddress = async () => {
    if (!useNewAddress || !saveAddress.enabled) return

    if (!labelRegex.test(saveAddress.label.trim())) {
      return
    }

    try {
      await api.post("/user/addresses", {
        label: saveAddress.label,
        first_name: customer.first_name,
        last_name: customer.last_name,
        contact_email: customer.email,
        contact_phone: customer.phone,
        line_one: billing.line_one,
        line_two: billing.line_two,
        city: billing.city,
        state: billing.state,
        postcode: billing.postcode,
        country_code: billing.country_code || "ES",
        is_default: saveAddress.is_default,
      })

      toast.success(
        t("checkout.addressBook.toasts.saved", "Direcció guardada correctament")
      )

      const res = await api.get("/user/addresses")
      const data = res.data?.data ?? []
      setSavedAddresses(data)

      const justSaved = data.find((addr) => addr.label === saveAddress.label)
      if (justSaved) {
        setSelectedAddressId(String(justSaved.id))
        setUseNewAddress(false)
      }

      setSaveAddress(EMPTY_SAVE_ADDRESS)
    } catch (e) {
      console.error("Error saving checkout address:", e)
      toast.error(
        e?.response?.data?.message ||
        t("checkout.addressBook.toasts.saveError", "No s'ha pogut guardar la direcció")
      )
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

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("checkout.title", "Checkout")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("checkout.title", "Checkout")}
            </h1>
          </div>

          <Link to="/cart">
            <Button variant="outline" type="button">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("checkout.backToCart", "Tornar al carret")}
            </Button>
          </Link>
        </div>

        <div className="mb-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Package className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("checkout.title", "Checkout")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "checkout.subtitle",
                        "Revisa les teves dades, tria l'adreça i completa el pagament."
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
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <SectionCard
              icon={User}
              title={t("checkout.contact.title", "Dades de contacte")}
              subtitle={t(
                "checkout.contact.subtitle",
                "Confirma la informació personal per a la comanda."
              )}
            >
              <div className="space-y-4">
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
              </div>
            </SectionCard>

            <SectionCard
              icon={MapPin}
              title={t("checkout.addressBook.title", "Adreça de facturació")}
              subtitle={t(
                "checkout.addressBook.subtitle",
                "Selecciona una direcció guardada o crea'n una de nova."
              )}
            >
              <div className="space-y-5">
                {loadingAddresses ? (
                  <p className="text-sm text-muted-foreground">
                    {t("checkout.addressBook.loading", "Carregant direccions...")}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {savedAddresses.map((address) => (
                        <AddressSelectableCard
                          key={address.id}
                          address={address}
                          selected={!useNewAddress && String(address.id) === String(selectedAddressId)}
                          onClick={() => handleSelectSavedAddress(address)}
                          t={t}
                        />
                      ))}

                      <NewAddressCard
                        selected={useNewAddress}
                        onClick={handleSelectNewAddress}
                        t={t}
                      />
                    </div>

                    {savedAddresses.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "checkout.addressBook.helpCards",
                          "Clica una direcció guardada per utilitzar-la, o selecciona nova direcció per escriure'n una manualment."
                        )}
                      </p>
                    ) : null}

                    {!useNewAddress && selectedSavedAddress ? (
                      <div className="border rounded-2xl p-4 bg-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">
                            {t("checkout.addressBook.selectedAddress", "Direcció seleccionada")}
                          </p>
                          {selectedSavedAddress.is_default && (
                            <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                              {t("checkout.addressBook.defaultBadge", "Predeterminada")}
                            </span>
                          )}
                        </div>

                        {selectedSavedAddress.label ? (
                          <p className="text-sm font-medium mb-2">{selectedSavedAddress.label}</p>
                        ) : null}

                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            {selectedSavedAddress.first_name} {selectedSavedAddress.last_name}
                          </p>
                          <p>{selectedSavedAddress.line_one}</p>
                          {selectedSavedAddress.line_two ? <p>{selectedSavedAddress.line_two}</p> : null}
                          <p>
                            {selectedSavedAddress.postcode} · {selectedSavedAddress.city}
                          </p>
                          {selectedSavedAddress.state ? <p>{selectedSavedAddress.state}</p> : null}
                          {selectedSavedAddress.contact_phone ? <p>{selectedSavedAddress.contact_phone}</p> : null}
                          {selectedSavedAddress.contact_email ? <p>{selectedSavedAddress.contact_email}</p> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-2xl p-4 space-y-4">
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
                          error={validationErrors["billing.state"]}
                          placeholder={t("checkout.placeholders.state", "Barcelona")}
                        />

                        <div className="border rounded-xl p-4 space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saveAddress.enabled}
                              onChange={(e) =>
                                setSaveAddress((p) => ({ ...p, enabled: e.target.checked }))
                              }
                            />
                            <span className="text-sm">
                              {t(
                                "checkout.addressBook.saveThisAddress",
                                "Guardar aquesta direcció per a futures compres"
                              )}
                            </span>
                          </label>

                          {saveAddress.enabled && (
                            <>
                              <InputField
                                label={t("checkout.addressBook.label", "Nom de la direcció")}
                                required
                                value={saveAddress.label}
                                onChange={(e) =>
                                  setSaveAddress((p) => ({ ...p, label: e.target.value }))
                                }
                                error={validationErrors["save_address.label"]}
                                placeholder={t("checkout.addressBook.labelPlaceholder", "Casa")}
                              />

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={saveAddress.is_default}
                                  onChange={(e) =>
                                    setSaveAddress((p) => ({
                                      ...p,
                                      is_default: e.target.checked,
                                    }))
                                  }
                                />
                                <span className="text-sm">
                                  {t(
                                    "checkout.addressBook.setDefault",
                                    "Marcar com a direcció predeterminada"
                                  )}
                                </span>
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard
              icon={Truck}
              title={t("checkout.shipping.title", "Adreça d'enviament")}
              subtitle={t(
                "checkout.shipping.subtitle",
                "Tria on vols rebre la teva comanda."
              )}
            >
              <div className="space-y-5">
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

                {shippingSameAsBilling ? (
                  <AddressSummaryBox
                    title={t("checkout.shipping.sameAddressSummary", "S'utilitzarà la mateixa adreça")}
                    address={billing}
                  />
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {savedAddresses.map((address) => (
                        <AddressSelectableCard
                          key={address.id}
                          address={address}
                          selected={
                            !useNewShippingAddress &&
                            String(address.id) === String(selectedShippingAddressId)
                          }
                          onClick={() => handleSelectSavedShippingAddress(address)}
                          t={t}
                        />
                      ))}

                      <NewAddressCard
                        selected={useNewShippingAddress}
                        onClick={handleSelectNewShippingAddress}
                        t={t}
                      />
                    </div>

                    {savedAddresses.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "checkout.shipping.helpCards",
                          "Selecciona una direcció guardada per a l'enviament o tria nova direcció per introduir-ne una de manual."
                        )}
                      </p>
                    ) : null}

                    {!useNewShippingAddress && selectedSavedShippingAddress ? (
                      <div className="border rounded-2xl p-4 bg-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">
                            {t("checkout.shipping.selectedAddress", "Adreça d'enviament seleccionada")}
                          </p>
                          {selectedSavedShippingAddress.is_default && (
                            <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                              {t("checkout.addressBook.defaultBadge", "Predeterminada")}
                            </span>
                          )}
                        </div>

                        {selectedSavedShippingAddress.label ? (
                          <p className="text-sm font-medium mb-2">
                            {selectedSavedShippingAddress.label}
                          </p>
                        ) : null}

                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            {selectedSavedShippingAddress.first_name}{" "}
                            {selectedSavedShippingAddress.last_name}
                          </p>
                          <p>{selectedSavedShippingAddress.line_one}</p>
                          {selectedSavedShippingAddress.line_two ? (
                            <p>{selectedSavedShippingAddress.line_two}</p>
                          ) : null}
                          <p>
                            {selectedSavedShippingAddress.postcode} ·{" "}
                            {selectedSavedShippingAddress.city}
                          </p>
                          {selectedSavedShippingAddress.state ? (
                            <p>{selectedSavedShippingAddress.state}</p>
                          ) : null}
                          {selectedSavedShippingAddress.contact_phone ? (
                            <p>{selectedSavedShippingAddress.contact_phone}</p>
                          ) : null}
                          {selectedSavedShippingAddress.contact_email ? (
                            <p>{selectedSavedShippingAddress.contact_email}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-2xl p-4 space-y-4">
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
                          error={validationErrors["shipping.state"]}
                          placeholder={t("checkout.placeholders.state", "Barcelona")}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard
              icon={CreditCard}
              title={t("checkout.payment.title", "Dades de pagament")}
              subtitle={t(
                "checkout.payment.subtitle",
                "Completa el pagament de manera segura amb Stripe."
              )}
            >
              <div className="space-y-4">
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
                    <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                      {t(
                        "checkout.payment.intentCreated",
                        "✅ Intent creat. Ja pots completar el pagament."
                      )}
                    </div>

                    <Elements
                      key={`${clientSecret}-${stripeLocale}`}
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        locale: stripeLocale,
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

                            await handleSaveCurrentAddress()

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
              </div>
            </SectionCard>
          </div>

          <div className="lg:sticky lg:top-6 h-fit">
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-6">
                <div className="mb-5">
                  <h3 className="text-lg font-semibold">
                    {t("checkout.summary.title", "Resum de la comanda")}
                  </h3>
                </div>

                <div className="space-y-3">
                  {items.map((line) => {
                    const p = line.product || {}
                    const price = Number(p.price || 0)
                    const qty = Number(line.qty || 0)
                    return (
                      <div key={line.key} className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {p.name || t("checkout.summary.productFallback", "Producte")} x{qty}
                        </span>
                        <span>{(price * qty).toFixed(2)}€</span>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t pt-4 mt-4 space-y-3 text-sm">
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
                  <p className="text-xs text-muted-foreground mt-4">
                    {t("checkout.summary.confirmed", "* Totals confirmats pel servidor.")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-4">
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