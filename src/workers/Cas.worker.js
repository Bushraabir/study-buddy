// src/workers/Cas.worker.js
self.postMessage({ type: 'ready' });

self.onmessage = (e) => {
  const { id, expr, variable, mode } = e.data;
  if (!id) {
    self.postMessage({ type: 'error', error: 'Missing id' });
    return;
  }
  self.postMessage({
    id,
    type: 'success',
    result: {
      error: null,
      verticalAsymptotes: [],
      horizontalAsymptotes: [],
      criticalPoints: [],
    },
  });
};