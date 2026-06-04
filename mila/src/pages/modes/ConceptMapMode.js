import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useMila } from '../../context/MilaContext';
import { generateConceptMapAI, expandConceptMapAI, assignImagesToNodes, quickAssignImages, generateFlashcardsAI, generateQuestionsAI, generateNodeFlashcardsAI, generateNodeQuestionsAI } from '../../utils/aiService';
import { generateConceptMap } from '../../utils/parseContent';
import { idbLoadImages } from '../../utils/imageDB';
import MilaLoadingScreen from '../../components/MilaLoadingScreen';
import { MapIcon } from '../../components/Icons';

const NODE_W = 270;
const CANVAS_W = 3000;
const CANVAS_H = 2000;

// Mini flashcard carousel — cycles through all cards for a node
function MiniFlashcard({ cards }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];
  if (!card) return null;
  function prev(e) { e.stopPropagation(); setIdx(i => (i - 1 + cards.length) % cards.length); setFlipped(false); }
  function next(e) { e.stopPropagation(); setIdx(i => (i + 1) % cards.length); setFlipped(false); }
  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, userSelect: 'none' }}>
      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          borderRadius: 8,
          border: '1px solid var(--soft-grey)',
          background: flipped ? 'var(--pale-mist)' : 'var(--ghost-white)',
          padding: '9px 10px',
          cursor: 'pointer',
          transition: 'background 0.2s',
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
      {cards.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
          <button onClick={prev} style={miniNavBtn}>‹</button>
          <span style={{ fontSize: 9, color: 'var(--text-light)' }}>{idx + 1} / {cards.length}</span>
          <button onClick={next} style={miniNavBtn}>›</button>
        </div>
      )}
    </div>
  );
}

// Mini question carousel — cycles through all questions for a node
function MiniQuestion({ questions }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const question = questions[idx];
  if (!question) return null;
  const options = question.options || [];
  const isLast = idx === questions.length - 1;
  function prev(e) { e.stopPropagation(); setIdx(i => (i - 1 + questions.length) % questions.length); setSelected(null); }
  function next(e) { e.stopPropagation(); setIdx(i => (i + 1) % questions.length); setSelected(null); }
  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, userSelect: 'none' }}>
      <div style={{ borderRadius: 8, border: '1px solid var(--soft-grey)', background: 'var(--ghost-white)', padding: '9px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: 'var(--text-light)', fontWeight: 500 }}>Pregunta</span>
          {questions.length > 1 && <span style={{ fontSize: 9, color: 'var(--text-light)' }}>{idx + 1} / {questions.length}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dark)', lineHeight: 1.5, marginBottom: 7 }}>{question.question}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {options.map((opt, i) => {
            const isCorrect = opt === question.correct;
            const isSelected = selected === opt;
            let bg = 'transparent', borderColor = 'var(--soft-grey)', color = 'var(--text-dark)';
            if (selected) {
              if (isCorrect) { bg = 'rgba(123,174,127,0.18)'; borderColor = '#7BAE7F'; color = '#2d6a33'; }
              else if (isSelected) { bg = 'rgba(229,115,115,0.15)'; borderColor = '#e57373'; color = '#b71c1c'; }
            }
            return (
              <button key={i} onClick={() => { if (!selected) setSelected(opt); }}
                style={{ textAlign: 'left', padding: '5px 8px', borderRadius: 6, border: `1px solid ${borderColor}`, background: bg, color, fontSize: 10, lineHeight: 1.4, cursor: selected ? 'default' : 'pointer', transition: 'background 0.15s, border-color 0.15s' }}>
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
      {/* Navigation — always show if multiple questions; after answering show prominent Next button */}
      {questions.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
          <button onClick={prev} style={miniNavBtn}>‹</button>
          {selected ? (
            <button onClick={next} style={{
              flex: 1, padding: '5px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              border: '1px solid var(--driftwood)', background: 'var(--driftwood)',
              color: 'white', cursor: 'pointer',
            }}>
              {isLast ? 'Volver al inicio →' : 'Siguiente →'}
            </button>
          ) : (
            <span style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-light)' }}>
              Respondé para continuar
            </span>
          )}
          <button onClick={next} style={miniNavBtn}>›</button>
        </div>
      )}
    </div>
  );
}

const miniNavBtn = {
  width: 26, height: 22, borderRadius: 6,
  border: '1px solid var(--soft-grey)',
  background: 'var(--ghost-white)',
  color: 'var(--text-mid)',
  fontSize: 14, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};

export default function ConceptMapMode({ summary }) {
  const { updateSummary } = useMila();
  const text = summary?.text || '';
  const images = summary?.images || [];
  const cached = summary?.conceptMap;
  const masteredNodes = summary?.masteredNodes || {};
  const flashcards = summary?.flashcards || [];
  const questions = summary?.questions || [];

  const [mapData, setMapData] = useState(cached || null);
  const [loading, setLoading] = useState(true); // always wait for image load first
  const [loadedImages, setLoadedImages] = useState(summary?.images || []);
  const [imagesReady, setImagesReady] = useState((summary?.images?.length || 0) > 0);
  const [wigglingNode, setWigglingNode] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
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
  const [expanding, setExpanding] = useState(false);
  const [bgStyle, setBgStyle] = useState(() => {
    try { return localStorage.getItem('mila_map_bg') || 'none'; } catch { return 'none'; }
  });
  function cycleBg() {
    setBgStyle(prev => {
      const next = prev === 'none' ? 'dots' : prev === 'dots' ? 'grid' : 'none';
      try { localStorage.setItem('mila_map_bg', next); } catch {}
      return next;
    });
  }
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (isFullscreen) {
      setHintVisible(true);
      const t = setTimeout(() => setHintVisible(false), 3000);
      return () => clearTimeout(t);
    } else {
      setHintVisible(false);
      setPanelCollapsed(false);
    }
  }, [isFullscreen]);

  const [nodePanel, setNodePanel] = useState(null); // { node, tab: 'flashcards'|'questions' }

  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const positionsRef = useRef(positions);
  const panStart = useRef(null);
  const containerRef = useRef(null);
  const momentumRef = useRef(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const touchDragRef = useRef(null); // { id, ox, oy } — active touch node drag

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  // Lock body scroll in fullscreen — CSS-portal only, no native Fullscreen API.
  // This means only our button can exit fullscreen; the browser cannot override it.
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isFullscreen]);

  function toggleFullscreen() {
    setIsFullscreen(f => !f);
  }

  function applyNodes(nodes) {
    const p = {};
    nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
    setPositions(p);
  }

  function applyMap(data) {
    const base = { ...data };
    setMapData(base);
    applyNodes(base.nodes);
    updateSummary(summary.id, { conceptMap: base });
    // Image assignment is handled by the mapData useEffect below
    // Auto-generate tagged flashcards + questions if not yet done
    const hasTagged = (summary.flashcards || []).some(f => f.conceptLabel);
    if (!hasTagged && text) {
      generateFlashcardsAI(text, [], images, data.nodes)
        .then(({ cards }) => updateSummary(summary.id, { flashcards: cards }))
        .catch(e => console.warn('[MILA] flashcard gen failed:', e));
      generateQuestionsAI(text, [], images, data.nodes)
        .then(({ questions: qs }) => updateSummary(summary.id, { questions: qs }))
        .catch(e => console.warn('[MILA] question gen failed:', e));
    }
  }

  // Dedicated effect: runs OCR image assignment whenever mapData changes
  // and there are images but no assignments yet. Separated from applyMap so
  // Load images from IndexedDB if not already in memory (they're stripped from localStorage)
  useEffect(() => {
    if (loadedImages.length > 0) { setImagesReady(true); return; }
    idbLoadImages(String(summary.id))
      .then(imgs => { if (imgs?.length) setLoadedImages(imgs); })
      .catch(() => {})
      .finally(() => setImagesReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-assign images to nodes whenever images become available and nodes don't have them
  useEffect(() => {
    if (!mapData?.nodes?.length || !loadedImages.length) return;
    const alreadyAssigned = mapData.nodes.filter(n => n.imageIndex != null && n.imageIndex >= 0).length;
    if (alreadyAssigned >= Math.ceil(mapData.nodes.length * 0.5)) return; // already mostly assigned
    console.log('[MILA] Auto-assigning images to', mapData.nodes.length, 'nodes');
    assignImagesToNodes(mapData.nodes, loadedImages)
      .then(withImg => {
        const r = { ...mapData, nodes: withImg };
        setMapData(r);
        updateSummary(summary.id, { conceptMap: r });
      })
      .catch(e => console.error('[MILA] Image assignment failed:', e));
  }, [mapData?.nodes?.length, loadedImages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate concept map AFTER images are loaded so they're available for analysis.
  // If no images are available, use the free local parser instead of calling the API
  // (avoids charging the user when the result would be low quality anyway).
  useEffect(() => {
    if (!imagesReady) return;
    if (cached) { setLoading(false); return; }
    setLoading(true);
    if (!loadedImages.length && !text.trim()) {
      setLoading(false);
      return;
    }
    // If the summary has images but none loaded from IndexedDB yet, use free local fallback
    // to avoid an expensive API call that would produce duplicate-label maps
    const summaryHasImages = (summary?.images?.length || 0) > 0 || loadedImages.length > 0;
    if (summaryHasImages && loadedImages.length === 0) {
      // Images expected but not loaded — use free local parser, don't charge
      const fb = generateConceptMap(text);
      if (fb?.nodes?.length) applyMap(fb);
      setLoading(false);
      return;
    }
    generateConceptMapAI(text, loadedImages)
      .then(data => { if (!data?.nodes?.length) throw new Error('empty'); applyMap(data); })
      .catch(() => { const fb = generateConceptMap(text); if (fb?.nodes?.length) applyMap(fb); })
      .finally(() => setLoading(false));
  }, [imagesReady]); // eslint-disable-line react-hooks/exhaustive-deps

  function regenerate() {
    setLoading(true); setMapData(null); setExpanded(new Set([0]));
    setScale(0.75); setPan({ x: 20, y: 20 });
    updateSummary(summary.id, { conceptMap: null });
    // If images are expected but not in memory, use free local parser to avoid charges
    const summaryHasImages = (summary?.images?.length || 0) > 0 || loadedImages.length > 0;
    if (summaryHasImages && loadedImages.length === 0) {
      const fb = generateConceptMap(text);
      if (fb?.nodes?.length) applyMap(fb);
      setLoading(false);
      return;
    }
    generateConceptMapAI(text, loadedImages)
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

  // Wheel + touch events attached imperatively for passive:false support.
  // Depends on [isFullscreen, loading] so it re-attaches after the map finishes
  // loading (containerRef is null during the loading screen).
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
        // ctrlKey: trackpad pinch (deltaY in pixels) or Ctrl+scroll
        // Use exponential mapping for smooth continuous zoom
        zoom(Math.pow(0.997, e.deltaY), cx, cy);
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
    let touchStartClient = null; // initial touch position for long-press threshold

    function cancelLongPress() {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    }

    function handleTouchStart(e) {
      // Don't call preventDefault here — it blocks click generation for taps.
      // CSS touch-action:none on [data-mila-map] prevents page scroll instead.
      touchMoved = false;
      cancelLongPress();
      touchDragRef.current = null;
      if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
      velocityRef.current = { x: 0, y: 0 };
      lastTouchTimeRef.current = Date.now();
      lastTouches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));

      // Long-press node drag: single finger held 3 s on a node starts dragging it
      if (e.touches.length === 1) {
        const nodeEl = e.target.closest('[data-node-id]');
        if (nodeEl) {
          const nodeId = parseInt(nodeEl.dataset.nodeId, 10);
          const t0 = e.touches[0];
          touchStartClient = { x: t0.clientX, y: t0.clientY };
          longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            const rect = el.getBoundingClientRect();
            const pos = positionsRef.current[nodeId];
            if (!pos) return;
            // Wiggle feedback — signals node is ready to drag (like iPhone app jiggle)
            setWigglingNode(nodeId);
            setTimeout(() => setWigglingNode(null), 400);
            touchDragRef.current = {
              id: nodeId,
              ox: (touchStartClient.x - rect.left - panRef.current.x) / scaleRef.current - pos.x,
              oy: (touchStartClient.y - rect.top - panRef.current.y) / scaleRef.current - pos.y,
            };
            touchMoved = true; // prevent expand toggle on lift
          }, 700);
        }
      } else {
        touchStartClient = null;
      }
    }

    function handleTouchMove(e) {
      e.preventDefault();

      // If finger drifted more than 8 px before timer fires, cancel long-press
      if (longPressTimerRef.current && touchStartClient && e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartClient.x;
        const dy = e.touches[0].clientY - touchStartClient.y;
        if (Math.hypot(dx, dy) > 8) cancelLongPress();
      }

      touchMoved = true;
      const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));

      // Active touch node drag — move the node, skip canvas pan
      if (touchDragRef.current && touches.length === 1) {
        const rect = el.getBoundingClientRect();
        const { id, ox, oy } = touchDragRef.current;
        setPositions(prev => ({
          ...prev,
          [id]: {
            x: (touches[0].x - rect.left - panRef.current.x) / scaleRef.current - ox,
            y: (touches[0].y - rect.top - panRef.current.y) / scaleRef.current - oy,
          },
        }));
        lastTouches = touches;
        return;
      }

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
      cancelLongPress();
      touchDragRef.current = null;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, loading]); // re-attach when fullscreen or loading state changes (containerRef is null during load)

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
      setPositions(prev => ({
        ...prev,
        [dragging.id]: {
          x: (e.clientX - rect.left - panRef.current.x) / scaleRef.current - dragging.ox,
          y: (e.clientY - rect.top - panRef.current.y) / scaleRef.current - dragging.oy,
        }
      }));
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
    setDragging(null); setIsPanning(false); panStart.current = null;
  }, []);

  function startNodeDrag(e, node) {
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[node.id] || { x: node.x, y: node.y };
    setDragging({
      id: node.id,
      ox: (e.clientX - rect.left - panRef.current.x) / scaleRef.current - pos.x,
      oy: (e.clientY - rect.top - panRef.current.y) / scaleRef.current - pos.y,
    });
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
      const result = await generateNodeFlashcardsAI(node, existing);
      if (result.allCovered) {
        setNodeGenerating(prev => ({ ...prev, [node.id]: 'cards_done' }));
        setTimeout(() => setNodeGenerating(prev => ({ ...prev, [node.id]: null })), 3000);
        return;
      }
      const merged = [...(summary.flashcards || []), ...result.cards];
      updateSummary(summary.id, { flashcards: merged });
    } catch { /* silent */ }
    setNodeGenerating(prev => ({ ...prev, [node.id]: null }));
  }

  async function reassignImages() {
    if (!mapData || loadedImages.length === 0) return;
    setReassigning(true);
    try {
      const withImg = await assignImagesToNodes(mapData.nodes, loadedImages);
      const updated = { ...mapData, nodes: withImg };
      setMapData(updated);
      updateSummary(summary.id, { conceptMap: updated });
    } catch { /* silent */ }
    setReassigning(false);
  }

  async function expandMap() {
    if (!mapData || !text) return;
    setExpanding(true);
    try {
      const extra = await expandConceptMapAI(text, mapData, loadedImages);
      if (!extra?.nodes?.length) return;

      // Merge new nodes into existing map
      const existingNodes = mapData.nodes || [];
      const existingEdges = mapData.edges || [];

      // Auto-position new nodes below existing ones
      const maxY = Math.max(...existingNodes.map(n => n.y || 0), 0);
      const spacedNodes = extra.nodes.map((n, i) => ({
        ...n,
        x: 100 + (i % 4) * 300,
        y: maxY + 160 + Math.floor(i / 4) * 180,
      }));

      // Filter edges that reference valid node IDs
      const allNodeIds = new Set([...existingNodes.map(n => n.id), ...spacedNodes.map(n => n.id)]);
      const newEdges = (extra.edges || []).filter(e => allNodeIds.has(e.from) && allNodeIds.has(e.to));

      const updated = {
        ...mapData,
        nodes: [...existingNodes, ...spacedNodes],
        edges: [...existingEdges, ...newEdges],
      };

      setMapData(updated);
      setPositions(prev => {
        const p = { ...prev };
        spacedNodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
        return p;
      });
      updateSummary(summary.id, { conceptMap: updated });
    } catch (e) {
      console.error('[MILA] expandMap error:', e);
    }
    setExpanding(false);
  }

  async function generateNodeQs(node) {
    setNodeGenerating(prev => ({ ...prev, [node.id]: 'questions' }));
    try {
      const existing = (summary.questions || []).filter(q => q.conceptLabel === node.label);
      const result = await generateNodeQuestionsAI(node, existing);
      if (result.allCovered) {
        setNodeGenerating(prev => ({ ...prev, [node.id]: 'qs_done' }));
        setTimeout(() => setNodeGenerating(prev => ({ ...prev, [node.id]: null })), 3000);
        return;
      }
      const merged = [...(summary.questions || []), ...result.questions];
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

      {/* Top panel: progress + toolbar — collapsible in fullscreen */}
      {!(isFullscreen && panelCollapsed) && (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
                {masteredCount} / {totalCount} conceptos dominados
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--whisper-grey)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: progressPct === 100
                  ? '#7BAE7F'
                  : 'linear-gradient(90deg, var(--ash-plum), var(--driftwood))',
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0, gap: 6, flexWrap: 'nowrap' }}>
            <p style={{ fontSize: 11, color: 'var(--text-light)', flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isFullscreen
                ? (mapData.title || 'Mapa conceptual')
                : 'Pellizca · arrastrá · pantalla completa ⛶'}
            </p>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => zoom(1.2)} style={toolBtnStyle} title="Acercar">+</button>
              <span style={{ fontSize: 11, color: 'var(--text-light)', minWidth: 32, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
              <button onClick={() => zoom(1 / 1.2)} style={toolBtnStyle} title="Alejar">−</button>
              <button onClick={() => { setScale(0.75); setPan({ x: 20, y: 20 }); }} style={toolBtnStyle} title="Restablecer vista">⊙</button>
              {loadedImages.length > 0 && (
                <button
                  onClick={reassignImages}
                  disabled={reassigning}
                  title="Reasignar imágenes"
                  style={{ ...toolBtnStyle, fontSize: 11, padding: '4px 8px', width: 'auto', opacity: reassigning ? 0.5 : 1 }}
                >
                  {reassigning ? '⟳' : '🖼'}
                </button>
              )}
              <button
                onClick={expandMap}
                disabled={expanding}
                title="Agregar más nodos con información faltante"
                style={{ ...toolBtnStyle, fontSize: 11, padding: '4px 8px', width: 'auto', opacity: expanding ? 0.5 : 1 }}
              >
                {expanding ? '⟳' : '＋'}
              </button>
              <button
                onClick={cycleBg}
                title={bgStyle === 'none' ? 'Fondo liso — click para puntos' : bgStyle === 'dots' ? 'Puntos — click para cuadrícula' : 'Cuadrícula — click para liso'}
                style={{ ...toolBtnStyle, fontSize: 13, width: 32, padding: 0 }}
              >
                {bgStyle === 'none' ? '□' : bgStyle === 'dots' ? '⋯' : '⊞'}
              </button>
              <button onClick={regenerate} style={{ ...toolBtnStyle, fontSize: 11, padding: '4px 8px', width: 'auto' }}>↺</button>
              {isFullscreen && (
                <button
                  onClick={() => setPanelCollapsed(true)}
                  title="Ocultar panel"
                  style={{ ...toolBtnStyle, fontSize: 13, width: 32, padding: 0 }}
                >
                  ∧
                </button>
              )}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                style={{ ...toolBtnStyle, fontSize: 17, width: 32, padding: 0 }}
              >
                {isFullscreen ? '⛶' : '⛶'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Canvas — touch-action:none forced on all children to prevent iOS scroll override */}
      <style>{`[data-mila-map],[data-mila-map] *{touch-action:none!important;-webkit-user-select:none;user-select:none}`}</style>
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
          borderRadius: 10,
          border: '1.5px solid var(--whisper-grey)',
          position: 'relative',
          cursor: dragging ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
          background: 'var(--pale-mist)',
          userSelect: 'none',
          touchAction: 'none',
          WebkitOverflowScrolling: 'auto',
        }}
      >
        {/* Canvas background pattern */}
        {bgStyle === 'dots' && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            backgroundImage: 'radial-gradient(circle, var(--whisper-grey) 1.2px, transparent 1.2px)',
            backgroundSize: '28px 28px',
          }} />
        )}
        {bgStyle === 'grid' && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            backgroundImage: `linear-gradient(var(--whisper-grey) 1px, transparent 1px), linear-gradient(90deg, var(--whisper-grey) 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
            opacity: 0.5,
          }} />
        )}

        {/* Transformed canvas */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: CANVAS_W, height: CANVAS_H,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          zIndex: 1,
        }}>
          {/* SVG edges */}
          <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--driftwood)" opacity="0.6" />
              </marker>
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
              return (
                <g key={i}>
                  <path d={`M ${fx} ${fy} C ${fx} ${midY} ${tx} ${midY} ${tx} ${ty}`}
                    fill="none" stroke="var(--driftwood)" strokeWidth="1.5" opacity="0.5" markerEnd="url(#arrowhead)" />
                  {edge.label && (
                    <text x={(fx + tx) / 2} y={midY - 5} textAnchor="middle" fontSize="10" fill="var(--text-light)" fontFamily="Inter, sans-serif">{edge.label}</text>
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
            const img = node.imageIndex != null && node.imageIndex >= 0 && loadedImages[node.imageIndex] ? loadedImages[node.imageIndex] : null;
            const isMastered = !!masteredNodes[node.id];

            // Dot color: green if mastered, else default
            const dotColor = isMastered
              ? '#7BAE7F'
              : isSub
                ? 'var(--driftwood)'
                : 'var(--whisper-grey)';

            const nodeCardCount = flashcards.filter(f => f.conceptLabel === node.label).length;
            const nodeQCount = questions.filter(q => q.conceptLabel === node.label).length;
            const genState = nodeGenerating[node.id] || null;

            return (
              <div key={node.id} data-node-id={node.id}
                className={wigglingNode === node.id ? 'mila-node-wiggle' : undefined}
                style={{
                position: 'absolute', left: pos.x, top: pos.y, width: NODE_W,
                zIndex: isExpanded ? 20 : isMain ? 5 : 2,
                borderRadius: 12,
                boxShadow: isExpanded ? '0 16px 48px rgba(0,0,0,0.22)' : '0 4px 16px rgba(0,0,0,0.10)',
                background: 'var(--ghost-white)',
                border: `1.5px solid ${isSub ? 'var(--driftwood)' : 'var(--whisper-grey)'}`,
                overflow: 'hidden',
                transition: 'box-shadow 0.25s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {/* Header — drag handle + expand toggle */}
                <div
                  onMouseDown={e => startNodeDrag(e, node)}
                  onClick={() => toggleExpand(node.id)}
                  style={{ padding: '10px 12px', cursor: 'grab', display: 'flex', alignItems: 'flex-start', gap: 8, userSelect: 'none' }}
                >
                  <div style={{ flexShrink: 0, marginTop: 3, width: 7, height: 7, borderRadius: '50%', background: dotColor, transition: 'background 0.3s' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.3, marginBottom: 3 }}>{node.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: isExpanded ? 'unset' : 2, WebkitBoxOrient: 'vertical' }}>{node.summary}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 9, color: 'var(--text-light)', paddingTop: 3 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--soft-grey)' }}>
                    {img && (
                      <div style={{ width: '100%', height: 200, overflow: 'hidden' }}>
                        <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ padding: '12px 12px 14px' }}>
                      {node.content && <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.65, marginBottom: 10 }}>{node.content}</p>}
                      {node.bullets?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                          {node.bullets.map((b, bi) => (
                            <li key={bi} style={{ display: 'flex', gap: 7, marginBottom: 5, alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: 'var(--driftwood)', marginTop: 5 }} />
                              <span style={{ fontSize: 11, color: 'var(--text-dark)', lineHeight: 1.5 }}>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Inline mini flashcard carousel */}
                      {nodeCardCount > 0 && <MiniFlashcard cards={flashcards.filter(f => f.conceptLabel === node.label)} />}

                      {/* Inline mini question carousel */}
                      {nodeQCount > 0 && <MiniQuestion questions={questions.filter(q => q.conceptLabel === node.label)} />}

                      {/* Per-node generate buttons */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button
                          onClick={e => { e.stopPropagation(); generateNodeCards(node); }}
                          disabled={!!genState}
                          style={{
                            flex: 1, padding: '6px 8px', borderRadius: 7,
                            border: '1px solid var(--soft-grey)',
                            background: 'transparent',
                            color: 'var(--text-mid)',
                            fontSize: 10, fontWeight: 500, cursor: genState ? 'default' : 'pointer',
                            opacity: genState && genState !== 'flashcards' ? 0.4 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {genState === 'flashcards' ? '⟳' : genState === 'cards_done' ? '✓' : '＋'}
                          {genState === 'cards_done' ? 'Todo cubierto' : nodeCardCount > 0 ? `Flashcards (${nodeCardCount})` : 'Flashcards'}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); generateNodeQs(node); }}
                          disabled={!!genState}
                          style={{
                            flex: 1, padding: '6px 8px', borderRadius: 7,
                            border: '1px solid var(--soft-grey)',
                            background: 'transparent',
                            color: 'var(--text-mid)',
                            fontSize: 10, fontWeight: 500, cursor: genState ? 'default' : 'pointer',
                            opacity: genState && genState !== 'questions' ? 0.4 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {genState === 'questions' ? '⟳' : genState === 'qs_done' ? '✓' : '＋'}
                          {genState === 'qs_done' ? 'Todo cubierto' : nodeQCount > 0 ? `Preguntas (${nodeQCount})` : 'Preguntas'}
                        </button>
                      </div>

                      {/* View list button — shows all flashcards+questions for this node */}
                      {(nodeCardCount > 0 || nodeQCount > 0) && (
                        <button
                          onClick={e => { e.stopPropagation(); setNodePanel({ node, tab: nodeCardCount > 0 ? 'flashcards' : 'questions' }); }}
                          style={{
                            marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 7,
                            border: '1px solid var(--soft-grey)',
                            background: 'transparent',
                            color: 'var(--text-light)',
                            fontSize: 10, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}
                        >
                          📋 Ver listado completo
                        </button>
                      )}

                      {/* Mastery button */}
                      <button
                        onClick={e => { e.stopPropagation(); toggleMastered(node.id); }}
                        style={{
                          marginTop: 12,
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 7,
                          border: `1.5px solid ${isMastered ? '#7BAE7F' : 'var(--soft-grey)'}`,
                          background: isMastered ? '#eaf4eb' : 'transparent',
                          color: isMastered ? '#2d6a33' : 'var(--text-light)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                        }}
                      >
                        {isMastered ? '✓ Dominado' : 'Marcar como dominado'}
                      </button>
                    </div>
                  </div>
                )}
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

        {/* Fullscreen hint — auto-hides after 3s */}
        {isFullscreen && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100, pointerEvents: 'none',
            transition: 'opacity 0.8s ease',
            opacity: hintVisible ? 0.7 : 0,
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-light)', background: 'var(--ghost-white)', padding: '4px 12px', borderRadius: 20, border: '1px solid var(--whisper-grey)', whiteSpace: 'nowrap' }}>
              Toca ✕ para salir · pellizca para zoom · arrastrá para mover
            </span>
          </div>
        )}

        {/* Show-panel button when top panel is collapsed in fullscreen */}
        {isFullscreen && panelCollapsed && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 110, display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPanelCollapsed(false)}
              title="Mostrar panel"
              style={{ ...overlayBtnStyle, fontSize: 13, width: 36, height: 30, borderRadius: 20, padding: '0 12px', width: 'auto' }}
            >
              ∨ Panel
            </button>
            <button
              onClick={toggleFullscreen}
              title="Salir de pantalla completa"
              style={{ ...overlayBtnStyle, fontSize: 13, width: 36, height: 30, borderRadius: 20 }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Legend (only when not fullscreen) */}
      {!isFullscreen && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { color: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', label: 'Concepto principal' },
            { color: 'var(--driftwood)', label: 'Subtema', border: true },
            { color: 'var(--whisper-grey)', label: 'Detalle', border: true },
          ].map(({ color, label, border }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: border ? 'transparent' : color, border: border ? `2px solid ${color}` : 'none' }} />
              <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{label}</span>
            </div>
          ))}
          {loadedImages.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11 }}>🖼</span>
              <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Nodos con imagen del resumen</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const panelContent = nodePanel ? (() => {
    const pNode = nodePanel.node;
    const pTab = nodePanel.tab;
    const pCards = flashcards.filter(c => c.conceptLabel === pNode.label);
    const pQs = questions.filter(q => q.conceptLabel === pNode.label);
    const items = pTab === 'flashcards' ? pCards : pQs;
    return ReactDOM.createPortal(
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        onClick={() => setNodePanel(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--ghost-white)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 540, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}
        >
          {/* Header */}
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--whisper-grey)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dark)' }}>{pNode.label}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {[
                  { id: 'flashcards', label: `Flashcards (${pCards.length})` },
                  { id: 'questions', label: `Preguntas (${pQs.length})` },
                ].map(t => (
                  <button key={t.id} onClick={() => setNodePanel(p => ({ ...p, tab: t.id }))}
                    style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: pTab === t.id ? 'var(--text-dark)' : 'transparent', color: pTab === t.id ? 'white' : 'var(--text-light)', border: `1px solid ${pTab === t.id ? 'var(--text-dark)' : 'var(--soft-grey)'}` }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setNodePanel(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--soft-grey)', background: 'transparent', fontSize: 15, cursor: 'pointer', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          {/* List */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 24px' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--text-light)' }}>
                No hay {pTab === 'flashcards' ? 'flashcards' : 'preguntas'} para este nodo.<br />
                <span style={{ fontSize: 12 }}>Usa el botón "＋" en el nodo para generarlas.</span>
              </div>
            ) : pTab === 'flashcards' ? (
              pCards.map((c, i) => (
                <div key={c.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4 }}>{i + 1} / {pCards.length}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 6 }}>{c.front}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-mid)', borderTop: '1px solid var(--whisper-grey)', paddingTop: 6 }}>{c.back}</div>
                  {c.context && <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 4, fontStyle: 'italic' }}>{c.context}</div>}
                </div>
              ))
            ) : (
              pQs.map((q, i) => (
                <div key={q.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--pale-mist)', border: '1px solid var(--whisper-grey)', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4 }}>{i + 1} / {pQs.length}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 8 }}>{q.question}</div>
                  {(q.options || []).map(opt => (
                    <div key={opt} style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, marginBottom: 4, background: opt === q.correct ? 'rgba(123,174,127,0.12)' : 'transparent', border: `1px solid ${opt === q.correct ? 'rgba(123,174,127,0.4)' : 'var(--whisper-grey)'}`, color: opt === q.correct ? '#4A8A4E' : 'var(--text-mid)' }}>
                      {opt === q.correct ? '✓ ' : ''}{opt}
                    </div>
                  ))}
                  {q.explanation && <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 6, fontStyle: 'italic' }}>{q.explanation}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  })() : null;

  if (isFullscreen) {
    return (
      <>
        {ReactDOM.createPortal(
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'var(--pale-mist)',
            display: 'flex', flexDirection: 'column',
            padding: '10px',
          }}>
            {mapContent}
          </div>,
          document.body
        )}
        {panelContent}
      </>
    );
  }

  return (
    <>
      {mapContent}
      {panelContent}
    </>
  );
}

const toolBtnStyle = {
  width: 28, height: 28, borderRadius: 7,
  border: '1px solid var(--soft-grey)',
  background: 'var(--ghost-white)',
  color: 'var(--text-dark)',
  fontSize: 15,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.15s ease, transform 0.12s ease',
};

const overlayBtnStyle = {
  width: 38, height: 38, borderRadius: 10,
  background: 'var(--ghost-white)',
  border: '1px solid var(--whisper-grey)',
  color: 'var(--text-dark)',
  fontSize: 20, fontWeight: 300,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
  transition: 'transform 0.12s ease, box-shadow 0.15s ease',
};
