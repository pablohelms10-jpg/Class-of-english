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
  const [editingSummaryId, setEditingSummaryId] = useState(null);
  const [editSummaryTitle, setEditSummaryTitle] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [collapsedSubjects, setCollapsedSubjects] = useState({});
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folders, setFolders] = useState([]);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  // Build grouped object — includes empty folders too
  const grouped = summaries.reduce((acc, s) => {
    const key = s.subject || 'Sin materia';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
  folders.forEach(f => { if (!grouped[f]) grouped[f] = []; });

  const allSubjects = Object.keys(grouped);

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

  function startEditFolder(key) {
    setEditingFolder(key);
    setEditFolderName(key);
  }

  function saveEditFolder() {
    if (!editFolderName.trim() || editFolderName === editingFolder) {
      setEditingFolder(null);
      return;
    }
    // Rename all summaries in this folder
    summaries.filter(s => (s.subject || 'Sin materia') === editingFolder)
      .forEach(s => updateSummary(s.id, { subject: editFolderName.trim() }));
    setFolders(prev => prev.map(f => f === editingFolder ? editFolderName.trim() : f));
    setEditingFolder(null);
  }

  function createFolder() {
    if (!newFolderName.trim()) return;
    setFolders(prev => [...prev, newFolderName.trim()]);
    setNewFolderName('');
    setNewFolderMode(false);
  }

  function startEditSummary(s) {
    setEditingSummaryId(s.id);
    setEditSummaryTitle(s.title);
  }

  function saveEditSummary() {
    if (editSummaryTitle.trim()) updateSummary(editingSummaryId, { title: editSummaryTitle.trim() });
    setEditingSummaryId(null);
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(400px, 100vw)',
        zIndex: 201,
        background: 'var(--ghost-white)',
        borderLeft: '1px solid var(--soft-grey)',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.18)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--soft-grey)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 2, letterSpacing: '-0.2px' }}>Biblioteca</h2>
              <p style={{ fontSize: 12, color: 'var(--text-light)' }}>{summaries.length} resumen{summaries.length !== 1 ? 'es' : ''}</p>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-dark)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300 }}>×</button>
          </div>

          {/* Nueva carpeta */}
          {newFolderMode ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolderMode(false); }}
                placeholder="Nombre de la carpeta..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--driftwood)', background: 'var(--pale-mist)', color: 'var(--text-dark)', fontSize: 13, outline: 'none' }}
              />
              <button onClick={createFolder} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--driftwood)', color: 'white', fontSize: 13, fontWeight: 500 }}>Crear</button>
              <button onClick={() => setNewFolderMode(false)} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setNewFolderMode(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1.5px dashed var(--whisper-grey)', color: 'var(--text-mid)', fontSize: 13, width: '100%', justifyContent: 'center', transition: 'all 0.2s', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--driftwood)'; e.currentTarget.style.color = 'var(--text-dark)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--whisper-grey)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
            >
              <span style={{ fontSize: 16 }}>+</span> Nueva carpeta
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 24px' }}>
          {summaries.length === 0 && allSubjects.filter(k => grouped[k].length === 0).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>
                <FolderIcon size={48} color="var(--text-light)" />
              </div>
              <p style={{ fontSize: 14 }}>No hay resúmenes guardados</p>
            </div>
          ) : allSubjects.map(subjectKey => (
            <div key={subjectKey} style={{ marginBottom: 4 }}>

              {/* Folder row */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOverFolder(subjectKey); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverFolder(null); }}
                onDrop={e => {
                  e.preventDefault();
                  const summaryId = parseInt(e.dataTransfer.getData('summaryId'));
                  if (summaryId) updateSummary(summaryId, { subject: subjectKey });
                  setDragOverFolder(null);
                }}
                style={{
                  display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 6,
                  borderRadius: 8, transition: 'background 0.15s',
                  background: dragOverFolder === subjectKey ? 'rgba(193,165,124,0.18)' : 'transparent',
                  outline: dragOverFolder === subjectKey ? '2px dashed var(--driftwood)' : 'none',
                }}
              >
                <button onClick={() => toggleSubject(subjectKey)} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-light)', width: 10 }}>{collapsedSubjects[subjectKey] ? '▶' : '▼'}</span>
                  <FolderIcon size={16} color="var(--driftwood)" />
                  {editingFolder === subjectKey ? (
                    <input
                      autoFocus
                      value={editFolderName}
                      onChange={e => setEditFolderName(e.target.value)}
                      onBlur={saveEditFolder}
                      onKeyDown={e => { if (e.key === 'Enter') saveEditFolder(); if (e.key === 'Escape') setEditingFolder(null); }}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, fontSize: 13, fontWeight: 600, background: 'var(--pale-mist)', color: 'var(--text-dark)', border: '1px solid var(--driftwood)', borderRadius: 6, padding: '2px 8px', outline: 'none' }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '0.1px' }}>{subjectKey}</span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--text-light)', background: 'var(--soft-grey)', borderRadius: 20, padding: '1px 7px', marginLeft: 4 }}>{grouped[subjectKey].length}</span>
                </button>
                <button
                  onClick={() => startEditFolder(subjectKey)}
                  title="Renombrar carpeta"
                  style={{ padding: '3px 6px', borderRadius: 6, background: 'transparent', color: 'var(--text-light)', fontSize: 12, opacity: 0.6, transition: 'opacity 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                >✏</button>
              </div>

              {/* Summary items */}
              {!collapsedSubjects[subjectKey] && grouped[subjectKey].map(s => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('summaryId', s.id.toString()); e.dataTransfer.effectAllowed = 'move'; }}
                  style={{ margin: '2px 12px 2px 32px', cursor: 'grab' }}
                >
                  <SummaryItem
                    summary={s}
                    isEditing={editingSummaryId === s.id}
                    editTitle={editSummaryTitle}
                    onOpen={() => openSummary(s)}
                    onStartEdit={() => startEditSummary(s)}
                    onEditChange={setEditSummaryTitle}
                    onSaveEdit={saveEditSummary}
                    onToggleTag={tagId => toggleTag(s.id, tagId, s.tags)}
                    onDelete={() => deleteSummary(s.id)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SummaryItem({ summary, isEditing, editTitle, onOpen, onStartEdit, onEditChange, onSaveEdit, onToggleTag, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const tags = summary.tags || [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: hovered ? 'var(--soft-grey)' : 'transparent',
        transition: 'background 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }} onClick={isEditing ? undefined : onOpen}>
        <FileIcon size={14} color="var(--text-mid)" />
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onSaveEdit(); }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: 13, fontWeight: 500, background: 'var(--pale-mist)', color: 'var(--text-dark)', border: '1px solid var(--driftwood)', borderRadius: 6, padding: '3px 8px', outline: 'none' }}
          />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dark)', flex: 1, lineHeight: 1.4 }}>{summary.title}</span>
        )}
        {hovered && !isEditing && (
          <button
            onClick={e => { e.stopPropagation(); onStartEdit(); }}
            style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 5, background: 'var(--whisper-grey)', color: 'var(--text-dark)', fontSize: 11, fontWeight: 500 }}
          >✏ Editar</button>
        )}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {TAG_OPTIONS.map(tag => {
          const active = tags.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={e => { e.stopPropagation(); onToggleTag(tag.id); }}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: active ? tag.color : 'var(--pale-mist)',
                color: active ? '#fff' : 'var(--text-mid)',
                border: `1.5px solid ${active ? tag.color : 'var(--whisper-grey)'}`,
                transition: 'all 0.2s ease', cursor: 'pointer',
                letterSpacing: '0.2px',
              }}
            >{tag.label}</button>
          );
        })}
      </div>

      {/* Delete */}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'var(--whisper-grey)', color: 'var(--text-dark)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300 }}
        >×</button>
      )}
    </div>
  );
}

function FolderIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 4a1 1 0 011-1h4l1.5 2H14a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z" fill={color} />
    </svg>
  );
}

function FileIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 1a1 1 0 011-1h6l4 4v11a1 1 0 01-1 1H3a1 1 0 01-1-1V1z" fill={color} opacity="0.5" />
      <path d="M9 0l4 4H9V0z" fill={color} opacity="0.8" />
    </svg>
  );
}
