import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMila } from '../context/MilaContext';
import { buildCorpus, retrieveRelevant, buildContext, sendChatMessage } from '../utils/ragService';

const HISTORY_KEY = 'mila_chat_history';
const MAX_HISTORY = 40; // messages to keep in localStorage

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {}
}

export default function ChatPanel({ open, onClose }) {
  const { summaries } = useMila();
  const [messages, setMessages] = useState(() => loadHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const msgRefs = useRef({});
  const corpusRef = useRef(null);

  // Rebuild corpus whenever summaries change
  useEffect(() => {
    corpusRef.current = buildCorpus(summaries);
  }, [summaries]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 350);
  }, [open]);

  const sendMessage = useCallback(async (text) => {
    const query = text.trim();
    if (!query || loading) return;

    setInput('');
    setError('');

    const userMsg = { role: 'user', content: query, id: Date.now(), timestamp: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const corpus = corpusRef.current || [];
      const relevant = retrieveRelevant(corpus, query, 10);
      const context = buildContext(relevant);

      // Only pass assistant/user pairs (no source metadata) to history
      const historyForApi = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const answer = await sendChatMessage(query, context, historyForApi);

      const sources = [...new Set(relevant.map(c =>
        c.nodeLabel ? `${c.summaryTitle} → ${c.nodeLabel}` : c.summaryTitle
      ))].slice(0, 4);

      const assistantMsg = { role: 'assistant', content: answer, sources, id: Date.now() + 1 };
      const updated = [...nextMessages, assistantMsg];
      setMessages(updated);
      saveHistory(updated);
    } catch (e) {
      setError(e.name === 'AbortError' ? 'Tiempo de espera agotado. Intentá de nuevo.' : `Error: ${e.message}`);
      // Remove the user message if request failed
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  const corpusSize = (corpusRef.current || []).length;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel — slides from right */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(420px, 100vw)',
        zIndex: 301,
        background: 'var(--ghost-white)',
        borderLeft: '1px solid var(--soft-grey)',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.15)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--soft-grey)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChatIcon size={18} color="var(--driftwood)" />
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dark)', margin: 0 }}>
                MILA Chat
              </h2>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-light)', margin: '2px 0 0 26px' }}>
              {summaries.length > 0
                ? `${corpusSize} fragmentos de ${summaries.length} resumen${summaries.length > 1 ? 'es' : ''}`
                : 'Sin resúmenes cargados'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {messages.some(m => m.role === 'user') && (
              <button
                onClick={() => setHistoryOpen(true)}
                title="Historial de preguntas"
                style={{ width: 30, height: 30, borderRadius: 8, background: historyOpen ? 'var(--soft-grey)' : 'transparent', border: '1px solid var(--soft-grey)', color: 'var(--text-mid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >
                <HistoryIcon />
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                title="Limpiar conversación"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: '1px solid var(--soft-grey)', color: 'var(--text-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <TrashIcon />
              </button>
            )}
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-dark)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300, cursor: 'pointer' }}
            >×</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 12, WebkitOverflowScrolling: 'touch' }}>

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
              <ChatIcon size={36} color="var(--driftwood)" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dark)', margin: '16px 0 8px' }}>
                Tu tutor personal
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.6, marginBottom: 24 }}>
                Preguntame sobre cualquier tema de tus resúmenes. Solo uso tu material de estudio.
              </p>
              {summaries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {[
                    '¿Qué temas cubre mi material de estudio?',
                    '¿Cuáles son los conceptos más importantes?',
                    'Relacioná los conceptos entre mis resúmenes',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      style={{
                        padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                        background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)',
                        color: 'var(--text-mid)', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--driftwood)'; e.currentTarget.style.color = 'var(--text-dark)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--whisper-grey)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map(msg => (
            <div key={msg.id} ref={el => { if (el) msgRefs.current[msg.id] = el; }}>
              <MessageBubble message={msg} />
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '12px 14px', borderRadius: 14, background: 'var(--pale-mist)', alignSelf: 'flex-start', maxWidth: '80%' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--driftwood)', animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
              <style>{`@keyframes dotPulse { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', color: '#c0392b', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--soft-grey)', flexShrink: 0 }}>
          {summaries.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'center', marginBottom: 10 }}>
              Cargá un resumen primero para activar el chat.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={summaries.length === 0 ? 'Sin resúmenes...' : 'Preguntá sobre tu material...'}
              disabled={summaries.length === 0 || loading}
              rows={1}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1.5px solid var(--soft-grey)',
                background: 'var(--pale-mist)',
                color: 'var(--text-dark)',
                fontSize: 14,
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
                transition: 'border-color 0.2s',
                minHeight: 42,
                maxHeight: 120,
                overflow: 'auto',
                fontFamily: 'inherit',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--driftwood)'}
              onBlur={e => e.target.style.borderColor = 'var(--soft-grey)'}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading || summaries.length === 0}
              style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: (!input.trim() || loading || summaries.length === 0)
                  ? 'var(--soft-grey)'
                  : 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
                border: 'none', cursor: (!input.trim() || loading) ? 'default' : 'pointer',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              <SendIcon />
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 6, textAlign: 'center' }}>
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>

        {/* History overlay — slides in over the chat */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--ghost-white)',
          transform: historyOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column', zIndex: 10,
        }}>
          {/* History header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-grey)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HistoryIcon color="var(--driftwood)" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)', margin: 0 }}>Historial de preguntas</h2>
            </div>
            <button
              onClick={() => setHistoryOpen(false)}
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-dark)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300, cursor: 'pointer' }}
            >×</button>
          </div>

          {/* History list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px', WebkitOverflowScrolling: 'touch' }}>
            {messages.filter(m => m.role === 'user').length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '40px 0' }}>Sin preguntas todavía</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {messages.filter(m => m.role === 'user').map((msg, idx) => {
                  const date = msg.timestamp ? new Date(msg.timestamp) : null;
                  const timeStr = date ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                  const dateStr = date ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';
                  return (
                    <button
                      key={msg.id}
                      onClick={() => {
                        setHistoryOpen(false);
                        setTimeout(() => {
                          const el = msgRefs.current[msg.id];
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          // Flash highlight
                          if (el) {
                            el.style.transition = 'background 0.2s';
                            el.style.background = 'rgba(193,165,124,0.18)';
                            el.style.borderRadius = '12px';
                            setTimeout(() => { el.style.background = ''; el.style.borderRadius = ''; }, 1200);
                          }
                        }, 320);
                      }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '11px 14px', borderRadius: 12, textAlign: 'left',
                        background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)',
                        cursor: 'pointer', transition: 'all 0.15s', width: '100%',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--driftwood)'; e.currentTarget.style.background = 'var(--soft-grey)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--whisper-grey)'; e.currentTarget.style.background = 'var(--pale-mist)'; }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--driftwood)', flexShrink: 0, marginTop: 1 }}>
                        {idx + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {msg.content}
                      </span>
                      {(timeStr || dateStr) && (
                        <span style={{ fontSize: 10, color: 'var(--text-light)', flexShrink: 0, marginTop: 2, whiteSpace: 'nowrap' }}>
                          {dateStr}<br/>{timeStr}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 6 }}>
      <div style={{
        maxWidth: '88%',
        padding: isUser ? '10px 15px' : '14px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser
          ? 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))'
          : 'var(--pale-mist)',
        border: isUser ? 'none' : '1px solid var(--whisper-grey)',
        color: isUser ? 'white' : 'var(--text-dark)',
        fontSize: 14,
        lineHeight: 1.6,
        wordBreak: 'break-word',
      }}>
        {isUser
          ? <span>{message.content}</span>
          : <MarkdownContent text={message.content} />
        }
      </div>

      {/* Sources */}
      {!isUser && message.sources && message.sources.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 4, maxWidth: '88%' }}>
          {message.sources.map((s, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 20,
              background: 'var(--soft-grey)', color: 'var(--text-light)',
              border: '1px solid var(--whisper-grey)',
            }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownContent({ text }) {
  const blocks = parseMarkdown(text);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((block, i) => {
        if (block.type === 'h1') return <p key={i} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.4 }}>{renderInline(block.text)}</p>;
        if (block.type === 'h2') return <p key={i} style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.4, marginTop: i > 0 ? 6 : 0 }}>{renderInline(block.text)}</p>;
        if (block.type === 'h3') return <p key={i} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-mid)', lineHeight: 1.4, marginTop: i > 0 ? 4 : 0 }}>{renderInline(block.text)}</p>;
        if (block.type === 'li')  return <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ color: 'var(--driftwood)', flexShrink: 0, marginTop: 2, fontSize: 12 }}>•</span><span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-dark)' }}>{renderInline(block.text)}</span></div>;
        if (block.type === 'hr')  return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--soft-grey)', margin: '4px 0' }} />;
        if (block.type === 'p' && block.text.trim()) return <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-dark)' }}>{renderInline(block.text)}</p>;
        return null;
      })}
    </div>
  );
}

function parseMarkdown(text) {
  return text.split('\n').map(line => {
    if (/^#{3}\s/.test(line)) return { type: 'h3', text: line.replace(/^#{3}\s/, '') };
    if (/^#{2}\s/.test(line)) return { type: 'h2', text: line.replace(/^#{2}\s/, '') };
    if (/^#{1}\s/.test(line)) return { type: 'h1', text: line.replace(/^#{1}\s/, '') };
    if (/^[-*]\s/.test(line))  return { type: 'li', text: line.replace(/^[-*]\s/, '') };
    if (/^---+$/.test(line.trim())) return { type: 'hr' };
    return { type: 'p', text: line };
  });
}

function renderInline(text) {
  // Split on **bold** and render spans
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{part.slice(2, -2)}</strong>;
    }
    // Handle *italic*
    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((ip, j) => {
      if (ip.startsWith('*') && ip.endsWith('*') && ip.length > 2) {
        return <em key={`${i}-${j}`} style={{ fontStyle: 'italic' }}>{ip.slice(1, -1)}</em>;
      }
      return <React.Fragment key={`${i}-${j}`}>{ip}</React.Fragment>;
    });
  });
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function ChatIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 1H2a1 1 0 00-1 1v8a1 1 0 001 1h2v3l3-3h7a1 1 0 001-1V2a1 1 0 00-1-1z" fill={color} opacity="0.85"/>
      <circle cx="5" cy="6" r="1" fill="white" opacity="0.8"/>
      <circle cx="8" cy="6" r="1" fill="white" opacity="0.8"/>
      <circle cx="11" cy="6" r="1" fill="white" opacity="0.8"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 8L2 2l3 6-3 6 12-6z" fill="white"/>
    </svg>
  );
}

function HistoryIcon({ color = 'currentColor' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.4"/>
      <path d="M7 4v3.5l2 1.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 14" fill="none">
      <path d="M1 3h11M4 3V2a1 1 0 011-1h3a1 1 0 011 1v1M5 6v5M8 6v5M2 3l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Export the icon so SidePanel can use it
export { ChatIcon };
