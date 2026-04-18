import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Plot from 'react-plotly.js';
import * as math from 'mathjs';
import {
  Trash2, Plus, Eye, EyeOff, Settings, ZoomIn, ZoomOut,
  RotateCcw, ChevronDown, ChevronUp, Activity,
  Crosshair, Menu, Layers, X, Calculator, TrendingUp,
  Grid, Maximize2, Download, Info, Search, Zap
} from 'lucide-react';
import './PlotGraph.css';
const PALETTE = [
  '#e879f9','#38bdf8','#4ade80','#fbbf24',
  '#f87171','#fb923c','#a78bfa','#34d399',
  '#f472b6','#22d3ee'
];

const EQ_TYPES = [
  { id: 'explicit',   label: 'y = f(x)',    sym: 'f(x)',  hint: 'e.g. sin(x) + x/2' },
  { id: 'polar',      label: 'r = f(θ)',    sym: 'r(θ)',  hint: 'e.g. cos(3*theta)' },
  { id: 'implicit',   label: 'F(x,y) = 0', sym: 'F=0',   hint: 'e.g. x^2 + y^2 = 25' },
  { id: 'parametric', label: 'Parametric',  sym: 'P(t)',  hint: 'x=cos(t), y=sin(t)' },
];

const PRESETS = [
  { label: 'sin(x)',       expr: 'sin(x)',                                                         type: 'explicit',   cat: 'trig' },
  { label: 'cos(x)',       expr: 'cos(x)',                                                         type: 'explicit',   cat: 'trig' },
  { label: 'tan(x)',       expr: 'tan(x)',                                                         type: 'explicit',   cat: 'trig' },
  { label: 'x³−3x',       expr: 'x^3 - 3*x',                                                     type: 'explicit',   cat: 'poly' },
  { label: 'x⁴−5x²+4',   expr: 'x^4 - 5*x^2 + 4',                                               type: 'explicit',   cat: 'poly' },
  { label: 'e^(−x²)',     expr: 'exp(-x^2)',                                                      type: 'explicit',   cat: 'exp' },
  { label: '1/x',         expr: '1/x',                                                            type: 'explicit',   cat: 'rational' },
  { label: 'floor(x)',    expr: 'floor(x)',                                                       type: 'explicit',   cat: 'misc' },
  { label: 'ln(|x|)',     expr: 'log(abs(x))',                                                    type: 'explicit',   cat: 'exp' },
  { label: 'abs(sin(x))', expr: 'abs(sin(x))',                                                    type: 'explicit',   cat: 'misc' },
  { label: 'Circle',      expr: 'x^2 + y^2 = 16',                                               type: 'implicit',   cat: 'conic' },
  { label: 'Ellipse',     expr: 'x^2/9 + y^2/4 = 1',                                            type: 'implicit',   cat: 'conic' },
  { label: 'Hyperbola',   expr: 'x^2/4 - y^2/9 = 1',                                            type: 'implicit',   cat: 'conic' },
  { label: 'Rose 3θ',     expr: 'cos(3*theta)',                                                   type: 'polar',      cat: 'polar' },
  { label: 'Spiral',      expr: 'theta/3',                                                        type: 'polar',      cat: 'polar' },
  { label: 'Limaçon',    expr: '1 + 2*cos(theta)',                                               type: 'polar',      cat: 'polar' },
  { label: 'Lissajous',  expr: 'x=cos(3*t),y=sin(2*t)',                                          type: 'parametric', cat: 'param' },
  { label: 'Butterfly',  expr: 'x=sin(t)*(exp(cos(t))-2*cos(4*t)),y=cos(t)*(exp(cos(t))-2*cos(4*t))', type: 'parametric', cat: 'param' },
  { label: 'Spirograph', expr: 'x=cos(t)+cos(7*t)/2,y=sin(t)+sin(7*t)/2',                       type: 'parametric', cat: 'param' },
];

const PRESET_CATS = ['trig','poly','exp','rational','conic','polar','param','misc'];

function useWindowSize() {
  const [size, setSize] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 1200 });
  useEffect(() => {
    const h = () => setSize({ w: window.innerWidth });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return size;
}

// ── Numeric integration (Simpson's rule) ──────────────────────────────────
function simpsonIntegrate(f, a, b, n = 1000) {
  const step = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    sum += f(a + i * step) * (i % 2 === 0 ? 2 : 4);
  }
  return (step / 3) * sum;
}

// ── Main Component ──────────────────────────────────────────────────────────
const GraphingCalculator = () => {
  const { w } = useWindowSize();
  const isMobile = w < 768;
  const isTablet = w >= 768 && w < 1100;

  const [equations, setEquations] = useState([
    { id: 1, expression: 'sin(x)', type: 'explicit', color: PALETTE[0], visible: true, lineStyle: 'solid', lineWidth: 2.5, showDerivative: false, showIntegral: false, label: '' },
    { id: 2, expression: 'cos(x)', type: 'explicit', color: PALETTE[1], visible: true, lineStyle: 'solid', lineWidth: 2.5, showDerivative: false, showIntegral: false, label: '' },
  ]);
  const [nextId, setNextId] = useState(3);
  const [newExpr, setNewExpr] = useState('');
  const [newType, setNewType] = useState('explicit');
  const [graphSettings, setGraphSettings] = useState({ xMin: -10, xMax: 10, yMin: -8, yMax: 8, showGrid: true, showAxes: true, showLabels: true, showMinorGrid: true });
  const [variables, setVariables] = useState({});
  const [hoverCoord, setHoverCoord] = useState(null);
  const [crosshair, setCrosshair] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeTab, setActiveTab] = useState('equations');
  const [integralRange, setIntegralRange] = useState({ a: -3, b: 3 });
  const [intersectionPoints, setIntersectionPoints] = useState([]);
  const [showIntersections, setShowIntersections] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [selectedCat, setSelectedCat] = useState('trig');
  const [integralValues, setIntegralValues] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [criticalPoints, setCriticalPoints] = useState([]);
  const [showCritical, setShowCritical] = useState(false);
  const [animParam, setAnimParam] = useState(null);
  const [animRunning, setAnimRunning] = useState(false);
  const animRef = useRef(null);
  const [plotRevision, setPlotRevision] = useState(0);

  useEffect(() => { if (isMobile) setSidebarOpen(false); }, [isMobile]);

  // Extract variables
  useEffect(() => {
    const reserved = new Set(['x','y','t','r','theta','e','pi','i','sin','cos','tan','log','ln','sqrt','abs','exp','floor','ceil','round','sign','mod','min','max','atan','asin','acos','atan2','sinh','cosh','tanh']);
    const found = {};
    equations.forEach(eq => {
      try {
        math.parse(eq.expression).filter(n => n.isSymbolNode).forEach(n => {
          if (!reserved.has(n.name) && !found.hasOwnProperty(n.name))
            found[n.name] = variables[n.name] ?? 1;
        });
      } catch {}
    });
    if (JSON.stringify(found) !== JSON.stringify(variables)) setVariables(found);
  }, [equations]);

  // Compute integral values
  useEffect(() => {
    const vals = {};
    equations.forEach(eq => {
      if (eq.showIntegral && eq.type === 'explicit') {
        try {
          const compiled = math.compile(eq.expression);
          const f = x => { try { const v = compiled.evaluate({ x, ...variables }); return isFinite(v) ? v : 0; } catch { return 0; } };
          vals[eq.id] = simpsonIntegrate(f, integralRange.a, integralRange.b);
        } catch {}
      }
    });
    setIntegralValues(vals);
  }, [equations, integralRange, variables]);

  const safeEval = (expr, scope) => {
    try {
      const v = math.evaluate(expr, scope);
      return typeof v === 'number' && isFinite(v) ? v : null;
    } catch { return null; }
  };

  // ── Animation ──────────────────────────────────────────────────────────────
  const startAnimation = useCallback((varName) => {
    if (animRunning) { clearInterval(animRef.current); setAnimRunning(false); return; }
    setAnimRunning(true);
    let t = variables[varName] ?? 0;
    animRef.current = setInterval(() => {
      t = (t + 0.05) % (2 * Math.PI);
      setVariables(prev => ({ ...prev, [varName]: +t.toFixed(3) }));
    }, 50);
  }, [animRunning, variables]);

  useEffect(() => () => clearInterval(animRef.current), []);

  // ── Data generators ────────────────────────────────────────────────────────
  const generateExplicit = useCallback((eq) => {
    const { xMin, xMax } = graphSettings;
    const n = 2000;
    const step = (xMax - xMin) / (n - 1);
    const xs = [], ys = [], xd = [], yd = [], xi = [], yi = [];
    for (let i = 0; i < n; i++) {
      const x = xMin + i * step;
      const y = safeEval(eq.expression, { x, ...variables });
      xs.push(x);
      ys.push(y !== null ? y : null);
      if (eq.showDerivative && y !== null) {
        const y2 = safeEval(eq.expression, { x: x + 1e-5, ...variables });
        if (y2 !== null) { xd.push(x); yd.push((y2 - y) / 1e-5); }
      }
      if (eq.showIntegral && y !== null && x >= integralRange.a && x <= integralRange.b) {
        xi.push(x); yi.push(y);
      }
    }
    return { xs, ys, xd, yd, xi, yi };
  }, [graphSettings, variables, integralRange]);

  const generatePolar = useCallback((eq) => {
    const xs = [], ys = [];
    const n = 2000;
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * 6 * Math.PI;
      const r = safeEval(eq.expression, { theta, x: theta, t: theta, ...variables });
      if (r !== null) { xs.push(r * Math.cos(theta)); ys.push(r * Math.sin(theta)); }
    }
    return { xs, ys };
  }, [variables]);

  const generateImplicit = useCallback((eq) => {
    const { xMin, xMax, yMin, yMax } = graphSettings;
    const res = 300;
    const xs = [], ys = [];
    const xStep = (xMax - xMin) / res, yStep = (yMax - yMin) / res;
    let lhs, rhs;
    if (eq.expression.includes('=')) { const p = eq.expression.split('='); lhs = p[0].trim(); rhs = p[1]?.trim() || '0'; }
    else { lhs = eq.expression; rhs = '0'; }
    for (let i = 0; i <= res; i++) {
      for (let j = 0; j <= res; j++) {
        const x = xMin + i * xStep, y = yMin + j * yStep;
        const lv = safeEval(lhs, { x, y, ...variables });
        const rv = safeEval(rhs, { x, y, ...variables });
        if (lv !== null && rv !== null && Math.abs(lv - rv) < 0.07) { xs.push(x); ys.push(y); }
      }
    }
    return { xs, ys };
  }, [graphSettings, variables]);

  const generateParametric = useCallback((eq) => {
    const xs = [], ys = [];
    const parts = eq.expression.split(',');
    if (parts.length < 2) return { xs, ys };
    const xExpr = parts[0].replace(/x\s*=\s*/i, '').trim();
    const yExpr = parts[1].replace(/y\s*=\s*/i, '').trim();
    const n = 3000, tMin = -4 * Math.PI, tMax = 4 * Math.PI;
    const step = (tMax - tMin) / n;
    for (let i = 0; i <= n; i++) {
      const t = tMin + i * step;
      const x = safeEval(xExpr, { t, ...variables });
      const y = safeEval(yExpr, { t, ...variables });
      if (x !== null && y !== null) { xs.push(x); ys.push(y); }
    }
    return { xs, ys };
  }, [variables]);

  // ── Critical points ─────────────────────────────────────────────────────────
  const findCriticalPoints = useCallback(() => {
    const visible = equations.filter(e => e.visible && e.type === 'explicit');
    const pts = [];
    visible.forEach(eq => {
      const { xMin, xMax } = graphSettings;
      const n = 3000, step = (xMax - xMin) / n;
      let prevD = null;
      for (let i = 0; i <= n; i++) {
        const x = xMin + i * step;
        const y = safeEval(eq.expression, { x, ...variables });
        const y2 = safeEval(eq.expression, { x: x + 1e-5, ...variables });
        if (y !== null && y2 !== null) {
          const d = (y2 - y) / 1e-5;
          if (prevD !== null && Math.sign(d) !== Math.sign(prevD)) {
            const y2nd = safeEval(eq.expression, { x: x + 1e-5, ...variables });
            const y3rd = safeEval(eq.expression, { x: x + 2e-5, ...variables });
            const d2 = y2nd !== null && y3rd !== null ? (y3rd - 2*y2nd + y) / (1e-5*1e-5) : 0;
            pts.push({ x: +x.toFixed(4), y: +y.toFixed(4), type: d2 < 0 ? 'max' : 'min', color: eq.color, label: eq.label || eq.expression });
          }
          prevD = d;
        }
      }
    });
    setCriticalPoints(pts);
  }, [equations, graphSettings, variables]);

  // ── Intersection finder ────────────────────────────────────────────────────
  const findIntersections = useCallback(() => {
    const visible = equations.filter(e => e.visible && e.type === 'explicit');
    if (visible.length < 2) { setIntersectionPoints([]); return; }
    const [e1, e2] = visible;
    const { xMin, xMax } = graphSettings;
    const n = 4000, step = (xMax - xMin) / n;
    const pts = [];
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const x = xMin + i * step;
      const y1 = safeEval(e1.expression, { x, ...variables });
      const y2 = safeEval(e2.expression, { x, ...variables });
      if (y1 !== null && y2 !== null) {
        const diff = y1 - y2;
        if (prev !== null && Math.sign(diff) !== Math.sign(prev.diff)) {
          const xi = prev.x - prev.diff * (step / (diff - prev.diff));
          const yi = safeEval(e1.expression, { x: xi, ...variables });
          if (yi !== null) pts.push({ x: +xi.toFixed(4), y: +yi.toFixed(4) });
        }
        prev = { x, diff };
      }
    }
    setIntersectionPoints(pts);
  }, [equations, graphSettings, variables]);

  // ── Build traces ───────────────────────────────────────────────────────────
  const processEquation = useCallback((eq) => {
    const traces = [];
    const dash = eq.lineStyle === 'dashed' ? 'dash' : eq.lineStyle === 'dotted' ? 'dot' : 'solid';
    if (eq.type === 'explicit') {
      const { xs, ys, xd, yd, xi, yi } = generateExplicit(eq);
      traces.push({
        x: xs, y: ys, mode: 'lines', type: 'scatter',
        name: eq.label || eq.expression,
        line: { color: eq.color, width: eq.lineWidth, dash },
        visible: eq.visible ? true : 'legendonly',
        connectgaps: false,
        hovertemplate: `<b>${eq.label || eq.expression}</b><br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>`,
      });
      if (eq.showDerivative && xd.length > 0)
        traces.push({ x: xd, y: yd, mode: 'lines', type: 'scatter', name: `f'`, line: { color: eq.color, width: 1.5, dash: 'dash' }, opacity: 0.6, hovertemplate: `Derivative<br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>` });
      if (eq.showIntegral && xi.length > 1)
        traces.push({ x: [xi[0], ...xi, xi[xi.length-1], xi[0]], y: [0, ...yi, 0, 0], mode: 'none', type: 'scatter', fill: 'toself', fillcolor: eq.color + '22', line: { color: 'transparent' }, name: `∫`, hoverinfo: 'skip' });
    } else if (eq.type === 'polar') {
      const { xs, ys } = generatePolar(eq);
      traces.push({ x: xs, y: ys, mode: 'lines', type: 'scatter', name: `r=${eq.expression}`, line: { color: eq.color, width: eq.lineWidth, dash }, visible: eq.visible ? true : 'legendonly', hovertemplate: `x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>` });
    } else if (eq.type === 'implicit') {
      const { xs, ys } = generateImplicit(eq);
      traces.push({ x: xs, y: ys, mode: 'markers', type: 'scatter', name: eq.expression, marker: { color: eq.color, size: 2.5, opacity: 0.85 }, visible: eq.visible ? true : 'legendonly', hoverinfo: 'skip' });
    } else if (eq.type === 'parametric') {
      const { xs, ys } = generateParametric(eq);
      traces.push({ x: xs, y: ys, mode: 'lines', type: 'scatter', name: eq.expression.slice(0, 20), line: { color: eq.color, width: eq.lineWidth, dash }, visible: eq.visible ? true : 'legendonly', hovertemplate: `x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>` });
    }
    return traces;
  }, [generateExplicit, generatePolar, generateImplicit, generateParametric]);

  const allTraces = useMemo(() => {
    const traces = equations.flatMap(processEquation);
    if (showIntersections && intersectionPoints.length > 0)
      traces.push({
        x: intersectionPoints.map(p => p.x), y: intersectionPoints.map(p => p.y),
        mode: 'markers+text', type: 'scatter', name: 'Intersections',
        marker: { color: '#fff', size: 10, symbol: 'cross', line: { color: '#e879f9', width: 2.5 } },
        text: intersectionPoints.map(p => `(${p.x},${p.y})`),
        textposition: 'top center', textfont: { color: '#f0e6ff', size: 10, family: 'JetBrains Mono,monospace' },
        hovertemplate: `Intersection<br>x: %{x}<br>y: %{y}<extra></extra>`,
      });
    if (showCritical && criticalPoints.length > 0) {
      const maxPts = criticalPoints.filter(p => p.type === 'max');
      const minPts = criticalPoints.filter(p => p.type === 'min');
      if (maxPts.length > 0) traces.push({ x: maxPts.map(p=>p.x), y: maxPts.map(p=>p.y), mode: 'markers', type: 'scatter', name: 'Maxima', marker: { color: '#4ade80', size: 9, symbol: 'triangle-up', line: { color: '#fff', width: 1 } }, hovertemplate: `Local Max<br>(%{x:.3f}, %{y:.3f})<extra></extra>` });
      if (minPts.length > 0) traces.push({ x: minPts.map(p=>p.x), y: minPts.map(p=>p.y), mode: 'markers', type: 'scatter', name: 'Minima', marker: { color: '#f87171', size: 9, symbol: 'triangle-down', line: { color: '#fff', width: 1 } }, hovertemplate: `Local Min<br>(%{x:.3f}, %{y:.3f})<extra></extra>` });
    }
    if (crosshair && hoverCoord) {
      traces.push(
        { x: [graphSettings.xMin, graphSettings.xMax], y: [hoverCoord.y, hoverCoord.y], mode: 'lines', type: 'scatter', line: { color: 'rgba(232,121,249,0.25)', width: 1, dash: 'dot' }, hoverinfo: 'skip', name: '', showlegend: false },
        { x: [hoverCoord.x, hoverCoord.x], y: [graphSettings.yMin, graphSettings.yMax], mode: 'lines', type: 'scatter', line: { color: 'rgba(232,121,249,0.25)', width: 1, dash: 'dot' }, hoverinfo: 'skip', name: '', showlegend: false }
      );
    }
    return traces;
  }, [equations, processEquation, intersectionPoints, showIntersections, crosshair, hoverCoord, graphSettings, criticalPoints, showCritical]);

  const layout = useMemo(() => ({
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#c4b5fd', family: "'JetBrains Mono','Fira Mono',monospace", size: 11 },
    xaxis: {
      range: [graphSettings.xMin, graphSettings.xMax],
      showgrid: graphSettings.showGrid, gridcolor: 'rgba(139,92,246,0.12)', gridwidth: 1,
      minor: graphSettings.showMinorGrid ? { showgrid: true, gridcolor: 'rgba(139,92,246,0.05)', gridwidth: 1 } : undefined,
      zeroline: graphSettings.showAxes, zerolinecolor: 'rgba(181,123,238,0.55)', zerolinewidth: 1.5,
      showticklabels: graphSettings.showLabels,
      tickfont: { color: '#7c5cbf', size: 10, family: 'JetBrains Mono,monospace' },
      linecolor: 'rgba(139,92,246,0.15)', showline: true,
    },
    yaxis: {
      range: [graphSettings.yMin, graphSettings.yMax],
      showgrid: graphSettings.showGrid, gridcolor: 'rgba(139,92,246,0.12)', gridwidth: 1,
      minor: graphSettings.showMinorGrid ? { showgrid: true, gridcolor: 'rgba(139,92,246,0.05)', gridwidth: 1 } : undefined,
      zeroline: graphSettings.showAxes, zerolinecolor: 'rgba(181,123,238,0.55)', zerolinewidth: 1.5,
      showticklabels: graphSettings.showLabels,
      tickfont: { color: '#7c5cbf', size: 10, family: 'JetBrains Mono,monospace' },
      linecolor: 'rgba(139,92,246,0.15)', showline: true,
    },
    margin: isMobile ? { l: 40, r: 8, t: 10, b: 40 } : { l: 50, r: 12, t: 18, b: 48 },
    showlegend: true,
    legend: { bgcolor: 'rgba(8,5,20,0.88)', bordercolor: 'rgba(139,92,246,0.2)', borderwidth: 1, font: { color: '#c4b5fd', size: 10, family: 'JetBrains Mono' }, x: 1, xanchor: 'right', y: 1 },
    dragmode: 'pan',
    hoverlabel: { bgcolor: 'rgba(14,8,36,0.97)', bordercolor: '#7c3aed', font: { color: '#e9d5ff', family: 'JetBrains Mono,monospace', size: 11.5 } },
    hovermode: 'closest',
    modebar: { bgcolor: 'transparent', color: '#7c3aed', activecolor: '#e879f9' },
  }), [graphSettings, isMobile]);

  const config = useMemo(() => ({
    responsive: true,
    displayModeBar: !isMobile,
    scrollZoom: true,
    modeBarButtonsToRemove: ['select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'],
    displaylogo: false,
    toImageButtonOptions: { format: 'svg', filename: 'graph' },
  }), [isMobile]);

  const addEquation = () => {
    if (!newExpr.trim()) return;
    setEquations(prev => [...prev, { id: nextId, expression: newExpr.trim(), type: newType, color: PALETTE[(nextId - 1) % PALETTE.length], visible: true, lineStyle: 'solid', lineWidth: 2.5, showDerivative: false, showIntegral: false, label: '' }]);
    setNewExpr(''); setNextId(n => n + 1);
  };

  const updateEq = (id, patch) => setEquations(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteEq = (id) => setEquations(prev => prev.filter(e => e.id !== id));
  const zoom = (f) => setGraphSettings(prev => {
    const xc = (prev.xMin + prev.xMax) / 2, yc = (prev.yMin + prev.yMax) / 2;
    return { ...prev, xMin: xc - (prev.xMax - prev.xMin) * f / 2, xMax: xc + (prev.xMax - prev.xMin) * f / 2, yMin: yc - (prev.yMax - prev.yMin) * f / 2, yMax: yc + (prev.yMax - prev.yMin) * f / 2 };
  });

  const tableData = useMemo(() => {
    const eqs = equations.filter(e => e.visible && e.type === 'explicit');
    const xs = Array.from({ length: 21 }, (_, i) => graphSettings.xMin + i * (graphSettings.xMax - graphSettings.xMin) / 20);
    return { xs, eqs };
  }, [equations, graphSettings]);

  const filteredPresets = PRESETS.filter(p => p.cat === selectedCat || selectedCat === 'all');
  const searchedPresets = searchTerm ? PRESETS.filter(p => p.label.toLowerCase().includes(searchTerm.toLowerCase()) || p.expr.toLowerCase().includes(searchTerm.toLowerCase())) : filteredPresets;

  return (
    <div className="gc-root">
      {isMobile && (
        <button className="gc-fab" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      <aside className={`gc-sidebar${sidebarOpen ? ' open' : ''}`}>


        <nav className="gc-tabs">
          {[
            { id: 'equations', icon: <Layers size={13} />, label: 'Equations' },
            { id: 'analysis',  icon: <Activity size={13} />, label: 'Analyze' },
            { id: 'settings',  icon: <Settings size={13} />, label: 'Settings' },
          ].map(t => (
            <button key={t.id} className={`gc-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* EQUATIONS TAB */}
        {activeTab === 'equations' && (
          <div className="gc-panel">
            {/* Type selector */}
            <div className="gc-type-grid">
              {EQ_TYPES.map(t => (
                <button key={t.id} className={`gc-type-btn${newType === t.id ? ' sel' : ''}`} onClick={() => setNewType(t.id)}>
                  <span className="gc-type-badge">{t.sym}</span>
                  <span className="gc-type-label">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="gc-input-block">
              <input
                className="gc-input"
                value={newExpr}
                onChange={e => setNewExpr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEquation()}
                placeholder={EQ_TYPES.find(t => t.id === newType)?.hint}
                spellCheck={false} autoComplete="off"
              />
              <button className="gc-add-btn" onClick={addEquation} title="Add (Enter)">
                <Plus size={16} />
              </button>
            </div>

            <div className="gc-eq-list">
              {equations.map(eq => (
                <EquationCard key={eq.id} eq={eq}
                  onUpdate={p => updateEq(eq.id, p)} onDelete={() => deleteEq(eq.id)}
                  integralRange={integralRange} setIntegralRange={setIntegralRange}
                  integralValue={integralValues[eq.id]} />
              ))}
            </div>

            {/* Examples */}
            <div className="gc-section-hdr"><Zap size={11}/> Quick Presets</div>
            <div className="gc-search-wrap">
              <Search size={12} className="gc-search-icon"/>
              <input className="gc-search" placeholder="Search presets…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {!searchTerm && (
              <div className="gc-cat-pills">
                {PRESET_CATS.map(c => (
                  <button key={c} className={`gc-cat-pill${selectedCat === c ? ' sel' : ''}`} onClick={() => setSelectedCat(c)}>{c}</button>
                ))}
              </div>
            )}
            <div className="gc-presets">
              {searchedPresets.map(ex => (
                <button key={ex.label} className="gc-preset-btn" onClick={() => { setNewExpr(ex.expr); setNewType(ex.type); }}>
                  <span className="gc-preset-label">{ex.label}</span>
                  <span className="gc-preset-type">{ex.type}</span>
                </button>
              ))}
            </div>

            {/* Variable sliders */}
            {Object.keys(variables).length > 0 && (
              <>
                <div className="gc-section-hdr"><Calculator size={11}/> Variables</div>
                {Object.entries(variables).map(([k, v]) => (
                  <div key={k} className="gc-var-block">
                    <div className="gc-var-header">
                      <span className="gc-var-name">{k}</span>
                      <span className="gc-var-val">{v.toFixed(3)}</span>
                      <button className="gc-anim-btn" onClick={() => startAnimation(k)} title="Animate">
                        {animRunning && animParam === k ? '⏹' : '▶'}
                      </button>
                    </div>
                    <input className="gc-range" type="range" min="-10" max="10" step="0.01" value={v}
                      onChange={e => { setVariables(prev => ({ ...prev, [k]: parseFloat(e.target.value) })); setAnimParam(k); }} />
                    <div className="gc-range-labels"><span>-10</span><span>0</span><span>10</span></div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 'analysis' && (
          <div className="gc-panel">
            <div className="gc-analysis-card">
              <div className="gc-analysis-title"><Crosshair size={13}/> Intersections</div>
              <p className="gc-hint">Compares the first two visible explicit equations.</p>
              <div className="gc-btn-row">
                <button className="gc-action-btn" onClick={findIntersections}>Find Points</button>
                <button className={`gc-action-btn${showIntersections ? ' on' : ''}`} onClick={() => setShowIntersections(s => !s)}>
                  {showIntersections ? <EyeOff size={12}/> : <Eye size={12}/>} {showIntersections ? 'Hide' : 'Show'}
                </button>
              </div>
              {intersectionPoints.length > 0 && (
                <div className="gc-pt-grid">
                  {intersectionPoints.map((p, i) => (
                    <div key={i} className="gc-pt">
                      <span className="gc-pt-idx">{i+1}</span>
                      <span>({p.x}, {p.y})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="gc-analysis-card">
              <div className="gc-analysis-title"><TrendingUp size={13}/> Critical Points</div>
              <p className="gc-hint">Finds local maxima and minima of explicit equations.</p>
              <div className="gc-btn-row">
                <button className="gc-action-btn" onClick={findCriticalPoints}>Find</button>
                <button className={`gc-action-btn${showCritical ? ' on' : ''}`} onClick={() => setShowCritical(s => !s)}>
                  {showCritical ? <EyeOff size={12}/> : <Eye size={12}/>} {showCritical ? 'Hide' : 'Show'}
                </button>
              </div>
              {criticalPoints.length > 0 && (
                <div className="gc-pt-grid">
                  {criticalPoints.slice(0,8).map((p, i) => (
                    <div key={i} className="gc-pt" style={{ borderColor: p.color + '44' }}>
                      <span className={`gc-pt-badge ${p.type}`}>{p.type === 'max' ? '▲' : '▼'}</span>
                      <span>({p.x}, {p.y})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="gc-analysis-card">
              <div className="gc-analysis-title"><Grid size={13}/> Coordinate Crosshair</div>
              <label className="gc-toggle-row">
                <span>Enable crosshair</span>
                <span className={`gc-toggle${crosshair ? ' on' : ''}`} onClick={() => setCrosshair(s => !s)} />
              </label>
              {hoverCoord && crosshair && (
                <div className="gc-coord-box">
                  <div>x <span>=</span> <b>{hoverCoord.x?.toFixed(6)}</b></div>
                  <div>y <span>=</span> <b>{hoverCoord.y?.toFixed(6)}</b></div>
                </div>
              )}
            </div>

            <div className="gc-analysis-card">
              <div className="gc-analysis-title"><Calculator size={13}/> Integral Values</div>
              {equations.filter(e => e.showIntegral && integralValues[e.id] !== undefined).length === 0
                ? <p className="gc-hint">Enable "Integral Area" on an equation to compute.</p>
                : equations.filter(e => e.showIntegral && integralValues[e.id] !== undefined).map(eq => (
                  <div key={eq.id} className="gc-integral-row" style={{ '--ec': eq.color }}>
                    <span style={{ color: eq.color }}>{(eq.label || eq.expression).slice(0, 14)}</span>
                    <span className="gc-integral-val">∫ = {integralValues[eq.id]?.toFixed(5)}</span>
                  </div>
                ))
              }
            </div>

            <div className="gc-analysis-card">
              <div className="gc-analysis-title"><Info size={13}/> Table of Values</div>
              <label className="gc-toggle-row">
                <span>Show table</span>
                <span className={`gc-toggle${showTable ? ' on' : ''}`} onClick={() => setShowTable(s => !s)} />
              </label>
              {showTable && (
                <div className="gc-tbl-wrap">
                  <table className="gc-tbl">
                    <thead>
                      <tr>
                        <th>x</th>
                        {tableData.eqs.map(e => <th key={e.id} style={{ color: e.color }}>{(e.label || e.expression).slice(0, 8)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.xs.map(x => (
                        <tr key={x}>
                          <td>{x.toFixed(2)}</td>
                          {tableData.eqs.map(e => {
                            const y = safeEval(e.expression, { x, ...variables });
                            return <td key={e.id} style={{ color: y !== null ? e.color + 'cc' : undefined }}>{y !== null ? y.toFixed(4) : '—'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="gc-panel">
            <div className="gc-section-hdr">Viewport Range</div>
            <div className="gc-settings-grid">
              {[['xMin', 'X min'], ['xMax', 'X max'], ['yMin', 'Y min'], ['yMax', 'Y max']].map(([key, label]) => (
                <div className="gc-field" key={key}>
                  <label>{label}</label>
                  <input type="number" className="gc-num" value={graphSettings[key]} step="0.5"
                    onChange={e => setGraphSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || prev[key] }))} />
                </div>
              ))}
            </div>
            <button className="gc-action-btn full" onClick={() => setGraphSettings(p => ({ ...p, xMin: -10, xMax: 10, yMin: -8, yMax: 8 }))}>
              <RotateCcw size={12}/> Reset Viewport
            </button>

            <div className="gc-section-hdr" style={{ marginTop: 20 }}>Display</div>
            {[['showGrid', 'Major Grid'], ['showMinorGrid', 'Minor Grid'], ['showAxes', 'Axis Lines'], ['showLabels', 'Tick Labels']].map(([key, label]) => (
              <label className="gc-toggle-row" key={key}>
                <span>{label}</span>
                <span className={`gc-toggle${graphSettings[key] ? ' on' : ''}`}
                  onClick={() => setGraphSettings(prev => ({ ...prev, [key]: !prev[key] }))} />
              </label>
            ))}
          </div>
        )}
      </aside>

      {/* GRAPH */}
      <div className="gc-graph">
        <div className="gc-toolbar">
          <div className="gc-coord-pill">
            {hoverCoord
              ? <><span className="gc-coord-x">x={hoverCoord.x?.toFixed(3)}</span><span className="gc-coord-sep">|</span><span className="gc-coord-y">y={hoverCoord.y?.toFixed(3)}</span></>
              : <span className="gc-coord-idle">hover to inspect</span>}
          </div>
          <div className="gc-toolbar-btns">
            <button className="gc-tb-btn" onClick={() => zoom(0.6)} title="Zoom in"><ZoomIn size={14}/></button>
            <button className="gc-tb-btn" onClick={() => zoom(1.5)} title="Zoom out"><ZoomOut size={14}/></button>
            <button className="gc-tb-btn" onClick={() => setGraphSettings(p => ({ ...p, xMin: -10, xMax: 10, yMin: -8, yMax: 8 }))} title="Reset"><RotateCcw size={14}/></button>
          </div>
        </div>

        <Plot
          data={allTraces}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%' }}
          revision={plotRevision}
          onHover={e => { if (e.points?.[0]) setHoverCoord({ x: e.points[0].x, y: e.points[0].y }); }}
          onUnhover={() => setHoverCoord(null)}
          onRelayout={e => {
            if (e['xaxis.range[0]'] !== undefined)
              setGraphSettings(prev => ({ ...prev, xMin: e['xaxis.range[0]'], xMax: e['xaxis.range[1]'], yMin: e['yaxis.range[0]'], yMax: e['yaxis.range[1]'] }));
          }}
        />

        {equations.length === 0 && (
          <div className="gc-empty-hint">
            <div className="gc-empty-icon">∫</div>
            <div>Add an equation to get started</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Equation Card ──────────────────────────────────────────────────────────────
const EquationCard = ({ eq, onUpdate, onDelete, integralRange, setIntegralRange, integralValue }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`gc-eq-card${open ? ' open' : ''}`} style={{ '--ec': eq.color }}>
      <div className="gc-eq-row">
        <div className="gc-eq-dot" style={{ background: eq.color }} />
        <input className="gc-eq-expr" value={eq.expression}
          onChange={e => onUpdate({ expression: e.target.value })} spellCheck={false} />
        <div className="gc-eq-actions">
          <button className="gc-eq-btn" onClick={() => onUpdate({ visible: !eq.visible })} title={eq.visible ? 'Hide' : 'Show'}>
            {eq.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
          </button>
          <button className="gc-eq-btn" onClick={() => setOpen(o => !o)} title="Options">
            {open ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
          <button className="gc-eq-btn del" onClick={onDelete} title="Delete">
            <Trash2 size={12}/>
          </button>
        </div>
      </div>

      {open && (
        <div className="gc-eq-opts">
          <div className="gc-opt-row">
            <span className="gc-opt-label">Label</span>
            <input className="gc-opt-input" value={eq.label} placeholder="custom name" onChange={e => onUpdate({ label: e.target.value })} />
          </div>

          <div className="gc-opt-row">
            <span className="gc-opt-label">Color</span>
            <div className="gc-color-row">
              {PALETTE.map(c => (
                <button key={c} className={`gc-color-dot${eq.color === c ? ' sel' : ''}`} style={{ '--dc': c, background: c }} onClick={() => onUpdate({ color: c })} />
              ))}
            </div>
          </div>

          <div className="gc-opt-row">
            <span className="gc-opt-label">Style</span>
            <div className="gc-seg">
              {['solid', 'dashed', 'dotted'].map(s => (
                <button key={s} className={eq.lineStyle === s ? 'active' : ''} onClick={() => onUpdate({ lineStyle: s })}>{s}</button>
              ))}
            </div>
          </div>

          <div className="gc-opt-row">
            <span className="gc-opt-label">Width</span>
            <input className="gc-range" type="range" min="0.5" max="6" step="0.5" value={eq.lineWidth}
              onChange={e => onUpdate({ lineWidth: parseFloat(e.target.value) })} />
            <span className="gc-opt-val">{eq.lineWidth}px</span>
          </div>

          {eq.type === 'explicit' && (
            <>
              <div className="gc-checks">
                <label className="gc-check">
                  <input type="checkbox" checked={eq.showDerivative} onChange={e => onUpdate({ showDerivative: e.target.checked })} />
                  <span>Show f′(x)</span>
                </label>
                <label className="gc-check">
                  <input type="checkbox" checked={eq.showIntegral} onChange={e => onUpdate({ showIntegral: e.target.checked })} />
                  <span>Integral area</span>
                </label>
              </div>
              {eq.showIntegral && (
                <>
                  <div className="gc-opt-row">
                    <span className="gc-opt-label">Range</span>
                    <div className="gc-from-to">
                      <input type="number" value={integralRange.a} step="0.5" onChange={e => setIntegralRange(r => ({ ...r, a: parseFloat(e.target.value) }))} />
                      <span>→</span>
                      <input type="number" value={integralRange.b} step="0.5" onChange={e => setIntegralRange(r => ({ ...r, b: parseFloat(e.target.value) }))} />
                    </div>
                  </div>
                  {integralValue !== undefined && (
                    <div className="gc-integral-display">∫ ≈ <b>{integralValue.toFixed(6)}</b></div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphingCalculator;