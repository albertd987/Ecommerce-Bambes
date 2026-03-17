<?php

namespace App\Livewire;

use App\Services\ChatbotService;
use Livewire\Component;

/**
 * Component Livewire per al widget flotant del chatbot.
 *
 * Gestiona l'estat de la interficie del chatbot: obrir/tancar la finestra,
 * enviar missatges, mostrar respostes i mantenir l'historial de conversacio
 * dins de la sessio de l'usuari.
 *
 * Es renderitza com un boto flotant a la cantonada inferior dreta del panell
 * d'administracio i desplega una finestra de xat al fer clic.
 *
 * @package App\Livewire
 */
class ChatbotWidget extends Component
{
    /**
     * Indica si la finestra del xat esta oberta o tancada.
     */
    public bool $isOpen = false;

    /**
     * Indica si s'esta processant una peticio al model d'IA.
     */
    public bool $isLoading = false;

    /**
     * Text que l'usuari esta escrivint al camp d'entrada.
     */
    public string $userInput = '';

    /**
     * Llista de missatges de la conversacio.
     * Cada missatge te les claus 'role' ('user' o 'assistant') i 'content' (text).
     */
    public array $messages = [];

    /**
     * Historial de conversacio en format Gemini per mantenir el context.
     * Es passa al ChatbotService a cada peticio.
     */
    public array $conversationHistory = [];

    /**
     * Obre o tanca la finestra del xat.
     *
     * Quan s'obre per primera vegada i no hi ha missatges,
     * mostra un missatge de benvinguda de l'assistent.
     *
     * @return void
     */
    public function toggleChat(): void
    {
        $this->isOpen = !$this->isOpen;

        if ($this->isOpen && empty($this->messages)) {
            $this->messages[] = [
                'role' => 'assistant',
                'content' => "Hola! Soc l'assistent d'analisi de la teva botiga. "
                    . "Pots preguntar-me sobre vendes, productes, comandes, estoc i mes. "
                    . "En que et puc ajudar?",
            ];
        }
    }

    /**
     * Envia el missatge de l'usuari al servei del chatbot i processa la resposta.
     *
     * Valida que el missatge no estigui buit, l'afegeix a la llista de missatges,
     * crida al ChatbotService per obtenir la resposta de Gemini i actualitza
     * tant els missatges visibles com l'historial intern de conversacio.
     *
     * @return void
     */
    public function sendMessage(): void
    {
        $message = trim($this->userInput);

        if (empty($message)) {
            return;
        }

        // Afegir el missatge de l'usuari a la llista visible
        $this->messages[] = [
            'role' => 'user',
            'content' => $message,
        ];

        $this->userInput = '';
        $this->isLoading = true;

        try {
            $service = new ChatbotService();

            $result = $service->chat($message, $this->conversationHistory);

            $this->messages[] = [
                'role' => 'assistant',
                'content' => $result['response'],
            ];

            // Actualitzar l'historial de conversacio per mantenir el context
            $this->conversationHistory = $result['history'];
        } catch (\Exception $e) {
            $this->messages[] = [
                'role' => 'assistant',
                'content' => "Hi ha hagut un error processant la teva pregunta. Torna-ho a intentar.",
            ];
        }

        $this->isLoading = false;

        // Desplacar el xat cap avall per mostrar el nou missatge
        $this->dispatch('scroll-chat');
    }

    /**
     * Esborra tot l'historial de conversacio i reinicia el xat.
     *
     * @return void
     */
    public function clearChat(): void
    {
        $this->messages = [];
        $this->conversationHistory = [];

        $this->messages[] = [
            'role' => 'assistant',
            'content' => "Conversacio esborrada. En que et puc ajudar?",
        ];
    }

    /**
     * Formata la resposta de l'assistent convertint Markdown basic a HTML.
     *
     * Transforma negreta (**text**), llistes (- item, * item, numeriques),
     * salts de linia i blocs de codi en HTML segur per mostrar al xat.
     *
     * @param  string  $text  Text en format Markdown basic.
     * @return string HTML formatat i sanititzat.
     */
    public function formatResponse(string $text): string
    {
        $text = e($text);

        // Negreta: **text** -> <strong>text</strong>
        $text = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $text);

        // Codi inline: `text` -> <code>text</code>
        $text = preg_replace('/`(.+?)`/', '<code class="px-1 rounded" style="background-color: #3a3a5a;">$1</code>', $text);

        // Convertir linies en array per processar llistes
        $lines = explode("\n", $text);
        $html = '';
        $inList = false;
        $listType = null;

        foreach ($lines as $line) {
            $trimmed = trim($line);

            // Detectar elements de llista no ordenada (- o *)
            if (preg_match('/^[\-\*]\s+(.+)$/', $trimmed, $matches)) {
                if (!$inList || $listType !== 'ul') {
                    if ($inList) $html .= "</{$listType}>";
                    $html .= '<ul class="list-disc pl-4 my-1">';
                    $inList = true;
                    $listType = 'ul';
                }
                $html .= '<li>' . $matches[1] . '</li>';
                continue;
            }

            // Detectar elements de llista ordenada (1. 2. etc.)
            if (preg_match('/^\d+[\.\)]\s+(.+)$/', $trimmed, $matches)) {
                if (!$inList || $listType !== 'ol') {
                    if ($inList) $html .= "</{$listType}>";
                    $html .= '<ol class="list-decimal pl-4 my-1">';
                    $inList = true;
                    $listType = 'ol';
                }
                $html .= '<li>' . $matches[1] . '</li>';
                continue;
            }

            // Si no es llista, tancar llista oberta
            if ($inList) {
                $html .= "</{$listType}>";
                $inList = false;
                $listType = null;
            }

            // Linia buida -> salt de paragraf
            if (empty($trimmed)) {
                $html .= '<br>';
            } else {
                $html .= '<p class="my-0.5">' . $trimmed . '</p>';
            }
        }

        // Tancar llista pendent
        if ($inList) {
            $html .= "</{$listType}>";
        }

        return $html;
    }

    /**
     * Renderitza la vista del component.
     *
     * @return \Illuminate\Contracts\View\View
     */
    public function render()
    {
        return view('livewire.chatbot-widget');
    }
}
