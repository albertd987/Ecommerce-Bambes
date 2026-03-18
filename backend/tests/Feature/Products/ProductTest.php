<?php

namespace Tests\Feature\Products;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\Product;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class ProductTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    public function test_products_index_returns_paginated_list(): void
    {
        $this->createProductWithVariantAndPrice();
        $this->createProductWithVariantAndPrice();

        $response = $this->getJson('/api/products');

        $response->assertStatus(200)
                 ->assertJsonStructure(['data', 'meta']);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_search_special_characters_returns_200(): void
    {
        $response = $this->getJson('/api/products?q=' . urlencode('<script>alert(1)</script>'));

        $response->assertStatus(200)
                 ->assertJsonStructure(['data']);
    }

    public function test_search_sql_injection_returns_200(): void
    {
        $response = $this->getJson('/api/products?q=' . urlencode("'; DROP TABLE users; --"));

        $response->assertStatus(200);
    }

    public function test_filters_with_no_results_returns_empty_array(): void
    {
        $response = $this->getJson('/api/products?brands=nonexistent_brand_xyz');

        $response->assertStatus(200)
                 ->assertJsonPath('data', []);
    }

    public function test_product_not_found_returns_404(): void
    {
        $response = $this->getJson('/api/products/99999');

        $response->assertStatus(404);
    }

    public function test_pagination_out_of_range_returns_empty_data(): void
    {
        $this->createProductWithVariantAndPrice();

        $response = $this->getJson('/api/products?page=9999');

        $response->assertStatus(200)
                 ->assertJsonPath('data', []);
    }

    public function test_draft_product_not_in_listing(): void
    {
        $this->createProductWithVariantAndPrice(5000, 10, ['status' => 'draft']);   // 50€, stock=10
        $this->createProductWithVariantAndPrice(5000, 10, ['status' => 'published']); // 50€, stock=10

        $response = $this->getJson('/api/products');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_product_without_variants_does_not_error(): void
    {
        // Create product without any variants or prices
        Product::factory()->create([
            'product_type_id' => $this->productType->id,
            'status'          => 'published',
        ]);

        $response = $this->getJson('/api/products');

        // Should return 200, not 500
        $response->assertStatus(200);
    }

    public function test_filters_endpoint_returns_200(): void
    {
        $response = $this->getJson('/api/products/filters');

        $response->assertStatus(200);
    }
}
