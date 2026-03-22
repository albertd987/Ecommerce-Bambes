<?php

namespace Tests\Feature\Products;

use App\Services\SimpleProductCreator;
use App\Services\SkuGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\CustomerGroup;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class ProductVariantsTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
        CustomerGroup::factory()->create(['default' => true]);
    }

    private function makeCreator(): SimpleProductCreator
    {
        return new SimpleProductCreator(new SkuGenerator());
    }

    public function test_variant_with_size_only_does_not_create_empty_color_value(): void
    {
        $product = $this->makeCreator()->create([
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
            $this->assertCount(1, $values, "Variant {$variant->sku} should have 1 option value, got " . $values->count());
        }
    }

    public function test_variant_with_color_only_does_not_create_empty_size_value(): void
    {
        $product = $this->makeCreator()->create([
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
            $this->assertCount(1, $variant->values);
        }
    }

    public function test_variant_with_size_and_color_creates_two_option_values(): void
    {
        $product = $this->makeCreator()->create([
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
        $this->assertCount(2, $product->variants->first()->values);
    }

    public function test_sku_does_not_contain_empty_segment_for_size_only_variant(): void
    {
        $product = $this->makeCreator()->create([
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
        $this->assertStringNotContainsString('--', $sku);
    }
}
