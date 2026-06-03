import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useMila } from '../../context/MilaContext';
import { generateConceptMapAI, assignImagesToNodes, quickAssignImages, generateFlashcardsAI, generateQuestionsAI, generateNodeFlashcardsAI, generateNodeQuestionsAI } from '../../utils/aiService';
import { generateConceptMap } from '../../utils/parseContent';
import MilaLoadingScreen from '../../components/MilaLoadingScreen';
import { MapIcon } from '../../components/Icons';

const NODE_W = 270;
const CANVAS_W = 1400;
const CANVAS_H = 1000;

// Mini flashcard component with its own flip state
function MiniFlashcard({ card }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      onClick={e => { e.stopPropagation(); setFlipped(f => !f); }}
      style={{
        marginTop: 10,
        borderRadius: 8,
        border: '1px solid var(--soft-grey)',
        background: flipped ? 'var(--pale-mist)' : 'var(--ghost-white)',
        padding: '9px 10px',
        cursor: 'pointer',
        transition: 'background 0.2s',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4, fontWeight: 500 }}>
        {flipped ? 'Respuesta' : 'Flashcard · tocá para ver'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dark)', lineHeight: 1.5 }}>
        {flipped ? card.back : card.front}
      </div>
      {flipped && card.context && (
        <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 5, fontStyle: 'italic', lineHeight: 1.4 }}>
          {card.context}
        </div>
      )}
    </div>
  );
}

// Mini question component with its own selected state
function MiniQuestion({ question }) {
  const [selected, setSelected] = useState(null);
  const options = question.options || [];
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        marginTop: 10,
        borderRadius: 8,
        border: '1px solid var(--soft-grey)',
        background: 'var(--ghost-white)',
        padding: '9px 10px',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 5, fontWeight: 500 }}>Pregunta</div>
      <div style={{ fontSize: 11, color: 'var(--text-dark)', lineHeight: 1.5, marginBottom: 7 }}>{question.question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {options.map((opt, i) => {
          const isCorrect = opt === question.correct;
          const isSelected = selected === opt;
          let bg = 'transparent';
          let borderColor = 'var(--soft-grey)';
          let color = 'var(--text-dark)';
          if (selected) {
            if (isCorrect) { bg = '#d4edda'; borderColor = '#7BAE7F'; color = '#2d6a33'; }
            else if (isSelected) { bg = '#fde8e8'; borderColor = '#e57373'; color = '#b71c1c'; }
          }
          return (
            <button
              key={i}
              onClick={() => { if (!selected) setSelected(opt); }}
              style={{
                textAlign: 'left', padding: '5px 8px', borderRadius: 6,
                border: `1px solid ${borderColor}`,
                background: bg, color, fontSize: 10, lineHeight: 1.4,
                cursor: selected ? 'default' : 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected && question.explanation && (
        <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
          {question.explanation}
        </div>
      )}
    </div>
  );
}

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

  const [scale, setScale] = useState(0.75);
  const [pan, setPan] = useState({ x: 20, y: 20 });
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
  // Spring drag: target position (follows mouse instantly), spring RAF loop
  const dragTargetRef = useRef(null); // { id, x, y }
  const springRafRef = useRef(null);

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // Sync isFullscreen with native browser fullscreen state
  useEffect(() => {
    const onFSChange = () => {
      const nativeFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!nativeFS && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, [isFullscreen]);

  // Lock body scroll when using CSS-portal fullscreen (iOS fallback)
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  function toggleFullscreen() {
    if (isFullscreen) {
      // Exit native or CSS fullscreen
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      setIsFullscreen(false);
      return;
    }
    // Try native fullscreen API first (hides browser chrome on desktop + Android)
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req) {
      req.call(el).then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(true));
    } else {
      // iOS Safari fallback: CSS portal covers viewport
      setIsFullscreen(true);
    }
  }

  function applyNodes(nodes) {
    const p = {};
    nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
    setPositions(p);
  }

  function applyMap(data) {
    let nodes = data.nodes;
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
    // Auto-generate tagged flashcards + questions if not yet done
    const hasTagged = (summary.flashcards || []).some(f => f.conceptLabel);
    if (!hasTagged && text) {
      generateFlashcardsAI(text, [], images, nodes)
        .then(({ cards }) => updateSummary(summary.id, { flashcards: cards }))
        .catch(() => {});
      generateQuestionsAI(text, [], images, nodes)
        .then(({ questions: qs }) => updateSummary(summary.id, { questions: qs }))
        .catch(() => {});
    }
  }

  useEffect(() => {
    if (cached) {
      if (images.length > 0 && cached.nodes && !cached.nodes.some(n => n.imageIndex != null)) {
        const qi = quickAssignImages(cached.nodes.length, images);
        const upgraded = { ...cached, nodes: cached.nodes.map((n, i) => ({ ...n, imageIndex: qi[i] ?? null })) };
        setMapData(upgraded);
        applyNodes(upgraded.nodes);
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
    setScale(0.75); setPan({ x: 20, y: 20 });
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
      const newPan = { x: cx - (cx - p.x) * (next / prev), y: cy - (cy - p.y) * (next / prev) };
      panRef.current = newPan;
      setPan(newPan);
    }
  }

  // Wheel + touch events attached imperatively for passive:false support
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e) {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        zoom(e.deltaY < 0 ? 1.1 : 0.9, cx, cy);
      } else {
        if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
        const p = panRef.current;
        const newPan = { x: p.x - e.deltaX, y: p.y - e.deltaY };
        panRef.current = newPan;
        setPan(newPan);
      }
    }

    let lastTouches = null;
    let touchMoved = false;

    function handleTouchStart(e) {
      // passive:false but do NOT call preventDefault here — just record positions
      touchMoved = false;
      if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
      velocityRef.current = { x: 0, y: 0 };
      lastTouchTimeRef.current = Date.now();
      lastTouches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    }

    function handleTouchMove(e) {
      e.preventDefault();
      touchMoved = true;
      const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
      if (!lastTouches || lastTouches.length !== touches.length) {
        lastTouches = touches;
        lastTouchTimeRef.current = Date.now();
        return;
      }
      const rect = el.getBoundingClientRect();
      const now = Date.now();
      const dt = Math.max(1, now - (lastTouchTimeRef.current || now));
      lastTouchTimeRef.current = now;

      if (touches.length === 2 && lastTouches.length === 2) {
        const prevDist = Math.hypot(lastTouches[1].x - lastTouches[0].x, lastTouches[1].y - lastTouches[0].y);
        const nextDist = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
        const factor = prevDist > 0 ? nextDist / prevDist : 1;
        const cx = (touches[0].x + touches[1].x) / 2 - rect.left;
        const cy = (touches[0].y + touches[1].y) / 2 - rect.top;
        const dx = ((touches[0].x - lastTouches[0].x) + (touches[1].x - lastTouches[1].x)) / 2;
        const dy = ((touches[0].y - lastTouches[0].y) + (touches[1].y - lastTouches[1].y)) / 2;
        zoom(factor, cx, cy);
        const p = panRef.current;
        const newPan = { x: p.x + dx, y: p.y + dy };
        panRef.current = newPan;
        setPan(newPan);
        velocityRef.current = { x: 0, y: 0 };
      } else if (touches.length === 1 && lastTouches.length === 1) {
        const dx = touches[0].x - lastTouches[0].x;
        const dy = touches[0].y - lastTouches[0].y;
        velocityRef.current = { x: (dx / dt) * 16, y: (dy / dt) * 16 };
        const p = panRef.current;
        const newPan = { x: p.x + dx, y: p.y + dy };
        panRef.current = newPan;
        setPan(newPan);
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
          vel.x *= friction;
          vel.y *= friction;
          if (Math.abs(vel.x) < 0.25 && Math.abs(vel.y) < 0.25) { momentumRef.current = null; return; }
          const p = panRef.current;
          const newPan = { x: p.x + vel.x, y: p.y + vel.y };
          panRef.current = newPan;
          setPan(newPan);
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
  }, [isFullscreen]); // re-attach when portal moves the canvas to a new DOM node

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
      // Update target ref only — spring loop animates positions toward it
      const tx = (e.clientX - rect.left - panRef.current.x) / scaleRef.current - dragging.ox;
      const ty = (e.clientY - rect.top - panRef.current.y) / scaleRef.current - dragging.oy;
      if (dragTargetRef.current) { dragTargetRef.current.x = tx; dragTargetRef.current.y = ty; }
    } else if (isPanning && panStart.current) {
      const newPan = {
        x: panStart.current.px + (e.clientX - panStart.current.mx),
        y: panStart.current.py + (e.clientY - panStart.current.my),
      };
      panRef.current = newPan;
      setPan(newPan);
    }
  }, [dragging, isPanning]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
    panStart.current = null;
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
    // Spring loop: node position springs toward dragTargetRef at 60fps
    if (springRafRef.current) cancelAnimationFrame(springRafRef.current);
    function springLoop() {
      const t = dragTargetRef.current;
      if (!t) { springRafRef.current = null; return; }
      setPositions(prev => {
        const cur = prev[t.id] || { x: t.x, y: t.y };
        const dx = t.x - cur.x, dy = t.y - cur.y;
        if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return prev;
        return { ...prev, [t.id]: { x: cur.x + dx * 0.16, y: cur.y + dy * 0.16 } };
      });
      springRafRef.current = requestAnimationFrame(springLoop);
    }
    springRafRef.current = requestAnimationFrame(springLoop);
  }

  function toggleExpand(id) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleMastered(nodeId) {
    const updated = { ...masteredNodes, [nodeId]: !masteredNodes[nodeId] };
    updateSummary(summary.id, { masteredNodes: updated });
  }

  async function generateNodeCards(node) {
    setNodeGenerating(prev => ({ ...prev, [node.id]: 'flashcards' }));
    try {
      const existing = (summary.flashcards || []).filter(f => f.conceptLabel === node.label);
      const newCards = await generateNodeFlashcardsAI(node, existing);
      const merged = [...(summary.flashcards || []), ...newCards];
      updateSummary(summary.id, { flashcards: merged });
    } catch { /* silent */ }
    setNodeGenerating(prev => ({ ...prev, [node.id]: null }));
  }

  async function reassignImages() {
    if (!mapData || images.length === 0) return;
    setReassigning(true);
    try {
      const withImg = await assignImagesToNodes(mapData.nodes, images);
      const updated = { ...mapData, nodes: withImg };
      setMapData(updated);
      updateSummary(summary.id, { conceptMap: updated });
    } catch { /* silent */ }
    setReassigning(false);
  }

  async function generateNodeQs(node) {
    setNodeGenerating(prev => ({ ...prev, [node.id]: 'questions' }));
    try {
      const existing = (summary.questions || []).filter(q => q.conceptLabel === node.label);
      const newQs = await generateNodeQuestionsAI(node, existing);
      const merged = [...(summary.questions || []), ...newQs];
      updateSummary(summary.id, { questions: merged });
    } catch { /* silent */ }
    setNodeGenerating(prev => ({ ...prev, [node.id]: null }));
  }

  if (loading) return <MilaLoadingScreen message="MILA está construyendo el mapa conceptual…" sub="Analizando el contenido…" />;

  if (!mapData || !mapData.nodes?.length) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.5 }}>
        <MapIcon size={48} color="var(--text-light)" />
      </div>
      <p style={{ marginBottom: 16, fontSize: 14 }}>No hay suficiente contenido para generar un mapa.</p>
      <button onClick={regenerate} style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 14 }}>Intentar de nuevo</button>
    </div>
  );

  const nodes = mapData.nodes;
  const edges = mapData.edges || [];

  // Progress bar stats
  const masteredCount = nodes.filter(n => masteredNodes[n.id]).length;
  const totalCount = nodes.length;
  const progressPct = totalCount > 0 ? (masteredCount / totalCount) * 100 : 0;

  const mapContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: isFullscreen ? '100%' : undefined }}>

      {/* Progress bar */}
      <div style={{ marginBottom: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3px' }}>
            {masteredCount} / {totalCount} conceptos dominados
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: progressPct === 100
              ? 'rgba(74,222,128,0.7)'
              : 'linear-gradient(90deg, rgba(140,100,200,0.8), rgba(180,140,100,0.7))',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.2px' }}>
          {isFullscreen
            ? (mapData.title || 'Mapa conceptual')
            : 'Pellizca · arrastrá · ⛶ pantalla completa'}
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => zoom(1.2)} style={toolBtnStyle} title="Acercar">+</button>
          <span style={{ fontSize: 11, color: 'var(--text-light)', minWidth: 34, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => zoom(1 / 1.2)} style={toolBtnStyle} title="Alejar">−</button>
          <button onClick={() => { setScale(0.75); setPan({ x: 20, y: 20 }); }} style={toolBtnStyle} title="Restablecer vista">⊙</button>
          {images.length > 0 && (
            <button
              onClick={reassignImages}
              disabled={reassigning}
              title="Reasignar imágenes leyendo el texto de cada imagen"
              style={{ ...toolBtnStyle, fontSize: 11, padding: '4px 10px', width: 'auto', opacity: reassigning ? 0.5 : 1 }}
            >
              {reassigning ? '⟳ Asignando…' : '🖼 Imágenes'}
            </button>
          )}
          <button onClick={regenerate} style={{ ...toolBtnStyle, fontSize: 11, padding: '4px 10px', width: 'auto' }}>↺ Regenerar</button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
            style={{ ...toolBtnStyle, fontSize: 17, width: 32, padding: 0 }}
          >
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <style>{`
        [data-mila-map],[data-mila-map] *{touch-action:none!important;-webkit-user-select:none;user-select:none}
        @keyframes neuralPulse {
          0%   { stroke-dashoffset: 1200; opacity: 0; }
          8%   { opacity: 1; }
          88%  { opacity: 0.9; }
          100% { stroke-dashoffset: -80; opacity: 0; }
        }
        @keyframes coreBreath {
          0%,100% { opacity: 0.22; }
          50%     { opacity: 0.42; }
        }
        .mila-node-card {
          border-radius: 14px;
          overflow: hidden;
          will-change: transform;
          transition: box-shadow 0.4s cubic-bezier(0.22,1,0.36,1);
        }
      `}</style>
      <div
        data-mila-map=""
        ref={containerRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onCanvasPanStart}
        style={{
          width: '100%',
          height: isFullscreen ? undefined : 620,
          flex: isFullscreen ? 1 : undefined,
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.07)',
          position: 'relative',
          cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
          background: '#0c0c10',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 48px rgba(0,0,0,0.7)',
          userSelect: 'none',
          touchAction: 'none',
          WebkitOverflowScrolling: 'auto',
        }}
      >
        {/* Dot grid — white, very faint, premium dark look */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none', zIndex: 0 }} />

        {/* Transformed canvas */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: CANVAS_W, height: CANVAS_H,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          zIndex: 1,
        }}>
          {/* SVG edges — neural glow with animated energy pulse */}
          <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 1 }}>
            <defs>
              <filter id="neuralGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              </filter>
              <filter id="neuralGlowSoft" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              </filter>
            </defs>
            {edges.map((edge, i) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const fp = positions[fromNode.id] || { x: fromNode.x, y: fromNode.y };
              const tp = positions[toNode.id] || { x: toNode.x, y: toNode.y };
              const fx = fp.x + NODE_W / 2, fy = fp.y + 30;
              const tx = tp.x + NODE_W / 2, ty = tp.y + 30;
              const midY = (fy + ty) / 2;
              const d = `M ${fx} ${fy} C ${fx} ${midY} ${tx} ${midY} ${tx} ${ty}`;
              const pulseDur = `${2.8 + (i * 0.55) % 1.8}s`;
              const pulseDelay = `${(i * 0.9) % 4}s`;
              return (
                <g key={i}>
                  {/* Wide outer glow — blurred, barely visible */}
                  <path d={d} fill="none" stroke="white" strokeWidth="18" opacity="0.018"
                    filter="url(#neuralGlow)" strokeLinecap="round" />
                  {/* Medium glow halo */}
                  <path d={d} fill="none" stroke="white" strokeWidth="6" opacity="0.055"
                    filter="url(#neuralGlowSoft)" strokeLinecap="round"
                    style={{ animation: `coreBreath 3.5s ease-in-out ${pulseDelay} infinite` }} />
                  {/* Core static line */}
                  <path d={d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"
                    strokeLinecap="round" />
                  {/* Traveling pulse glow */}
                  <path d={d} fill="none" stroke="white" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray="60 1140" strokeDashoffset="1200" opacity="0.28"
                    filter="url(#neuralGlowSoft)"
                    style={{ animation: `neuralPulse ${pulseDur} ease-in-out ${pulseDelay} infinite` }} />
                  {/* Traveling pulse core — bright white dot */}
                  <path d={d} fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"
                    strokeDasharray="30 1170" strokeDashoffset="1200" opacity="0.95"
                    style={{ animation: `neuralPulse ${pulseDur} ease-in-out ${pulseDelay} infinite` }} />
                  {edge.label && (
                    <text x={(fx + tx) / 2} y={midY - 8} textAnchor="middle" fontSize="9"
                      fill="rgba(255,255,255,0.3)" fontFamily="Inter, sans-serif"
                      letterSpacing="0.5">{edge.label}</text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const pos = positions[node.id] || { x: node.x, y: node.y };
            const isExpanded = expanded.has(node.id);
            const isMain = node.type === 'main';
            const isSub = node.type === 'sub';
            const img = node.imageIndex != null && node.imageIndex >= 0 && images[node.imageIndex] ? images[node.imageIndex] : null;
            const isMastered = !!masteredNodes[node.id];

            // Dot color: green if mastered, else default
            const dotColor = isMastered
              ? '#7BAE7F'
              : isMain
                ? 'rgba(255,255,255,0.7)'
                : isSub
                  ? 'var(--driftwood)'
                  : 'var(--whisper-grey)';

            // Find linked flashcard and question for this node
            const linkedCard = flashcards.find(f => f.conceptLabel === node.label) || null;
            const linkedQuestion = questions.find(q => q.conceptLabel === node.label) || null;
            const nodeCardCount = flashcards.filter(f => f.conceptLabel === node.label).length;
            const nodeQCount = questions.filter(q => q.conceptLabel === node.label).length;
            const genState = nodeGenerating[node.id] || null;

            // Dark premium node styles
            const darkMain = {
              background: 'linear-gradient(145deg, rgba(58,38,78,0.97) 0%, rgba(32,26,48,0.97) 100%)',
              border: '1px solid rgba(180,150,220,0.18)',
              boxShadow: isExpanded
                ? '0 0 0 1px rgba(180,150,220,0.12), 0 24px 60px rgba(0,0,0,0.8), 0 0 40px rgba(120,80,180,0.12)'
                : '0 0 0 1px rgba(180,150,220,0.08), 0 8px 32px rgba(0,0,0,0.7)',
            };
            const darkSub = {
              background: 'rgba(22,22,30,0.97)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: isExpanded
                ? '0 0 0 1px rgba(255,255,255,0.06), 0 20px 50px rgba(0,0,0,0.75)'
                : '0 0 0 1px rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.6)',
            };
            const darkDetail = {
              background: 'rgba(18,18,24,0.96)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: isExpanded
                ? '0 0 0 1px rgba(255,255,255,0.04), 0 16px 40px rgba(0,0,0,0.7)'
                : '0 0 0 1px rgba(255,255,255,0.03), 0 2px 14px rgba(0,0,0,0.55)',
            };
            const cardStyle = isMain ? darkMain : isSub ? darkSub : darkDetail;

            return (
              // Outer div: only position — no visual styles so spring drag math stays clean
              <div key={node.id} style={{
                position: 'absolute', left: pos.x, top: pos.y, width: NODE_W,
                zIndex: isExpanded ? 20 : isMain ? 5 : 2,
              }}>
                {/* Inner dark card — all visuals, no transform so drag origin is exact */}
                <div
                  className="mila-node-card"
                  style={cardStyle}
                >
                {/* Header — drag handle + expand toggle */}
                <div
                  onMouseDown={e => startNodeDrag(e, node)}
                  onClick={() => toggleExpand(node.id)}
                  style={{ padding: '11px 13px', cursor: 'grab', display: 'flex', alignItems: 'flex-start', gap: 9, userSelect: 'none' }}
                >
                  <div style={{
                    flexShrink: 0, marginTop: 4, width: 7, height: 7, borderRadius: '50%',
                    background: isMastered ? '#4ade80' : isMain ? 'rgba(200,170,255,0.8)' : isSub ? 'rgba(150,130,200,0.7)' : 'rgba(255,255,255,0.25)',
                    boxShadow: isMastered ? '0 0 6px #4ade8088' : isMain ? '0 0 8px rgba(200,170,255,0.6)' : 'none',
                    transition: 'background 0.3s, box-shadow 0.3s',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3, marginBottom: 3, letterSpacing: '0.1px' }}>{node.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: isExpanded ? 'unset' : 2, WebkitBoxOrient: 'vertical' }}>{node.summary}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 8, color: 'rgba(255,255,255,0.25)', paddingTop: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    {img && (
                      <div style={{ width: '100%', height: 200, overflow: 'hidden' }}>
                        <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', opacity: 0.9 }} />
                      </div>
                    )}
                    <div style={{ padding: '12px 13px 14px' }}>
                      {node.content && <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.7, marginBottom: 10 }}>{node.content}</p>}
                      {node.bullets?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                          {node.bullets.map((b, bi) => (
                            <li key={bi} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, width: 4, height: 4, borderRadius: '50%', background: isMain ? 'rgba(200,170,255,0.6)' : 'rgba(255,255,255,0.3)', marginTop: 5.5 }} />
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Inline mini flashcard */}
                      {linkedCard && <MiniFlashcard card={linkedCard} />}

                      {/* Inline mini question */}
                      {linkedQuestion && <MiniQuestion question={linkedQuestion} />}

                      {/* Per-node generate buttons */}
                      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                        <button
                          onClick={e => { e.stopPropagation(); generateNodeCards(node); }}
                          disabled={!!genState}
                          style={{
                            flex: 1, padding: '6px 8px', borderRadius: 7,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: 10, fontWeight: 500, cursor: genState ? 'default' : 'pointer',
                            opacity: genState && genState !== 'flashcards' ? 0.35 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            transition: 'opacity 0.15s, background 0.15s',
                          }}
                        >
                          {genState === 'flashcards' ? '⟳' : '＋'}
                          {nodeCardCount > 0 ? `Cards (${nodeCardCount})` : 'Cards'}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); generateNodeQs(node); }}
                          disabled={!!genState}
                          style={{
                            flex: 1, padding: '6px 8px', borderRadius: 7,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: 10, fontWeight: 500, cursor: genState ? 'default' : 'pointer',
                            opacity: genState && genState !== 'questions' ? 0.35 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            transition: 'opacity 0.15s, background 0.15s',
                          }}
                        >
                          {genState === 'questions' ? '⟳' : '＋'}
                          {nodeQCount > 0 ? `Quiz (${nodeQCount})` : 'Quiz'}
                        </button>
                      </div>

                      {/* Mastery button */}
                      <button
                        onClick={e => { e.stopPropagation(); toggleMastered(node.id); }}
                        style={{
                          marginTop: 8,
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 7,
                          border: `1px solid ${isMastered ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          background: isMastered ? 'rgba(74,222,128,0.1)' : 'transparent',
                          color: isMastered ? '#4ade80' : 'rgba(255,255,255,0.35)',
                          fontSize: 10.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.25s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                      >
                        {isMastered ? '✓ Dominado' : 'Marcar como dominado'}
                      </button>
                    </div>
                  </div>
                )}
                </div> {/* end glass card */}
              </div>
            );
          })}
        </div>

        {/* Floating zoom controls */}
        <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 100 }}>
          <button onClick={() => zoom(1.25)} style={overlayBtnStyle} title="Acercar">+</button>
          <button onClick={() => { setScale(0.75); setPan({ x: 20, y: 20 }); }} style={{ ...overlayBtnStyle, fontSize: 15 }} title="Restablecer">⊙</button>
          <button onClick={() => zoom(0.8)} style={overlayBtnStyle} title="Alejar">−</button>
        </div>

        {/* Fullscreen escape hint */}
        {isFullscreen && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, pointerEvents: 'none' }}>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', background: 'rgba(20,20,28,0.75)', padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
              Pellizca · arrastrá · ⛶ salir
            </span>
          </div>
        )}
      </div>

      {/* Legend (only when not fullscreen) */}
      {!isFullscreen && (
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { bg: 'rgba(140,100,200,0.5)', label: 'Principal' },
            { bg: 'rgba(255,255,255,0.15)', label: 'Subtema' },
            { bg: 'rgba(255,255,255,0.08)', label: 'Detalle' },
          ].map(({ bg, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: bg, border: '1px solid rgba(255,255,255,0.12)' }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return ReactDOM.createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#09090c',
        display: 'flex', flexDirection: 'column',
        padding: '10px',
      }}>
        {mapContent}
      </div>,
      document.body
    );
  }

  return mapContent;
}

const toolBtnStyle = {
  width: 28, height: 28, borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 15,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.15s ease, transform 0.12s ease',
};

const overlayBtnStyle = {
  width: 38, height: 38, borderRadius: 10,
  background: 'rgba(22,22,30,0.9)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: 20, fontWeight: 300,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(12px)',
  transition: 'transform 0.12s ease, box-shadow 0.15s ease',
};
