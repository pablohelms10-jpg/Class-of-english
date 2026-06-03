import React, { useState, useMemo } from 'react';
import { generateFlashcards } from '../../utils/parseContent';

export default function FlashcardsMode({ text }) {
  const cards = useMemo(() => generateFlashcards(text || ''), [text]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [unknown, setUnknown] = useState(new Set());

  if (!text || cards.length === 0) {
    return <EmptyState message="No hay suficiente texto para generar flashcards. Asegúrate de tener al menos un párrafo con definiciones o conceptos." />;
  }

  const card = cards[index];
  const progress = index / cards.length;

  function handleKnown() {
    setKnown(prev => new Set([...prev, card.id]));
    next();
  }

  function handleUnknown() {
    setUnknown(prev => new Set([...prev, card.id]));
    next();
  }

  function next() {
    setFlipped(false);
    setTimeout(() => setIndex(i => Math.min(i + 1, cards.length - 1)), 150);
  }

  function prev() {
    setFlipped(false);
    setTimeout(() => setIndex(i => Math.max(i - 1, 0)), 150);
  }

  if (index >= cards.length) {
    return (
      <ResultsScreen
        total={cards.length}
        known={known.size}
        unknown={unknown.size}
        onRestart={() => { setIndex(0); setFlipped(false); setKnown(new Set()); setUnknown(new Set()); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
          {index + 1} / {cards.length}
        </span>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-light)' }}>
          <span style={{ color: '#7BAE7F' }}>✓ {known.size}</span>
          <span style={{ color: 'var(--ash-plum)' }}>✗ {unknown.size}</span>
        </div>
      </div>

      <div style={{ height: 4, background: 'var(--soft-grey)', borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: 'linear-gradient(90deg, var(--ash-plum), var(--driftwood))', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>

      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          minHeight: 240,
          borderRadius: 'var(--radius-lg)',
          background: flipped
            ? 'linear-gradient(135deg, var(--ash-plum) 0%, var(--driftwood) 100%)'
            : 'white',
          border: `1.5px solid ${flipped ? 'transparent' : 'var(--soft-grey)'}`,
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          cursor: 'pointer',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
          marginBottom: 24,
          position: 'relative',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 16,
          right: 20,
          fontSize: 11,
          color: flipped ? 'rgba(255,255,255,0.6)' : 'var(--text-light)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          {flipped ? 'Respuesta' : 'Pregunta · toca para ver'}
        </div>

        {!flipped ? (
          <p style={{ fontSize: 18, color: 'var(--text-dark)', textAlign: 'center', lineHeight: 1.7 }}>
            {card.front}
          </p>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 600, color: 'white', fontFamily: 'Playfair Display, serif', marginBottom: 12 }}>
              {card.back}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              {card.context}
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={prev}
          disabled={index === 0}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-lg)',
            border: '1.5px solid var(--soft-grey)',
            color: 'var(--text-mid)',
            fontSize: 14,
            opacity: index === 0 ? 0.4 : 1,
          }}
        >
          ← Anterior
        </button>

        {flipped && (
          <>
            <button
              onClick={handleUnknown}
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(176,168,164,0.15)',
                border: '1.5px solid var(--feather-touch)',
                color: 'var(--ash-plum)',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              ✗ No lo sé
            </button>
            <button
              onClick={handleKnown}
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
                color: 'white',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              ✓ Lo sé
            </button>
          </>
        )}

        {!flipped && (
          <button
            onClick={next}
            style={{
              padding: '12px 24px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}

function ResultsScreen({ total, known, unknown, onRestart }) {
  const pct = Math.round((known / total) * 100);
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{pct >= 70 ? '🎉' : '📚'}</div>
      <h3 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>
        {pct >= 70 ? '¡Buen trabajo!' : 'Sigue practicando'}
      </h3>
      <p style={{ fontSize: 16, color: 'var(--text-mid)', marginBottom: 32 }}>
        Acertaste <strong>{pct}%</strong> — {known} de {total} tarjetas
      </p>
      <button
        onClick={onRestart}
        style={{
          padding: '14px 32px',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
          color: 'white',
          fontSize: 15,
          fontWeight: 500,
        }}
      >
        Volver a empezar
      </button>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
      <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>{message}</p>
    </div>
  );
}
