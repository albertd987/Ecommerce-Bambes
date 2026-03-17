<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Lunar\Facades\CartSession;
use Lunar\Models\Currency;

/**
 * Middleware que assigna la moneda per defecte a la sessio del carret de Lunar.
 *
 * S'executa en cada peticio HTTP per garantir que CartSession
 * tingui la moneda EUR (o la marcada com a default a la BD)
 * configurada abans de qualsevol operacio de carret.
 * El channel es configura automaticament per Lunar.
 *
 * @package App\Http\Middleware
 */
class SetLunarDefaults
{
    /**
     * Intercepta la peticio HTTP per assignar la moneda per defecte al carret.
     *
     * Consulta la taula lunar_currencies per trobar la moneda marcada
     * com a default i l'assigna a CartSession. Si no es troba cap
     * moneda per defecte, la peticio continua sense configuracio.
     *
     * @param  \Illuminate\Http\Request  $request  La peticio HTTP entrant.
     * @param  \Closure  $next  El seguent middleware o controlador de la cadena.
     * @return mixed Resposta HTTP del seguent middleware.
     */
    public function handle(Request $request, Closure $next)
    {
        //Només configurar moneda (el channel es manega automàticament)
        $currency = Currency::where('default', true)->first();
        if ($currency) {
            CartSession::setCurrency($currency);
        }

        return $next($request);
    }
}