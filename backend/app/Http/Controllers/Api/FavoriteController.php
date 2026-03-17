<?php

namespace App\Http\Controllers\Api;

use App\Models\Favorite;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Lunar\Models\Product;

class FavoriteController extends Controller
{
    public function index(Request $request)
    {
        $favorites = Favorite::where('user_id', $request->user()->id)
            ->with('product')
            ->get()
            ->map(fn ($fav) => $fav->product)
            ->filter()
            ->values();

        return response()->json($favorites);
    }

    public function toggle(Request $request, Product $product)
    {
        $user = $request->user();

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
}