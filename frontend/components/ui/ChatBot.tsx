'use client'

import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Which route emits the most CO₂?',
  'What\'s the spoilage risk today?',
  'Which market has highest unmet demand?',
  'Should I reroute any batches?',
]

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="11" />
      <line x1="8" y1="15" x2="8" y2="15" strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="15" x2="16" y2="15" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { state, optimizeResult } = useStore()

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, open])

  async function send(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || loading) return

    setInput('')
    setError(null)
    const newMessages: Message[] = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: { state, optimizeResult },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'API error')

      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105"
        style={{
          background: open ? 'var(--surface-2)' : 'var(--accent)',
          border: '1px solid var(--border-2)',
          color: open ? 'var(--text-2)' : '#000',
        }}
        title="Verdex Assistant"
      >
        {open ? <CloseIcon /> : <BotIcon />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-80 flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{
            height: '480px',
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <BotIcon />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Verdex Assistant</div>
              <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                {state ? 'Network data loaded' : 'Loading network…'}
              </div>
            </div>
            <div
              className="ml-auto w-2 h-2 rounded-full"
              style={{ background: state ? 'var(--accent)' : 'var(--text-3)' }}
            />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {isEmpty && (
              <div className="space-y-3">
                <p className="text-xs text-center px-2" style={{ color: 'var(--text-3)' }}>
                  Ask me anything about your supply chain — routes, emissions, spoilage risk, weather, or optimizations.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors duration-100"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-2)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                  style={
                    m.role === 'user'
                      ? { background: 'var(--accent)', color: '#000', borderRadius: '12px 12px 2px 12px' }
                      : { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 2px' }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
                >
                  <span className="animate-pulse">Thinking…</span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-[10px] text-center px-2" style={{ color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="px-3 py-2.5 border-t flex items-center gap-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about routes, CO₂, spoilage…"
              disabled={loading}
              className="flex-1 text-xs bg-transparent outline-none placeholder:opacity-40 disabled:opacity-50"
              style={{ color: 'var(--text)' }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity duration-150 disabled:opacity-30"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
