<?php

namespace App\Filesystem;

use Cloudinary\Cloudinary;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\Config;
use League\Flysystem\FileAttributes;

/**
 * Adaptador de Flysystem per a Cloudinary (disc personalitzat de Laravel).
 *
 * Implementa la interficie FilesystemAdapter de League\Flysystem
 * per permetre totes les operacions estandard de fitxers (lectura,
 * escriptura, eliminacio, llistat, copia, moviment, metadades)
 * contra l'API de Cloudinary. Configurat com a disc 'cloudinary'
 * a config/filesystems.php, permet utilitzar Storage::disk('cloudinary')
 * de forma transparent.
 *
 * Tots els camins s'anteposen amb la carpeta base ($folder) configurada
 * al constructor per organitzar els fitxers dins de Cloudinary.
 *
 * @package App\Filesystem
 */
class CloudinaryAdapter implements FilesystemAdapter
{
    /** @var \Cloudinary\Cloudinary Instància del client de Cloudinary. */
    protected Cloudinary $cloudinary;

    /** @var string Carpeta base dins de Cloudinary per als fitxers. */
    protected string $folder;

    /**
     * Crea una nova instància de l'adaptador.
     *
     * @param  \Cloudinary\Cloudinary  $cloudinary  Client de Cloudinary.
     * @param  string  $folder  Carpeta base a Cloudinary (per defecte buida).
     */
    public function __construct(Cloudinary $cloudinary, string $folder = '')
    {
        $this->cloudinary = $cloudinary;
        $this->folder = $folder;
    }

    /**
     * Comprova si un fitxer existeix a Cloudinary.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return bool True si el fitxer existeix.
     */
    public function fileExists(string $path): bool
    {
        try {
            $this->cloudinary->adminApi()->asset($this->folder . '/' . $path);
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Escriu un fitxer a Cloudinary a partir del seu contingut en string.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @param  string  $contents  Contingut del fitxer.
     * @param  \League\Flysystem\Config  $config  Configuració de Flysystem.
     * @return void
     */
    public function write(string $path, string $contents, Config $config): void
    {
        $this->cloudinary->uploadApi()->upload('data://text/plain;base64,' . base64_encode($contents), [
            'public_id' => $this->folder . '/' . $path,
            'resource_type' => 'auto'
        ]);
    }

    /**
     * Escriu un fitxer a Cloudinary a partir d'un stream.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @param  resource  $contents  Stream amb el contingut del fitxer.
     * @param  \League\Flysystem\Config  $config  Configuració de Flysystem.
     * @return void
     */
    public function writeStream(string $path, $contents, Config $config): void
    {
        $tmpFile = tmpfile();
        fwrite($tmpFile, stream_get_contents($contents));
        $metaData = stream_get_meta_data($tmpFile);
        
        $this->cloudinary->uploadApi()->upload($metaData['uri'], [
            'public_id' => $this->folder . '/' . $path,
            'resource_type' => 'auto'
        ]);
        
        fclose($tmpFile);
    }

    /**
     * Llegeix el contingut d'un fitxer de Cloudinary.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return string Contingut del fitxer.
     */
    public function read(string $path): string
    {
        return file_get_contents($this->publicUrl($path));
    }

    /**
     * Llegeix un fitxer de Cloudinary com a stream.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return resource Stream de lectura del fitxer.
     */
    public function readStream(string $path)
    {
        return fopen($this->publicUrl($path), 'r');
    }

    /**
     * Elimina un fitxer de Cloudinary.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return void
     */
    public function delete(string $path): void
    {
        $this->cloudinary->uploadApi()->destroy($this->folder . '/' . $path);
    }

    /**
     * Elimina un directori de Cloudinary.
     *
     * @param  string  $path  Camí relatiu del directori.
     * @return void
     */
    public function deleteDirectory(string $path): void
    {
        $this->cloudinary->adminApi()->deleteFolder($this->folder . '/' . $path);
    }

    /**
     * Crea un directori a Cloudinary.
     *
     * @param  string  $path  Camí relatiu del directori.
     * @param  \League\Flysystem\Config  $config  Configuració de Flysystem.
     * @return void
     */
    public function createDirectory(string $path, Config $config): void
    {
        $this->cloudinary->adminApi()->createFolder($this->folder . '/' . $path);
    }

    /**
     * Estableix la visibilitat d'un fitxer.
     *
     * Cloudinary gestiona la visibilitat automàticament; aquest mètode no fa res.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @param  string  $visibility  Visibilitat desitjada.
     * @return void
     */
    public function setVisibility(string $path, string $visibility): void
    {
        // Cloudinary gestiona això automàticament
    }

    /**
     * Retorna la visibilitat d'un fitxer (sempre 'public' a Cloudinary).
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return \League\Flysystem\FileAttributes Atributs amb visibilitat 'public'.
     */
    public function visibility(string $path): FileAttributes
    {
        return new FileAttributes($path, null, 'public');
    }

    /**
     * Retorna el tipus MIME d'un fitxer a Cloudinary.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return \League\Flysystem\FileAttributes Atributs amb el format/MIME.
     */
    public function mimeType(string $path): FileAttributes
    {
        $resource = $this->cloudinary->adminApi()->asset($this->folder . '/' . $path);
        return new FileAttributes($path, null, null, null, $resource['format']);
    }

    /**
     * Retorna la data de l'última modificació d'un fitxer a Cloudinary.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return \League\Flysystem\FileAttributes Atributs amb el timestamp.
     */
    public function lastModified(string $path): FileAttributes
    {
        $resource = $this->cloudinary->adminApi()->asset($this->folder . '/' . $path);
        return new FileAttributes($path, null, null, strtotime($resource['created_at']));
    }

    /**
     * Retorna la mida en bytes d'un fitxer a Cloudinary.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return \League\Flysystem\FileAttributes Atributs amb la mida del fitxer.
     */
    public function fileSize(string $path): FileAttributes
    {
        $resource = $this->cloudinary->adminApi()->asset($this->folder . '/' . $path);
        return new FileAttributes($path, $resource['bytes']);
    }

    /**
     * Llista el contingut d'un directori a Cloudinary.
     *
     * Retorna fins a 500 recursos mitjançant un generador.
     *
     * @param  string  $path  Camí relatiu del directori.
     * @param  bool  $deep  Si s'ha de llistar recursivament.
     * @return iterable<\League\Flysystem\FileAttributes> Generador d'atributs de fitxer.
     */
    public function listContents(string $path, bool $deep): iterable
    {
        $resources = $this->cloudinary->adminApi()->assets([
            'type' => 'upload',
            'prefix' => $this->folder . '/' . $path,
            'max_results' => 500
        ]);

        foreach ($resources['resources'] as $resource) {
            yield new FileAttributes(
                str_replace($this->folder . '/', '', $resource['public_id']),
                $resource['bytes'] ?? null,
                null,
                strtotime($resource['created_at']),
                $resource['format']
            );
        }
    }

    /**
     * Mou (renomena) un fitxer dins de Cloudinary.
     *
     * @param  string  $source  Camí relatiu d'origen.
     * @param  string  $destination  Camí relatiu de destinació.
     * @param  \League\Flysystem\Config  $config  Configuració de Flysystem.
     * @return void
     */
    public function move(string $source, string $destination, Config $config): void
    {
        $this->cloudinary->uploadApi()->rename(
            $this->folder . '/' . $source,
            $this->folder . '/' . $destination
        );
    }

    /**
     * Copia un fitxer dins de Cloudinary.
     *
     * Cloudinary no suporta còpia directa; es descarrega i es torna a pujar.
     *
     * @param  string  $source  Camí relatiu d'origen.
     * @param  string  $destination  Camí relatiu de destinació.
     * @param  \League\Flysystem\Config  $config  Configuració de Flysystem.
     * @return void
     */
    public function copy(string $source, string $destination, Config $config): void
    {
        // Cloudinary no té còpia directa, cal descarregar i tornar a pujar
        $content = $this->read($source);
        $this->write($destination, $content, $config);
    }

    /**
     * Genera la URL pública d'un fitxer a Cloudinary.
     *
     * @param  string  $path  Camí relatiu del fitxer.
     * @return string URL pública del fitxer.
     */
    public function publicUrl(string $path): string
    {
        return $this->cloudinary->image($this->folder . '/' . $path)->toUrl();
    }

    /**
     * Comprova si un directori existeix a Cloudinary.
     *
     * @todo Implementar la comprovacio real consultant l'API d'administracio
     *       de Cloudinary (adminApi()->subFolders()).
     *
     * @param  string  $path  Cami relatiu del directori.
     * @return bool Sempre retorna false (pendent d'implementacio).
     */
    public function directoryExists(string $path): bool {
    }
}