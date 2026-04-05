import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import api from '../services/api'
import { useHighlight } from '../hooks/useHighlight'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hola! Soc l'assistent de la botiga. Puc ajudar-te a trobar productes o navegar per la web. En què et puc ajudar?",
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const { triggerHighlight } = useHighlight()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, messages])

  const handleOpen = () => {
    setIsOpen(true)
    if (!hasOpened) {
      setHasOpened(true)
      setMessages([WELCOME_MESSAGE])
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const { data } = await api.post('/chatbot', { message: text, history }, {
        timeout: 30000,
      })

      const assistantMessage = { role: 'assistant', content: data.response }
      setMessages((prev) => [...prev, assistantMessage])
      setHistory(data.history || [])

      if (data.highlight) {
        triggerHighlight(data.highlight)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Hi ha hagut un error. Torna-ho a intentar.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gray-900 border-2 border-amber-500 text-amber-400 shadow-lg hover:bg-gray-800 hover:scale-105 transition-all duration-200 flex items-center justify-center"
          aria-label="Obre l'assistent"
        >
          <MessageCircle size={26} />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col bg-gray-900 border border-amber-500/40 rounded-2xl shadow-2xl w-[90vw] max-w-[380px] h-[500px] sm:w-[380px] sm:h-[500px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/30 bg-gray-900 shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-amber-400" />
              <span className="text-amber-400 font-semibold text-sm tracking-wide">Assistent</span>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-amber-400 transition-colors p-1 rounded"
              aria-label="Tanca l'assistent"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-gray-900 rounded-br-sm'
                      : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-2 text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Pensant...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-amber-500/30 bg-gray-900 shrink-0">
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-amber-500/60 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escriu un missatge..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-500 outline-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="text-amber-400 hover:text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1 shrink-0"
                aria-label="Envia missatge"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
