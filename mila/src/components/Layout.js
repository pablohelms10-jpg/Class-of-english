import React, { useState } from 'react';
import { useMila } from '../context/MilaContext';
import MilaLogo from './MilaLogo';
import DarkModeToggle from './DarkModeToggle';
import LibraryPanel from './LibraryPanel';

export default function Layout({ children }) {
  const { activeSummary, setActiveSummary, setActiveMode, darkMode, toggleDark, user, signOut, supabaseEnabled, syncError } = useMila();
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--ghost-white) 0%, var(--moonbeam) 50%, var(--feather-fog) 100%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{
        padding: 'clamp(12px, 2vw, 20px) clamp(16px, 4vw, 28px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid var(--soft-grey)`,
        background: 'var(--ghost-white)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: 8,
      }}>
        <button
          onClick={() => { setActiveSummary(null); setActiveMode(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          <MilaLogo size={30} dark={darkMode} noAnimate={true} />
          <span className="header-title-label" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-dark)', fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>MILA</span>
        </button>

        {activeSummary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'center' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--driftwood)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeSummary.title}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setLibraryOpen(true)}
            title="Biblioteca"
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'transparent',
              border: '1.5px solid var(--soft-grey)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-mid)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.7"/>
              <rect x="6" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.85"/>
              <rect x="11" y="2" width="4" height="12" rx="1" fill="currentColor"/>
            </svg>
          </button>
          {supabaseEnabled && user && syncError && (
            <div className="header-sync-label" style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 8, flexShrink: 0,
              background: syncError === 'ok' ? 'rgba(60,160,80,0.12)' : 'rgba(180,60,60,0.12)',
              color: syncError === 'ok' ? '#2a7' : '#a33',
              border: `1px solid ${syncError === 'ok' ? 'rgba(60,160,80,0.3)' : 'rgba(180,60,60,0.3)'}`,
            }}>
              {syncError === 'ok' ? '✓ Nube' : '⚠ Sin nube'}
            </div>
          )}
          {/* On mobile: show sync status as dot only */}
          {supabaseEnabled && user && syncError && (
            <div className="header-sync-dot" title={syncError === 'ok' ? 'Sincronizado' : syncError} style={{
              display: 'none',
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: syncError === 'ok' ? '#2a7' : '#a33',
            }} />
          )}
          <DarkModeToggle dark={darkMode} onToggle={toggleDark} />
          {supabaseEnabled && user && (
            <button
              onClick={signOut}
              title={`Cerrar sesión (${user.email})`}
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'transparent',
                border: '1.5px solid var(--soft-grey)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-light)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M10 10l3-2.5L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="13" y1="7.5" x2="6" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, padding: 'clamp(16px, 4vw, 32px) clamp(12px, 4vw, 24px)', maxWidth: 900, width: '100%', margin: '0 auto', animation: 'fadeUp 0.5s ease both' }}>
        {children}
      </main>

      <footer style={{ padding: '12px 16px', textAlign: 'center', borderTop: `1px solid var(--soft-grey)` }}>
        <span style={{ fontSize: 11, color: 'var(--text-light)', letterSpacing: '0.5px' }}>MILA · Tu asistente de estudio</span>
      </footer>
      <LibraryPanel open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </div>
  );
}
