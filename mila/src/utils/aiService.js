const API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

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
      max_tokens: 4096,
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
  const prompt = `Eres un profesor universitario de medicina. Analiza el siguiente resumen y genera exactamente 15 flashcards de estudio de alta calidad.

RESUMEN:
${text.slice(0, 8000)}

Responde SOLO con un JSON válido, sin texto adicional, con este formato exacto:
[
  {
    "front": "¿Pregunta clara y específica sobre un concepto importante?",
    "back": "Respuesta concisa y precisa",
    "context": "Frase del texto que respalda esto"
  }
]

Reglas:
- Las preguntas deben ser específicas y educativamente valiosas
- Prioriza definiciones, funciones, relaciones anatómicas, mecanismos
- Las respuestas deben ser cortas y memorables
- Varía los tipos: definición, función, ubicación, relación entre estructuras`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]).map((c, i) => ({ ...c, id: i }));
}

export async function generateQuestionsAI(text) {
  const prompt = `Eres un profesor universitario de medicina creando un examen. Analiza el resumen y genera 10 preguntas de opción múltiple de nivel universitario.

RESUMEN:
${text.slice(0, 8000)}

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
- Las opciones incorrectas deben ser plausibles y del mismo tema
- Las preguntas deben evaluar comprensión, no solo memorización
- Mezcla preguntas sobre conceptos, relaciones y aplicaciones`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]).map((q, i) => ({ ...q, id: i }));
}

export async function generateConceptMapAI(text) {
  const prompt = `Eres un profesor universitario de medicina. Analiza el resumen y crea un mapa conceptual jerárquico.

RESUMEN:
${text.slice(0, 8000)}

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
- Máximo 12 nodos
- Jerarquía real del contenido: tema → subtemas → detalles
- Labels cortos (máximo 4 palabras)
- Distribuye los nodos en el espacio 800x560px sin superposición`;

  const raw = await askClaude(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]);
}
