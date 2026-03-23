import { useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/context/auth-context"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import api from "@/services/api"

const EMPTY_FORM = {
  label: "",
  first_name: "",
  last_name: "",
  contact_email: "",
  contact_phone: "",
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
        className="w-full rounded-md border px-3 py-2 text-sm bg-background"
      />
    </div>
  )
}

export default function AddressesPage() {
  const { t } = useTranslation()
  const { isLoggedIn, user } = useAuth()

  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const isEditing = useMemo(() => editingId !== null, [editingId])

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

  useEffect(() => {
    if (!user) return
    setForm((prev) => ({
      ...prev,
      contact_email: prev.contact_email || user.email || "",
    }))
  }, [user])

  const resetForm = () => {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      contact_email: user?.email || "",
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      first_name: address.first_name || "",
      last_name: address.last_name || "",
      contact_email: address.contact_email || "",
      contact_phone: address.contact_phone || "",
      line_one: address.line_one || "",
      line_two: address.line_two || "",
      city: address.city || "",
      state: address.state || "",
      postcode: address.postcode || "",
      country_code: address.country_code || "ES",
      is_default: !!address.is_default,
    })
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-10 max-w-4xl">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground mb-4">
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

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              {t("addresses.title", "Les meves direccions")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("addresses.signedInAs", "Sessió iniciada com")}: {user?.name || user?.email}
            </p>
          </div>

          <Link to="/profile">
            <Button variant="outline">
              {t("addresses.backToProfile", "Tornar al perfil")}
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>
                {isEditing
                  ? t("addresses.form.editTitle", "Editar direcció")
                  : t("addresses.form.createTitle", "Nova direcció")}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField
                  label={t("addresses.fields.label", "Nom de la direcció")}
                  required
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder={t("addresses.placeholders.label", "Casa")}
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label={t("addresses.fields.firstName", "Nom")}
                    required
                    value={form.first_name}
                    onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  />
                  <InputField
                    label={t("addresses.fields.lastName", "Cognom")}
                    required
                    value={form.last_name}
                    onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                  />
                </div>

                <InputField
                  label={t("addresses.fields.email", "Email")}
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                />

                <InputField
                  label={t("addresses.fields.phone", "Telèfon")}
                  value={form.contact_phone}
                  onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
                />

                <InputField
                  label={t("addresses.fields.lineOne", "Adreça")}
                  required
                  value={form.line_one}
                  onChange={(e) => setForm((p) => ({ ...p, line_one: e.target.value }))}
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
                  />
                  <InputField
                    label={t("addresses.fields.postcode", "Codi postal")}
                    required
                    value={form.postcode}
                    onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value }))}
                  />
                </div>

                <InputField
                  label={t("addresses.fields.state", "Província")}
                  value={form.state}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                />

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
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

                <div className="flex gap-2">
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
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground">
                    {t("addresses.loading", "Carregant direccions...")}
                  </p>
                </CardContent>
              </Card>
            ) : addresses.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground">
                    {t("addresses.empty", "Encara no tens cap direcció guardada.")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              addresses.map((address) => (
                <Card key={address.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{address.label}</h3>
                          {address.is_default && (
                            <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                              {t("addresses.defaultBadge", "Predeterminada")}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-sm text-muted-foreground space-y-1">
                          <p>
                            {address.first_name} {address.last_name}
                          </p>
                          <p>{address.line_one}</p>
                          {address.line_two ? <p>{address.line_two}</p> : null}
                          <p>
                            {address.postcode} · {address.city}
                          </p>
                          {address.state ? <p>{address.state}</p> : null}
                          {address.contact_phone ? <p>{address.contact_phone}</p> : null}
                          {address.contact_email ? <p>{address.contact_email}</p> : null}
                        </div>
                      </div>

                      <div className="flex gap-2">
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