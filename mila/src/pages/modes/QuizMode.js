import React, { useState, useEffect } from 'react';
import { useMila } from '../../context/MilaContext';
import { generateQuestions } from '../../utils/parseContent';
import { generateQuestionsAI, assignImagesToNodes, quickAssignImages } from '../../utils/aiService';
import MilaLoadingScreen from '../../components/MilaLoadingScreen';
import { TrophyIcon, BookIcon, QuizIcon } from '../../components/Icons';

export default function QuizMode({ summary }) {
  const { updateSummary } = useMila();
  const text = summary?.text || '';
  const cached = summary?.questions;
  const quizHistory = summary?.quizHistory || [];

  const [questions, setQuestions] = useState(cached || []);
  const [loading, setLoading] = useState(!cached || cached.length === 0);
  const [generating, setGenerating] = useState(false);
  const [allCovered, setAllCovered] = useState(summary?.questionsAllCovered || false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState([]);
  // Track per-question answers so back navigation shows previous state
  const [perQ, setPerQ] = useState({}); // { [index]: selectedOption }

  const images = summary?.images || [];

  useEffect(() => {
    if (cached && cached.length > 0) {
      if (images.length > 0 && !cached.some(q => q.imageIndex != null)) {
        const quickIndices = quickAssignImages(cached.length, images);
        const quick = cached.map((q, i) => ({ ...q, imageIndex: quickIndices[i] ?? null }));
        setQuestions(quick);
        updateSummary(summary.id, { questions: quick });
        const nodes = cached.map(q => ({ id: q.id, label: q.question, summary: q.explanation || '' }));
        assignImagesToNodes(nodes, images)
          .then(withImages => {
            const upgraded = quick.map((q, i) => ({ ...q, imageIndex: withImages[i]?.imageIndex ?? q.imageIndex }));
            setQuestions(upgraded);
            updateSummary(summary.id, { questions: upgraded });
          })
          .catch(() => {});
      }
      return;
    }
    setLoading(true);
    generateQuestionsAI(text, [], images)
      .then(({ questions: generated, allCovered: done }) => {
        setQuestions(generated);
        setAllCovered(done);
        updateSummary(summary.id, { questions: generated, questionsAllCovered: done });
      })
      .catch(() => {
        const fallback = generateQuestions(text);
        setQuestions(fallback);
        updateSummary(summary.id, { questions: fallback });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function regenerateAll() {
    setLoading(true);
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setDone(false);
    setAnswers([]);
    updateSummary(summary.id, { questions: [], questionsAllCovered: false });
    generateQuestionsAI(text, [], images)
      .then(({ questions: generated, allCovered: done }) => {
        setQuestions(generated);
        setAllCovered(done);
        updateSummary(summary.id, { questions: generated, questionsAllCovered: done });
      })
      .catch(() => {
        const fallback = generateQuestions(text);
        setQuestions(fallback);
        updateSummary(summary.id, { questions: fallback });
      })
      .finally(() => setLoading(false));
  }

  function generateMore() {
    if (generating || allCovered) return;
    setGenerating(true);
    generateQuestionsAI(text, questions, images)
      .then(({ questions: newQs, allCovered: done }) => {
        if (done || newQs.length === 0) {
          setAllCovered(true);
          updateSummary(summary.id, { questionsAllCovered: true });
        } else {
          const merged = [...questions, ...newQs];
          setQuestions(merged);
          updateSummary(summary.id, { questions: merged, questionsAllCovered: false });
        }
      })
      .catch(console.error)
      .finally(() => setGenerating(false));
  }

  if (loading) return <MilaLoadingScreen message="MILA está preparando tu examen…" sub="Esto puede tomar unos segundos" />;

  if (!text || questions.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, opacity: 0.5 }}><QuizIcon size={40} color="var(--text-light)" /></div>
      <p style={{ fontSize: 14 }}>No hay suficiente contenido para generar preguntas.</p>
    </div>
  );

  if (done) {
    const pct = Math.round((score / answers.length) * 100);
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          {pct >= 70 ? <TrophyIcon size={52} color="var(--driftwood)" /> : <BookIcon size={52} color="var(--text-light)" />}
        </div>
        <h3 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>{score} / {answers.length} correctas</h3>
        <p style={{ fontSize: 15, color: 'var(--text-mid)', marginBottom: 16 }}>{pct}% de acierto</p>

        {/* Quiz history */}
        {quizHistory.length > 0 && (
          <div style={{ marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Historial</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {quizHistory.slice(0, 5).map((h, i) => (
                <div key={i} style={{ padding: '6px 12px', borderRadius: 20, background: h.pct >= 70 ? 'rgba(123,174,127,0.12)' : 'var(--pale-mist)', border: `1px solid ${h.pct >= 70 ? 'rgba(123,174,127,0.3)' : 'var(--whisper-grey)'}`, fontSize: 12, color: 'var(--text-mid)' }}>
                  {h.pct}% · {new Date(h.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto 32px' }}>
          {answers.map((a, i) => (
            <div key={i} style={{ padding: '14px 18px', borderRadius: 'var(--radius-sm)', marginBottom: 10, background: a.correct ? 'rgba(123,174,127,0.1)' : 'rgba(176,168,164,0.12)', border: `1px solid ${a.correct ? 'rgba(123,174,127,0.3)' : 'rgba(176,168,164,0.3)'}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 14 }}>{a.correct ? '✓' : '✗'}</span>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 2 }}>{a.question}</div>
                {!a.correct && <div style={{ fontSize: 12, color: 'var(--ash-plum)' }}>Correcto: {a.correctAnswer}</div>}
              </div>
            </div>
          ))}
        </div>

        {allCovered && (
          <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 10, background: 'rgba(123,174,127,0.1)', border: '1px solid rgba(123,174,127,0.35)', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 420, margin: '0 auto 24px' }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>Cubriste todos los temas del resumen — {questions.length} preguntas en total. ¡Estás listo!</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setIndex(0); setSelected(null); setScore(0); setDone(false); setAnswers([]); }}
            style={{ padding: '14px 32px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 15, fontWeight: 500 }}
          >Repetir quiz</button>
          {!allCovered && (
            <button
              onClick={() => { generateMore(); setIndex(questions.length); setDone(false); setSelected(null); }}
              disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 22px', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--driftwood)', color: 'var(--driftwood)', background: 'transparent', fontSize: 14, fontWeight: 500, opacity: generating ? 0.6 : 1 }}
            >
              {generating ? '↻ Generando…' : '+ Más preguntas'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const q = questions[index];

  function handleSelect(option) {
    if (selected !== null) return;
    setSelected(option);
    const correct = option === q.correct;
    if (correct) setScore(s => s + 1);
    setPerQ(prev => ({ ...prev, [index]: option }));
    setAnswers(prev => [...prev, { question: q.question, correct, correctAnswer: q.correct }]);
  }

  function handleNext() {
    setSelected(null);
    if (index + 1 >= questions.length) {
      const finalScore = score + (selected === questions[index].correct ? 1 : 0);
      const pct = Math.round((finalScore / questions.length) * 100);
      const entry = { date: new Date().toISOString(), score: finalScore, total: questions.length, pct };
      updateSummary(summary.id, { quizHistory: [entry, ...quizHistory].slice(0, 10) });
      setDone(true);
    } else {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      // Restore previously given answer if navigating to an already-answered question
      setSelected(perQ[nextIdx] ?? null);
    }
  }

  function handlePrev() {
    if (index === 0) return;
    const prevIdx = index - 1;
    setIndex(prevIdx);
    setSelected(perQ[prevIdx] ?? null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>Pregunta {index + 1} de {questions.length}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>✓ {score}</span>
          {!allCovered && (
            <button
              onClick={generateMore}
              disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--driftwood)', padding: '3px 10px', borderRadius: 6, border: '1.5px solid var(--driftwood)', background: 'transparent', opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}
            >
              {generating ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span></> : '+ Más'}
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </button>
          )}
          <button onClick={regenerateAll} title="Regenerar desde cero (con imágenes)" style={{ fontSize: 11, color: 'var(--text-light)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--soft-grey)', background: 'transparent' }}>↺</button>
        </div>
      </div>

      {allCovered && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(123,174,127,0.1)', border: '1px solid rgba(123,174,127,0.35)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✅</span>
          <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>Todos los temas cubiertos — {questions.length} preguntas en total</span>
        </div>
      )}

      <div style={{ height: 4, background: 'var(--soft-grey)', borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(index / questions.length) * 100}%`, background: 'linear-gradient(90deg, var(--ash-plum), var(--driftwood))', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ borderRadius: 'var(--radius-md)', background: 'var(--pale-mist)', border: '1.5px solid var(--whisper-grey)', marginBottom: 24, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
        {q.imageIndex != null && images[q.imageIndex] && (
          <div style={{ width: '100%', height: 240, overflow: 'hidden' }}>
            <img src={images[q.imageIndex].src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: '20px 28px' }}>
          <p style={{ fontSize: 17, color: 'var(--text-dark)', lineHeight: 1.7, margin: 0 }}>{q.question}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
        {q.options.map(option => {
          let bg = 'var(--pale-mist)', border = 'var(--whisper-grey)', color = 'var(--text-dark)';
          if (selected !== null) {
            if (option === q.correct) { bg = 'rgba(123,174,127,0.12)'; border = 'rgba(123,174,127,0.5)'; color = '#4A8A4E'; }
            else if (option === selected) { bg = 'rgba(176,168,164,0.15)'; border = 'var(--ash-plum)'; color = 'var(--ash-plum)'; }
          }
          return (
            <button key={option} onClick={() => handleSelect(option)}
              style={{ padding: '16px 20px', borderRadius: 'var(--radius-sm)', background: bg, border: `1.5px solid ${border}`, color, fontSize: 14, textAlign: 'left', transition: 'var(--transition)', cursor: selected !== null ? 'default' : 'pointer' }}>
              {option}
            </button>
          );
        })}
      </div>

      {selected !== null && q.explanation && (
        <div style={{ padding: '14px 18px', borderRadius: 'var(--radius-sm)', background: 'rgba(193,183,175,0.12)', border: '1px solid var(--feather-touch)', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Explicación · </span>
          <span style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{q.explanation}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={handlePrev}
          disabled={index === 0}
          style={{ padding: '12px 20px', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--soft-grey)', color: 'var(--text-mid)', fontSize: 14, opacity: index === 0 ? 0.35 : 1, cursor: index === 0 ? 'default' : 'pointer', background: 'transparent' }}
        >
          ← Anterior
        </button>
        {selected !== null && (
          <button onClick={handleNext} style={{ padding: '13px 28px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 14, fontWeight: 500 }}>
            {index + 1 >= questions.length ? 'Ver resultados →' : 'Siguiente →'}
          </button>
        )}
      </div>
    </div>
  );
}
