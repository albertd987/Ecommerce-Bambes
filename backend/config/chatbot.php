<?php

/**
 * Configuracio del chatbot d'analisi de negoci.
 *
 * Defineix la clau d'API de Google Gemini, el model a utilitzar
 * i el prompt de sistema que estableix el comportament de l'assistent.
 *
 * @package Config
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Clau d'API de Google Gemini
    |--------------------------------------------------------------------------
    |
    | Token d'autenticacio per accedir a l'API de Google Gemini.
    | Es llegeix de la variable d'entorn GEMINI_API_KEY.
    |
    */
    'api_key' => env('GEMINI_API_KEY', ''),

    /*
    |--------------------------------------------------------------------------
    | Model de Gemini
    |--------------------------------------------------------------------------
    |
    | Identificador del model de Gemini a utilitzar per generar respostes.
    | El model Flash ofereix un bon equilibri entre qualitat i velocitat
    | dins del tier gratuit.
    |
    */
    'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),

    /*
    |--------------------------------------------------------------------------
    | Prompt de sistema
    |--------------------------------------------------------------------------
    |
    | Instruccions que defineixen el comportament de l'assistent.
    | L'assistent actua com a analista de dades del negoci i respon
    | en el mateix idioma que l'usuari.
    |
    */
    'system_prompt' => "Ets un assistent d'analisi de negoci per a una botiga en linia de sabatilles esportives. "
        . "Tens acces a dades reals de la botiga: productes, comandes, clients i inventari. "
        . "Respon sempre en el mateix idioma que l'usuari. "
        . "Sigues concis i directe. Utilitza llistes i format clar quan presentis dades. "
        . "Si no tens prou dades per respondre una pregunta, indica-ho honestament.",
];
