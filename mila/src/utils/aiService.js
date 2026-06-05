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

// OCR pipeline for image-only PDFs.
// Sends page images in batches of 4 and extracts all visible text.
// Returns a single combined string ready to feed into concept map generation.
export async function ocrImagePages(images, onProgress) {
  if (!API_KEY) throw new Error('No API key configurada');
  const pages = images.slice(0, 20); // cap at 20 pages
  if (pages.length === 0) return '';

  const BATCH = 4;
  const allText = [];

  for (let i = 0; i < pages.length; i += BATCH) {
    const batch = pages.slice(i, i + BATCH);
    const startPage = i + 1;

    // Build request content with higher-res images for better OCR accuracy
    const content = [];
    for (const img of batch) {
      try {
        const compressed = await compressImageHighRes(img.src);
        if (!compressed) continue;
        const data = compressed.replace(/^data:[^;]+;base64,/, '');
        if (data.length > 4_000_000) continue;
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
      } catch { /* skip */ }
    }

    const endPage = Math.min(startPage + batch.length - 1, pages.length);
    const sections = Array.from({ length: batch.length }, (_, j) =>
      `=== PÁGINA ${startPage + j} ===\n(transcribí aquí todo el texto de la imagen ${j + 1})`
    ).join('\n\n');

    content.push({
      type: 'text',
      text: `Estas son ${batch.length} página(s) de un PDF (páginas ${startPage} a ${endPage}).

Transcribí TODO el texto escrito que ves en CADA imagen, en el mismo orden en que aparece. Incluí títulos, subtítulos, párrafos, listas, etiquetas de flechas y cualquier texto visible. NO describas dibujos ni ilustraciones — solo copiá el texto.

Respondé con este formato exacto, una sección por imagen:

${sections}

Si una página no tiene texto legible, escribí "(sin texto)" en esa sección.`,
    });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000); // 45 s timeout per batch
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{ role: 'user', content }],
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        allText.push(data.content[0].text);
      }
    } catch (e) {
      console.warn('[MILA OCR] Error en lote', startPage, e.name === 'AbortError' ? 'timeout' : e);
    }

    if (onProgress) onProgress(Math.min(i + BATCH, pages.length), pages.length);
  }

  // Strip the section headers and join into clean running text
  const raw = allText.join('\n\n');
  return raw
    .replace(/===\s*PÁGINA\s+\d+\s*===/gi, '\n\n')
    .replace(/\(sin texto\)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function compressImageHighRes(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1000; // higher res for text recognition
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000); // 60 s timeout
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: controller.signal,
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
  clearTimeout(timer);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// Global image assignment — two-stage pipeline.
// Stage 1: Claude reads each image (HIGH-RES, batches of 4) and extracts text
//          with hierarchy: title (largest text) → subtitles → other text.
// Stage 2: Deterministic JS matching — title match wins (score 40),
//          then subtitle (score 18), then body text (score 6).
async function matchImages(topics, images) {
  if (!images || images.length === 0) return topics.map(() => null);

  const selected = spreadImages(images, Math.min(images.length, 20));
  console.log('[MILA matchImages] Procesando', selected.length, 'imágenes para', topics.length, 'nodos');

  // Stage 1: OCR in batches of 4 with high-res images
  const BATCH = 4;
  const ocrMap = {}; // si → { title, subtitles[], other }

  for (let i = 0; i < selected.length; i += BATCH) {
    const batch = selected.slice(i, i + BATCH);
    const batchContent = [];

    for (const img of batch) {
      try {
        const compressed = await compressImageHighRes(img.src); // 1000px for readable text
        if (!compressed) continue;
        const data = compressed.replace(/^data:[^;]+;base64,/, '');
        if (data.length > 5_000_000) continue;
        batchContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
      } catch { /* skip */ }
    }
    if (batchContent.length === 0) continue;

    const sectionList = batch.map((_, j) =>
      `{"idx": ${i + j}, "title": "TEXTO MÁS GRANDE O PRINCIPAL DE LA IMAGEN", "subtitles": ["subtítulo 1", "subtítulo 2"], "other": "resto del texto"}`
    ).join(',\n  ');

    batchContent.push({
      type: 'text',
      text: `Estas son ${batch.length} páginas de apuntes universitarios/médicos (índices ${i} a ${i + batch.length - 1}).

Para CADA imagen extraé el texto con jerarquía:
- "title": el texto más grande/prominente (título principal de la página). Ej: "HÚMERO", "MÚSCULOS DEL BRAZO", "NERVIO CUBITAL"
- "subtitles": array de subtítulos o secciones secundarias importantes (nombres de estructuras, regiones, etc.)
- "other": cualquier otro texto (etiquetas de flechas, notas al pie, etc.)

IMPORTANTE: Copiá el texto EXACTAMENTE como aparece, respetando mayúsculas y tildes.

Respondé SOLO con este JSON (${batch.length} objetos):
{"ocr": [
  ${sectionList}
]}`,
    });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55000);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: batchContent }],
        }),
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const raw = data.content[0].text;
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            (parsed.ocr || []).forEach(entry => {
              ocrMap[entry.idx] = {
                title: entry.title || '',
                subtitles: Array.isArray(entry.subtitles) ? entry.subtitles : [],
                other: entry.other || '',
              };
              console.log(`  [img ${entry.idx}] title="${entry.title}" | subtitles=[${(entry.subtitles || []).join(', ')}]`);
            });
          }
        } catch {
          // Fallback: extract title fields individually
          const entries = [...raw.matchAll(/"idx"\s*:\s*(\d+)[^}]*?"title"\s*:\s*"([^"]*)"/g)];
          entries.forEach(m => {
            ocrMap[parseInt(m[1])] = { title: m[2], subtitles: [], other: '' };
            console.log(`  [img ${m[1]}] title="${m[2]}" (fallback)`);
          });
        }
      }
    } catch (err) {
      console.warn(`[MILA matchImages] Error batch ${i}:`, err.message);
    }
  }

  console.log('[MILA matchImages] OCR done:', Object.keys(ocrMap).length, 'imgs con texto');

  // Stage 2: hierarchical deterministic matching
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function overlapRatio(haystack, needle) {
    const h = norm(haystack);
    const n = norm(needle);
    if (!h || !n) return 0;
    if (h.includes(n)) return 1.0;
    const words = n.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return 0;
    const matched = words.filter(w => h.includes(w));
    return matched.length / words.length;
  }

  function scoreImageForTopic(imgOcr, topic) {
    if (!imgOcr) return 0;

    // Title — highest priority
    const tRatio = overlapRatio(imgOcr.title, topic);
    if (tRatio >= 1.0) return 40;
    if (tRatio >= 0.75) return 32;
    if (tRatio >= 0.5)  return 22;
    if (tRatio >= 0.3)  return 14;

    // Subtitles — second priority
    let bestSub = 0;
    for (const sub of imgOcr.subtitles) {
      const r = overlapRatio(sub, topic);
      if (r > bestSub) bestSub = r;
    }
    if (bestSub >= 1.0) return 18;
    if (bestSub >= 0.7) return 13;
    if (bestSub >= 0.5) return 9;

    // Other text — lowest priority
    const oRatio = overlapRatio(imgOcr.other, topic);
    if (oRatio >= 1.0) return 6;
    if (oRatio >= 0.5) return 3;

    return 0;
  }

  const candidates = [];
  selected.forEach((img, si) => {
    const imgOcr = ocrMap[si];
    topics.forEach((topic, ti) => {
      const s = scoreImageForTopic(imgOcr, topic);
      if (s > 0) candidates.push({ si, origIdx: img._origIdx, topicIdx: ti, score: s });
    });
  });

  candidates.sort((a, b) => b.score - a.score || a.si - b.si);

  const usedImages = new Set();
  const usedTopics = new Set();
  const result = topics.map(() => null);

  candidates.forEach(({ si, origIdx, topicIdx, score: s }) => {
    if (usedImages.has(si) || usedTopics.has(topicIdx)) return;
    result[topicIdx] = origIdx;
    usedImages.add(si);
    usedTopics.add(topicIdx);
    console.log(`✅ "${topics[topicIdx]}" ← img #${si} (origIdx ${origIdx}, score ${s})`);
  });

  topics.forEach((t, i) => { if (result[i] === null) console.log(`❌ Sin imagen: "${t}"`); });
  return result;
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
export async function generateFlashcardsAI(text, existing = [], images = [], nodes = []) {
  const existingList = existing.length > 0
    ? `\nFLASHCARDS YA CREADAS (NO repetir):\n${existing.map(c => `- ${c.front}`).join('\n')}\n`
    : '';

  const nodesSection = nodes.length > 0
    ? `\nCONCEPTOS DEL MAPA (asigná uno como "conceptLabel" de cada flashcard):\n${nodes.map(n => `- "${n.label}"`).join('\n')}\n`
    : '';

  const conceptLabelField = nodes.length > 0
    ? `\n    "conceptLabel": "Nombre del concepto del mapa al que pertenece esta flashcard",`
    : '';

  const prompt = `Eres un profesor de medicina. Genera 10 flashcards NUEVAS del resumen.${existingList}${nodesSection}
RESUMEN:
${smartSample(text)}

Si ya se cubrieron TODOS los temas, responde exactamente: {"allCovered": true}

Si quedan temas, responde SOLO con JSON array:
[
  {
    "front": "¿Pregunta específica y clara?",
    "back": "Respuesta concisa y precisa",${conceptLabelField}
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
export async function generateQuestionsAI(text, existing = [], images = [], nodes = []) {
  const existingList = existing.length > 0
    ? `\nPREGUNTAS YA CREADAS (NO repetir):\n${existing.map(q => `- ${q.question}`).join('\n')}\n`
    : '';

  const nodesSection = nodes.length > 0
    ? `\nCONCEPTOS DEL MAPA (asigná uno como "conceptLabel" de cada pregunta):\n${nodes.map(n => `- "${n.label}"`).join('\n')}\n`
    : '';

  const conceptLabelField = nodes.length > 0
    ? `\n    "conceptLabel": "Nombre del concepto del mapa al que pertenece esta pregunta",`
    : '';

  const prompt = `Eres un profesor de medicina. Genera 8 preguntas de opción múltiple NUEVAS.${existingList}${nodesSection}
RESUMEN:
${smartSample(text)}

Si ya se cubrieron TODOS los temas, responde exactamente: {"allCovered": true}

Si quedan temas, responde SOLO con JSON array:
[
  {
    "question": "Pregunta clara",${conceptLabelField}
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

// Generate flashcards specifically for a single concept map node
export async function generateNodeFlashcardsAI(node, existingCards = []) {
  const nodeText = [node.label, node.summary, node.content, ...(node.bullets || [])].filter(Boolean).join('\n');
  const existingFronts = existingCards.map(c => c.front);
  const existingList = existingFronts.length > 0
    ? `\nFLASHCARDS YA CREADAS (NO repetir ninguna, ni reformularla):\n${existingFronts.map(f => `- ${f}`).join('\n')}\n`
    : '';

  const prompt = `Eres un profesor experto. Generá 4-6 flashcards DISTINTAS sobre "${node.label}".${existingList}

CONTENIDO:
${nodeText}

INSTRUCCIONES IMPORTANTES:
- Cubrí TODOS los aspectos posibles: origen, inserción, función/acción, inervación, irrigación, relaciones anatómicas, características especiales, patología, etc.
- Cada flashcard debe preguntar sobre un aspecto DIFERENTE
- NO hacer dos preguntas sobre lo mismo con otras palabras
- Si ya existen flashcards, cubrí SOLO los aspectos que todavía no están cubiertos
- Si todos los aspectos posibles ya están cubiertos, respondé exactamente: {"allCovered": true}

Respondé SOLO con JSON array (o {"allCovered": true}):
[
  {
    "front": "¿Pregunta sobre UN aspecto específico de ${node.label}?",
    "back": "Respuesta concisa y completa",
    "context": "Fragmento del contenido que respalda esto"
  }
]`;

  const raw = await askClaude(prompt);
  if (raw.includes('"allCovered"')) return { cards: [], allCovered: true };
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return {
    cards: JSON.parse(match[0]).map((c, i) => ({ ...c, id: Date.now() + i, conceptLabel: node.label })),
    allCovered: false,
  };
}

// Generate multiple-choice questions for a single concept map node
export async function generateNodeQuestionsAI(node, existingQuestions = []) {
  const nodeText = [node.label, node.summary, node.content, ...(node.bullets || [])].filter(Boolean).join('\n');
  const existingTexts = existingQuestions.map(q => q.question);
  const existingList = existingTexts.length > 0
    ? `\nPREGUNTAS YA CREADAS (NO repetir ni reformular):\n${existingTexts.map(q => `- ${q}`).join('\n')}\n`
    : '';

  const prompt = `Eres un profesor experto. Generá 3-5 preguntas de opción múltiple DISTINTAS sobre "${node.label}".${existingList}

CONTENIDO:
${nodeText}

INSTRUCCIONES IMPORTANTES:
- Cubrí aspectos DIFERENTES: origen, inserción, función, inervación, irrigación, relaciones, características especiales, etc.
- Cada pregunta debe evaluar UN aspecto distinto que las demás no cubran
- NO hacer dos preguntas sobre lo mismo con otras palabras
- Las opciones incorrectas deben ser plausibles (otras estructuras relacionadas)
- Si todos los aspectos posibles ya están cubiertos, respondé exactamente: {"allCovered": true}

Respondé SOLO con JSON array (o {"allCovered": true}):
[
  {
    "question": "¿Pregunta sobre UN aspecto específico?",
    "options": ["Correcta", "Incorrecta plausible 1", "Incorrecta plausible 2", "Incorrecta plausible 3"],
    "correct": "Opción correcta exacta",
    "explanation": "Por qué es correcta, basándose en el contenido"
  }
]`;

  const raw = await askClaude(prompt);
  if (raw.includes('"allCovered"')) return { questions: [], allCovered: true };
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return {
    questions: JSON.parse(match[0]).map((q, i) => ({ ...q, id: Date.now() + i, conceptLabel: node.label })),
    allCovered: false,
  };
}

// Immediately distribute images across items without any API call
export function quickAssignImages(count, images) {
  if (!images || images.length === 0) return Array(count).fill(null);
  const selected = spreadImages(images, Math.min(images.length, 6));
  return distributeImages(count, selected);
}

// Assigns images to concept map nodes via vision
export async function assignImagesToNodes(nodes, images) {
  if (!images || images.length === 0) return nodes;
  // Use only the label so it matches exactly against text written in the images
  const topics = nodes.map(n => n.label);
  const imageMatches = await matchImages(topics, images);
  return nodes.map((n, i) => ({ ...n, imageIndex: imageMatches[i] ?? null }));
}

function cleanTextForMap(text) {
  return text
    // Remove "CARA N" / "CARA N:" structural page labels
    .replace(/\bCARA\s+\d+\s*:?/gi, ' ')
    // Remove bare page numbers like "Página 3" or "PAGE 2"
    .replace(/\b(P[ÁA]GINA|PAGE)\s+\d+\b/gi, ' ')
    // Collapse multiple spaces/newlines
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {3,}/g, ' ')
    .trim();
}

export async function generateConceptMapAI(text, images = []) {
  const cleanText = cleanTextForMap(text);
  const hasImages = images && images.length > 0;
  const selectedImages = hasImages ? spreadImages(images, 8) : [];

  const textSection = cleanText.trim()
    ? `\nTEXTO DEL RESUMEN (puede ser escaso o solo recordatorios):\n${smartSample(cleanText)}\n`
    : '';

  // Extract the filename/title to explicitly forbid it as a label
  const forbiddenLabel = cleanText.split('\n')[0]?.trim().slice(0, 60) || '';

  const prompt = hasImages
    ? `Eres un profesor experto en anatomía y ciencias de la salud analizando apuntes de un alumno. Las imágenes son páginas de un resumen/apunte. Tu tarea: extraer TODOS los conceptos específicos (estructuras, músculos, nervios, arterias, funciones, relaciones) y armar un mapa conceptual detallado.
${textSection}
PASO 1 — Antes de responder, listá mentalmente todos los nombres específicos que ves en las imágenes: músculos (ej: bíceps braquial, braquiorradial), nervios (ej: nervio radial, mediano), arterias, tendones, inserciones, orígenes, funciones, etc.

PASO 2 — Usá ESE listado como labels de los nodos. NUNCA uses el título de la página ni el nombre del archivo como label.

Respondé SOLO con JSON válido. Generá 10-14 nodos:
{
  "title": "Título descriptivo del tema",
  "nodes": [
    {
      "id": 0,
      "label": "Nombre específico del concepto",
      "type": "main",
      "summary": "Qué es / función principal",
      "content": "Detalle: origen, inserción, inervación, irrigación, función, relaciones anatómicas",
      "bullets": ["Origen: ...", "Inserción: ...", "Inervación: ...", "Función: ..."],
      "x": 600, "y": 80
    }
  ],
  "edges": [{"from": 0, "to": 1, "label": "inerva"}]
}

REGLAS ABSOLUTAS:
- PROHIBIDO usar "${forbiddenLabel}" como label de más de 1 nodo
- PROHIBIDO repetir el mismo label en dos nodos
- CADA label debe ser el nombre específico del concepto: un músculo, un nervio, una arteria, una función, etc.
- Si ves "Músculo Bíceps Braquial" en una imagen → label = "Bíceps Braquial"
- Si ves "Nervio Radial" → label = "Nervio Radial"
- 1 nodo "main" (tema general), 3-5 "sub" (grupos/categorías), 5-8 "detail" (estructuras específicas)
- Distribuí en 1200x900px`
    : `Eres un profesor experto organizando material de estudio en un mapa conceptual. Comprendé el tema en profundidad e identificá todos los conceptos importantes.
${textSection}
Respondé SOLO con JSON válido, sin texto antes ni después. Generá 10-12 nodos:
{
  "title": "Título del tema principal",
  "nodes": [
    {
      "id": 0,
      "label": "Concepto principal (2-4 palabras)",
      "type": "main",
      "summary": "Descripción del concepto",
      "content": "Explicación completa integrando toda la información relevante del texto",
      "bullets": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
      "x": 600, "y": 80
    }
  ],
  "edges": [{"from": 0, "to": 1, "label": "incluye"}]
}

Reglas:
- 1 nodo "main", 3-5 nodos "sub", 5-7 nodos "detail"
- Distribuí en 1200x900px
- Cubrí todos los conceptos del texto
- NUNCA uses labels genéricos
- CRÍTICO: cada nodo debe tener un label ÚNICO y ESPECÍFICO. NUNCA repitas el nombre del archivo como label de múltiples nodos`;

  for (let attempt = 0; attempt < 2; attempt++) {
    let raw;
    try {
      raw = await askClaude(prompt, selectedImages, 4000);
    } catch (err) {
      // Timeout or network error — don't retry (avoid extra charges)
      if (err.name === 'AbortError' || err.message?.includes('abort') || err.message?.includes('network')) throw err;
      if (attempt < 1) continue;
      throw err;
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { if (attempt < 1) continue; throw new Error('Respuesta inválida de la IA'); }
    let result;
    try { result = JSON.parse(match[0]); } catch { if (attempt < 1) continue; throw new Error('JSON inválido'); }
    if (!result.nodes?.length) { if (attempt < 1) continue; throw new Error('Mapa vacío'); }
    const labels = result.nodes.map(n => (n.label || '').trim().toLowerCase());
    const uniqueLabels = new Set(labels);
    if (uniqueLabels.size < Math.ceil(labels.length * 0.5)) {
      console.warn(`[MILA] Bad map (attempt ${attempt + 1}): ${uniqueLabels.size}/${labels.length} unique labels — retrying`);
      if (attempt < 1) continue;
    }
    return result;
  }
  throw new Error('No se pudo generar un mapa válido');
}

// Generates additional nodes to add to an existing concept map.
// Returns only new nodes+edges, never duplicating existing labels.
export async function expandConceptMapAI(text, existingMap, images = []) {
  const cleanText = cleanTextForMap(text);
  const existingLabels = (existingMap.nodes || []).map(n => n.label).join(', ');
  const maxId = Math.max(...(existingMap.nodes || []).map(n => n.id), -1);
  const startId = maxId + 1;
  const hasImages = images && images.length > 0;
  const selectedImages = hasImages ? spreadImages(images, 6) : [];

  const textSection = cleanText.trim()
    ? `\nTEXTO DEL RESUMEN:\n${smartSample(cleanText)}\n`
    : '';

  const prompt = `Eres un profesor experto ampliando un mapa conceptual. Tu tarea es identificar conceptos importantes ${hasImages ? 'del material (texto e imágenes)' : 'del texto'} que AÚN NO están en el mapa, y agregarlos como nuevos nodos con información completa y detallada.
${textSection}
CONCEPTOS YA EN EL MAPA (NO repetir ninguno):
${existingLabels}

${hasImages ? 'Las imágenes adjuntas contienen el material completo. Analizalas para encontrar conceptos faltantes: estructuras, funciones, relaciones, detalles clínicos, etc.\n\n' : ''}Generá entre 4 y 8 nodos NUEVOS con información relevante que falta. Los IDs deben comenzar en ${startId}.

Respondé SOLO con JSON válido, sin texto antes ni después:
{
  "nodes": [
    {
      "id": ${startId},
      "label": "Concepto nuevo (2-4 palabras)",
      "type": "detail",
      "summary": "Descripción clara del concepto",
      "content": "Explicación completa integrando toda la información relevante del material",
      "bullets": ["Detalle importante 1", "Detalle importante 2", "Detalle importante 3"],
      "x": 200, "y": 1000
    }
  ],
  "edges": [{"from": 0, "to": ${startId}, "label": "incluye"}]
}

Reglas:
- NO incluir ningún label que ya esté en el mapa
- content y bullets deben ser explicaciones completas y útiles, no solo copias de texto
- Conectar cada nodo nuevo al nodo existente más relacionado
- Distribuí los nuevos nodos debajo de los existentes (y > 900)
- Cubrí aspectos faltantes: funciones, relaciones, irrigación, inervación, variantes, aplicación clínica, etc. según corresponda al tema`;

  const raw = await askClaude(prompt, [], 3000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]);
}
