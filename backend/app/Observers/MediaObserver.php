<?php

namespace App\Observers;

use App\Models\ProductColor;
use App\Jobs\SyncMediaToCloudinary;
use Illuminate\Support\Facades\Log;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Observer del model Media de Spatie Media Library.
 *
 * Escolta els esdeveniments 'created' i 'deleted' del model Media.
 * Quan es crea un registre Media associat a un producte (model_type = 'product')
 * dins la col·leccio 'images', despatxa el job SyncMediaToCloudinary amb un
 * retard de 2 segons per pujar la imatge a Cloudinary de forma asincrona.
 *
 * @package App\Observers
 */
class MediaObserver
{
    /**
     * Reacciona a la creacio d'un registre Media.
     *
     * Comprova que el registre pertanyi a un producte (model_type === 'product')
     * i a la col·leccio 'images'. Si es compleix, despatxa el job
     * SyncMediaToCloudinary amb un retard de 2 segons perque el fitxer
     * local estigui completament escrit al disc abans de la pujada.
     *
     * @param  \Spatie\MediaLibrary\MediaCollections\Models\Media  $media  El registre Media acabat de crear.
     * @return void
     */
    public function created(Media $media): void
    {
        Log::info("MediaObserver: model_type = {$media->model_type}, collection = {$media->collection_name}");

        $isProduct      = strtolower($media->model_type) === 'product';
        $isProductColor = $media->model_type === ProductColor::class;

        if (! ($isProduct || $isProductColor) || $media->collection_name !== 'images') {
            return;
        }

        // Despatxar el job perquè s'executi després
        SyncMediaToCloudinary::dispatch($media)->delay(now()->addSeconds(2));

        Log::info("Job despatxat per pujar a Cloudinary");
    }

    /**
     * Reacciona a l'eliminacio d'un registre Media.
     *
     * @todo Implementar l'eliminacio del fitxer corresponent a Cloudinary
     *       consultant el custom property 'cloudinary_public_id' del registre.
     *
     * @param  \Spatie\MediaLibrary\MediaCollections\Models\Media  $media  El registre Media eliminat.
     * @return void
     */
    public function deleted(Media $media): void
    {
        // ... (mantenir igual)
    }
}