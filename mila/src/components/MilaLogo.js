import React, { useState, useEffect } from 'react';

export default function MilaLogo({ size = 40, dark = false, noAnimate = false }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (noAnimate) return;
    const t = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(t);
  }, [noAnimate]);

  const color = dark ? '#F5F2EE' : '#1C1C1C';

  return (
    <>
      <style>{`
        @keyframes milaAssembleLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes milaAssembleUp {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes milaAssembleRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <svg
        width={size}
        height={size * 0.58}
        viewBox="0 0 120 70"
        fill="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <rect
          x="0" y="32" width="18" height="18" rx="1"
          fill={color}
          style={animate ? {
            animation: `milaAssembleLeft 0.6s cubic-bezier(0.4,0,0.2,1) 0ms both`,
          } : { opacity: noAnimate ? 1 : 0 }}
        />
        <polygon
          points="22,50 38,4 58,4 42,50"
          fill={color}
          style={animate ? {
            animation: `milaAssembleUp 0.6s cubic-bezier(0.4,0,0.2,1) 160ms both`,
          } : { opacity: noAnimate ? 1 : 0 }}
        />
        <polygon
          points="62,4 82,4 98,50 78,50"
          fill={color}
          style={animate ? {
            animation: `milaAssembleRight 0.6s cubic-bezier(0.4,0,0.2,1) 300ms both`,
          } : { opacity: noAnimate ? 1 : 0 }}
        />
      </svg>
    </>
  );
}
