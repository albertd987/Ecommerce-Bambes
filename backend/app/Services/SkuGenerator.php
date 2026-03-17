<?php

namespace App\Services;

use Illuminate\Support\Str;
use Lunar\Models\ProductVariant;

/**
 * Genera SKUs únics automàticament per a variants de producte.
 *
 * Format sense variants: {MARCA_3}-{NOM_SLUG_15}-{NUM:001}
 * Format amb variants:   {MARCA_3}-{NOM_SLUG_15}-{TALLA}-{COLOR_3}
 */
class SkuGenerator
{
    /**
     * Genera un SKU únic per a una variant.
     *
     * @param  string       $productName  Nom del producte
     * @param  string|null  $brandName    Nom de la marca (opcional)
     * @param  string|null  $size         Valor de la talla (opcional)
     * @param  string|null  $color        Valor del color (opcional)
     * @return string SKU únic, màxim 64 caràcters
     */
    public function generate(
        string $productName,
        ?string $brandName = null,
        ?string $size = null,
        ?string $color = null
    ): string {
        $brandPrefix   = $this->brandPrefix($brandName);
        $productSlug   = $this->productSlug($productName);

        if ($size !== null || $color !== null) {
            $base = $brandPrefix . '-' . $productSlug;
            if ($size) {
                $base .= '-' . strtoupper(trim($size));
            }
            if ($color) {
                $base .= '-' . $this->colorPrefix($color);
            }
        } else {
            $base = $brandPrefix . '-' . $productSlug;
        }

        $base = substr(strtoupper($base), 0, 60);

        return $this->ensureUnique($base, $size === null && $color === null);
    }

    /**
     * Assegura que el SKU sigui únic a la base de dades.
     * Si té suffix numèric, prova 001, 002... fins trobar-ne un de lliure.
     * Si no en té, simplement comprova unicitat i afegeix -2, -3... si cal.
     */
    public function ensureUnique(string $base, bool $numericSuffix = false): string
    {
        if ($numericSuffix) {
            $candidate = substr($base, 0, 57) . '-001';
            $counter   = 1;
            while (ProductVariant::where('sku', $candidate)->withTrashed()->exists()) {
                $counter++;
                $candidate = substr($base, 0, 57) . '-' . str_pad($counter, 3, '0', STR_PAD_LEFT);
            }
            return $candidate;
        }

        $candidate = $base;
        $counter   = 1;
        while (ProductVariant::where('sku', $candidate)->withTrashed()->exists()) {
            $counter++;
            $candidate = substr($base, 0, 62) . '-' . $counter;
        }
        return $candidate;
    }

    private function brandPrefix(?string $brandName): string
    {
        if (!$brandName) {
            return 'GEN';
        }
        $clean = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $brandName));
        return str_pad(substr($clean, 0, 3), 3, 'X');
    }

    private function productSlug(string $name): string
    {
        return strtoupper(substr(str_replace('-', '', Str::slug($name)), 0, 15));
    }

    private function colorPrefix(string $color): string
    {
        $clean = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $color));
        return substr($clean, 0, 3);
    }
}
