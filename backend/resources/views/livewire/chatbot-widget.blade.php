{{--
    Vista del widget flotant del chatbot d'analisi de negoci.

    Mostra un boto circular a la cantonada inferior dreta que desplega
    una finestra de xat. Els missatges es presenten en format bombolla
    amb estil diferenciat per a l'usuari i l'assistent.

    Tots els estils son inline perque Filament no inclou totes les
    classes Tailwind al seu CSS compilat.

    Events JavaScript:
    - scroll-chat: desplaca automaticament el contenidor de missatges cap avall.
    - keydown.enter: envia el missatge en premer Enter.
--}}

<div>
    {{-- Boto flotant per obrir/tancar el xat --}}
    <button
        wire:click="toggleChat"
        style="position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 50; display: flex; height: 3.5rem; width: 3.5rem; align-items: center; justify-content: center; border-radius: 9999px; background-color: #f59e0b; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); border: none; cursor: pointer; transition: transform 0.3s;"
        onmouseover="this.style.transform='scale(1.1)'"
        onmouseout="this.style.transform='scale(1)'"
        title="{{ $isOpen ? 'Tancar xat' : 'Obrir assistent' }}"
    >
        @if($isOpen)
            {{-- Icona tancar (X) --}}
            <svg xmlns="http://www.w3.org/2000/svg" style="height: 1.5rem; width: 1.5rem; color: white;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        @else
            {{-- Icona xat --}}
            <svg xmlns="http://www.w3.org/2000/svg" style="height: 1.5rem; width: 1.5rem; color: white;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
        @endif
    </button>

    {{-- Finestra del xat --}}
    @if($isOpen)
        <div style="position: fixed; bottom: 6rem; right: 1.5rem; z-index: 50; display: flex; width: 24rem; flex-direction: column; border-radius: 0.75rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid #2a2a4a; height: 520px; background-color: #1a1a2e;">

            {{-- Capcalera del xat --}}
            <div style="display: flex; align-items: center; justify-content: space-between; border-radius: 0.75rem 0.75rem 0 0; padding: 0.75rem 1rem; background-color: #f59e0b;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" style="height: 1.25rem; width: 1.25rem; color: white;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 00-.659 1.591v1.278a1.75 1.75 0 01-1.75 1.75h-4.242a1.75 1.75 0 01-1.75-1.75v-1.278a2.25 2.25 0 00-.659-1.591L5 14.5" />
                    </svg>
                    <span style="font-weight: 600; color: white; font-size: 0.875rem;">Assistent d'Analisi</span>
                </div>
                <button
                    wire:click="clearChat"
                    style="color: rgba(255,255,255,0.8); font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem; background-color: rgba(255,255,255,0.15); border: none; cursor: pointer; transition: color 0.2s;"
                    onmouseover="this.style.color='white'"
                    onmouseout="this.style.color='rgba(255,255,255,0.8)'"
                    title="Esborrar conversacio"
                >
                    Netejar
                </button>
            </div>

            {{-- Contenidor de missatges amb scroll --}}
            <div
                id="chat-messages"
                style="flex: 1; overflow-y: auto; padding: 0.75rem 1rem; scrollbar-width: thin; scrollbar-color: #4a4a6a #1a1a2e;"
            >
                @foreach($messages as $msg)
                    <div style="display: flex; margin-bottom: 0.75rem; {{ $msg['role'] === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;' }}">
                        <div style="max-width: 80%; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.625; {{ $msg['role'] === 'user'
                            ? 'background-color: #f59e0b; color: white;'
                            : 'background-color: #2a2a4a; color: #e5e7eb;' }}"
                        >
                            {{-- Renderitzar Markdown basic per a les respostes de l'assistent --}}
                            @if($msg['role'] === 'assistant')
                                {!! $this->formatResponse($msg['content']) !!}
                            @else
                                {{ $msg['content'] }}
                            @endif
                        </div>
                    </div>
                @endforeach

                {{-- Indicador de carrega --}}
                @if($isLoading)
                    <div style="display: flex; justify-content: flex-start;">
                        <div style="border-radius: 0.5rem; padding: 0.75rem 1rem; background-color: #2a2a4a;">
                            <div style="display: flex; align-items: center; gap: 0.25rem;">
                                <div style="height: 0.5rem; width: 0.5rem; border-radius: 9999px; background-color: #f59e0b; animation: chatBounce 1s infinite; animation-delay: 0ms;"></div>
                                <div style="height: 0.5rem; width: 0.5rem; border-radius: 9999px; background-color: #f59e0b; animation: chatBounce 1s infinite; animation-delay: 150ms;"></div>
                                <div style="height: 0.5rem; width: 0.5rem; border-radius: 9999px; background-color: #f59e0b; animation: chatBounce 1s infinite; animation-delay: 300ms;"></div>
                            </div>
                        </div>
                    </div>
                @endif
            </div>

            {{-- Camp d'entrada de missatge --}}
            <div style="border-top: 1px solid #2a2a4a; padding: 0.75rem;">
                <div style="display: flex; gap: 0.5rem;">
                    <input
                        wire:model="userInput"
                        wire:keydown.enter="sendMessage"
                        type="text"
                        placeholder="Escriu la teva pregunta..."
                        style="flex: 1; border-radius: 0.5rem; border: 1px solid #3a3a5a; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #e5e7eb; background-color: #2a2a4a; outline: none;"
                        onfocus="this.style.boxShadow='0 0 0 2px #f59e0b'"
                        onblur="this.style.boxShadow='none'"
                        {{ $isLoading ? 'disabled' : '' }}
                    />
                    <button
                        wire:click="sendMessage"
                        style="border-radius: 0.5rem; padding: 0.5rem 0.75rem; color: white; background-color: #f59e0b; border: none; cursor: pointer; transition: opacity 0.2s; {{ $isLoading ? 'opacity: 0.5; pointer-events: none;' : '' }}"
                        onmouseover="this.style.opacity='0.9'"
                        onmouseout="this.style.opacity='1'"
                        {{ $isLoading ? 'disabled' : '' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" style="height: 1.25rem; width: 1.25rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    @endif

    {{-- Estils per a l'animacio de carrega i placeholder --}}
    <style>
        @keyframes chatBounce {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-0.375rem); }
        }
        /* Placeholder de l'input del xat */
        #chat-messages + div input::placeholder {
            color: #6b7280;
        }
    </style>

    {{-- Script per desplacar automaticament el xat cap avall --}}
    <script>
        document.addEventListener('livewire:initialized', () => {
            Livewire.on('scroll-chat', () => {
                setTimeout(() => {
                    const container = document.getElementById('chat-messages');
                    if (container) {
                        container.scrollTop = container.scrollHeight;
                    }
                }, 50);
            });
        });
    </script>
</div>
