<?php
// backend/tests/Traits/LunarTestSetup.php

namespace Tests\Traits;

use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\Language;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Lunar\Models\TaxZone;
use Lunar\Models\TaxRate;
use Lunar\Models\TaxRateAmount;

trait LunarTestSetup
{
    protected Channel $channel;
    protected Currency $currency;
    protected ProductType $productType;
    protected TaxClass $taxClass;
    protected Language $language;

    protected function setUpLunar(): void
    {
        $this->language = Language::factory()->create([
            'code'    => 'ca',
            'name'    => 'Català',
            'default' => true,
        ]);

        $this->currency = Currency::factory()->create([
            'code'           => 'EUR',
            'name'           => 'Euro',
            'exchange_rate'  => 1,
            'decimal_places' => 2,
            'enabled'        => true,
            'default'        => true,
        ]);

        $this->channel = Channel::factory()->create([
            'name'    => 'Webshop',
            'handle'  => 'webshop',
            'default' => true,
        ]);

        $this->taxClass = TaxClass::factory()->create([
            'name'    => 'IVA 21%',
            'default' => true,
        ]);

        $this->productType = ProductType::factory()->create([
            'name' => 'Sabatilles',
        ]);

        $this->setUpTaxZone();
    }

    private function setUpTaxZone(): void
    {
        $taxZone = TaxZone::factory()->create([
            'name'    => 'Default Zone',
            'active'  => true,
            'default' => true,
        ]);

        $taxRate = TaxRate::factory()->create([
            'tax_zone_id' => $taxZone->id,
            'name'        => 'IVA 21%',
            'priority'    => 1,
        ]);

        TaxRateAmount::factory()->create([
            'tax_rate_id'  => $taxRate->id,
            'tax_class_id' => $this->taxClass->id,
            'percentage'   => 21,
        ]);
    }

    /**
     * Create a published product with a variant and price.
     * Uses Lunar's built-in factories.
     */
    protected function createProductWithVariantAndPrice(
        int $priceCents = 5000,
        int $stock = 10,
        array $productOverrides = []
    ): array {
        $product = \Lunar\Models\Product::factory()->create(
            array_merge([
                'product_type_id' => $this->productType->id,
                'status'          => 'published',
            ], $productOverrides)
        );

        $variant = \Lunar\Models\ProductVariant::factory()->create([
            'product_id'   => $product->id,
            'tax_class_id' => $this->taxClass->id,
            'stock'        => $stock,
        ]);

        $price = \Lunar\Models\Price::factory()->create([
            'priceable_type' => 'product_variant',
            'priceable_id'   => $variant->id,
            'currency_id'    => $this->currency->id,
            'price'          => $priceCents,
            'min_quantity'   => 1,
        ]);

        return compact('product', 'variant', 'price');
    }
}
