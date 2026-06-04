import React, { useState } from 'react';
import { useMila } from '../context/MilaContext';
import MilaLogo from './MilaLogo';

export default function AuthGate({ children }) {
  const { user, authLoading, authError, setAuthError, signIn, signUp, signOut, supabaseEnabled, darkMode } = useMila();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If Supabase isn't configured, skip auth and render the app directly
  if (!supabaseEnabled) return children;

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ghost-white)' }}>
        <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Iniciando…</div>
      </div>
    );
  }

  if (user) return children;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    if (mode === 'signin') await signIn(email, password);
    else await signUp(email, password);
    setSubmitting(false);
  }

  const confirmed = authError === '__confirm__';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--ghost-white) 0%, var(--moonbeam) 50%, var(--feather-fog) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--pale-mist)',
        borderRadius: 24,
        border: '1.5px solid var(--whisper-grey)',
        padding: '40px 36px',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <MilaLogo size={48} dark={darkMode} />
          <h1 style={{ marginTop: 14, fontSize: 26, fontWeight: 300, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'var(--text-dark)' }}>MILA</h1>
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Tu asistente de estudio en la nube</p>
        </div>

        {confirmed ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>✉️</div>
            <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>Revisá tu email para confirmar tu cuenta y luego iniciá sesión.</p>
            <button
              onClick={() => { setAuthError(''); setMode('signin'); }}
              style={{ marginTop: 20, fontSize: 13, color: 'var(--driftwood)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >Volver al inicio de sesión</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" required
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'} required
                style={inputStyle}
              />
            </div>

            {authError && authError !== '__confirm__' && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(176,100,100,0.1)', border: '1px solid rgba(176,100,100,0.3)', fontSize: 12, color: '#a33' }}>
                {authError}
              </div>
            )}

            <button
              type="submit" disabled={submitting}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
                color: 'white', fontSize: 14, fontWeight: 500,
                border: 'none', cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {submitting ? 'Cargando…' : mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>

            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setAuthError(''); }}
                style={{ fontSize: 12, color: 'var(--text-light)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {mode === 'signin' ? '¿No tenés cuenta? Crear una' : '¿Ya tenés cuenta? Iniciar sesión'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-light)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1.5px solid var(--soft-grey)',
  background: 'var(--ghost-white)',
  fontSize: 14,
  color: 'var(--text-dark)',
  outline: 'none',
  transition: 'border-color 0.2s',
};
