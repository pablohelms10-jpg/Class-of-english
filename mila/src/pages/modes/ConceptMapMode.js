import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMila } from '../../context/MilaContext';
import { generateConceptMapAI, assignImagesToNodes, quickAssignImages } from '../../utils/aiService';
import { generateConceptMap } from '../../utils/parseContent';
import MilaLoadingScreen from '../../components/MilaLoadingScreen';
import { MapIcon } from '../../components/Icons';

const NODE_W = 270;
const CANVAS_W = 1400;
const CANVAS_H = 1000;

export default function ConceptMapMode({ summary }) {
  const { updateSummary } = useMila();
  const text = summary?.text || '';
  const images = summary?.images || [];
  const cached = summary?.conceptMap;

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

  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const panStart = useRef(null);
  const containerRef = useRef(null);
  const momentumRef = useRef(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(null);

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

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
        // Pinch zoom + simultaneous pan
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
        velocityRef.current = { x: 0, y: 0 }; // no momentum on pinch
      } else if (touches.length === 1 && lastTouches.length === 1) {
        // Single finger pan with velocity tracking
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
      // Apply momentum inertia on release
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
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse pan on empty canvas
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

  return (
    <div style={isFullscreen ? {
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'var(--pale-mist)',
      display: 'flex', flexDirection: 'column',
      padding: '10px',
    } : {}}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
          {isFullscreen
            ? (mapData.title || 'Mapa conceptual')
            : 'Pellizca · arrastrá para mover · ⛶ pantalla completa'}
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => zoom(1.2)} style={toolBtnStyle} title="Acercar">+</button>
          <span style={{ fontSize: 11, color: 'var(--text-light)', minWidth: 34, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => zoom(1 / 1.2)} style={toolBtnStyle} title="Alejar">−</button>
          <button onClick={() => { setScale(0.75); setPan({ x: 20, y: 20 }); }} style={toolBtnStyle} title="Restablecer vista">⊙</button>
          <button onClick={regenerate} style={{ ...toolBtnStyle, fontSize: 11, padding: '4px 10px', width: 'auto' }}>↺ Regenerar</button>
          <button
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
            style={{ ...toolBtnStyle, fontSize: 17, width: 32, padding: 0 }}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
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
        }}
      >
        {/* Dot grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, var(--whisper-grey) 1.2px, transparent 1.2px)', backgroundSize: '28px 28px', pointerEvents: 'none', zIndex: 0 }} />

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
          <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 1 }}>
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
            const img = node.imageIndex != null && node.imageIndex >= 0 && images[node.imageIndex] ? images[node.imageIndex] : null;

            return (
              <div key={node.id} style={{
                position: 'absolute', left: pos.x, top: pos.y, width: NODE_W,
                zIndex: isExpanded ? 20 : isMain ? 5 : 2,
                borderRadius: 12,
                boxShadow: isExpanded ? '0 16px 48px rgba(0,0,0,0.22)' : '0 4px 16px rgba(0,0,0,0.10)',
                background: isMain
                  ? 'linear-gradient(135deg, var(--ash-plum) 0%, var(--driftwood) 100%)'
                  : 'var(--ghost-white)',
                border: isMain ? 'none' : `1.5px solid ${isSub ? 'var(--driftwood)' : 'var(--whisper-grey)'}`,
                overflow: 'hidden',
                transition: 'box-shadow 0.25s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {/* Header — drag handle + expand toggle */}
                <div
                  onMouseDown={e => startNodeDrag(e, node)}
                  onClick={() => toggleExpand(node.id)}
                  style={{ padding: '10px 12px', cursor: 'grab', display: 'flex', alignItems: 'flex-start', gap: 8, userSelect: 'none' }}
                >
                  <div style={{ flexShrink: 0, marginTop: 3, width: 7, height: 7, borderRadius: '50%', background: isMain ? 'rgba(255,255,255,0.7)' : isSub ? 'var(--driftwood)' : 'var(--whisper-grey)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isMain ? 'white' : 'var(--text-dark)', lineHeight: 1.3, marginBottom: 3 }}>{node.label}</div>
                    <div style={{ fontSize: 11, color: isMain ? 'rgba(255,255,255,0.72)' : 'var(--text-light)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: isExpanded ? 'unset' : 2, WebkitBoxOrient: 'vertical' }}>{node.summary}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 9, color: isMain ? 'rgba(255,255,255,0.45)' : 'var(--text-light)', paddingTop: 3 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${isMain ? 'rgba(255,255,255,0.2)' : 'var(--soft-grey)'}` }}>
                    {img && (
                      <div style={{ width: '100%', height: 200, overflow: 'hidden' }}>
                        <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ padding: '12px 12px 14px' }}>
                      {node.content && <p style={{ fontSize: 12, color: isMain ? 'rgba(255,255,255,0.88)' : 'var(--text-mid)', lineHeight: 1.65, marginBottom: 10 }}>{node.content}</p>}
                      {node.bullets?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                          {node.bullets.map((b, bi) => (
                            <li key={bi} style={{ display: 'flex', gap: 7, marginBottom: 5, alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: isMain ? 'rgba(255,255,255,0.6)' : 'var(--driftwood)', marginTop: 5 }} />
                              <span style={{ fontSize: 11, color: isMain ? 'rgba(255,255,255,0.82)' : 'var(--text-dark)', lineHeight: 1.5 }}>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
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

        {/* Fullscreen escape hint */}
        {isFullscreen && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, pointerEvents: 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--text-light)', background: 'var(--ghost-white)', padding: '4px 12px', borderRadius: 20, border: '1px solid var(--whisper-grey)', opacity: 0.7 }}>
              Toca ✕ para salir · pellizca para zoom · arrastrá para mover
            </span>
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
          {images.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11 }}>🖼</span>
              <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Nodos con imagen del resumen</span>
            </div>
          )}
        </div>
      )}
    </div>
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
