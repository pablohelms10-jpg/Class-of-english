import React from 'react';

const base = { display: 'block', flexShrink: 0 };

export function FlashcardIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <rect x="3" y="5" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5"/>
      <rect x="5" y="3" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5" opacity="0.4"/>
      <line x1="6" y1="9" x2="14" y2="9" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="6" y1="12" x2="11" y2="12" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export function QuizIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5"/>
      <path d="M7.5 7.5C7.5 6.1 8.6 5 10 5s2.5 1.1 2.5 2.5c0 1.5-2.5 2.5-2.5 2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="14.5" r="1" fill={color}/>
    </svg>
  );
}

export function MapIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <circle cx="10" cy="5" r="2" stroke={color} strokeWidth="1.4"/>
      <circle cx="4" cy="14" r="2" stroke={color} strokeWidth="1.4"/>
      <circle cx="16" cy="14" r="2" stroke={color} strokeWidth="1.4"/>
      <line x1="9" y1="6.7" x2="5.3" y2="12.3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="11" y1="6.7" x2="14.7" y2="12.3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="6" y1="14" x2="14" y2="14" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 2"/>
    </svg>
  );
}

export function GalleryIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <rect x="2" y="4" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5"/>
      <circle cx="7" cy="8.5" r="1.5" stroke={color} strokeWidth="1.2"/>
      <path d="M2 13l4-3 3.5 3 3-2.5 5.5 4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function UploadIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <path d="M10 13V5M10 5L7 8M10 5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 15h12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function DocumentIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <path d="M5 3h7l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={color} strokeWidth="1.5"/>
      <path d="M12 3v4h4" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="7" y1="10" x2="13" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="7" y1="13" x2="11" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function CheckCircleIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5"/>
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function StarIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <path d="M10 2l2.2 5h5.3l-4.3 3.1 1.7 5.2L10 12.3l-4.9 3 1.7-5.2L2.5 7h5.3L10 2z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

export function BookIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={color} strokeWidth="1.5"/>
      <line x1="10" y1="3" x2="10" y2="17" stroke={color} strokeWidth="1.2"/>
      <line x1="6" y1="7" x2="9" y2="7" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="6" y1="10" x2="9" y2="10" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

export function TrophyIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={base}>
      <path d="M6 3h8v7a4 4 0 01-8 0V3z" stroke={color} strokeWidth="1.5"/>
      <path d="M6 5H3a2 2 0 002 2h1M14 5h3a2 2 0 01-2 2h-1" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="10" y1="14" x2="10" y2="17" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="7" y1="17" x2="13" y2="17" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
