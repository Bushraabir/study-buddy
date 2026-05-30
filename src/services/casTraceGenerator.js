// src/services/casTraceGenerator.js
// Drop-in replacement for the generateExplicit function in PlotGraph.jsx.
// When meta is provided (from useEquationCAS), it:
//   • Inserts null gaps at vertical asymptotes (clean breaks instead of spikes)
//   • Draws dashed asymptote reference lines
//   • Draws critical-point markers (▲ max / ▼ min)
//   • Draws horizontal asymptote reference lines
// When meta is null or from numeric source, it degrades gracefully.

import * as math from 'mathjs';

function safeEval(expr, scope) {
  try {
    const v = math.evaluate(expr, scope);
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.warn('[StudyBuddy] Non-blocking math error:', err);
    return null;
  }
}

/**
 * @param {object} eq        — equation object {expression, color, lineWidth, lineStyle, label, ...}
 * @param {object} settings  — {xMin, xMax, yMin, yMax}
 * @param {object} vars      — current variable values
 * @param {object|null} meta — output of useEquationCAS (may be numeric or SymPy)
 * @returns {Array}  Plotly trace objects
 */
export function generateExplicitWithCAS(eq, settings, vars, meta) {
  const { xMin, xMax, yMin, yMax } = settings;
  const n = 2000;
  const step = (xMax - xMin) / (n - 1);
  const xs = [], ys = [];

  // Build exclusion zones around known vertical asymptotes
  const asymptotes = meta?.verticalAsymptotes ?? [];
  const exclusionRadius = step * 2;

  for (let i = 0; i < n; i++) {
    const x = xMin + i * step;

    // Is this x within 2 steps of a known asymptote?
    const nearAsym = asymptotes.some(a => Math.abs(x - a) < exclusionRadius);
    if (nearAsym) {
      xs.push(x);
      ys.push(null); // null → Plotly breaks the line cleanly
      continue;
    }

    const y = safeEval(eq.expression, { x, ...vars });
    xs.push(x);
    ys.push(y);
  }

  const dash =
    eq.lineStyle === 'dashed' ? 'dash'
    : eq.lineStyle === 'dotted' ? 'dot'
    : 'solid';

  const traces = [
    {
      x: xs,
      y: ys,
      mode: 'lines',
      type: 'scatter',
      name: eq.label || eq.expression,
      line: { color: eq.color, width: eq.lineWidth ?? 2.5, dash },
      visible: eq.visible ? true : 'legendonly',
      connectgaps: false,
      hovertemplate: `<b>${eq.label || eq.expression}</b><br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>`,
    },
  ];

  if (!meta) return traces;

  // ── Vertical asymptote reference lines ──────────────────────────────────
  asymptotes.forEach(a => {
    if (a < xMin || a > xMax) return;
    traces.push({
      x: [a, a],
      y: [yMin, yMax],
      mode: 'lines',
      type: 'scatter',
      name: `x=${a}`,
      line: { color: '#ef4444', width: 1, dash: 'dash' },
      opacity: 0.55,
      showlegend: false,
      hoverinfo: 'name',
    });
  });

  // ── Horizontal asymptote reference lines ────────────────────────────────
  (meta.horizontalAsymptotes ?? []).forEach(h => {
    if (h.y < yMin || h.y > yMax) return;
    traces.push({
      x: [xMin, xMax],
      y: [h.y, h.y],
      mode: 'lines',
      type: 'scatter',
      name: `y=${h.y}`,
      line: { color: '#f59e0b', width: 1, dash: 'dash' },
      opacity: 0.5,
      showlegend: false,
      hoverinfo: 'name',
    });
  });

  // ── Critical point markers ───────────────────────────────────────────────
  const cps = (meta.criticalPoints ?? []).filter(p => p.x >= xMin && p.x <= xMax);

  if (cps.length > 0) {
    // Distinguish max vs min using a very small neighbourhood
    const maxima = cps.filter(p => {
      const yL = safeEval(eq.expression, { x: p.x - 0.02, ...vars });
      const yR = safeEval(eq.expression, { x: p.x + 0.02, ...vars });
      return yL !== null && yR !== null && yL < p.y && yR < p.y;
    });
    const minima = cps.filter(p => {
      const yL = safeEval(eq.expression, { x: p.x - 0.02, ...vars });
      const yR = safeEval(eq.expression, { x: p.x + 0.02, ...vars });
      return yL !== null && yR !== null && yL > p.y && yR > p.y;
    });

    if (maxima.length > 0)
      traces.push({
        x: maxima.map(p => p.x),
        y: maxima.map(p => p.y),
        mode: 'markers',
        type: 'scatter',
        name: 'Local Max',
        marker: {
          color: '#4ade80',
          size: 8,
          symbol: 'triangle-up',
          line: { color: '#fff', width: 1 },
        },
        hovertemplate: 'Max (%{x:.3f}, %{y:.3f})<extra></extra>',
        showlegend: false,
      });

    if (minima.length > 0)
      traces.push({
        x: minima.map(p => p.x),
        y: minima.map(p => p.y),
        mode: 'markers',
        type: 'scatter',
        name: 'Local Min',
        marker: {
          color: '#f87171',
          size: 8,
          symbol: 'triangle-down',
          line: { color: '#fff', width: 1 },
        },
        hovertemplate: 'Min (%{x:.3f}, %{y:.3f})<extra></extra>',
        showlegend: false,
      });
  }

  return traces;
}