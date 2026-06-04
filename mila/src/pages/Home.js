import React, { useRef, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useMila } from '../context/MilaContext';
import MilaLogo from '../components/MilaLogo';
import { extractTextFromFile, extractImagesFromFile, extractFromPDF, MAX_PDF_PAGES } from '../utils/parseContent';
import { ocrImagePages } from '../utils/aiService';
import { FlashcardIcon, QuizIcon, MapIcon, GalleryIcon, UploadIcon, DocumentIcon } from '../components/Icons';
import StatsModal from '../components/StatsModal';
import DailyStudyPage from './DailyStudyPage';
import { generateDailyStudySession } from '../utils/dailyStudy';

const TAG_OPTIONS = [
  { id: 'era1', label: 'ERA 1', color: '#8B7355' },
  { id: 'era2', label: 'ERA 2', color: '#6B7A5E' },
  { id: 'era3', label: 'ERA 3', color: '#5E6B7A' },
  { id: 'efi',  label: 'EFI',   color: '#7A5E6B' },
];

const MODES = [
  { id: 'flashcards', Icon: FlashcardIcon, label: 'Flashcards', desc: 'Tarjetas de memorización interactivas' },
  { id: 'quiz', Icon: QuizIcon, label: 'Preguntas rápidas', desc: 'Test de opción múltiple' },
  { id: 'map', Icon: MapIcon, label: 'Mapa conceptual', desc: 'Visualiza las ideas clave' },
  { id: 'images', Icon: GalleryIcon, label: 'Galería de imágenes', desc: 'Imágenes extraídas del resumen' },
];

const inputStyle = {
  flex: 1,
  minWidth: 200,
  padding: '12px 16px',
  borderRadius: 'var(--radius-sm)',
  border: '1.5px solid var(--soft-grey)',
  background: 'var(--pale-mist)',
  fontSize: 14,
  color: 'var(--text-dark)',
  outline: 'none',
  transition: 'var(--transition)',
};

export default function Home() {
  const { summaries, addSummary, setActiveSummary, setActiveMode, deleteSummary } = useMila();
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [pdfProgress, setPdfProgress] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [collapsedSubjects, setCollapsedSubjects] = useState({});
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [dailyOpen, setDailyOpen] = useState(false);

  const dailySession = useMemo(() => generateDailyStudySession(summaries), [summaries]);

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function deleteSelected() {
    selected.forEach(id => deleteSummary(id));
    setSelected(new Set());
    setSelectMode(false);
  }

  async function processFiles(files) {
    setLoading(true);
    setError('');
    try {
      let text = '';
      const images = [];

      for (const file of files) {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          setLoadingMsg(`Leyendo PDF: ${file.name}`);
          setPdfProgress({ current: 0, total: 0 });
          const result = await extractFromPDF(file, (current, total) => {
            setPdfProgress({ current, total });
          });
          images.push(...result.images);
          if (result.truncated) {
            setLoadingMsg(`⚠️ PDF muy largo — se procesaron las primeras ${MAX_PDF_PAGES} de ${result.totalPages} páginas`);
            await new Promise(r => setTimeout(r, 2500));
          }

          // Detect image-only PDF: fewer than 5 words per page means pdfjs
          // found essentially nothing — the content lives in the page images.
          // Threshold is intentionally conservative to avoid false positives on
          // light-text PDFs (diagrams with labels, slides with few bullets, etc.)
          const pdfWords = result.text.trim().split(/\s+/).filter(Boolean).length;
          const pageCount = result.images.length || 1;
          const isImageOnly = pdfWords < pageCount * 5 && result.images.length > 0;

          if (isImageOnly) {
            setLoadingMsg(`PDF con solo imágenes — leyendo texto con OCR (${result.images.length} páginas)…`);
            setPdfProgress({ current: 0, total: result.images.length });
            try {
              const ocrText = await ocrImagePages(result.images, (current, total) => {
                setPdfProgress({ current, total });
                setLoadingMsg(`OCR: página ${current} de ${total}…`);
              });
              text += ocrText + '\n\n';
            } catch (e) {
              console.warn('[MILA] OCR falló, usando texto original:', e);
              text += result.text + '\n\n';
            }
          } else {
            text += result.text + '\n\n';
          }
          setPdfProgress(null);
        } else if (file.type.startsWith('image/')) {
          setLoadingMsg(`Procesando imagen: ${file.name}…`);
          const imgs = await extractImagesFromFile(file);
          images.push(...imgs);
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          setLoadingMsg(`Leyendo texto: ${file.name}…`);
          const content = await extractTextFromFile(file);
          text += content + '\n\n';
        }
      }

      const summary = addSummary({
        title: title || files[0]?.name?.replace(/\.[^.]+$/, '') || 'Mi resumen',
        subject: subject || '',
        text,
        images,
        fileName: files[0]?.name,
      });
      setTitle('');
      setSubject('');
      setActiveSummary(summary);
    } catch (err) {
      console.error(err);
      setError(`Error al procesar el archivo: ${err.message || 'intenta de nuevo'}`);
    } finally {
      setLoading(false);
      setLoadingMsg('');
      setPdfProgress(null);
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
      subject: subject || '',
      text: textInput,
      images: [],
    });
    setTitle('');
    setSubject('');
    setTextInput('');
    setShowTextInput(false);
    setActiveSummary(summary);
  }

  // Group summaries by subject
  const grouped = summaries.reduce((acc, s) => {
    const key = s.subject || 'Sin materia';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  function toggleSubject(key) {
    setCollapsedSubjects(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function openMode(s, modeId) {
    setActiveSummary(s);
    setActiveMode(modeId);
  }

  return (
    <div>
      <HeroSection />

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nombre del resumen (opcional)"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--driftwood)'}
            onBlur={e => e.target.style.borderColor = 'var(--soft-grey)'}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Materia (ej: Anatomía, Fisiología...)"
            style={inputStyle}
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
            background: dragging ? 'rgba(193,183,175,0.08)' : 'var(--pale-mist)',
            transition: 'var(--transition)',
          }}
        >
          {loading ? (
            <LoadingDots message={loadingMsg} progress={pdfProgress} />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, opacity: 0.5 }}><DocumentIcon size={40} color="var(--text-mid)" /></div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-mid)', marginBottom: 6 }}>
                Arrastra tu resumen aquí
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
                PDF, .txt, .md, JPG, PNG — o escribe directamente
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                <PillButton onClick={e => { e.stopPropagation(); fileRef.current.click(); }} label="Subir archivo" />
                <PillButton onClick={e => { e.stopPropagation(); setShowTextInput(v => !v); }} label="Escribir texto" secondary />
              </div>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" hidden multiple accept=".txt,.md,.pdf,image/jpeg,image/png,image/webp" onChange={e => processFiles([...e.target.files])} />

        {error && (
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(176,168,164,0.15)', border: '1px solid var(--feather-touch)', fontSize: 13, color: 'var(--ash-plum)' }}>
            ⚠️ {error}
          </div>
        )}

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
                background: 'var(--pale-mist)',
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

      {/* Daily Study Loop entry point */}
      {dailySession && (
        <div style={{ marginTop: 32 }}>
          <button
            onClick={() => setDailyOpen(true)}
            style={{
              width: '100%', padding: '18px 20px', borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--ash-plum) 0%, var(--driftwood) 100%)',
              border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 4 }}>
                Sesión diaria
              </p>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 2 }}>
                {dailySession.nodes.length} nodos prioritarios para hoy
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                {dailySession.totalFlashcards} flashcards · {dailySession.totalQuestions} preguntas · ~{dailySession.estimatedMinutes} min
              </p>
            </div>
            <div style={{ color: 'white', fontSize: 22, opacity: 0.8, flexShrink: 0 }}>→</div>
          </button>
        </div>
      )}

      {dailyOpen && ReactDOM.createPortal(
        <DailyStudyPage onClose={() => setDailyOpen(false)} />,
        document.body
      )}

      {summaries.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-dark)' }}>Tus resúmenes</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectMode && selected.size > 0 && (
                <button
                  onClick={deleteSelected}
                  style={{ padding: '6px 14px', borderRadius: 20, background: '#c0392b', color: 'white', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  Eliminar {selected.size}
                </button>
              )}
              <button
                onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }}
                style={{ padding: '6px 14px', borderRadius: 20, background: selectMode ? 'var(--driftwood)' : 'var(--soft-grey)', color: selectMode ? 'white' : 'var(--text-mid)', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}
              >
                {selectMode ? 'Cancelar' : 'Seleccionar'}
              </button>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 24 }}>
            {selectMode ? 'Toca los resúmenes que quieres eliminar' : 'Selecciona uno para empezar a estudiar'}
          </p>
          {Object.entries(grouped).map(([subjectKey, subjectSummaries]) => (
            <div key={subjectKey} style={{ marginBottom: 28 }}>
              <button onClick={() => toggleSubject(subjectKey)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-mid)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{subjectKey}</span>
                <span style={{ fontSize: 11, color: 'var(--text-light)', background: 'var(--soft-grey)', borderRadius: 20, padding: '2px 8px' }}>{subjectSummaries.length}</span>
                <span style={{ fontSize: 10, color: 'var(--text-light)', marginLeft: 2 }}>{collapsedSubjects[subjectKey] ? '▶' : '▼'}</span>
              </button>
              {!collapsedSubjects[subjectKey] && (
                <div className="summary-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {subjectSummaries.map(s => (
                    <SummaryCard
                      key={s.id}
                      summary={s}
                      onOpen={selectMode ? () => toggleSelect(s.id) : () => setActiveSummary(s)}
                      onOpenMode={(modeId) => openMode(s, modeId)}
                      onDelete={() => deleteSummary(s.id)}
                      selectMode={selectMode}
                      selected={selected.has(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeroSection() {
  const { darkMode } = useMila();

  const line1 = 'Sube tu apunte y estudia a tu manera.';
  const line2 = 'Mila lo convierte en mapas, flashcards y preguntas para ti.';

  return (
    <div style={{ textAlign: 'center', padding: '48px 0 56px', animation: 'fadeUp 0.6s ease both' }}>
      <style>{`
        @keyframes letterFadeUp {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatLetter {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }
      `}</style>

      <div style={{ display: 'inline-flex', marginBottom: 28, opacity: 0.9 }}>
        <MilaLogo size={64} dark={darkMode} />
      </div>
      <h1 style={{ fontSize: 40, fontWeight: 300, color: 'var(--text-dark)', letterSpacing: '-1px', marginBottom: 24 }}>
        Hola, soy <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontWeight: 600 }}>MILA</span>
      </h1>

      {/* Animated text lines */}
      <div style={{ maxWidth: 500, margin: '0 auto 40px', lineHeight: 1.8 }}>
        <AnimatedLine text={line1} baseDelay={0} fontSize={17} bold />
        <AnimatedLine text={line2} baseDelay={line1.length * 18} fontSize={15} />
      </div>
    </div>
  );
}

function AnimatedLine({ text, baseDelay, fontSize, bold }) {
  return (
    <p style={{ margin: '0 0 6px', fontSize, fontWeight: bold ? 500 : 400, color: bold ? 'var(--text-dark)' : 'var(--text-mid)', display: 'block' }}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            whiteSpace: char === ' ' ? 'pre' : 'normal',
            animation: `letterFadeUp 0.35s ease both, floatLetter ${2.2 + (i % 5) * 0.15}s ease-in-out ${1.5 + i * 0.04}s infinite`,
            animationDelay: `${baseDelay + i * 18}ms, ${1500 + baseDelay + i * 18}ms`,
          }}
        >
          {char}
        </span>
      ))}
    </p>
  );
}
    </div>
  );
}

function SummaryCard({ summary, onOpen, onOpenMode, onDelete, selectMode, selected }) {
  const { updateSummary } = useMila();
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(summary.title);
  const [editSubject, setEditSubject] = useState(summary.subject || '');
  const [statsOpen, setStatsOpen] = useState(false);

  function handleSaveEdit(e) {
    e.stopPropagation();
    updateSummary(summary.id, { title: editTitle, subject: editSubject });
    setEditing(false);
  }

  function handleStartEdit(e) {
    e.stopPropagation();
    setEditTitle(summary.title);
    setEditSubject(summary.subject || '');
    setEditing(true);
  }

  if (editing) {
    return (
      <div
        style={{
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--pale-mist)',
          border: '1.5px solid var(--driftwood)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          placeholder="Título"
          autoFocus
          style={{
            width: '100%',
            marginBottom: 8,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--soft-grey)',
            background: 'var(--ghost-white)',
            fontSize: 14,
            color: 'var(--text-dark)',
            outline: 'none',
          }}
        />
        <input
          value={editSubject}
          onChange={e => setEditSubject(e.target.value)}
          placeholder="Materia"
          style={{
            width: '100%',
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--soft-grey)',
            background: 'var(--ghost-white)',
            fontSize: 13,
            color: 'var(--text-dark)',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSaveEdit}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              background: 'var(--ash-plum)',
              color: 'white',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Guardar
          </button>
          <button
            onClick={e => { e.stopPropagation(); setEditing(false); }}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              background: 'transparent',
              border: '1px solid var(--soft-grey)',
              color: 'var(--text-mid)',
              fontSize: 12,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onPointerEnter={e => { if (e.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setHovered(false); }}
      style={{
        padding: '20px',
        borderRadius: 'var(--radius-md)',
        background: selected ? 'rgba(193,165,124,0.12)' : 'var(--pale-mist)',
        border: `1.5px solid ${selected ? 'var(--driftwood)' : hovered ? 'var(--driftwood)' : 'var(--whisper-grey)'}`,
        cursor: 'pointer',
        transition: 'var(--transition)',
        boxShadow: hovered ? 'var(--shadow-card)' : 'var(--shadow-soft)',
        transform: hovered && !selectMode ? 'translateY(-2px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={onOpen}
    >
      {selectMode && (
        <div style={{
          position: 'absolute', top: 12, left: 12,
          width: 20, height: 20, borderRadius: 6,
          border: `2px solid ${selected ? 'var(--driftwood)' : 'var(--soft-grey)'}`,
          background: selected ? 'var(--driftwood)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
        }}>
          {selected && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px', paddingLeft: selectMode ? 28 : 0 }}>
        {new Date(summary.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-dark)', marginBottom: 4, paddingRight: 48 }}>
        {summary.title}
      </div>
      {summary.subject && (
        <div style={{ fontSize: 11, color: 'var(--ash-plum)', marginBottom: 8, fontWeight: 500 }}>
          {summary.subject}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
        {summary.text ? summary.text.slice(0, 120) : `${(summary.images || []).length} imagen(es)`}
      </div>
      {summary.tags && summary.tags.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {summary.tags.map(tagId => {
            const tag = TAG_OPTIONS.find(t => t.id === tagId);
            if (!tag) return null;
            return (
              <span key={tagId} style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: tag.color, color: '#fff', letterSpacing: '0.2px' }}>
                {tag.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Stats + Edit + Delete buttons — hidden in select mode */}
      {!selectMode && hovered && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setStatsOpen(true); }}
            style={{ position: 'absolute', top: 12, right: 68, width: 24, height: 24, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition)' }}
            title="Estadísticas"
          >📊</button>
          <button
            onClick={handleStartEdit}
            style={{ position: 'absolute', top: 12, right: 40, width: 24, height: 24, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-mid)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition)' }}
            title="Editar"
          >✏</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: '50%', background: 'var(--soft-grey)', color: 'var(--text-light)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition)' }}
          >×</button>
        </>
      )}
      {statsOpen && ReactDOM.createPortal(
        <StatsModal summary={summary} onClose={() => setStatsOpen(false)} />,
        document.body
      )}
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

function LoadingDots({ message, progress }) {
  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;
  return (
    <div style={{ padding: '20px 0', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--driftwood)',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      {message && <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>{message}</p>}
      {progress && progress.total > 0 && (
        <div style={{ maxWidth: 200, margin: '0 auto' }}>
          <div style={{ height: 3, background: 'var(--soft-grey)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--ash-plum), var(--driftwood))', borderRadius: 4, transition: 'width 0.3s ease' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-light)' }}>Página {progress.current} de {progress.total}</p>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
