import React, { useState } from 'react';
import { useMila } from '../context/MilaContext';

const TAG_OPTIONS = [
  { id: 'era1', label: 'ERA 1', color: '#8B7355' },
  { id: 'era2', label: 'ERA 2', color: '#6B7A5E' },
  { id: 'era3', label: 'ERA 3', color: '#5E6B7A' },
  { id: 'efi',  label: 'EFI',   color: '#7A5E6B' },
];

export default function LibraryPanel({ open, onClose }) {
  const { summaries, setActiveSummary, setActiveMode, updateSummary, deleteSummary } = useMila();
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [collapsedSubjects, setCollapsedSubjects] = useState({});

  const grouped = summaries.reduce((acc, s) => {
    const key = s.subject || 'Sin materia';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  function openSummary(s) {
    setActiveSummary(s);
    setActiveMode(null);
    onClose();
  }

  function toggleTag(summaryId, tagId, currentTags) {
    const tags = currentTags || [];
    const next = tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId];
    updateSummary(summaryId, { tags: next });
  }

  function toggleSubject(key) {
    setCollapsedSubjects(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(380px, 100vw)',
        zIndex: 201,
        background: 'var(--ghost-white)',
        borderLeft: '1px solid var(--soft-grey)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Panel header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--soft-grey)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 2 }}>Biblioteca</h2>
            <p style={{ fontSize: 12, color: 'var(--text-light)' }}>{summaries.length} resumen{summaries.length !== 1 ? 'es' : ''}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--soft-grey)', color: 'var(--text-mid)',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {summaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
              <p style={{ fontSize: 14 }}>No hay resúmenes guardados</p>
            </div>
          ) : (
            Object.entries(grouped).map(([subjectKey, subjectSummaries]) => (
              <div key={subjectKey} style={{ marginBottom: 8 }}>
                {/* Subject folder header */}
                <button
                  onClick={() => toggleSubject(subjectKey)}
                  style={{
                    width: '100%', padding: '10px 24px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
                    {collapsedSubjects[subjectKey] ? '▶' : '▼'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📁 {subjectKey}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, color: 'var(--text-light)',
                    background: 'var(--soft-grey)', borderRadius: 20, padding: '2px 8px',
                  }}>{subjectSummaries.length}</span>
                </button>

                {!collapsedSubjects[subjectKey] && subjectSummaries.map(s => (
                  <SummaryItem
                    key={s.id}
                    summary={s}
                    editingId={editingId}
                    editTitle={editTitle}
                    onOpen={() => openSummary(s)}
                    onStartEdit={() => { setEditingId(s.id); setEditTitle(s.title); }}
                    onEditChange={setEditTitle}
                    onSaveEdit={() => { updateSummary(s.id, { title: editTitle }); setEditingId(null); }}
                    onToggleTag={(tagId) => toggleTag(s.id, tagId, s.tags)}
                    onDelete={() => deleteSummary(s.id)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function SummaryItem({ summary, editingId, editTitle, onOpen, onStartEdit, onEditChange, onSaveEdit, onToggleTag, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isEditing = editingId === summary.id;
  const tags = summary.tags || [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        margin: '2px 12px',
        padding: '12px 16px',
        borderRadius: 12,
        background: hovered ? 'var(--soft-grey)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }} onClick={onOpen}>
        <span style={{ fontSize: 13, color: 'var(--text-light)', flexShrink: 0 }}>📄</span>
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={e => e.key === 'Enter' && onSaveEdit()}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, fontSize: 14, fontWeight: 500,
              background: 'var(--pale-mist)', color: 'var(--text-dark)',
              border: '1px solid var(--driftwood)', borderRadius: 6,
              padding: '2px 8px', outline: 'none',
            }}
          />
        ) : (
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dark)', flex: 1 }}>
            {summary.title}
          </span>
        )}
        {hovered && !isEditing && (
          <button
            onClick={e => { e.stopPropagation(); onStartEdit(); }}
            style={{ fontSize: 11, color: 'var(--text-light)', padding: '2px 4px', borderRadius: 4, background: 'var(--whisper-grey)', flexShrink: 0 }}
          >✏</button>
        )}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TAG_OPTIONS.map(tag => {
          const active = tags.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={e => { e.stopPropagation(); onToggleTag(tag.id); }}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                background: active ? tag.color : 'transparent',
                color: active ? 'white' : 'var(--text-light)',
                border: `1px solid ${active ? tag.color : 'var(--whisper-grey)'}`,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
            >{tag.label}</button>
          );
        })}
      </div>

      {/* Delete button */}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--whisper-grey)', color: 'var(--text-light)',
            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      )}
    </div>
  );
}
