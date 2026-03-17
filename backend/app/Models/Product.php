<?php

namespace App\Models;

use Lunar\Models\Product as LunarProduct;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Model de producte de la botiga de bambes.
 *
 * Estén el model Product de Lunar per definir conversions d'imatge
 * personalitzades (thumb 150px, medium 600px, large 1200px) aplicades
 * de forma síncrona a totes les imatges associades al producte.
 *
 * Dins l'arquitectura ecommerce, cada producte representa un model
 * de sabatilla amb variants (talla/color), preus en EUR, marca,
 * col·leccions (trail, asfalt, pista, mixt) i imatges a Cloudinary.
 *
 * @property-read \Illuminate\Database\Eloquent\Collection|\Lunar\Models\ProductVariant[] $variants Variants del producte (talla/color).
 * @property-read \Lunar\Models\Brand|null $brand Marca del producte.
 * @property-read \Spatie\MediaLibrary\MediaCollections\Models\Media|null $thumbnail Imatge principal del producte.
 * @property-read \Illuminate\Database\Eloquent\Collection|\Spatie\MediaLibrary\MediaCollections\Models\Media[] $images Galeria d'imatges del producte.
 * @property-read \Illuminate\Database\Eloquent\Collection|\Lunar\Models\Collection[] $collections Col·leccions associades.
 * @property-read \Lunar\Models\ProductType $productType Tipus de producte (Bambes).
 *
 * @package App\Models
 */
class Product extends LunarProduct
{
    /**
     * Camps addicionals assignables en massa (afegits per sobre del fillable de Lunar).
     * slug i thumbnail_id són columnes customs afegides via migracions.
     */
    protected $fillable = [
        'attribute_data',
        'product_type_id',
        'status',
        'brand_id',
        'slug',
        'thumbnail_id',
    ];


    /**
     * Registra les conversions de mida d'imatge per al producte.
     *
     * Defineix tres conversions: thumb (150x150), medium (600x600)
     * i large (1200x1200), totes amb sharpen i execució síncrona.
     *
     * @param  \Spatie\MediaLibrary\MediaCollections\Models\Media|null  $media
     * @return void
     */
    public function registerMediaConversions(Media $media = null): void
    {
        // 'small' requerida pel panell d'administració de Lunar
        $this->addMediaConversion('small')
            ->width(300)
            ->height(300)
            ->sharpen(10)
            ->nonQueued();

        $this->addMediaConversion('thumb')
            ->width(150)
            ->height(150)
            ->sharpen(10)
            ->nonQueued();

        $this->addMediaConversion('medium')
            ->width(600)
            ->height(600)
            ->sharpen(10)
            ->nonQueued();

        $this->addMediaConversion('large')
            ->width(1200)
            ->height(1200)
            ->sharpen(10)
            ->nonQueued();
    }
}