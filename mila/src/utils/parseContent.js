export function extractTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function extractImagesFromFile(file) {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve([{ src: e.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    } else {
      resolve([]);
    }
  });
}

export const MAX_PDF_PAGES = 50;

export async function extractFromPDF(file, onProgress) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const totalPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  let fullText = '';
  const images = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';

    try {
      const src = await extractDiagramFromPage(page, pdfjsLib);
      if (src) images.push({ src, name: `${file.name} — página ${pageNum}` });
    } catch { /* skip */ }

    if (onProgress) onProgress(pageNum, totalPages);
  }

  return { text: fullText, images, truncated: pdf.numPages > MAX_PDF_PAGES, totalPages: pdf.numPages };
}

// Detects where embedded images are painted on the page and crops to the largest one,
// discarding slide titles and bullet-point text. Falls back to a full-page thumbnail if
// the page has no embedded image XObjects (e.g. pure-text pages).
async function extractDiagramFromPage(page, pdfjsLib) {
  // Render first (at moderate scale to limit memory use)
  const viewport = page.getViewport({ scale: 1.2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  let cropResult = null;

  try {
    const OPS = pdfjsLib.OPS;
    if (!OPS || !OPS.paintImageXObject) throw new Error('OPS unavailable');

    const opList = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack = [];
    const imageRects = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS.save) {
        ctmStack.push([...ctm]);
      } else if (fn === OPS.restore) {
        if (ctmStack.length) ctm = ctmStack.pop();
      } else if (fn === OPS.transform) {
        const [a, b, c, d, e, f] = args;
        ctm = [
          ctm[0]*a + ctm[2]*b, ctm[1]*a + ctm[3]*b,
          ctm[0]*c + ctm[2]*d, ctm[1]*c + ctm[3]*d,
          ctm[0]*e + ctm[2]*f + ctm[4], ctm[1]*e + ctm[3]*f + ctm[5],
        ];
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const pts = [[0,0],[1,0],[0,1],[1,1]].map(([x, y]) => [
          ctm[0]*x + ctm[2]*y + ctm[4],
          ctm[1]*x + ctm[3]*y + ctm[5],
        ]);
        const xs = pts.map(p => p[0]);
        const ys = pts.map(p => p[1]);
        imageRects.push({
          x: Math.min(...xs), y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
        });
      }
    }

    if (imageRects.length > 0) {
      const largest = imageRects.reduce((best, r) => r.w * r.h > best.w * best.h ? r : best);
      const [vsx, vshx, vshy, vsy, vtx, vty] = viewport.transform;
      const toPx = (px, py) => [vsx*px + vshx*py + vtx, vshy*px + vsy*py + vty];
      const corners = [
        toPx(largest.x, largest.y),
        toPx(largest.x + largest.w, largest.y),
        toPx(largest.x, largest.y + largest.h),
        toPx(largest.x + largest.w, largest.y + largest.h),
      ];
      const cxs = corners.map(c => c[0]);
      const cys = corners.map(c => c[1]);
      const pad = 8;
      const cx = Math.max(0, Math.round(Math.min(...cxs) - pad));
      const cy = Math.max(0, Math.round(Math.min(...cys) - pad));
      const cw = Math.min(canvas.width, Math.round(Math.max(...cxs) + pad)) - cx;
      const ch = Math.min(canvas.height, Math.round(Math.max(...cys) + pad)) - cy;

      if (cw >= 30 && ch >= 30) {
        const out = document.createElement('canvas');
        out.width = cw;
        out.height = ch;
        out.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
        cropResult = out.toDataURL('image/jpeg', 0.85);
      }
    }
  } catch { /* fall through to full-page thumbnail */ }

  if (cropResult) return cropResult;

  // Fallback: thumbnail the whole page
  const MAX = 600;
  const ratio = Math.min(MAX / canvas.width, MAX / canvas.height, 1);
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * ratio);
  out.height = Math.round(canvas.height * ratio);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.7);
}

export async function renderPDFPage(file, pageNum) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function generateFlashcards(text) {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 30);

  const cards = [];

  for (let i = 0; i < sentences.length && cards.length < 20; i++) {
    const sentence = sentences[i];
    const words = sentence.split(' ').filter(w => w.length > 4);
    if (words.length === 0) continue;

    const keywordIndex = Math.floor(words.length / 2);
    const keyword = words[keywordIndex];
    const blank = sentence.replace(new RegExp(`\\b${keyword}\\b`, 'i'), '_____');

    if (blank !== sentence) {
      cards.push({
        id: i,
        front: blank + '?',
        back: keyword,
        context: sentence,
      });
    }
  }

  const colonPhrases = text.match(/([^.!?\n]+):\s*([^.!?\n]+)/g) || [];
  colonPhrases.forEach((phrase, i) => {
    const [term, definition] = phrase.split(':').map(s => s.trim());
    if (term && definition && term.length < 60) {
      cards.push({
        id: 1000 + i,
        front: `¿Qué es ${term}?`,
        back: definition,
        context: phrase,
      });
    }
  });

  return cards.slice(0, 20);
}

export function generateQuestions(text) {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 40);

  const questions = [];

  sentences.forEach((sentence, i) => {
    if (questions.length >= 15) return;

    const words = sentence.split(' ');
    const keyWord = words.find(w => w.length > 5 && /^[A-ZÁÉÍÓÚ]/.test(w) && w !== words[0]);

    if (keyWord) {
      const options = generateFakeOptions(keyWord, text);
      if (options.length >= 3) {
        const allOptions = shuffle([keyWord, ...options.slice(0, 3)]);
        questions.push({
          id: i,
          question: sentence.replace(new RegExp(`\\b${keyWord}\\b`), '_____'),
          options: allOptions,
          correct: keyWord,
        });
      }
    }
  });

  return questions.slice(0, 10);
}

function generateFakeOptions(correct, text) {
  const words = text
    .split(/\W+/)
    .filter(w => w.length > 4 && w !== correct && /^[A-ZÁÉÍÓÚÑ]/i.test(w));
  const unique = [...new Set(words)].filter(w => w.toLowerCase() !== correct.toLowerCase());
  return shuffle(unique).slice(0, 3);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function generateConceptMap(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const nodes = [];
  const edges = [];

  let mainTopic = '';
  const headers = lines.filter(l => /^#{1,3}\s/.test(l) || (l.trim() && l.trim().length < 50 && !l.includes('.')));

  if (headers.length > 0) {
    mainTopic = headers[0].replace(/^#+\s/, '').trim();
    nodes.push({ id: 0, label: mainTopic, type: 'main', x: 400, y: 60 });

    const subTopics = headers.slice(1, 7);
    const radius = 180;
    subTopics.forEach((header, i) => {
      const angle = (i / subTopics.length) * 2 * Math.PI - Math.PI / 2;
      const label = header.replace(/^#+\s/, '').trim();
      nodes.push({
        id: i + 1,
        label: label.length > 30 ? label.substring(0, 30) + '...' : label,
        type: 'sub',
        x: 400 + Math.cos(angle) * radius,
        y: 280 + Math.sin(angle) * radius,
      });
      edges.push({ from: 0, to: i + 1 });
    });
  } else {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 8);
    sentences.forEach((s, i) => {
      const label = s.trim().split(' ').slice(0, 5).join(' ');
      nodes.push({ id: i, label, type: i === 0 ? 'main' : 'sub', x: 400 + (i % 3 - 1) * 200, y: 60 + Math.floor(i / 3) * 160 });
      if (i > 0) edges.push({ from: 0, to: i });
    });
  }

  return { nodes, edges, title: mainTopic };
}
