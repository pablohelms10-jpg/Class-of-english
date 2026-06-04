import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useMila } from '../context/MilaContext';
import MilaLogo from './MilaLogo';
import StatsModal from './StatsModal';
import ChatPanel, { ChatIcon } from './ChatPanel';

const TAG_OPTIONS = [
  { id: 'era1', label: 'ERA 1', color: '#8B7355' },
  { id: 'era2', label: 'ERA 2', color: '#6B7A5E' },
  { id: 'era3', label: 'ERA 3', color: '#5E6B7A' },
  { id: 'efi',  label: 'EFI',   color: '#7A5E6B' },
];

const THEMES = [
  { id: 'default', name: 'Original',      palette: ['#F2F1EE','#DAD5CF','#C1B7AF','#B0A8A4','#96948F'], textOnDark: '#2C2C2C' },
  { id: 'sand',    name: 'Arena Cálida',   palette: ['#e8e3cd','#e4d0b7','#cbb095','#ad9277','#96785e'], textOnDark: '#2c1e10' },
  { id: 'rose',    name: 'Rosa Polvo',     palette: ['#dfcec4','#e7d6c6','#d7b8b6','#c1a3a1','#bd8c88'], textOnDark: '#3d1f1e' },
  { id: 'sage',    name: 'Salvia',         palette: ['#e1e3ce','#c0c2ac','#d9c8ac','#bbb59d','#999383'], textOnDark: '#282c18' },
  { id: 'grey',    name: 'Gris Fresco',    palette: ['#d6d5d1','#c7cac3','#babcaf','#a1a199','#88887a'], textOnDark: '#1a1a18' },
  { id: 'mint',    name: 'Menta',          palette: ['#cdd9cf','#b7c1a9','#a1b8a6','#97a38f','#767970'], textOnDark: '#182618' },
  { id: 'dust',    name: 'Polvo Cálido',   palette: ['#e1cbbd','#cac1ae','#b4a296','#938173','#7a6458'], textOnDark: '#2d1a10' },
  { id: 'smoke',   name: 'Humo',           palette: ['#dfe0db','#cccdc8','#b1b4aa','#7e8480','#636862'], textOnDark: '#1a1c19' },
  { id: 'slate',   name: 'Pizarra',        palette: ['#d0e0dd','#b2c6c4','#a3b6bd','#7e8f97','#505b5d'], textOnDark: '#0f1e20' },
  { id: 'teal',    name: 'Petróleo',       palette: ['#d1d5d4','#bdc7d3','#a5b4b9','#888a89','#4b5d5f'], textOnDark: '#0d1a1b' },
];

export default function SidePanel({ open, onClose }) {
  const { summaries, darkMode, toggleDark, customTheme, setCustomTheme,
          user, signOut, supabaseEnabled, syncError,
          setActiveSummary, setActiveMode, updateSummary, deleteSummary } = useMila();
  const [view, setView] = useState('menu'); // 'menu' | 'library' | 'stats' | 'settings'
  const [chatOpen, setChatOpen] = useState(false);
  const [editingSummaryId, setEditingSummaryId] = useState(null);
  const [editSummaryTitle, setEditSummaryTitle] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [collapsedSubjects, setCollapsedSubjects] = useState({});
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folders, setFolders] = useState([]);
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [statsForSummary, setStatsForSummary] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  function handleClose() {
    onClose();
    setTimeout(() => { setView('menu'); setSelectMode(false); setSelected(new Set()); }, 350);
  }

  function goSettings() { setView('settings'); }

  // ── Library helpers ──────────────────────────────────────────
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
    handleClose();
  }

  function toggleTag(summaryId, tagId, currentTags) {
    const tags = currentTags || [];
    const next = tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId];
    updateSummary(summaryId, { tags: next });
  }

  function toggleSubject(key) {
    setCollapsedSubjects(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function startEditFolder(key) { setEditingFolder(key); setEditFolderName(key); }

  function saveEditFolder() {
    if (!editFolderName.trim() || editFolderName === editingFolder) { setEditingFolder(null); return; }
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

  function startEditSummary(s) { setEditingSummaryId(s.id); setEditSummaryTitle(s.title); }

  function saveEditSummary() {
    if (editSummaryTitle.trim()) updateSummary(editingSummaryId, { title: editSummaryTitle.trim() });
    setEditingSummaryId(null);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    selected.forEach(id => deleteSummary(id));
    setSelected(new Set());
    setSelectMode(false);
  }

  // ── Stats helpers ────────────────────────────────────────────
  const totalFC = summaries.reduce((a, s) => a + (s.flashcards?.length || 0), 0);
  const knownFC = summaries.reduce((a, s) => a + (s.flashcards?.filter(f => f.known)?.length || 0), 0);
  const totalQ  = summaries.reduce((a, s) => a + (s.questions?.length || 0), 0);
  const masteredNodes = summaries.reduce((a, s) => {
    const mn = s.masteredNodes || {};
    return a + Object.values(mn).filter(Boolean).length;
  }, 0);
  const totalNodes = summaries.reduce((a, s) => a + (s.conceptMap?.nodes?.length || 0), 0);

  // ── Render views ─────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 'min(340px, 88vw)',
        zIndex: 201,
        background: 'var(--ghost-white)',
        borderRight: '1px solid var(--soft-grey)',
        boxShadow: '12px 0 48px rgba(0,0,0,0.15)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── MAIN MENU ── */}
        {view === 'menu' && (
          <>
            {/* Header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--soft-grey)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={() => { setActiveSummary(null); setActiveMode(null); handleClose(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <MilaLogo size={28} dark={darkMode} noAnimate />
                  <span style={{ fontSize: 17, fontWeight: 600, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'var(--text-dark)' }}>MILA</span>
                </button>
                <button onClick={handleClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-dark)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300 }}>×</button>
              </div>
              {supabaseEnabled && user && syncError && (
                <div style={{
                  marginTop: 10, padding: '5px 10px', borderRadius: 8, fontSize: 11,
                  background: syncError === 'ok' ? 'rgba(60,160,80,0.1)' : 'rgba(180,60,60,0.1)',
                  color: syncError === 'ok' ? '#2a7' : '#a33',
                  border: `1px solid ${syncError === 'ok' ? 'rgba(60,160,80,0.25)' : 'rgba(180,60,60,0.25)'}`,
                }}>
                  {syncError === 'ok' ? '✓ Sincronizado con la nube' : '⚠ Sin sincronización'}
                </div>
              )}
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              <NavItem
                icon={<LibraryIcon />}
                label="Biblioteca"
                badge={summaries.length}
                onClick={() => setView('library')}
                chevron
              />
              <NavItem
                icon={<StatsIcon />}
                label="Estadísticas"
                onClick={() => setView('stats')}
                chevron
              />
              <NavItem
                icon={<ChatIcon size={16} color="currentColor" />}
                label="Chat con MILA"
                badge={summaries.length > 0 ? null : undefined}
                onClick={() => { onClose(); setTimeout(() => setChatOpen(true), 100); }}
              />

              <div style={{ margin: '8px 16px', borderTop: '1px solid var(--soft-grey)', paddingTop: 8 }}>
                {/* Dark mode row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--text-mid)' }}><MoonIcon /></span>
                    <span style={{ fontSize: 14, color: 'var(--text-dark)', fontWeight: 500 }}>{darkMode ? 'Oscuro' : 'Claro'}</span>
                  </div>
                  <button
                    onClick={toggleDark}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: darkMode ? 'var(--driftwood)' : 'var(--soft-grey)',
                      position: 'relative', transition: 'background 0.3s', cursor: 'pointer',
                      border: 'none', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: darkMode ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                <NavItem
                  icon={<ConfigIcon />}
                  label="Configuración"
                  onClick={goSettings}
                  subdued
                />
              </div>
            </div>

            {/* Bottom: sign out */}
            {supabaseEnabled && user && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--soft-grey)', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
                <button
                  onClick={() => { signOut(); handleClose(); }}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 10,
                    border: '1.5px solid var(--soft-grey)',
                    background: 'transparent', color: 'var(--text-mid)',
                    fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(176,168,164,0.12)'; e.currentTarget.style.color = 'var(--text-dark)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-mid)'; }}
                >
                  <SignOutIcon /> Cerrar sesión
                </button>
              </div>
            )}
          </>
        )}

        {/* ── LIBRARY VIEW ── */}
        {view === 'library' && (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-grey)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => { setView('menu'); setSelectMode(false); setSelected(new Set()); }} style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 12, display: 'flex', alignItems: 'center' }}>‹</button>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dark)' }}>Biblioteca</h2>
                  <span style={{ fontSize: 11, color: 'var(--text-light)', background: 'var(--soft-grey)', borderRadius: 20, padding: '2px 8px' }}>{summaries.length}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {selectMode ? (
                    <>
                      {selected.size > 0 && (
                        <button
                          onClick={deleteSelected}
                          style={{ padding: '5px 12px', borderRadius: 8, background: '#c0392b', color: 'white', fontSize: 12, fontWeight: 600 }}
                        >
                          Eliminar {selected.size}
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                        style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 12 }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectMode(true)}
                      style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 12, fontWeight: 500 }}
                    >
                      Seleccionar
                    </button>
                  )}
                  <button onClick={handleClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-dark)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300 }}>×</button>
                </div>
              </div>

              {/* Nueva carpeta */}
              {!selectMode && (newFolderMode ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolderMode(false); }}
                    placeholder="Nombre de la carpeta..."
                    style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--driftwood)', background: 'var(--pale-mist)', color: 'var(--text-dark)', fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={createFolder} style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--driftwood)', color: 'white', fontSize: 12, fontWeight: 500 }}>Crear</button>
                  <button onClick={() => setNewFolderMode(false)} style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 12 }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setNewFolderMode(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1.5px dashed var(--whisper-grey)', color: 'var(--text-mid)', fontSize: 13, width: '100%', justifyContent: 'center', transition: 'all 0.2s', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--driftwood)'; e.currentTarget.style.color = 'var(--text-dark)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--whisper-grey)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
                >
                  <span style={{ fontSize: 16 }}>+</span> Nueva carpeta
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 24px' }}>
              {summaries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-light)' }}>
                  <p style={{ fontSize: 14 }}>No hay resúmenes guardados</p>
                </div>
              ) : allSubjects.map(subjectKey => (
                <div key={subjectKey} style={{ marginBottom: 4 }}>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOverFolder(subjectKey); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverFolder(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      const id = parseInt(e.dataTransfer.getData('summaryId'));
                      if (id) updateSummary(id, { subject: subjectKey });
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
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>{subjectKey}</span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--text-light)', background: 'var(--soft-grey)', borderRadius: 20, padding: '1px 7px', marginLeft: 4 }}>{grouped[subjectKey].length}</span>
                    </button>
                    {!selectMode && (
                      <button onClick={() => startEditFolder(subjectKey)} style={{ padding: '3px 6px', borderRadius: 6, background: 'transparent', color: 'var(--text-light)', fontSize: 12, opacity: 0.6 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                      >✏</button>
                    )}
                  </div>

                  {!collapsedSubjects[subjectKey] && grouped[subjectKey].map(s => (
                    <div key={s.id}
                      draggable={!selectMode}
                      onDragStart={e => { e.dataTransfer.setData('summaryId', s.id.toString()); e.dataTransfer.effectAllowed = 'move'; }}
                      style={{ margin: '2px 12px 2px 32px', cursor: selectMode ? 'pointer' : 'grab' }}
                      onClick={selectMode ? () => toggleSelect(s.id) : undefined}
                    >
                      <SummaryItem
                        summary={s}
                        isEditing={editingSummaryId === s.id}
                        editTitle={editSummaryTitle}
                        onOpen={selectMode ? () => toggleSelect(s.id) : () => openSummary(s)}
                        onStartEdit={() => startEditSummary(s)}
                        onEditChange={setEditSummaryTitle}
                        onSaveEdit={saveEditSummary}
                        onToggleTag={tagId => toggleTag(s.id, tagId, s.tags)}
                        onDelete={() => deleteSummary(s.id)}
                        onStats={() => setStatsForSummary(s)}
                        selectMode={selectMode}
                        selected={selected.has(s.id)}
                        onToggleSelect={() => toggleSelect(s.id)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── STATS VIEW ── */}
        {view === 'stats' && (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-grey)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setView('menu')} style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 12, display: 'flex', alignItems: 'center' }}>‹</button>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dark)' }}>Estadísticas globales</h2>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px' }}>
              <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 20 }}>{summaries.length} resumen{summaries.length !== 1 ? 'es' : ''} en total</p>

              {/* KPI cards */}
              {[
                { label: 'Flashcards conocidas', value: `${knownFC} / ${totalFC}`, pct: totalFC ? Math.round(knownFC / totalFC * 100) : 0, color: '#7BAE7F' },
                { label: 'Preguntas disponibles', value: totalQ, color: '#C1A97A' },
                { label: 'Nodos dominados', value: `${masteredNodes} / ${totalNodes}`, pct: totalNodes ? Math.round(masteredNodes / totalNodes * 100) : 0, color: '#A89098' },
              ].map(k => (
                <div key={k.label} style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 12, background: 'var(--pale-mist)', border: '1px solid var(--soft-grey)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-dark)', marginBottom: k.pct != null ? 8 : 0 }}>{k.value}</div>
                  {k.pct != null && (
                    <div style={{ height: 4, background: 'var(--soft-grey)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${k.pct}%`, background: k.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                  )}
                </div>
              ))}

              {/* Per-summary stats links */}
              <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '24px 0 12px' }}>Estadísticas por resumen</p>
              {summaries.map(s => {
                const fc = (s.flashcards || []).length;
                const known = (s.flashcards || []).filter(f => f.known).length;
                const mn = Object.values(s.masteredNodes || {}).filter(Boolean).length;
                const tn = (s.conceptMap?.nodes || []).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStatsForSummary(s)}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, background: 'transparent', border: '1px solid var(--soft-grey)', marginBottom: 8, cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--soft-grey)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                      {known}/{fc} flashcards · {mn}/{tn} nodos
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── SETTINGS VIEW ── */}
        {view === 'settings' && (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-grey)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setView('menu')} style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 12, display: 'flex', alignItems: 'center' }}>‹</button>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dark)' }}>Configuración</h2>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Temas personalizados
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {THEMES.map(theme => {
                  const isActive = (customTheme || 'default') === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setCustomTheme(theme.id)}
                      style={{
                        padding: '12px 10px 10px',
                        borderRadius: 14,
                        border: isActive ? '2px solid var(--driftwood)' : '2px solid transparent',
                        background: theme.palette[0],
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        boxShadow: isActive ? '0 0 0 3px rgba(193,183,175,0.25)' : 'none',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Color swatch row */}
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {theme.palette.slice(1).map((c, i) => (
                          <div key={i} style={{
                            width: 18, height: 18, borderRadius: '50%',
                            background: c,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                            flexShrink: 0,
                          }} />
                        ))}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 600,
                        color: theme.textOnDark,
                        letterSpacing: '0.01em',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {theme.name}
                      </div>
                      {isActive && (
                        <div style={{
                          position: 'absolute', top: 7, right: 7,
                          width: 16, height: 16, borderRadius: '50%',
                          background: theme.palette[3],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 28, padding: '14px 16px', borderRadius: 12, background: 'var(--pale-mist)', border: '1px solid var(--soft-grey)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 6 }}>Modo oscuro</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>{darkMode ? 'Activado' : 'Desactivado'}</span>
                  <button
                    onClick={toggleDark}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: darkMode ? 'var(--driftwood)' : 'var(--soft-grey)',
                      position: 'relative', transition: 'background 0.3s', cursor: 'pointer',
                      border: 'none', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: darkMode ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Stats modal for a specific summary */}
      {statsForSummary && ReactDOM.createPortal(
        <StatsModal summary={statsForSummary} onClose={() => setStatsForSummary(null)} />,
        document.body
      )}

      {/* Chat panel — rendered outside left panel so both can coexist */}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}

function NavItem({ icon, label, badge, onClick, chevron, subdued }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '13px 20px', background: hov ? 'var(--soft-grey)' : 'transparent',
        border: 'none', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left',
      }}
    >
      <span style={{ color: subdued ? 'var(--text-light)' : 'var(--text-mid)', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: subdued ? 'var(--text-light)' : 'var(--text-dark)' }}>{label}</span>
      {badge != null && <span style={{ fontSize: 11, color: 'var(--text-light)', background: 'var(--soft-grey)', borderRadius: 20, padding: '2px 8px', minWidth: 20, textAlign: 'center' }}>{badge}</span>}
      {chevron && <span style={{ fontSize: 11, color: 'var(--text-light)' }}>›</span>}
    </button>
  );
}

function SummaryItem({ summary, isEditing, editTitle, onOpen, onStartEdit, onEditChange, onSaveEdit, onToggleTag, onDelete, onStats, selectMode, selected, onToggleSelect }) {
  const [hovered, setHovered] = useState(false);
  const tags = summary.tags || [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px', borderRadius: 10,
        background: selected ? 'rgba(193,165,124,0.15)' : hovered ? 'var(--soft-grey)' : 'transparent',
        border: selected ? '1.5px solid var(--driftwood)' : '1.5px solid transparent',
        transition: 'all 0.2s ease', position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectMode ? 0 : 8, cursor: 'pointer' }} onClick={isEditing ? undefined : onOpen}>
        {selectMode ? (
          <div style={{
            width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? 'var(--driftwood)' : 'var(--soft-grey)'}`,
            background: selected ? 'var(--driftwood)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selected && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
          </div>
        ) : (
          <FileIcon size={14} color="var(--text-mid)" />
        )}
        {isEditing ? (
          <input autoFocus value={editTitle} onChange={e => onEditChange(e.target.value)} onBlur={onSaveEdit}
            onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onSaveEdit(); }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: 13, fontWeight: 500, background: 'var(--pale-mist)', color: 'var(--text-dark)', border: '1px solid var(--driftwood)', borderRadius: 6, padding: '3px 8px', outline: 'none' }}
          />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dark)', flex: 1, lineHeight: 1.4 }}>{summary.title}</span>
        )}
        {hovered && !isEditing && !selectMode && (
          <button onClick={e => { e.stopPropagation(); onStartEdit(); }}
            style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 5, background: 'var(--whisper-grey)', color: 'var(--text-dark)', fontSize: 11, fontWeight: 500 }}>
            ✏ Editar
          </button>
        )}
      </div>

      {!selectMode && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {TAG_OPTIONS.map(tag => {
            const active = tags.includes(tag.id);
            return (
              <button key={tag.id} onClick={e => { e.stopPropagation(); onToggleTag(tag.id); }}
                style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: active ? tag.color : 'var(--pale-mist)', color: active ? '#fff' : 'var(--text-mid)', border: `1.5px solid ${active ? tag.color : 'var(--whisper-grey)'}`, transition: 'all 0.2s', cursor: 'pointer' }}
              >{tag.label}</button>
            );
          })}
        </div>
      )}

      {hovered && !selectMode && (
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onStats(); }}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--whisper-grey)', color: 'var(--text-dark)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Estadísticas">📊</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--whisper-grey)', color: 'var(--text-dark)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300 }}>×</button>
        </div>
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

function LibraryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="6" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.85"/>
      <rect x="11" y="2" width="4" height="12" rx="1" fill="currentColor"/>
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 9.5A6.5 6.5 0 016.5 2a6.5 6.5 0 100 13A6.5 6.5 0 0014 9.5z" fill="currentColor" opacity="0.8"/>
    </svg>
  );
}

function ConfigIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M6 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M10 10l3-2.5L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="13" y1="7.5" x2="6" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
