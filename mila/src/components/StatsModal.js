import React, { useState } from 'react';

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'var(--whisper-grey)', margin: '0 auto' }} />;
  let cumAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = Math.cos(cumAngle), y1 = Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = Math.cos(cumAngle), y2 = Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return { ...d, path: `M 0 0 L ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} Z` };
  });
  return (
    <svg viewBox="-1.1 -1.1 2.2 2.2" style={{ width: 140, height: 140, display: 'block', margin: '0 auto' }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
    </svg>
  );
}

function BarChart({ data }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 10);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--text-light)' }}>{d.value}%</span>
          <div style={{
            width: '100%',
            height: `${Math.max(4, (d.value / max) * 72)}px`,
            borderRadius: '3px 3px 0 0',
            background: d.value >= 70
              ? 'linear-gradient(180deg, #7BAE7F, #5a9060)'
              : 'linear-gradient(180deg, var(--driftwood), var(--ash-plum))',
          }} />
          <span style={{ fontSize: 9, color: 'var(--text-light)', textAlign: 'center', lineHeight: 1.2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsModal({ summary, onClose }) {
  const [chartType, setChartType] = useState('pie'); // 'pie' | 'bar'

  const flashcards = summary?.flashcards || [];
  const questions = summary?.questions || [];
  const progress = summary?.flashcardProgress || {};
  const quizHistory = summary?.quizHistory || [];
  const masteredNodes = summary?.masteredNodes || {};
  const nodes = summary?.conceptMap?.nodes || [];

  const knownIds = new Set(progress.known || []);
  const unknownIds = new Set(progress.unknown || []);
  const known = flashcards.filter(c => knownIds.has(c.id)).length;
  const unknown = flashcards.filter(c => unknownIds.has(c.id)).length;
  const unseen = flashcards.length - known - unknown;

  const masteredCount = nodes.filter(n => masteredNodes[n.id]).length;
  const totalNodes = nodes.length;

  const lastPct = quizHistory.length > 0 ? quizHistory[0].pct : null;
  const avgPct = quizHistory.length > 0
    ? Math.round(quizHistory.reduce((s, h) => s + h.pct, 0) / quizHistory.length)
    : null;

  const pieData = [
    { value: known, color: '#7BAE7F', label: `Dominadas (${known})` },
    { value: unknown, color: 'var(--ash-plum)', label: `Para repasar (${unknown})` },
    { value: unseen, color: 'var(--whisper-grey)', label: `Sin ver (${unseen})` },
  ].filter(d => d.value > 0);

  const barData = quizHistory.slice(0, 8).reverse().map((h, i) => ({
    value: h.pct,
    label: new Date(h.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
  }));

  // Per-node stats (% of questions correct for that concept)
  const nodeStats = nodes.map(n => {
    const nodeQ = questions.filter(q => q.conceptLabel === n.label);
    return { label: n.label, mastered: !!masteredNodes[n.id], qCount: nodeQ.length };
  }).filter(n => n.mastered || n.qCount > 0);

  const strongNodes = nodes.filter(n => masteredNodes[n.id]);
  const weakNodes = nodes.filter(n => !masteredNodes[n.id] && nodes.length > 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--ghost-white)',
          borderRadius: 16,
          width: '100%', maxWidth: 480,
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--whisper-grey)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-dark)' }}>Estadísticas de aprendizaje</div>
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{summary?.title}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--soft-grey)', background: 'transparent', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Flashcards', value: flashcards.length, sub: known > 0 ? `${Math.round((known / flashcards.length) * 100)}% dominadas` : 'Sin progreso' },
              { label: 'Preguntas', value: questions.length, sub: lastPct != null ? `Último: ${lastPct}%` : 'Sin intentos' },
              { label: 'Nodos', value: `${masteredCount}/${totalNodes}`, sub: 'conceptos dominados' },
            ].map(k => (
              <div key={k.label} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-dark)' }}>{k.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-light)' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Chart type toggle */}
          {(flashcards.length > 0 || barData.length > 0) && (
            <div style={{ marginBottom: 16, display: 'flex', gap: 6 }}>
              {['pie', 'bar'].map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    background: chartType === t ? 'var(--text-dark)' : 'transparent',
                    color: chartType === t ? 'white' : 'var(--text-light)',
                    border: `1px solid ${chartType === t ? 'var(--text-dark)' : 'var(--soft-grey)'}`,
                  }}
                >
                  {t === 'pie' ? '⬤ Circular' : '▮ Barras'}
                </button>
              ))}
            </div>
          )}

          {/* Charts */}
          {chartType === 'pie' && flashcards.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 12, fontWeight: 500 }}>Progreso en flashcards</div>
              <PieChart data={pieData} />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-light)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'bar' && barData.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4, fontWeight: 500 }}>
                Historial de quizzes · Promedio: {avgPct}%
              </div>
              <BarChart data={barData} />
            </div>
          )}

          {chartType === 'bar' && barData.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-light)', marginBottom: 24 }}>
              Aún no hay quizzes completados
            </div>
          )}

          {/* Strong / Weak nodes */}
          {totalNodes > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#5a9060', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>✓ Dominados ({strongNodes.length})</div>
                {strongNodes.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Ninguno aún</div>
                  : strongNodes.map(n => (
                    <div key={n.id} style={{ fontSize: 11, color: 'var(--text-mid)', padding: '4px 0', borderBottom: '1px solid var(--whisper-grey)' }}>{n.label}</div>
                  ))
                }
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ash-plum)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>✗ Para repasar ({weakNodes.length})</div>
                {weakNodes.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--text-light)' }}>¡Todo dominado!</div>
                  : weakNodes.slice(0, 6).map(n => (
                    <div key={n.id} style={{ fontSize: 11, color: 'var(--text-mid)', padding: '4px 0', borderBottom: '1px solid var(--whisper-grey)' }}>{n.label}</div>
                  ))
                }
                {weakNodes.length > 6 && <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 4 }}>+{weakNodes.length - 6} más</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
