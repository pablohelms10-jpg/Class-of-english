import React, { createContext, useContext, useState } from 'react';

const MilaContext = createContext();

export function MilaProvider({ children }) {
  const [summaries, setSummaries] = useState([]);
  const [activeSummary, setActiveSummary] = useState(null);
  const [activeMode, setActiveMode] = useState(null);

  function addSummary(summary) {
    const newSummary = {
      id: Date.now(),
      createdAt: new Date(),
      ...summary,
    };
    setSummaries(prev => [newSummary, ...prev]);
    return newSummary;
  }

  function deleteSummary(id) {
    setSummaries(prev => prev.filter(s => s.id !== id));
    if (activeSummary?.id === id) setActiveSummary(null);
  }

  return (
    <MilaContext.Provider value={{
      summaries,
      activeSummary,
      setActiveSummary,
      activeMode,
      setActiveMode,
      addSummary,
      deleteSummary,
    }}>
      {children}
    </MilaContext.Provider>
  );
}

export function useMila() {
  return useContext(MilaContext);
}
