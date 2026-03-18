# Testing Strategy — Ecommerce Bambes

**Data:** 2026-03-18
**Projecte:** Ecommerce Bambes (Laravel + React + Lunar + Stripe)
**Estat:** Aprovat pel equip

---

## 1. Objectiu

Cobrir tots els casos edge de cada interacció del projecte per detectar errors avant de producció. Prioritat: backend primer (protegeix dades i diners), frontend segon (comportament d'UI).

---

## 2. Arquitectura general

### Dues capes independents

**Backend — PHPUnit Feature Tests**
- Framework: PHPUnit v10.5 (ja instal·lat)
- Base de dades: MySQL separada `bambes_test`
- Estratègia BD: `RefreshDatabase` — cada test parteix d'una BD neta
- Factories per generar: usuaris, productes, variants, comandes
- `APP_ENV=testing` al fitxer `.env.testing`

**Frontend — Vitest + React Testing Library**
- Framework: Vitest (a instal·lar, compatible amb Vite ja existent)
- Companion: `@testing-library/react` + `@testing-library/user-event`
- Mock de crides API amb `vi.mock`
- No cal servidor aixecat

### Estructura de directoris

```
backend/tests/
├── Feature/
│   ├── Auth/
│   │   └── AuthTest.php
│   ├── Cart/
│   │   └── CartTest.php
│   ├── Products/
│   │   └── ProductTest.php
│   ├── Favorites/
│   │   └── FavoriteTest.php
│   ├── Checkout/
│   │   └── CheckoutTest.php
│   └── Orders/
│       └── OrderTest.php
└── Unit/
    └── (lògica pura sense BD, si cal)

frontend/src/__tests__/
├── context/
│   ├── favorites-context.test.jsx
│   └── cart-context.test.jsx
└── pages/
    ├── ProductDetailPage.test.jsx
    ├── CartPage.test.jsx
    └── HomePage.test.jsx
```

---

## 3. Configuració

### Backend — `.env.testing`

```ini
APP_ENV=testing
DB_DATABASE=bambes_test
STRIPE_KEY=pk_test_...       # claus de test ja disponibles al .env
STRIPE_SECRET=sk_test_...
```

`phpunit.xml` ja existent al backend, afegir referència a `.env.testing`.

### Frontend — instal·lació Vitest

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```

Afegir a `vite.config.js`:
```js
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/__tests__/setup.js',
}
```

---

## 4. Casos edge per mòdul

### 4.1 Auth (`AuthController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Registre email duplicat | email ja existent | 422 Unprocessable |
| Login credencials incorrectes | password erroni | 401 Unauthorized |
| Login email no verificat | usuari sense verificar | error específic |
| Logout sense token | sense header Auth | 401 Unauthorized |
| Canvi password incorrecte | `current_password` erroni | 422 Unprocessable |

### 4.2 Productes (`ProductController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Cerca caràcters especials | `q=<script>`, `q=--` | 200, array buit o sanejat |
| Filtres sense resultats | combinació impossible | 200, `data: []` |
| Producte inexistent | `GET /products/99999` | 404 Not Found |
| Paginació fora de rang | `page=9999` | 200, `data: []` |

### 4.3 Carret (`CartController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Afegir mateix producte 50 cops | 50x `POST /cart/add` | quantitat acumulada o límit |
| Quantitat > estoc | qty superior a stock | error o limitació |
| Actualitzar línia a qty 0 | `PUT /cart/lines/{id}` qty=0 | eliminar línia o 422 |
| Eliminar línia inexistent | `DELETE /cart/lines/99999` | 404 Not Found |
| Accedir carret d'altre usuari | lineId d'un altre user | 403 Forbidden |

### 4.4 Favorits (`FavoriteController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Toggle add → remove → add | 3x `POST /favorites/{id}` | estat consistent final |
| Afegir producte dues vegades | 2x add sense remove | idempotent, sense duplicat |
| Producte inexistent | `POST /favorites/99999` | 404 Not Found |
| Sense autenticació | sense token | 401 Unauthorized |

### 4.5 Checkout (`CheckoutController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Intent amb carret buit | `POST /checkout/intent` sense items | error específic |
| PaymentIntent invàlid | `POST /checkout/confirm` id fals | error Stripe |
| Doble confirmació | confirmar 2x mateix intent | idempotent, 1 sol ordre |
| Targeta OK | `4242 4242 4242 4242` | pagament acceptat |
| Targeta declinada | `4000 0000 0000 0002` | error, sense ordre creat |
| Autenticació requerida | `4000 0025 0000 3220` | error o flux 3DS |

### 4.6 Comandes (`OrderController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Veure comanda d'altre usuari | orderId d'un altre user | 403 Forbidden |
| Comanda inexistent | `GET /orders/99999` | 404 Not Found |
| Factura de comanda pendent | ordre sense pagar | error o PDF buit |

---

## 5. Tests de frontend

### 5.1 `favorites-context`

- Toggle afegir → `favorites` s'actualitza sense reload
- Toggle treure → producte desapareix immediatament
- Usuari no autenticat → `favorites` és `[]`, cap crida a l'API
- Muntatge mentre auth carrega → no fa flash d'estat buit

### 5.2 `cart-context`

- Afegir producte → `cartCount` s'incrementa
- Eliminar producte → `cartCount` es decrementa
- Buidar carret → `cartCount` torna a 0

### 5.3 `ProductDetailPage`

- Botó "Afegir" desactivat sense talla seleccionada
- Botó "Afegir" desactivat durant la crida (evita doble clic)
- Botó favorit desactivat durant el toggle (evita doble clic)
- Usuari no autenticat + clic favorit → redirigeix a `/login`

### 5.4 `CartPage`

- Clic ràpid múltiple al "+" → no llança múltiples crides simultànies
- Quantitat arriba a 0 → elimina o demana confirmació

### 5.5 `HomePage`

- Cerca buida → carrega tots els productes
- Cerca sense resultats → missatge "sense resultats", no error
- Navegació enrere → cerca anterior es restaura des de la URL

---

## 6. Ordre d'implementació

1. Configurar `.env.testing` i base de dades `bambes_test`
2. Configurar Vitest al frontend
3. Implementar tests backend mòdul per mòdul (Auth → Productes → Carret → Favorits → Checkout → Comandes)
4. Implementar tests frontend context per context, pàgina per pàgina
5. Integrar execució de tests al workflow de desenvolupament (abans de cada merge a `main`)

---

## 7. Criteri d'èxit

- Tots els casos edge documentats a la secció 4 i 5 tenen un test
- `php artisan test` passa al 100% en un entorn net
- `npm run test` passa al 100%
- Cap test fa crides reals a producció (BD de test, Stripe test mode)
