<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Lunar\Models\ProductVariant;

class StockMovement extends Model
{
    const UPDATED_AT = null;

    protected $fillable = [
        'product_variant_id',
        'quantity',
        'type',
        'reference',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'created_at' => 'datetime',
    ];

    public const TYPE_SALE = 'sale';
    public const TYPE_CANCELLATION = 'cancellation';
    public const TYPE_RETURN = 'return';
    public const TYPE_ADJUSTMENT = 'adjustment';
    public const TYPE_RECEPTION = 'reception';
    public const TYPE_INITIAL = 'initial';

    public const TYPES = [
        self::TYPE_SALE,
        self::TYPE_CANCELLATION,
        self::TYPE_RETURN,
        self::TYPE_ADJUSTMENT,
        self::TYPE_RECEPTION,
        self::TYPE_INITIAL,
    ];

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
