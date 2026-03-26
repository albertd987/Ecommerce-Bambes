<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Cloudinary\Cloudinary;
use Illuminate\Support\Facades\Log;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;

/**
 * Job asincron per pujar fitxers multimedia locals a Cloudinary.
 *
 * Despatxat pel MediaObserver quan es crea un registre Media associat
 * a un producte. Construeix el cami absolut del fitxer local
 * (storage/app/public/{media_id}/{file_name}), el puja a la carpeta
 * 'shoes-photos' de Cloudinary amb overwrite=false, i desa el
 * public_id resultant com a custom property 'cloudinary_public_id'
 * al model Media (amb saveQuietly per evitar disparar l'observer).
 *
 * Implementa ShouldQueue per executar-se en segon pla.
 *
 * @package App\Jobs
 */
class SyncMediaToCloudinary implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Crea una nova instancia del job amb el registre Media a sincronitzar.
     *
     * @param  \Spatie\MediaLibrary\MediaCollections\Models\Media  $media  Registre Media amb el fitxer local a pujar.
     */
    public function __construct(
        public Media $media
    ) {}

    /**
     * Puja el fitxer local a Cloudinary i desa el public_id al model Media.
     *
     * 1. Construeix el cami absolut: storage/app/public/{media_id}/{file_name}.
     * 2. Verifica que el fitxer existeixi al disc local.
     * 3. Puja el fitxer a Cloudinary (carpeta 'shoes-photos', sense sobreescriure).
     * 4. Desa el public_id retornat per Cloudinary com a custom property
     *    'cloudinary_public_id' al registre Media (saveQuietly).
     *
     * Si el fitxer no existeix o la pujada falla, registra l'error al Log
     * sense rellancar l'excepcio.
     *
     * @return void
     */
    public function handle(): void
    {
        $cloudinary = app(Cloudinary::class);

        try {
            // Construir el camí absolut manualment
            $basePath = storage_path('app/public');
            $relativePath = $this->media->id . '/' . $this->media->file_name;
            $localPath = $basePath . '/' . $relativePath;

            Log::info("Job: Constructed path: {$localPath}");

            if (!file_exists($localPath)) {
                Log::error("Job: File does not exist at: {$localPath}");
                return;
            }

            Log::info("Job: File exists! Uploading to Cloudinary...");

            // Enquadrar a quadrat i/o comprimir si cal
            $uploadPath = $localPath;
            $manager = new ImageManager(new Driver());
            $image = $manager->read($localPath);
            $w = $image->width();
            $h = $image->height();
            $needsSquare = $w !== $h;
            $needsCompress = filesize($localPath) > 8 * 1024 * 1024;

            if ($needsSquare || $needsCompress) {
                if ($needsSquare) {
                    $side = max($w, $h);
                    $image->contain($side, $side, 'ffffff');
                    Log::info("Job: Imatge enquadrada de {$w}x{$h} a {$side}x{$side}");
                }
                if ($needsCompress || $needsSquare) {
                    $image->scaleDown(width: 2500, height: 2500);
                }
                $tmpPath = sys_get_temp_dir() . '/' . $this->media->file_name;
                $image->toJpeg(80)->save($tmpPath);
                $uploadPath = $tmpPath;
                Log::info("Job: Fitxer final: " . round(filesize($tmpPath) / 1024 / 1024, 2) . " MB");
            }

            // Pujar a Cloudinary
            $result = $cloudinary->uploadApi()->upload($uploadPath, [
                'folder' => 'shoes-photos',
                'public_id' => pathinfo($this->media->file_name, PATHINFO_FILENAME),
                'overwrite' => false,
            ]);

            // Netejar fitxer temporal si s'ha creat
            if (isset($tmpPath) && file_exists($tmpPath)) {
                unlink($tmpPath);
            }

            // Desar el public_id de Cloudinary
            $this->media->setCustomProperty('cloudinary_public_id', $result['public_id']);
            $this->media->saveQuietly();

            Log::info("Job: Imatge sincronitzada a Cloudinary: {$result['public_id']}");

        } catch (\Exception $e) {
            Log::error("Job: Error en sincronitzar imatge a Cloudinary: " . $e->getMessage());
            Log::error("Job: Stack trace: " . $e->getTraceAsString());
        }
    }
}