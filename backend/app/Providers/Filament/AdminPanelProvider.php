<?php

namespace App\Providers\Filament;

use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Widgets;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Lunar\LunarPanel;

/**
 * Proveidor del panell d'administracio Filament.
 *
 * Configura el panell d'administracio per defecte accessible a /admin.
 * Defineix el color primari (Amber), el descobriment automatic de recursos,
 * pagines i widgets de Filament, i la pila de middlewares necessaris
 * per a sessio, CSRF, autenticacio i servei d'events de Filament.
 *
 * @package App\Providers\Filament
 */
class AdminPanelProvider extends PanelProvider
{
    /**
     * Configura i retorna el panell d'administracio Filament.
     *
     * Defineix:
     * - ID 'admin' i cami d'acces /admin amb formulari de login.
     * - Color primari Amber.
     * - Descobriment automatic de Resources, Pages i Widgets dins app/Filament/.
     * - Dashboard i widgets per defecte (AccountWidget, FilamentInfoWidget).
     * - Pila de middlewares: cookies, sessio, CSRF, bindings, autenticacio.
     *
     * @param  \Filament\Panel  $panel  Instancia del panell a configurar.
     * @return \Filament\Panel El panell configurat amb tots els middlewares i recursos.
     */
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login()
            ->colors([
                'primary' => Color::Amber,
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->pages([
                Pages\Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                Widgets\AccountWidget::class,
                Widgets\FilamentInfoWidget::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
  
    }
}
