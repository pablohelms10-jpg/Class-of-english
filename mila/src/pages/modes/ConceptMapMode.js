import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useMila } from '../../context/MilaContext';
import { generateConceptMapAI, assignImagesToNodes, quickAssignImages, generateFlashcardsAI, generateQuestionsAI, generateNodeFlashcardsAI, generateNodeQuestionsAI } from '../../utils/aiService';
import { generateConceptMap } from '../../utils/parseContent';
import MilaLoadingScreen from '../../components/MilaLoadingScreen';
import { MapIcon } from '../../components/Icons';

const NODE_W = 272;
const CANVAS_W = 2400;
const CANVAS_H = 1600;
const INIT_SCALE = 0.5;
const INIT_PAN = { x: 60, y: 60 };

// Physics-based node spreading — ensures minimum distance between nodes
function spreadNodes(nodes) {
  const MIN = 360;
  const ns = nodes.map(n => ({ ...n }));
  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x;
        const dy = ns[j].y - ns[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN && dist > 0.1) {
          const push = ((MIN - dist) / dist) * 0.52;
          const px = dx * push, py = dy * push;
          if (ns[i].type !== 'main') { ns[i].x -= px; ns[i].y -= py; }
          if (ns[j].type !== 'main') { ns[j].x += px; ns[j].y += py; }
        }
      }
    }
  }
  return ns.map(n => ({
    ...n,
    x: Math.max(60, Math.min(CANVAS_W - NODE_W - 60, n.x)),
    y: Math.max(60, Math.min(CANVAS_H - 300, n.y)),
  }));
}

// Compute edge path — always an organic S-curve
function edgePath(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
  if (Math.abs(dx) > Math.abs(dy)) {
    const midX = (fx + tx) / 2;
    return `M ${fx} ${fy} C ${midX} ${fy} ${midX} ${ty} ${tx} ${ty}`;
  }
  const midY = (fy + ty) / 2;
  return `M ${fx} ${fy} C ${fx} ${midY} ${tx} ${midY} ${tx} ${ty}`;
}

// ─── Mini flashcard (dark theme) ────────────────────────────────────────────
function MiniFlashcard({ card }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      onClick={e => { e.stopPropagation(); setFlipped(f => !f); }}
      style={{
        marginTop: 10, borderRadius: 8, cursor: 'pointer', userSelect: 'none',
        border: `1px solid ${flipped ? 'rgba(140,100,200,0.35)' : 'rgba(255,255,255,0.09)'}`,
        background: flipped ? 'rgba(140,100,200,0.1)' : 'rgba(255,255,255,0.04)',
        padding: '9px 11px', transition: 'background 0.25s, border-color 0.25s',
      }}
    >
      <div style={{ fontSize: 9.5, color: flipped ? 'rgba(180,150,255,0.8)' : 'rgba(255,255,255,0.3)', marginBottom: 5, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
        {flipped ? 'Respuesta' : 'Flashcard · tocá para ver'}
      </div>
      <div style={{ fontSize: 11, color: flipped ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>
        {flipped ? card.back : card.front}
      </div>
      {flipped && card.context && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
          {card.context}
        </div>
      )}
    </div>
  );
}

// ─── Mini question (dark theme) ─────────────────────────────────────────────
function MiniQuestion({ question }) {
  const [selected, setSelected] = useState(null);
  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', padding: '9px 11px', userSelect: 'none' }}>
      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Pregunta</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, marginBottom: 8 }}>{question.question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(question.options || []).map((opt, i) => {
          const isCorrect = opt === question.correct;
          const isSelected = selected === opt;
          let bg = 'rgba(255,255,255,0.04)', border = 'rgba(255,255,255,0.08)', color = 'rgba(255,255,255,0.65)';
          if (selected) {
            if (isCorrect) { bg = 'rgba(74,222,128,0.12)'; border = 'rgba(74,222,128,0.4)'; color = '#4ade80'; }
            else if (isSelected) { bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.35)'; color = '#f87171'; }
          }
          return (
            <button key={i} onClick={() => { if (!selected) setSelected(opt); }}
              style={{ textAlign: 'left', padding: '5px 9px', borderRadius: 6, border: `1px solid ${border}`, background: bg, color, fontSize: 10, lineHeight: 1.4, cursor: selected ? 'default' : 'pointer', transition: 'all 0.2s' }}>
              {opt}
            </button>
          );
        })}
      </div>
      {selected && question.explanation && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 7, fontStyle: 'italic', lineHeight: 1.4 }}>
          {question.explanation}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ConceptMapMode({ summary }) {
  const { updateSummary } = useMila();
  const text = summary?.text || '';
  const images = summary?.images || [];
  const cached = summary?.conceptMap;
  const masteredNodes = summary?.masteredNodes || {};
  const flashcards = summary?.flashcards || [];
  const questions = summary?.questions || [];

  const [mapData, setMapData] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [expanded, setExpanded] = useState(new Set([0]));
  const [positions, setPositions] = useState(() => {
    if (cached?.nodes) {
      const p = {};
      cached.nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
      return p;
    }
    return {};
  });
  const [scale, setScale] = useState(INIT_SCALE);
  const [pan, setPan] = useState(INIT_PAN);
  const [isPanning, setIsPanning] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodeGenerating, setNodeGenerating] = useState({});
  const [reassigning, setReassigning] = useState(false);

  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const panStart = useRef(null);
  const containerRef = useRef(null);
  const momentumRef = useRef(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(null);
  const dragTargetRef = useRef(null);
  const springRafRef = useRef(null);

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  useEffect(() => {
    const onFSChange = () => {
      if (!(document.fullscreenElement || document.webkitFullscreenElement) && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => { document.removeEventListener('fullscreenchange', onFSChange); document.removeEventListener('webkitfullscreenchange', onFSChange); };
  }, [isFullscreen]);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  function toggleFullscreen() {
    if (isFullscreen) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      setIsFullscreen(false); return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req) req.call(el).then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(true));
    else setIsFullscreen(true);
  }

  function applyNodes(nodes) {
    const p = {};
    nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
    setPositions(p);
  }

  function applyMap(data) {
    let nodes = spreadNodes(data.nodes);
    if (images.length > 0) {
      const qi = quickAssignImages(nodes.length, images);
      nodes = nodes.map((n, i) => ({ ...n, imageIndex: qi[i] ?? null }));
    }
    const quick = { ...data, nodes };
    setMapData(quick);
    applyNodes(quick.nodes);
    updateSummary(summary.id, { conceptMap: quick });
    if (images.length > 0) {
      assignImagesToNodes(nodes, images)
        .then(withImg => { const r = { ...quick, nodes: withImg }; setMapData(r); updateSummary(summary.id, { conceptMap: r }); })
        .catch(() => {});
    }
    const hasTagged = (summary.flashcards || []).some(f => f.conceptLabel);
    if (!hasTagged && text) {
      generateFlashcardsAI(text, [], images, nodes).then(({ cards }) => updateSummary(summary.id, { flashcards: cards })).catch(() => {});
      generateQuestionsAI(text, [], images, nodes).then(({ questions: qs }) => updateSummary(summary.id, { questions: qs })).catch(() => {});
    }
  }

  useEffect(() => {
    if (cached) {
      if (images.length > 0 && cached.nodes && !cached.nodes.some(n => n.imageIndex != null)) {
        const qi = quickAssignImages(cached.nodes.length, images);
        const upgraded = { ...cached, nodes: cached.nodes.map((n, i) => ({ ...n, imageIndex: qi[i] ?? null })) };
        setMapData(upgraded); applyNodes(upgraded.nodes);
        updateSummary(summary.id, { conceptMap: upgraded });
        assignImagesToNodes(upgraded.nodes, images)
          .then(withImg => { const r = { ...upgraded, nodes: withImg }; setMapData(r); updateSummary(summary.id, { conceptMap: r }); })
          .catch(() => {});
      }
      return;
    }
    setLoading(true);
    generateConceptMapAI(text)
      .then(data => { if (!data?.nodes?.length) throw new Error('empty'); applyMap(data); })
      .catch(() => { const fb = generateConceptMap(text); if (fb?.nodes?.length) applyMap(fb); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function regenerate() {
    setLoading(true); setMapData(null); setExpanded(new Set([0]));
    setScale(INIT_SCALE); setPan(INIT_PAN);
    updateSummary(summary.id, { conceptMap: null });
    generateConceptMapAI(text)
      .then(data => { if (!data?.nodes?.length) throw new Error('empty'); applyMap(data); })
      .catch(() => { const fb = generateConceptMap(text); if (fb?.nodes?.length) applyMap(fb); })
      .finally(() => setLoading(false));
  }

  function zoom(factor, cx, cy) {
    if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
    const prev = scaleRef.current;
    const next = Math.min(3, Math.max(0.15, prev * factor));
    scaleRef.current = next;
    setScale(next);
    if (cx != null && cy != null) {
      const p = panRef.current;
      const np = { x: cx - (cx - p.x) * (next / prev), y: cy - (cy - p.y) * (next / prev) };
      panRef.current = np; setPan(np);
    }
  }

  // Wheel + touch (passive:false required for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleWheel(e) {
      e.preventDefault(); e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) { zoom(e.deltaY < 0 ? 1.1 : 0.9, cx, cy); }
      else {
        if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
        const np = { x: panRef.current.x - e.deltaX, y: panRef.current.y - e.deltaY };
        panRef.current = np; setPan(np);
      }
    }
    let lastTouches = null, touchMoved = false;
    function handleTouchStart(e) {
      touchMoved = false;
      if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
      velocityRef.current = { x: 0, y: 0 };
      lastTouchTimeRef.current = Date.now();
      lastTouches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    }
    function handleTouchMove(e) {
      e.preventDefault(); touchMoved = true;
      const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
      if (!lastTouches || lastTouches.length !== touches.length) { lastTouches = touches; lastTouchTimeRef.current = Date.now(); return; }
      const rect = el.getBoundingClientRect();
      const now = Date.now(), dt = Math.max(1, now - (lastTouchTimeRef.current || now));
      lastTouchTimeRef.current = now;
      if (touches.length === 2 && lastTouches.length === 2) {
        const prevDist = Math.hypot(lastTouches[1].x - lastTouches[0].x, lastTouches[1].y - lastTouches[0].y);
        const nextDist = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
        const factor = prevDist > 0 ? nextDist / prevDist : 1;
        const cx = (touches[0].x + touches[1].x) / 2 - rect.left;
        const cy = (touches[0].y + touches[1].y) / 2 - rect.top;
        const ddx = ((touches[0].x - lastTouches[0].x) + (touches[1].x - lastTouches[1].x)) / 2;
        const ddy = ((touches[0].y - lastTouches[0].y) + (touches[1].y - lastTouches[1].y)) / 2;
        zoom(factor, cx, cy);
        const np = { x: panRef.current.x + ddx, y: panRef.current.y + ddy };
        panRef.current = np; setPan(np); velocityRef.current = { x: 0, y: 0 };
      } else if (touches.length === 1 && lastTouches.length === 1) {
        const ddx = touches[0].x - lastTouches[0].x, ddy = touches[0].y - lastTouches[0].y;
        velocityRef.current = { x: (ddx / dt) * 16, y: (ddy / dt) * 16 };
        const np = { x: panRef.current.x + ddx, y: panRef.current.y + ddy };
        panRef.current = np; setPan(np);
      }
      lastTouches = touches;
    }
    function handleTouchEnd(e) {
      if (!touchMoved) { lastTouches = null; return; }
      const { x: vx, y: vy } = velocityRef.current;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        let vel = { x: vx, y: vy };
        const friction = 0.91;
        function tick() {
          vel.x *= friction; vel.y *= friction;
          if (Math.abs(vel.x) < 0.25 && Math.abs(vel.y) < 0.25) { momentumRef.current = null; return; }
          const np = { x: panRef.current.x + vel.x, y: panRef.current.y + vel.y };
          panRef.current = np; setPan(np);
          momentumRef.current = requestAnimationFrame(tick);
        }
        momentumRef.current = requestAnimationFrame(tick);
      }
      lastTouches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    }
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isFullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCanvasPanStart = useCallback(e => {
    if (dragging) return;
    if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
    setIsPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
  }, [dragging]);

  const onMouseMove = useCallback(e => {
    if (dragging) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const tx = (e.clientX - rect.left - panRef.current.x) / scaleRef.current - dragging.ox;
      const ty = (e.clientY - rect.top - panRef.current.y) / scaleRef.current - dragging.oy;
      if (dragTargetRef.current) { dragTargetRef.current.x = tx; dragTargetRef.current.y = ty; }
    } else if (isPanning && panStart.current) {
      const np = { x: panStart.current.px + (e.clientX - panStart.current.mx), y: panStart.current.py + (e.clientY - panStart.current.my) };
      panRef.current = np; setPan(np);
    }
  }, [dragging, isPanning]);

  const onMouseUp = useCallback(() => {
    setDragging(null); setIsPanning(false); panStart.current = null;
    dragTargetRef.current = null;
    if (springRafRef.current) { cancelAnimationFrame(springRafRef.current); springRafRef.current = null; }
  }, []);

  function startNodeDrag(e, node) {
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[node.id] || { x: node.x, y: node.y };
    const info = {
      id: node.id,
      ox: (e.clientX - rect.left - panRef.current.x) / scaleRef.current - pos.x,
      oy: (e.clientY - rect.top - panRef.current.y) / scaleRef.current - pos.y,
    };
    setDragging(info);
    dragTargetRef.current = { id: node.id, x: pos.x, y: pos.y };
    if (springRafRef.current) cancelAnimationFrame(springRafRef.current);
    function springLoop() {
      const t = dragTargetRef.current;
      if (!t) { springRafRef.current = null; return; }
      setPositions(prev => {
        const cur = prev[t.id] || { x: t.x, y: t.y };
        const dx = t.x - cur.x, dy = t.y - cur.y;
        if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15) return prev;
        return { ...prev, [t.id]: { x: cur.x + dx * 0.14, y: cur.y + dy * 0.14 } };
      });
      springRafRef.current = requestAnimationFrame(springLoop);
    }
    springRafRef.current = requestAnimationFrame(springLoop);
  }

  function toggleExpand(id) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleMastered(nodeId) {
    updateSummary(summary.id, { masteredNodes: { ...masteredNodes, [nodeId]: !masteredNodes[nodeId] } });
  }

  async function generateNodeCards(node) {
    setNodeGenerating(prev => ({ ...prev, [node.id]: 'flashcards' }));
    try {
      const existing = (summary.flashcards || []).filter(f => f.conceptLabel === node.label);
      const newCards = await generateNodeFlashcardsAI(node, existing);
      updateSummary(summary.id, { flashcards: [...(summary.flashcards || []), ...newCards] });
    } catch { /* silent */ }
    setNodeGenerating(prev => ({ ...prev, [node.id]: null }));
  }

  async function generateNodeQs(node) {
    setNodeGenerating(prev => ({ ...prev, [node.id]: 'questions' }));
    try {
      const existing = (summary.questions || []).filter(q => q.conceptLabel === node.label);
      const newQs = await generateNodeQuestionsAI(node, existing);
      updateSummary(summary.id, { questions: [...(summary.questions || []), ...newQs] });
    } catch { /* silent */ }
    setNodeGenerating(prev => ({ ...prev, [node.id]: null }));
  }

  async function reassignImages() {
    if (!mapData || images.length === 0) return;
    setReassigning(true);
    try {
      const withImg = await assignImagesToNodes(mapData.nodes, images);
      const updated = { ...mapData, nodes: withImg };
      setMapData(updated); updateSummary(summary.id, { conceptMap: updated });
    } catch { /* silent */ }
    setReassigning(false);
  }

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (loading) return <MilaLoadingScreen message="Construyendo el mapa…" sub="Analizando contenido…" />;

  if (!mapData || !mapData.nodes?.length) return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.4 }}>
        <MapIcon size={48} color="var(--text-light)" />
      </div>
      <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-light)' }}>No hay suficiente contenido para generar un mapa.</p>
      <button onClick={regenerate} style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 14 }}>
        Intentar de nuevo
      </button>
    </div>
  );

  const nodes = mapData.nodes;
  const edges = mapData.edges || [];
  const masteredCount = nodes.filter(n => masteredNodes[n.id]).length;
  const progressPct = nodes.length > 0 ? (masteredCount / nodes.length) * 100 : 0;

  // ── Map content ────────────────────────────────────────────────────────────
  const mapContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: isFullscreen ? '100%' : undefined }}>

      {/* CSS keyframes — injected once */}
      <style>{`
        [data-mila-map],[data-mila-map] *{touch-action:none!important;-webkit-user-select:none;user-select:none}
        @keyframes neuralFlow {
          0%   { stroke-dashoffset: 800; opacity: 0; }
          6%   { opacity: 1; }
          90%  { opacity: 0.85; }
          100% { stroke-dashoffset: -60; opacity: 0; }
        }
        @keyframes synapseGlow {
          0%,100% { opacity: 0.5; r: 10; }
          50%     { opacity: 0.9; r: 14; }
        }
        @keyframes coreBreath {
          0%,100% { opacity: 0.15; }
          50%     { opacity: 0.32; }
        }
      `}</style>

      {/* Progress bar */}
      <div style={{ marginBottom: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.4px' }}>
            {masteredCount} / {nodes.length} dominados
          </span>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2px' }}>
            {mapData.title || ''}
          </span>
        </div>
        <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: 1, transition: 'width 0.5s ease',
            background: progressPct === 100 ? 'rgba(74,222,128,0.6)' : 'linear-gradient(90deg,rgba(130,90,210,0.7),rgba(180,140,100,0.6))' }} />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2px' }}>
          {isFullscreen ? 'Pellizca · arrastrá · esc salir' : 'Pellizca · arrastrá · pantalla completa ⛶'}
        </span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => zoom(1.2)} style={toolBtn} title="Acercar">+</button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', minWidth: 32, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => zoom(1 / 1.2)} style={toolBtn} title="Alejar">−</button>
          <button onClick={() => { setScale(INIT_SCALE); setPan(INIT_PAN); }} style={toolBtn} title="Restablecer">⊙</button>
          {images.length > 0 && (
            <button onClick={reassignImages} disabled={reassigning}
              style={{ ...toolBtn, padding: '0 10px', width: 'auto', opacity: reassigning ? 0.5 : 1, fontSize: 10 }}>
              {reassigning ? '⟳' : '🖼'}
            </button>
          )}
          <button onClick={regenerate} style={{ ...toolBtn, padding: '0 10px', width: 'auto', fontSize: 10 }}>↺ Nuevo</button>
          <button onClick={toggleFullscreen} style={{ ...toolBtn, fontSize: 15, width: 30 }}>⛶</button>
        </div>
      </div>

      {/* Canvas */}
      <div
        data-mila-map=""
        ref={containerRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onCanvasPanStart}
        style={{
          width: '100%',
          height: isFullscreen ? undefined : 640,
          flex: isFullscreen ? 1 : undefined,
          overflow: 'hidden',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
          background: '#0b0b0e',
          userSelect: 'none', touchAction: 'none', WebkitOverflowScrolling: 'auto',
        }}
      >
        {/* Dot grid */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '26px 26px' }} />

        {/* Transformed canvas */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H,
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: '0 0',
          willChange: 'transform', zIndex: 1 }}>

          {/* ── SVG EDGES — neural synapse effect ── */}
          <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
            <defs>
              <filter id="fGlowHard" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
              </filter>
              <filter id="fGlowSoft" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" />
              </filter>
              <filter id="fPoint" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
              </filter>
            </defs>

            {edges.map((edge, i) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const fp = positions[fromNode.id] || { x: fromNode.x, y: fromNode.y };
              const tp = positions[toNode.id] || { x: toNode.x, y: toNode.y };
              const fx = fp.x + NODE_W / 2, fy = fp.y + 34;
              const tx = tp.x + NODE_W / 2, ty = tp.y + 34;
              const d = edgePath(fx, fy, tx, ty);
              const dur = `${3 + (i * 0.7) % 2.5}s`;
              const delay = `${(i * 1.1) % 5}s`;
              return (
                <g key={i}>
                  {/* Endpoint terminal glow — synapse bulge */}
                  <circle cx={fx} cy={fy} r="16" fill="white" opacity="0.035" filter="url(#fPoint)" />
                  <circle cx={tx} cy={ty} r="16" fill="white" opacity="0.035" filter="url(#fPoint)" />
                  <circle cx={fx} cy={fy} r="3.5" fill="white" opacity="0.45" />
                  <circle cx={tx} cy={ty} r="3.5" fill="white" opacity="0.45" />
                  <circle cx={fx} cy={fy} r="1.5" fill="white" opacity="0.9" />
                  <circle cx={tx} cy={ty} r="1.5" fill="white" opacity="0.9" />

                  {/* Outer diffuse glow path */}
                  <path d={d} fill="none" stroke="white" strokeWidth="22" opacity="0.022"
                    filter="url(#fGlowHard)" strokeLinecap="round" />
                  {/* Mid glow — breathing */}
                  <path d={d} fill="none" stroke="white" strokeWidth="7" opacity="0.07"
                    filter="url(#fGlowSoft)" strokeLinecap="round"
                    style={{ animation: `coreBreath ${3 + (i % 3) * 0.8}s ease-in-out ${delay} infinite` }} />
                  {/* Static core — thin */}
                  <path d={d} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.75" strokeLinecap="round" />

                  {/* Traveling pulse glow */}
                  <path d={d} fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="50 750" strokeDashoffset="800" opacity="0.22"
                    filter="url(#fGlowSoft)"
                    style={{ animation: `neuralFlow ${dur} ease-in-out ${delay} infinite` }} />
                  {/* Traveling pulse core */}
                  <path d={d} fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"
                    strokeDasharray="24 776" strokeDashoffset="800" opacity="1"
                    style={{ animation: `neuralFlow ${dur} ease-in-out ${delay} infinite` }} />

                  {edge.label && (
                    <text
                      x={(fx + tx) / 2} y={(fy + ty) / 2 - 10}
                      textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.22)"
                      fontFamily="Inter,sans-serif" letterSpacing="0.6"
                    >{edge.label}</text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── NODES ── */}
          {nodes.map(node => {
            const pos = positions[node.id] || { x: node.x, y: node.y };
            const isExpanded = expanded.has(node.id);
            const isMain = node.type === 'main';
            const isSub = node.type === 'sub';
            const img = node.imageIndex != null && node.imageIndex >= 0 && images[node.imageIndex] ? images[node.imageIndex] : null;
            const isMastered = !!masteredNodes[node.id];
            const linkedCard = flashcards.find(f => f.conceptLabel === node.label) || null;
            const linkedQuestion = questions.find(q => q.conceptLabel === node.label) || null;
            const nodeCardCount = flashcards.filter(f => f.conceptLabel === node.label).length;
            const nodeQCount = questions.filter(q => q.conceptLabel === node.label).length;
            const genState = nodeGenerating[node.id] || null;

            // Color accent per type
            const accentColor = isMain ? 'rgba(160,120,255,0.9)' : isSub ? 'rgba(120,160,255,0.7)' : 'rgba(255,255,255,0.22)';
            const accentGlow  = isMain ? '0 0 10px rgba(160,120,255,0.55)' : isSub ? '0 0 8px rgba(120,160,255,0.4)' : 'none';

            // Card background per type
            const cardBg = isMain
              ? 'linear-gradient(160deg,rgba(36,24,56,0.98) 0%,rgba(24,18,40,0.98) 100%)'
              : 'rgba(18,18,24,0.97)';
            const cardBorder = isMain
              ? '1px solid rgba(160,120,255,0.2)'
              : isSub
              ? '1px solid rgba(255,255,255,0.1)'
              : '1px solid rgba(255,255,255,0.07)';
            const cardShadow = isExpanded
              ? `0 0 0 1px rgba(255,255,255,0.05), 0 28px 70px rgba(0,0,0,0.85)${isMain ? ', 0 0 60px rgba(130,80,220,0.12)' : ''}`
              : `0 0 0 1px rgba(255,255,255,0.03), 0 6px 28px rgba(0,0,0,0.75)`;

            return (
              <div key={node.id} style={{
                position: 'absolute', left: pos.x, top: pos.y, width: NODE_W,
                zIndex: isExpanded ? 20 : isMain ? 5 : 2,
              }}>
                <div style={{
                  borderRadius: 13, overflow: 'hidden',
                  background: cardBg, border: cardBorder, boxShadow: cardShadow,
                  transition: 'box-shadow 0.35s cubic-bezier(0.22,1,0.36,1)',
                  willChange: 'transform',
                }}>
                  {/* ── Node header ── */}
                  <div
                    onMouseDown={e => startNodeDrag(e, node)}
                    onClick={() => toggleExpand(node.id)}
                    style={{ padding: '12px 14px 11px', cursor: 'grab', display: 'flex', alignItems: 'flex-start', gap: 10, userSelect: 'none' }}
                  >
                    {/* Type indicator dot */}
                    <div style={{
                      flexShrink: 0, marginTop: 3.5, width: 8, height: 8, borderRadius: '50%',
                      background: isMastered ? '#4ade80' : accentColor,
                      boxShadow: isMastered ? '0 0 8px rgba(74,222,128,0.6)' : accentGlow,
                      transition: 'all 0.3s',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, marginBottom: 3.5, letterSpacing: '0.05px' }}>
                        {node.label}
                      </div>
                      <div style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.45,
                        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                        WebkitLineClamp: isExpanded ? 'unset' : 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {node.summary}
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 8, color: 'rgba(255,255,255,0.2)', paddingTop: 4, marginLeft: 2 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* ── Expanded content ── */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Image hero */}
                      {img && (
                        <div style={{ width: '100%', height: 190, overflow: 'hidden' }}>
                          <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', opacity: 0.88 }} />
                        </div>
                      )}

                      <div style={{ padding: '13px 14px 15px' }}>
                        {/* Content paragraph */}
                        {node.content && (
                          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.58)', lineHeight: 1.7, marginBottom: 11, marginTop: 0 }}>
                            {node.content}
                          </p>
                        )}

                        {/* Bullet list */}
                        {node.bullets?.length > 0 && (
                          <ul style={{ margin: '0 0 10px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {node.bullets.map((b, bi) => (
                              <li key={bi} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                                <span style={{ flexShrink: 0, width: 3.5, height: 3.5, borderRadius: '50%', background: accentColor, marginTop: 6, opacity: 0.7 }} />
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.68)', lineHeight: 1.55 }}>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Separator */}
                        {(linkedCard || linkedQuestion || true) && (
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
                        )}

                        {/* Linked flashcard */}
                        {linkedCard && <MiniFlashcard card={linkedCard} />}
                        {/* Linked question */}
                        {linkedQuestion && <MiniQuestion question={linkedQuestion} />}

                        {/* Generate buttons */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button
                            onClick={e => { e.stopPropagation(); generateNodeCards(node); }}
                            disabled={!!genState}
                            style={genBtn(genState && genState !== 'flashcards')}
                          >
                            {genState === 'flashcards' ? '⟳ ' : '+ '}
                            {nodeCardCount > 0 ? `Cards (${nodeCardCount})` : 'Cards'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); generateNodeQs(node); }}
                            disabled={!!genState}
                            style={genBtn(genState && genState !== 'questions')}
                          >
                            {genState === 'questions' ? '⟳ ' : '+ '}
                            {nodeQCount > 0 ? `Quiz (${nodeQCount})` : 'Quiz'}
                          </button>
                        </div>

                        {/* Mastery */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleMastered(node.id); }}
                          style={{
                            marginTop: 7, width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 500,
                            cursor: 'pointer', transition: 'all 0.25s',
                            border: isMastered ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.08)',
                            background: isMastered ? 'rgba(74,222,128,0.1)' : 'transparent',
                            color: isMastered ? '#4ade80' : 'rgba(255,255,255,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}
                        >
                          {isMastered ? '✓ Dominado' : 'Marcar como dominado'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating zoom overlay */}
        <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 100 }}>
          <button onClick={() => zoom(1.25)} style={overlayBtn} title="Acercar">+</button>
          <button onClick={() => { setScale(INIT_SCALE); setPan(INIT_PAN); }} style={{ ...overlayBtn, fontSize: 15 }} title="Restablecer">⊙</button>
          <button onClick={() => zoom(0.8)} style={overlayBtn} title="Alejar">−</button>
        </div>
      </div>

      {/* Legend */}
      {!isFullscreen && (
        <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { bg: 'rgba(160,120,255,0.7)', label: 'Principal' },
            { bg: 'rgba(120,160,255,0.5)', label: 'Subtema' },
            { bg: 'rgba(255,255,255,0.18)', label: 'Detalle' },
          ].map(({ bg, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: bg }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return ReactDOM.createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0b0b0e', display: 'flex', flexDirection: 'column', padding: '12px' }}>
        {mapContent}
      </div>,
      document.body
    );
  }

  return mapContent;
}

// ── Shared styles ────────────────────────────────────────────────────────────
const toolBtn = {
  width: 28, height: 28, borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.65)',
  fontSize: 15,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const overlayBtn = {
  width: 40, height: 40, borderRadius: 11,
  background: 'rgba(20,20,28,0.88)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: 20, fontWeight: 300,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
  transition: 'transform 0.12s ease',
};

function genBtn(dimmed) {
  return {
    flex: 1, padding: '6px 8px', borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10, fontWeight: 500, cursor: dimmed ? 'default' : 'pointer',
    opacity: dimmed ? 0.3 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
    transition: 'opacity 0.15s',
  };
}
