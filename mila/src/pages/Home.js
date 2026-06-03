import React, { useRef, useState } from 'react';
import { useMila } from '../context/MilaContext';
import { extractTextFromFile, extractImagesFromFile } from '../utils/parseContent';

const MODES = [
  { id: 'flashcards', emoji: '🃏', label: 'Flashcards', desc: 'Tarjetas de memorización interactivas' },
  { id: 'quiz', emoji: '⚡', label: 'Preguntas rápidas', desc: 'Test de opción múltiple' },
  { id: 'map', emoji: '🗺', label: 'Mapa conceptual', desc: 'Visualiza las ideas clave' },
  { id: 'images', emoji: '🖼', label: 'Galería de imágenes', desc: 'Imágenes extraídas del resumen' },
];

export default function Home() {
  const { summaries, addSummary, setActiveSummary, setActiveMode, deleteSummary } = useMila();
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);

  async function processFiles(files) {
    setLoading(true);
    try {
      let text = '';
      const images = [];

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const imgs = await extractImagesFromFile(file);
          images.push(...imgs);
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          const content = await extractTextFromFile(file);
          text += content + '\n\n';
        }
      }

      const summary = addSummary({
        title: title || files[0]?.name?.replace(/\.[^.]+$/, '') || 'Mi resumen',
        text,
        images,
        fileName: files[0]?.name,
      });
      setTitle('');
      setActiveSummary(summary);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length) processFiles(files);
  }

  function handleTextSubmit() {
    if (!textInput.trim()) return;
    const summary = addSummary({
      title: title || 'Mi resumen',
      text: textInput,
      images: [],
    });
    setTitle('');
    setTextInput('');
    setShowTextInput(false);
    setActiveSummary(summary);
  }

  return (
    <div>
      {summaries.length === 0 ? (
        <HeroSection />
      ) : (
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 4 }}>
            Tus resúmenes
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 24 }}>
            Selecciona uno para empezar a estudiar
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {summaries.map(s => (
              <SummaryCard
                key={s.id}
                summary={s}
                onOpen={() => setActiveSummary(s)}
                onDelete={() => deleteSummary(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nombre del resumen (opcional)"
            style={{
              flex: 1,
              minWidth: 200,
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--soft-grey)',
              background: 'white',
              fontSize: 14,
              color: 'var(--text-dark)',
              outline: 'none',
              transition: 'var(--transition)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--driftwood)'}
            onBlur={e => e.target.style.borderColor = 'var(--soft-grey)'}
          />
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !showTextInput && fileRef.current.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--driftwood)' : 'var(--whisper-grey)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(193,183,175,0.08)' : 'rgba(255,255,255,0.5)',
            transition: 'var(--transition)',
          }}
        >
          {loading ? (
            <LoadingDots />
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-mid)', marginBottom: 6 }}>
                Arrastra tu resumen aquí
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
                .txt, .md o imágenes — o escribe directamente
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                <PillButton onClick={e => { e.stopPropagation(); fileRef.current.click(); }} label="Subir archivo" />
                <PillButton onClick={e => { e.stopPropagation(); setShowTextInput(v => !v); }} label="Escribir texto" secondary />
              </div>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" hidden multiple accept=".txt,.md,image/*" onChange={e => processFiles([...e.target.files])} />

        {showTextInput && (
          <div style={{ marginTop: 16 }}>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Pega o escribe tu resumen aquí..."
              rows={10}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--soft-grey)',
                background: 'white',
                fontSize: 14,
                color: 'var(--text-dark)',
                lineHeight: 1.7,
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--driftwood)'}
              onBlur={e => e.target.style.borderColor = 'var(--soft-grey)'}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                onClick={handleTextSubmit}
                style={{
                  padding: '12px 28px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: '0.2px',
                }}
              >
                Generar con MILA →
              </button>
            </div>
          </div>
        )}
      </div>

      {summaries.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-mid)', marginBottom: 16 }}>
            ¿Qué puedes hacer con MILA?
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {MODES.map(m => (
              <div key={m.id} style={{
                padding: '20px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid var(--soft-grey)',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{m.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroSection() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0 56px' }}>
      <div style={{
        display: 'inline-flex',
        width: 72,
        height: 72,
        background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        boxShadow: 'var(--shadow-card)',
      }}>
        <span style={{ color: 'white', fontSize: 32, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontWeight: 600 }}>M</span>
      </div>
      <h1 style={{ fontSize: 40, fontWeight: 300, color: 'var(--text-dark)', letterSpacing: '-1px', marginBottom: 12 }}>
        Hola, soy <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontWeight: 600 }}>MILA</span>
      </h1>
      <p style={{ fontSize: 16, color: 'var(--text-mid)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto 40px' }}>
        Tu asistente de estudio personalizado. Sube tu resumen y lo transformo en flashcards, preguntas, mapas conceptuales y más.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
        {['Solo tu contenido', 'Extrae imágenes', 'Múltiples formatos'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--driftwood)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ summary, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '20px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255,255,255,0.8)',
        border: `1.5px solid ${hovered ? 'var(--feather-touch)' : 'var(--soft-grey)'}`,
        cursor: 'pointer',
        transition: 'var(--transition)',
        boxShadow: hovered ? 'var(--shadow-card)' : 'var(--shadow-soft)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        position: 'relative',
      }}
      onClick={onOpen}
    >
      <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {new Date(summary.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 8 }}>
        {summary.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5 }}>
        {summary.text ? `${summary.text.slice(0, 80)}...` : `${summary.images.length} imagen(es)`}
      </div>
      {summary.images.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          {summary.images.slice(0, 3).map((img, i) => (
            <img key={i} src={img.src} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
          ))}
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: hovered ? 'var(--soft-grey)' : 'transparent',
          color: 'var(--text-light)',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'var(--transition)',
        }}
      >
        ×
      </button>
    </div>
  );
}

function PillButton({ label, onClick, secondary }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        borderRadius: 'var(--radius-lg)',
        background: secondary ? 'transparent' : 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
        border: secondary ? '1.5px solid var(--whisper-grey)' : 'none',
        color: secondary ? 'var(--text-mid)' : 'white',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '20px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--driftwood)',
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
