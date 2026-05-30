// src/services/casManager.js
// Promise-based wrapper around the Pyodide Web Worker.

import { casCache } from './casCache';

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

let _status = 'idle';
const _statusListeners = new Set();

function setStatus(s, pct) {
  _status = s;
  _statusListeners.forEach(fn => fn(s, pct));
}

export function onCASStatus(fn) {
  _statusListeners.add(fn);
  fn(_status);
  return () => _statusListeners.delete(fn);
}

export function getCASStatus() {
  return _status;
}

function getWorker() {
  if (worker) return worker;
  if (!isBrowser || typeof Worker === 'undefined') {
    setStatus('unsupported');
    return null;
  }

  try {
    // FIX: Capital C — must match your actual filename exactly
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

function waitReady(timeoutMs = 45_000) {
  if (_status === 'ready') return Promise.resolve();
  if (_status === 'error' || _status === 'unsupported') {
    return Promise.reject(new Error('CAS failed to load'));
  }
  if (_status === 'idle') getWorker();
  if (!worker) {
    setStatus('unsupported');
    return Promise.reject(new Error('CAS not available'));
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

export const cas = {
  preload() {
    if (_status === 'idle' && isBrowser) getWorker();
  },

  get status() {
    return _status;
  },

  async analyze(expr, mode = 'analyze2D', variable = 'x') {
    const cacheKey = `cas|${mode}|${variable}|${expr}`;

    try {
      const cached = await casCache.get(cacheKey);
      if (cached && !cached.error) return cached;
    } catch (err) {
      if (isDev) console.warn('[CAS] Cache read failed:', err);
    }

    try {
      await waitReady();
    } catch {
      return null;
    }

    const w = getWorker();
    if (!w) return null;

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
        if (isDev) console.warn('[CAS] Pyodide fallback:', err);
        return null;
      });
  },

  kill() {
    if (worker) {
      try {
        worker.terminate();
      } catch {}
      worker = null;
      setStatus('idle');
    }
  },
};