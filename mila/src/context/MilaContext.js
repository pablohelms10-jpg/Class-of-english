import React, { createContext, useContext, useState, useEffect } from 'react';

const MilaContext = createContext();

function loadFromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function MilaProvider({ children }) {
  const [summaries, setSummaries] = useState(() => loadFromStorage('mila_summaries', []));
  const [activeSummary, setActiveSummary] = useState(null);
  const [activeMode, setActiveMode] = useState(null);
  const [darkMode, setDarkMode] = useState(() => loadFromStorage('mila_dark', true));

  useEffect(() => {
    localStorage.setItem('mila_summaries', JSON.stringify(summaries));
  }, [summaries]);

  useEffect(() => {
    localStorage.setItem('mila_dark', JSON.stringify(darkMode));
    if (darkMode) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  }, [darkMode]);

  function toggleDark() { setDarkMode(d => !d); }

  function addSummary(summary) {
    const newSummary = { id: Date.now(), createdAt: new Date(), ...summary };
    setSummaries(prev => [newSummary, ...prev]);
    return newSummary;
  }

  function updateSummary(id, changes) {
    setSummaries(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
    // Use functional update to merge into latest state, not stale closure value
    setActiveSummary(prev => prev?.id === id ? { ...prev, ...changes } : prev);
  }

  function deleteSummary(id) {
    setSummaries(prev => prev.filter(s => s.id !== id));
    if (activeSummary?.id === id) setActiveSummary(null);
  }

  return (
    <MilaContext.Provider value={{
      summaries, activeSummary, setActiveSummary,
      activeMode, setActiveMode,
      addSummary, updateSummary, deleteSummary,
      darkMode, toggleDark,
    }}>
      {children}
    </MilaContext.Provider>
  );
}

export function useMila() { return useContext(MilaContext); }
