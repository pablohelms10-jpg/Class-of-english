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

// Global image assignment via OCR-first matching.
//
// Architecture: two-stage pipeline.
// Stage 1 — Claude reads each image and reports the OCR text it sees.
//            No assignment logic. Just transcription.
// Stage 2 — JavaScript does the matching deterministically:
//            exact string inclusion (case-insensitive) between OCR and node label.
//            LLM is never trusted for the assignment decision itself.
async function matchImages(topics, images) {
  if (!images || images.length === 0) return topics.map(() => null);

  // Cap at 12 images. 20 images + OCR text exceeds the 2000-token response
  // budget and causes JSON truncation. 12 is reliable and covers most PDFs.
  const selected = spreadImages(images, Math.min(images.length, 12));

  console.group('[MILA matchImages] Stage 1 — OCR');
  console.log('Imágenes enviadas a Claude:', selected.length);
  console.log('Nodos a asignar:', topics.map((t, i) => `${i}. ${t}`));
  console.groupEnd();

  // Stage 1: ask Claude ONLY to transcribe text in each image, no assignment
  const ocrPrompt = `Sos un sistema OCR. Para cada imagen, transcribí TODO el texto visible: títulos, subtítulos, etiquetas, nombres anatómicos, leyendas, texto de flechas.
No hagas ninguna asignación ni interpretación. Solo copiá el texto que ves.

Respondé con JSON exactamente así (${selected.length} objetos, uno por imagen, en orden):
{"ocr": [
  {"idx": 0, "text": "todo el texto de la imagen 0"},
  {"idx": 1, "text": "todo el texto de la imagen 1"}
]}

Si una imagen no tiene texto legible, usá "" para ese campo.
Incluí los ${selected.length} objetos completos.`;

  let ocrResults = [];
  try {
    // Use 4000 tokens — 12 images × ~3 lines of OCR each fits comfortably
    const raw = await askClaude(ocrPrompt, selected, 4000);
    console.log('[MILA matchImages] Respuesta OCR cruda:\n', raw);
    const jsonMatch = raw.match(/\{[\s\S]*?\}/s) || raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        ocrResults = parsed.ocr || [];
      } catch {
        // JSON may be truncated — extract any complete {"idx":N,"text":"..."} objects
        const entries = [...raw.matchAll(/\{\s*"idx"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*"([^"]*)"/g)];
        ocrResults = entries.map(m => ({ idx: parseInt(m[1]), text: m[2] }));
        console.warn('[MILA matchImages] JSON truncado, recuperados', ocrResults.length, 'de', selected.length, 'entradas');
      }
    }
  } catch (err) {
    console.error('[MILA matchImages] Error en Stage 1 (OCR):', err);
    return topics.map(() => null);
  }

  if (ocrResults.length === 0) {
    console.error('[MILA matchImages] OCR devolvió 0 entradas — abortando');
    return topics.map(() => null);
  }

  // Stage 2: deterministic JavaScript matching
  console.group('[MILA matchImages] Stage 2 — Matching determinístico');

  // Build map: imageIdx → OCR text (normalise accents + lowercase)
  function normalise(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  const ocrMap = {};
  ocrResults.forEach(r => { ocrMap[r.idx] = normalise(r.text); });

  selected.forEach((img, si) => {
    const ocr = ocrMap[si] || '(sin texto)';
    console.log(`Imagen #${si} (origIdx ${img._origIdx}): "${ocr.slice(0, 120)}"`);
  });

  // Score: how well does an image's OCR match a topic label?
  // Score 3: OCR contains the full topic label (exact)
  // Score 2: all significant words of topic (>3 chars) appear in OCR
  // Score 1: majority of significant words appear in OCR
  // Score 0: no match
  function score(ocrText, topicLabel) {
    const ocr = normalise(ocrText);
    const topic = normalise(topicLabel.trim());
    if (!ocr || !topic) return 0;
    if (ocr.includes(topic)) return 3;
    const words = topic.split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return ocr.includes(topic) ? 3 : 0;
    const matched = words.filter(w => ocr.includes(w));
    if (matched.length === words.length) return 2;
    if (matched.length >= Math.ceil(words.length * 0.6)) return 1;
    return 0;
  }

  // Build candidates: (image, topic, score) for every pair with score > 0
  const candidates = [];
  selected.forEach((img, si) => {
    const ocr = ocrMap[si] || '';
    topics.forEach((topic, ti) => {
      const s = score(ocr, topic);
      if (s > 0) candidates.push({ si, origIdx: img._origIdx, topicIdx: ti, score: s });
    });
  });

  // Greedy assignment: highest score first, each image and topic used once
  candidates.sort((a, b) => b.score - a.score || a.si - b.si);

  const usedImages = new Set();
  const usedTopics = new Set();
  const result = topics.map(() => null);

  candidates.forEach(({ si, origIdx, topicIdx, score: s }) => {
    if (usedImages.has(si) || usedTopics.has(topicIdx)) return;
    result[topicIdx] = origIdx;
    usedImages.add(si);
    usedTopics.add(topicIdx);
    console.log(`✅ Nodo ${topicIdx} "${topics[topicIdx]}" ← imagen #${si} (score ${s}, origIdx ${origIdx})`);
  });

  topics.forEach((topic, i) => {
    if (result[i] === null) console.log(`❌ Nodo ${i} "${topic}" → sin imagen`);
  });

  console.log('[MILA matchImages] Resultado final:', result);
  console.groupEnd();
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

  const prompt = hasImages
    ? `Eres un profesor experto analizando material de estudio. El alumno te proporcionó ${images.length} imagen(es) de sus apuntes/resúmenes y algo de texto. Tu tarea es COMPRENDER TODO el contenido — diagramas, esquemas, texto escrito a mano, tablas, flechas con etiquetas, anotaciones — y construir un mapa conceptual completo que capture TODA la información importante, igual que lo haría un docente que entiende el tema en profundidad.
${textSection}
Las imágenes adjuntas contienen el material real del resumen. Analizalas completamente.

Respondé SOLO con JSON válido, sin texto antes ni después. Generá 10-14 nodos que cubran TODOS los conceptos importantes:
{
  "title": "Título del tema principal",
  "nodes": [
    {
      "id": 0,
      "label": "Concepto principal (2-4 palabras)",
      "type": "main",
      "summary": "Descripción clara y completa del concepto principal",
      "content": "Explicación detallada integrando TODA la información del material: texto, diagramas, esquemas, relaciones entre estructuras, etc.",
      "bullets": ["Aspecto clave 1 con detalle", "Aspecto clave 2 con detalle", "Aspecto clave 3 con detalle"],
      "x": 600, "y": 80
    }
  ],
  "edges": [{"from": 0, "to": 1, "label": "incluye"}]
}

Reglas:
- Analizá CADA imagen en detalle: texto manuscrito, diagramas anatómicos, esquemas, tablas, flechas, etiquetas
- content y bullets deben integrar información de texto E imágenes, explicando relaciones, funciones, orígenes, inserciones, inervación, irrigación, etc. según corresponda al tema
- No te limites al texto — el material visual es la fuente principal
- 1 nodo "main", 3-5 nodos "sub" (segunda fila), 5-8 nodos "detail" (tercera fila)
- Distribuí en espacio 1200x900px
- Cubrí TODOS los conceptos que aparecen en el material, sin omitir nada importante
- NUNCA uses labels genéricos como "Concepto 1" o "Página N"`
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
- NUNCA uses labels genéricos`;

  const raw = await askClaude(prompt, selectedImages, 4000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta inválida de la IA');
  return JSON.parse(match[0]);
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
