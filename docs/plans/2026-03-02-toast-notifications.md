# Toast Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir tots els `alert()` de `ProductDetailPage.jsx` per toast notifications usant Sonner, i registrar el `<Toaster>` a `App.jsx`.

**Architecture:** Sonner s'instal·la com a dependència npm. El component `<Toaster>` es col·loca una sola vegada a `App.jsx` fora del `<BrowserRouter>`. A `ProductDetailPage.jsx` s'importa `toast` de `sonner` i es substitueixen els 4 `alert()` per crides semàntiques (`toast.warning`, `toast.error`, `toast.success`).

**Tech Stack:** React 19, Vite, Sonner, Tailwind CSS

---

### Task 1: Instal·lar Sonner

**Files:**
- Modify: `frontend/package.json` (auto-update via npm)

**Step 1: Instal·lar la dependència**

```bash
cd frontend
npm install sonner
```

Expected output: `added 1 package` (o similar), sense errors.

**Step 2: Verificar que s'ha afegit a package.json**

A `frontend/package.json`, a `dependencies`, ha d'aparèixer:
```json
"sonner": "^x.x.x"
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: install sonner for toast notifications"
```

---

### Task 2: Registrar `<Toaster>` a App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Afegir l'import de Toaster**

A la part superior de `frontend/src/App.jsx`, afegir:
```js
import { Toaster } from "sonner"
```

**Step 2: Afegir `<Toaster>` dins del return**

Col·locar `<Toaster>` just abans del tancament del fragment/div arrel, dins de `<BrowserRouter>`. El component final ha de quedar així:

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import HomePage from "./pages/HomePage"
import CartPage from "./pages/CartPage"
import CheckoutPage from "./pages/CheckoutPage"
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage"
import ProductDetailPage from "@/pages/ProductDetailPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ProfilePage from "./pages/ProfilePage"
import OrdersPage from "./pages/OrdersPage"
import OrderDetailPage from "./pages/OrderDetailPage"
import ChangePasswordPage from "./pages/ChangePasswordPage"
import VerifyEmailPage from "./pages/VerifyEmailPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
      <Toaster position="bottom-right" richColors theme="light" />
    </BrowserRouter>
  )
}

export default App
```

**Step 3: Verificar visualment**

Arrencar el servidor de dev (`npm run dev`) i obrir qualsevol pàgina. No ha d'haver errors a la consola.

**Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add Sonner Toaster to App root"
```

---

### Task 3: Substituir els `alert()` a ProductDetailPage.jsx

**Files:**
- Modify: `frontend/src/pages/ProductDetailPage.jsx`

El fitxer actual té 4 `alert()` dins de `handleAddToCart` (línies ~62-93). S'han de substituir tots per toasts semàntics.

**Step 1: Afegir l'import de toast**

A la línia 1 de `ProductDetailPage.jsx`, afegir:
```js
import { toast } from "sonner"
```

**Step 2: Substituir els `alert()` per toasts**

Localitzar la funció `handleAddToCart` i substituir cada `alert()`:

| Línia aprox. | Codi actual | Codi nou |
|---|---|---|
| ~62 | `alert('Selecciona una talla')` | `toast.warning('Selecciona una talla')` |
| ~69 | `alert('Variant no disponible')` | `toast.error('Variant no disponible')` |
| ~74 | `alert('No hi ha estoc disponible')` | `toast.error('No hi ha estoc disponible')` |
| ~84 | `alert('Producte afegit al carret!')` | `toast.success('Producte afegit a la cistella!')` |
| ~86 | `alert('Error en afegir al carret')` (dins else) | `toast.error('Error en afegir al carret')` |
| ~90 | `alert('Error en afegir al carret')` (catch) | `toast.error('Error en afegir al carret')` |

La funció `handleAddToCart` resultant ha de quedar:

```js
const handleAddToCart = async () => {
  if (!selectedSize || !selectedColor) {
    toast.warning('Selecciona una talla')
    return
  }

  const variant = findVariant(variantsData.variantMap, selectedSize, selectedColor)

  if (!variant) {
    toast.error('Variant no disponible')
    return
  }

  if (variant.stock <= 0) {
    toast.error('No hi ha estoc disponible')
    return
  }

  try {
    setAddingToCart(true)

    const result = await addItem({ variant_id: variant.id }, 1)

    if (result.success) {
      toast.success('Producte afegit a la cistella!')
    } else {
      toast.error('Error en afegir al carret')
    }
  } catch (err) {
    console.error('Error adding to cart:', err)
    toast.error('Error en afegir al carret')
  } finally {
    setAddingToCart(false)
  }
}
```

**Step 3: Verificar visualment**

1. Obrir una pàgina de producte (`/products/:id`)
2. Clicar "Afegir a la cistella" sense seleccionar talla → ha d'aparèixer un toast groc/warning baix a la dreta
3. Seleccionar talla i clicar → ha d'aparèixer un toast verd/success
4. Verificar que no queda cap `alert()` al fitxer

**Step 4: Commit**

```bash
git add frontend/src/pages/ProductDetailPage.jsx
git commit -m "feat: replace alert() with sonner toasts in ProductDetailPage"
```

---

### Task 4: Actualitzar features.md

**Files:**
- Modify: `features.md`

**Step 1: Marcar la feature com a completada**

A `features.md`, a la secció `### UX / UI`, canviar:
```
- [ ] Notificacions toast (afegir al carret, errors, etc.)
```
per:
```
- [x] Notificacions toast (afegir al carret, errors, etc.)
```

**Step 2: Commit**

```bash
git add features.md
git commit -m "docs: mark toast notifications as done"
```
