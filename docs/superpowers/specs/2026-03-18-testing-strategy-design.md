# Testing Strategy — Ecommerce Bambes

**Data:** 2026-03-18
**Projecte:** Ecommerce Bambes (Laravel + React + Lunar + Stripe)
**Estat:** Aprovat pel equip

---

## 1. Objectiu

Cobrir tots els casos edge de cada interacció del projecte per detectar errors abans de producció. Prioritat: backend primer (protegeix dades i diners), frontend segon (comportament d'UI).

---

## 2. Arquitectura general

### Dues capes independents

**Backend — PHPUnit Feature Tests**
- Framework: PHPUnit v10.5 (ja instal·lat)
- Base de dades: MySQL separada `bambes_test` (cal crear-la manualment primer)
- Estratègia BD: `RefreshDatabase` — cada test parteix d'una BD neta
- Factories per generar: usuaris, productes, variants, preus, comandes (moltes a crear)
- `APP_ENV=testing` configurat via `phpunit.xml`

**Frontend — Vitest + React Testing Library**
- Framework: Vitest (a instal·lar, compatible amb Vite ja existent)
- Companion: `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`
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
├── setup.js              (importa @testing-library/jest-dom)
├── context/
│   ├── favorites-context.test.jsx
│   └── cart-context.test.jsx
└── pages/
    ├── ProductDetailPage.test.jsx
    ├── CartPage.test.jsx
    ├── HomePage.test.jsx
    └── CheckoutForm.test.jsx
```

---

## 3. Configuració

### Backend — `phpunit.xml` (actualitzar les `<env>`)

```xml
<env name="APP_ENV" value="testing"/>
<env name="DB_DATABASE" value="bambes_test"/>
```

> IMPORTANT: `DB_DATABASE=bambes_test` ha d'estar al `phpunit.xml`, no només al `.env.testing`. Si no, els tests poden córrer contra la BD de producció.

Crear la base de dades de test manualment:
```sql
CREATE DATABASE bambes_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Les migracions les executa `RefreshDatabase` automàticament en cada test run.

### Backend — Factories a crear

Lunar no porta factories pròpies. S'han de crear:
- `ChannelFactory` — requerida per qualsevol operació de carret
- `CurrencyFactory` — requerida per preus i carret
- `ProductFactory` + `ProductVariantFactory` + `PriceFactory` — per carret i checkout
- `CartFactory` — per tests de checkout

Sense aquestes factories, els tests de Cart i Checkout no es poden escriure.

### Backend — Estratègia per a Stripe

Els tests de checkout **no fan crides reals a Stripe**. Es mocka `\Stripe\PaymentIntent` via el service container de Laravel:

```php
// A cada test de checkout:
$this->mock(\Stripe\PaymentIntent::class, function ($mock) {
    $mock->shouldReceive('retrieve')->andReturn((object)[
        'status' => 'succeeded',
        'amount_received' => 5000, // en centims
        'id' => 'pi_test_123',
    ]);
});
```

Això elimina la dependència de xarxa i fa els tests deterministes.

### Frontend — instal·lació Vitest

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Afegir a `vite.config.js`:
```js
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/__tests__/setup.js',
  resolve: {
    alias: { '@': '/src' },  // replicar l'alias de Vite o els imports fallaran
  },
}
```

`src/__tests__/setup.js`:
```js
import '@testing-library/jest-dom'
```

---

## 4. Casos edge per mòdul

### 4.1 Auth (`AuthController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Registre email duplicat | email ja existent | **422** Unprocessable |
| Login credencials incorrectes | password erroni | **422** (ValidationException, no 401) |
| Login amb usuari no verificat | usuari sense verificar | **200** login OK (la verificació no es comprova aquí, es comprova al checkout) |
| Logout invalida la sessió | POST /logout + crida posterior amb la sessió vella | 401 a la crida posterior |
| Canvi password incorrecte | `current_password` erroni | 422 Unprocessable |
| Canvi password igual a l'actual | `password` == contrasenya actual | 422 (rebutjat explícitament) |
| Canvi password sense autenticació | sense sessió | 401 Unauthorized |

### 4.2 Productes (`ProductController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Cerca caràcters especials | `q=<script>`, `q=--` | 200, array buit o sanejat |
| Filtres sense resultats | combinació impossible | 200, `data: []` |
| Producte inexistent | `GET /products/99999` | 404 Not Found |
| Paginació fora de rang | `page=9999` | 200, `data: []` |
| Producte no publicat | producte amb `status=draft` | no apareix al llistat |
| Producte sense variants/preus | producte mal configurat | `price: 0`, sense error 500 |
| Endpoint de filtres | `GET /products/filters` | 200, estructura JSON vàlida |

### 4.3 Carret (`CartController`)

> Nota: La ruta per buidar el carret és `DELETE /api/cart` (sense `/clear`).
> El carret s'identifica per `cart_token` a localStorage — no hi ha verificació d'ownership al servidor.

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Afegir mateix producte 50 cops | 50x `POST /cart/add` | quantitat acumulada (Lunar suma) |
| Actualitzar línia a qty=0 | `PUT /cart/lines/{id}` qty=0 | **422** (validació `min:1`) |
| Eliminar línia inexistent | `DELETE /cart/lines/99999` | 404 Not Found |
| Buidar carret | `DELETE /api/cart` | 200, carret buit |
| Carret sense canal/moneda configurats | sense Channel/Currency a BD | 500 (dependència infraestructura) |

### 4.4 Favorits (`FavoriteController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Toggle add → remove → add | 3x `POST /favorites/{id}` | estat consistent, `favorited` correcte |
| Afegir producte dues vegades | 2x add sense remove | idempotent, sense fila duplicada a BD |
| Producte inexistent | `POST /favorites/99999` | 404 Not Found |
| Sense autenticació | sense sessió | 401 Unauthorized |
| GET favorits sense autenticació | `GET /favorites` sense sessió | 401 Unauthorized |

### 4.5 Checkout (`CheckoutController`)

> Nota: Els tests usen mocks de Stripe, no crides reals ni números de targeta.

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Intent amb carret buit | `POST /checkout/intent` sense items | error específic |
| Email no verificat | usuari sense verificar + intent | **403** + `code: email_not_verified` |
| PaymentIntent mock: succeeded | Stripe mock retorna `status=succeeded` | 200, ordre creat |
| PaymentIntent mock: no succeeded | Stripe mock retorna `status=requires_payment` | error, sense ordre creat |
| Import manipulat | Stripe retorna import diferent al calculat | error amount mismatch |
| Doble confirmació | confirmar 2x mateix `payment_intent_id` | 200 idempotent, **1 sola fila** a BD |
| `shipping_same_as_billing=false` sense adreça | sense camps d'enviament | 422 Unprocessable |

### 4.6 Comandes (`OrderController`)

| Cas | Entrada | Resultat esperat |
|-----|---------|-----------------|
| Veure comanda d'altre usuari | orderId d'un altre user | 403 Forbidden |
| Comanda inexistent | `GET /orders/99999` | 404 Not Found |
| Factura d'una comanda pendent | ordre amb `status=pending` | **200 + PDF** (el controller genera PDF independentment de l'estat) |
| Factura de comanda d'altre usuari | invoiceId d'un altre user | 403 Forbidden |
| Paginació comandes | `per_page=999` | màxim 50 (cap de Lunar) |
| Paràmetre `lang` invàlid a factura | `?lang=xx` | 200, usa `ca` per defecte |

---

## 5. Tests de frontend

### 5.1 `favorites-context`

- Toggle afegir → `favorites` s'actualitza sense reload
- Toggle treure → producte desapareix immediatament
- Usuari no autenticat → `favorites` és `[]`, cap crida a l'API
- Muntatge mentre auth carrega (`authLoading=true`) → no fa flash d'estat buit

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

### 5.6 `CheckoutForm`

- Botó "Pagar" desactivat mentre Stripe Elements no ha carregat
- Botó "Pagar" desactivat durant el processament (evita doble clic)
- Error de Stripe → missatge d'error visible, formulari es reactiva

---

## 6. Ordre d'implementació

1. **Crear BD de test**: `CREATE DATABASE bambes_test`
2. **Configurar `phpunit.xml`**: afegir `<env name="DB_DATABASE" value="bambes_test"/>`
3. **Crear factories de Lunar**: `ChannelFactory`, `CurrencyFactory`, `ProductVariantFactory`, `PriceFactory`, `CartFactory`
4. **Configurar Vitest** al frontend
5. **Tests Auth** — base simple, sense factories complexes
6. **Tests Productes** — lectura, sense modificació d'estat
7. **Tests Favorits** — CRUD simple amb un usuari
8. **Tests Carret** — requereix factories de Lunar (pas 3)
9. **Definir mock de Stripe** — abans dels tests de Checkout
10. **Tests Checkout** — el més complex, depèn de tot l'anterior
11. **Tests Comandes** — depèn de Checkout (necessita ordres creades)
12. **Tests Frontend** — context, pàgines, formulari de checkout

---

## 7. Convencions de test (backend)

- Usar `actingAs($user)` per simular sessió autenticada (Sanctum session mode)
- CSRF desactivat automàticament a les crides de test (`$this->post()`, etc.)
- `withoutExceptionHandling()` durant el desenvolupament per veure errors reals
- Cada test és independent: no compartir estat entre tests

---

## 8. Criteri d'èxit

- Tots els casos edge documentats a les seccions 4 i 5 tenen un test
- `php artisan test` passa al 100% en un entorn net
- `npm run test` passa al 100%
- Cap test fa crides reals a producció (BD de test, Stripe mockat)
