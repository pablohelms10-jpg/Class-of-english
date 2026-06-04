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
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid var(--soft-grey)`,
        background: 'var(--ghost-white)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <button
          onClick={() => { setActiveSummary(null); setActiveMode(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <MilaLogo size={36} dark={darkMode} noAnimate={true} />
          <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-dark)', fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>MILA</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {activeSummary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--driftwood)',
              }} />
              <span style={{ fontSize: 13, color: 'var(--text-mid)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeSummary.title}
              </span>
            </div>
          )}
          <button
            onClick={() => setLibraryOpen(true)}
            title="Biblioteca"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'transparent',
              border: '1.5px solid var(--soft-grey)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s ease',
              color: 'var(--text-mid)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--soft-grey)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.7"/>
              <rect x="6" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.85"/>
              <rect x="11" y="2" width="4" height="12" rx="1" fill="currentColor"/>
            </svg>
          </button>
          {supabaseEnabled && user && syncError && (
            <div title={syncError === 'error' ? 'Error al sincronizar con la nube' : 'Sincronizado con la nube'} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 8,
              background: syncError === 'error' ? 'rgba(180,60,60,0.12)' : 'rgba(60,160,80,0.12)',
              color: syncError === 'error' ? '#a33' : '#2a7',
              border: `1px solid ${syncError === 'error' ? 'rgba(180,60,60,0.3)' : 'rgba(60,160,80,0.3)'}`,
            }}>
              {syncError === 'error' ? '⚠ Sin nube' : '✓ Nube'}
            </div>
          )}
          <DarkModeToggle dark={darkMode} onToggle={toggleDark} />
          {supabaseEnabled && user && (
            <button
              onClick={signOut}
              title={`Cerrar sesión (${user.email})`}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'transparent',
                border: '1.5px solid var(--soft-grey)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-light)', fontSize: 14,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--soft-grey)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ↪
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 900, width: '100%', margin: '0 auto', animation: 'fadeUp 0.5s ease both' }}>
        {children}
      </main>

      <footer style={{ padding: '16px 32px', textAlign: 'center', borderTop: `1px solid var(--soft-grey)` }}>
        <span style={{ fontSize: 11, color: 'var(--text-light)', letterSpacing: '0.5px' }}>MILA · Tu asistente de estudio</span>
      </footer>
      <LibraryPanel open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </div>
  );
}
