import React, { useState, useMemo } from 'react';
import { generateQuestions } from '../../utils/parseContent';

export default function QuizMode({ text }) {
  const questions = useMemo(() => generateQuestions(text || ''), [text]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState([]);

  if (!text || questions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-light)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
        <p style={{ fontSize: 14 }}>No hay suficiente contenido para generar preguntas.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{score >= questions.length * 0.7 ? '🏆' : '📖'}</div>
        <h3 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>
          {score} / {questions.length} correctas
        </h3>
        <p style={{ fontSize: 15, color: 'var(--text-mid)', marginBottom: 40 }}>
          {Math.round((score / questions.length) * 100)}% de acierto
        </p>

        <div style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto 40px' }}>
          {answers.map((a, i) => (
            <div key={i} style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 10,
              background: a.correct ? 'rgba(123,174,127,0.1)' : 'rgba(176,168,164,0.12)',
              border: `1px solid ${a.correct ? 'rgba(123,174,127,0.3)' : 'rgba(176,168,164,0.3)'}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}>
              <span style={{ fontSize: 14 }}>{a.correct ? '✓' : '✗'}</span>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 2 }}>{a.question}</div>
                {!a.correct && <div style={{ fontSize: 12, color: 'var(--ash-plum)' }}>Correcto: {a.correctAnswer}</div>}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setIndex(0); setSelected(null); setScore(0); setDone(false); setAnswers([]); }}
          style={{
            padding: '14px 32px',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
            color: 'white',
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          Repetir quiz
        </button>
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
    if (index + 1 >= questions.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>Pregunta {index + 1} de {questions.length}</span>
        <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>✓ {score}</span>
      </div>

      <div style={{ height: 4, background: 'var(--soft-grey)', borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((index) / questions.length) * 100}%`, background: 'linear-gradient(90deg, var(--ash-plum), var(--driftwood))', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{
        padding: '28px 32px',
        borderRadius: 'var(--radius-md)',
        background: 'white',
        border: '1.5px solid var(--soft-grey)',
        marginBottom: 24,
        boxShadow: 'var(--shadow-soft)',
      }}>
        <p style={{ fontSize: 17, color: 'var(--text-dark)', lineHeight: 1.7 }}>{q.question}</p>
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
        {q.options.map(option => {
          let bg = 'rgba(255,255,255,0.7)';
          let border = 'var(--soft-grey)';
          let color = 'var(--text-dark)';

          if (selected !== null) {
            if (option === q.correct) {
              bg = 'rgba(123,174,127,0.12)';
              border = 'rgba(123,174,127,0.5)';
              color = '#4A8A4E';
            } else if (option === selected && option !== q.correct) {
              bg = 'rgba(176,168,164,0.15)';
              border = 'var(--ash-plum)';
              color = 'var(--ash-plum)';
            }
          }

          return (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-sm)',
                background: bg,
                border: `1.5px solid ${border}`,
                color,
                fontSize: 14,
                textAlign: 'left',
                transition: 'var(--transition)',
                cursor: selected !== null ? 'default' : 'pointer',
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={handleNext}
            style={{
              padding: '13px 28px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--ash-plum), var(--driftwood))',
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {index + 1 >= questions.length ? 'Ver resultados →' : 'Siguiente →'}
          </button>
        </div>
      )}
    </div>
  );
}
