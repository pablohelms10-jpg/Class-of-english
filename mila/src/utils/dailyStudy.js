/**
 * Daily Study Loop — scoring & session generation.
 *
 * Reads existing summaries (unchanged format) and produces a structured
 * study session. Never modifies any existing data.
 */

// ── Node scoring ──────────────────────────────────────────────────────────────

function scoreNode(node, summary) {
  const masteredNodes = summary.masteredNodes || {};
  const flashcards = summary.flashcards || [];
  const questions = summary.questions || [];

  // Match flashcards and questions to this node
  const label = (node.label || '').toLowerCase();
  const nodeFC = flashcards.filter(f =>
    f.nodeId === node.id ||
    (f.conceptLabel && f.conceptLabel.toLowerCase() === label)
  );
  const nodeQ = questions.filter(q =>
    q.nodeId === node.id ||
    (q.conceptLabel && q.conceptLabel.toLowerCase() === label)
  );

  const isMastered = !!masteredNodes[node.id];
  const totalFC = nodeFC.length;
  const knownFC = nodeFC.filter(f => f.known).length;
  const unknownFC = totalFC - knownFC;
  const totalQ = nodeQ.length;

  // Priority score — higher means MORE urgent / needs work
  // Range roughly 0–100. Higher = study this first.
  let priority = 50;

  // Mastered nodes are low priority unless they have unknown flashcards
  if (isMastered) priority -= 25;

  // Unknown flashcards raise priority significantly
  priority += unknownFC * 8;

  // Nodes with NO flashcards yet also need work
  if (totalFC === 0) priority += 15;

  // Nodes with flashcards but low known ratio
  if (totalFC > 0) {
    const knownRatio = knownFC / totalFC;
    priority += (1 - knownRatio) * 20;
  }

  // Nodes never reached via questions get a small boost
  if (totalQ === 0) priority += 8;

  return {
    summaryId: summary.id,
    summaryTitle: summary.title,
    subject: summary.subject || '',
    nodeId: node.id,
    nodeLabel: node.label,
    nodeSummary: node.summary || '',
    nodeContent: node.content || '',
    nodeBullets: node.bullets || [],
    isMastered,
    totalFC,
    knownFC,
    unknownFC,
    totalQ,
    priority: Math.max(0, Math.min(100, priority)),
    flashcards: nodeFC,
    questions: nodeQ,
  };
}

// ── Session flashcard / question selection ────────────────────────────────────

function pickFlashcards(nodeData, maxCards = 5) {
  const fc = [...nodeData.flashcards];
  // Unknown first, then known, shuffled within each group
  const unknown = fc.filter(f => !f.known).sort(() => Math.random() - 0.5);
  const known   = fc.filter(f => f.known).sort(() => Math.random() - 0.5);
  return [...unknown, ...known].slice(0, maxCards);
}

function pickQuestions(nodeData, maxQ = 3) {
  const qs = [...(nodeData.questions || [])];
  // Shuffle — no history yet, so treat all equally
  return qs.sort(() => Math.random() - 0.5).slice(0, maxQ);
}

// ── Diverse node selection ────────────────────────────────────────────────────
// Ensures we don't pick 5 nodes from the same summary if alternatives exist.

function selectDiverseNodes(scored, count = 5) {
  const result = [];
  const usedSummaries = new Map(); // summaryId → count used

  // Sort descending by priority
  const pool = [...scored].sort((a, b) => b.priority - a.priority);

  // First pass: pick highest priority, max 2 per summary
  for (const node of pool) {
    if (result.length >= count) break;
    const used = usedSummaries.get(node.summaryId) || 0;
    if (used < 2) {
      result.push(node);
      usedSummaries.set(node.summaryId, used + 1);
    }
  }

  // Second pass: fill remaining slots if needed (relax constraint)
  if (result.length < count) {
    for (const node of pool) {
      if (result.length >= count) break;
      if (!result.find(r => r.nodeId === node.nodeId && r.summaryId === node.summaryId)) {
        result.push(node);
      }
    }
  }

  return result;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Generates a daily study session from all user summaries.
 *
 * @param {Array} summaries  — full array from MilaContext (unchanged format)
 * @param {Object} options
 * @param {number} options.nodeCount      — how many nodes to include (default 5)
 * @param {number} options.cardsPerNode   — max flashcards per node (default 5)
 * @param {number} options.questionsPerNode — max questions per node (default 3)
 * @returns {Object|null}  structured session, or null if not enough data
 */
export function generateDailyStudySession(summaries, options = {}) {
  const {
    nodeCount = 5,
    cardsPerNode = 5,
    questionsPerNode = 3,
  } = options;

  if (!summaries || summaries.length === 0) return null;

  // Score every node across all summaries
  const allScored = [];
  for (const summary of summaries) {
    const nodes = summary.conceptMap?.nodes || [];
    for (const node of nodes) {
      // Skip nodes without any label (shouldn't happen, but defensive)
      if (!node.label) continue;
      allScored.push(scoreNode(node, summary));
    }
  }

  if (allScored.length === 0) return null;

  // Select the best nodes for today's session
  const selected = selectDiverseNodes(allScored, nodeCount);
  if (selected.length === 0) return null;

  // Build session nodes with curated flashcards and questions
  const sessionNodes = selected.map(n => ({
    ...n,
    sessionFlashcards: pickFlashcards(n, cardsPerNode),
    sessionQuestions: pickQuestions(n, questionsPerNode),
  }));

  const totalFlashcards = sessionNodes.reduce((a, n) => a + n.sessionFlashcards.length, 0);
  const totalQuestions  = sessionNodes.reduce((a, n) => a + n.sessionQuestions.length, 0);

  // Human-readable reason for each node
  const sessionNodesWithReason = sessionNodes.map(n => ({
    ...n,
    reason: buildReason(n),
  }));

  return {
    generatedAt: new Date().toISOString(),
    nodes: sessionNodesWithReason,
    totalFlashcards,
    totalQuestions,
    estimatedMinutes: Math.ceil((totalFlashcards * 0.5 + totalQuestions * 1) + sessionNodes.length * 0.5),
  };
}

function buildReason(n) {
  if (n.unknownFC > 0) return `${n.unknownFC} flashcard${n.unknownFC > 1 ? 's' : ''} sin dominar`;
  if (n.totalFC === 0 && n.totalQ === 0) return 'Aún no has estudiado este nodo';
  if (n.totalFC === 0) return 'Sin flashcards todavía';
  if (!n.isMastered) return 'Nodo pendiente de dominar';
  return 'Repaso de refuerzo';
}

// ── Session result helpers ────────────────────────────────────────────────────

/**
 * Merges the session answers back into the existing summaries flashcard arrays.
 * Returns a map of { summaryId → { flashcards: [...updated] } }
 * so callers can pass each entry to updateSummary() independently.
 *
 * @param {Array}  sessionNodes  — nodes from the completed session
 * @param {Object} cardAnswers   — { cardId: boolean } (true = known)
 * @param {Array}  summaries     — original summaries for reference
 */
export function mergeSessionResults(sessionNodes, cardAnswers, summaries) {
  const updates = {}; // summaryId → updated flashcards array

  for (const node of sessionNodes) {
    const summary = summaries.find(s => s.id === node.summaryId);
    if (!summary) continue;

    const updatedFC = (summary.flashcards || []).map(card => {
      if (card.id in cardAnswers) {
        return { ...card, known: cardAnswers[card.id] };
      }
      return card;
    });

    updates[node.summaryId] = { flashcards: updatedFC };
  }

  return updates;
}
