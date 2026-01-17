<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Lunar\Models\Product;

class ProductController extends Controller
{
    /**
     * Llistar productes
     */
    public function index()
    {
        $products = Product::with(['variants', 'thumbnail'])
            ->where('status', 'published')
            ->get()
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'name' => $product->translateAttribute('name'),
                    'brand' => $product->brand?->name ?? 'Sin marca',
                    'price' => $product->variants->first()?->basePrices->first()?->price->decimal ?? 0,
                    'thumbnail' => $product->thumbnail?->getUrl('medium') ?? null,
                ];
            });

        return response()->json([
            'data' => $products
        ]);
    }

    /**
     * Detall del producte
     */
    public function show($id)
    {
        $product = Product::with(['variants.basePrices', 'thumbnail', 'images'])
            ->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $product->id,
                'name' => $product->translateAttribute('name'),
                'description' => $product->translateAttribute('description'),
                'brand' => $product->brand?->name ?? 'Sin marca',
                'price' => $product->variants->first()?->basePrices->first()?->price->decimal ?? 0,
                'thumbnail' => $product->thumbnail?->getUrl('medium'),
                'images' => $product->images->map(fn($img) => $img->getUrl('large')),
                'variants' => $product->variants->map(function ($variant) {
                    return [
                        'id' => $variant->id,
                        'sku' => $variant->sku,
                        'stock' => $variant->stock,
                    ];
                }),
            ]
        ]);
    }
}