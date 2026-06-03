import React, { useState, useEffect } from 'react';
import { useMila } from '../context/MilaContext';
import MilaLogo from './MilaLogo';

export default function MilaLoadingScreen({ message, sub }) {
  const { darkMode } = useMila();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{ display: 'inline-flex', marginBottom: 24 }}>
        <MilaLogo key={tick} size={56} dark={darkMode} noAnimate={false} />
      </div>
      <p style={{ fontSize: 15, color: 'var(--text-mid)', marginBottom: 6 }}>{message}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-light)' }}>{sub}</p>}
    </div>
  );
}
