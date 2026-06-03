import React, { useState } from 'react';
import { useMila } from '../context/MilaContext';

export default function ContentEditorPanel({ open, onClose, summary }) {
  const { updateSummary } = useMila();
  const [tab, setTab] = useState('flashcards');

  if (!summary) return null;

  const flashcards = summary.flashcards || [];
  const questions = summary.questions || [];

  function updateFlashcard(idx, changes) {
    const updated = flashcards.map((c, i) => i === idx ? { ...c, ...changes } : c);
    updateSummary(summary.id, { flashcards: updated });
  }

  function deleteFlashcard(idx) {
    const updated = flashcards.filter((_, i) => i !== idx);
    updateSummary(summary.id, { flashcards: updated });
  }

  function addFlashcard() {
    const updated = [...flashcards, { id: Date.now(), front: '', back: '', context: '' }];
    updateSummary(summary.id, { flashcards: updated });
  }

  function updateQuestion(idx, changes) {
    const updated = questions.map((q, i) => i === idx ? { ...q, ...changes } : q);
    updateSummary(summary.id, { questions: updated });
  }

  function deleteQuestion(idx) {
    const updated = questions.filter((_, i) => i !== idx);
    updateSummary(summary.id, { questions: updated });
  }

  function addQuestion() {
    const updated = [...questions, { id: Date.now(), question: '', options: ['', '', '', ''], correct: '', explanation: '' }];
    updateSummary(summary.id, { questions: updated });
  }

  const tabStyle = active => ({
    padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? 'var(--driftwood)' : 'transparent',
    color: active ? 'white' : 'var(--text-mid)',
    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity 0.3s ease' }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(560px, 100vw)', zIndex: 201,
        background: 'var(--ghost-white)', borderLeft: '1px solid var(--soft-grey)',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.18)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--soft-grey)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 2 }}>Editor de contenido</h2>
              <p style={{ fontSize: 12, color: 'var(--text-light)' }}>{summary.title}</p>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-dark)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 6, background: 'var(--soft-grey)', borderRadius: 24, padding: 4 }}>
            <button style={tabStyle(tab === 'flashcards')} onClick={() => setTab('flashcards')}>
              🃏 Flashcards ({flashcards.length})
            </button>
            <button style={tabStyle(tab === 'questions')} onClick={() => setTab('questions')}>
              ⚡ Preguntas ({questions.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>
          {tab === 'flashcards' && (
            <>
              {flashcards.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-light)', fontSize: 14 }}>
                  No hay flashcards. Abre el modo Flashcards para generarlas con IA, o crea una manualmente.
                </div>
              )}
              {flashcards.map((card, idx) => (
                <FlashcardEditor key={card.id || idx} card={card} onUpdate={ch => updateFlashcard(idx, ch)} onDelete={() => deleteFlashcard(idx)} />
              ))}
              <button onClick={addFlashcard} style={{ width: '100%', marginTop: 8, padding: '12px', borderRadius: 10, border: '1.5px dashed var(--whisper-grey)', color: 'var(--text-mid)', fontSize: 13, background: 'transparent', cursor: 'pointer' }}>
                + Añadir flashcard
              </button>
            </>
          )}

          {tab === 'questions' && (
            <>
              {questions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-light)', fontSize: 14 }}>
                  No hay preguntas. Abre el modo Preguntas para generarlas con IA, o crea una manualmente.
                </div>
              )}
              {questions.map((q, idx) => (
                <QuestionEditor key={q.id || idx} question={q} onUpdate={ch => updateQuestion(idx, ch)} onDelete={() => deleteQuestion(idx)} />
              ))}
              <button onClick={addQuestion} style={{ width: '100%', marginTop: 8, padding: '12px', borderRadius: 10, border: '1.5px dashed var(--whisper-grey)', color: 'var(--text-mid)', fontSize: 13, background: 'transparent', cursor: 'pointer' }}>
                + Añadir pregunta
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function FlashcardEditor({ card, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: 8, borderRadius: 12, border: '1px solid var(--soft-grey)', background: 'var(--pale-mist)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: 11, color: 'var(--text-light)', width: 10 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-dark)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.front || <em style={{ color: 'var(--text-light)' }}>Sin pregunta</em>}
        </span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ color: 'var(--text-light)', fontSize: 16, padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--soft-grey)' }}>
          <Label>Pregunta (frente)</Label>
          <FieldInput value={card.front} onChange={v => onUpdate({ front: v })} placeholder="¿Qué es...?" rows={2} />
          <Label>Respuesta (reverso)</Label>
          <FieldInput value={card.back} onChange={v => onUpdate({ back: v })} placeholder="La respuesta..." rows={2} />
          <Label>Contexto / nota (opcional)</Label>
          <FieldInput value={card.context || ''} onChange={v => onUpdate({ context: v })} placeholder="Información adicional..." rows={2} />
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ question, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  function updateOption(idx, val) {
    const opts = [...(question.options || ['', '', '', ''])];
    opts[idx] = val;
    onUpdate({ options: opts });
  }

  return (
    <div style={{ marginBottom: 8, borderRadius: 12, border: '1px solid var(--soft-grey)', background: 'var(--pale-mist)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: 11, color: 'var(--text-light)', width: 10 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-dark)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {question.question || <em style={{ color: 'var(--text-light)' }}>Sin pregunta</em>}
        </span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ color: 'var(--text-light)', fontSize: 16, padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--soft-grey)' }}>
          <Label>Pregunta</Label>
          <FieldInput value={question.question} onChange={v => onUpdate({ question: v })} placeholder="¿Cuál es...?" rows={2} />
          <Label>Opciones (marca cuál es correcta)</Label>
          {(question.options || ['', '', '', '']).map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <button
                onClick={() => onUpdate({ correct: opt })}
                title="Marcar como correcta"
                style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: `2px solid ${question.correct === opt ? '#7BAE7F' : 'var(--soft-grey)'}`, background: question.correct === opt ? '#7BAE7F' : 'transparent', transition: 'all 0.2s' }}
              />
              <input
                value={opt}
                onChange={e => updateOption(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--soft-grey)', fontSize: 13, color: 'var(--text-dark)', background: 'var(--pale-mist)', outline: 'none' }}
              />
            </div>
          ))}
          <Label>Explicación (opcional)</Label>
          <FieldInput value={question.explanation || ''} onChange={v => onUpdate({ explanation: v })} placeholder="Por qué es correcta..." rows={2} />
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 10, marginBottom: 4 }}>{children}</div>;
}

function FieldInput({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--soft-grey)', fontSize: 13, color: 'var(--text-dark)', background: 'var(--pale-mist)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
    />
  );
}
