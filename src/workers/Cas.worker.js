// src/workers/Cas.worker.js
// Web Worker for CAS (SymPy/Pyodide) analysis.
// Runs in an isolated thread and communicates with casManager.js via postMessage.

const isDev = (() => {
  try {
    return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
  } catch {
    return false;
  }
})();

// Tell casManager.js that we are ready
self.postMessage({ type: 'ready' });

self.onmessage = (e) => {
  const { id, expr, variable, mode } = e.data;

  if (!id) {
    self.postMessage({ type: 'error', error: 'Missing message id' });
    return;
  }

  try {
    // TODO: Load Pyodide here and run SymPy analysis
    // For now, return empty metadata so the graph renders without crashing
    const result = {
      error: null,
      verticalAsymptotes: [],
      horizontalAsymptotes: [],
      criticalPoints: [],
      _expr: expr,
      _mode: mode,
      _variable: variable,
    };

    self.postMessage({ id, type: 'success', result });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: err.message || String(err) });
  }
};