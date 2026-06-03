const API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;
const MAX_TEXT = 5000;

async function askClaude(prompt) {
  if (!API_KEY) throw new Error('No API key configurada');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

export async function generateFlashcardsAI(text) {
  const prompt = `Profesor de medicina. Genera 10 flashcards del resumen. Solo JSON, sin texto extra.

RESUMEN:
${text.slice(0, MAX_TEXT)}

Responde SOLO con un JSON válido, sin texto adicional, con este formato exacto:
[
  {
    "front": "¿Pregunta clara y específica sobre un concepto importante?",
    "back": "Respuesta concisa y precisa",
    "context": "Frase del texto que respalda esto"
  }
]

Reglas:
- Preguntas específicas sobre definiciones, funciones, relaciones
- Respuestas cortas y memorables. Máximo 10 flashcards.`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]).map((c, i) => ({ ...c, id: i }));
}

export async function generateQuestionsAI(text) {
  const prompt = `Profesor de medicina. Genera 8 preguntas de opción múltiple. Solo JSON, sin texto extra.

RESUMEN:
${text.slice(0, MAX_TEXT)}

Responde SOLO con un JSON válido, sin texto adicional:
[
  {
    "question": "Pregunta clara sobre el contenido",
    "options": ["Opción A correcta o incorrecta", "Opción B", "Opción C", "Opción D"],
    "correct": "Opción correcta exactamente igual a como aparece en options",
    "explanation": "Por qué es correcta esta respuesta"
  }
]

Reglas:
- Opciones incorrectas plausibles del mismo tema. Máximo 8 preguntas.`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]).map((q, i) => ({ ...q, id: i }));
}

export async function generateConceptMapAI(text) {
  const prompt = `Profesor de medicina. Crea un mapa conceptual jerárquico. Solo JSON, sin texto extra.

RESUMEN:
${text.slice(0, MAX_TEXT)}

Responde SOLO con un JSON válido, sin texto adicional:
{
  "title": "Tema principal",
  "nodes": [
    {"id": 0, "label": "Tema principal", "type": "main", "x": 400, "y": 60},
    {"id": 1, "label": "Subtema 1", "type": "sub", "x": 200, "y": 200},
    {"id": 2, "label": "Subtema 2", "type": "sub", "x": 600, "y": 200},
    {"id": 3, "label": "Detalle 1.1", "type": "detail", "x": 100, "y": 340},
    {"id": 4, "label": "Detalle 1.2", "type": "detail", "x": 300, "y": 340}
  ],
  "edges": [
    {"from": 0, "to": 1},
    {"from": 0, "to": 2},
    {"from": 1, "to": 3},
    {"from": 1, "to": 4}
  ]
}

Reglas:
- Máximo 8 nodos, labels de 1-3 palabras, jerarquía real del contenido.`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]);
}
