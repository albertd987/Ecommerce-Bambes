import Header from "@/components/Header"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "react-i18next"

// Leaflet / React-Leaflet
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"

// ✅ Fix icones Leaflet (Vite / bundlers)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
})

export default function AboutPage() {
    const { t } = useTranslation()

    // 📍 Canvia aquestes coordenades a la vostra ubicació real
    const position = [41.58400849618671, 1.601228735146023] // Institut Milà i Fontanals (aprox)

    // ✅ Imatge HERO (posa-la a: frontend/public/about/hero-shoe.png)
    const heroImage = "/about/hero-shoe.png"

    // ✅ Foto conjunta equip (posa-la a: frontend/public/team/team.jpeg)
    // Si és PNG, canvia-ho a "/team/team.png"
    const teamPhoto = "/team/team.jpeg"

    const values = [
        {
            title: t("about.values.v1.title", "Qualitat"),
            text: t(
                "about.values.v1.text",
                "Seleccionem productes amb bons materials i confort real."
            ),
        },
        {
            title: t("about.values.v2.title", "Atenció"),
            text: t(
                "about.values.v2.text",
                "Respondem ràpid i volem que comprar sigui fàcil."
            ),
        },
        {
            title: t(
                "about.values.v3.title",
                "Transparència"
            ),
            text: t(
                "about.values.v3.text",
                "Preus clars, informació clara i zero sorpreses."
            ),
        },
    ]

    return (
        <div className="min-h-screen bg-background">
            <Header />

            <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10 sm:space-y-12">
                {/* HERO */}
                <section className="rounded-2xl border bg-background overflow-hidden">
                    <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="p-6 sm:p-8 lg:p-10">
                            <p className="text-sm text-muted-foreground">
                                {t("about.kicker", "Sobre nosaltres")}
                            </p>

                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-2">
                                {t(
                                    "about.title",
                                    "Bambes fetes amb cap: ràpides, còmodes i amb estil."
                                )}
                            </h1>

                            <p className="text-muted-foreground mt-4 leading-relaxed">
                                {t(
                                    "about.subtitle",
                                    "Som un equip petit de DAW que està construint un e-commerce modern per aprendre i fer-ho bé: filtres ràpids, checkout real i una experiència tipus Nike."
                                )}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm">
                                    {t("about.badges.b1", "Frontend React")}
                                </span>
                                <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm">
                                    {t("about.badges.b2", "Laravel API")}
                                </span>
                                <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm">
                                    {t("about.badges.b3", "Stripe Checkout")}
                                </span>
                                <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm">
                                    {t("about.badges.b4", "i18n (CA/EN)")}
                                </span>
                            </div>
                        </div>

                        {/* ✅ Lateral amb imatge (hero image) */}
                        <div className="relative min-h-[220px] sm:min-h-[260px] lg:min-h-full bg-muted overflow-hidden">
                            <img
                                src={heroImage}
                                alt="Hero"
                                className="absolute inset-0 h-full w-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                }}
                            />

                            <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-background/35 to-background/70" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />

                            <div className="absolute inset-0 flex items-end p-6 lg:p-8">
                                <div className="w-full rounded-2xl border bg-background/80 backdrop-blur px-4 py-3 shadow-sm">
                                    <p className="text-sm font-medium">
                                        {t("about.heroCard.title", "Projecte DAW · Ecommerce Bambes")}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t(
                                            "about.heroCard.text",
                                            "UI cuidada, dades reals i mapa amb Leaflet."
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* VALORS */}
                <section className="space-y-4">
                    <h2 className="text-xl sm:text-2xl font-bold">
                        {t("about.values.title", "El que ens mou")}
                    </h2>

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {values.map((v) => (
                            <Card key={v.title} className="rounded-2xl">
                                <CardContent className="p-6">
                                    <p className="font-semibold">{v.title}</p>
                                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                        {v.text}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* TEAM (1 sola foto + resum) */}
                <section className="space-y-4">
                    <h2 className="text-xl sm:text-2xl font-bold">
                        {t("about.team.title", "L’equip")}
                    </h2>

                    <p className="text-muted-foreground">
                        {t(
                            "about.team.subtitle",
                            "Som dos i ens hem repartit el projecte per fer-lo complet: interfície cuidada, API sòlida i checkout real."
                        )}
                    </p>

                    <Card className="rounded-2xl overflow-hidden">
                        {/* Foto rectangular */}
                        <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                            <img
                                src={teamPhoto}
                                alt={t("about.team.photoAlt", "Foto de l’equip")}
                                className="absolute inset-0 h-full w-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                }}
                            />
                            {/* overlay suau */}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                        </div>

                        <CardContent className="p-6">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <p className="text-lg font-semibold">
                                        {t("about.team.duoTitle", "Albert i David")}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {t(
                                            "about.team.duoSubtitle",
                                            "Un duo de DAW: producte, codi i detalls fins que quedi fi."
                                        )}
                                    </p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-xl border p-4">
                                        <p className="font-semibold">
                                            {t("about.team.albert.name", "Albert")}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t("about.team.albert.role", "Frontend / UX")}
                                        </p>
                                        <p className="text-sm mt-2 leading-relaxed text-foreground/90">
                                            {t(
                                                "about.team.albert.bio",
                                                "S’encarrega de l’experiència d’usuari: filtres Nike-like, components, disseny i que tot sigui ràpid i clar."
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border p-4">
                                        <p className="font-semibold">
                                            {t("about.team.david.name", "David")}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t("about.team.david.role", "Backend / API")}
                                        </p>
                                        <p className="text-sm mt-2 leading-relaxed text-foreground/90">
                                            {t(
                                                "about.team.david.bio",
                                                "Porta la lògica i la integració: endpoints, autenticació, dades i pagaments reals amb Stripe perquè el checkout funcioni de veritat."
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        "about.team.photoHintSingle",
                                        "Hem generat la foto amb IA a partir de les nostres cares reals, per protegir la nostra privadesa però mantenir una imatge propera i humana."
                                    )}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* MAPA */}
                <section className="space-y-4">
                    <h2 className="text-xl sm:text-2xl font-bold">{t("about.map.title", "On som")}</h2>
                    <p className="text-muted-foreground">
                        {t(
                            "about.map.subtitle",
                            "Ens podeu trobar a Igualada, al cor de Catalunya. Aquí és on estem desenvolupant aquest projecte de DAW, i on ens inspiren les vistes i la tranquil·litat per escriure codi net i crear una experiència d’usuari excepcional."
                        )}
                    </p>

                    <Card className="rounded-2xl overflow-hidden">
                        <div className="h-[280px] sm:h-[350px] md:h-[420px] w-full">
                            <MapContainer
                                center={position}
                                zoom={17}
                                scrollWheelZoom={false}
                                className="h-full w-full"
                            >
                                <TileLayer
                                    attribution="&copy; OpenStreetMap contributors"
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <Marker position={position}>
                                    <Popup>
                                        <div className="space-y-1">
                                            <p className="font-medium">
                                                {t("about.map.popupTitle", "Institut Milà i Fontanals")}
                                            </p>

                                            <p className="text-sm">
                                                {t("about.map.popupText", "Igualada · Projecte DAW Ecommerce")}
                                            </p>
                                        </div>
                                    </Popup>
                                </Marker>
                            </MapContainer>
                        </div>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="rounded-2xl">
                            <CardContent className="p-6">
                                <p className="font-semibold">{t("about.contact.title", "Contacte")}</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {t("about.contact.text", "Escriu-nos per dubtes, incidències o millores del projecte.")}
                                </p>
                                <div className="mt-4 text-sm space-y-1">
                                    <p>
                                        <span className="text-muted-foreground">{t("about.contact.emailLabel", "Email")}: </span>
                                        <span className="font-medium">ddiaz4@milaifontanals.org</span>
                                        
                                    </p>
                                                  <p>
                                        <span className="text-muted-foreground">{t("about.contact.emailLabel", "Email")}: </span>
                                        <span className="font-medium">adomenech@milaifontanals.org</span>
                                        
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">{t("about.contact.phoneLabel", "Telèfon")}: </span>
                                        <span className="font-medium">+34 600 000 000</span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl">
                            <CardContent className="p-6">
                                <p className="font-semibold">{t("about.hours.title", "Horari")}</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {t("about.hours.text", "Horari d’atenció al client.")}
                                </p>
                                <div className="mt-4 text-sm space-y-1">
                                    <p>
                                        <span className="text-muted-foreground">{t("about.hours.weekdays", "Dll–Dv")}: </span>
                                        <span className="font-medium">09:00–14:00</span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">{t("about.hours.weekend", "Ds–Dg")}: </span>
                                        <span className="font-medium">{t("about.hours.closed", "Tancat")}</span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </main>
        </div>
    )
}