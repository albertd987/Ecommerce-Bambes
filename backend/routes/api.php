<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductController;

// Productos
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{id}', [ProductController::class, 'show']);

// Carrito (lo haremos después)
// Route::get('/cart', [CartController::class, 'index']);
// Route::post('/cart/add', [CartController::class, 'add']);

// Autenticación (lo haremos después)
// Route::post('/register', [AuthController::class, 'register']);
// Route::post('/login', [AuthController::class, 'login']);