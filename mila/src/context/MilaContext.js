import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

const MilaContext = createContext();

function loadFromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
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

  // Per-summary debounce timers
  const upsertTimers = useRef({});

  // ── Persist summaries to localStorage (effect, not inside state updater) ─
  useEffect(() => {
    saveToStorage('mila_summaries', summaries);
  }, [summaries]);

  // ── Persist dark mode ──────────────────────────────────────────────────
  useEffect(() => {
    saveToStorage('mila_dark', darkMode);
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

  // ── Images stay in localStorage only (too large for Supabase JSONB) ───
  function saveImages(summaryId, images) {
    if (!images) return;
    try { localStorage.setItem(`mila_images_${summaryId}`, JSON.stringify(images)); } catch { /* quota */ }
  }

  function loadImages(summaryId) {
    try {
      const v = localStorage.getItem(`mila_images_${summaryId}`);
      return v ? JSON.parse(v) : undefined;
    } catch { return undefined; }
  }

  function removeImages(summaryId) {
    try { localStorage.removeItem(`mila_images_${summaryId}`); } catch { /* ignore */ }
  }

  function stripImages(summary) {
    const { images, ...rest } = summary; // eslint-disable-line no-unused-vars
    return rest;
  }

  function mergeImages(summary) {
    const images = loadImages(summary.id);
    return images ? { ...summary, images } : summary;
  }

  // ── Load summaries from Supabase ───────────────────────────────────────
  async function loadCloudSummaries(userId) {
    try {
      const { data, error } = await supabase
        .from('summaries')
        .select('id, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) { console.error('[MILA] Supabase load error:', error); return; }

      if (data && data.length > 0) {
        // Merge cloud metadata with locally-stored images
        const cloud = data.map(row => mergeImages(row.data));
        setSummaries(cloud);
      } else {
        // First login: migrate local summaries to cloud (without images)
        const local = loadFromStorage('mila_summaries', []);
        if (local.length > 0) {
          // Save images locally keyed by id, then upsert stripped data
          local.forEach(s => { if (s.images) saveImages(s.id, s.images); });
          const rows = local.map(s => ({ id: String(s.id), user_id: userId, data: stripImages(s) }));
          const { error: upsertErr } = await supabase.from('summaries').upsert(rows, { onConflict: 'id' });
          if (upsertErr) console.error('[MILA] Migration upsert error:', upsertErr);
        }
      }
    } catch (e) {
      console.error('[MILA] loadCloudSummaries error:', e);
    }
  }

  // ── Upsert one summary to Supabase (debounced 2 s, no images) ─────────
  function scheduleUpsert(summary, userId) {
    if (!supabase || !userId) return;
    const id = String(summary.id);
    clearTimeout(upsertTimers.current[id]);
    upsertTimers.current[id] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('summaries')
          .upsert({ id, user_id: userId, data: stripImages(summary) }, { onConflict: 'id' });
        if (error) console.error('[MILA] Supabase upsert error:', error);
      } catch (e) {
        console.error('[MILA] Supabase upsert exception:', e);
      }
    }, 2000);
  }

  // ── Context functions ──────────────────────────────────────────────────
  function toggleDark() { setDarkMode(d => !d); }

  function addSummary(summary) {
    const newSummary = { id: Date.now(), createdAt: new Date(), ...summary };
    // Persist images locally (too large for Supabase)
    if (newSummary.images) saveImages(newSummary.id, newSummary.images);
    setSummaries(prev => [newSummary, ...prev]);
    // Immediate cloud upsert (without images)
    if (supabase && user) {
      supabase.from('summaries')
        .upsert({ id: String(newSummary.id), user_id: user.id, data: stripImages(newSummary) }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.error('[MILA] Supabase insert error:', error); })
        .catch(e => console.error('[MILA] Supabase insert exception:', e));
    }
    return newSummary;
  }

  function updateSummary(id, changes) {
    let updated;
    setSummaries(prev => prev.map(s => {
      if (s.id !== id) return s;
      updated = { ...s, ...changes };
      return updated;
    }));
    setActiveSummary(prev => prev?.id === id ? { ...prev, ...changes } : prev);
    if (user && updated) scheduleUpsert(updated, user.id);
  }

  function deleteSummary(id) {
    setSummaries(prev => prev.filter(s => s.id !== id));
    if (activeSummary?.id === id) setActiveSummary(null);
    removeImages(id);
    if (supabase && user) {
      supabase.from('summaries').delete().eq('id', String(id))
        .then(({ error }) => { if (error) console.error('[MILA] Supabase delete error:', error); })
        .catch(e => console.error('[MILA] Supabase delete exception:', e));
    }
  }

  // ── Auth helpers ───────────────────────────────────────────────────────
  async function signIn(email, password) {
    if (!supabase) return;
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    } catch (e) { setAuthError(e.message); }
  }

  async function signUp(email, password) {
    if (!supabase) return;
    setAuthError('');
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else setAuthError('__confirm__');
    } catch (e) { setAuthError(e.message); }
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
