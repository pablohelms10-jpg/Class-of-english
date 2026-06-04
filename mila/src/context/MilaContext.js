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
  const [syncError, setSyncError] = useState(''); // '' | 'error' | 'ok'

  // Per-summary debounce timers
  const upsertTimers = useRef({});

  // ── Persist summaries to localStorage (effect, not inside state updater) ─
  useEffect(() => {
    // Always save images separately so they survive Supabase sync overwrites
    summaries.forEach(s => { if (s.images) saveImages(s.id, s.images); });
    saveToStorage('mila_summaries', summaries);
  }, [summaries]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const local = loadFromStorage('mila_summaries', []);

    try {
      const { data, error } = await supabase
        .from('summaries')
        .select('id, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MILA] Supabase load error:', error);
        // Fallback: keep localStorage data
        if (local.length > 0) setSummaries(local);
        return;
      }

      if (data && data.length > 0) {
        // Cloud has data — merge with local images and use as source of truth
        const cloud = data.map(row => mergeImages(row.data));
        setSummaries(cloud);
      } else {
        // No cloud data — migrate local summaries to cloud
        if (local.length > 0) {
          local.forEach(s => { if (s.images) saveImages(s.id, s.images); });
          const rows = local.map(s => ({
            id: String(s.id),
            user_id: userId,
            data: stripImages(s),
          }));
          const { error: upsertErr } = await supabase
            .from('summaries')
            .upsert(rows, { onConflict: 'id' });
          if (upsertErr) console.error('[MILA] Migration upsert error:', upsertErr);
          // Always keep showing local data regardless of upsert result
          setSummaries(local);
        }
      }
    } catch (e) {
      console.error('[MILA] loadCloudSummaries error:', e);
      if (local.length > 0) setSummaries(local);
    }
  }

  // ── Upsert a summary to Supabase with retry ───────────────────────────
  async function doUpsert(id, userId, payload) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { error } = await supabase
          .from('summaries')
          .upsert({ id: String(id), user_id: userId, data: payload }, { onConflict: 'id' });
        if (!error) { setSyncError('ok'); return true; }
        console.error(`[MILA] Supabase upsert error (attempt ${attempt + 1}):`, error);
        setSyncError('error');
      } catch (e) {
        console.error(`[MILA] Supabase upsert exception (attempt ${attempt + 1}):`, e);
        setSyncError('error');
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
    return false;
  }

  // ── Upsert one summary to Supabase (debounced 2 s, no images) ─────────
  function scheduleUpsert(summary, userId) {
    if (!supabase || !userId) return;
    const id = String(summary.id);
    clearTimeout(upsertTimers.current[id]);
    upsertTimers.current[id] = setTimeout(() => {
      doUpsert(id, userId, stripImages(summary));
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
      doUpsert(newSummary.id, user.id, stripImages(newSummary));
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
      syncError,
      supabaseEnabled: !!supabase,
    }}>
      {children}
    </MilaContext.Provider>
  );
}

export function useMila() { return useContext(MilaContext); }
