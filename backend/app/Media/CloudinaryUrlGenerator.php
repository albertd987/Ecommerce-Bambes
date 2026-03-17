<?php

namespace App\Media;

use Cloudinary\Cloudinary;
use Spatie\MediaLibrary\Support\UrlGenerator\BaseUrlGenerator;

/**
 * Generador d'URLs de Cloudinary per a Spatie Media Library.
 *
 * Sobreescriu el generador d'URLs per defecte de Spatie perque
 * totes les URLs de fitxers multimedia apuntin a Cloudinary.
 *
 * Estrategia de resolucio d'URL:
 * 1. Si el registre Media te la custom property 'cloudinary_public_id'
 *    (assignada pel job SyncMediaToCloudinary), genera la URL directament.
 * 2. Si no (fallback), construeix el public_id a partir del cami relatiu
 *    local del fitxer (eliminant l'extensio).
 *
 * Configurat a config/media-library.php com a url_generator per defecte.
 *
 * @package App\Media
 */
class CloudinaryUrlGenerator extends BaseUrlGenerator
{
    /** @var \Cloudinary\Cloudinary Instància del client de Cloudinary. */
    protected Cloudinary $cloudinary;

    /**
     * Crea una nova instància del generador d'URLs.
     *
     * Resol la instància de Cloudinary des del contenidor de serveis.
     */
    public function __construct()
    {
        $this->cloudinary = app(Cloudinary::class);
    }

    /**
     * Genera la URL pública del fitxer multimèdia a Cloudinary.
     *
     * Prioritza el public_id desat al model; si no existeix,
     * genera la URL a partir del camí relatiu local.
     *
     * @return string URL pública de Cloudinary.
     */
    public function getUrl(): string
    {
        // Si té el public_id de Cloudinary desat, usar-lo
        $cloudinaryPublicId = $this->media->getCustomProperty('cloudinary_public_id');
        
        if ($cloudinaryPublicId) {
            return $this->cloudinary->image($cloudinaryPublicId)->toUrl();
        }

        // Si no, generar des del path local (fallback)
        $path = $this->getPathRelativeToRoot();
        
        // Eliminar extensió per al public_id
        $publicId = pathinfo($path, PATHINFO_DIRNAME) . '/' . pathinfo($path, PATHINFO_FILENAME);
        $publicId = ltrim($publicId, '/');
        
        return $this->cloudinary->image($publicId)->toUrl();
    }

    /**
     * Genera una URL temporal per al fitxer multimèdia.
     *
     * Cloudinary no requereix URLs temporals; retorna la URL normal.
     *
     * @param  \DateTimeInterface  $expiration  Data d'expiració (no utilitzada).
     * @param  array  $options  Opcions addicionals (no utilitzades).
     * @return string URL pública de Cloudinary.
     */
    public function getTemporaryUrl(\DateTimeInterface $expiration, array $options = []): string
    {
        // Cloudinary no necessita URLs temporals, retornar la URL normal
        return $this->getUrl();
    }

    /**
     * Retorna la URL del directori d'imatges responsives a Cloudinary.
     *
     * @return string URL del directori pare de la imatge.
     */
    public function getResponsiveImagesDirectoryUrl(): string
    {
        $path = $this->getPathRelativeToRoot();
        return dirname($this->cloudinary->image($path)->toUrl());
    }

    /**
     * Retorna el camí relatiu del fitxer multimèdia.
     *
     * @return string Camí relatiu respecte a l'arrel de l'emmagatzematge.
     */
    public function getPath(): string
    {
        return $this->getPathRelativeToRoot();
    }
}