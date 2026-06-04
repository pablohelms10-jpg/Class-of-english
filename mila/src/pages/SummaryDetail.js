import React, { useState, useEffect } from 'react';
import { useMila } from '../context/MilaContext';
import FlashcardsMode from './modes/FlashcardsMode';
import QuizMode from './modes/QuizMode';
import ConceptMapMode from './modes/ConceptMapMode';
import ImagesMode from './modes/ImagesMode'; // eslint-disable-line no-unused-vars
import ContentEditorPanel from '../components/ContentEditorPanel';
import StatsModal from '../components/StatsModal';
import { FlashcardIcon, QuizIcon } from '../components/Icons';

export default function SummaryDetail() {
  const { activeSummary } = useMila();
  const [editorOpen, setEditorOpen] = useState(false);
  const [overlay, setOverlay] = useState(null); // 'flashcards' | 'quiz' | null
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    if (overlay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [overlay]);

  if (!activeSummary) return null;

  const wordCount = activeSummary.text
    ? activeSummary.text.split(/\s+/).filter(Boolean).length
    : 0;
  const imageCount = (activeSummary.images || []).length;

  const hasContent = (activeSummary.flashcards || []).length > 0 || (activeSummary.questions || []).length > 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 5, letterSpacing: '-0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeSummary.title}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
            {wordCount > 0 ? `${wordCount} palabras` : ''}
            {imageCount > 0 ? ` · ${imageCount} imagen(es)` : ''}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 7, flexShrink: 0, alignItems: 'center' }}>
          {/* Flashcards overlay button */}
          <button
            onClick={() => setOverlay('flashcards')}
            title="Flashcards"
            style={iconBtnStyle(false)}
          >
            <FlashcardIcon size={16} color="var(--text-dark)" />
          </button>

          {/* Quiz overlay button */}
          <button
            onClick={() => setOverlay('quiz')}
            title="Preguntas"
            style={iconBtnStyle(false)}
          >
            <QuizIcon size={16} color="var(--text-dark)" />
          </button>

          {/* Stats button */}
          <button
            onClick={() => setStatsOpen(true)}
            title="Estadísticas de aprendizaje"
            style={iconBtnStyle(false)}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="8" width="3" height="6" rx="1" fill="currentColor" opacity="0.5"/>
              <rect x="6" y="4" width="3" height="10" rx="1" fill="currentColor" opacity="0.75"/>
              <rect x="11" y="1" width="3" height="13" rx="1" fill="currentColor"/>
            </svg>
          </button>

          {/* Edit button */}
          <button
            onClick={() => setEditorOpen(true)}
            title="Ver y editar flashcards y preguntas"
            style={{
              ...iconBtnStyle(false),
              borderColor: hasContent ? 'var(--driftwood)' : 'var(--soft-grey)',
              color: hasContent ? 'var(--driftwood)' : 'var(--text-light)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M11.5 1.5a1.5 1.5 0 012.12 2.12L5 12.24 2 13l.76-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Concept map is always the primary view */}
      <ConceptMapMode summary={activeSummary} />

      {/* Flashcards / Quiz overlay */}
      {overlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'var(--ghost-white)',
          overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Overlay header */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 1,
            background: 'var(--ghost-white)',
            borderBottom: '1px solid var(--whisper-grey)',
            padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-dark)', margin: 0 }}>
                {overlay === 'flashcards' ? 'Flashcards' : 'Preguntas'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-light)', margin: 0 }}>
                {activeSummary.title}
              </p>
            </div>
            <button
              onClick={() => setOverlay(null)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: '1.5px solid var(--soft-grey)',
                background: 'transparent',
                color: 'var(--text-dark)',
                fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-grey)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              ✕
            </button>
          </div>

          {/* Overlay content */}
          <div style={{ padding: '24px 20px', flex: 1 }}>
            {overlay === 'flashcards' && <FlashcardsMode summary={activeSummary} />}
            {overlay === 'quiz' && <QuizMode summary={activeSummary} />}
          </div>
        </div>
      )}

      {editorOpen && (
        <ContentEditorPanel open={true} onClose={() => setEditorOpen(false)} summary={activeSummary} />
      )}

      {statsOpen && (
        <StatsModal summary={activeSummary} onClose={() => setStatsOpen(false)} />
      )}
    </div>
  );
}

function iconBtnStyle() {
  return {
    width: 36, height: 36, borderRadius: 10,
    border: '1.5px solid var(--soft-grey)',
    background: 'transparent',
    color: 'var(--text-dark)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background 0.15s',
  };
}
