import React, { useState, useMemo, useCallback } from 'react';
import { useMila } from '../context/MilaContext';
import { generateDailyStudySession, mergeSessionResults } from '../utils/dailyStudy';

// ── Screen phases ──────────────────────────────────────────────────────────────
// overview → node-intro → flashcards → questions → (next node) → done

export default function DailyStudyPage({ onClose }) {
  const { summaries, updateSummary } = useMila();

  const session = useMemo(() => generateDailyStudySession(summaries), [summaries]);

  const [phase, setPhase]         = useState('overview'); // overview | node-intro | flashcards | questions | done
  const [nodeIdx, setNodeIdx]     = useState(0);
  const [cardAnswers, setCardAnswers] = useState({}); // { cardId: bool }
  const [cardIdx, setCardIdx]     = useState(0);
  const [flipped, setFlipped]     = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [qAnswers, setQAnswers]   = useState({}); // { questionId: selectedOption }
  const [sessionScore, setSessionScore] = useState({ known: 0, unknown: 0, correct: 0, wrong: 0 });

  const currentNode = session?.nodes[nodeIdx];

  // ── Navigation helpers ────────────────────────────────────────────────────

  function advancePhase() {
    if (phase === 'overview') {
      setNodeIdx(0); setCardIdx(0); setFlipped(false); setQuestionIdx(0);
      setPhase(currentNode?.sessionFlashcards?.length > 0 ? 'node-intro' : 'questions');
      return;
    }

    if (phase === 'node-intro') {
      if (currentNode.sessionFlashcards.length > 0) { setCardIdx(0); setFlipped(false); setPhase('flashcards'); }
      else if (currentNode.sessionQuestions.length > 0) { setQuestionIdx(0); setPhase('questions'); }
      else advanceNode();
      return;
    }

    if (phase === 'flashcards') {
      const next = cardIdx + 1;
      if (next < currentNode.sessionFlashcards.length) {
        setCardIdx(next); setFlipped(false);
      } else if (currentNode.sessionQuestions.length > 0) {
        setQuestionIdx(0); setPhase('questions');
      } else {
        advanceNode();
      }
      return;
    }

    if (phase === 'questions') {
      const next = questionIdx + 1;
      if (next < currentNode.sessionQuestions.length) {
        setQuestionIdx(next);
      } else {
        advanceNode();
      }
      return;
    }
  }

  function advanceNode() {
    const next = nodeIdx + 1;
    if (next < session.nodes.length) {
      setNodeIdx(next);
      setCardIdx(0); setFlipped(false); setQuestionIdx(0);
      const nextNode = session.nodes[next];
      setPhase(nextNode.sessionFlashcards.length > 0 ? 'node-intro' : 'questions');
    } else {
      finishSession();
    }
  }

  function finishSession() {
    // Persist flashcard known/unknown updates back to summaries
    const updates = mergeSessionResults(session.nodes, cardAnswers, summaries);
    Object.entries(updates).forEach(([id, changes]) => updateSummary(Number(id), changes));
    setPhase('done');
  }

  function answerCard(known) {
    const card = currentNode.sessionFlashcards[cardIdx];
    setCardAnswers(prev => ({ ...prev, [card.id]: known }));
    setSessionScore(prev => ({ ...prev, known: prev.known + (known ? 1 : 0), unknown: prev.unknown + (known ? 0 : 1) }));
    advancePhase();
  }

  function answerQuestion(option) {
    const q = currentNode.sessionQuestions[questionIdx];
    if (qAnswers[q.id] != null) return; // already answered
    const correct = option === q.answer;
    setQAnswers(prev => ({ ...prev, [q.id]: option }));
    setSessionScore(prev => ({ ...prev, correct: prev.correct + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1) }));
  }

  // ── No data state ─────────────────────────────────────────────────────────
  if (!session) {
    return (
      <Container onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 8 }}>No hay datos suficientes</h2>
          <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 24px' }}>
            Para generar una sesión diaria necesitás al menos un resumen con mapa conceptual generado.
          </p>
          <CloseBtn onClose={onClose} label="Volver" />
        </div>
      </Container>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const totalCards = sessionScore.known + sessionScore.unknown;
    const totalQ = sessionScore.correct + sessionScore.wrong;
    const fcPct = totalCards > 0 ? Math.round((sessionScore.known / totalCards) * 100) : null;
    const qPct  = totalQ  > 0 ? Math.round((sessionScore.correct / totalQ) * 100) : null;
    return (
      <Container onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '48px 24px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{fcPct >= 80 || qPct >= 80 ? '🎉' : '💪'}</div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 4 }}>Sesión completada</h2>
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 32 }}>
            {session.nodes.length} nodo{session.nodes.length > 1 ? 's' : ''} repasados
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
            {fcPct != null && <StatBadge label="Flashcards conocidas" value={`${fcPct}%`} sub={`${sessionScore.known}/${totalCards}`} color="#7BAE7F" />}
            {qPct  != null && <StatBadge label="Preguntas correctas"  value={`${qPct}%`}  sub={`${sessionScore.correct}/${totalQ}`}  color="#C1A97A" />}
          </div>
          <CloseBtn onClose={onClose} label="Terminar" />
        </div>
      </Container>
    );
  }

  // ── Overview ──────────────────────────────────────────────────────────────
  if (phase === 'overview') {
    return (
      <Container onClose={onClose}>
        <div style={{ padding: '28px 24px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: 'var(--driftwood)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Sesión diaria</p>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 4 }}>Tu plan de hoy</h2>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {session.nodes.length} nodos · {session.totalFlashcards} flashcards · {session.totalQuestions} preguntas · ~{session.estimatedMinutes} min
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {session.nodes.map((n, i) => (
              <NodePreviewRow key={`${n.summaryId}-${n.nodeId}`} index={i + 1} node={n} />
            ))}
          </div>

          <button
            onClick={advancePhase}
            style={primaryBtn}
          >
            Comenzar sesión →
          </button>
        </div>
      </Container>
    );
  }

  // ── Node intro ────────────────────────────────────────────────────────────
  if (phase === 'node-intro') {
    const total = session.nodes.length;
    return (
      <Container onClose={onClose} progress={{ current: nodeIdx, total }}>
        <div style={{ padding: '24px 24px 28px' }}>
          <ProgressDots current={nodeIdx} total={total} />
          <p style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 4, marginTop: 12 }}>{currentNode.summaryTitle}</p>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 12 }}>{currentNode.nodeLabel}</h2>

          {currentNode.nodeSummary && (
            <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 12 }}>
              {currentNode.nodeSummary}
            </p>
          )}

          {currentNode.nodeBullets?.length > 0 && (
            <ul style={{ paddingLeft: 18, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentNode.nodeBullets.map((b, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>{b}</li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {currentNode.sessionFlashcards.length > 0 && <Chip label={`${currentNode.sessionFlashcards.length} flashcards`} />}
            {currentNode.sessionQuestions.length > 0  && <Chip label={`${currentNode.sessionQuestions.length} preguntas`} />}
            {currentNode.isMastered && <Chip label="Dominado" color="var(--driftwood)" />}
          </div>

          <button onClick={advancePhase} style={primaryBtn}>
            {currentNode.sessionFlashcards.length > 0 ? 'Estudiar flashcards →' : 'Responder preguntas →'}
          </button>
        </div>
      </Container>
    );
  }

  // ── Flashcards ────────────────────────────────────────────────────────────
  if (phase === 'flashcards') {
    const card = currentNode.sessionFlashcards[cardIdx];
    const cardTotal = currentNode.sessionFlashcards.length;
    return (
      <Container onClose={onClose} progress={{ current: nodeIdx, total: session.nodes.length }}>
        <div style={{ padding: '20px 24px 28px' }}>
          <ProgressDots current={nodeIdx} total={session.nodes.length} />
          <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 12, marginBottom: 4 }}>
            {currentNode.nodeLabel} · {cardIdx + 1}/{cardTotal}
          </p>

          {/* Card */}
          <div
            onClick={() => setFlipped(f => !f)}
            style={{
              minHeight: 160, borderRadius: 16, padding: '28px 24px',
              background: flipped ? 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))' : 'var(--pale-mist)',
              border: `1.5px solid ${flipped ? 'transparent' : 'var(--whisper-grey)'}`,
              cursor: 'pointer', transition: 'all 0.25s ease',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              marginBottom: 8, userSelect: 'none',
            }}
          >
            <p style={{ fontSize: 11, color: flipped ? 'rgba(255,255,255,0.6)' : 'var(--text-light)', marginBottom: 8 }}>
              {flipped ? 'Respuesta' : 'Pregunta — toca para revelar'}
            </p>
            <p style={{ fontSize: 16, fontWeight: 500, color: flipped ? 'white' : 'var(--text-dark)', lineHeight: 1.5 }}>
              {flipped ? card.back : card.front}
            </p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'center', marginBottom: 20 }}>
            {flipped ? 'Toca la carta para voltear de nuevo' : 'Toca para ver la respuesta'}
          </p>

          {flipped && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => answerCard(false)} style={{ ...secondaryBtn, flex: 1, borderColor: '#c0392b', color: '#c0392b' }}>
                ✗ No lo sabía
              </button>
              <button onClick={() => answerCard(true)} style={{ ...secondaryBtn, flex: 1, borderColor: '#27ae60', color: '#27ae60' }}>
                ✓ Lo sabía
              </button>
            </div>
          )}
        </div>
      </Container>
    );
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  if (phase === 'questions') {
    const q = currentNode.sessionQuestions[questionIdx];
    const answered = qAnswers[q?.id];
    const qTotal = currentNode.sessionQuestions.length;

    return (
      <Container onClose={onClose} progress={{ current: nodeIdx, total: session.nodes.length }}>
        <div style={{ padding: '20px 24px 28px' }}>
          <ProgressDots current={nodeIdx} total={session.nodes.length} />
          <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 12, marginBottom: 4 }}>
            {currentNode.nodeLabel} · {questionIdx + 1}/{qTotal}
          </p>

          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-dark)', lineHeight: 1.5, marginBottom: 20 }}>
            {q.question}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {(q.options || []).map((opt, i) => {
              const isSelected = answered === opt;
              const isCorrect  = opt === q.answer;
              let bg = 'var(--pale-mist)', border = 'var(--whisper-grey)', color = 'var(--text-dark)';
              if (answered != null) {
                if (isCorrect)        { bg = 'rgba(39,174,96,0.1)';  border = '#27ae60'; color = '#27ae60'; }
                else if (isSelected)  { bg = 'rgba(192,57,43,0.08)'; border = '#c0392b'; color = '#c0392b'; }
              }
              return (
                <button
                  key={i}
                  onClick={() => answerQuestion(opt)}
                  disabled={answered != null}
                  style={{
                    padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                    background: bg, border: `1.5px solid ${border}`, color,
                    fontSize: 14, lineHeight: 1.4, cursor: answered != null ? 'default' : 'pointer',
                    transition: 'all 0.2s', fontWeight: isSelected || (answered != null && isCorrect) ? 600 : 400,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {answered != null && q.explanation && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--pale-mist)', border: '1px solid var(--soft-grey)', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5 }}>{q.explanation}</p>
            </div>
          )}

          {answered != null && (
            <button onClick={advancePhase} style={primaryBtn}>
              {questionIdx + 1 < qTotal ? 'Siguiente pregunta →' : nodeIdx + 1 < session.nodes.length ? 'Siguiente nodo →' : 'Terminar sesión →'}
            </button>
          )}
        </div>
      </Container>
    );
  }

  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Container({ children, onClose, progress }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--ghost-white)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--whisper-grey)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--driftwood)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dark)' }}>Sesión diaria</span>
        </div>
        <button
          onClick={onClose}
          style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--soft-grey)', background: 'transparent', color: 'var(--text-dark)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
        {children}
      </div>
    </div>
  );
}

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 18 : 7, height: 7,
          borderRadius: 4,
          background: i < current ? 'var(--driftwood)' : i === current ? 'var(--ash-plum)' : 'var(--soft-grey)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  );
}

function NodePreviewRow({ index, node }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', borderRadius: 12,
      background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)',
    }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.nodeLabel}</p>
        <p style={{ fontSize: 11, color: 'var(--text-light)' }}>{node.summaryTitle} · {node.reason}</p>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {node.sessionFlashcards.length > 0 && <Chip label={node.sessionFlashcards.length + ' FC'} small />}
        {node.sessionQuestions.length > 0  && <Chip label={node.sessionQuestions.length + ' P'}  small />}
      </div>
    </div>
  );
}

function Chip({ label, color, small }) {
  return (
    <span style={{
      padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 600,
      background: 'var(--soft-grey)', color: color || 'var(--text-mid)',
    }}>{label}</span>
  );
}

function StatBadge({ label, value, sub, color }) {
  return (
    <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)', minWidth: 130 }}>
      <p style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 2 }}>{value}</p>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 11, color: 'var(--text-light)' }}>{sub}</p>
    </div>
  );
}

function CloseBtn({ onClose, label }) {
  return (
    <button onClick={onClose} style={{ ...primaryBtn, display: 'inline-block', width: 'auto', padding: '12px 28px' }}>
      {label}
    </button>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const primaryBtn = {
  width: '100%', padding: '15px', borderRadius: 14,
  background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
  color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  border: 'none', letterSpacing: '0.2px',
};

const secondaryBtn = {
  padding: '13px', borderRadius: 12,
  background: 'transparent', border: '1.5px solid var(--soft-grey)',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
};
