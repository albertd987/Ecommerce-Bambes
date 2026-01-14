<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

use Lunar\FieldTypes\TranslatedText;

use Lunar\Models\Brand;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Price;
use Lunar\Models\Product;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;

class LunarBambesDemoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {

            $locale = config('app.locale') ?: 'en';

            // Detectem columnes variables (segons instal·lació/migracions)
            $customerGroupCols = Schema::getColumnListing('lunar_customer_groups');
            $cgHasHandle = in_array('handle', $customerGroupCols, true);

            $brandCols = Schema::getColumnListing('lunar_brands');
            $brandHasHandle = in_array('handle', $brandCols, true);

            $optCols = Schema::getColumnListing('lunar_product_options');
            $valCols = Schema::getColumnListing('lunar_product_option_values');
            $optHasHandle = in_array('handle', $optCols, true);
            $valHasHandle = in_array('handle', $valCols, true);

            /**
             * 0) Language default (necessari per UrlGenerator)
             * lunar_languages: a la teva BD NO hi ha enabled
             */
            $lang = Language::updateOrCreate(
                ['code' => $locale],
                [
                    'name' => match ($locale) {
                        'ca' => 'Català',
                        'es' => 'Español',
                        default => 'English',
                    },
                    'default' => true,
                ]
            );
            Language::where('id', '!=', $lang->id)->update(['default' => false]);

            /**
             * 1) Currency EUR default
             */
            $eur = Currency::updateOrCreate(
                ['code' => 'EUR'],
                [
                    'name' => 'Euro',
                    'exchange_rate' => 1,
                    'decimal_places' => 2,
                    'enabled' => true,
                    'default' => true,
                ]
            );
            Currency::where('code', '!=', 'EUR')->update(['default' => false]);

            /**
             * 1.1) CustomerGroup default (necessari per Prices)
             * -> si existeix column handle i és NOT NULL, el posem sí o sí.
             */
            if ($cgHasHandle) {
                $defaultCustomerGroup = CustomerGroup::firstOrCreate(
                    ['handle' => 'default'],
                    ['name' => 'Default']
                );
            } else {
                $defaultCustomerGroup = CustomerGroup::firstOrCreate(
                    ['name' => 'Default']
                );
            }

            /**
             * 1.2) Product Type (a la teva taula només hi ha "name")
             */
            $productType = ProductType::firstOrCreate(['name' => 'Bambes']);

            /**
             * 1.3) TaxClass (OBLIGATORI per a ProductVariant: tax_class_id NOT NULL)
             */
            $taxClassCols = Schema::getColumnListing('lunar_tax_classes');
            $taxHasDefault = in_array('default', $taxClassCols, true);

            $taxClass = TaxClass::firstOrCreate(
                ['name' => 'Standard'],
                $taxHasDefault ? ['default' => true] : []
            );

            if ($taxHasDefault) {
                TaxClass::where('id', '!=', $taxClass->id)->update(['default' => false]);
            }

            /**
             * 2) Collections (Tipus: Trail/Asfalt/...)
             * lunar_collections: no té name/handle, usa attribute_data
             */
            $collectionGroup = CollectionGroup::firstOrCreate(
                ['handle' => 'tipus-bambes'],
                ['name' => 'Tipus de bambes']
            );

            $tipus = [
                'trail'  => 'Trail',
                'asfalt' => 'Asfalt',
                'pista'  => 'Pista',
                'mixt'   => 'Mixt',
            ];

            $collections = [];
            foreach ($tipus as $key => $label) {
                $existing = Collection::where('collection_group_id', $collectionGroup->id)
                    ->where("attribute_data->name->value->{$locale}", $label)
                    ->first();

                if (! $existing) {
                    $existing = Collection::create([
                        'collection_group_id' => $collectionGroup->id,
                        'type' => 'static',
                        'attribute_data' => [
                            'name' => new TranslatedText([$locale => $label]),
                        ],
                        'sort' => 1,
                    ]);
                }

                $collections[$key] = $existing;
            }

            /**
             * 3) Product Options i Values (talla/color)
             */
            if ($optHasHandle) {
                $optSize  = ProductOption::firstOrCreate(['handle' => 'talla'], ['name' => 'Talla']);
                $optColor = ProductOption::firstOrCreate(['handle' => 'color'], ['name' => 'Color']);
            } else {
                $optSize  = ProductOption::firstOrCreate(['name' => 'Talla']);
                $optColor = ProductOption::firstOrCreate(['name' => 'Color']);
            }

            $sizes  = ['40', '41', '42', '43', '44'];
            $colors = ['Negre', 'Blanc', 'Blau'];

            $sizeValues = [];
            foreach ($sizes as $s) {
                $sizeValues[$s] = $valHasHandle
                    ? ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optSize->id, 'name' => [$locale => $s]],  // ← Array
                        ['handle' => 'talla-' . $s]
                    )
                    : ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optSize->id, 'name' => [$locale => $s]]  // ← Array
                    );
            }

            $colorValues = [];
            foreach ($colors as $c) {
                $colorValues[$c] = $valHasHandle
                    ? ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optColor->id, 'name' => [$locale => $c]],  // ← Array
                        ['handle' => 'color-' . Str::slug($c)]
                    )
                    : ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optColor->id, 'name' => [$locale => $c]]  // ← Array
                    );
            }

            /**
             * 4) Productes demo
             * lunar_products: status, brand_id, product_type_id, attribute_data
             */
            $products = [
                ['name' => 'Nike Air Zoom Pegasus 41', 'brand' => 'Nike', 'tipus' => 'asfalt', 'base_price' => 129.99, 'desc' => "Sabatilla d'entrenament per asfalt, polivalent."],
                ['name' => 'ASICS GEL-Kayano 31', 'brand' => 'ASICS', 'tipus' => 'asfalt', 'base_price' => 199.99, 'desc' => "Estabilitat i amortiguació per rodatges llargs."],
                ['name' => 'HOKA Clifton 9', 'brand' => 'HOKA', 'tipus' => 'asfalt', 'base_price' => 159.99, 'desc' => "Amortiguació suau i lleugera per asfalts."],
                ['name' => 'Adidas Ultraboost Light', 'brand' => 'Adidas', 'tipus' => 'asfalt', 'base_price' => 189.99, 'desc' => "Confort i resposta per ús esportiu i diari."],
                ['name' => 'Salomon Speedcross 6', 'brand' => 'Salomon', 'tipus' => 'trail', 'base_price' => 149.99, 'desc' => "Trail agressiu per fang i terreny tècnic."],
                ['name' => 'Saucony Peregrine 14', 'brand' => 'Saucony', 'tipus' => 'trail', 'base_price' => 139.99, 'desc' => "Trail polivalent amb bon agarri."],
                ['name' => 'La Sportiva Bushido II', 'brand' => 'La Sportiva', 'tipus' => 'trail', 'base_price' => 154.99, 'desc' => "Precisa i estable per terreny tècnic."],
                ['name' => 'Brooks Ghost 16', 'brand' => 'Brooks', 'tipus' => 'asfalt', 'base_price' => 149.99, 'desc' => "Rodatge còmode per entrenament diari."],
                ['name' => 'New Balance Fresh Foam X 1080v13', 'brand' => 'New Balance', 'tipus' => 'asfalt', 'base_price' => 189.99, 'desc' => "Màxima comoditat per quilòmetres."],
                ['name' => 'Mizuno Wave Rider 27', 'brand' => 'Mizuno', 'tipus' => 'mixt', 'base_price' => 149.99, 'desc' => "Equilibri entre amortiguació i resposta."],
            ];

            foreach ($products as $p) {

                // Brand: pot tenir handle o no segons la teva BD
                if ($brandHasHandle) {
                    $brand = Brand::firstOrCreate(
                        ['handle' => Str::slug($p['brand'])],
                        ['name' => $p['brand']]
                    );
                } else {
                    $brand = Brand::firstOrCreate(['name' => $p['brand']]);
                }

                $product = Product::create([
                    'status' => 'published',
                    'brand_id' => $brand->id,
                    'product_type_id' => $productType->id,
                    'attribute_data' => [
                        'name' => new TranslatedText([$locale => $p['name']]),
                        'description' => new TranslatedText([$locale => $p['desc']]),
                    ],
                ]);

                // categoria / tipus (collections)
                $product->collections()->syncWithoutDetaching([$collections[$p['tipus']]->id]);

                // variants
                foreach (['41', '42', '43'] as $s) {
                    foreach (['Negre', 'Blanc'] as $c) {

                        $sku = strtoupper(Str::slug($p['brand'])) . '-' . strtoupper(Str::slug($p['name'])) . "-{$s}-" . strtoupper(Str::slug($c));
                        $sku = substr($sku, 0, 64);

                        $variant = ProductVariant::create([
                            'product_id' => $product->id,
                            'tax_class_id' => $taxClass->id, // ✅ OBLIGATORI
                            'sku' => $sku,
                            'purchasable' => true,
                            'stock' => rand(10, 50),
                        ]);

                        // assignar talla/color a la variant
                        $ids = [$sizeValues[$s]->id, $colorValues[$c]->id];

                        if (method_exists($variant, 'optionValues')) {
                            $variant->optionValues()->syncWithoutDetaching($ids);
                        } else {
                            $variant->values()->syncWithoutDetaching($ids);
                        }

                        // preu en cèntims
                        $price = $p['base_price'] + (float)(($s - 41) * 2);

                        Price::create([
                            'customer_group_id' => $defaultCustomerGroup->id,
                            'currency_id' => $eur->id,
                            'priceable_type' => 'product_variant',  // ← Cambiar de get_class($variant)
                            'priceable_id' => $variant->id,
                            'price' => (int) round($price * 100),
                            'compare_price' => null,
                            'min_quantity' => 1,
                        ]);
                    }
                }
            }
        });
    }
}
