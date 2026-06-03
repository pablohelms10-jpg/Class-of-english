import React, { useState, useMemo, useRef, useCallback } from 'react';
import { generateConceptMap } from '../../utils/parseContent';

export default function ConceptMapMode({ text }) {
  const initial = useMemo(() => generateConceptMap(text || ''), [text]);
  const [nodes, setNodes] = useState(initial.nodes);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const svgRef = useRef();

  const svgW = 800;
  const svgH = 560;

  function startDrag(e, node) {
    if (editingId === node.id) return;
    e.preventDefault();
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    setDraggingId(node.id);
    setDragOffset({ x: svgP.x - node.x, y: svgP.y - node.y });
  }

  const onMouseMove = useCallback(e => {
    if (draggingId === null) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    setNodes(prev => prev.map(n =>
      n.id === draggingId
        ? { ...n, x: svgP.x - dragOffset.x, y: svgP.y - dragOffset.y }
        : n
    ));
  }, [draggingId, dragOffset]);

  const onMouseUp = useCallback(() => setDraggingId(null), []);

  function startEdit(node) {
    setEditingId(node.id);
    setEditValue(node.label);
  }

  function saveEdit() {
    setNodes(prev => prev.map(n => n.id === editingId ? { ...n, label: editValue } : n));
    setEditingId(null);
  }

  if (!text || nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗺</div>
        <p>No hay suficiente contenido para generar un mapa.</p>
      </div>
    );
  }

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 16 }}>
        Arrastra los nodos para reorganizar · Doble clic para editar el texto
      </p>
      <div style={{
        borderRadius: 'var(--radius-md)',
        background: 'white',
        border: '1.5px solid var(--soft-grey)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-soft)',
      }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', cursor: draggingId !== null ? 'grabbing' : 'default' }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--feather-touch)" />
            </marker>
          </defs>

          {initial.edges.map((edge, i) => {
            const from = nodeMap[edge.from];
            const to = nodeMap[edge.to];
            if (!from || !to) return null;
            return (
              <line
                key={i}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="var(--whisper-grey)"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
            );
          })}

          {nodes.map(node => (
            <NodeShape
              key={node.id}
              node={node}
              isEditing={editingId === node.id}
              editValue={editValue}
              onDragStart={startEdit}
              onMouseDown={e => startDrag(e, node)}
              onDoubleClick={() => startEdit(node)}
              onEditChange={setEditValue}
              onEditSave={saveEdit}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function NodeShape({ node, isEditing, editValue, onMouseDown, onDoubleClick, onEditChange, onEditSave }) {
  const isMain = node.type === 'main';
  const rx = isMain ? 40 : 32;
  const ry = isMain ? 22 : 18;
  const fill = isMain
    ? 'url(#mainGrad)'
    : 'rgba(255,255,255,0.95)';
  const stroke = isMain ? 'none' : 'var(--feather-touch)';
  const textColor = isMain ? 'white' : 'var(--text-dark)';
  const fontSize = isMain ? 13 : 11;

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{ cursor: 'grab', userSelect: 'none' }}
    >
      <defs>
        <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B0A8A4" />
          <stop offset="100%" stopColor="#C1B7AF" />
        </linearGradient>
      </defs>

      <ellipse
        rx={rx + (node.label.length > 20 ? 20 : 0)}
        ry={ry}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        filter={isMain ? 'drop-shadow(0 4px 12px rgba(150,148,143,0.25))' : 'drop-shadow(0 2px 6px rgba(150,148,143,0.12))'}
      />

      {isEditing ? (
        <foreignObject
          x={-(rx + 20)} y={-14}
          width={(rx + 20) * 2} height={28}
        >
          <input
            autoFocus
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onEditSave}
            onKeyDown={e => e.key === 'Enter' && onEditSave()}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontSize,
              fontFamily: 'Inter, sans-serif',
              color: textColor,
              outline: 'none',
            }}
          />
        </foreignObject>
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={fontSize}
          fontFamily="Inter, sans-serif"
          fontWeight={isMain ? 500 : 400}
        >
          {node.label.length > 28 ? node.label.slice(0, 28) + '…' : node.label}
        </text>
      )}
    </g>
  );
}
