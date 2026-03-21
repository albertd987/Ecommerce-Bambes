<?php

namespace App\Providers;

use App\Filament\Lunar\Extensions\ProductResourceExtension;
use App\Models\Product;
use App\Observers\MediaObserver;
use Filament\Support\Facades\FilamentView;
use Filament\View\PanelsRenderHook;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Auth\Notifications\VerifyEmail;
use Lunar\Admin\Filament\Resources\ProductResource\Pages\ListProducts as LunarListProducts;
use Lunar\Admin\Support\Facades\LunarPanel;
use Lunar\Facades\ModelManifest;
use Lunar\Models\Contracts\Product as ProductContract;
use Lunar\Models\ProductVariant;
use App\Models\StockMovement;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        LunarPanel::register();

        // Registrar App\Models\Product al manifest de Lunar perquè
        // Product::create() retorni la nostra classe (amb fillable slug/thumbnail_id)
        ModelManifest::replace(ProductContract::class, Product::class);
    }

    public function boot(): void
    {
        // Registrar extensió del ProductResource per simplificar el popup de creació
        LunarPanel::extensions([
            LunarListProducts::class => ProductResourceExtension::class,
        ]);

        \Spatie\MediaLibrary\MediaCollections\Models\Media::observe(MediaObserver::class);

        FilamentView::registerRenderHook(
            PanelsRenderHook::BODY_END,
            fn () => Blade::render('@livewire(\'chatbot-widget\')')
        );

        // ✅ Personalitza el link de verificació perquè apunti al FRONTEND
        VerifyEmail::createUrlUsing(function ($notifiable) {
            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');

            $verifyUrl = URL::temporarySignedRoute(
                'verification.verify',
                now()->addMinutes(60),
                [
                    'id' => $notifiable->getKey(),
                    'hash' => sha1($notifiable->getEmailForVerification()),
                ]
            );

            return $frontendUrl . '/verify-email?verify_url=' . urlencode($verifyUrl);
        });

        // Registrar relació stockMovements a ProductVariant de Lunar
        ProductVariant::resolveRelationUsing('stockMovements', function ($model) {
            return $model->hasMany(StockMovement::class, 'product_variant_id');
        });
    }
}
