// src/hooks/useCAS.js
// Two hooks:
//
//   useCAS()              — global CAS status + analyze fn.
//                           Call once at the page level; preloads the worker.
//
//   useEquationCAS(expr, type, variable)
//                         — reactive: re-runs analysis when expr changes.
//                           Follows the "fast-first" strategy:
//                           1. Returns numeric meta immediately.
//                           2. Upgrades to full SymPy meta when Pyodide finishes.

import { useState, useEffect, useCallback, useRef } from 'react';
import { cas, onCASStatus } from '../services/casManager';
import * as math from 'mathjs';

// ─── useCAS ─────────────────────────────────────────────────────────────────
export function useCAS() {
  const [status, setStatus] = useState(cas.status);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Preload immediately — worker starts downloading in background
    cas.preload();

    const unsub = onCASStatus((s, pct) => {
      setStatus(s);
      if (pct !== undefined) setProgress(pct);
    });
    return unsub;
  }, []);

  const analyze = useCallback(
    (expr, mode, variable) => cas.analyze(expr, mode, variable),
    []
  );

  return { status, progress, analyze, isReady: status === 'ready' };
}

// ─── Fast numeric fallback ───────────────────────────────────────────────────
// Runs synchronously in JS so the graph is useful before Pyodide loads.
function numericFallback(expr, type) {
  if (type !== 'explicit' && type !== 'complex') return null;

  const cleanExpr = expr.replace(/^\s*[yz]\s*=\s*/i, '').trim();

  try {
    const compiled = math.compile(cleanExpr);
    const safeEval = (xv) => {
      try {
        const v = compiled.evaluate({ x: xv });
        return typeof v === 'number' && isFinite(v) ? v : null;
      } catch {
        if (process.env.NODE_ENV === 'development') {
          // suppress noise
        }
        return null;
      }
    };

    // ── Detect rough vertical asymptotes (sign-flip + large jump) ──
    const xs = Array.from({ length: 400 }, (_, i) => -10 + i * 0.05);
    const verticalAsymptotes = [];
    let prevY = safeEval(xs[0]);

    for (let i = 1; i < xs.length; i++) {
      const y = safeEval(xs[i]);
      if (prevY !== null && y !== null) {
        const jump = Math.abs(y - prevY);
        if (jump > 80 && Math.sign(y) !== Math.sign(prevY)) {
          verticalAsymptotes.push(+((xs[i - 1] + xs[i]) / 2).toFixed(3));
        }
      }
      prevY = y;
    }

    // ── Y-intercept ──
    let yIntercept = null;
    try { yIntercept = safeEval(0); } catch {}

    // ── Quick symmetry check ──
    let symmetry = 'none';
    try {
      const samples = [-3, -2, -1, 1, 2, 3];
      const even = samples.every(v => {
        const a = safeEval(v), b = safeEval(-v);
        return a !== null && b !== null && Math.abs(a - b) < 1e-6;
      });
      const odd = samples.every(v => {
        const a = safeEval(v), b = safeEval(-v);
        return a !== null && b !== null && Math.abs(a + b) < 1e-6;
      });
      symmetry = even ? 'even' : odd ? 'odd' : 'none';
    } catch {}

    // ── Critical points (sign change in numerical derivative) ──
    const criticalPoints = [];
    let prevD = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const y1 = safeEval(xs[i]);
      const y2 = safeEval(xs[i + 1]);
      if (y1 !== null && y2 !== null) {
        const d = (y2 - y1) / 0.05;
        if (prevD !== null && Math.sign(d) !== Math.sign(prevD)) {
          const xc = xs[i];
          const yc = safeEval(xc);
          if (yc !== null && Math.abs(yc) < 50) {
            criticalPoints.push({ x: +xc.toFixed(3), y: +yc.toFixed(3) });
          }
        }
        prevD = d;
      }
    }

    return {
      _source: 'numeric',
      verticalAsymptotes,
      horizontalAsymptotes: [],
      criticalPoints: criticalPoints.slice(0, 10),
      symmetry,
      intercepts: { y: yIntercept, x: [] },
      domain: 'Reals',
      period: null,
      simplified: null,
      derivative: null,
    };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.warn('[StudyBuddy] Non-blocking math error:', err);
    return null;
  }
}

// ─── useEquationCAS ──────────────────────────────────────────────────────────
export function useEquationCAS(expression, type, variable = 'x') {
  const { analyze, isReady } = useCAS();

  // meta always has a value: starts as numeric fallback, upgrades to SymPy
  const [meta, setMeta] = useState(() => numericFallback(expression, type));
  const [loading, setLoading] = useState(false);
  const [upgraded, setUpgraded] = useState(false); // true once SymPy result is in

  const exprRef = useRef(expression);

  // Re-run numeric fallback synchronously when expression changes
  useEffect(() => {
    exprRef.current = expression;
    setMeta(numericFallback(expression, type));
    setUpgraded(false);
  }, [expression, type]);

  // When Pyodide becomes ready (or expression changes after it's ready),
  // fire the full SymPy analysis and update the meta in-place
  useEffect(() => {
    if (!isReady || !expression) return;
    const mode = type === 'surface' || type === 'implicit' ? 'analyze3D' : 'analyze2D';

    let cancelled = false;
    setLoading(true);

    analyze(expression, mode, variable)
      .then(result => {
        if (cancelled || exprRef.current !== expression) return;
        if (result && !result.error) {
          setMeta({ ...result, _source: 'sympy' });
          setUpgraded(true);
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') console.warn('[StudyBuddy] Silent catch:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [expression, type, isReady, analyze, variable]);

  return { meta, loading, upgraded };
}