import React, { useState } from 'react';

export default function ImagesMode({ images }) {
  const [selected, setSelected] = useState(null);

  if (!images || images.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🖼</div>
        <p>No hay imágenes en este resumen.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 20 }}>
        {images.length} imagen(es) extraída(s)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {images.map((img, i) => (
          <div
            key={i}
            onClick={() => setSelected(img)}
            style={{
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1.5px solid var(--soft-grey)',
              aspectRatio: '1',
              background: 'var(--pale-mist)',
            }}
          >
            <img
              src={img.src}
              alt={img.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ))}
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(44,44,44,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 32,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '100%' }}>
            <img
              src={selected.src}
              alt={selected.name}
              style={{ width: '100%', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)' }}
            />
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 12 }}>
              {selected.name} · Clic fuera para cerrar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
