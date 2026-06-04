import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

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

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [authError, setAuthError] = useState('');

  // Per-summary debounce timers: Map of summaryId -> timeoutId
  const upsertTimers = useRef({});

  // ── Persist dark mode ──────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('mila_dark', JSON.stringify(darkMode));
    if (darkMode) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  }, [darkMode]);

  // ── Supabase auth bootstrap ────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadCloudSummaries(u.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadCloudSummaries(u.id);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load summaries from Supabase ───────────────────────────────────────
  async function loadCloudSummaries(userId) {
    const { data, error } = await supabase
      .from('summaries')
      .select('id, data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) { console.error('[MILA] Supabase load error:', error); return; }

    if (data && data.length > 0) {
      const cloud = data.map(row => row.data);
      setSummaries(cloud);
      localStorage.setItem('mila_summaries', JSON.stringify(cloud));
    } else {
      // First login: migrate any local summaries to the cloud
      const local = loadFromStorage('mila_summaries', []);
      if (local.length > 0) {
        const rows = local.map(s => ({ id: String(s.id), user_id: userId, data: s }));
        await supabase.from('summaries').upsert(rows, { onConflict: 'id' });
      }
    }
  }

  // ── Upsert one summary to Supabase (debounced 2 s per summary) ─────────
  function scheduleUpsert(summary, userId) {
    if (!supabase || !userId) return;
    const id = String(summary.id);
    clearTimeout(upsertTimers.current[id]);
    upsertTimers.current[id] = setTimeout(async () => {
      const { error } = await supabase
        .from('summaries')
        .upsert({ id, user_id: userId, data: summary }, { onConflict: 'id' });
      if (error) console.error('[MILA] Supabase upsert error:', error);
    }, 2000);
  }

  // ── Context functions ──────────────────────────────────────────────────
  function toggleDark() { setDarkMode(d => !d); }

  function addSummary(summary) {
    const newSummary = { id: Date.now(), createdAt: new Date(), ...summary };
    setSummaries(prev => {
      const next = [newSummary, ...prev];
      localStorage.setItem('mila_summaries', JSON.stringify(next));
      return next;
    });
    // Immediate upsert for new summaries (user intent, not continuous updates)
    if (supabase && user) {
      supabase.from('summaries')
        .upsert({ id: String(newSummary.id), user_id: user.id, data: newSummary }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.error('[MILA] Supabase insert error:', error); });
    }
    return newSummary;
  }

  function updateSummary(id, changes) {
    let updated;
    setSummaries(prev => {
      const next = prev.map(s => {
        if (s.id !== id) return s;
        updated = { ...s, ...changes };
        return updated;
      });
      localStorage.setItem('mila_summaries', JSON.stringify(next));
      return next;
    });
    setActiveSummary(prev => prev?.id === id ? { ...prev, ...changes } : prev);
    // Debounce cloud sync — avoids hammering Supabase during drag/generation
    if (user && updated) scheduleUpsert(updated, user.id);
  }

  function deleteSummary(id) {
    setSummaries(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('mila_summaries', JSON.stringify(next));
      return next;
    });
    if (activeSummary?.id === id) setActiveSummary(null);
    if (supabase && user) {
      supabase.from('summaries').delete().eq('id', String(id))
        .then(({ error }) => { if (error) console.error('[MILA] Supabase delete error:', error); });
    }
  }

  // ── Auth helpers ───────────────────────────────────────────────────────
  async function signIn(email, password) {
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function signUp(email, password) {
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else setAuthError('__confirm__'); // signal to show "check your email"
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSummaries([]);
    setActiveSummary(null);
    localStorage.removeItem('mila_summaries');
  }

  return (
    <MilaContext.Provider value={{
      summaries, activeSummary, setActiveSummary,
      activeMode, setActiveMode,
      addSummary, updateSummary, deleteSummary,
      darkMode, toggleDark,
      user, authLoading, authError, setAuthError,
      signIn, signUp, signOut,
      supabaseEnabled: !!supabase,
    }}>
      {children}
    </MilaContext.Provider>
  );
}

export function useMila() { return useContext(MilaContext); }
