const API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

function smartSample(text, maxLen = 4000) {
  if (text.length <= maxLen) return text;
  const third = Math.floor(maxLen / 3);
  const mid = Math.floor(text.length / 2);
  return text.slice(0, third) + '\n...\n' + text.slice(mid - Math.floor(third / 2), mid + Math.floor(third / 2)) + '\n...\n' + text.slice(-third);
}

async function compressImage(dataUrl, maxPx = 480) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Pick images spread evenly across the array
function spreadImages(images, count = 6) {
  if (!images || images.length === 0) return [];
  if (images.length <= count) return images.map((img, i) => ({ ...img, _origIdx: i }));
  const step = (images.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.round(i * step);
    return { ...images[idx], _origIdx: idx };
  });
}

async function buildContent(prompt, images = []) {
  const content = [];
  for (const img of images) {
    try {
      const compressed = await compressImage(img.src);
      if (!compressed) continue;
      const mediaType = compressed.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      const data = compressed.replace(/^data:[^;]+;base64,/, '');
      if (data.length > 4_000_000) continue; // skip if still too big
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
    } catch { /* skip */ }
  }
  content.push({ type: 'text', text: prompt });
  return content;
}

async function askClaude(prompt, images = [], maxTokens = 3000) {
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
      max_tokens: maxTokens,
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

// Separate step: match images to cards/questions via vision
async function matchImages(topics, images) {
  if (!images || images.length === 0) return topics.map(() => null);
  const selected = spreadImages(images, 6);

  const prompt = `Tenés ${selected.length} imágenes anatómicas (índices 0 a ${selected.length - 1}) y ${topics.length} temas médicos.

TEMAS:
${topics.map((t, i) => `${i}: "${t}"`).join('\n')}

Para cada tema, asigná el índice de imagen que MEJOR lo representa visualmente.
REGLAS IMPORTANTES:
- Asigná SIEMPRE una imagen a cada tema si las imágenes son del mismo tema general
- Podés repetir el mismo índice en varios temas
- Solo usá null si el tema es puramente abstracto (ej: fechas, nombres propios sin anatomía)
- La mayoría de los temas deben tener una imagen asignada

Responde SOLO con JSON (exactamente ${topics.length} valores):
{"matches": [0, 1, 0, 2, 1, 3, 0, null, 2, 1]}`;

  try {
    const raw = await askClaude(prompt, selected);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return distributeImages(topics.length, selected);
    const parsed = JSON.parse(jsonMatch[0]);
    const matches = parsed.matches || [];
    const result = matches.map(idx => {
      if (idx == null || idx === 'null') return null;
      const n = parseInt(idx);
      return isNaN(n) ? null : (selected[n]?._origIdx ?? null);
    });
    // If Claude returned all nulls, distribute images evenly as fallback
    if (result.every(v => v == null)) return distributeImages(topics.length, selected);
    // Pad with nulls if too short
    while (result.length < topics.length) result.push(null);
    return result;
  } catch {
    return distributeImages(topics.length, selected);
  }
}

// Spread available images across topics when AI matching fails
function distributeImages(count, selected) {
  if (!selected || selected.length === 0) return Array(count).fill(null);
  return Array.from({ length: count }, (_, i) => {
    const img = selected[i % selected.length];
    return img?._origIdx ?? null;
  });
}

// Returns { cards, allCovered }
export async function generateFlashcardsAI(text, existing = [], images = []) {
  const existingList = existing.length > 0
    ? `\nFLASHCARDS YA CREADAS (NO repetir):\n${existing.map(c => `- ${c.front}`).join('\n')}\n`
    : '';

  const prompt = `Eres un profesor de medicina. Genera 10 flashcards NUEVAS del resumen.${existingList}
RESUMEN:
${smartSample(text)}

Si ya se cubrieron TODOS los temas, responde exactamente: {"allCovered": true}

Si quedan temas, responde SOLO con JSON array:
[
  {
    "front": "¿Pregunta específica y clara?",
    "back": "Respuesta concisa y precisa",
    "context": "Frase del texto que respalda esto"
  }
]

Reglas: NO repetir temas ya cubiertos. Preguntas sobre definiciones, funciones, relaciones anatómicas. Máximo 10.`;

  const raw = await askClaude(prompt);
  if (raw.includes('"allCovered": true') || raw.includes('"allCovered":true')) {
    return { cards: [], allCovered: true };
  }
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  let cards = JSON.parse(match[0]).map((c, i) => ({ ...c, id: Date.now() + i }));

  // Separate vision pass to assign images
  if (images.length > 0) {
    const topics = cards.map(c => c.front);
    const imageMatches = await matchImages(topics, images);
    cards = cards.map((c, i) => ({ ...c, imageIndex: imageMatches[i] ?? null }));
  }

  return { cards, allCovered: false };
}

// Returns { questions, allCovered }
export async function generateQuestionsAI(text, existing = [], images = []) {
  const existingList = existing.length > 0
    ? `\nPREGUNTAS YA CREADAS (NO repetir):\n${existing.map(q => `- ${q.question}`).join('\n')}\n`
    : '';

  const prompt = `Eres un profesor de medicina. Genera 8 preguntas de opción múltiple NUEVAS.${existingList}
RESUMEN:
${smartSample(text)}

Si ya se cubrieron TODOS los temas, responde exactamente: {"allCovered": true}

Si quedan temas, responde SOLO con JSON array:
[
  {
    "question": "Pregunta clara",
    "options": ["A", "B", "C", "D"],
    "correct": "Opción correcta exacta",
    "explanation": "Por qué es correcta"
  }
]

Reglas: NO repetir temas ya cubiertos. Opciones incorrectas plausibles. Máximo 8.`;

  const raw = await askClaude(prompt);
  if (raw.includes('"allCovered": true') || raw.includes('"allCovered":true')) {
    return { questions: [], allCovered: true };
  }
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  let questions = JSON.parse(match[0]).map((q, i) => ({ ...q, id: Date.now() + i }));

  // Separate vision pass to assign images
  if (images.length > 0) {
    const topics = questions.map(q => q.question);
    const imageMatches = await matchImages(topics, images);
    questions = questions.map((q, i) => ({ ...q, imageIndex: imageMatches[i] ?? null }));
  }

  return { questions, allCovered: false };
}

// Assigns images to concept map nodes via vision
export async function assignImagesToNodes(nodes, images) {
  if (!images || images.length === 0) return nodes;
  const topics = nodes.map(n => n.label + (n.summary ? ': ' + n.summary : ''));
  const imageMatches = await matchImages(topics, images);
  return nodes.map((n, i) => ({ ...n, imageIndex: imageMatches[i] ?? null }));
}

export async function generateConceptMapAI(text) {
  const prompt = `Eres un profesor de medicina. Analiza el siguiente resumen y crea un mapa conceptual detallado y organizado sobre los temas REALES del texto.

RESUMEN:
${smartSample(text)}

Responde SOLO con JSON válido, sin texto antes ni después. Genera exactamente 10-12 nodos con títulos ESPECÍFICOS del contenido (no genéricos):
{
  "title": "Nombre real del tema",
  "nodes": [
    {
      "id": 0,
      "label": "Nombre específico (2-4 palabras)",
      "type": "main",
      "summary": "Una oración resumiendo este concepto",
      "content": "2-3 oraciones explicando los puntos clave de este concepto",
      "bullets": ["Dato específico 1", "Dato específico 2", "Dato específico 3"],
      "x": 600, "y": 80
    }
  ],
  "edges": [{"from": 0, "to": 1, "label": "incluye"}]
}

Reglas estrictas:
- 1 nodo "main" (tema central) en x≈600, y≈80
- 3-5 nodos "sub" (subtemas principales) distribuidos en segunda fila
- 5-7 nodos "detail" (conceptos específicos) en tercera fila
- Los "label" deben ser términos MÉDICOS REALES del texto, no genéricos
- Distribuye en espacio 1200x900px con separación clara entre nodos
- NUNCA uses nombres como "Concepto 1", "Subtema A" o similares`;

  const raw = await askClaude(prompt, [], 4000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]);
}
