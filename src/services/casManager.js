// src/services/casManager.js
// Promise-based wrapper around the Pyodide Web Worker.
// All analysis results are persisted in IndexedDB so they load instantly
// on subsequent visits — the 20 MB WASM download only happens once per CDN cache.

import { casCache } from './casCache'; // ← local IndexedDB, not Firebase

let worker = null;
let messageId = 0;
const pending = new Map();

// 'idle' | 'loading' | 'ready' | 'error'
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

  worker = new Worker(new URL('../workers/cas.worker.js', import.meta.url), {
    type: 'classic',
  });

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

  worker.onerror = () => setStatus('error');

  return worker;
}

/** Wait until the worker is ready (resolves immediately if already ready). */
function waitReady(timeoutMs = 45_000) {
  if (_status === 'ready') return Promise.resolve();
  if (_status === 'error') return Promise.reject(new Error('CAS failed to load'));

  // Kick off load if not started yet
  if (_status === 'idle') getWorker();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('CAS load timeout'));
    }, timeoutMs);

    const unsub = onCASStatus((s) => {
      if (s === 'ready') { clearTimeout(timer); unsub(); resolve(); }
      if (s === 'error') { clearTimeout(timer); unsub(); reject(new Error('CAS load failed')); }
    });
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const cas = {
  /** Boot the worker early (call on page mount so it loads in the background). */
  preload() {
    if (_status === 'idle') getWorker();
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
    const cached = await casCache.get(cacheKey);
    if (cached && !cached.error) return cached;

    // 2. Wait for Pyodide (may already be ready)
    try {
      await waitReady();
    } catch {
      return null; // CAS unavailable — caller falls back to numeric
    }

    // 3. Send to worker
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, expr, variable, mode });
    })
      .then(async (result) => {
        if (!result.error) await casCache.set(cacheKey, result);
        return result;
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') console.warn('[CAS] Pyodide fallback triggered:', err);
        return null; // Safe fallback to numeric-only mode
      });
  },

  kill() {
    if (worker) {
      worker.terminate();
      worker = null;
      setStatus('idle');
    }
  },
};