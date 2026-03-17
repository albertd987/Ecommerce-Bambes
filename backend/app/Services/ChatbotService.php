<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Servei d'orquestracio del chatbot amb Google Gemini.
 *
 * Gestiona el flux de conversacio entre l'usuari i el model Gemini:
 * 1. Rep el missatge de l'usuari i l'historial de conversacio.
 * 2. Envia la peticio a l'API de Gemini amb les eines (function calling) definides.
 * 3. Si Gemini demana executar una eina, la executa via ChatbotTools i retorna el resultat.
 * 4. Repeteix fins que Gemini genera una resposta de text final.
 *
 * Utilitza el tier gratuit de Gemini (gemini-2.0-flash) amb function calling natiu.
 *
 * @package App\Services
 */
class ChatbotService
{
    /**
     * URL base de l'API de Google Gemini per generar contingut.
     */
    private const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

    /**
     * Nombre maxim d'iteracions de function calling per evitar bucles infinits.
     * Cada iteracio correspon a una crida d'eina seguida d'una nova peticio a Gemini.
     */
    private const MAX_TOOL_ITERATIONS = 5;

    /**
     * Clau d'API de Gemini.
     */
    private string $apiKey;

    /**
     * Identificador del model de Gemini a utilitzar.
     */
    private string $model;

    /**
     * Prompt de sistema que defineix el comportament de l'assistent.
     */
    private string $systemPrompt;

    /**
     * Inicialitza el servei amb la configuracio del fitxer config/chatbot.php.
     *
     * @return void
     */
    public function __construct()
    {
        $this->apiKey = config('chatbot.api_key');
        $this->model = config('chatbot.model');
        $this->systemPrompt = config('chatbot.system_prompt');
    }

    /**
     * Envia un missatge al chatbot i retorna la resposta.
     *
     * Gestiona tot el flux de conversacio incloent multiples crides
     * d'eines si Gemini ho requereix. L'historial de conversacio es
     * manté per preservar el context entre missatges.
     *
     * @param  string  $message   Missatge de l'usuari.
     * @param  array   $history   Historial de conversacio previa (format Gemini).
     * @return array  Array amb 'response' (text) i 'history' (historial actualitzat).
     */
    public function chat(string $message, array $history = []): array
    {
        $history[] = [
            'role' => 'user',
            'parts' => [['text' => $message]],
        ];

        $iterations = 0;

        while ($iterations < self::MAX_TOOL_ITERATIONS) {
            $iterations++;

            $response = $this->callGemini($history);

            if (isset($response['error'])) {
                Log::error('Gemini API error', ['error' => $response['error']]);
                return [
                    'response' => $this->formatApiError($response['error']),
                    'history' => $history,
                ];
            }

            $candidate = $response['candidates'][0] ?? null;

            if (!$candidate) {
                return [
                    'response' => "No he pogut generar una resposta. Torna-ho a intentar.",
                    'history' => $history,
                ];
            }

            $parts = $candidate['content']['parts'] ?? [];

            // Comprovar si Gemini vol cridar una eina
            $functionCall = $this->extractFunctionCall($parts);

            if ($functionCall) {
                // Afegir la resposta del model a l'historial
                $history[] = [
                    'role' => 'model',
                    'parts' => $parts,
                ];

                // Executar l'eina i afegir el resultat a l'historial
                $toolResult = ChatbotTools::execute(
                    $functionCall['name'],
                    $functionCall['args'] ?? []
                );

                $history[] = [
                    'role' => 'user',
                    'parts' => [[
                        'functionResponse' => [
                            'name' => $functionCall['name'],
                            'response' => [
                                'content' => json_decode($toolResult, true),
                            ],
                        ],
                    ]],
                ];

                // Continuar el bucle per a què Gemini processi el resultat
                continue;
            }

            // Gemini ha generat una resposta de text final
            $textResponse = $this->extractTextResponse($parts);

            $history[] = [
                'role' => 'model',
                'parts' => [['text' => $textResponse]],
            ];

            return [
                'response' => $textResponse,
                'history' => $history,
            ];
        }

        return [
            'response' => "He hagut de limitar les consultes per evitar un bucle. Pots reformular la pregunta?",
            'history' => $history,
        ];
    }

    /**
     * Realitza la peticio HTTP a l'API de Gemini.
     *
     * Construeix el payload amb l'historial de conversacio, les eines
     * disponibles i el prompt de sistema, i envia la peticio POST.
     *
     * @param  array  $history  Historial de conversacio en format Gemini.
     * @return array Resposta descodificada de l'API.
     */
    private function callGemini(array $history): array
    {
        $url = self::API_BASE . "/{$this->model}:generateContent?key={$this->apiKey}";

        $tools = $this->formatToolsForGemini();

        $payload = [
            'contents' => $history,
            'tools' => $tools,
            'system_instruction' => [
                'parts' => [['text' => $this->systemPrompt]],
            ],
        ];

        $response = Http::timeout(30)
            ->post($url, $payload);

        return $response->json() ?? ['error' => ['message' => 'Resposta buida de Gemini']];
    }

    /**
     * Formata les definicions d'eines al format esperat per l'API de Gemini.
     *
     * Gemini espera les eines dins d'un array amb clau 'function_declarations'.
     *
     * @return array Eines en format Gemini.
     */
    private function formatToolsForGemini(): array
    {
        $definitions = ChatbotTools::getToolDefinitions();

        return [
            [
                'function_declarations' => $definitions,
            ],
        ];
    }

    /**
     * Extreu una crida a funcio de les parts de la resposta de Gemini.
     *
     * Gemini retorna les crides a funcio com a objectes 'functionCall'
     * dins de les parts de la resposta del candidat.
     *
     * @param  array  $parts  Parts de la resposta del candidat.
     * @return array|null  Array amb 'name' i 'args' o null si no hi ha crida.
     */
    private function extractFunctionCall(array $parts): ?array
    {
        foreach ($parts as $part) {
            if (isset($part['functionCall'])) {
                return [
                    'name' => $part['functionCall']['name'],
                    'args' => $part['functionCall']['args'] ?? [],
                ];
            }
        }

        return null;
    }

    /**
     * Extreu el text de resposta de les parts del candidat.
     *
     * Concatena tots els fragments de text de les parts de la resposta.
     *
     * @param  array  $parts  Parts de la resposta del candidat.
     * @return string Text de resposta complet.
     */
    private function extractTextResponse(array $parts): string
    {
        $text = '';

        foreach ($parts as $part) {
            if (isset($part['text'])) {
                $text .= $part['text'];
            }
        }

        return $text ?: "No he pogut generar una resposta.";
    }

    /**
     * Formata un error de l'API en un missatge comprensible per l'usuari.
     *
     * @param  array  $error  Detall de l'error retornat per Gemini.
     * @return string Missatge d'error per mostrar a l'usuari.
     */
    private function formatApiError(array $error): string
    {
        $message = $error['message'] ?? 'Error desconegut';
        $code = $error['code'] ?? '';

        Log::warning('Chatbot Gemini error', ['code' => $code, 'message' => $message]);

        if ($code === 429) {
            return "S'ha excedit la quota de l'API de Gemini. Espera uns minuts i torna-ho a intentar.";
        }

        if ($code === 403) {
            return "La clau d'API de Gemini no te permisos. Revisa la configuracio a Google AI Studio.";
        }

        if ($code === 400) {
            return "Peticio incorrecta a l'API de Gemini. Contacta l'administrador.";
        }

        return "Hi ha hagut un error comunicant amb el servei d'IA (codi: {$code}). Torna-ho a intentar en uns moments.";
    }
}
