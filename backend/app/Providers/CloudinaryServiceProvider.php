<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Cloudinary\Cloudinary;

/**
 * Proveidor de serveis per a la integracio amb Cloudinary.
 *
 * Registra una instancia singleton de la classe Cloudinary\Cloudinary
 * al contenidor de serveis de Laravel. La instancia es configura amb
 * les credencials definides a config/cloudinary.php (cloud_name,
 * api_key, api_secret) i amb URLs segures (HTTPS) per defecte.
 *
 * Depenen d'aquest singleton: CloudinaryAdapter, CloudinaryUrlGenerator
 * i el job SyncMediaToCloudinary.
 *
 * @package App\Providers
 */
class CloudinaryServiceProvider extends ServiceProvider
{
    /**
     * Registra el singleton de Cloudinary al contenidor de serveis.
     *
     * Crea una instancia unica de Cloudinary configurada amb les
     * credencials de config/cloudinary.php: cloud_name, api_key,
     * api_secret i secure_url (HTTPS activat per defecte).
     *
     * @return void
     */
    public function register(): void
    {
        $this->app->singleton(Cloudinary::class, function ($app) {
            return new Cloudinary([
                'cloud' => [
                    'cloud_name' => config('cloudinary.cloud_name'),
                    'api_key'    => config('cloudinary.api_key'),
                    'api_secret' => config('cloudinary.api_secret'),
                ],
                'url' => [
                    'secure' => config('cloudinary.secure_url', true)
                ]
            ]);
        });
    }

    /**
     * Arrencada del proveidor. No requereix accions addicionals.
     *
     * @return void
     */
    public function boot(): void
    {
        //
    }
}