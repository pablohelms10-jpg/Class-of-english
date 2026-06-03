import React, { useState, useEffect } from 'react';
import { useMila } from '../../context/MilaContext';
import { generateFlashcards } from '../../utils/parseContent';
import { generateFlashcardsAI, assignImagesToNodes } from '../../utils/aiService';
import MilaLoadingScreen from '../../components/MilaLoadingScreen';
import { StarIcon, BookIcon, DocumentIcon, FlashcardIcon } from '../../components/Icons';

export default function FlashcardsMode({ summary }) {
  const { updateSummary } = useMila();
  const text = summary?.text || '';
  const cached = summary?.flashcards;

  // Load saved progress
  const savedProgress = summary?.flashcardProgress || { known: [], unknown: [], index: 0 };

  const [cards, setCards] = useState(cached || []);
  const [loading, setLoading] = useState(!cached || cached.length === 0);
  const [generating, setGenerating] = useState(false);
  const [allCovered, setAllCovered] = useState(summary?.flashcardsAllCovered || false);
  const [index, setIndex] = useState(savedProgress.index || 0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set(savedProgress.known || []));
  const [unknown, setUnknown] = useState(new Set(savedProgress.unknown || []));

  // Save progress whenever known/unknown/index changes
  useEffect(() => {
    if (cards.length === 0) return;
    updateSummary(summary.id, {
      flashcardProgress: {
        known: [...known],
        unknown: [...unknown],
        index,
        updatedAt: new Date().toISOString(),
      }
    });
  }, [known, unknown, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const images = summary?.images || [];

  useEffect(() => {
    if (cached && cached.length > 0) {
      // Auto-assign images to existing cards that are missing imageIndex
      if (images.length > 0 && !cached.some(c => c.imageIndex != null)) {
        const nodes = cached.map(c => ({ id: c.id, label: c.front, summary: c.back }));
        assignImagesToNodes(nodes, images)
          .then(withImages => {
            const upgraded = cached.map((c, i) => ({ ...c, imageIndex: withImages[i]?.imageIndex ?? null }));
            setCards(upgraded);
            updateSummary(summary.id, { flashcards: upgraded });
          })
          .catch(() => {}); // keep cards as-is if matching fails
      }
      return;
    }
    setLoading(true);
    generateFlashcardsAI(text, [], images)
      .then(({ cards: generated, allCovered: done }) => {
        setCards(generated);
        setAllCovered(done);
        updateSummary(summary.id, { flashcards: generated, flashcardsAllCovered: done });
      })
      .catch(() => {
        const fallback = generateFlashcards(text);
        setCards(fallback);
        updateSummary(summary.id, { flashcards: fallback });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function regenerateAll() {
    setLoading(true);
    setCards([]);
    setKnown(new Set());
    setUnknown(new Set());
    setIndex(0);
    updateSummary(summary.id, { flashcards: [], flashcardsAllCovered: false, flashcardProgress: null });
    generateFlashcardsAI(text, [], images)
      .then(({ cards: generated, allCovered: done }) => {
        setCards(generated);
        setAllCovered(done);
        updateSummary(summary.id, { flashcards: generated, flashcardsAllCovered: done });
      })
      .catch(() => {
        const fallback = generateFlashcards(text);
        setCards(fallback);
        updateSummary(summary.id, { flashcards: fallback });
      })
      .finally(() => setLoading(false));
  }

  function generateMore() {
    if (generating || allCovered) return;
    setGenerating(true);
    generateFlashcardsAI(text, cards, images)
      .then(({ cards: newCards, allCovered: done }) => {
        if (done || newCards.length === 0) {
          setAllCovered(true);
          updateSummary(summary.id, { flashcardsAllCovered: true });
        } else {
          const merged = [...cards, ...newCards];
          setCards(merged);
          updateSummary(summary.id, { flashcards: merged, flashcardsAllCovered: false });
        }
      })
      .catch(console.error)
      .finally(() => setGenerating(false));
  }

  function resetProgress() {
    setIndex(0); setFlipped(false);
    setKnown(new Set()); setUnknown(new Set());
  }

  if (loading) return <MilaLoadingScreen message="MILA está generando tus flashcards…" sub="Esto puede tomar unos segundos" />;
  if (!text || cards.length === 0) return <EmptyState message="No hay suficiente texto para generar flashcards." />;

  const hasProgress = known.size > 0 || unknown.size > 0;

  if (index >= cards.length) {
    const pct = Math.round((known.size / cards.length) * 100);
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          {pct >= 70 ? <StarIcon size={52} color="var(--driftwood)" /> : <BookIcon size={52} color="var(--text-light)" />}
        </div>
        <h3 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>
          {pct >= 70 ? '¡Buen trabajo!' : 'Sigue practicando'}
        </h3>
        <p style={{ fontSize: 16, color: 'var(--text-mid)', marginBottom: 8 }}>
          Acertaste <strong>{pct}%</strong> — {known.size} de {cards.length} tarjetas
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 32 }}>
          Progreso guardado ✓
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={resetProgress}
            style={{ padding: '14px 32px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 15, fontWeight: 500 }}>
            Volver a empezar
          </button>
          <GenerateMoreButton allCovered={allCovered} generating={generating} onClick={generateMore} />
        </div>

        {unknown.size > 0 && (
          <div style={{ marginTop: 40, textAlign: 'left', maxWidth: 500, margin: '40px auto 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Para repasar ({unknown.size})
            </p>
            {cards.filter(c => unknown.has(c.id)).map((c, i) => (
              <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)', marginBottom: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--text-dark)', fontWeight: 500, marginBottom: 4 }}>{c.front}</p>
                <p style={{ fontSize: 12, color: 'var(--text-light)' }}>{c.back}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const card = cards[index];
  const progress = index / cards.length;

  return (
    <div>
      {/* Progress bar + stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{index + 1} / {cards.length}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#7BAE7F' }}>✓ {known.size}</span>
          <span style={{ fontSize: 12, color: 'var(--ash-plum)' }}>✗ {unknown.size}</span>
          <GenerateMoreButton allCovered={allCovered} generating={generating} onClick={generateMore} small />
          <button onClick={regenerateAll} title="Regenerar desde cero (con imágenes)" style={{ fontSize: 11, color: 'var(--text-light)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--soft-grey)', background: 'transparent' }}>↺</button>
        </div>
      </div>

      {/* Saved progress indicator */}
      {hasProgress && index < cards.length && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
            Progreso guardado — podés cerrar y continuar aquí
          </span>
          <button onClick={resetProgress} style={{ fontSize: 11, color: 'var(--text-light)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--whisper-grey)', background: 'transparent' }}>
            Reiniciar
          </button>
        </div>
      )}

      {allCovered && <AllCoveredBanner type="flashcards" count={cards.length} />}

      <div style={{ height: 4, background: 'var(--soft-grey)', borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: 'linear-gradient(90deg, var(--ash-plum), var(--driftwood))', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>

      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          minHeight: 240, borderRadius: 'var(--radius-lg)',
          background: flipped ? 'linear-gradient(135deg, var(--ash-plum) 0%, var(--driftwood) 100%)' : 'var(--pale-mist)',
          border: `1.5px solid ${flipped ? 'transparent' : 'var(--whisper-grey)'}`,
          boxShadow: 'var(--shadow-card)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 40, cursor: 'pointer',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
          marginBottom: 24, position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 11, color: flipped ? 'rgba(255,255,255,0.6)' : 'var(--text-light)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {flipped ? 'Respuesta' : 'Pregunta · toca para ver'}
        </div>
        {known.has(card.id) && !flipped && (
          <div style={{ position: 'absolute', top: 14, left: 16, fontSize: 11, color: '#7BAE7F' }}>✓ Ya la sabés</div>
        )}
        {unknown.has(card.id) && !flipped && (
          <div style={{ position: 'absolute', top: 14, left: 16, fontSize: 11, color: 'var(--ash-plum)' }}>✗ Para repasar</div>
        )}
        {!flipped ? (
          <p style={{ fontSize: 18, color: 'var(--text-dark)', textAlign: 'center', lineHeight: 1.7 }}>{card.front}</p>
        ) : (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={{ fontSize: 24, fontWeight: 600, color: 'white', fontFamily: 'Playfair Display, serif', marginBottom: 10 }}>{card.back}</p>
            {card.context && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: card.imageIndex != null ? 16 : 0 }}>{card.context}</p>}
            {card.imageIndex != null && images[card.imageIndex] && (
              <img
                src={images[card.imageIndex].src}
                alt=""
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'contain', background: 'rgba(255,255,255,0.15)', marginTop: 4 }}
              />
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { setFlipped(false); setTimeout(() => setIndex(i => Math.max(i - 1, 0)), 150); }} disabled={index === 0}
          style={{ padding: '12px 24px', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--soft-grey)', color: 'var(--text-mid)', fontSize: 14, opacity: index === 0 ? 0.4 : 1 }}>
          ← Anterior
        </button>
        {flipped && (
          <>
            <button onClick={() => { setUnknown(prev => new Set([...prev, card.id])); setFlipped(false); setTimeout(() => setIndex(i => Math.min(i + 1, cards.length)), 150); }}
              style={{ padding: '12px 24px', borderRadius: 'var(--radius-lg)', background: 'rgba(176,168,164,0.15)', border: '1.5px solid var(--feather-touch)', color: 'var(--ash-plum)', fontSize: 14, fontWeight: 500 }}>
              ✗ No lo sé
            </button>
            <button onClick={() => { setKnown(prev => new Set([...prev, card.id])); setFlipped(false); setTimeout(() => setIndex(i => Math.min(i + 1, cards.length)), 150); }}
              style={{ padding: '12px 24px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 14, fontWeight: 500 }}>
              ✓ Lo sé
            </button>
          </>
        )}
        {!flipped && (
          <button onClick={() => { setFlipped(false); setTimeout(() => setIndex(i => Math.min(i + 1, cards.length)), 150); }}
            style={{ padding: '12px 24px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 14, fontWeight: 500 }}>
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}

function GenerateMoreButton({ allCovered, generating, onClick, small }) {
  if (allCovered) return null;
  return (
    <button onClick={onClick} disabled={generating}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: small ? '3px 10px' : '12px 22px', borderRadius: small ? 6 : 'var(--radius-lg)', border: '1.5px solid var(--driftwood)', color: 'var(--driftwood)', background: 'transparent', fontSize: small ? 11 : 14, fontWeight: 500, opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}>
      {generating ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>{!small && ' Generando…'}</> : <>{small ? '+ Más' : '+ Generar más'}</>}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}

function AllCoveredBanner({ type, count }) {
  return (
    <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: 'rgba(123,174,127,0.1)', border: '1px solid rgba(123,174,127,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>✅</span>
      <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>Cubriste todos los temas del resumen — {count} {type} en total. ¡Estás listo!</span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, opacity: 0.5 }}><FlashcardIcon size={40} color="var(--text-light)" /></div>
      <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>{message}</p>
    </div>
  );
}
