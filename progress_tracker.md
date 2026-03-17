# Progress Tracker - Ecommerce Bambes

## Stack tecnologic
- **Backend:** Laravel 11 + Lunar (ecommerce) + Filament 3 (admin)
- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui
- **BD:** SQLite
- **Pagaments:** Stripe (PaymentIntent API)
- **Imatges:** Cloudinary (via Spatie Media Library + adapter personalitzat)
- **Auth:** Laravel Sanctum (sessions amb cookies)

---

## Backend

### Models
- **Product** — Estén el model Lunar. Conversions d'imatge (thumb 150px, medium 600px, large 1200px). Relacions: variants, brand, thumbnail, images, collections, productType.
- **User** — Authenticatable estàndard. Relació `carts` (hasMany Cart).

### Controllers (Api)
- **ProductController** — `index()` llista productes publicats amb preu convertit de cèntims a EUR. `show($id)` detall amb variants, imatges i marca.
- **CartController** — Carret per token UUID (anònim) o sessió Laravel. CRUD complet: obtenir, afegir, actualitzar quantitat, eliminar línia, buidar carret. Validació d'stock.
- **CheckoutController** — Checkout en 2 passos: `createIntent()` calcula import des de BD (cèntims) i crea Stripe PaymentIntent; `confirm()` verifica pagament i crea Order. Prevenció de duplicats. Transacció DB.
- **AuthController** — Registre, login, logout, obtenir usuari. Sessions Sanctum amb CSRF.
- **OrderController** — `index()` llistat paginat de comandes de l'usuari. `show($id)` detall amb línies i totals. Detecció dinàmica d'esquema BD.

### Commands
- **AssignProductPrices** (`products:assign-prices`) — Assigna preus a variants sense preu base. Mapa de preus per marca (Nike 139.99, ASICS 169.99, etc.).
- **ImportProductImages** (`products:import-images`) — Importa imatges locals, les associa a productes pels primers 4 caràcters del nom. Opcions: `--dry-run`, `--force`, `--clear`.

### Jobs i Observers
- **SyncMediaToCloudinary** (Job async) — Puja fitxer local a Cloudinary (carpeta `shoes-photos`), desa `cloudinary_public_id` com a propietat personalitzada.
- **MediaObserver** — Quan es crea un Media de tipus producte/imatges, despatxa el job amb 2s de delay.

### Cloudinary
- **CloudinaryAdapter** — Adapter Flysystem complet (read, write, delete, list, move, copy).
- **CloudinaryUrlGenerator** — Genera URLs de Cloudinary a partir del `cloudinary_public_id`, fallback a path local.
- **CloudinaryServiceProvider** — Registra singleton de Cloudinary amb credencials des de config.

### Middleware
- **SetLunarDefaults** — Estableix moneda EUR per defecte a cada request.
- **VerifyCsrfToken** — Protecció CSRF per a Sanctum.

### Providers
- **AppServiceProvider** — Registra LunarPanel, MediaObserver, widget chatbot a Filament.
- **AdminPanelProvider** — Configura Filament admin a `/admin` (color Amber, auto-discover resources).

### Seeders
- **LunarBambesDemoSeeder** — Dades demo completes: idioma, moneda EUR, CustomerGroup, ProductType, TaxClass, 4 col·leccions (Trail, Asfalt, Pista, Mixt), opcions (talla 40-44, color), 10 productes amb 6 variants cadascun. Adapta dinàmicament a l'esquema BD.
- **AssociateCloudinaryImagesToProductsSeeder** — Associa imatges de Cloudinary als productes.

### Rutes API
| Metode | Ruta | Auth | Descripció |
|--------|------|------|------------|
| GET | /api/products | No | Llistat de productes |
| GET | /api/products/{id} | No | Detall producte |
| GET | /api/cart | No | Obtenir carret |
| POST | /api/cart/add | No | Afegir al carret |
| PUT | /api/cart/lines/{lineId} | No | Actualitzar quantitat |
| DELETE | /api/cart/lines/{lineId} | No | Eliminar línia |
| DELETE | /api/cart | No | Buidar carret |
| POST | /api/register | No | Registre |
| POST | /api/login | No | Login |
| POST | /api/logout | Si | Logout |
| GET | /api/user | Si | Perfil usuari |
| POST | /api/checkout/intent | Si | Crear PaymentIntent |
| POST | /api/checkout/confirm | Si | Confirmar pagament |
| GET | /api/orders | Si | Llistat comandes |
| GET | /api/orders/{id} | Si | Detall comanda |

---

## Frontend

### Pàgines
- **HomePage** — Grid de productes (1-4 columnes). FilterSidebar col·lapsable (sexe, preu, talla, color, esports, subcategories). Controls d'ordenació. Breadcrumbs.
- **ProductDetailPage** — Galeria d'imatges amb thumbnails (vertical desktop, horitzontal mòbil). Selectors de talla (grid amb disponibilitat) i color. Indicador d'stock. Botó afegir al carret i favorits (placeholder). SKU.
- **CartPage** — Llista d'articles amb imatge, nom, marca, preu. Controls de quantitat (+/-). Eliminar article. Buidar carret. Resum amb subtotal, enviament (placeholder) i total.
- **CheckoutPage** — Mostra total estimat vs calculat pel servidor. Integració Stripe Elements amb PaymentElement. Crea PaymentIntent al muntar.
- **CheckoutSuccessPage** — Gestiona navegació directa i redirect de Stripe. Mostra resum de comanda real (línies, subtotal, descompte, enviament, impostos, total). Neteja carret automàticament.
- **OrdersPage** — Llistat de comandes amb paginació. ID, estat, referència, total, data. Botó de refrescar. Guarda de login.
- **OrderDetailPage** — Detall complet: línies de producte, desglossament de totals, dades client (placeholder).
- **LoginPage / RegisterPage / ProfilePage** — Pàgines d'autenticació estàndard amb Sanctum.

### Components
- **Header** — Barra de navegació amb logo, menú d'usuari, comptador carret.
- **ProductCard** — Targeta de producte (imatge, marca, nom, preu).
- **CheckoutForm** — Wrapper de Stripe PaymentElement. Anti-doble-submit. Gestió d'estats de pagament.
- **UserMenu** — Menú dropdown d'usuari.
- **UI (shadcn/ui)** — Button, Card, Badge.

### Context (estat global)
- **AuthContext** — user, loading, login, register, logout, checkAuth.
- **CartContext** — cart, items, cartCount, cartSubtotal, cartTotal, cartTax. Persistència de cart_token a localStorage per a usuaris anònims.

### Serveis i utilitats
- **api.js** — Instància Axios amb withCredentials, gestió CSRF (X-XSRF-TOKEN). Funcions: getCsrfToken, register, login, logout, getCurrentUser, createPaymentIntent.
- **variantParser.js** — `organizeVariants()` extreu talles i colors. `findVariant()` troba variant per talla/color.

---

## Admin (Filament)
- Panell a `/admin` amb recursos Lunar (productes, comandes, variants, etc.)
- Color Amber
- Widget chatbot integrat

---

## Patrons clau
- **Preus** sempre en cèntims (EUR), conversió a decimals al frontend
- **Carret anònim** identificat per UUID token a `Cart.meta`
- **Checkout segur**: import calculat server-side, verificació d'import abans de crear comanda
- **Imatges**: Local -> Observer -> Job async -> Cloudinary, URLs via generator personalitzat
- **Auth**: Sessions amb cookies (no tokens API)
- **Insercions a BD**: Les comandes es creen amb `DB::table()->insert()` (raw queries) per evitar els casts de Lunar (`Price`, `TaxBreakdown`, etc.) que fallen en creació

---

## Historial de canvis

### 17/02/2026 — Checkout complet: dades client, adreces, enviament, IVA, stock

**Funcionalitats implementades:**
1. **Recollida de dades del client al checkout** — Formulari amb nom, cognom, email i telèfon. Pre-omple les dades si l'usuari està autenticat.
2. **Adreces de facturació i enviament** — Camps d'adreça complets (línia 1, línia 2, ciutat, codi postal, província). Checkbox "mateixa adreça que facturació" per defecte. Les adreces es guarden a `lunar_order_addresses` (tipus billing/shipping).
3. **Càlcul real d'enviament** — Tarifa plana de 4.99€ (499 cèntims). Es mostra al carret i al checkout.
4. **Càlcul real d'IVA** — 21% fix sobre (subtotal + enviament). Es mostra desglossat.
5. **Validació d'stock** — Abans de crear el PaymentIntent, es verifica que hi hagi stock suficient per cada producte. En confirmar, es descompta l'stock de les variants.

**Fitxers modificats:**
- `backend/app/Http/Controllers/Api/CheckoutController.php` — Reescrit completament. Validació de dades client + adreces, càlcul de shipping + IVA, validació d'stock, creació d'Order amb `DB::table()`.
- `backend/app/Http/Controllers/Api/OrderController.php` — `show()` carrega relació `addresses`. `formatOrderDetail()` inclou customer, billing_address, shipping_address.
- `backend/routes/api.php` — Netejat ruta duplicada de confirm (tenia middleware nidificat innecessàriament).
- `frontend/src/pages/CheckoutPage.jsx` — Reescrit amb formulari complet: contacte, adreça facturació, adreça enviament, resum amb totals del servidor.
- `frontend/src/pages/CartPage.jsx` — Resum mostra enviament (4.99€) i IVA (21%) estimats.
- `frontend/src/pages/CheckoutSuccessPage.jsx` — Mostra dades del client i adreces reals.
- `frontend/src/pages/OrderDetailPage.jsx` — Mostra dades del client i adreces reals.
- `frontend/src/pages/OrdersPage.jsx` — Netejat missatge de debug.

**Bug crític trobat i resolt:**

El problema era que les comandes **no es creaven a la BD** malgrat que Stripe cobrava correctament. L'usuari veia "Pagament completat" però sense dades de la comanda.

**Causa arrel:** Els casts d'Eloquent de Lunar (`Lunar\Base\Casts\Price`, `Lunar\Base\Casts\TaxBreakdown`, `Lunar\Base\Casts\ShippingBreakdown`) fallen quan s'intenta crear un Order amb valors enters simples. Concretament, el `TaxBreakdown` cast intenta parsejar el JSON de `tax_breakdown` i crear objectes `Price` amb una `Currency`, però el format no incloïa `currency_code`, causant:

```
Lunar\DataTypes\Price::__construct(): Argument #2 ($currency) must be of type
Lunar\Models\Contracts\Currency, null given
```

Aquest error es llançava dins la transacció DB, feia rollback, i retornava un 500 al frontend. El frontend capturava l'error silenciosament i navegava a la pàgina d'èxit sense dades de comanda.

**Solució:** Substituir totes les crides `Order::create()`, `OrderLine::create()` i `OrderAddress::create()` per insercions raw amb `DB::table()->insertGetId()` / `DB::table()->insert()`. Això evita completament els casts d'Eloquent de Lunar durant la creació, però manté la compatibilitat total per a la lectura (els casts funcionen bé quan es llegeixen dades existents).

També s'ha millorat el frontend per mostrar l'error del `confirm` a la pàgina d'èxit (banner vermell) en comptes de silenciar-lo.
