# Chatbot amb UI Highlighting al Frontend

**Data:** 2026-03-29
**Estat:** Aprovat

---

## Resum

Afegir un widget de chatbot al frontend React de la botiga que, a més de respondre preguntes, pugui ressaltar elements de la interfície amb una animació de pols quan l'usuari pregunta sobre navegació, productes o filtres.

---

## Arquitectura

```
React Frontend                    Laravel Backend
──────────────────                ──────────────────────────────
ChatbotWidget.jsx    ←──REST──→  POST /api/chatbot  (nou)
  ├─ {message, history}              ├─ ChatbotService (existent)
  └─ {response, highlight?}          ├─ ChatbotTools + highlight_element()
                                     └─ retorna highlight target opcionalment
useHighlight.js
  └─ aplica pols animat a
     [data-highlight="<target>"]
```

---

## Backend

### Nou endpoint: `POST /api/chatbot`

**Ruta:** `routes/api.php`
**Controlador:** `App\Http\Controllers\Api\ChatbotController` (nou)

**Request:**
```json
{
  "message": "On és el carret?",
  "history": []
}
```

**Response:**
```json
{
  "response": "El carret el trobaràs a la cantonada superior dreta del header.",
  "history": [...],
  "highlight": "cart"
}
```

El camp `highlight` és opcional. Si Gemini no crida `highlight_element`, no s'inclou a la resposta.

**Autenticació:** Públic (sense auth). El chatbot és accessible a tots els visitants. No exposa dades sensibles.

---

### Nova eina Gemini: `highlight_element`

S'afegeix a `ChatbotTools::getToolDefinitions()`:

```php
[
    'name' => 'highlight_element',
    'description' => 'Ressalta visualment un element de la interfície de la botiga per guiar l\'usuari.',
    'parameters' => [
        'type' => 'object',
        'properties' => [
            'target' => [
                'type' => 'string',
                'enum' => [
                    'cart', 'search', 'favorites', 'user-menu',
                    'nav-products', 'nav-about',
                    'filter-size', 'filter-color', 'filter-brand',
                ],
                'description' => 'Identificador de l\'element a ressaltar. Per a productes específics, usa el format "product-{id}" amb l\'ID numèric real del producte (ex: "product-42").'
            ]
        ],
        'required' => ['target']
    ]
]
```

`ChatbotTools::execute()` gestiona la crida retornant `["highlighted" => true]` i emmagatzemant el target al servei.

---

### Canvis a `ChatbotService`

- Detecta quan Gemini crida `highlight_element` durant el function calling loop
- Desa el `target` retornat
- L'inclou a la resposta final del mètode `chat()`: `['response' => ..., 'history' => ..., 'highlight' => 'cart']`

---

## Frontend

### `ChatbotWidget.jsx` (nou component)

**Ubicació:** `src/components/ChatbotWidget.jsx`

Widget flotant a la cantonada inferior dreta de totes les pàgines (afegit a `App.jsx`).

**State:**
- `isOpen: bool` — widget obert/tancat
- `messages: [{role, content}]` — historial visible
- `history: []` — historial en format Gemini per enviar al backend
- `isLoading: bool`

**Comportament:**
- Crida `POST /api/chatbot` amb el missatge i l'historial
- Si la resposta inclou `highlight`, crida `triggerHighlight(target)`
- Mateix estil visual que el chatbot del backoffice (fons fosc, color ambre)

---

### `useHighlight.js` (nou hook)

**Ubicació:** `src/hooks/useHighlight.js`

```js
export function useHighlight() {
  const triggerHighlight = (target) => {
    const el = document.querySelector(`[data-highlight="${target}"]`)
    if (!el) return
    el.classList.add('ui-highlight-pulse')
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => el.classList.remove('ui-highlight-pulse'), 3000)
  }
  return { triggerHighlight }
}
```

**CSS a `index.css`:**
```css
@keyframes highlightPulse {
  0%   { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
  70%  { box-shadow: 0 0 0 12px rgba(251, 191, 36, 0); }
  100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
}

.ui-highlight-pulse {
  animation: highlightPulse 1s ease-out 3;
  border-radius: 6px;
  outline: 2px solid rgba(251, 191, 36, 0.8);
  outline-offset: 3px;
}
```

---

### Atributs `data-highlight` als components existents

**`Header.jsx`:**
| Atribut | Element |
|---------|---------|
| `data-highlight="cart"` | Link del carret |
| `data-highlight="search"` | Botó de cerca |
| `data-highlight="favorites"` | Link de favorits |
| `data-highlight="user-menu"` | Component `UserMenu` |
| `data-highlight="nav-products"` | Link "Productes" |
| `data-highlight="nav-about"` | Link "Nosaltres" |

**`HomePage.jsx` (filtres):**
| Atribut | Element |
|---------|---------|
| `data-highlight="filter-size"` | Selector de talla |
| `data-highlight="filter-color"` | Selector de color |
| `data-highlight="filter-brand"` | Selector de marca |

**`ProductCard.jsx`:**
| Atribut | Element |
|---------|---------|
| `data-highlight="product-{id}"` | Div arrel de cada targeta |

---

### `App.jsx`

Afegir `<ChatbotWidget />` just abans del tancament del component principal perquè aparegui a totes les pàgines.

---

## Prompt de sistema del chatbot frontend

El prompt de sistema es defineix com a constant privada a `ChatbotController` (no a `config/chatbot.php`, que és per al backoffice). Ha d'incloure:

- El chatbot és l'assistent de la botiga, respon en català/anglès segons l'usuari
- Pot guiar sobre navegació, productes, checkout, compte d'usuari
- Quan l'usuari pregunta "on és X" o "com faig Y navegant", ha de cridar `highlight_element`
- No té accés a dades de comandes ni compte (és un assistent de navegació i descoberta de productes)

---

## Errors i límits

- Si `highlight_element` s'executa però l'element no existeix al DOM (usuari en pàgina diferent): `ChatbotWidget` comprova si l'element existeix; si no, navega primer amb `react-router` a la pàgina corresponent i aplica el highlight un cop muntat el component (via `useEffect`). Si l'element no es troba després de la navegació, `triggerHighlight` no fa res (silent fail)
- Timeout de 30s a la petició; missatge d'error amigable si falla
- L'historial es perd en tancar el widget o recarregar la pàgina (comportament acceptable, igual que el backoffice)
- Rate limiting: l'endpoint hereta el throttle global de l'API (`throttle:60,1`)

---

## Fitxers afectats

**Nous:**
- `app/Http/Controllers/Api/ChatbotController.php`
- `src/components/ChatbotWidget.jsx`
- `src/hooks/useHighlight.js`

**Modificats:**
- `routes/api.php` — nova ruta
- `app/Services/ChatbotTools.php` — nova eina + gestió de `highlight_element`
- `app/Services/ChatbotService.php` — retornar `highlight` a la resposta
- `src/App.jsx` — afegir `<ChatbotWidget />`
- `src/components/Header.jsx` — atributs `data-highlight`
- `src/pages/HomePage.jsx` — atributs `data-highlight` als filtres
- `src/components/ProductCard.jsx` — atribut `data-highlight="product-{id}"`
- `src/index.css` — animació `ui-highlight-pulse`
- `config/chatbot.php` — prompt de sistema per al frontend (o constant al controlador)
