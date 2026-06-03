const API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

function smartSample(text, maxLen = 4000) {
  if (text.length <= maxLen) return text;
  const third = Math.floor(maxLen / 3);
  const mid = Math.floor(text.length / 2);
  return text.slice(0, third) + '\n...\n' + text.slice(mid - Math.floor(third / 2), mid + Math.floor(third / 2)) + '\n...\n' + text.slice(-third);
}

// Resize image to max 512px before sending to API
async function compressImage(dataUrl, maxPx = 512) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function buildContent(prompt, images = []) {
  const content = [];
  for (let i = 0; i < Math.min(images.length, 4); i++) {
    try {
      const compressed = await compressImage(images[i].src);
      const mediaType = compressed.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      const data = compressed.replace(/^data:[^;]+;base64,/, '');
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
    } catch { /* skip broken image */ }
  }
  content.push({ type: 'text', text: prompt });
  return content;
}

async function askClaude(prompt, images = []) {
  if (!API_KEY) throw new Error('No API key configurada');
  const content = images.length > 0 ? await buildContent(prompt, images) : prompt;
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
      max_tokens: 3000,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// Returns { cards, allCovered }
export async function generateFlashcardsAI(text, existing = [], images = []) {
  const hasImages = images.length > 0;
  const existingList = existing.length > 0
    ? `\nFLASHCARDS YA CREADAS (NO repetir):\n${existing.map(c => `- ${c.front}`).join('\n')}\n`
    : '';

  const imageInstructions = hasImages
    ? `\nTenés ${Math.min(images.length, 4)} imágenes del resumen (índices 0 a ${Math.min(images.length, 4) - 1}). Si una imagen ilustra directamente la respuesta de una flashcard, incluye "imageIndex": N con el índice correspondiente. Si no hay imagen relevante, omite imageIndex.\n`
    : '';

  const prompt = `Eres un profesor de medicina. Genera 10 flashcards NUEVAS del resumen.${existingList}${imageInstructions}
RESUMEN:
${smartSample(text)}

Si ya se cubrieron TODOS los temas, responde exactamente: {"allCovered": true}

Si quedan temas, responde SOLO con JSON array:
[
  {
    "front": "¿Pregunta específica?",
    "back": "Respuesta concisa y precisa",
    "context": "Frase de apoyo del texto"${hasImages ? ',\n    "imageIndex": null' : ''}
  }
]

Reglas: NO repetir temas ya cubiertos. Preguntas sobre definiciones, funciones, relaciones anatómicas.`;

  const raw = await askClaude(prompt, images);
  if (raw.includes('"allCovered": true') || raw.includes('"allCovered":true')) {
    return { cards: [], allCovered: true };
  }
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  const cards = JSON.parse(match[0]).map((c, i) => ({ ...c, id: Date.now() + i }));
  return { cards, allCovered: false };
}

// Returns { questions, allCovered }
export async function generateQuestionsAI(text, existing = [], images = []) {
  const hasImages = images.length > 0;
  const existingList = existing.length > 0
    ? `\nPREGUNTAS YA CREADAS (NO repetir):\n${existing.map(q => `- ${q.question}`).join('\n')}\n`
    : '';

  const imageInstructions = hasImages
    ? `\nTenés ${Math.min(images.length, 4)} imágenes del resumen (índices 0 a ${Math.min(images.length, 4) - 1}). Si una imagen ilustra la pregunta o ayuda a entender la respuesta, incluye "imageIndex": N. Si no, omite imageIndex.\n`
    : '';

  const prompt = `Eres un profesor de medicina. Genera 8 preguntas de opción múltiple NUEVAS.${existingList}${imageInstructions}
RESUMEN:
${smartSample(text)}

Si ya se cubrieron TODOS los temas, responde exactamente: {"allCovered": true}

Si quedan temas, responde SOLO con JSON array:
[
  {
    "question": "Pregunta clara",
    "options": ["A", "B", "C", "D"],
    "correct": "Opción correcta exacta",
    "explanation": "Por qué es correcta"${hasImages ? ',\n    "imageIndex": null' : ''}
  }
]

Reglas: NO repetir temas ya cubiertos. Opciones incorrectas plausibles.`;

  const raw = await askClaude(prompt, images);
  if (raw.includes('"allCovered": true') || raw.includes('"allCovered":true')) {
    return { questions: [], allCovered: true };
  }
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  const questions = JSON.parse(match[0]).map((q, i) => ({ ...q, id: Date.now() + i }));
  return { questions, allCovered: false };
}

export async function generateConceptMapAI(text, images = []) {
  const hasImages = images.length > 0;
  const imageInstructions = hasImages
    ? `\nTenés ${Math.min(images.length, 4)} imágenes (índices 0-${Math.min(images.length, 4) - 1}). Si una imagen ilustra un nodo, incluye "imageIndex": N en ese nodo.\n`
    : '';

  const prompt = `Eres un profesor de medicina. Crea un mapa conceptual RICO Y DETALLADO.${imageInstructions}
RESUMEN:
${smartSample(text)}

Responde SOLO con JSON válido. Genera 10-14 nodos con contenido profundo:
{
  "title": "Tema principal",
  "nodes": [
    {
      "id": 0,
      "label": "Título corto (2-4 palabras)",
      "type": "main",
      "summary": "Una línea que describe el concepto",
      "content": "Explicación completa en 2-4 oraciones con los puntos más importantes del tema",
      "bullets": ["Dato clave 1", "Dato clave 2", "Dato clave 3"],
      "imageIndex": null,
      "x": 600, "y": 80
    },
    {
      "id": 1,
      "label": "Subtema 1",
      "type": "sub",
      "summary": "Una línea resumen",
      "content": "Explicación detallada del subtema...",
      "bullets": ["Punto 1", "Punto 2"],
      "imageIndex": null,
      "x": 200, "y": 260
    }
  ],
  "edges": [
    {"from": 0, "to": 1, "label": "contiene"},
    {"from": 0, "to": 2, "label": "incluye"}
  ]
}

Tipos: "main" (1 nodo central), "sub" (3-5 subtemas), "detail" (5-8 detalles).
Distribuye nodos en un espacio de 1200x900px. Nodo principal centrado arriba.
Contenido debe ser educativo, preciso y con terminología médica correcta.`;

  const raw = await askClaude(prompt, images);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]);
}
