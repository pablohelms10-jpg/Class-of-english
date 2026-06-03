import React, { useState, useEffect } from 'react';
import { useMila } from '../../context/MilaContext';
import { generateQuestions } from '../../utils/parseContent';
import { generateQuestionsAI } from '../../utils/aiService';

export default function QuizMode({ summary }) {
  const { updateSummary } = useMila();
  const text = summary?.text || '';
  const cached = summary?.questions;

  const [questions, setQuestions] = useState(cached || []);
  const [loading, setLoading] = useState(!cached || cached.length === 0);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    if (cached && cached.length > 0) return;
    setLoading(true);
    generateQuestionsAI(text)
      .then(generated => {
        setQuestions(generated);
        updateSummary(summary.id, { questions: generated });
      })
      .catch(() => {
        const fallback = generateQuestions(text);
        setQuestions(fallback);
        updateSummary(summary.id, { questions: fallback });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function regenerate() {
    setLoading(true);
    setIndex(0); setSelected(null); setScore(0); setDone(false); setAnswers([]);
    generateQuestionsAI(text)
      .then(generated => {
        setQuestions(generated);
        updateSummary(summary.id, { questions: generated });
      })
      .catch(() => {
        const fallback = generateQuestions(text);
        setQuestions(fallback);
        updateSummary(summary.id, { questions: fallback });
      })
      .finally(() => setLoading(false));
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{ width: 48, height: 48, borderRadius: 16, margin: '0 auto 20px', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s ease-in-out infinite' }}>
        <span style={{ color: 'white', fontSize: 22, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>M</span>
      </div>
      <p style={{ fontSize: 15, color: 'var(--text-mid)', marginBottom: 6 }}>MILA está preparando tu examen…</p>
      <p style={{ fontSize: 12, color: 'var(--text-light)' }}>Esto puede tomar unos segundos</p>
      <style>{`@keyframes pulse{0%,100%{opacity:0.7;transform:scale(0.95)}50%{opacity:1;transform:scale(1.05)}}`}</style>
    </div>
  );

  if (!text || questions.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
      <p style={{ fontSize: 14 }}>No hay suficiente contenido para generar preguntas.</p>
    </div>
  );

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{score >= questions.length * 0.7 ? '🏆' : '📖'}</div>
        <h3 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>{score} / {questions.length} correctas</h3>
        <p style={{ fontSize: 15, color: 'var(--text-mid)', marginBottom: 40 }}>
          {Math.round((score / questions.length) * 100)}% de acierto
        </p>
        <div style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto 40px' }}>
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
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setIndex(0); setSelected(null); setScore(0); setDone(false); setAnswers([]); }}
            style={{ padding: '14px 32px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 15, fontWeight: 500 }}
          >Repetir quiz</button>
          <button
            onClick={regenerate}
            style={{ padding: '14px 24px', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--soft-grey)', color: 'var(--text-mid)', fontSize: 14 }}
          >↺ Regenerar</button>
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
    setAnswers(prev => [...prev, { question: q.question, correct, correctAnswer: q.correct }]);
  }

  function handleNext() {
    setSelected(null);
    if (index + 1 >= questions.length) setDone(true);
    else setIndex(i => i + 1);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>Pregunta {index + 1} de {questions.length}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>✓ {score}</span>
          <button
            onClick={regenerate}
            title="Regenerar con IA"
            style={{ fontSize: 11, color: 'var(--text-light)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--soft-grey)', background: 'transparent' }}
          >↺ Regenerar</button>
        </div>
      </div>

      <div style={{ height: 4, background: 'var(--soft-grey)', borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(index / questions.length) * 100}%`, background: 'linear-gradient(90deg, var(--ash-plum), var(--driftwood))', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ padding: '28px 32px', borderRadius: 'var(--radius-md)', background: 'var(--pale-mist)', border: '1.5px solid var(--whisper-grey)', marginBottom: 24, boxShadow: 'var(--shadow-soft)' }}>
        <p style={{ fontSize: 17, color: 'var(--text-dark)', lineHeight: 1.7 }}>{q.question}</p>
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

      {selected !== null && (
        <div style={{ textAlign: 'right' }}>
          <button onClick={handleNext} style={{ padding: '13px 28px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))', color: 'white', fontSize: 14, fontWeight: 500 }}>
            {index + 1 >= questions.length ? 'Ver resultados →' : 'Siguiente →'}
          </button>
        </div>
      )}
    </div>
  );
}
