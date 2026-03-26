import { useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/context/auth-context"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import api from "@/services/api"
import { ArrowLeft, Home, MapPin, PencilLine, User } from "lucide-react"

const EMPTY_FORM = {
  label: "",
  line_one: "",
  line_two: "",
  city: "",
  state: "",
  postcode: "",
  country_code: "ES",
  is_default: false,
}

function InputField({
  label,
  value,
  onChange,
  placeholder = "",
  required = false,
  type = "text",
  error = "",
  success = false,
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
        className={`w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground ${
          error
            ? "border-destructive"
            : success
            ? "border-green-600"
            : "border-input"
        }`}
      />

      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function validateAddressForm(form, t) {
  const errors = {}

  const labelRegex = /^.{2,}$/
  const addressRegex = /^.{5,}$/
  const cityStateRegex = /^[A-Za-zÀ-ÿ\u00f1\u00d1\s'-]{2,}$/
  const postcodeRegex = /^\d{5}$/

  if (!form.label.trim()) {
    errors.label = t("addresses.validation.labelRequired", "El nom de la direcció és obligatori")
  } else if (!labelRegex.test(form.label.trim())) {
    errors.label = t("addresses.validation.labelInvalid", "Posa un nom de com a mínim 2 caràcters")
  }

  if (!form.line_one.trim()) {
    errors.line_one = t("addresses.validation.lineOneRequired", "L’adreça és obligatòria")
  } else if (!addressRegex.test(form.line_one.trim())) {
    errors.line_one = t("addresses.validation.lineOneInvalid", "L’adreça ha de tenir com a mínim 5 caràcters")
  }

  if (!form.city.trim()) {
    errors.city = t("addresses.validation.cityRequired", "La ciutat és obligatòria")
  } else if (!cityStateRegex.test(form.city.trim())) {
    errors.city = t("addresses.validation.cityInvalid", "La ciutat només pot contenir lletres i espais")
  }

  if (!form.postcode.trim()) {
    errors.postcode = t("addresses.validation.postcodeRequired", "El codi postal és obligatori")
  } else if (!postcodeRegex.test(form.postcode.trim())) {
    errors.postcode = t("addresses.validation.postcodeInvalid", "El codi postal ha de tenir 5 dígits")
  }

  if (form.state.trim() && !cityStateRegex.test(form.state.trim())) {
    errors.state = t("addresses.validation.stateInvalid", "La província només pot contenir lletres i espais")
  }

  return errors
}

function getFormStrength(form, errors) {
  const requiredFields = [
    form.label.trim(),
    form.line_one.trim(),
    form.city.trim(),
    form.postcode.trim(),
  ]

  const filledCount = requiredFields.filter(Boolean).length
  const hasErrors = Object.keys(errors).length > 0

  if (filledCount === 0) {
    return {
      label: "",
      colorClass: "bg-muted",
      score: 0,
    }
  }

  if (filledCount <= 2 || hasErrors) {
    return {
      label: "weak",
      colorClass: "bg-destructive",
      score: 1,
    }
  }

  if (filledCount === 3) {
    return {
      label: "medium",
      colorClass: "bg-yellow-500",
      score: 2,
    }
  }

  return {
    label: "strong",
    colorClass: "bg-green-600",
    score: 3,
  }
}

export default function AddressesPage() {
  const { t } = useTranslation()
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showValidation, setShowValidation] = useState(false)

  const isEditing = useMemo(() => editingId !== null, [editingId])

  const validationErrors = useMemo(
    () => validateAddressForm(form, t),
    [form, t]
  )

  const formStrength = useMemo(
    () => getFormStrength(form, validationErrors),
    [form, validationErrors]
  )

  const loadAddresses = async () => {
    try {
      setLoading(true)
      const res = await api.get("/user/addresses")
      setAddresses(res.data?.data ?? [])
    } catch (e) {
      console.error("Error loading addresses:", e)
      toast.error(
        t("addresses.toasts.loadError", "No s'han pogut carregar les direccions")
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return
    loadAddresses()
  }, [isLoggedIn])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowValidation(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setShowValidation(true)

    if (Object.keys(validationErrors).length > 0) {
      toast.error(
        t("addresses.toasts.validationError", "Revisa els camps del formulari")
      )
      return
    }

    setSaving(true)

    try {
      if (isEditing) {
        await api.put(`/user/addresses/${editingId}`, form)
        toast.success(
          t("addresses.toasts.updated", "Direcció actualitzada correctament")
        )
      } else {
        await api.post("/user/addresses", form)
        toast.success(
          t("addresses.toasts.created", "Direcció creada correctament")
        )
      }

      resetForm()
      await loadAddresses()
    } catch (e) {
      console.error("Error saving address:", e)
      toast.error(
        e?.response?.data?.message ||
          t("addresses.toasts.saveError", "No s'ha pogut desar la direcció")
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (address) => {
    setEditingId(address.id)
    setForm({
      label: address.label || "",
      line_one: address.line_one || "",
      line_two: address.line_two || "",
      city: address.city || "",
      state: address.state || "",
      postcode: address.postcode || "",
      country_code: address.country_code || "ES",
      is_default: !!address.is_default,
    })
    setShowValidation(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/user/addresses/${id}`)
      toast.success(
        t("addresses.toasts.deleted", "Direcció eliminada correctament")
      )
      if (editingId === id) resetForm()
      await loadAddresses()
    } catch (e) {
      console.error("Error deleting address:", e)
      toast.error(
        t("addresses.toasts.deleteError", "No s'ha pogut eliminar la direcció")
      )
    }
  }

  const strengthLabel =
    formStrength.label === "weak"
      ? t("addresses.strength.weak", "Feble")
      : formStrength.label === "medium"
      ? t("addresses.strength.medium", "Mitjana")
      : formStrength.label === "strong"
      ? t("addresses.strength.strong", "Correcta")
      : ""

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-3xl px-4 py-10">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="mb-4 text-muted-foreground">
                {t(
                  "addresses.notLoggedIn",
                  "Has d’iniciar sessió per gestionar les teves direccions."
                )}
              </p>
              <Link to="/login">
                <Button>{t("auth.login", "Iniciar sessió")}</Button>
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

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("profile.sections.addresses", "Direccions")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("addresses.title", "Les meves direccions")}
            </h1>
          </div>

          <Button variant="outline" onClick={() => navigate("/profile")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("addresses.backToProfile", "Tornar al perfil")}
          </Button>
        </div>

        <div className="mb-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <MapPin className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("addresses.title", "Les meves direccions")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "addresses.subtitle",
                        "Gestiona les teves adreces guardades per agilitzar les compres."
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

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <PencilLine className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-semibold text-foreground">
                    {isEditing
                      ? t("addresses.form.editTitle", "Editar direcció")
                      : t("addresses.form.createTitle", "Nova direcció")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isEditing
                      ? t(
                          "addresses.form.editSubtitle",
                          "Modifica la direcció seleccionada."
                        )
                      : t(
                          "addresses.form.createSubtitle",
                          "Afegeix una nova direcció al teu compte."
                        )}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField
                  label={t("addresses.fields.label", "Nom de la direcció")}
                  required
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder={t("addresses.placeholders.label", "Casa")}
                  error={showValidation ? validationErrors.label : ""}
                  success={showValidation && !validationErrors.label && !!form.label.trim()}
                />

                <InputField
                  label={t("addresses.fields.lineOne", "Adreça")}
                  required
                  value={form.line_one}
                  onChange={(e) => setForm((p) => ({ ...p, line_one: e.target.value }))}
                  error={showValidation ? validationErrors.line_one : ""}
                  success={showValidation && !validationErrors.line_one && !!form.line_one.trim()}
                />

                <InputField
                  label={t("addresses.fields.lineTwo", "Adreça (línia 2)")}
                  value={form.line_two}
                  onChange={(e) => setForm((p) => ({ ...p, line_two: e.target.value }))}
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label={t("addresses.fields.city", "Ciutat")}
                    required
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    error={showValidation ? validationErrors.city : ""}
                    success={showValidation && !validationErrors.city && !!form.city.trim()}
                  />
                  <InputField
                    label={t("addresses.fields.postcode", "Codi postal")}
                    required
                    value={form.postcode}
                    onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value }))}
                    error={showValidation ? validationErrors.postcode : ""}
                    success={showValidation && !validationErrors.postcode && !!form.postcode.trim()}
                  />
                </div>

                <InputField
                  label={t("addresses.fields.state", "Província")}
                  value={form.state}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                  error={showValidation ? validationErrors.state : ""}
                  success={showValidation && !!form.state.trim() && !validationErrors.state}
                />

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {t("addresses.strength.title", "Validació del formulari")}
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">
                      {strengthLabel}
                    </span>
                  </div>

                  <div className="mb-4 flex gap-2">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-2 flex-1 rounded-full ${
                          formStrength.score >= level ? formStrength.colorClass : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>

                  <ul className="space-y-1.5 text-xs">
                    <li className={!validationErrors.label && form.label ? "text-foreground" : "text-muted-foreground"}>
                      <span className="mr-2">{!validationErrors.label && form.label ? "✓" : "•"}</span>
                      {t("addresses.rules.label", "Nom de la direcció vàlid")}
                    </li>
                    <li className={!validationErrors.line_one && form.line_one ? "text-foreground" : "text-muted-foreground"}>
                      <span className="mr-2">{!validationErrors.line_one && form.line_one ? "✓" : "•"}</span>
                      {t("addresses.rules.address", "Adreça vàlida")}
                    </li>
                    <li className={!validationErrors.city && form.city ? "text-foreground" : "text-muted-foreground"}>
                      <span className="mr-2">{!validationErrors.city && form.city ? "✓" : "•"}</span>
                      {t("addresses.rules.city", "Ciutat vàlida")}
                    </li>
                    <li className={!validationErrors.postcode && form.postcode ? "text-foreground" : "text-muted-foreground"}>
                      <span className="mr-2">{!validationErrors.postcode && form.postcode ? "✓" : "•"}</span>
                      {t("addresses.rules.postcode", "Codi postal de 5 dígits")}
                    </li>
                  </ul>
                </div>

                <div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-muted/40 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, is_default: e.target.checked }))
                      }
                    />
                    <span className="text-sm">
                      {t("addresses.fields.isDefault", "Marcar com a predeterminada")}
                    </span>
                  </label>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <Button type="submit" disabled={saving}>
                    {saving
                      ? t("addresses.actions.saving", "Desant...")
                      : isEditing
                      ? t("addresses.actions.update", "Actualitzar")
                      : t("addresses.actions.create", "Guardar direcció")}
                  </Button>

                  {isEditing && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      {t("addresses.actions.cancel", "Cancel·lar")}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {loading ? (
              <Card className="rounded-2xl border shadow-sm">
                <CardContent className="p-6">
                  <p className="text-muted-foreground">
                    {t("addresses.loading", "Carregant direccions...")}
                  </p>
                </CardContent>
              </Card>
            ) : addresses.length === 0 ? (
              <Card className="rounded-2xl border shadow-sm">
                <CardContent className="p-6">
                  <p className="text-muted-foreground">
                    {t("addresses.empty", "Encara no tens cap direcció guardada.")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              addresses.map((address) => (
                <Card
                  key={address.id}
                  className="rounded-3xl border shadow-sm transition-all hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                            <Home className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-foreground">
                              {address.label}
                            </h3>
                            {address.is_default && (
                              <span className="mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                                {t("addresses.defaultBadge", "Predeterminada")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                          <p>{address.line_one}</p>
                          {address.line_two ? <p>{address.line_two}</p> : null}
                          <p>
                            {address.postcode} · {address.city}
                          </p>
                          {address.state ? <p>{address.state}</p> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" onClick={() => handleEdit(address)}>
                          {t("addresses.actions.edit", "Editar")}
                        </Button>
                        <Button variant="destructive" onClick={() => handleDelete(address.id)}>
                          {t("addresses.actions.delete", "Eliminar")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}