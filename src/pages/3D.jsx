import React, {
  useState, useEffect, useCallback, useRef, useMemo, useDeferredValue,
} from 'react';
import { Helmet } from 'react-helmet-async';
import Plot from 'react-plotly.js';
import * as math from 'mathjs';
import {
  Trash2, Plus, Eye, EyeOff, Settings2, RotateCcw, Box, Play, Pause,
  RotateCw, Move, Layers, Download, Upload, Undo2, Redo2,
  ChevronLeft, ChevronRight, FlaskConical, Waves, Wind, Check, X,
} from 'lucide-react';
import './3D.css';
import { useCAS } from '../hooks/useCAS';
import CASLoader from '../components/graphing/CASLoader';
import '../components/graphing/CAS.css';

/* ─── constants ─────────────────────────────────────────────────── */
const KNOWN_SYMS = new Set([
  'x','y','z','t','u','v','e','pi','i','E','PI',
  'sin','cos','tan','asin','acos','atan','atan2',
  'sinh','cosh','tanh','asinh','acosh','atanh',
  'log','ln','log10','log2','sqrt','abs','ceil',
  'floor','round','sign','exp','pow','mod','max','min',
  'gamma','factorial',
]);

const PALETTE = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7',
  '#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9',
  '#F8C471','#82E0AA',
];

const MAX_HISTORY = 40;

const hex2rgba = (hex, a) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ─── MathExpression class ──────────────────────────────────────── */
class MathExpr {
  constructor(raw, type = 'surface') {
    this.raw   = raw;
    this.type  = type;
    this.error = null;
    this._compiled = null;
    this._dX = null;
    this._dY = null;

    try {
      let src = raw;
      if (type === 'surface') src = raw.replace(/^\s*z\s*=\s*/i, '').trim();
      this._node = math.parse(src);
      this._compiled = this._node.compile();
      if (type === 'surface') {
        try { this._dX = math.derivative(this._node, 'x'); } catch {}
        try { this._dY = math.derivative(this._node, 'y'); } catch {}
      }
    } catch (e) {
      this.error = e.message;
    }
  }

  // FIX 3: Handle complex numbers and all return types robustly
  eval(scope) {
    if (!this._compiled) return null;
    try {
      const v = this._compiled.evaluate(scope);

      // Plain finite number — the common case
      if (typeof v === 'number') {
        return isFinite(v) ? v : null;
      }

      // Complex number object — extract real part for surface types,
      // return full object for complex domain coloring
      if (v && typeof v === 'object') {
        if ('re' in v && 'im' in v) {
          // For complex graph type, caller wants the full object
          if (this.type === 'complex') return v;
          // For all other types, use real part only
          const re = v.re;
          return typeof re === 'number' && isFinite(re) ? re : null;
        }
        // Some mathjs results wrap a scalar in an object with 're' only
        if ('re' in v) {
          const re = v.re;
          return typeof re === 'number' && isFinite(re) ? re : null;
        }
      }

      return null;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[StudyBuddy] Non-blocking math error:', err);
      return null;
    }
  }

  dX(scope) {
    if (!this._dX) return null;
    try {
      const v = this._dX.compile().evaluate(scope);
      if (typeof v === 'number' && isFinite(v)) return v;
      if (v && typeof v === 'object' && 're' in v && isFinite(v.re)) return v.re;
      return null;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[StudyBuddy] Non-blocking math error:', err);
      return null;
    }
  }

  dY(scope) {
    if (!this._dY) return null;
    try {
      const v = this._dY.compile().evaluate(scope);
      if (typeof v === 'number' && isFinite(v)) return v;
      if (v && typeof v === 'object' && 're' in v && isFinite(v.re)) return v.re;
      return null;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[StudyBuddy] Non-blocking math error:', err);
      return null;
    }
  }

  vars() {
    if (!this._node) return [];
    const out = new Set();
    this._node.traverse(n => {
      if (n.isSymbolNode && !KNOWN_SYMS.has(n.name)) out.add(n.name);
    });
    return [...out];
  }
}

/* ─── Gaussian curvature (numerical) ───────────────────────────── */
const gaussK = (exprRaw, x, y, vars, h = 1e-4) => {
  try {
    const src = exprRaw.replace(/^\s*z\s*=\s*/i,'').trim();
    const f = (dx,dy) => {
      try {
        const v = math.evaluate(src, { x: x+dx, y: y+dy, ...vars });
        if (typeof v === 'number' && isFinite(v)) return v;
        if (v && typeof v === 'object' && 're' in v && isFinite(v.re)) return v.re;
        return 0;
      } catch { return 0; }
    };
    const f0  = f(0,0);
    const fx  = (f(h,0)-f(-h,0))/(2*h);
    const fy  = (f(0,h)-f(0,-h))/(2*h);
    const fxx = (f(h,0) - 2*f0 + f(-h,0))/(h*h);
    const fyy = (f(0,h) - 2*f0 + f(0,-h))/(h*h);
    const fxy = (f(h,h)-f(h,-h)-f(-h,h)+f(-h,-h))/(4*h*h);
    const D   = (1+fx*fx+fy*fy)**2;
    return D > 1e-12 ? (fxx*fyy - fxy*fxy)/D : 0;
  } catch { return 0; }
};

/* ─── SURFACE TYPE DEFINITIONS ──────────────────────────────────── */
const TYPES = [
  { id:'surface',    label:'Surface',   Icon:Layers,       ph:'sin(x)*cos(y)' },
  { id:'parametric', label:'Parametric',Icon:Box,          ph:'x=cos(u)*cos(v), y=cos(u)*sin(v), z=sin(u)' },
  { id:'curve',      label:'Curve',     Icon:Move,         ph:'x=cos(t), y=sin(t), z=t/5' },
  { id:'implicit',   label:'Implicit',  Icon:FlaskConical, ph:'x^2+y^2+z^2-4' },
  { id:'vector',     label:'Vector',    Icon:Wind,         ph:'P=y, Q=-x, R=0' },
  { id:'complex',    label:'Complex',   Icon:Waves,        ph:'z^2' },
];

const EXAMPLES = {
  surface:    ['sin(x)*cos(y)','x^2+y^2','cos(sqrt(x^2+y^2))','exp(-(x^2+y^2))','sin(x^2+y^2)/(x^2+y^2+0.1)','x*y'],
  parametric: ['x=cos(u)*cos(v), y=cos(u)*sin(v), z=sin(u)','x=(2+cos(u))*cos(v), y=(2+cos(u))*sin(v), z=sin(u)','x=u*cos(v), y=u*sin(v), z=u'],
  curve:      ['x=cos(t), y=sin(t), z=t/5','x=sin(t), y=cos(t), z=sin(2*t)','x=exp(-t/10)*cos(t), y=exp(-t/10)*sin(t), z=t/5'],
  implicit:   ['x^2+y^2+z^2-4','x^2+y^2-z^2-1','sin(x)+cos(y)+sin(z)','(x^2+y^2+z^2+2)^2-16*(x^2+y^2)'],
  vector:     ['P=y, Q=-x, R=0','P=x, Q=y, R=z','P=sin(y), Q=cos(x), R=0'],
  complex:    ['z^2','z^3-1','sin(z)','exp(z)','1/z'],
};

const DEFAULT_SETTINGS = {
  xMin:-5,xMax:5, yMin:-5,yMax:5, zMin:-5,zMax:5,
  resolution:40, showGrid:true, showAxes:true,
  curvature:false, adaptiveMesh:true,
};

/* ─── Component ─────────────────────────────────────────────────── */
export default function GraphingCalculator3D() {

  /* state */
  const [objects, setObjects] = useState(() => {
    try {
      const s = localStorage.getItem('sb-3d');
      if (s) { const p = JSON.parse(s); if (p.objects?.length) return p.objects; }
    } catch {}
    return [{ id:1, expression:'sin(x)*cos(y)', type:'surface', color:'#f472b6', visible:true, opacity:0.85, name:'Sine Wave' }];
  });
  const [nextId, setNextId]      = useState(2);
  const [activeTab, setTab]      = useState('surface');
  const [newExpr, setNewExpr]    = useState('');
  const [settings, setSettings]  = useState(DEFAULT_SETTINGS);
  const [vars, setVars]          = useState({});
  const [anim, setAnim]          = useState({ on:false, param:'t', speed:1 });
  const [sidebar, setSidebar]    = useState(true);
  const [showCfg, setShowCfg]    = useState(false);
  const [selId, setSelId]        = useState(null);
  const [mathPanel, setMathPanel]= useState(null);
  const [copied, setCopied]      = useState(false);
  const [history, setHistory]    = useState([]);
  const [hIdx, setHIdx]          = useState(-1);

  /* refs */
  const liveVarsRef  = useRef({});
  const { status: casStatus, progress: casProgress } = useCAS();
  const cameraRef    = useRef({ eye:{ x:1.5, y:1.5, z:1.5 } });
  const exprCache    = useRef(new Map());
  const animRef      = useRef();
  const frameRef     = useRef(0);

  /* deferred */
  const dObj = useDeferredValue(objects);
  const dSet = useDeferredValue(settings);

  /* ── history ───────────────────────────────────────────────────── */
  const pushHist = useCallback(snap => {
    setHistory(h => [...h.slice(0, hIdx+1), JSON.parse(JSON.stringify(snap))].slice(-MAX_HISTORY));
    setHIdx(i => Math.min(i+1, MAX_HISTORY-1));
  }, [hIdx]);

  const undo = useCallback(() => {
    if (hIdx <= 0) return;
    const s = history[hIdx-1];
    setObjects(s.objects); setSettings(s.settings); setVars(s.vars);
    setHIdx(i=>i-1); exprCache.current.clear();
  }, [history, hIdx]);

  const redo = useCallback(() => {
    if (hIdx >= history.length-1) return;
    const s = history[hIdx+1];
    setObjects(s.objects); setSettings(s.settings); setVars(s.vars);
    setHIdx(i=>i+1); exprCache.current.clear();
  }, [history, hIdx]);

  /* ── persist ───────────────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem('sb-3d', JSON.stringify({ objects, settings, vars })); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [objects, settings, vars]);

  /* ── sync liveVarsRef ──────────────────────────────────────────── */
  useEffect(() => { liveVarsRef.current = vars; }, [vars]);

  /* ── extract variable names from expressions ───────────────────── */
  useEffect(() => {
    const extra = {};
    objects.forEach(obj => {
      let e = exprCache.current.get(obj.expression+'|'+obj.type);
      if (!e) { e = new MathExpr(obj.expression, obj.type); exprCache.current.set(obj.expression+'|'+obj.type, e); }
      e.vars().forEach(n => { if (!(n in vars) && !(n in extra)) extra[n] = 0; });
    });
    if (Object.keys(extra).length) {
      setVars(v => { const nv = {...v, ...extra}; liveVarsRef.current = nv; return nv; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects]);

  /* ── animation loop ────────────────────────────────────────────── */
  useEffect(() => {
    if (!anim.on) { cancelAnimationFrame(animRef.current); return; }
    const tick = () => {
      liveVarsRef.current = { ...liveVarsRef.current, [anim.param]: (liveVarsRef.current[anim.param]||0) + 0.03*anim.speed };
      if (++frameRef.current % 2 === 0) setVars({...liveVarsRef.current});
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [anim.on, anim.param, anim.speed]);

  /* ── keyboard shortcuts ────────────────────────────────────────── */
  useEffect(() => {
    const h = e => {
      if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
      if ((e.ctrlKey||e.metaKey)&&e.key==='z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey)&&e.key==='y') { e.preventDefault(); redo(); }
      if (e.key===' ') { e.preventDefault(); setAnim(a=>({...a,on:!a.on})); }
      if (e.key==='g') setSettings(s=>({...s,showGrid:!s.showGrid}));
      if (e.key==='c') setSettings(s=>({...s,curvature:!s.curvature}));
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  }, [undo, redo]);

  /* ── mesh generators ────────────────────────────────────────────
     Each generator takes `currentVars` as parameter (not via ref closure)
     making them pure with stable references.
  ───────────────────────────────────────────────────────────────── */

  const getExpr = useCallback((raw, type) => {
    const key = raw+'|'+type;
    if (!exprCache.current.has(key)) exprCache.current.set(key, new MathExpr(raw, type));
    return exprCache.current.get(key);
  }, []);

  // FIX 1 & 2: Handle complex numbers and validate values in genSurface
  const genSurface = useCallback((obj, currentVars) => {
    const { xMin,xMax,yMin,yMax,resolution,curvature } = dSet;
    const e = getExpr(obj.expression, 'surface');

    if (e.error) {
      console.warn('[StudyBuddy] Surface expr error:', e.error);
      return null;
    }

    // FIX 2: Debug log to help diagnose evaluation issues in dev
    if (process.env.NODE_ENV === 'development') {
      const testVal = e.eval({ x:0, y:0, ...currentVars });
      console.log('[StudyBuddy] Surface test eval at (0,0):', testVal, 'type:', typeof testVal);
    }

    const res = resolution;
    const x=[],y=[],z=[],sc=[];
    let validCount = 0;

    for (let i=0;i<res;i++) {
      const xr=[],yr=[],zr=[],cr=[];
      const xv = xMin + (i/(res-1))*(xMax-xMin);
      for (let j=0;j<res;j++) {
        const yv = yMin + (j/(res-1))*(yMax-yMin);

        // FIX 1: e.eval() now handles complex numbers internally,
        // returning the real part (or null) for surface types.
        let zv = e.eval({ x:xv, y:yv, ...currentVars });

        xr.push(xv);
        yr.push(yv);
        // FIX 1: Push null for invalid values — Plotly renders gaps, not errors
        if (typeof zv === 'number' && isFinite(zv)) {
          zr.push(zv);
          validCount++;
        } else {
          zr.push(null);
        }

        if (curvature) cr.push(gaussK(obj.expression, xv, yv, currentVars));
      }
      x.push(xr); y.push(yr); z.push(zr); if (curvature) sc.push(cr);
    }

    // FIX 4: Validate — don't return a trace with zero usable points
    if (validCount === 0) {
      console.warn('[StudyBuddy] No valid Z values for expression:', obj.expression);
      return null;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudyBuddy] Surface valid points:', validCount, '/', res * res, 'for:', obj.expression);
    }

    const trace = {
      type:'surface', x,y,z, name:obj.name||obj.expression, opacity:obj.opacity, showscale:false,
      hovertemplate:`<b>%{fullData.name}</b><br>X:%{x:.3f} Y:%{y:.3f} Z:%{z:.3f}<extra></extra>`,
      // Plotly handles null values as gaps — no extra config needed
      connectgaps: false,
    };

    if (curvature && sc.length) {
      trace.surfacecolor = sc;
      trace.colorscale = [[0,'#3b82f6'],[0.5,'#10b981'],[1,'#ef4444']];
      trace.showscale = true;
      trace.colorbar = { title:'K', thickness:10, len:0.4, tickfont:{size:10,color:'#94a3b8'} };
    } else {
      trace.colorscale = [[0,hex2rgba(obj.color,0.12)],[1,obj.color]];
    }
    return trace;
  }, [dSet, getExpr]);

  const genParametric = useCallback((obj, currentVars) => {
    const { resolution } = dSet;
    const parts = {};
    obj.expression.split(',').forEach(p => {
      const m = p.trim().match(/^([xyz])\s*=\s*(.+)$/i);
      if (m) parts[m[1].toLowerCase()] = m[2].trim();
    });
    const ex = getExpr(parts.x||'u','parametric');
    const ey = getExpr(parts.y||'v','parametric');
    const ez = getExpr(parts.z||'0','parametric');
    if (ex.error||ey.error||ez.error) return null;
    const x=[],y=[],z=[];
    let validCount = 0;
    for (let i=0;i<resolution;i++) {
      const xr=[],yr=[],zr=[];
      const u = -Math.PI + (i/(resolution-1))*2*Math.PI;
      for (let j=0;j<resolution;j++) {
        const v = -Math.PI + (j/(resolution-1))*2*Math.PI;
        const sc = { u,v,...currentVars };
        const xv = ex.eval(sc), yv = ey.eval(sc), zv = ez.eval(sc);
        xr.push(xv); yr.push(yv); zr.push(zv);
        if (xv !== null && yv !== null && zv !== null) validCount++;
      }
      x.push(xr); y.push(yr); z.push(zr);
    }
    if (validCount === 0) return null;
    return {
      type:'surface', x,y,z, name:obj.name||'Parametric',
      colorscale:[[0,hex2rgba(obj.color,0.12)],[1,obj.color]], opacity:obj.opacity, showscale:false,
      connectgaps: false,
    };
  }, [dSet, getExpr]);

  const genCurve = useCallback((obj, currentVars) => {
    const parts = {};
    obj.expression.split(',').forEach(p => {
      const m = p.trim().match(/^([xyz])\s*=\s*(.+)$/i);
      if (m) parts[m[1].toLowerCase()] = m[2].trim();
    });
    const ex=getExpr(parts.x||'t','curve'), ey=getExpr(parts.y||'0','curve'), ez=getExpr(parts.z||'0','curve');
    if (ex.error||ey.error||ez.error) return null;
    const x=[],y=[],z=[];
    for (let i=0;i<800;i++) {
      const t = -10 + (i/799)*20;
      const sc = { t,...currentVars };
      const xv=ex.eval(sc), yv=ey.eval(sc), zv=ez.eval(sc);
      if (xv!==null&&yv!==null&&zv!==null) { x.push(xv);y.push(yv);z.push(zv); }
    }
    if (x.length === 0) return null;
    return { type:'scatter3d', mode:'lines', x,y,z, name:obj.name||'Curve', line:{ color:obj.color, width:4 } };
  }, [getExpr]);

  const genImplicit = useCallback((obj, currentVars) => {
    const { xMin,xMax,yMin,yMax,zMin,zMax } = dSet;
    const e = getExpr(obj.expression,'implicit');
    if (e.error) return null;
    const res=22, xs=[],ys=[],zs=[],vs=[];
    for (let i=0;i<res;i++) for (let j=0;j<res;j++) for (let k=0;k<res;k++) {
      const xv=xMin+(i/(res-1))*(xMax-xMin), yv=yMin+(j/(res-1))*(yMax-yMin), zv=zMin+(k/(res-1))*(zMax-zMin);
      const v=e.eval({x:xv,y:yv,z:zv,...currentVars});
      xs.push(xv);ys.push(yv);zs.push(zv);vs.push(v??0);
    }
    return {
      type:'isosurface', x:xs,y:ys,z:zs, value:vs,
      isomin:-0.5,isomax:0.5, surface:{show:true,count:1,fill:0.9},
      colorscale:[[0,hex2rgba(obj.color,0.3)],[1,obj.color]], showscale:false, opacity:obj.opacity,
      caps:{x:{show:false},y:{show:false},z:{show:false}}, name:obj.name||'Implicit',
    };
  }, [dSet, getExpr]);

  const genVector = useCallback((obj, currentVars) => {
    const { xMin,xMax,yMin,yMax,zMin,zMax } = dSet;
    const parts = {};
    obj.expression.split(',').forEach(p => {
      const m = p.trim().match(/^([PQR])\s*=\s*(.+)$/i);
      if (m) parts[m[1].toUpperCase()] = m[2].trim();
    });
    const fp=getExpr(parts.P||'0','vector'), fq=getExpr(parts.Q||'0','vector'), fr=getExpr(parts.R||'0','vector');
    if (fp.error||fq.error||fr.error) return null;
    const x=[],y=[],z=[],u=[],v=[],w=[];
    const res=8;
    for (let i=0;i<res;i++) for (let j=0;j<res;j++) for (let k=0;k<res;k++) {
      const xv=xMin+(i/(res-1))*(xMax-xMin), yv=yMin+(j/(res-1))*(yMax-yMin), zv=zMin+(k/(res-1))*(zMax-zMin);
      const sc={x:xv,y:yv,z:zv,...currentVars};
      const pv=fp.eval(sc),qv=fq.eval(sc),rv=fr.eval(sc);
      if (pv!==null&&qv!==null&&rv!==null) { x.push(xv);y.push(yv);z.push(zv);u.push(pv);v.push(qv);w.push(rv); }
    }
    if (x.length === 0) return null;
    return {
      type:'cone', x,y,z,u,v,w, sizemode:'absolute', sizeref:0.3, anchor:'tail',
      colorscale:[[0,obj.color],[1,obj.color]], showscale:false, opacity:obj.opacity, name:obj.name||'Vector Field',
    };
  }, [dSet, getExpr]);

  const genComplex = useCallback((obj, currentVars) => {
    const { xMin,xMax,yMin,yMax,resolution } = dSet;
    const e = getExpr(obj.expression,'complex');
    if (e.error) return null;
    const res=Math.min(resolution,48), x=[],y=[],z=[],sc=[];
    let validCount = 0;
    for (let i=0;i<res;i++) {
      const xr=[],yr=[],zr=[],cr=[];
      const xv=xMin+(i/(res-1))*(xMax-xMin);
      for (let j=0;j<res;j++) {
        const yv=yMin+(j/(res-1))*(yMax-yMin);
        const scope={x:xv,y:yv,z:math.complex(xv,yv),...currentVars};
        let mag=0,phase=0;
        try {
          const r=e.eval(scope);
          if (typeof r==='object'&&r&&'re'in r) {
            mag=Math.sqrt(r.re**2+(r.im||0)**2);
            phase=Math.atan2(r.im||0,r.re);
            validCount++;
          } else if (typeof r==='number' && isFinite(r)) {
            mag=Math.abs(r);
            phase=r>=0?0:Math.PI;
            validCount++;
          }
        } catch {}
        xr.push(xv); yr.push(yv); zr.push(Math.min(mag,10)); cr.push((phase+Math.PI)/(2*Math.PI));
      }
      x.push(xr);y.push(yr);z.push(zr);sc.push(cr);
    }
    if (validCount === 0) return null;
    return {
      type:'surface', x,y,z, surfacecolor:sc,
      colorscale:[[0,'#ef4444'],[0.17,'#f59e0b'],[0.33,'#84cc16'],[0.5,'#10b981'],[0.67,'#06b6d4'],[0.83,'#3b82f6'],[1,'#8b5cf6']],
      opacity:obj.opacity, showscale:true, colorbar:{title:'Phase',thickness:10,len:0.4},
      name:obj.name||'Complex',
    };
  }, [dSet, getExpr]);

  /* ── plotData ───────────────────────────────────────────────────
     Use liveVarsRef.current at evaluation time, trigger via varsTick.
  ─────────────────────────────────────────────────────────────── */
  const [varsTick, setVarsTick] = useState(0);

  useEffect(() => {
    setVarsTick(t => t + 1);
  }, [vars]);

  // FIX 4: Validate plot data before passing to Plotly
  const plotData = useMemo(() => {
    const currentVars = liveVarsRef.current;
    const out = [];

    dObj.filter(o=>o.visible).forEach(obj => {
      try {
        let t;
        if (obj.type==='surface')         t = genSurface(obj, currentVars);
        else if (obj.type==='parametric') t = genParametric(obj, currentVars);
        else if (obj.type==='curve')      t = genCurve(obj, currentVars);
        else if (obj.type==='implicit')   t = genImplicit(obj, currentVars);
        else if (obj.type==='vector')     t = genVector(obj, currentVars);
        else if (obj.type==='complex')    t = genComplex(obj, currentVars);

        if (!t) return; // Generator already returned null — skip

        // FIX 4: Ensure trace has data before pushing
        const hasData = (
          // Surface / parametric / complex: nested arrays
          (t.x && Array.isArray(t.x[0]) && t.x.some(row => row.some(v => v !== null && v !== undefined))) ||
          // Curve / scatter3d: flat arrays
          (t.x && Array.isArray(t.x) && !Array.isArray(t.x[0]) && t.x.length > 0) ||
          // Isosurface / implicit: value array
          (t.value && t.value.length > 0)
        );

        if (hasData) {
          out.push(t);
        } else {
          console.warn('[StudyBuddy] Trace has no renderable data:', obj.expression);
        }
      } catch (err) { console.warn('[StudyBuddy] Mesh generation error:', obj.expression, err); }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudyBuddy] Generated traces:', out.length);
    }

    return out;
  }, [dObj, dSet, varsTick, genSurface, genParametric, genCurve, genImplicit, genVector, genComplex]);

  /* ── layout ─────────────────────────────────────────────────── */
  const layout = useMemo(() => ({
    paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
    font:{ color:'#f8fafc', family:'Nunito, sans-serif', size:12 },
    scene:{
      bgcolor:'rgba(15,15,35,0.55)',
      aspectmode:'cube',
      xaxis:{ range:[dSet.xMin,dSet.xMax], showgrid:dSet.showGrid, gridcolor:'rgba(244,114,182,0.15)',
        showline:dSet.showAxes, linecolor:'rgba(244,114,182,0.5)', linewidth:2,
        zerolinecolor:'rgba(244,114,182,0.4)', zerolinewidth:2, color:'#94a3b8',
        title:{ text:'X', font:{color:'#f472b6',size:13} } },
      yaxis:{ range:[dSet.yMin,dSet.yMax], showgrid:dSet.showGrid, gridcolor:'rgba(168,85,247,0.15)',
        showline:dSet.showAxes, linecolor:'rgba(168,85,247,0.5)', linewidth:2,
        zerolinecolor:'rgba(168,85,247,0.4)', zerolinewidth:2, color:'#94a3b8',
        title:{ text:'Y', font:{color:'#a855f7',size:13} } },
      zaxis:{ range:[dSet.zMin,dSet.zMax], showgrid:dSet.showGrid, gridcolor:'rgba(251,113,133,0.15)',
        showline:dSet.showAxes, linecolor:'rgba(251,113,133,0.5)', linewidth:2,
        zerolinecolor:'rgba(251,113,133,0.4)', zerolinewidth:2, color:'#94a3b8',
        title:{ text:'Z', font:{color:'#fb7185',size:13} } },
      camera: cameraRef.current,
      hoverlabel:{ bgcolor:'rgba(15,15,35,0.95)', bordercolor:'rgba(139,92,246,0.4)', font:{color:'#fff',size:12} },
    },
    margin:{ l:0,r:0,t:8,b:0 },
    showlegend:true,
    legend:{ x:0.02,y:0.98, bgcolor:'rgba(15,15,35,0.8)', bordercolor:'rgba(139,92,246,0.2)', borderwidth:1, font:{color:'#e2e8f0',size:11} },
  }), [dSet]);

  /* ── CRUD ──────────────────────────────────────────────────── */
  const addObj = useCallback(() => {
    if (!newExpr.trim()) return;

    // Validate using MathExpr parser before committing
    const test = new MathExpr(newExpr.trim(), activeTab);
    if (test.error) {
      alert(`⚠️ Invalid expression: ${test.error}`);
      return;
    }

    const obj = {
      id:nextId, expression:newExpr.trim(), type:activeTab,
      color:PALETTE[(nextId-1)%PALETTE.length], visible:true, opacity:0.85,
      name:`${activeTab} ${nextId}`,
    };
    const next=[...objects,obj];
    setObjects(next); setNextId(n=>n+1); setNewExpr('');
    pushHist({ objects:next, settings, vars });
  }, [newExpr,activeTab,nextId,objects,settings,vars,pushHist]);

  const updateObj = useCallback((id,patch) => {
    setObjects(prev=>{
      const next=prev.map(o=>o.id===id?{...o,...patch}:o);
      // Clear stale cache when expression changes
      if (patch.expression !== undefined) {
        const old = prev.find(o=>o.id===id);
        if (old) exprCache.current.delete(old.expression+'|'+old.type);
      }
      return next;
    });
  }, []);

  const deleteObj = useCallback((id) => {
    const next=objects.filter(o=>o.id!==id);
    setObjects(next); if(selId===id) setSelId(null);
    pushHist({objects:next,settings,vars});
  }, [objects,selId,settings,vars,pushHist]);

  /* ── math info panel ────────────────────────────────────────── */
  const computeMath = (obj) => {
    if (obj.type!=='surface') return null;
    const e = new MathExpr(obj.expression,'surface');
    if (e.error) return { error:e.error };
    const scope = { x:0, y:0, ...liveVarsRef.current };
    const fx=e.dX(scope), fy=e.dY(scope);
    const K=gaussK(obj.expression,0,0,liveVarsRef.current);
    const cl = K>0.01?'Elliptic (dome/bowl)':K<-0.01?'Hyperbolic (saddle)':'Parabolic';
    return { fx, fy, grad:fx!==null&&fy!==null?Math.sqrt(fx*fx+fy*fy):null, K, cl };
  };

  /* ── export / import ─────────────────────────────────────────── */
  const exportJSON = () => {
    const blob=new Blob([JSON.stringify({objects,settings,vars},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`3d-graph-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url); setCopied(true); setTimeout(()=>setCopied(false),2000);
  };
  const importJSON = e => {
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload = ev => {
      try {
        const d=JSON.parse(ev.target.result);
        if(d.objects) setObjects(d.objects);
        if(d.settings) setSettings(d.settings);
        if(d.vars) setVars(d.vars);
        exprCache.current.clear();
      } catch {}
    };
    r.readAsText(file);
  };

  /* ── camera presets ──────────────────────────────────────────── */
  const setCamera = eye => { cameraRef.current={eye}; setSettings(s=>({...s})); };

  /* ── derived ─────────────────────────────────────────────────── */
  const tabObjs = useMemo(()=>objects.filter(o=>o.type===activeTab),[objects,activeTab]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="g3d-root">
      <Helmet>
        <title>3D Graphing Calculator — StudyBuddy</title>
        <meta name="description" content="Interactive 3D graphing: surfaces, parametric, curves, vector fields, complex domain coloring."/>
        <meta name="robots" content="noindex"/>
      </Helmet>

      {/* ── math analysis overlay ─────────────────────────────── */}
      {mathPanel && (
        <div className="g3d-overlay" onClick={()=>setMathPanel(null)}>
          <div className="g3d-math-panel glass-card" onClick={e=>e.stopPropagation()}>
            <div className="g3d-math-head">
              <span className="g3d-math-title">∂ Analysis</span>
              <button className="icon-btn" onClick={()=>setMathPanel(null)}><X size={14}/></button>
            </div>
            {(() => {
              const info = computeMath(mathPanel.obj);
              if (!info) return <p className="g3d-math-note">Only available for z = f(x,y) surfaces.</p>;
              if (info.error) return <p className="g3d-math-note g3d-math-note--err">Error: {info.error}</p>;
              return (
                <div className="g3d-math-rows">
                  <div className="g3d-math-row"><span>∂z/∂x at (0,0)</span><code>{info.fx?.toFixed(4)??'N/A'}</code></div>
                  <div className="g3d-math-row"><span>∂z/∂y at (0,0)</span><code>{info.fy?.toFixed(4)??'N/A'}</code></div>
                  <div className="g3d-math-row"><span>|∇f| at (0,0)</span><code>{info.grad?.toFixed(4)??'N/A'}</code></div>
                  <div className="g3d-math-row"><span>Gaussian K</span><code>{info.K?.toFixed(4)??'N/A'}</code></div>
                  <div className="g3d-math-row"><span>Classification</span><span className="g3d-badge">{info.cl}</span></div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── sidebar ───────────────────────────────────────────── */}
      <aside className={`g3d-sidebar glass-card${sidebar?'':' g3d-sidebar--closed'}`}>
        <button className="g3d-collapse-btn icon-btn" onClick={()=>setSidebar(s=>!s)} aria-label="Toggle sidebar">
          {sidebar ? <ChevronLeft size={15}/> : <ChevronRight size={15}/>}
        </button>

        {sidebar && (<>

          {/* header */}
          <div className="g3d-hd">
            <h1 className="pookie-display-title g3d-title">3D Grapher</h1>
            <div className="g3d-hd-actions">
              <button onClick={undo} disabled={hIdx<=0} className="icon-btn" title="Undo (Ctrl+Z)"><Undo2 size={13}/></button>
              <button onClick={redo} disabled={hIdx>=history.length-1} className="icon-btn" title="Redo (Ctrl+Y)"><Redo2 size={13}/></button>
              <button onClick={()=>setAnim(a=>({...a,on:!a.on}))} className={`icon-btn${anim.on?' g3d-btn-active':''}`} title="Play/Pause (Space)">
                {anim.on?<Pause size={13}/>:<Play size={13}/>}
              </button>
              <button onClick={()=>{ cameraRef.current={eye:{x:1.5,y:1.5,z:1.5}}; setSettings(s=>({...s})); }} className="icon-btn" title="Reset view"><RotateCcw size={13}/></button>
              <button onClick={()=>setShowCfg(s=>!s)} className={`icon-btn${showCfg?' g3d-btn-active':''}`} title="Settings"><Settings2 size={13}/></button>
              <button onClick={exportJSON} className="icon-btn" title="Export JSON">{copied?<Check size={13}/>:<Download size={13}/>}</button>
              <label className="icon-btn" title="Import JSON" style={{cursor:'pointer'}}>
                <Upload size={13}/>
                <input type="file" accept=".json" onChange={importJSON} style={{display:'none'}}/>
              </label>
            </div>
          </div>

          {/* settings panel */}
          {showCfg && (
            <div className="g3d-cfg glass-card-sm">
              <p className="field-label" style={{color:'var(--pookie-pink)'}}>Bounds &amp; Resolution</p>
              {[['X','xMin','xMax'],['Y','yMin','yMax'],['Z','zMin','zMax']].map(([ax,mn,mx])=>(
                <div key={ax} className="g3d-bound-row">
                  <span className="g3d-ax-label">{ax}</span>
                  <input type="number" className="field-input g3d-num-input" value={settings[mn]}
                    onChange={e=>setSettings(s=>({...s,[mn]:parseFloat(e.target.value)||s[mn]}))} step="1"/>
                  <span className="g3d-arrow">→</span>
                  <input type="number" className="field-input g3d-num-input" value={settings[mx]}
                    onChange={e=>setSettings(s=>({...s,[mx]:parseFloat(e.target.value)||s[mx]}))} step="1"/>
                </div>
              ))}
              <div className="g3d-res-row">
                <span className="field-label" style={{margin:0}}>Res: {settings.resolution}</span>
                <input type="range" min="15" max="80" value={settings.resolution}
                  onChange={e=>setSettings(s=>({...s,resolution:parseInt(e.target.value)}))} className="g3d-slider"/>
              </div>
              <div className="g3d-toggles">
                {[['showGrid','Grid'],['showAxes','Axes'],['curvature','Curvature']].map(([k,lb])=>(
                  <label key={k} className="g3d-toggle">
                    <input type="checkbox" checked={settings[k]} onChange={e=>setSettings(s=>({...s,[k]:e.target.checked}))}/>
                    <span>{lb}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* CAS loader — shows only while Pyodide is downloading */}
          <CASLoader status={casStatus} progress={casProgress} />

          {/* type tabs */}
          <div className="g3d-tabs">
            {TYPES.map(({id,label,Icon})=>(
              <button key={id} className={`g3d-tab${activeTab===id?' g3d-tab--active':''}`} onClick={()=>setTab(id)}>
                <Icon size={12}/><span>{label}</span>
              </button>
            ))}
          </div>

          {/* add expression */}
          <div className="g3d-add-row">
            <textarea
              className="field-input g3d-expr-ta" rows={2} value={newExpr}
              onChange={e=>setNewExpr(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();addObj();} }}
              placeholder={TYPES.find(t=>t.id===activeTab)?.ph}
            />
            <button onClick={addObj} className="btn-primary g3d-add-btn" disabled={!newExpr.trim()}><Plus size={16}/></button>
          </div>

          {/* expression list */}
          <div className="g3d-list">
            {tabObjs.length===0 && (
              <div className="g3d-empty">
                <p>No {activeTab} plots yet.</p>
                <p style={{fontSize:'0.75rem'}}>Type an expression above ↑</p>
              </div>
            )}
            {tabObjs.map(obj=>{
              const cached = exprCache.current.get(obj.expression+'|'+obj.type);
              const hasErr = cached?.error;
              return (
                <div
                  key={obj.id}
                  className={`g3d-card glass-card-sm${selId===obj.id?' g3d-card--sel':''}${hasErr?' g3d-card--err':''}`}
                  onClick={()=>setSelId(obj.id===selId?null:obj.id)}
                >
                  <div className="g3d-card-hd">
                    <label className="g3d-swatch" style={{background:obj.color}}>
                      <input type="color" value={obj.color}
                        onChange={e=>{e.stopPropagation();updateObj(obj.id,{color:e.target.value});}}
                        onClick={e=>e.stopPropagation()}/>
                    </label>
                    <span className="g3d-type-tag" style={{background:hex2rgba(obj.color,0.18),color:obj.color}}>{obj.type}</span>
                    {hasErr && <span className="g3d-err-dot" title={cached.error}>!</span>}
                    <div style={{flex:1}}/>
                    {obj.type==='surface' && (
                      <button onClick={e=>{e.stopPropagation();setMathPanel({obj});}} className="icon-btn" title="Math analysis" style={{width:26,height:26}}>∂</button>
                    )}
                    <button
                      onClick={e=>{e.stopPropagation();updateObj(obj.id,{visible:!obj.visible});}}
                      className={`icon-btn${obj.visible?'':' g3d-hidden'}`} title="Toggle visibility"
                    >
                      {obj.visible?<Eye size={12}/>:<EyeOff size={12}/>}
                    </button>
                    <button onClick={e=>{e.stopPropagation();deleteObj(obj.id);}}
                      className="icon-btn icon-btn--danger" title="Delete"><Trash2 size={12}/></button>
                  </div>
                  <textarea
                    className="field-input g3d-expr-edit" rows={2} value={obj.expression}
                    onChange={e=>{
                      updateObj(obj.id,{expression:e.target.value});
                      exprCache.current.delete(obj.expression+'|'+obj.type);
                    }}
                    onClick={e=>e.stopPropagation()}
                  />
                  {(obj.type==='surface'||obj.type==='parametric'||obj.type==='implicit'||obj.type==='complex') && (
                    <div className="g3d-opacity-row">
                      <span className="field-label" style={{margin:0,fontSize:'0.68rem'}}>Opacity</span>
                      <input type="range" min="0.1" max="1" step="0.05" value={obj.opacity}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>updateObj(obj.id,{opacity:parseFloat(e.target.value)})}
                        className="g3d-slider"/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* variable sliders */}
          {Object.keys(vars).length > 0 && (
            <div className="g3d-vars glass-card-sm">
              <p className="field-label" style={{color:'var(--pookie-pink)'}}>Variables</p>
              {Object.keys(vars).map(name=>(
                <div key={name} className="g3d-var">
                  <div className="g3d-var-hd">
                    <span className="g3d-var-name">{name} = {(vars[name]||0).toFixed(2)}</span>
                    <button
                      onClick={()=>setAnim(a=>({...a,param:name,on:true}))}
                      className={`icon-btn${anim.param===name&&anim.on?' g3d-btn-active':''}`}
                      style={{width:24,height:24}} title={`Animate ${name}`}
                    ><RotateCw size={10}/></button>
                  </div>
                  <input type="range" min="-10" max="10" step="0.1" value={vars[name]||0}
                    onChange={e=>{
                      const v=parseFloat(e.target.value);
                      liveVarsRef.current={...liveVarsRef.current,[name]:v};
                      setVars(p=>({...p,[name]:v}));
                    }}
                    className="g3d-slider"/>
                </div>
              ))}
              {anim.on && (
                <div className="g3d-var">
                  <div className="g3d-var-hd"><span className="g3d-var-name">Speed: {anim.speed.toFixed(1)}×</span></div>
                  <input type="range" min="0.1" max="5" step="0.1" value={anim.speed}
                    onChange={e=>setAnim(a=>({...a,speed:parseFloat(e.target.value)}))} className="g3d-slider"/>
                </div>
              )}
            </div>
          )}

          {/* examples */}
          <div className="g3d-examples glass-card-sm">
            <p className="field-label" style={{color:'var(--pookie-pink)'}}>Examples</p>
            <div className="g3d-ex-list">
              {(EXAMPLES[activeTab]||[]).map((ex,i)=>(
                <button key={i} className="btn-ghost g3d-ex-btn" onClick={()=>setNewExpr(ex)}>
                  {ex.length>34?ex.slice(0,34)+'…':ex}
                </button>
              ))}
            </div>
          </div>

        </>)}
      </aside>

      {/* ── main graph canvas ─────────────────────────────────── */}
      <main className="g3d-canvas">

        {/* info bar */}
        <div className="g3d-info glass-card-sm">
          <span>Objects: {objects.filter(o=>o.visible).length}/{objects.length}</span>
          <span>Res: {settings.resolution}²</span>
          {anim.on && <span className="g3d-anim-dot">● {anim.param}</span>}
        </div>

        {/* FIX 5: Added glScale and plotGlPixelRatio to suppress WebGL warnings */}
        <Plot
          data={plotData}
          layout={layout}
          config={{
            responsive:true,
            displayModeBar:true,
            modeBarButtonsToRemove:['resetCameraDefault3d','resetCameraLastSave3d','hoverClosest3d'],
            displaylogo:false,
            glScale: 1,
            plotGlPixelRatio: 1,
          }}
          style={{ width:'100%', height:'100%' }}
          onRelayout={ev=>{ if(ev['scene.camera']) cameraRef.current=ev['scene.camera']; }}
        />

        {/* camera presets */}
        <div className="g3d-view-btns">
          {[['Front',{x:2.5,y:0,z:0}],['Side',{x:0,y:2.5,z:0}],['Top',{x:0,y:0,z:2.5}],['ISO',{x:1.5,y:1.5,z:1.5}]].map(([lb,eye])=>(
            <button key={lb} className="btn-ghost g3d-view-btn" onClick={()=>setCamera(eye)}>{lb}</button>
          ))}
        </div>

      </main>
    </div>
  );
}