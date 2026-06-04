/**
 * RAG (Retrieval Augmented Generation) service for MILA chat.
 *
 * Builds a searchable corpus from the user's summaries in memory.
 * Never calls external sources — only the user's own data.
 */

const API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

// ── Corpus building ───────────────────────────────────────────────────────────

/**
 * Converts all user summaries into a flat array of searchable text chunks.
 * Each chunk includes metadata for attribution (which summary / node it came from).
 */
export function buildCorpus(summaries) {
  const chunks = [];

  for (const summary of summaries) {
    const base = {
      summaryId: summary.id,
      summaryTitle: summary.title,
      subject: summary.subject || '',
    };

    // 1. Raw text — split into paragraphs
    if (summary.text && summary.text.trim().length > 0) {
      const paragraphs = summary.text
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(p => p.length > 40);
      paragraphs.forEach((p, i) => {
        chunks.push({
          ...base,
          type: 'text',
          nodeLabel: null,
          content: p.slice(0, 900),
          id: `${summary.id}-text-${i}`,
        });
      });
    }

    // 2. Concept map nodes — each node is a rich chunk
    const nodes = summary.conceptMap?.nodes || [];
    for (const node of nodes) {
      const parts = [
        node.label,
        node.summary,
        node.content,
        ...(node.bullets || []),
      ].filter(Boolean);
      if (parts.length > 0) {
        chunks.push({
          ...base,
          type: 'node',
          nodeLabel: node.label,
          content: parts.join('\n').slice(0, 1200),
          id: `${summary.id}-node-${node.id}`,
        });
      }
    }

    // 3. Flashcards — grouped by concept label
    const flashcards = summary.flashcards || [];
    if (flashcards.length > 0) {
      const byLabel = {};
      flashcards.forEach(f => {
        const key = f.conceptLabel || 'general';
        if (!byLabel[key]) byLabel[key] = [];
        byLabel[key].push(`Pregunta: ${f.front}\nRespuesta: ${f.back}`);
      });
      Object.entries(byLabel).forEach(([label, cards], i) => {
        chunks.push({
          ...base,
          type: 'flashcards',
          nodeLabel: label !== 'general' ? label : null,
          content: cards.slice(0, 8).join('\n\n'),
          id: `${summary.id}-fc-${i}`,
        });
      });
    }

    // 4. Questions — grouped by concept label
    const questions = summary.questions || [];
    if (questions.length > 0) {
      const byLabel = {};
      questions.forEach(q => {
        const key = q.conceptLabel || 'general';
        if (!byLabel[key]) byLabel[key] = [];
        const entry = `Pregunta: ${q.question}\nRespuesta correcta: ${q.answer}${q.explanation ? '\nExplicación: ' + q.explanation : ''}`;
        byLabel[key].push(entry);
      });
      Object.entries(byLabel).forEach(([label, qs], i) => {
        chunks.push({
          ...base,
          type: 'questions',
          nodeLabel: label !== 'general' ? label : null,
          content: qs.slice(0, 5).join('\n\n'),
          id: `${summary.id}-q-${i}`,
        });
      });
    }

    // 5. Node edges / relationships
    const edges = summary.conceptMap?.edges || [];
    if (edges.length > 0 && nodes.length > 0) {
      const nodeMap = {};
      nodes.forEach(n => { nodeMap[n.id] = n.label; });
      const relations = edges
        .map(e => `${nodeMap[e.from] || e.from} → [${e.label || 'relacionado con'}] → ${nodeMap[e.to] || e.to}`)
        .filter(r => !r.includes('undefined'));
      if (relations.length > 0) {
        chunks.push({
          ...base,
          type: 'relations',
          nodeLabel: null,
          content: `Relaciones entre conceptos:\n${relations.join('\n')}`,
          id: `${summary.id}-edges`,
        });
      }
    }
  }

  return chunks;
}

// ── Keyword retrieval ─────────────────────────────────────────────────────────

function normalizeTerms(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  'que', 'una', 'los', 'las', 'del', 'por', 'con', 'para', 'son', 'esta',
  'este', 'como', 'pero', 'mas', 'hay', 'sus', 'tiene', 'entre', 'cuando',
  'sobre', 'ser', 'fue', 'han', 'porque', 'cual', 'cuales', 'donde', 'quien',
  'the', 'and', 'for', 'are', 'with', 'that', 'this', 'from', 'have', 'been',
]);

function scoreChunk(chunk, queryTerms) {
  const text = [chunk.content, chunk.nodeLabel || '', chunk.summaryTitle, chunk.subject].join(' ');
  const chunkTerms = normalizeTerms(text);
  const chunkSet = new Set(chunkTerms);

  let score = 0;
  for (const qt of queryTerms) {
    if (chunkSet.has(qt)) {
      score += 2; // exact match
    } else {
      // partial match
      for (const ct of chunkSet) {
        if (ct.includes(qt) || qt.includes(ct)) { score += 0.5; break; }
      }
    }
  }

  // Boost nodes and relations (richer structured content)
  if (chunk.type === 'node') score *= 1.3;
  if (chunk.type === 'relations') score *= 1.1;

  return score;
}

/**
 * Returns the k most relevant chunks for a given query.
 */
export function retrieveRelevant(corpus, query, k = 10) {
  const queryTerms = normalizeTerms(query);
  if (queryTerms.length === 0) return corpus.slice(0, k);

  const scored = corpus
    .map(chunk => ({ chunk, score: scoreChunk(chunk, queryTerms) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Deduplicate: cap 3 chunks per summary to get variety
  const result = [];
  const countBySummary = {};
  for (const { chunk } of scored) {
    if (result.length >= k) break;
    const count = countBySummary[chunk.summaryId] || 0;
    if (count < 4) {
      result.push(chunk);
      countBySummary[chunk.summaryId] = count + 1;
    }
  }

  // If nothing matched, return a general sample so the model can say "not in material"
  if (result.length === 0) return corpus.slice(0, Math.min(3, corpus.length));

  return result;
}

// ── Context formatting ────────────────────────────────────────────────────────

export function buildContext(chunks) {
  if (chunks.length === 0) return '(No se encontró información relevante en el material del usuario.)';

  const parts = chunks.map(c => {
    const source = c.nodeLabel
      ? `${c.summaryTitle}${c.subject ? ' [' + c.subject + ']' : ''} → ${c.nodeLabel}`
      : `${c.summaryTitle}${c.subject ? ' [' + c.subject + ']' : ''}`;
    return `📌 ${source}\n${c.content}`;
  });

  return parts.join('\n\n──────\n\n');
}

// ── Claude call ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres MILA, la tutora personal del estudiante. Eres femenina — refiérete a ti misma siempre en femenino (tutora, lista, preparada, etc.). Tu función es responder preguntas y ayudar a estudiar usando EXCLUSIVAMENTE el material del usuario que se te proporciona como contexto.

REGLAS ABSOLUTAS — debes seguirlas sin excepción:
1. Responde SOLO basándote en el contexto de material del usuario.
2. Si la información pedida NO está en el contexto, di: "Esa información no aparece en tu material de estudio." No inventes ni completes con conocimiento propio.
3. NO uses conocimiento externo, NO inventes datos, conceptos, cifras ni relaciones que no estén en el contexto.
4. Cuando respondas, menciona de qué resumen o concepto proviene la información (ej: "Según tu resumen de Anatomía...").
5. Puedes razonar, comparar y conectar información entre distintos resúmenes o nodos — siempre que esa información esté en el contexto.
6. Si el contexto tiene información parcial, úsala y aclara que puede estar incompleta en el material.
7. Responde en español, de forma clara, estructurada y educativa.
8. Para respuestas largas, usa listas o secciones para facilitar la lectura.`;

/**
 * Sends a message to Claude with the retrieved context.
 * history = array of { role: 'user'|'assistant', content: string }
 */
export async function sendChatMessage(query, context, history = []) {
  if (!API_KEY) throw new Error('No API key configurada');

  const contextBlock = `MATERIAL DEL USUARIO (usa SOLO esta información para responder):\n\n${context}`;

  // Build message array: inject context only in the latest user turn
  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: `${contextBlock}\n\n──────\n\nPREGUNTA DEL USUARIO:\n${query}`,
    },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

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
      max_tokens: 1800,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  clearTimeout(timer);
  if (!res.ok) throw new Error(`Error de API: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}
