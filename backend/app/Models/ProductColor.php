<?php
namespace App\Models;

use App\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class ProductColor extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $fillable = ['product_id', 'name', 'sizes', 'sort_order'];

    protected $casts = [
        'sizes' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('images')
             ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
             ->width(300)
             ->height(300)
             ->nonQueued();
    }

    /** Returns full URLs for all images in this color. */
    public function getImageUrlsAttribute(): array
    {
        return $this->getMedia('images')
                    ->map(fn($m) => $m->getUrl())
                    ->toArray();
    }
}
