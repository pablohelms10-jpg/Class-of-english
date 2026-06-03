import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMila } from '../../context/MilaContext';
import { generateConceptMapAI } from '../../utils/aiService';
import MilaLoadingScreen from '../../components/MilaLoadingScreen';

const NODE_W = 240;
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
  const [dragging, setDragging] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (cached) return;
    setLoading(true);
    generateConceptMapAI(text, images)
      .then(data => {
        setMapData(data);
        const p = {};
        data.nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
        setPositions(p);
        updateSummary(summary.id, { conceptMap: data });
      })
      .catch(err => {
        console.error(err);
        setMapData(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function regenerate() {
    setLoading(true);
    setMapData(null);
    setExpanded(new Set([0]));
    generateConceptMapAI(text, images)
      .then(data => {
        setMapData(data);
        const p = {};
        data.nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
        setPositions(p);
        updateSummary(summary.id, { conceptMap: data });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  const onMouseMove = useCallback(e => {
    if (!dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    setPositions(prev => ({
      ...prev,
      [dragging.id]: {
        x: e.clientX - rect.left + scrollLeft - dragging.ox,
        y: e.clientY - rect.top + scrollTop - dragging.oy,
      }
    }));
  }, [dragging]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  function startDrag(e, node) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    const pos = positions[node.id] || { x: node.x, y: node.y };
    setDragging({
      id: node.id,
      ox: e.clientX - rect.left + scrollLeft - pos.x,
      oy: e.clientY - rect.top + scrollTop - pos.y,
    });
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <MilaLoadingScreen message="MILA está construyendo el mapa conceptual…" sub="Analizando contenido e imágenes…" />;

  if (!mapData || !mapData.nodes?.length) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🗺</div>
      <p style={{ marginBottom: 16 }}>No hay suficiente contenido para generar un mapa.</p>
      <button onClick={regenerate} style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 14 }}>Intentar de nuevo</button>
    </div>
  );

  const nodes = mapData.nodes;
  const edges = mapData.edges || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
          Arrastrá para mover · Clic para expandir/colapsar nodos
        </p>
        <button onClick={regenerate} style={{ fontSize: 11, color: 'var(--text-light)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--soft-grey)', background: 'transparent' }}>
          ↺ Regenerar
        </button>
      </div>

      <div
        ref={containerRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          width: '100%', height: 620,
          overflow: 'auto',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--whisper-grey)',
          position: 'relative',
          cursor: dragging ? 'grabbing' : 'default',
          background: 'var(--pale-mist)',
        }}
      >
        {/* Dot grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, var(--whisper-grey) 1.2px, transparent 1.2px)', backgroundSize: '28px 28px', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ width: CANVAS_W, height: CANVAS_H, position: 'relative' }}>

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
              const fx = fp.x + NODE_W / 2;
              const fy = fp.y + 30;
              const tx = tp.x + NODE_W / 2;
              const ty = tp.y + 30;
              const cy = (fy + ty) / 2;
              return (
                <g key={i}>
                  <path
                    d={`M ${fx} ${fy} C ${fx} ${cy} ${tx} ${cy} ${tx} ${ty}`}
                    fill="none" stroke="var(--driftwood)" strokeWidth="1.5" opacity="0.5"
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.label && (
                    <text x={(fx + tx) / 2} y={cy - 5} textAnchor="middle" fontSize="10" fill="var(--text-light)" fontFamily="Inter, sans-serif">
                      {edge.label}
                    </text>
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
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  width: NODE_W,
                  zIndex: isExpanded ? 20 : isMain ? 5 : 2,
                  borderRadius: 12,
                  boxShadow: isExpanded ? '0 12px 40px rgba(0,0,0,0.18)' : '0 4px 16px rgba(0,0,0,0.10)',
                  background: isMain
                    ? 'linear-gradient(135deg, var(--ash-plum) 0%, var(--driftwood) 100%)'
                    : 'var(--ghost-white)',
                  border: isMain ? 'none' : `1.5px solid ${isSub ? 'var(--driftwood)' : 'var(--whisper-grey)'}`,
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  userSelect: 'none',
                  overflow: 'hidden',
                }}
              >
                {/* Header: drag handle + expand toggle */}
                <div
                  onMouseDown={e => startDrag(e, node)}
                  onClick={() => toggleExpand(node.id)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  {/* Type badge */}
                  <div style={{
                    flexShrink: 0, marginTop: 2,
                    width: 8, height: 8, borderRadius: '50%',
                    background: isMain ? 'rgba(255,255,255,0.7)' : isSub ? 'var(--driftwood)' : 'var(--whisper-grey)',
                    marginRight: 2,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isMain ? 'white' : 'var(--text-dark)', lineHeight: 1.3, marginBottom: 3 }}>
                      {node.label}
                    </div>
                    <div style={{ fontSize: 11, color: isMain ? 'rgba(255,255,255,0.72)' : 'var(--text-light)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: isExpanded ? 'unset' : 2, WebkitBoxOrient: 'vertical' }}>
                      {node.summary}
                    </div>
                  </div>

                  <span style={{ flexShrink: 0, fontSize: 10, color: isMain ? 'rgba(255,255,255,0.5)' : 'var(--text-light)', paddingTop: 2 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${isMain ? 'rgba(255,255,255,0.2)' : 'var(--soft-grey)'}`, padding: '12px 12px 14px' }}>

                    {node.content && (
                      <p style={{ fontSize: 12, color: isMain ? 'rgba(255,255,255,0.88)' : 'var(--text-mid)', lineHeight: 1.65, marginBottom: 10 }}>
                        {node.content}
                      </p>
                    )}

                    {node.bullets && node.bullets.length > 0 && (
                      <ul style={{ margin: '0 0 10px', paddingLeft: 0, listStyle: 'none' }}>
                        {node.bullets.map((b, bi) => (
                          <li key={bi} style={{ display: 'flex', gap: 7, marginBottom: 5, alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: isMain ? 'rgba(255,255,255,0.6)' : 'var(--driftwood)', marginTop: 5 }} />
                            <span style={{ fontSize: 11, color: isMain ? 'rgba(255,255,255,0.82)' : 'var(--text-dark)', lineHeight: 1.5 }}>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {img && (
                      <img
                        src={img.src}
                        alt=""
                        style={{ width: '100%', borderRadius: 8, objectFit: 'contain', maxHeight: 180, background: 'rgba(0,0,0,0.05)', marginTop: 4 }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
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
    </div>
  );
}
