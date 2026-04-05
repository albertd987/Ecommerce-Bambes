# Product Variants Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir tres problemes relacionats amb variants de producte: IDs d'opcions hardcodejats, falta de talla/color a l'endpoint `show()`, i creació incorrecta de variants amb atributs parcials.

**Architecture:** Tres canvis independents al backend. Task 1 extreu un mètode privat `getOptionIds()` a `ProductController` que resol els IDs per handle en lloc d'IDs hardcodejats — Tasks 2 i 3 depenen conceptualment d'això però poden fer-se en qualsevol ordre. No hi ha canvis al frontend ni a la base de dades.

**Tech Stack:** Laravel 11, Lunar, PHPUnit, `LunarTestSetup` trait, `RefreshDatabase`

---

## Context del codi actual

**IDs hardcodejats (problema):**
```php
// ProductController::index() — línies ~115-116
if ((int) $val->product_option_id === 1) $sizeValue = $vEn;  // 1 = talla per convenció
if ((int) $val->product_option_id === 2) $colorValue = $vEn; // 2 = color per convenció

// ProductController::filters() — línies ~299-315
->where('product_option_id', 1)  // assumeix que talla sempre té ID=1
->where('product_option_id', 2)  // assumeix que color sempre té ID=2
```

**`show()` incomplet (problema):**
```php
// ProductController::show() — línies ~271-276: no carrega 'variants.values'
'variants' => $product->variants->map(function ($variant) {
    return ['id' => ..., 'sku' => ..., 'stock_status' => ...];
    // FALTA: size, color
}),
```

**Variants parcials (problema):**
```php
// SimpleProductCreator::createVariantsWithOptions() — línia ~275
$optionValueIds = [$sizeValue->id, $colorValue->id]; // sempre afegeix els dos
// si size='' → crea ProductOptionValue buit + l'associa a la variant
```

**Dades reals a la BD:**
- `lunar_product_options`: ID=1 handle='talla', ID=2 handle='color'
- La columna `handle` existeix (`Schema::hasColumn` = true)

---

## Fitxers afectats

| Fitxer | Acció |
|--------|-------|
| `backend/app/Http/Controllers/Api/ProductController.php` | Modificar — Tasks 1 i 2 |
| `backend/app/Services/SimpleProductCreator.php` | Modificar — Task 3 |
| `backend/tests/Feature/Products/ProductTest.php` | Modificar — afegir tests Tasks 1 i 2 |
| `backend/tests/Feature/Products/ProductVariantsTest.php` | Crear — tests Task 3 |

---

## Task 1: Eliminar IDs hardcodejats de ProductController

**Files:**
- Modify: `backend/app/Http/Controllers/Api/ProductController.php`
- Modify: `backend/tests/Feature/Products/ProductTest.php`

### Pas 1.1 — Escriure els tests que falla

Afegir aquests tests a `ProductTest.php`:

```php
public function test_filters_returns_sizes_by_handle_not_hardcoded_id(): void
{
    // Arrange: crear option amb handle 'talla' i un valor
    $opt = \Lunar\Models\ProductOption::firstOrCreate(
        ['handle' => 'talla'],
        ['name' => 'Talla']
    );
    \Lunar\Models\ProductOptionValue::firstOrCreate(
        ['product_option_id' => $opt->id, 'name' => ['en' => 'M']],
        ['handle' => 'talla-m']
    );

    // Act
    $response = $this->getJson('/api/products/filters');

    // Assert
    $response->assertOk();
    $sizes = $response->json('data.sizes');
    $this->assertContains('M', $sizes);
}

public function test_filters_returns_colors_by_handle_not_hardcoded_id(): void
{
    $opt = \Lunar\Models\ProductOption::firstOrCreate(
        ['handle' => 'color'],
        ['name' => 'Color']
    );
    \Lunar\Models\ProductOptionValue::firstOrCreate(
        ['product_option_id' => $opt->id, 'name' => ['en' => 'Negre']],
        ['handle' => 'color-negre']
    );

    $response = $this->getJson('/api/products/filters');

    $response->assertOk();
    $colors = $response->json('data.colors');
    $this->assertContains('Negre', $colors);
}
```

- [ ] Afegir els dos tests a `ProductTest.php`

### Pas 1.2 — Verificar que fallen

```bash
cd /var/www/projecte2/backend && php artisan test --filter="test_filters_returns_sizes_by_handle|test_filters_returns_colors_by_handle" --no-coverage
```

Esperat: els tests passen o falla per algun altre motiu (depèn de l'estat de la BD de test). Si passen ja, el problema és que no hi ha asserció prou específica — confirmar visualment que s'usa el handle.

### Pas 1.3 — Implementar `getOptionIds()` i aplicar-ho

A `ProductController.php`, afegir:
1. Import al capdamunt: `use Lunar\Models\ProductOption;`
2. Mètode privat nou al final de la classe:

```php
/**
 * Resol els IDs de les opcions 'talla' i 'color' per handle.
 * Evita dependre dels IDs numèrics de la BD.
 */
private function getOptionIds(): array
{
    $sizeOption  = ProductOption::where('handle', 'talla')->first();
    $colorOption = ProductOption::where('handle', 'color')->first();
    return [$sizeOption?->id, $colorOption?->id];
}
```

3. A `index()`, substituir les línies hardcodejades (al voltant de la línia 111-116):

```php
// ABANS (dins del foreach de variants.values):
if ((int) $val->product_option_id === 1) $sizeValue = $vEn;
if ((int) $val->product_option_id === 2) $colorValue = $vEn;
```

```php
// DESPRÉS — afegir ABANS del foreach de $products->map():
[$sizeOptionId, $colorOptionId] = $this->getOptionIds();

// I dins del map, SUBSTITUIR les dues línies per:
if ($val->product_option_id == $sizeOptionId) $sizeValue = $vEn;
if ($val->product_option_id == $colorOptionId) $colorValue = $vEn;
```

4. A `filters()`, substituir els dos `->where('product_option_id', N)`:

```php
// ABANS:
$sizes = DB::table('lunar_product_option_values')
    ->select($nameSelect)
    ->where('product_option_id', 1)  // ← hardcoded
    ...

$colors = DB::table('lunar_product_option_values')
    ->select($nameSelect)
    ->where('product_option_id', 2)  // ← hardcoded
    ...
```

```php
// DESPRÉS:
[$sizeOptionId, $colorOptionId] = $this->getOptionIds();

$sizes = DB::table('lunar_product_option_values')
    ->select($nameSelect)
    ->where('product_option_id', $sizeOptionId)
    ...

$colors = DB::table('lunar_product_option_values')
    ->select($nameSelect)
    ->where('product_option_id', $colorOptionId)
    ...
```

- [ ] Aplicar els 4 canvis a `ProductController.php`

### Pas 1.4 — Executar tots els tests de productes

```bash
cd /var/www/projecte2/backend && php artisan test --filter=ProductTest --no-coverage
```

Esperat: tots passen (inclosos els nous i els existents).

### Pas 1.5 — Commit

```bash
cd /var/www/projecte2/backend && git add app/Http/Controllers/Api/ProductController.php tests/Feature/Products/ProductTest.php
git commit -m "fix: resolve product option IDs by handle instead of hardcoded integers"
```

---

## Task 2: Afegir talla i color a l'endpoint `show()`

**Files:**
- Modify: `backend/app/Http/Controllers/Api/ProductController.php`
- Modify: `backend/tests/Feature/Products/ProductTest.php`

**Prerequisit:** Task 1 completada (necessitem `getOptionIds()`).

### Pas 2.1 — Escriure el test que falla

Afegir a `ProductTest.php`:

```php
public function test_product_show_returns_size_and_color_per_variant(): void
{
    // Arrange: crear producte amb variant que té talla i color
    ['product' => $product, 'variant' => $variant] = $this->createProductWithVariantAndPrice();

    $sizeOpt  = \Lunar\Models\ProductOption::firstOrCreate(['handle' => 'talla'], ['name' => 'Talla']);
    $colorOpt = \Lunar\Models\ProductOption::firstOrCreate(['handle' => 'color'], ['name' => 'Color']);

    $sizeVal  = \Lunar\Models\ProductOptionValue::firstOrCreate(
        ['product_option_id' => $sizeOpt->id, 'name' => ['en' => 'L']],
        ['handle' => 'talla-l']
    );
    $colorVal = \Lunar\Models\ProductOptionValue::firstOrCreate(
        ['product_option_id' => $colorOpt->id, 'name' => ['en' => 'Blanc']],
        ['handle' => 'color-blanc']
    );

    // Associar els valors a la variant
    $variant->values()->syncWithoutDetaching([$sizeVal->id, $colorVal->id]);

    // Act
    $response = $this->getJson("/api/products/{$product->id}");

    // Assert
    $response->assertOk();
    $variantData = $response->json('data.variants.0');
    $this->assertArrayHasKey('size', $variantData);
    $this->assertArrayHasKey('color', $variantData);
    $this->assertEquals('L', $variantData['size']);
    $this->assertEquals('Blanc', $variantData['color']);
}

public function test_product_show_returns_null_size_color_when_no_options(): void
{
    ['product' => $product] = $this->createProductWithVariantAndPrice();

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertOk();
    $variantData = $response->json('data.variants.0');
    $this->assertArrayHasKey('size', $variantData);
    $this->assertArrayHasKey('color', $variantData);
    $this->assertNull($variantData['size']);
    $this->assertNull($variantData['color']);
}
```

- [ ] Afegir els dos tests a `ProductTest.php`

### Pas 2.2 — Verificar que fallen

```bash
cd /var/www/projecte2/backend && php artisan test --filter="test_product_show_returns_size|test_product_show_returns_null" --no-coverage
```

Esperat: FAIL — `size` i `color` no existeixen a la resposta.

### Pas 2.3 — Implementar el canvi a `show()`

A `ProductController::show()`, fer dos canvis:

**1. Afegir `variants.values` al with():**
```php
// ABANS:
$product = Product::with([
    'variants.prices',
    'thumbnail',
    'images'
])->findOrFail($id);

// DESPRÉS:
$product = Product::with([
    'variants.prices',
    'variants.values',
    'thumbnail',
    'images'
])->findOrFail($id);
```

**2. Substituir el map de variants (des de `'variants' =>` fins al final del map):**

> ⚠️ `getOptionIds()` ha d'estar FORA del `map()` — si estigués dins, faria 2 queries a BD per cada variant.

```php
// ABANS:
'variants' => $product->variants->map(function ($variant) {
    return [
        'id' => $variant->id,
        'sku' => $variant->sku,
        'stock_status' => StockService::getStatus($variant),
    ];
}),

// DESPRÉS — afegir JUST ABANS del 'variants' =>:
[$sizeOptionId, $colorOptionId] = $this->getOptionIds();
$getValueEn = fn($name) => is_array($name) ? ($name['en'] ?? null) : null;

// I substituir el map:
'variants' => $product->variants->map(function ($variant) use ($sizeOptionId, $colorOptionId, $getValueEn) {
    $sizeVal  = $variant->values->first(fn($v) => $v->product_option_id == $sizeOptionId);
    $colorVal = $variant->values->first(fn($v) => $v->product_option_id == $colorOptionId);

    return [
        'id'           => $variant->id,
        'sku'          => $variant->sku,
        'stock_status' => StockService::getStatus($variant),
        'size'         => $sizeVal  ? $getValueEn($sizeVal->name)  : null,
        'color'        => $colorVal ? $getValueEn($colorVal->name) : null,
    ];
}),
```

- [ ] Aplicar els canvis a `ProductController::show()`

### Pas 2.4 — Executar tots els tests de productes

```bash
cd /var/www/projecte2/backend && php artisan test --filter=ProductTest --no-coverage
```

Esperat: tots passen.

### Pas 2.5 — Commit

```bash
cd /var/www/projecte2/backend && git add app/Http/Controllers/Api/ProductController.php tests/Feature/Products/ProductTest.php
git commit -m "feat: add size and color to product show() API endpoint"
```

---

## Task 3: Corregir variants amb atributs parcials a SimpleProductCreator

**Files:**
- Modify: `backend/app/Services/SimpleProductCreator.php`
- Create: `backend/tests/Feature/Products/ProductVariantsTest.php`

**Problema concret:** Quan `size = ''` o `color = ''`, el codi actual:
- Crea un `ProductOptionValue` amb `name = ['ca' => '']` (valor buit)
- L'associa a la variant
- Passa `''` (string buit) al SKU generator (que malgrat que `if ($size)` és false, el comportament és inconsistent)

### Pas 3.1 — Crear el fitxer de test

Crear `backend/tests/Feature/Products/ProductVariantsTest.php`:

```php
<?php

namespace Tests\Feature\Products;

use App\Services\SimpleProductCreator;
use App\Services\SkuGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\CustomerGroup;
use Lunar\Models\ProductOptionValue;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class ProductVariantsTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();

        // SimpleProductCreator necessita CustomerGroup
        CustomerGroup::factory()->create(['default' => true]);
    }

    private function makeCreator(): SimpleProductCreator
    {
        return new SimpleProductCreator(new SkuGenerator());
    }

    public function test_variant_with_size_only_does_not_create_empty_color_value(): void
    {
        $creator = $this->makeCreator();

        $product = $creator->create([
            'name'           => 'Samarreta Test',
            'description'    => null,
            'brand_id'       => null,
            'new_brand_name' => null,
            'price'          => 29.99,
            'collection_ids' => [],
            'images'         => [],
            'stock'          => 0,
            'has_variants'   => true,
            'variants'       => [
                ['size' => 'S', 'color' => '', 'stock' => 5],
                ['size' => 'M', 'color' => '', 'stock' => 3],
            ],
        ]);

        $product->refresh();
        $this->assertCount(2, $product->variants);

        foreach ($product->variants as $variant) {
            $values = $variant->values;
            // Cada variant ha de tenir exactament 1 valor (la talla), no 2
            $this->assertCount(1, $values, "La variant {$variant->sku} hauria de tenir 1 valor d'opció, no " . $values->count());
            // El valor ha de ser la talla, no un color buit
            $this->assertNotEmpty($values->first()->name);
        }
    }

    public function test_variant_with_color_only_does_not_create_empty_size_value(): void
    {
        $creator = $this->makeCreator();

        $product = $creator->create([
            'name'           => 'Gorra Test',
            'description'    => null,
            'brand_id'       => null,
            'new_brand_name' => null,
            'price'          => 15.00,
            'collection_ids' => [],
            'images'         => [],
            'stock'          => 0,
            'has_variants'   => true,
            'variants'       => [
                ['size' => '', 'color' => 'Negre', 'stock' => 10],
                ['size' => '', 'color' => 'Blanc', 'stock' => 8],
            ],
        ]);

        $product->refresh();
        $this->assertCount(2, $product->variants);

        foreach ($product->variants as $variant) {
            $values = $variant->values;
            $this->assertCount(1, $values);
        }
    }

    public function test_variant_with_size_and_color_creates_two_option_values(): void
    {
        $creator = $this->makeCreator();

        $product = $creator->create([
            'name'           => 'Pantalon Test',
            'description'    => null,
            'brand_id'       => null,
            'new_brand_name' => null,
            'price'          => 59.99,
            'collection_ids' => [],
            'images'         => [],
            'stock'          => 0,
            'has_variants'   => true,
            'variants'       => [
                ['size' => 'L', 'color' => 'Blau', 'stock' => 4],
            ],
        ]);

        $product->refresh();
        $variant = $product->variants->first();

        // Ha de tenir exactament 2 valors: talla + color
        $this->assertCount(2, $variant->values);
    }

    public function test_sku_does_not_contain_empty_segment_for_size_only_variant(): void
    {
        $creator = $this->makeCreator();

        $product = $creator->create([
            'name'           => 'Calcetins Test',
            'description'    => null,
            'brand_id'       => null,
            'new_brand_name' => null,
            'price'          => 5.00,
            'collection_ids' => [],
            'images'         => [],
            'stock'          => 0,
            'has_variants'   => true,
            'variants'       => [
                ['size' => 'XL', 'color' => '', 'stock' => 2],
            ],
        ]);

        $product->refresh();
        $sku = $product->variants->first()->sku;

        // El SKU no ha de tenir '--' (doble guió) que indica segment buit
        $this->assertStringNotContainsString('--', $sku);
    }
}
```

- [ ] Crear el fitxer `ProductVariantsTest.php`

### Pas 3.2 — Verificar que els tests fallen

```bash
cd /var/www/projecte2/backend && php artisan test --filter=ProductVariantsTest --no-coverage
```

Esperat: FAIL — variants reben 2 valors quan haurien de rebre 1.

### Pas 3.3 — Implementar el fix a `createVariantsWithOptions()`

Localitzar el mètode `createVariantsWithOptions()` a `SimpleProductCreator.php` (línia ~215).

**Substituir el foreach sencer** (des de `foreach ($variantsData as $variantData)` fins al `}` de tancament del foreach) per:

```php
foreach ($variantsData as $variantData) {
    $size  = trim($variantData['size'] ?? '');
    $color = trim($variantData['color'] ?? '');

    $optionValueIds = [];

    if ($size !== '') {
        $sizeValue = $valHasHandle
            ? ProductOptionValue::firstOrCreate(
                ['product_option_id' => $optSize->id, 'name' => [$locale => $size]],
                ['handle' => 'talla-' . Str::slug($size)]
            )
            : ProductOptionValue::firstOrCreate(
                ['product_option_id' => $optSize->id, 'name' => [$locale => $size]]
            );
        $optionValueIds[] = $sizeValue->id;
    }

    if ($color !== '') {
        $colorValue = $valHasHandle
            ? ProductOptionValue::firstOrCreate(
                ['product_option_id' => $optColor->id, 'name' => [$locale => $color]],
                ['handle' => 'color-' . Str::slug($color)]
            )
            : ProductOptionValue::firstOrCreate(
                ['product_option_id' => $optColor->id, 'name' => [$locale => $color]]
            );
        $optionValueIds[] = $colorValue->id;
    }

    $sku = $this->skuGenerator->generate(
        $product->translateAttribute('name'),
        $brandName,
        $size !== '' ? $size : null,
        $color !== '' ? $color : null
    );

    $variant = ProductVariant::create([
        'product_id'   => $product->id,
        'tax_class_id' => $taxClass->id,
        'sku'          => $sku,
        'purchasable'  => 'in_stock',
        'stock'        => 0,
    ]);

    $stock = (int) ($variantData['stock'] ?? 0);
    if ($stock > 0) {
        app(StockService::class)->setInitial($variant, $stock);
    }

    if (!empty($optionValueIds)) {
        if (method_exists($variant, 'optionValues')) {
            $variant->optionValues()->syncWithoutDetaching($optionValueIds);
        } else {
            $variant->values()->syncWithoutDetaching($optionValueIds);
        }
    }

    Price::create([
        'customer_group_id' => $customerGroup->id,
        'currency_id'       => $currency->id,
        'priceable_type'    => 'product_variant',
        'priceable_id'      => $variant->id,
        'price'             => (int) round($basePrice * 100),
        'min_quantity'      => 1,
    ]);
}
```

**Important:** Els `$optSize` i `$optColor` es continuen creant abans del foreach (és correcte — `firstOrCreate` és idempotent i els necessitem si algun variant els usa). L'únic canvi és que `$optionValueIds` ara s'omple condicionalment.

- [ ] Aplicar el canvi a `createVariantsWithOptions()`

### Pas 3.4 — Executar els tests nous i els existents

```bash
cd /var/www/projecte2/backend && php artisan test --filter=ProductVariantsTest --no-coverage
```

Esperat: tots 4 passen.

```bash
cd /var/www/projecte2/backend && php artisan test --no-coverage
```

Esperat: tots els tests del projecte passen (sense regressions).

### Pas 3.5 — Commit

```bash
cd /var/www/projecte2/backend && git add app/Services/SimpleProductCreator.php tests/Feature/Products/ProductVariantsTest.php
git commit -m "fix: createVariantsWithOptions skips empty size/color instead of creating blank option values"
```

---

## Verificació final

```bash
cd /var/www/projecte2/backend && php artisan test --no-coverage
```

Esperat: tots els tests passen (19 existents + nous).

```bash
curl -s http://51.195.202.7:8080/api/products/filters | python3 -m json.tool
curl -s http://51.195.202.7:8080/api/products/1 | python3 -m json.tool
```

Verificar manualment que:
- `filters` retorna `sizes` i `colors` correctament
- `show` retorna `size` i `color` per cada variant
