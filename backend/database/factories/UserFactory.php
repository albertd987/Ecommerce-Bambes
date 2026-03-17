<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Factory per generar instancies de User en entorn de testing i desenvolupament.
 *
 * Crea usuaris amb dades falses (Faker): nom, email unic, password
 * encriptat ('password' per defecte) i email verificat. El state
 * 'unverified' permet crear usuaris sense verificacio d'email.
 *
 * Usat exclusivament en entorn de testing i desenvolupament.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 *
 * @package Database\Factories
 */
class UserFactory extends Factory
{
    /**
     * Password actual reutilitzat entre instancies per evitar hash repetits.
     */
    protected static ?string $password;

    /**
     * Defineix l'estat per defecte del model User.
     *
     * Genera nom aleatori, email unic, email verificat (now()),
     * password encriptat (cache estatic per rendiment) i remember_token.
     *
     * @return array<string, mixed> Atributs per defecte de l'usuari.
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Aplica l'estat 'no verificat': email_verified_at = null.
     *
     * @return static Instancia de la factory amb l'estat modificat.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
