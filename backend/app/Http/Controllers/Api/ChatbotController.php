<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ChatbotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Controlador del chatbot de la botiga (frontend públic).
 *
 * Gestiona les converses dels usuaris de la botiga amb l'assistent virtual.
 * A diferència del chatbot del backoffice, aquest assistent ajuda amb la
 * navegació de la botiga, productes, checkout i compte d'usuari.
 */
class ChatbotController extends Controller
{
    /**
     * Prompt de sistema per a l'assistent de la botiga.
     *
     * No utilitza config/chatbot.php (reservat per al backoffice).
     */
    private const SYSTEM_PROMPT = <<<'PROMPT'
Ets l'assistent virtual d'una botiga de bambes (zapatillas de running). Ajudes els clients a navegar per la botiga, trobar productes, completar la compra i gestionar el seu compte.

Respon en català si l'usuari escriu en català, en castellà si escriu en castellà, i en anglès si escriu en anglès o en qualsevol altre idioma.

Pots ajudar amb:
- Navegació per la botiga (menú, filtres, pàgines)
- Informació sobre productes (bambes de running)
- Procés de compra i checkout
- Compte d'usuari (registre, inici de sessió, perfil, comandes, adreces)
- Favorits i carret de la compra

Quan l'usuari pregunti on es troba un element de la interfície o com hi pot navegar (per exemple: "on és el carret?", "com busco productes?", "on veig els meus favorits?"), crida la funció highlight_element amb el target corresponent per ressaltar visualment aquell element.

Elements disponibles per ressaltar:
- cart: icona del carret de la compra
- search: barra de cerca
- favorites: icona de favorits
- user-menu: menú d'usuari (login/perfil)
- nav-products: enllaç de navegació a productes
- nav-about: enllaç de navegació a "sobre nosaltres"
- filter-size: filtre de talla
- filter-color: filtre de color
- filter-brand: filtre de marca

NO tens accés a dades de comandes concretes ni a informació privada del compte de l'usuari.
PROMPT;

    /**
     * Processa un missatge del chatbot de la botiga.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'history' => ['nullable', 'array', 'max:50'],
            'history.*.role' => ['required', 'string', 'in:user,model'],
            'history.*.parts' => ['required', 'array', 'min:1', 'max:10'],
            'history.*.parts.*.text' => ['nullable', 'string', 'max:4000'],
        ]);

        // Defence in depth: strip any keys other than role + parts[*].text so
        // forged functionCall/functionResponse parts never reach Gemini.
        $history = collect($validated['history'] ?? [])->map(function ($turn) {
            return [
                'role' => $turn['role'],
                'parts' => collect($turn['parts'])
                    ->filter(fn ($part) => isset($part['text']) && is_string($part['text']))
                    ->map(fn ($part) => ['text' => $part['text']])
                    ->values()
                    ->all(),
            ];
        })->filter(fn ($turn) => !empty($turn['parts']))->values()->all();

        try {
            $service = new ChatbotService(
                systemPrompt: self::SYSTEM_PROMPT,
                allowedTools: ['highlight_element'],
            );
            $result = $service->chat(
                $validated['message'],
                $history
            );

            return response()->json([
                'response'  => $result['response'],
                'history'   => $result['history'],
                'highlight' => $result['highlight'] ?? null,
            ]);
        } catch (\Throwable $e) {
            Log::error('Chatbot endpoint error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'error' => 'Error intern del servidor',
            ], 500);
        }
    }
}
