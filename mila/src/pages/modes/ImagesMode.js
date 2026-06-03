import React, { useState, useEffect } from 'react';
import { renderPDFPage } from '../../utils/parseContent';

function LazyImage({ img, onClick }) {
  const [src, setSrc] = useState(img.src);

  useEffect(() => {
    if (img.lazy && !img.src) {
      renderPDFPage(img.pdfFile, img.pageNum).then(setSrc);
    }
  }, [img]);

  if (!src) {
    return (
      <div onClick={onClick} style={{
        borderRadius: 'var(--radius-md)', border: '1.5px solid var(--soft-grey)',
        aspectRatio: '1', background: 'var(--pale-mist)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 6,
      }}>
        <div style={{ width: 20, height: 20, border: '2px solid var(--driftwood)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 10, color: 'var(--text-light)' }}>pág. {img.pageNum}</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid var(--soft-grey)', aspectRatio: '1', background: 'var(--pale-mist)' }}>
      <img src={src} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  );
}

export default function ImagesMode({ images }) {
  const [selected, setSelected] = useState(null);
  const [selectedSrc, setSelectedSrc] = useState(null);

  async function openImage(img) {
    setSelected(img);
    if (img.lazy && !img.src) {
      const src = await renderPDFPage(img.pdfFile, img.pageNum);
      setSelectedSrc(src);
    } else {
      setSelectedSrc(img.src);
    }
  }

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
          <LazyImage key={i} img={img} onClick={() => openImage(img)} />
        ))}
      </div>

      {selected && (
        <div
          onClick={() => { setSelected(null); setSelectedSrc(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(44,44,44,0.7)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: 32,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '100%' }}>
            {selectedSrc
              ? <img src={selectedSrc} alt={selected.name} style={{ width: '100%', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)' }} />
              : <div style={{ textAlign: 'center', color: 'white', padding: 40 }}>Cargando página…</div>
            }
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 12 }}>
              {selected.name} · Toca fuera para cerrar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
