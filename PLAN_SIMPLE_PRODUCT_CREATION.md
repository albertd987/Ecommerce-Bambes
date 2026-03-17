# Pla d'Implementació: Creació Simplificada de Productes

## 1. Resum Executiu

### Problema
La interfície actual de gestió de productes (Lunar + Filament a `/admin`) requereix navegar múltiples pàgines i entendre conceptes tècnics interns (Product Types, Channels, Customer Groups, attribute_data amb TranslatedText, etc.). Això la fa inutilitzable per a usuaris no tècnics.

### Solució
Crear una experiència de creació de productes **tipus WordPress**: un sol formulari intuïtiu que abstrau tota la complexitat de Lunar. L'usuari omple nom, descripció, preu, imatges i categoria — i el producte apareix al frontend immediatament.

### Objectius
1. **Simplicitat:** Formulari d'un sol pas amb camps mínims i comprensibles.
2. **Automatització:** SKU, slug, publicació al canal, tax class, currency — tot automàtic.
3. **Immediatesa:** El producte apareix al frontend sense passos addicionals.
4. **Compatibilitat:** No trencar res existent (API, frontend React, panell Lunar estàndard).
5. **Escalabilitat:** Arquitectura basada en serveis reutilitzables.

---

## 2. Arquitectura Actual (Referència)

### Stack Tecnològic
| Component | Tecnologia | Versió |
|-----------|-----------|--------|
| Backend | Laravel | 11.0 |
| E-commerce | LunarPHP | 1.2 |
| Admin Panel | Filament (via Lunar) | - |
| Frontend | React | 19.2 |
| Base de dades | SQLite | - |
| Imatges | Spatie Media Library + Cloudinary | - |
| Auth | Laravel Sanctum (sessions) | 4.3 |

### Model de Dades de Producte (Lunar)
```
lunar_products
├── id (bigint)
├── product_type_id (FK → lunar_product_types) ← OBLIGATORI
├── status ('published' | 'draft')
├── attribute_data (JSON amb TranslatedText)
├── brand_id (FK → lunar_brands, nullable)
├── slug (string, unique) ← migració custom
├── thumbnail_id (FK → media, nullable) ← migració custom
├── created_at, updated_at, deleted_at

lunar_product_variants
├── id (bigint)
├── product_id (FK → lunar_products) ← OBLIGATORI
├── tax_class_id (FK → lunar_tax_classes) ← OBLIGATORI
├── sku (string, nullable, indexed)
├── stock (int, default 0)
├── purchasable ('always' | ...)
├── shippable (bool, default true)
├── unit_quantity (int, default 1)
├── backorder (int, default 0)
├── created_at, updated_at, deleted_at

lunar_prices
├── id (bigint)
├── customer_group_id (FK → lunar_customer_groups)
├── currency_id (FK → lunar_currencies)
├── priceable_type ('product_variant')
├── priceable_id (FK → lunar_product_variants)
├── price (int, cèntims)
├── compare_price (int, nullable)
├── min_quantity (int, default 1)

media (Spatie)
├── id, model_type, model_id
├── collection_name ('images')
├── file_name, disk, size, mime_type
├── custom_properties (JSON → cloudinary_public_id)
```

### Valors Fixos Existents (del Seeder)
- **ProductType:** "Bambes" (id=1)
- **TaxClass:** "Standard" (id=1)
- **Currency:** EUR (default=true)
- **CustomerGroup:** "Default" (default=true)
- **Locale:** `ca` (configurable via app.locale)
- **Col·leccions:** Trail, Asfalt, Pista, Mixt
- **Opcions:** Talla (40-44), Color (Negre, Blanc, Blau)

### Punts de Fricció Identificats
1. **Product Type obligatori** → l'usuari ha de saber què és i seleccionar-lo.
2. **attribute_data** usa `TranslatedText` → format intern complex.
3. **Variants obligatòries** → no es pot tenir producte sense variant a Lunar.
4. **SKU manual** → cada variant requereix SKU únic introduït a mà.
5. **Tax Class obligatòria** per variant → concepte fiscal opac per l'usuari.
6. **Preu requereix** currency_id + customer_group_id → massa granular.
7. **Publicació multi-pas** → cal anar a la pestanya d'availability i activar el canal.
8. **Imatges en pàgina separada** → no es pugen al formulari de creació.
9. **URL/slug** gestionat apart → pas extra innecessari.

---

## 3. Disseny de la Solució

### 3.1 Arquitectura General

```
┌─────────────────────────────────────────────────┐
│              Filament Admin Panel               │
│                   /admin                         │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │   CreateSimpleProduct (Filament Page)    │    │
│  │                                          │    │
│  │  [Nom] [Descripció] [Marca] [Preu]      │    │
│  │  [Categories] [Imatges ↑]               │    │
│  │  [Toggle variants?]                      │    │
│  │     └─ [Talla] [Color] [Stock]          │    │
│  │                                          │    │
│  │  [ Crear Producte ]                      │    │
│  └──────────────┬──────────────────────────┘    │
│                 │                                │
│  ┌──────────────▼──────────────────────────┐    │
│  │   SimpleProductCreator (Service)         │    │
│  │                                          │    │
│  │  ├─ Crear Product (published)            │    │
│  │  ├─ Generar slug                         │    │
│  │  ├─ Crear Variant(s)                     │    │
│  │  │   ├─ SKU auto (SkuGenerator)         │    │
│  │  │   ├─ Tax class default               │    │
│  │  │   └─ Stock                            │    │
│  │  ├─ Crear Price(s)                       │    │
│  │  ├─ Associar col·leccions               │    │
│  │  ├─ Pujar imatges → MediaObserver        │    │
│  │  │                  → Cloudinary (async)  │    │
│  │  └─ Assignar thumbnail                   │    │
│  └──────────────┬──────────────────────────┘    │
│                 │                                │
│  ┌──────────────▼──────────────────────────┐    │
│  │   ListSimpleProducts (Filament Page)     │    │
│  │                                          │    │
│  │  Llistat amb accions ràpides             │    │
│  │  Editar | Duplicar | Publicar | Eliminar │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  (Les pàgines Lunar estàndard segueixen          │
│   disponibles per gestió avançada)               │
└─────────────────────────────────────────────────┘
         │
         │ Producte amb status='published'
         ▼
┌─────────────────────────────────────────────────┐
│           API REST (ja existent)                 │
│                                                  │
│  GET /api/products     → filtra published        │
│  GET /api/products/{id} → detall amb variants    │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│         Frontend React (sense canvis)            │
│                                                  │
│  HomePage → ProductCard → ProductDetailPage      │
└─────────────────────────────────────────────────┘
```

### 3.2 Formulari de Creació (UX)

```
╔══════════════════════════════════════════════════╗
║  🆕 Crear Nou Producte                           ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  Nom del producte *                              ║
║  ┌──────────────────────────────────────────┐   ║
║  │ Nike Air Zoom Pegasus 41                  │   ║
║  └──────────────────────────────────────────┘   ║
║                                                  ║
║  Descripció                                      ║
║  ┌──────────────────────────────────────────┐   ║
║  │ Sabatilla de running per a terreny        │   ║
║  │ asfalt amb amortització reactiva...       │   ║
║  └──────────────────────────────────────────┘   ║
║                                                  ║
║  Marca               Preu (€) *                  ║
║  ┌────────────────┐  ┌──────────────┐           ║
║  │ Nike        ▼  │  │ 139.99       │           ║
║  └────────────────┘  └──────────────┘           ║
║                                                  ║
║  Categories                                      ║
║  ☑ Trail  ☑ Asfalt  ☐ Pista  ☐ Mixt            ║
║                                                  ║
║  Imatges (arrossega o clica per pujar)           ║
║  ┌──────────────────────────────────────────┐   ║
║  │  [📷 img1]  [📷 img2]  [📷 img3]  [+]   │   ║
║  └──────────────────────────────────────────┘   ║
║  La primera imatge serà la miniatura             ║
║                                                  ║
║  ─────────────────────────────────────────────   ║
║                                                  ║
║  ☐ Aquest producte té variants (talles/colors)   ║
║                                                  ║
║  (Si activat:)                                   ║
║  ┌──────────────────────────────────────────┐   ║
║  │ Talla │ Color  │ Stock │              [x] │   ║
║  │  41   │ Negre  │  25   │                  │   ║
║  │  41   │ Blanc  │  15   │                  │   ║
║  │  42   │ Negre  │  30   │                  │   ║
║  │ [+ Afegir variant]                        │   ║
║  └──────────────────────────────────────────┘   ║
║                                                  ║
║  (Si NO activat:)                                ║
║  Stock disponible                                ║
║  ┌──────────────┐                               ║
║  │ 50           │                               ║
║  └──────────────┘                               ║
║                                                  ║
║          [ Crear Producte ]                      ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

---

## 4. Requisits Tècnics Detallats

### 4.1 Fitxers a Crear

| Fitxer | Tipus | Descripció |
|--------|-------|-----------|
| `app/Services/SimpleProductCreator.php` | Service | Lògica de negoci per crear/editar productes simplificats |
| `app/Services/SkuGenerator.php` | Service | Generació automàtica de SKUs únics |
| `app/Filament/Pages/CreateSimpleProduct.php` | Filament Page | Formulari de creació amb tots els camps |
| `app/Filament/Pages/ListSimpleProducts.php` | Filament Page | Llistat de productes amb accions ràpides |
| `app/Filament/Pages/EditSimpleProduct.php` | Filament Page | Formulari d'edició |

### 4.2 Fitxers a Modificar

| Fitxer | Canvi |
|--------|-------|
| `app/Http/Controllers/Api/ProductController.php` | Assegurar que productes sense opcions talla/color es mostren correctament |
| `app/Providers/Filament/AdminPanelProvider.php` | Verificar que les noves pàgines es descobreixen automàticament (ja configurat) |

### 4.3 Cap Fitxer a Eliminar
Les pàgines estàndard de Lunar/Filament es mantenen per compatibilitat i gestió avançada.

---

## 5. Especificacions Tècniques per Component

### 5.1 SkuGenerator Service

**Fitxer:** `app/Services/SkuGenerator.php`

**Responsabilitat:** Generar SKUs únics automàticament.

**Algorisme:**
```
Entrada: brand_name, product_name, size (opcional), color (opcional)

1. brand_prefix = primers 3 caràcters de brand_name en MAJÚSCULA
   - Si brand_name té menys de 3 chars → pad amb 'X'
   - Si no hi ha brand → 'GEN'

2. product_slug = Str::slug(product_name) truncat a 15 chars
   - Eliminar guions duplicats
   - Tot en MAJÚSCULA

3. Si té variants:
   sku = "{brand_prefix}-{product_slug}-{size}-{color_prefix}"
   color_prefix = primers 3 chars del color en MAJÚSCULA

4. Si NO té variants:
   sku = "{brand_prefix}-{product_slug}-001"

5. Validar unicitat a lunar_product_variants.sku:
   - Si existeix → incrementar suffix numèric: -002, -003...
   - Màxim 64 caràcters (limit de la columna)

Exemples:
  ("Nike", "Air Zoom Pegasus 41", null, null) → "NIK-AIR-ZOOM-PEGASU-001"
  ("Nike", "Air Zoom Pegasus 41", "42", "Negre") → "NIK-AIR-ZOOM-PEGASU-42-NEG"
  ("ASICS", "Gel Kayano 31", "41", "Blanc") → "ASI-GEL-KAYANO-31-41-BLA"
```

**Mètodes:**
```
generate(string $brandName, string $productName, ?string $size, ?string $color): string
generateForProduct(Product $product, ?string $size, ?string $color): string
ensureUnique(string $baseSku): string
```

### 5.2 SimpleProductCreator Service

**Fitxer:** `app/Services/SimpleProductCreator.php`

**Responsabilitat:** Orquestrar la creació completa d'un producte a Lunar.

**Mètode principal: `create(array $data): Product`**

**Paràmetres d'entrada ($data):**
```php
[
    'name' => string,           // Obligatori. Nom del producte
    'description' => ?string,   // Opcional. Descripció en text
    'brand_id' => ?int,         // Opcional. FK a lunar_brands
    'new_brand_name' => ?string,// Opcional. Crear marca nova si no existeix
    'price' => float,           // Obligatori. Preu en EUR (ex: 139.99)
    'collection_ids' => int[],  // Opcional. IDs de col·leccions
    'images' => UploadedFile[], // Opcional. Fitxers d'imatge
    'stock' => int,             // Opcional. Stock si no té variants (default: 0)
    'has_variants' => bool,     // Default: false
    'variants' => [             // Només si has_variants=true
        [
            'size' => string,   // Valor de talla
            'color' => string,  // Valor de color
            'stock' => int,     // Stock per variant
        ],
        // ...
    ],
]
```

**Flux d'execució (dins DB::transaction):**

```
1. RESOLUCIÓ DE DEPENDÈNCIES
   ├─ Obtenir ProductType "Bambes" (primer/únic)
   ├─ Obtenir TaxClass "Standard" (primer/únic)
   ├─ Obtenir Currency EUR (default=true)
   ├─ Obtenir CustomerGroup Default (default=true)
   └─ Obtenir locale de config('app.locale')

2. GESTIÓ DE MARCA (opcional)
   ├─ Si brand_id → usar-lo directament
   ├─ Si new_brand_name → Brand::firstOrCreate amb attribute_data
   └─ Si cap → brand_id = null

3. CREAR PRODUCTE
   └─ Product::create([
        'product_type_id' => $productType->id,
        'status' => 'published',
        'brand_id' => $brandId,
        'slug' => Str::slug($data['name']),  // + suffix si duplicat
        'attribute_data' => [
            'name' => new TranslatedText([$locale => $data['name']]),
            'description' => new TranslatedText([$locale => $data['description'] ?? '']),
        ],
      ])

4. CREAR VARIANT(S)
   ├─ Si has_variants = false:
   │   └─ Crear 1 variant:
   │       ├─ sku = SkuGenerator::generate(brand, name, null, null)
   │       ├─ tax_class_id = $taxClass->id
   │       ├─ stock = $data['stock'] ?? 0
   │       ├─ purchasable = 'always'
   │       └─ No associar option values
   │
   └─ Si has_variants = true:
       └─ Per cada variant en $data['variants']:
           ├─ Trobar/crear ProductOptionValue per talla i color
           ├─ sku = SkuGenerator::generate(brand, name, size, color)
           ├─ tax_class_id = $taxClass->id
           ├─ stock = variant['stock']
           ├─ purchasable = 'always'
           └─ Associar option values via syncWithoutDetaching

5. CREAR PREUS
   └─ Per cada variant creada:
       └─ Price::create([
            'customer_group_id' => $customerGroup->id,
            'currency_id' => $currency->id,
            'priceable_type' => 'product_variant',
            'priceable_id' => $variant->id,
            'price' => (int)($data['price'] * 100),  // EUR → cèntims
            'min_quantity' => 1,
          ])

6. ASSOCIAR COL·LECCIONS
   └─ $product->collections()->sync($data['collection_ids'] ?? [])

7. PUJAR IMATGES
   └─ Per cada imatge en $data['images']:
       ├─ $product->addMedia($image)->toMediaCollection('images')
       ├─ (MediaObserver dispara SyncMediaToCloudinary automàticament)
       └─ Si és la primera → $product->update(['thumbnail_id' => $media->id])

8. RETORNAR PRODUCTE
   └─ return $product->fresh()
```

**Mètode secundari: `update(Product $product, array $data): Product`**
- Mateixa estructura que create, però amb:
  - Actualitzar camps existents en lloc de crear
  - Gestionar variants afegides/eliminades
  - Gestionar imatges afegides/eliminades
  - Recalcular SKUs si canvia el nom/marca

**Mètode auxiliar: `generateUniqueSlug(string $name, ?int $excludeId = null): string`**
```
1. base_slug = Str::slug($name)
2. Si no existeix a lunar_products.slug (excloent excludeId) → retornar
3. Si existeix → afegir -2, -3, -4... fins trobar un únic
```

### 5.3 CreateSimpleProduct (Filament Page)

**Fitxer:** `app/Filament/Pages/CreateSimpleProduct.php`

**Tipus:** Filament Page (no Resource) — més control sobre el formulari.

**Configuració:**
```php
protected static ?string $navigationIcon = 'heroicon-o-plus-circle';
protected static ?string $navigationLabel = 'Crear Producte';
protected static ?string $navigationGroup = 'Productes';
protected static ?int $navigationSort = 1;
protected static ?string $title = 'Crear Nou Producte';
```

**Camps del formulari (Filament Form Schema):**

```php
Section::make('Informació bàsica')
├── TextInput::make('name')
│   →required, maxLength(255), label('Nom del producte'), placeholder('Ex: Nike Air Zoom Pegasus 41')
│
├── Textarea::make('description')  // o RichEditor si es vol
│   →nullable, label('Descripció'), rows(4)
│
├── Select::make('brand_id')
│   →label('Marca')
│   →options(Brand::all()->mapWithKeys(...))  // noms de brands existents
│   →searchable, nullable
│   →createOptionForm([TextInput::make('name')->required])  // crear marca nova inline
│
└── TextInput::make('price')
    →required, numeric, minValue(0.01), prefix('€')
    →label('Preu'), placeholder('139.99')

Section::make('Classificació')
└── CheckboxList::make('collection_ids')
    →label('Categories')
    →options(Collection::all()->mapWithKeys(...))  // nom de col·leccions
    →columns(2)

Section::make('Imatges')
└── FileUpload::make('images')
    →label('Imatges del producte')
    →multiple, image, reorderable
    →maxFiles(10), maxSize(5120)  // 5MB per imatge
    →helperText('La primera imatge serà la miniatura principal')
    →acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])

Section::make('Stock i Variants')
├── Toggle::make('has_variants')
│   →label('Aquest producte té variants (talles/colors)')
│   →default(false), reactive
│
├── TextInput::make('stock')  // Visible si has_variants=false
│   →label('Stock disponible')
│   →numeric, default(0), minValue(0)
│   →visible(fn($get) => !$get('has_variants'))
│
└── Repeater::make('variants')  // Visible si has_variants=true
    →label('Variants')
    →visible(fn($get) => $get('has_variants'))
    →schema([
        Select::make('size')
            →label('Talla')
            →options(['40'=>'40', '41'=>'41', '42'=>'42', '43'=>'43', '44'=>'44'])
            →required,
        Select::make('color')
            →label('Color')
            →options(['Negre'=>'Negre', 'Blanc'=>'Blanc', 'Blau'=>'Blau'])
            →required,
        TextInput::make('stock')
            →label('Stock')
            →numeric, default(0), minValue(0),
    ])
    →defaultItems(1)
    →addActionLabel('Afegir variant')
    →columns(3)
```

**Acció submit:**
```php
public function create(): void
{
    $data = $this->form->getState();
    $product = app(SimpleProductCreator::class)->create($data);

    Notification::make()
        ->title('Producte creat correctament!')
        ->body("«{$data['name']}» ja és visible al catàleg.")
        ->success()
        ->send();

    $this->redirect(ListSimpleProducts::getUrl());
}
```

### 5.4 ListSimpleProducts (Filament Page)

**Fitxer:** `app/Filament/Pages/ListSimpleProducts.php`

**Funcionalitat:**
- Taula amb tots els productes ordenats per data de creació (descendent)
- Columnes: Miniatura, Nom, Marca, Preu, Stock total, Estat, Data creació
- Accions per fila: Editar, Duplicar, Canviar estat (publish/draft), Eliminar
- Filtre per col·lecció i marca
- Cerca per nom

**Columnes:**
```
ImageColumn::make('thumbnail') → 40x40px
TextColumn::make('name') → searchable, sortable
TextColumn::make('brand.name') → sortable
TextColumn::make('price') → formatat amb € (obtingut del primer variant)
TextColumn::make('total_stock') → suma de stock de totes les variants
BadgeColumn::make('status') → 'published' = verd, 'draft' = gris
TextColumn::make('created_at') → format relatiu (fa 2h, ahir...)
```

### 5.5 EditSimpleProduct (Filament Page)

**Fitxer:** `app/Filament/Pages/EditSimpleProduct.php`

- Mateixa estructura que CreateSimpleProduct
- Carrega dades existents del producte
- Gestió d'imatges: mostra existents, permet eliminar i afegir noves
- Si el producte ja té variants: mostra-les editables
- Botó "Desar canvis" crida `SimpleProductCreator::update()`

---

## 6. Gestió d'Imatges (Detall Tècnic)

### Flux Complet
```
1. Usuari arrossega imatges al FileUpload de Filament
                │
2. Filament les desa temporalment a storage/app/livewire-tmp/
                │
3. Al submit, SimpleProductCreator processa cada imatge:
   │
   ├─ $product->addMedia($tmpPath)
   │   ->toMediaCollection('images')
   │
   ├─ Spatie Media Library:
   │   ├─ Mou fitxer a storage/app/public/{media_id}/{filename}
   │   ├─ Genera conversions síncrones (definides a Product.php):
   │   │   ├─ thumb: 150x150px + sharpen(10)
   │   │   ├─ medium: 600x600px + sharpen(10)
   │   │   └─ large: 1200x1200px + sharpen(10)
   │   └─ Crea registre a taula `media`
   │
   ├─ MediaObserver::created() detecta:
   │   ├─ model_type === 'product' ✓
   │   └─ collection_name === 'images' ✓
   │
   └─ Dispara SyncMediaToCloudinary (async, 2s delay):
       ├─ Puja a Cloudinary (folder: 'shoes-photos')
       └─ Desa cloudinary_public_id com custom property

4. Primera imatge → product.thumbnail_id = media.id
```

### Què NO Cal Canviar
- `MediaObserver` → ja funciona per qualsevol producte nou
- `SyncMediaToCloudinary` → ja funciona amb el flux existent
- `Product::registerMediaConversions()` → les conversions ja estan definides
- Configuració de Cloudinary → ja configurada

### Consideracions
- `FileUpload` de Filament és compatible amb Spatie Media Library via `SpatieMediaLibraryFileUpload` — valorar si usar-lo directament o fer-ho manualment al service.
- Límit recomanat: 10 imatges per producte, 5MB per imatge.
- Formats acceptats: JPEG, PNG, WebP.

---

## 7. Generació Automàtica de SKU (Detall)

### Format
```
{MARCA_3}{-}{PRODUCTE_SLUG_15}{-}{TALLA}{-}{COLOR_3}
                    o
{MARCA_3}{-}{PRODUCTE_SLUG_15}{-}{SUFFIX_NUM}
```

### Exemples
| Marca | Producte | Talla | Color | SKU Generat |
|-------|----------|-------|-------|-------------|
| Nike | Air Zoom Pegasus 41 | - | - | `NIK-AIR-ZOOM-PEGASU-001` |
| Nike | Air Zoom Pegasus 41 | 42 | Negre | `NIK-AIR-ZOOM-PEGASU-42-NEG` |
| ASICS | Gel Kayano 31 | 41 | Blanc | `ASI-GEL-KAYANO-31-41-BLA` |
| La Sportiva | Bushido III | 43 | Blau | `LAS-BUSHIDO-III-43-BLA` |
| (sense marca) | Producte Test | - | - | `GEN-PRODUCTE-TEST-001` |

### Validació d'Unicitat
```
1. Generar SKU base
2. Consultar: SELECT COUNT(*) FROM lunar_product_variants WHERE sku = ?
3. Si existeix → afegir/incrementar suffix: -002, -003...
4. Repetir fins a trobar un únic
5. Assegurar longitud ≤ 64 caràcters
```

---

## 8. Verificació del Flux Frontend

### Producte Sense Variants (cas simple)
El `ProductController::show()` actual retorna variants amb SKU i stock. Un producte amb 1 sola variant (sense opcions talla/color) funcionarà correctament perquè:
- L'API ja retorna `variants[]` — tindrà 1 element
- El frontend `ProductDetailPage` mostra les variants disponibles
- Si no hi ha selector de talla/color, l'usuari simplement afegeix al carret

**Punt a verificar:** El frontend React ha de gestionar correctament el cas on un producte no té opcions de talla/color (no mostrar selectors buits). Caldrà revisar `ProductDetailPage.jsx`.

### Producte Amb Variants
Funciona exactament com ara — sense canvis necessaris.

### Checklist de Compatibilitat Frontend
- [ ] `ProductController::index()` retorna productes nous correctament
- [ ] `ProductController::show()` retorna detall complet
- [ ] `ProductDetailPage` gestiona productes sense opcions talla/color
- [ ] `CartController::add()` accepta variant_id de productes simples
- [ ] Les imatges es mostren correctament (Cloudinary URLs)

---

## 9. Fases d'Implementació (Iteratives)

### Fase 1 — MVP: Creació Simple (Prioritat ALTA)
**Objectiu:** Poder crear un producte bàsic (sense variants) des d'un formulari simple.

**Entregables:**
1. `SkuGenerator` service
2. `SimpleProductCreator` service (només mètode `create`, sense variants)
3. `CreateSimpleProduct` Filament page (sense secció de variants)
4. Verificar que el producte apareix a l'API i al frontend

**Camps del formulari MVP:**
- Nom *
- Descripció
- Marca (select)
- Preu *
- Categories (checkboxes)
- Imatges (file upload)
- Stock

**Criteris d'acceptació:**
- [ ] L'usuari crea un producte omplint només nom i preu
- [ ] El producte es publica automàticament (status='published')
- [ ] SKU generat automàticament
- [ ] El producte apareix a GET /api/products sense retard
- [ ] Les imatges es pugen i sincronitzen amb Cloudinary
- [ ] La miniatura s'assigna automàticament

**Estimació de complexitat:** Baixa-Mitjana

---

### Fase 2 — Variants Opcionals (Prioritat MITJANA)
**Objectiu:** Afegir suport per variants (talles/colors) al formulari.

**Entregables:**
1. Toggle "té variants" al formulari
2. Repeater de variants amb selects de talla/color i stock
3. `SimpleProductCreator` actualitzat per crear múltiples variants
4. Lògica de `SkuGenerator` per variants

**Criteris d'acceptació:**
- [ ] Amb toggle desactivat → funciona com Fase 1
- [ ] Amb toggle activat → crea N variants amb SKUs únics
- [ ] Cada variant té el seu stock
- [ ] Totes les variants comparteixen el mateix preu base
- [ ] El frontend mostra selectors de talla/color correctament

**Estimació de complexitat:** Mitjana

---

### Fase 3 — Llistat i Edició (Prioritat MITJANA)
**Objectiu:** Gestionar productes existents amb la mateixa simplicitat.

**Entregables:**
1. `ListSimpleProducts` — taula amb tots els productes
2. `EditSimpleProduct` — formulari d'edició
3. `SimpleProductCreator::update()` mètode
4. Accions ràpides: publicar/despublicar, eliminar

**Criteris d'acceptació:**
- [ ] Llistat mostra tots els productes amb info clau
- [ ] Editar producte carrega totes les dades al formulari
- [ ] Es poden afegir/eliminar imatges
- [ ] Es poden afegir/eliminar variants
- [ ] Canviar estat funciona (published ↔ draft)
- [ ] Eliminar producte fa soft delete

**Estimació de complexitat:** Mitjana-Alta

---

### Fase 4 — Polish i UX (Prioritat BAIXA)
**Objectiu:** Millorar l'experiència global.

**Entregables:**
1. Dashboard amb estadístiques (total productes, stock baix, vendes)
2. Acció "Duplicar producte"
3. Previsualització del producte abans de crear
4. Validacions en temps real (slug únic, SKU preview)
5. Bulk actions (publicar/despublicar múltiples)
6. Notificacions de stock baix

**Estimació de complexitat:** Variable

---

## 10. Consideracions de Mantenibilitat

### Principis
1. **Separació de responsabilitats:** La lògica de negoci viu als Services, no a les Pages de Filament.
2. **Coexistència:** Les pàgines Lunar estàndard segueixen disponibles per gestió avançada.
3. **Configurabilitat:** Valors per defecte (ProductType, TaxClass, Currency) obtinguts dinàmicament, no hardcodejats per ID.
4. **Testabilitat:** Els serveis són injectables i testables unitàriament.

### Patrons a Seguir
- Usar `DB::transaction()` per crear producte + variants + preus atòmicament.
- Usar events/observers existents (no duplicar lògica de media).
- Obtenir defaults via queries (`where('default', true)`) en lloc de IDs fixos.
- Gestionar errors amb excepcions descriptives.

### Escalabilitat Futura
- **Nous tipus de producte:** Afegir selector de ProductType si es necessita.
- **Noves opcions:** El repeater de variants es pot ampliar amb noves opcions.
- **Multi-idioma:** L'attribute_data ja usa TranslatedText — es pot afegir suport multi-locale.
- **Multi-currency:** El preu es pot ampliar a múltiples monedes.
- **API de creació:** El `SimpleProductCreator` es pot reutilitzar des d'un endpoint API.

---

## 11. Riscos i Mitigacions

| # | Risc | Probabilitat | Impacte | Mitigació |
|---|------|-------------|---------|-----------|
| 1 | Frontend no gestiona productes sense variants de talla/color | Alta | Mitjà | Revisar i adaptar `ProductDetailPage.jsx` a la Fase 1 |
| 2 | Slug duplicat causa error d'unicitat | Mitjana | Alt | `generateUniqueSlug()` amb suffix incremental |
| 3 | SKU duplicat | Baixa | Alt | `ensureUnique()` al SkuGenerator amb retry |
| 4 | Imatges grans bloquegen el formulari | Baixa | Baix | Conversions ja són síncrones i petites; Cloudinary async |
| 5 | ProductType/TaxClass no existeix (DB buida) | Baixa | Alt | Crear-los automàticament si no existeixen (firstOrCreate) |
| 6 | Filament FileUpload incompatible amb Spatie | Baixa | Mitjà | Usar `SpatieMediaLibraryFileUpload` de Filament o processar manualment |
| 7 | attribute_data format canvia entre versions de Lunar | Baixa | Alt | Usar `TranslatedText` class de Lunar, no construir JSON manualment |

---

## 12. Dependències i Prerequisites

### Ja Instal·lats (no cal afegir res)
- ✅ Filament (via Lunar)
- ✅ Spatie Media Library (via Lunar)
- ✅ Cloudinary SDK
- ✅ Lunar 1.2 amb totes les migracions

### Cal Verificar
- [ ] Que existeix almenys 1 ProductType a la DB
- [ ] Que existeix almenys 1 TaxClass a la DB
- [ ] Que existeix la Currency EUR amb default=true
- [ ] Que existeix almenys 1 CustomerGroup amb default=true
- [ ] Que el directori `app/Filament/Pages/` existeix (o crear-lo)
- [ ] Que el directori `app/Services/` existeix (o crear-lo)

---

## 13. Tests Recomanats

### Unit Tests
```
SkuGeneratorTest
├── test_generates_sku_without_variants
├── test_generates_sku_with_size_and_color
├── test_ensures_uniqueness
├── test_handles_missing_brand
├── test_truncates_long_names
└── test_max_64_characters

SimpleProductCreatorTest
├── test_creates_simple_product
├── test_creates_product_with_variants
├── test_generates_unique_slug
├── test_assigns_thumbnail
├── test_associates_collections
├── test_uses_default_tax_class
├── test_price_stored_in_cents
└── test_wraps_in_transaction
```

### Feature Tests
```
CreateSimpleProductPageTest
├── test_page_accessible_by_admin
├── test_creates_product_with_minimum_fields
├── test_creates_product_with_all_fields
├── test_creates_product_with_variants
├── test_validates_required_fields
├── test_product_appears_in_api_after_creation
└── test_images_uploaded_and_synced
```
