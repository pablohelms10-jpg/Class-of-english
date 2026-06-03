import React from 'react';

export default function DarkModeToggle({ dark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--soft-grey)',
        borderRadius: 100,
        padding: 3,
        border: '1.5px solid var(--whisper-grey)',
        cursor: 'pointer',
        position: 'relative',
        gap: 0,
        transition: 'all 0.3s ease',
      }}
    >
      {['Claro', 'Oscuro'].map((label, i) => {
        const active = (i === 0 && !dark) || (i === 1 && dark);
        return (
          <span
            key={label}
            style={{
              padding: '6px 14px',
              borderRadius: 100,
              fontSize: 12,
              fontWeight: active ? 500 : 400,
              color: active ? (dark ? '#1A1A1A' : 'white') : 'var(--text-light)',
              background: active ? (dark ? 'var(--text-dark)' : '#2C2C2C') : 'transparent',
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              letterSpacing: '0.2px',
            }}
          >
            {label}
          </span>
        );
      })}
    </button>
  );
}
