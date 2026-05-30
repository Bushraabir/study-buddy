/* eslint-disable no-restricted-globals */
// src/workers/cas.worker.js
// Runs Pyodide + SymPy entirely off the main thread.
// Main thread sends:  { id, expr, variable, mode }
// Worker replies with: { id, type: 'success'|'error', result|error }
// Also sends: { type: 'ready' } | { type: 'progress', pct }

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/';

let pyodideReady = false;

async function initPyodide() {
  self.postMessage({ type: 'progress', pct: 10 });
  importScripts(`${PYODIDE_URL}pyodide.js`);
  self.postMessage({ type: 'progress', pct: 30 });

  self.pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  self.postMessage({ type: 'progress', pct: 70 });

  await self.pyodide.loadPackage('sympy');
  self.postMessage({ type: 'progress', pct: 95 });

  pyodideReady = true;
  self.postMessage({ type: 'ready', pct: 100 });
}

initPyodide().catch(err => {
  self.postMessage({ type: 'error', error: err.message });
});

self.onmessage = async (event) => {
  const { id, expr, variable = 'x', mode = 'analyze2D' } = event.data;

  if (!pyodideReady) {
    self.postMessage({ id, type: 'error', error: 'Pyodide not ready yet' });
    return;
  }

  try {
    let result;
    if (mode === 'analyze2D')      result = analyze2D(expr, variable);
    else if (mode === 'analyze3D') result = analyze3D(expr);
    else if (mode === 'simplify')  result = simplifyExpr(expr);
    else                           result = analyze2D(expr, variable);

    self.postMessage({ id, type: 'success', result });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: err.message });
  }
};

// ─── SymPy 2D Analysis ──────────────────────────────────────────────────────
function analyze2D(expr, variable) {
  // Sanitise: replace ^ with ** so mathjs-style input also works
  const safeExpr = expr.replace(/\^/g, '**');

  //  Safely pass string to Pyodide without template injection
  self.pyodide.globals.set('expr_str', safeExpr);
  self.pyodide.globals.set('var_name', variable);

  const script = `
import sympy as sp
import json

x = sp.Symbol(var_name)

try:
    f = sp.sympify(expr_str, locals={'e': sp.E, 'pi': sp.pi})

    # ── Simplification ──────────────────────────────────────────
    simplified = str(sp.simplify(f))

    # ── Derivative ──────────────────────────────────────────────
    df = sp.diff(f, x)

    # ── Critical Points ─────────────────────────────────────────
    critical = []
    try:
        sols = sp.solve(sp.Eq(df, 0), x)
        for s in sols[:8]:  # cap at 8
            if s.is_real and s.is_finite:
                try:
                    yv = float(f.subs(x, s))
                    if abs(yv) < 1e10:
                        critical.append({"x": float(s), "y": round(yv, 6)})
                except:
                    pass
    except:
        pass

    # ── Singularities / Vertical Asymptotes ─────────────────────
    singularities = []
    vertical_asym = []
    try:
        poles = sp.singularities(f, x)
        for p in poles:
            if p.is_real and p.is_finite:
                val = float(p)
                singularities.append(val)
                try:
                    lim_val = sp.limit(f, x, p)
                    if lim_val in [sp.oo, -sp.oo, sp.zoo]:
                        vertical_asym.append(round(val, 6))
                except:
                    vertical_asym.append(round(val, 6))
    except:
        pass

    # ── Horizontal Asymptotes ────────────────────────────────────
    horiz_asym = []
    try:
        lim_pos = sp.limit(f, x, sp.oo)
        lim_neg = sp.limit(f, x, -sp.oo)
        if lim_pos.is_real and lim_pos.is_finite:
            horiz_asym.append({"side": "right", "y": round(float(lim_pos), 6)})
        if lim_neg.is_real and lim_neg.is_finite and lim_neg != lim_pos:
            horiz_asym.append({"side": "left", "y": round(float(lim_neg), 6)})
    except:
        pass

    # ── Symmetry ─────────────────────────────────────────────────
    f_neg = f.subs(x, -x)
    is_even = sp.simplify(f_neg - f) == 0
    is_odd  = sp.simplify(f_neg + f) == 0
    symmetry = "even" if is_even else "odd" if is_odd else "none"

    # ── Periodicity ──────────────────────────────────────────────
    period = None
    try:
        p = sp.periodicity(f, x)
        if p and p.is_finite and p.is_real:
            period = round(float(p), 6)
    except:
        pass

    # ── Intercepts ───────────────────────────────────────────────
    y_intercept = None
    x_intercepts = []
    try:
        y0 = f.subs(x, 0)
        if y0.is_real and y0.is_finite:
            y_intercept = round(float(y0), 6)
    except:
        pass
    try:
        x0s = sp.solve(sp.Eq(f, 0), x)
        for s in x0s[:6]:
            if s.is_real and s.is_finite:
                x_intercepts.append(round(float(s), 6))
    except:
        pass

    # ── Domain ───────────────────────────────────────────────────
    domain_str = "Reals"
    try:
        dom = sp.calculus.util.continuous_domain(f, x, sp.S.Reals)
        domain_str = str(dom)
    except:
        pass

    result = {
        "simplified": simplified,
        "derivative": str(df),
        "criticalPoints": critical,
        "singularities": singularities,
        "verticalAsymptotes": vertical_asym,
        "horizontalAsymptotes": horiz_asym,
        "domain": domain_str,
        "symmetry": symmetry,
        "period": period,
        "intercepts": {"y": y_intercept, "x": x_intercepts},
    }
except Exception as e:
    result = {"error": str(e)}

json.dumps(result)
`;

  const jsonStr = self.pyodide.runPython(script);
  return JSON.parse(jsonStr);
}

// ─── SymPy 3D Analysis (stub — extend as needed) ────────────────────────────
function analyze3D(expr) {
  return { mode: '3D', simplified: expr };
}

// ─── Simplify only ──────────────────────────────────────────────────────────
function simplifyExpr(expr) {
  const safeExpr = expr.replace(/\^/g, '**');

  //  Safely pass string to avoid template injection
  self.pyodide.globals.set('expr_str', safeExpr);

  const script = `
import sympy as sp
import json
try:
    f = sp.sympify(expr_str)
    result = {"simplified": str(sp.simplify(f))}
except Exception as e:
    result = {"error": str(e)}
json.dumps(result)
`;
  return JSON.parse(self.pyodide.runPython(script));
}