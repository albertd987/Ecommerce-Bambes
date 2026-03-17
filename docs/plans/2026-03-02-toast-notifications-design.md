# Toast Notifications — Design

**Data:** 2026-03-02
**Estat:** Aprovat

## Resum

Afegir notificacions toast a l'app usant **Sonner**, la llibreria de shadcn/ui. Substituir tots els `alert()` existents a `ProductDetailPage.jsx` per toasts semàntics.

## Tecnologia

- **Llibreria:** `sonner` (npm install sonner)
- **Motiu:** És la llibreria oficial de shadcn/ui, compatible amb React 19, i encaixa amb les variables CSS de Tailwind ja existents.

## Configuració

- Afegir `<Toaster>` una sola vegada a `App.jsx`
- `position="bottom-right"`
- `richColors` — colors semàntics automàtics (verd/vermell/groc)
- `theme="light"` — fons blanc consistent amb el disseny

## Events a notificar

| Fitxer | Event | Tipus | Missatge |
|---|---|---|---|
| `ProductDetailPage.jsx` | Selecciona talla | `toast.warning()` | "Selecciona una talla" |
| `ProductDetailPage.jsx` | Variant no disponible | `toast.error()` | "Variant no disponible" |
| `ProductDetailPage.jsx` | Sense estoc | `toast.error()` | "No hi ha estoc disponible" |
| `ProductDetailPage.jsx` | Producte afegit | `toast.success()` | "Producte afegit a la cistella" |
| `ProductDetailPage.jsx` | Error en afegir | `toast.error()` | "Error en afegir al carret" |

## Fora d'abast

- CartPage, CheckoutPage i altres pàgines — es poden afegir en una iteració posterior.
- Cap personalització visual addicional de Sonner — `richColors` ja és suficient.
