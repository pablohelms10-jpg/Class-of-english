import React from 'react';

export default function MilaLogo({ size = 40, dark = false }) {
  const color = dark ? '#F0EEE9' : '#1C1C1C';
  // Exact recreation of the reference logo:
  // small square bottom-left + two bold diagonal parallelograms forming an M
  return (
    <svg
      width={size}
      height={size * 0.58}
      viewBox="0 0 120 70"
      fill="none"
      style={{ display: 'block' }}
    >
      {/* Small square — bottom left */}
      <rect x="0" y="32" width="18" height="18" rx="1" fill={color} />

      {/* Left parallelogram — bold diagonal going upper-right */}
      <polygon points="22,50 38,4 58,4 42,50" fill={color} />

      {/* Right parallelogram — parallel, offset right */}
      <polygon points="62,4 82,4 98,50 78,50" fill={color} />
    </svg>
  );
}
