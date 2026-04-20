import { useEffect, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import api from "@/services/api"
import { useAuth } from "@/context/auth-context"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const verifyUrl = searchParams.get("verify_url")
  const verifiedParam = searchParams.get("verified")

  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)
  const [resentMsg, setResentMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [isVerified, setIsVerified] = useState(!!user?.email_verified_at)

  const resetMessages = () => {
    setSuccessMsg(null)
    setResentMsg(null)
    setErr(null)
  }

  const doVerify = async () => {
    if (!verifyUrl) return

    setLoading(true)
    resetMessages()

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

      setSuccessMsg(t("verifyEmail.success", "Correu verificat correctament."))
      setIsVerified(true)
      await refreshUser?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setIsVerified(!!user?.email_verified_at)
  }, [user])

  useEffect(() => {
    if (verifiedParam === "1") {
      setSuccessMsg(t("verifyEmail.success", "Correu verificat correctament."))
      setResentMsg(null)
      setErr(null)
      setIsVerified(true)
      refreshUser?.()
      return
    }

    if (verifyUrl && !isVerified) doVerify()

  }, [verifyUrl, verifiedParam, isVerified])

  const resend = async () => {
    setLoading(true)
    setErr(null)
    setSuccessMsg(null)
    setResentMsg(null)

    try {
      await api.post("/email/verification-notification")
      setResentMsg(t("verifyEmail.resent", "Correu reenviat. Revisa la bústia."))
    } catch (e) {
      setErr(e?.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  const showVerifySuccess = !!successMsg && !err
  const showResentSuccess = !!resentMsg && !err
  const showError = !!err

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("verifyEmail.kicker", "Compte")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("verifyEmail.title", "Verifica el teu correu")}
            </h1>
          </div>

          <Button variant="outline" onClick={() => navigate("/profile")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("verifyEmail.backToProfile", "Tornar al perfil")}
          </Button>
        </div>

        <div className="mb-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Mail className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("verifyEmail.title", "Verifica el teu correu")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "verifyEmail.description",
                        "T’hem enviat un correu amb un enllaç de verificació. Quan el cliquis, aquesta pàgina farà la verificació automàticament."
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t("verifyEmail.securityTitle", "Verificació segura")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "verifyEmail.securityText",
                        "Això ajuda a protegir el teu compte i confirmar la teva identitat."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  {t("verifyEmail.signedInAs", "Sessió iniciada com")}
                </p>
                <p className="mt-1 truncate font-medium">{user?.email || "—"}</p>
              </div>

              {showVerifySuccess ? (
                <div className="mb-5 rounded-2xl border border-green-600/20 bg-green-600/5 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t("verifyEmail.successTitle", "Correu verificat")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {successMsg}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {showResentSuccess ? (
                <div className="mb-5 rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 text-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t("verifyEmail.resentTitle", "Correu reenviat")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {resentMsg}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {showError ? (
                <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t("verifyEmail.errorTitle", "No s'ha pogut verificar")}
                      </p>
                      <p className="mt-1 text-sm text-destructive">{err}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!showVerifySuccess && !showResentSuccess && !showError ? (
                <div className="mb-5 rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {loading
                      ? t("verifyEmail.verifyingTitle", "Verificant el correu...")
                      : isVerified
                      ? t("verifyEmail.successTitle", "Correu verificat")
                      : t("verifyEmail.pendingTitle", "Pendent de verificació")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {loading
                      ? t(
                          "verifyEmail.verifyingText",
                          "Estem comprovant l'enllaç de verificació."
                        )
                      : isVerified
                      ? t(
                          "verifyEmail.success",
                          "Correu verificat correctament."
                        )
                      : t(
                          "verifyEmail.pendingText",
                          "Quan obris l'enllaç del correu, la verificació es farà automàticament."
                        )}
                  </p>
                </div>
              ) : null}

              {!isVerified && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={resend} variant="outline" disabled={loading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("verifyEmail.resend", "Reenviar email")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {!isVerified ? (
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold">
                  {t("verifyEmail.helpTitle", "Què has de fer ara")}
                </h3>

                <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                  <div className="rounded-2xl bg-muted/30 p-4">
                    <p className="font-medium text-foreground">
                      {t("verifyEmail.step1Title", "1. Revisa la teva bústia")}
                    </p>
                    <p className="mt-1">
                      {t(
                        "verifyEmail.step1Text",
                        "Busca el correu de verificació que t’hem enviat."
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/30 p-4">
                    <p className="font-medium text-foreground">
                      {t("verifyEmail.step2Title", "2. Fes clic a l’enllaç")}
                    </p>
                    <p className="mt-1">
                      {t(
                        "verifyEmail.step2Text",
                        "Quan obris l’enllaç, aquesta pàgina completarà la verificació."
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/30 p-4">
                    <p className="font-medium text-foreground">
                      {t("verifyEmail.step3Title", "3. Torna al teu perfil")}
                    </p>
                    <p className="mt-1">
                      {t(
                        "verifyEmail.step3Text",
                        "Un cop verificat, ja podràs continuar utilitzant totes les funcionalitats."
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold">
                  {t("verifyEmail.verifiedBoxTitle", "Compte verificat")}
                </h3>

                <div className="mt-4 rounded-2xl border border-green-600/20 bg-green-600/5 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t("verifyEmail.verifiedNowTitle", "Ja està tot llest")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(
                          "verifyEmail.verifiedNowText",
                          "El teu correu ja està verificat i el compte està preparat per utilitzar totes les funcionalitats."
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}