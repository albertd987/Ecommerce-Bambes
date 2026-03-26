import { useEffect, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Link, useSearchParams } from "react-router-dom"
import api from "@/services/api"
import { useAuth } from "@/context/auth-context"
import { useTranslation } from "react-i18next"

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [searchParams] = useSearchParams()

  const verifyUrl = searchParams.get("verify_url")
  const verifiedParam = searchParams.get("verified")

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const doVerify = async () => {
    if (!verifyUrl) return
    setLoading(true)
    setErr(null)
    setMsg(null)

    try {
      const res = await fetch(verifyUrl, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      })

      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(
          j?.message ||
            t(
              "verifyEmail.errors.verifyFailed",
              "No s'ha pogut verificar el correu."
            )
        )
      }

      setMsg(t("verifyEmail.success", "Correu verificat correctament."))
      await refreshUser?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (verifiedParam === "1") {
      setMsg(t("verifyEmail.success", "Correu verificat correctament."))
      refreshUser?.()
      return
    }

    if (verifyUrl) doVerify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyUrl, verifiedParam])

  const resend = async () => {
    setLoading(true)
    setErr(null)
    setMsg(null)

    try {
      await api.post("/email/verification-notification")
      setMsg(t("verifyEmail.resent", "Email reenviat. Revisa la bústia."))
    } catch (e) {
      setErr(e?.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 sm:py-10 w-full max-w-sm sm:max-w-xl md:max-w-3xl space-y-4">
        <h2 className="text-2xl font-bold">
          {t("verifyEmail.title", "Verifica el teu correu")}
        </h2>

        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            {t("verifyEmail.signedInAs", "Sessió iniciada com")}
          </p>
          <p className="font-medium truncate">{user?.email || "—"}</p>
        </div>

        <p className="text-muted-foreground">
          {t(
            "verifyEmail.description",
            "T’hem enviat un correu amb un enllaç de verificació. Quan el cliquis, aquesta pàgina farà la verificació automàticament."
          )}
        </p>

        {msg && <p className="text-sm">{msg}</p>}
        {err && (
          <p className="text-sm text-destructive">
            ❌ {err}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button onClick={resend} variant="outline" disabled={loading} className="min-h-[44px] w-full sm:w-auto">
            {t("verifyEmail.resend", "Reenviar email")}
          </Button>

          <Button onClick={doVerify} disabled={loading || !verifyUrl} className="min-h-[44px] w-full sm:w-auto">
            {loading
              ? t("verifyEmail.verifying", "Verificant...")
              : t("verifyEmail.alreadyVerified", "Ja he verificat")}
          </Button>

          <Link to="/profile" className="w-full sm:w-auto">
            <Button variant="ghost" className="min-h-[44px] w-full sm:w-auto">
              {t("verifyEmail.backToProfile", "Tornar al perfil")}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}