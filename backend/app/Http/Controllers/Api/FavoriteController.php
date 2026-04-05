<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use Illuminate\Http\Request;
use Lunar\Models\Product;

class FavoriteController extends Controller
{
    public function index(Request $request)
    {
        $favorites = Favorite::where('user_id', $request->user()->id)
            ->with([
                'product.brand',
                'product.thumbnailMedia',
                'product.variants.prices',
            ])
            ->get()
            ->map(fn ($fav) => $fav->product)
            ->filter()
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'name' => $this->extractProductName($product),
                    'brand' => $this->extractBrandName($product),
                    'thumbnail' => $this->extractThumbnailUrl($product),
                    'price' => $this->extractPrice($product),
                    'slug' => $product->slug ?? null,
                ];
            })
            ->values();

        return response()->json([
            'data' => $favorites,
        ]);
    }

    public function toggle(Request $request, Product $product)
    {
        $user = $request->user();

        abort_if($product->status !== 'published', 404);

        $favorite = Favorite::where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->first();

        if ($favorite) {
            $favorite->delete();

            return response()->json([
                'favorited' => false,
            ]);
        }

        Favorite::create([
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        return response()->json([
            'favorited' => true,
        ]);
    }

    private function extractProductName(Product $product): string
    {
        try {
            if (method_exists($product, 'translateAttribute')) {
                $name = $product->translateAttribute('name');

                if (is_string($name) && trim($name) !== '') {
                    return $name;
                }

                if (is_object($name) && method_exists($name, '__toString')) {
                    $stringName = (string) $name;
                    if (trim($stringName) !== '') {
                        return $stringName;
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        if (!empty($product->attribute_data['name'])) {
            $raw = $product->attribute_data['name'];

            if (is_string($raw)) {
                return $raw;
            }

            if (is_array($raw)) {
                return $raw['value'] ?? $raw['en'] ?? $raw['ca'] ?? 'Producte';
            }
        }

        return 'Producte';
    }

    private function extractBrandName(Product $product): ?string
    {
        $brand = $product->brand ?? null;

        if (!$brand) {
            return null;
        }

        if (isset($brand->name) && is_string($brand->name)) {
            return $brand->name;
        }

        if (isset($brand->attribute_data['name'])) {
            $raw = $brand->attribute_data['name'];

            if (is_string($raw)) {
                return $raw;
            }

            if (is_array($raw)) {
                return $raw['value'] ?? $raw['en'] ?? $raw['ca'] ?? null;
            }
        }

        return null;
    }

    private function extractThumbnailUrl(Product $product): ?string
    {
        $media = $product->thumbnailMedia ?? null;

        if (!$media) {
            return null;
        }

        try {
            $url = $media->getUrl();
            return is_string($url) && trim($url) !== '' ? $url : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

  private function extractPrice(Product $product): float
{
    $variant = $product->variants->first();

    if (!$variant) {
        return 0;
    }

    $firstPrice = $variant->prices->first();

    if (!$firstPrice) {
        return 0;
    }

    $price = $firstPrice->price ?? null;

    if (is_object($price)) {
        if (isset($price->decimal)) {
            return (float) $price->decimal / 100;
        }

        if (isset($price->value)) {
            return (float) $price->value / 100;
        }
    }

    if (is_numeric($price)) {
        return (float) $price / 100;
    }

    return 0;
}
}