<?php

namespace App\Models;

 use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Lunar\Base\Traits\LunarUser;
use Lunar\Models\Cart;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\URL;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\UserAddress;

/**
 * Model d'usuari de l'aplicació ecommerce.
 *
 * Representa un client registrat de la botiga. L'autenticació es realitza
 * mitjançant sessions de Laravel (Sanctum cookie-based) des del frontend React.
 * Els usuaris autenticats poden realitzar comandes i consultar el seu historial.
 *
 * El password es desa encriptat amb Hash (cast 'hashed') i el camp
 * email_verified_at es converteix a datetime automàticament.
 *
 * @property int $id Identificador unic de l'usuari.
 * @property string $name Nom complet de l'usuari.
 * @property string $email Correu electronic (unic al sistema).
 * @property \Illuminate\Support\Carbon|null $email_verified_at Data de verificacio del correu.
 * @property string $password Password encriptat (ocult en serialitzacio).
 * @property string|null $remember_token Token de recordatori de sessio (ocult en serialitzacio).
 * @property \Illuminate\Support\Carbon|null $created_at Data de creacio del registre.
 * @property \Illuminate\Support\Carbon|null $updated_at Data d'ultima modificacio.

 *
 * @package App\Models
 */
class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory, Notifiable, LunarUser;

    /**
     * Atributs assignables massivament: nom, email i password.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
    ];

    /**
     * Atributs exclosos de la serialitzacio JSON: password i remember_token.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Defineix les conversions de tipus (casts) dels atributs.
     *
     * - email_verified_at: convertit a Carbon (datetime).
     * - password: encriptat automaticament amb Hash ('hashed').
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function carts()
    {
        return $this->hasMany(Cart::class, 'user_id');
    }

    public function sendEmailVerificationNotification()
{
    $frontendUrl = config('app.frontend_url', 'http://localhost:5173');

    $verifyUrl = URL::temporarySignedRoute(
        'verification.verify',
        now()->addMinutes(60),
        [
            'id' => $this->getKey(),
            'hash' => sha1($this->getEmailForVerification()),
        ]
    );

    // En lloc d'enviar el link del backend directament, l'enviem al frontend
    $spaUrl = $frontendUrl . '/verify-email?verify_url=' . urlencode($verifyUrl);

    $this->notify(new VerifyEmail($spaUrl));
}

public function favorites()
{
    return $this->hasMany(Favorite::class);
}

public function addresses(): HasMany
{
    return $this->hasMany(UserAddress::class)->orderByDesc('is_default')->orderBy('label');
}

}
