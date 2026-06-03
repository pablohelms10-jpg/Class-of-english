import React from 'react';
import { useMila } from '../context/MilaContext';

export default function Layout({ children }) {
  const { activeSummary, setActiveSummary, setActiveMode } = useMila();

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
        background: 'rgba(250,250,247,0.8)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <button
          onClick={() => { setActiveSummary(null); setActiveMode(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 14, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>M</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.3px' }}>MILA</span>
        </button>

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
      </header>

      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
        {children}
      </main>

      <footer style={{ padding: '16px 32px', textAlign: 'center', borderTop: `1px solid var(--soft-grey)` }}>
        <span style={{ fontSize: 11, color: 'var(--text-light)', letterSpacing: '0.5px' }}>MILA · Tu asistente de estudio</span>
      </footer>
    </div>
  );
}
