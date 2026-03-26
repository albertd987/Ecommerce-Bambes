<?php

use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\OrderController;
use Illuminate\Http\Request;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use App\Http\Controllers\Api\FavoriteController;
use App\Http\Controllers\Api\UserAddressController;

// ==========================================
// RUTES PÚBLIQUES
// ==========================================

// Productes
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/filters', [ProductController::class, 'filters']);
Route::get('/products/{id}', [ProductController::class, 'show']);

// Carret (amb convidats)
Route::middleware(['web'])->prefix('/cart')->group(function () {
    Route::get('/', [CartController::class, 'index']);
    Route::post('/add', [CartController::class, 'add']);
    Route::put('/lines/{lineId}', [CartController::class, 'updateLine']);
    Route::delete('/lines/{lineId}', [CartController::class, 'removeLine']);
    Route::delete('/', [CartController::class, 'clear']);
});

// Autenticació
Route::middleware(['web'])->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// ==========================================
// RUTES PROTEGIDES
// ==========================================

Route::middleware(['web', 'auth:sanctum'])->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);

    // Checkout
    Route::post('/checkout/intent', [CheckoutController::class, 'createIntent']);
    Route::post('/checkout/confirm', [CheckoutController::class, 'confirm']);

    // Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::get('/orders/{id}/invoice', [OrderController::class, 'invoice']);

    // Canviar contrasenya
    Route::put('/user/password', [AuthController::class, 'updatePassword']);

    // Favorits
    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::post('/favorites/{product}', [FavoriteController::class, 'toggle']);

    // Adreces d'usuari
    Route::get('/user/addresses', [UserAddressController::class, 'index']);
    Route::post('/user/addresses', [UserAddressController::class, 'store']);
    Route::get('/user/addresses/{id}', [UserAddressController::class, 'show']);
    Route::put('/user/addresses/{id}', [UserAddressController::class, 'update']);
    Route::delete('/user/addresses/{id}', [UserAddressController::class, 'destroy']);
});

// ==========================================
// RUTES DE VERIFICACIÓ DE CORREU
// ==========================================

Route::get('/email/verify/{id}/{hash}', function (Request $request, $id, $hash) {
    $user = User::findOrFail($id);

    if (! hash_equals($hash, sha1($user->getEmailForVerification()))) {
        abort(403, 'Invalid verification link.');
    }

    if (! $user->hasVerifiedEmail()) {
        $user->markEmailAsVerified();
        event(new Verified($user));
    }

    return response()->json(['message' => 'Email verificat correctament']);

    // $frontend = env('FRONTEND_URL', 'http://localhost:5173');
    // return redirect($frontend . '/verify-email?verified=1');
})->middleware(['signed'])->name('verification.verify');

// Route::post('/email/verification-notification', function (Request $request) {
//     $request->user()->sendEmailVerificationNotification();

//     return response()->json(['message' => 'Email reenviat']);
// })->middleware(['auth:sanctum', 'throttle:6,1']);

Route::post('/email/verification-notification', function (Request $request) {
    if (! $request->user()) {
        return response()->json([
            'message' => 'No autenticat',
        ], 401);
    }

    $request->user()->sendEmailVerificationNotification();

    return response()->json([
        'message' => 'Email reenviat',
    ]);
})->middleware(['web', 'auth:sanctum', 'throttle:6,1']);