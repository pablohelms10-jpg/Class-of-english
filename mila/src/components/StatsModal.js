import React, { useState } from 'react';

const GREEN = '#7BAE7F';
const AMBER = '#C1A97A';
const GREY = 'var(--whisper-grey)';
const PLUM = '#A89098';

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: 130, height: 130, borderRadius: '50%', background: 'var(--soft-grey)', margin: '0 auto' }} />;
  let cum = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = Math.cos(cum), y1 = Math.sin(cum);
    cum += angle;
    const x2 = Math.cos(cum), y2 = Math.sin(cum);
    return { ...d, path: `M 0 0 L ${x1} ${y1} A 1 1 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z` };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg viewBox="-1.1 -1.1 2.2 2.2" style={{ width: 130, height: 130 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
        {data.filter(d => d.value > 0).map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-light)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, maxVal }) {
  if (!data.length) return null;
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 110 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 8, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{d.value}{d.unit || ''}</span>
          <div style={{
            width: '100%', borderRadius: '3px 3px 0 0',
            height: `${Math.max(4, (d.value / max) * 76)}px`,
            background: d.color || (d.value >= 70 ? `linear-gradient(180deg,${GREEN},#5a9060)` : `linear-gradient(180deg,${AMBER},${PLUM})`),
          }} />
          <span style={{ fontSize: 8, color: 'var(--text-light)', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function ViewToggle({ view, setView }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {[['list', '≡ Lista'], ['pie', '⬤ Pastel'], ['bar', '▮ Barras']].map(([id, label]) => (
        <button key={id} onClick={() => setView(id)} style={{
          padding: '4px 10px', borderRadius: 16, fontSize: 10, cursor: 'pointer',
          background: view === id ? 'var(--driftwood)' : 'transparent',
          color: view === id ? '#fff' : 'var(--text-light)',
          border: `1px solid ${view === id ? 'var(--driftwood)' : 'var(--soft-grey)'}`,
          fontWeight: view === id ? 600 : 400,
        }}>{label}</button>
      ))}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-light)' }}>{text}</div>;
}

// ── Section components ────────────────────────────────────────────────────────

function FlashcardsSection({ flashcards, knownIds, unknownIds }) {
  const [view, setView] = useState('list');
  const known = flashcards.filter(c => knownIds.has(c.id));
  const unknown = flashcards.filter(c => unknownIds.has(c.id));
  const unseen = flashcards.filter(c => !knownIds.has(c.id) && !unknownIds.has(c.id));

  if (!flashcards.length) return <Empty text="Sin flashcards generadas aún" />;

  const pieData = [
    { value: known.length, color: GREEN, label: `Dominadas (${known.length})` },
    { value: unknown.length, color: PLUM, label: `Para repasar (${unknown.length})` },
    { value: unseen.length, color: GREY, label: `Sin ver (${unseen.length})` },
  ];
  const barData = [
    { value: known.length, label: 'Dominadas', color: GREEN },
    { value: unknown.length, label: 'Repasar', color: PLUM },
    { value: unseen.length, label: 'Sin ver', color: GREY },
  ];

  return (
    <>
      <ViewToggle view={view} setView={setView} />
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Dominadas', count: known.length, color: GREEN },
            { label: 'Para repasar', count: unknown.length, color: PLUM },
            { label: 'Sin ver', count: unseen.length, color: GREY },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-dark)' }}>{row.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)' }}>{row.count}</span>
              <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--soft-grey)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.round((row.count / flashcards.length) * 100)}%`, background: row.color }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-light)', width: 30, textAlign: 'right' }}>
                {Math.round((row.count / flashcards.length) * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
      {view === 'pie' && <PieChart data={pieData} />}
      {view === 'bar' && <BarChart data={barData} maxVal={flashcards.length} />}
    </>
  );
}

function QuestionsSection({ questions, quizHistory }) {
  const [view, setView] = useState('list');
  // Per-concept question counts
  const byLabel = {};
  questions.forEach(q => {
    if (!byLabel[q.conceptLabel]) byLabel[q.conceptLabel] = 0;
    byLabel[q.conceptLabel]++;
  });
  const rows = Object.entries(byLabel).sort((a, b) => b[1] - a[1]);
  const maxQ = rows.length ? rows[0][1] : 1;

  if (!questions.length) return <Empty text="Sin preguntas generadas aún" />;

  const pieData = rows.map(([label, count], i) => ({
    value: count,
    color: `hsl(${(i * 47) % 360}, 40%, 55%)`,
    label: `${label} (${count})`,
  }));
  const barData = rows.slice(0, 10).map(([label, count]) => ({
    value: count, label: label.length > 8 ? label.slice(0, 7) + '…' : label,
    unit: 'p',
  }));

  return (
    <>
      <ViewToggle view={view} setView={setView} />
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {rows.map(([label, count]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label || '—'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dark)', flexShrink: 0 }}>{count} preg.</span>
              <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--soft-grey)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.round((count / maxQ) * 100)}%`, background: AMBER }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {view === 'pie' && <PieChart data={pieData} />}
      {view === 'bar' && <BarChart data={barData} maxVal={maxQ} />}
    </>
  );
}

function NodesSection({ nodes, masteredNodes, flashcards, knownIds }) {
  const [view, setView] = useState('list');
  const mastered = nodes.filter(n => masteredNodes[n.id]).length;
  const notMastered = nodes.length - mastered;

  if (!nodes.length) return <Empty text="Sin mapa conceptual generado aún" />;

  const nodeRows = nodes.map(n => {
    const nodeCards = flashcards.filter(f => f.conceptLabel === n.label);
    const knownCount = nodeCards.filter(c => knownIds.has(c.id)).length;
    const pct = nodeCards.length > 0 ? Math.round((knownCount / nodeCards.length) * 100) : null;
    return { ...n, isMastered: !!masteredNodes[n.id], pct };
  });

  const pieData = [
    { value: mastered, color: GREEN, label: `Dominados (${mastered})` },
    { value: notMastered, color: GREY, label: `Pendientes (${notMastered})` },
  ];
  const barData = nodeRows.map(n => ({
    value: n.isMastered ? 100 : n.pct ?? 0,
    label: n.label.length > 8 ? n.label.slice(0, 7) + '…' : n.label,
    color: n.isMastered ? GREEN : n.pct != null && n.pct >= 60 ? AMBER : PLUM,
    unit: '%',
  }));

  return (
    <>
      <ViewToggle view={view} setView={setView} />
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nodeRows.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: n.isMastered ? GREEN : n.pct != null && n.pct >= 60 ? AMBER : GREY }} />
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
              {n.pct != null && <span style={{ fontSize: 10, color: 'var(--text-light)', flexShrink: 0 }}>{n.isMastered ? '100' : n.pct}%</span>}
              <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--soft-grey)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ height: '100%', borderRadius: 2, width: n.isMastered ? '100%' : n.pct != null ? `${n.pct}%` : '0%', background: n.isMastered ? GREEN : AMBER }} />
              </div>
              {n.isMastered && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, flexShrink: 0 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
      {view === 'pie' && <PieChart data={pieData} />}
      {view === 'bar' && <BarChart data={barData} maxVal={100} />}
    </>
  );
}

function QuizSection({ quizHistory }) {
  const [view, setView] = useState('list');
  if (!quizHistory.length) return <Empty text="Aún no hay quizzes completados" />;

  const avg = Math.round(quizHistory.reduce((s, h) => s + h.pct, 0) / quizHistory.length);
  const above70 = quizHistory.filter(h => h.pct >= 70).length;
  const below70 = quizHistory.length - above70;

  const pieData = [
    { value: above70, color: GREEN, label: `≥ 70% (${above70})` },
    { value: below70, color: PLUM, label: `< 70% (${below70})` },
  ];
  const barData = quizHistory.slice(0, 10).reverse().map(h => ({
    value: h.pct,
    label: new Date(h.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    unit: '%',
  }));

  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 10 }}>
        {quizHistory.length} intentos · Promedio: <strong style={{ color: avg >= 70 ? GREEN : PLUM }}>{avg}%</strong>
      </div>
      <ViewToggle view={view} setView={setView} />
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {quizHistory.slice(0, 8).map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-light)', width: 60, flexShrink: 0 }}>
                {new Date(h.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              </span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--soft-grey)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${h.pct}%`, background: h.pct >= 70 ? GREEN : PLUM }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: h.pct >= 70 ? GREEN : PLUM, width: 36, textAlign: 'right' }}>{h.pct}%</span>
            </div>
          ))}
        </div>
      )}
      {view === 'pie' && <PieChart data={pieData} />}
      {view === 'bar' && <BarChart data={barData} maxVal={100} />}
    </>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function StatsModal({ summary, onClose }) {
  const [tab, setTab] = useState('flashcards');

  const flashcards = summary?.flashcards || [];
  const questions = summary?.questions || [];
  const progress = summary?.flashcardProgress || {};
  const quizHistory = summary?.quizHistory || [];
  const masteredNodes = summary?.masteredNodes || {};
  const nodes = summary?.conceptMap?.nodes || [];

  const knownIds = new Set(progress.known || []);
  const unknownIds = new Set(progress.unknown || []);
  const known = flashcards.filter(c => knownIds.has(c.id)).length;
  const masteredCount = nodes.filter(n => masteredNodes[n.id]).length;
  const lastPct = quizHistory.length > 0 ? quizHistory[0].pct : null;

  const TABS = [
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'questions', label: 'Preguntas' },
    { id: 'nodes', label: 'Nodos' },
    { id: 'quiz', label: 'Quiz' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--ghost-white)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--whisper-grey)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--ghost-white)', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)' }}>Estadísticas de aprendizaje</div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{summary?.title}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--soft-grey)', background: 'transparent', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)' }}>✕</button>
        </div>

        {/* KPIs */}
        <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderBottom: '1px solid var(--whisper-grey)' }}>
          {[
            { label: 'Flashcards', value: flashcards.length, sub: flashcards.length > 0 ? `${Math.round((known / flashcards.length) * 100)}% dom.` : '—' },
            { label: 'Preguntas', value: questions.length, sub: '—' },
            { label: 'Nodos', value: `${masteredCount}/${nodes.length}`, sub: 'dom.' },
            { label: 'Quiz', value: quizHistory.length, sub: lastPct != null ? `Últ: ${lastPct}%` : '—' },
          ].map(k => (
            <div key={k.label} style={{ padding: '10px 8px', borderRadius: 10, background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-dark)' }}>{k.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{k.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-light)' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--whisper-grey)', padding: '0 20px', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 12px', fontSize: 11, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--driftwood)' : 'transparent'}`,
              color: tab === t.id ? 'var(--text-dark)' : 'var(--text-light)',
              marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Section content */}
        <div style={{ padding: '16px 20px 20px' }}>
          {tab === 'flashcards' && <FlashcardsSection flashcards={flashcards} knownIds={knownIds} unknownIds={unknownIds} />}
          {tab === 'questions' && <QuestionsSection questions={questions} quizHistory={quizHistory} />}
          {tab === 'nodes' && <NodesSection nodes={nodes} masteredNodes={masteredNodes} flashcards={flashcards} knownIds={knownIds} />}
          {tab === 'quiz' && <QuizSection quizHistory={quizHistory} />}
        </div>

      </div>
    </div>
  );
}
