<?php
// app/Http/Middleware/VerifyCsrfToken.php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

/**
 * Middleware de verificacio de tokens CSRF amb excepcions per a l'API.
 *
 * Esten el middleware base de Laravel per excloure totes les rutes
 * que comencin per 'api/*' de la verificacio CSRF. Les peticions
 * a l'API REST es protegeixen per altres mecanismes (Sanctum sessions)
 * i no requereixen token CSRF al cos de la peticio.
 *
 * @package App\Http\Middleware
 */
class VerifyCsrfToken extends Middleware
{
    /**
     * Patrons de rutes exclosos de la verificacio CSRF.
     *
     * Totes les rutes sota 'api/*' queden exemptes.
     *
     * @var array<int, string>
     */
    protected $except = [
        'api/*',  // Excloure rutes API de la verificació CSRF
    ];
}

