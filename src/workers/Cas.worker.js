// src/services/casManager.js
// Promise-based wrapper around the Pyodide Web Worker.
// All analysis results are persisted in IndexedDB so they load instantly
// on subsequent visits — the 20 MB WASM download only happens once per CDN cache.

import { casCache } from './casCache'; // ← local IndexedDB, not Firebase

// ─── 1. Environment guards (safe for Vite, Webpack, Next.js, and SSR) ─────
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isDev = (() => {
  try {
    return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
  } catch {
    return false;
  }
})();

let worker = null;
let messageId = 0;
const pending = new Map();

// 'idle' | 'loading' | 'ready' | 'error' | 'unsupported'
let _status = 'idle';
const _statusListeners = new Set();

function setStatus(s, pct) {
  _status = s;
  _statusListeners.forEach(fn => fn(s, pct));
}

/** Subscribe to status changes. Returns an unsubscribe fn. */
export function onCASStatus(fn) {
  _statusListeners.add(fn);
  fn(_status); // fire immediately with current value
  return () => _statusListeners.delete(fn);
}

export function getCASStatus() {
  return _status;
}

/** Lazily boot the worker. Safe to call multiple times. */
function getWorker() {
  if (worker) return worker;

  // ─── 2. Guard: Workers are browser-only ─────────────────────────────────
  if (!isBrowser || typeof Worker === 'undefined') {
    setStatus('unsupported');
    return null;
  }

  // ─── 3. Guard: Worker instantiation can fail if the file is missing ────
  try {
    // FIX: filename must match exactly: Cas.worker.js (capital C)
    worker = new Worker(new URL('../workers/Cas.worker.js', import.meta.url), {
      type: 'classic',
    });
  } catch (err) {
    if (isDev) console.warn('[CAS] Worker instantiation failed:', err);
    setStatus('error');
    return null;
  }

  setStatus('loading');

  worker.onmessage = (e) => {
    const { id, type, result, error, pct } = e.data;

    if (type === 'ready') {
      setStatus('ready');
      return;
    }

    if (type === 'progress') {
      // Broadcast progress so spinner can show a bar
      _statusListeners.forEach(fn => fn('loading', pct));
      return;
    }

    if (type === 'error' && id === undefined) {
      setStatus('error');
      return;
    }

    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);

    if (type === 'success') p.resolve(result);
    else p.reject(new Error(error));
  };

  worker.onerror = (err) => {
    if (isDev) console.warn('[CAS] Worker runtime error:', err);
    setStatus('error');
  };

  worker.onmessageerror = (err) => {
    if (isDev) console.warn('[CAS] Worker message error:', err);
    setStatus('error');
  };

  return worker;
}

/** Wait until the worker is ready (resolves immediately if already ready). */
function waitReady(timeoutMs = 45_000) {
  if (_status === 'ready') return Promise.resolve();
  if (_status === 'error' || _status === 'unsupported') {
    return Promise.reject(new Error('CAS failed to load'));
  }

  // Kick off load if not started yet
  if (_status === 'idle') getWorker();

  // If getWorker() returned null (SSR / unsupported), fail fast
  if (!worker) {
    setStatus('unsupported');
    return Promise.reject(new Error('CAS not available in this environment'));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('CAS load timeout'));
    }, timeoutMs);

    const unsub = onCASStatus((s) => {
      if (s === 'ready') { clearTimeout(timer); unsub(); resolve(); }
      if (s === 'error' || s === 'unsupported') {
        clearTimeout(timer); unsub(); reject(new Error('CAS load failed'));
      }
    });
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const cas = {
  /** Boot the worker early (call on page mount so it loads in the background). */
  preload() {
    if (_status === 'idle' && isBrowser) getWorker();
  },

  /** Return current status string. */
  get status() {
    return _status;
  },

  /**
   * Analyse an expression.
   * Returns the CAS metadata object, or null if Pyodide fails.
   * Results are cached in IndexedDB keyed by (mode + variable + expr).
   */
  async analyze(expr, mode = 'analyze2D', variable = 'x') {
    const cacheKey = `cas|${mode}|${variable}|${expr}`;

    // 1. Check persistent cache first (instant)
    try {
      const cached = await casCache.get(cacheKey);
      if (cached && !cached.error) return cached;
    } catch (err) {
      if (isDev) console.warn('[CAS] Cache read failed:', err);
    }

    // 2. Wait for Pyodide (may already be ready)
    try {
      await waitReady();
    } catch {
      return null; // CAS unavailable — caller falls back to numeric
    }

    // 3. Send to worker
    const w = getWorker();
    if (!w) return null; // Defensive: worker died or is unsupported

    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pending.set(id, { resolve, reject });
      w.postMessage({ id, expr, variable, mode });
    })
      .then(async (result) => {
        if (!result.error) {
          try {
            await casCache.set(cacheKey, result);
          } catch (err) {
            if (isDev) console.warn('[CAS] Cache write failed:', err);
          }
        }
        return result;
      })
      .catch((err) => {
        if (isDev) console.warn('[CAS] Pyodide fallback triggered:', err);
        return null; // Safe fallback to numeric-only mode
      });
  },

  kill() {
    if (worker) {
      try {
        worker.terminate();
      } catch (err) {
        if (isDev) console.warn('[CAS] Worker terminate failed:', err);
      }
      worker = null;
      setStatus('idle');
    }
  },
};