import React, { useState } from 'react';
import { useMila } from '../context/MilaContext';
import MilaLogo from './MilaLogo';
import SidePanel from './SidePanel';

export default function Layout({ children }) {
  const { activeSummary, setActiveSummary, setActiveMode, darkMode } = useMila();
  const [panelOpen, setPanelOpen] = useState(false);

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
        {/* Hamburger */}
        <button
          onClick={() => setPanelOpen(true)}
          title="Menú"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'transparent',
            border: '1.5px solid var(--soft-grey)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, cursor: 'pointer', color: 'var(--text-mid)', flexShrink: 0,
          }}
        >
          <span style={{ display: 'block', width: 14, height: 1.5, background: 'currentColor', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 14, height: 1.5, background: 'currentColor', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 14, height: 1.5, background: 'currentColor', borderRadius: 2 }} />
        </button>

        {/* Logo / home button */}
        <button
          onClick={() => { setActiveSummary(null); setActiveMode(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          <MilaLogo size={30} dark={darkMode} noAnimate={true} />
          <span className="header-title-label" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-dark)', fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>MILA</span>
        </button>

        {/* Active summary title (center) */}
        {activeSummary ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'center' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--driftwood)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeSummary.title}
            </span>
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
      </header>

      <main style={{ flex: 1, padding: 'clamp(16px, 4vw, 32px) clamp(12px, 4vw, 24px)', maxWidth: 900, width: '100%', margin: '0 auto', animation: 'fadeUp 0.5s ease both' }}>
        {children}
      </main>

      <footer style={{ padding: '12px 16px', textAlign: 'center', borderTop: `1px solid var(--soft-grey)` }}>
        <span style={{ fontSize: 11, color: 'var(--text-light)', letterSpacing: '0.5px' }}>MILA · Tu asistente de estudio</span>
      </footer>

      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
