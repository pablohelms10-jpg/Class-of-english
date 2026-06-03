import React from 'react';

export default function MilaLogo({ size = 32, dark = false }) {
  const color = dark ? '#F0EEE9' : '#2C2C2C';
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 80 48" fill="none">
      {/* small square */}
      <rect x="0" y="16" width="16" height="16" fill={color} />
      {/* left parallelogram */}
      <polygon points="20,48 36,0 52,0 36,48" fill={color} />
      {/* right parallelogram */}
      <polygon points="52,0 68,48 80,48 64,0" fill={color} />
    </svg>
  );
}
