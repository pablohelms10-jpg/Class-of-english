import React, { useState } from 'react';
import { useMila } from '../context/MilaContext';
import FlashcardsMode from './modes/FlashcardsMode';
import QuizMode from './modes/QuizMode';
import ConceptMapMode from './modes/ConceptMapMode';
import ImagesMode from './modes/ImagesMode';
import ContentEditorPanel from '../components/ContentEditorPanel';

const MODES = [
  { id: 'flashcards', emoji: '🃏', label: 'Flashcards' },
  { id: 'quiz', emoji: '⚡', label: 'Preguntas' },
  { id: 'map', emoji: '🗺', label: 'Mapa' },
  { id: 'images', emoji: '🖼', label: 'Imágenes' },
];

export default function SummaryDetail() {
  const { activeSummary, activeMode, setActiveMode } = useMila();
  const [editorOpen, setEditorOpen] = useState(false);

  if (!activeSummary) return null;

  const hasFlashcards = (activeSummary.flashcards || []).length > 0;
  const hasQuestions = (activeSummary.questions || []).length > 0;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 6, letterSpacing: '-0.5px' }}>
              {activeSummary.title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {activeSummary.text ? `${activeSummary.text.split(/\s+/).filter(Boolean).length} palabras` : ''}
              {activeSummary.images?.length > 0 ? ` · ${activeSummary.images.length} imagen(es)` : ''}
              {hasFlashcards ? ` · ${activeSummary.flashcards.length} flashcards` : ''}
              {hasQuestions ? ` · ${activeSummary.questions.length} preguntas` : ''}
            </p>
          </div>
          {(hasFlashcards || hasQuestions) && (
            <button
              onClick={() => setEditorOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 10,
                border: '1.5px solid var(--soft-grey)',
                background: 'transparent', color: 'var(--text-mid)',
                fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-grey)'; e.currentTarget.style.color = 'var(--text-dark)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-mid)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 10L10 2l2 2L4 12H2v-2z" fill="currentColor"/>
              </svg>
              Ver y editar contenido
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
        {MODES.map(m => {
          const disabled = m.id === 'images' && (activeSummary.images || []).length === 0;
          const active = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => !disabled && setActiveMode(m.id)}
              disabled={disabled}
              style={{
                padding: '12px 22px', borderRadius: 'var(--radius-lg)',
                background: active ? 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))' : 'rgba(255,255,255,0.7)',
                border: `1.5px solid ${active ? 'transparent' : 'var(--soft-grey)'}`,
                color: active ? 'white' : disabled ? 'var(--text-light)' : 'var(--text-mid)',
                fontSize: 14, fontWeight: active ? 500 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'var(--transition)', opacity: disabled ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {!activeMode && <ModeSelector setActiveMode={setActiveMode} hasImages={(activeSummary.images || []).length > 0} />}
      {activeMode === 'flashcards' && <FlashcardsMode summary={activeSummary} />}
      {activeMode === 'quiz' && <QuizMode summary={activeSummary} />}
      {activeMode === 'map' && <ConceptMapMode text={activeSummary.text} />}
      {activeMode === 'images' && <ImagesMode images={activeSummary.images} />}

      <ContentEditorPanel open={editorOpen} onClose={() => setEditorOpen(false)} summary={activeSummary} />
    </div>
  );
}

function ModeSelector({ setActiveMode, hasImages }) {
  const modes = [
    { id: 'flashcards', emoji: '🃏', label: 'Flashcards', desc: 'Tarjetas para memorizar definiciones y conceptos clave' },
    { id: 'quiz', emoji: '⚡', label: 'Preguntas rápidas', desc: 'Test de opción múltiple basado en tu resumen' },
    { id: 'map', emoji: '🗺', label: 'Mapa conceptual', desc: 'Visualización interactiva de las ideas principales' },
    ...(hasImages ? [{ id: 'images', emoji: '🖼', label: 'Galería', desc: 'Explora las imágenes extraídas del resumen' }] : []),
  ];
  return (
    <div>
      <p style={{ fontSize: 15, color: 'var(--text-mid)', marginBottom: 20 }}>¿Cómo quieres estudiar hoy?</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {modes.map(m => <ModeCard key={m.id} mode={m} onClick={() => setActiveMode(m.id)} />)}
      </div>
    </div>
  );
}

function ModeCard({ mode, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '28px 20px', borderRadius: 'var(--radius-md)',
        background: hovered ? 'linear-gradient(135deg, rgba(176,168,164,0.15), rgba(193,183,175,0.1))' : 'rgba(255,255,255,0.7)',
        border: `1.5px solid ${hovered ? 'var(--feather-touch)' : 'var(--soft-grey)'}`,
        cursor: 'pointer', transition: 'var(--transition)',
        boxShadow: hovered ? 'var(--shadow-card)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
        textAlign: 'left',
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>{mode.emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 6 }}>{mode.label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5 }}>{mode.desc}</div>
    </button>
  );
}
