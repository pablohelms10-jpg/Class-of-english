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
