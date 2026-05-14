import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaTimes, FaCheck, FaTrash, FaEdit } from "react-icons/fa";
import {
  LuSprout, LuFlame, LuSparkles, LuTarget,
  LuTrendingUp, LuZap, LuLeaf, LuTreePine,
  LuWifi, LuWifiOff,
} from "react-icons/lu";
import { db, auth } from "../components/firebase";
import {
  doc, setDoc, serverTimestamp, onSnapshot, 
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-hot-toast";
import "./HabitStacking.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const OFFLINE_KEY      = "habitStack_offlineQueue";
const CACHE_KEY_PREFIX = "habitStack_cache_";
const GRACE_WINDOW     = 7;

const QUOTES = [
  { text: "First forget inspiration. Habit is more dependable.", author: "Octavia Butler" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "Motivation gets you started. Habit keeps you going.", author: "Jim Ryun" },
  { text: "Small habits make a big difference.", author: "Anonymous" },
  { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
];

const STEP_META = [
  { key: "anchor", emoji: "⚓", label: "Anchor",  color: "#f472b6", hint: "An existing habit you already do reliably every day." },
  { key: "habit",  emoji: "📚", label: "Habit",   color: "#a855f7", hint: "The new habit you want to attach to that anchor."     },
  { key: "reward", emoji: "🎁", label: "Reward",  color: "#34d399", hint: "A small celebration to reinforce the behaviour."      },
];

const ANCHOR_SUGGESTIONS = ["Wake up", "Morning coffee", "After lunch", "Before bed", "After shower"];
const HABIT_SUGGESTIONS  = ["Read 10 pages", "Meditate 5 min", "Flashcard review", "Journal", "Exercise"];
const REWARD_SUGGESTIONS = ["Favourite snack", "Watch one video", "5-min walk", "Stretch break"];
const ALL_SUGGESTIONS    = [ANCHOR_SUGGESTIONS, HABIT_SUGGESTIONS, REWARD_SUGGESTIONS];

const TREE_SPECIES = [
  {
    key: "willow",
    name: "Weeping Willow",
    label: "🌳 Willow",
    trunkColor: "#8b5cf6",
    leafColor: "#a78bfa",
    blossomColor: "#c4b5fd",
    accentColor: "#7c3aed",
    dna: { trunkWidth: 6, canopySpread: 1.4, leafShape: "drooping", branchStyle: "weeping", groundGlow: "#8b5cf6" },
  },
  {
    key: "oak",
    name: "Mighty Oak",
    label: "🌲 Oak",
    trunkColor: "#059669",
    leafColor: "#34d399",
    blossomColor: "#6ee7b7",
    accentColor: "#047857",
    dna: { trunkWidth: 10, canopySpread: 1.2, leafShape: "round", branchStyle: "sturdy", groundGlow: "#059669" },
  },
  {
    key: "cherry",
    name: "Cherry Blossom",
    label: "🌸 Cherry",
    trunkColor: "#ec4899",
    leafColor: "#f472b6",
    blossomColor: "#fbcfe8",
    accentColor: "#db2777",
    dna: { trunkWidth: 5, canopySpread: 1.1, leafShape: "petal", branchStyle: "delicate", groundGlow: "#ec4899" },
  },
  {
    key: "maple",
    name: "Autumn Maple",
    label: "🍁 Maple",
    trunkColor: "#ea580c",
    leafColor: "#fb923c",
    blossomColor: "#fdba74",
    accentColor: "#c2410c",
    dna: { trunkWidth: 7, canopySpread: 1.15, leafShape: "pointed", branchStyle: "spreading", groundGlow: "#ea580c" },
  },
  {
    key: "pine",
    name: "Evergreen Pine",
    label: "🌲 Pine",
    trunkColor: "#0891b2",
    leafColor: "#22d3ee",
    blossomColor: "#67e8f9",
    accentColor: "#0e7490",
    dna: { trunkWidth: 5, canopySpread: 0.7, leafShape: "needle", branchStyle: "conical", groundGlow: "#0891b2" },
  },
  {
    key: "baobab",
    name: "Baobab",
    label: "🌴 Baobab",
    trunkColor: "#d97706",
    leafColor: "#fbbf24",
    blossomColor: "#fde68a",
    accentColor: "#b45309",
    dna: { trunkWidth: 14, canopySpread: 0.6, leafShape: "oval", branchStyle: "bottle", groundGlow: "#d97706" },
  },
  {
    key: "birch",
    name: "Silver Birch",
    label: "🌿 Birch",
    trunkColor: "#94a3b8",
    leafColor: "#a3e635",
    blossomColor: "#d9f99d",
    accentColor: "#64748b",
    dna: { trunkWidth: 4, canopySpread: 0.9, leafShape: "diamond", branchStyle: "upright", groundGlow: "#94a3b8" },
  },
  {
    key: "wisteria",
    name: "Wisteria Vine",
    label: "🪻 Wisteria",
    trunkColor: "#7e22ce",
    leafColor: "#a855f7",
    blossomColor: "#e9d5ff",
    accentColor: "#6b21a8",
    dna: { trunkWidth: 4, canopySpread: 1.3, leafShape: "cluster", branchStyle: "twisted", groundGlow: "#7e22ce" },
  },
  {
    key: "palm",
    name: "Tropical Palm",
    label: "🌴 Palm",
    trunkColor: "#14b8a6",
    leafColor: "#2dd4bf",
    blossomColor: "#5eead4",
    accentColor: "#0f766e",
    dna: { trunkWidth: 4, canopySpread: 1.0, leafShape: "fan", branchStyle: "columnar", groundGlow: "#14b8a6" },
  },
  {
    key: "bonsai",
    name: "Zen Bonsai",
    label: "🎋 Bonsai",
    trunkColor: "#be123c",
    leafColor: "#f43f5e",
    blossomColor: "#fda4af",
    accentColor: "#9f1239",
    dna: { trunkWidth: 5, canopySpread: 0.5, leafShape: "mini", branchStyle: "gnarled", groundGlow: "#be123c" },
  },
];

function seededRandom(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = ((x << 5) - x + seed.charCodeAt(i)) | 0;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

function pickRandomSpecies() {
  return TREE_SPECIES[Math.floor(Math.random() * TREE_SPECIES.length)].key;
}

function getSpecies(key) {
  return TREE_SPECIES.find((s) => s.key === key) || TREE_SPECIES[0];
}

function getTreeStage(streak) {
  if (streak >= 7) return 2;
  if (streak >= 3) return 1;
  return 0;
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateKeyFromOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDots(completions = {}) {
  return Array.from({ length: 7 }, (_, i) => {
    const key = dateKeyFromOffset(-(6 - i));
    const d   = new Date(); d.setDate(d.getDate() - (6 - i));
    return { label: DAYS[d.getDay()], done: !!completions[key], key };
  });
}

function recalcStreak(completions = {}) {
  let current = 0;
  const d = new Date();
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (completions[key]) { current++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return current;
}

function getGraceUsed(habit) {
  let missed = 0;
  for (let i = 1; i < GRACE_WINDOW; i++) {
    const key = dateKeyFromOffset(-i);
    if (!habit.completions?.[key]) missed++;
  }
  return missed;
}

async function syncToFirebase(userId, habits) {
  if (!userId) return false;
  try {
    await setDoc(
      doc(db, "users", userId, "habitStack", "default"),
      { userId, habits, updatedAt: serverTimestamp() },
      { merge: true }
    );
    localStorage.removeItem(OFFLINE_KEY);
    return true;
  } catch (err) {
    console.warn("Firebase offline — queueing to localStorage", err);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify({ userId, habits, timestamp: Date.now() }));
    return false;
  }
}

const HabitHeatmap = React.memo(function HabitHeatmap({ completions, speciesKey }) {
  const species = getSpecies(speciesKey);
  const days = useMemo(() => {
    const list = [];
    for (let i = 83; i >= 0; i--) {
      const key = dateKeyFromOffset(-i);
      const d   = new Date(); d.setDate(d.getDate() - i);
      list.push({ key, done: !!completions[key], day: d.getDay() });
    }
    return list;
  }, [completions]);

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
    return w;
  }, [days]);

  const totalDone = useMemo(() => days.filter((d) => d.done).length, [days]);

  return (
    <div className="hs-heatmap">
      <div className="hs-heatmap__header">
        <span className="hs-heatmap__title">Last 12 weeks</span>
        <span className="hs-heatmap__count" style={{ color: species.accentColor }}>{totalDone} days completed</span>
      </div>
      <div className="hs-heatmap__grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="hs-heatmap__col">
            {week.map((day, di) => (
              <div
                key={di}
                className={`hs-heatmap__cell${day.done ? " hs-heatmap__cell--done" : ""}`}
                style={{ background: day.done ? species.accentColor : undefined }}
                title={`${day.key}${day.done ? " ✓" : ""}`}
                aria-label={`${day.key}: ${day.done ? "completed" : "not done"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

function LeafPath({ type, x, y, size, color, rotation = 0 }) {
  const transforms = `rotate(${rotation}, ${x}, ${y})`;

  switch (type) {
    case "drooping":
      return (
        <path d={`M${x} ${y} Q${x - 3} ${y + size * 1.5} ${x} ${y + size * 2.2} Q${x + 3} ${y + size * 1.5} ${x} ${y}`}
          fill={color} opacity="0.75" transform={transforms} />
      );
    case "round":
      return (
        <ellipse cx={x} cy={y} rx={size} ry={size * 0.7}
          fill={color} opacity="0.8" transform={transforms} />
      );
    case "petal":
      return (
        <path d={`M${x} ${y - size} C${x - size} ${y - size * 0.3},${x - size} ${y + size * 0.3},${x} ${y + size * 0.5} C${x + size} ${y + size * 0.3},${x + size} ${y - size * 0.3},${x} ${y - size}`}
          fill={color} opacity="0.85" transform={transforms} />
      );
    case "pointed":
      return (
        <path d={`M${x} ${y - size} L${x + size * 0.3} ${y - size * 0.2} L${x + size} ${y} L${x + size * 0.3} ${y + size * 0.3} L${x} ${y + size} L${x - size * 0.3} ${y + size * 0.3} L${x - size} ${y} L${x - size * 0.3} ${y - size * 0.2} Z`}
          fill={color} opacity="0.8" transform={transforms} />
      );
    case "needle":
      return (
        <g transform={transforms}>
          <line x1={x} y1={y} x2={x} y2={y + size * 1.5} stroke={color} strokeWidth="1.5" opacity="0.9" />
          <line x1={x} y1={y + size * 0.3} x2={x - size * 0.4} y2={y + size} stroke={color} strokeWidth="1" opacity="0.8" />
          <line x1={x} y1={y + size * 0.3} x2={x + size * 0.4} y2={y + size} stroke={color} strokeWidth="1" opacity="0.8" />
        </g>
      );
    case "oval":
      return (
        <ellipse cx={x} cy={y} rx={size * 1.2} ry={size * 0.6}
          fill={color} opacity="0.7" transform={transforms} />
      );
    case "diamond":
      return (
        <path d={`M${x} ${y - size} L${x + size * 0.6} ${y} L${x} ${y + size} L${x - size * 0.6} ${y} Z`}
          fill={color} opacity="0.85" transform={transforms} />
      );
    case "cluster":
      return (
        <g transform={transforms}>
          <circle cx={x} cy={y} r={size * 0.4} fill={color} opacity="0.9" />
          <circle cx={x - size * 0.3} cy={y + size * 0.6} r={size * 0.35} fill={color} opacity="0.8" />
          <circle cx={x + size * 0.3} cy={y + size * 0.6} r={size * 0.35} fill={color} opacity="0.8" />
          <circle cx={x} cy={y + size * 1.1} r={size * 0.3} fill={color} opacity="0.7" />
        </g>
      );
    case "fan":
      return (
        <g transform={transforms}>
          {[0, 45, -45, 90, -90].map((angle, i) => (
            <path key={i} d={`M${x} ${y} Q${x + Math.sin(angle * Math.PI / 180) * size} ${y - Math.cos(angle * Math.PI / 180) * size * 0.5} ${x + Math.sin(angle * Math.PI / 180) * size * 1.2} ${y - Math.cos(angle * Math.PI / 180) * size}`}
              fill="none" stroke={color} strokeWidth="2" opacity="0.85" strokeLinecap="round" />
          ))}
        </g>
      );
    case "mini":
      return (
        <circle cx={x} cy={y} r={size * 0.5} fill={color} opacity="0.9" transform={transforms} />
      );
    default:
      return <circle cx={x} cy={y} r={size * 0.6} fill={color} opacity="0.8" />;
  }
}

function SeedlingTree({ isDone, species, habitId }) {
  const c   = species.leafColor;
  const s   = species.trunkColor;
  const dna = species.dna;
  const uid = `${species.key}-${habitId?.slice(-6) || "new"}`;
  const trunkHeight = dna.branchStyle === "bottle" ? 35 : 45;

  return (
    <svg viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id={`sg-ground-${uid}`} cx="50%" cy="0%" r="50%">
          <stop offset="0%" stopColor={isDone ? "#34d399" : s} stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f0f23" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={110} cy={185} rx={50 * dna.canopySpread} ry={8} fill={`url(#sg-ground-${uid})`} />

      <path d={`M${80 * dna.canopySpread} 175 Q110 ${165 - (dna.branchStyle === "bottle" ? 5 : 0)} ${140 * dna.canopySpread} 175`}
        fill="none" stroke={`${s}55`} strokeWidth="2" strokeLinecap="round" />

      {dna.branchStyle === "bottle" ? (
        <rect x={110 - dna.trunkWidth / 2} y={180 - trunkHeight} width={dna.trunkWidth} height={trunkHeight} rx={dna.trunkWidth / 2}
          fill={isDone ? "#34d399" : s} opacity="0.9" />
      ) : dna.branchStyle === "twisted" ? (
        <path d={`M110 174 Q${108} ${150} ${112} ${130}`} fill="none" stroke={isDone ? "#34d399" : s} strokeWidth={dna.trunkWidth * 0.4} strokeLinecap="round" />
      ) : (
        <path d={`M110 174 Q${108} ${150} 110 ${130}`} fill="none" stroke={isDone ? "#34d399" : s} strokeWidth="2.5" strokeLinecap="round" />
      )}

      {dna.leafShape === "needle" ? (
        <g transform={`translate(110, ${130})`}>
          <LeafPath type="needle" x={0} y={0} size={8} color={c} rotation={-15} />
          <LeafPath type="needle" x={0} y={-3} size={8} color={c} rotation={0} />
          <LeafPath type="needle" x={0} y={-6} size={8} color={c} rotation={15} />
        </g>
      ) : dna.leafShape === "fan" ? (
        <LeafPath type="fan" x={110} y={125} size={10} color={c} />
      ) : dna.leafShape === "cluster" ? (
        <LeafPath type="cluster" x={110} y={128} size={6} color={c} />
      ) : (
        <>
          <LeafPath type={dna.leafShape} x={95} y={138} size={7} color={c} rotation={-30} />
          <LeafPath type={dna.leafShape} x={125} y={132} size={7} color={species.blossomColor} rotation={30} />
        </>
      )}

      <text x={110} y={108} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.55)">
        {species.name.toUpperCase()}
      </text>
    </svg>
  );
}

function SaplingTree({ habit, isDone, species, habitId }) {
  const cx  = 110;
  const tc  = species.trunkColor;
  const lc  = species.leafColor;
  const bc  = species.blossomColor;
  const dna = species.dna;
  const uid = `${species.key}-${habitId?.slice(-6) || "new"}`;

  const branchReach = 34 * dna.canopySpread;
  const trunkH      = 52;
  const trunkTop    = 180 - trunkH;

  return (
    <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id={`sp-ground-${uid}`} cx="50%" cy="0%" r="50%">
          <stop offset="0%" stopColor={isDone ? "#34d399" : tc} stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f0f23" stopOpacity="0" />
        </radialGradient>
        <filter id={`sp-glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <ellipse cx={cx} cy={208} rx={55 * dna.canopySpread} ry={9} fill={`url(#sp-ground-${uid})`} />

      {dna.branchStyle === "bottle" ? (
        <g opacity="0.35">
          <path d={`M${cx - 4} 198 Q${cx - 20} 210 ${cx - 35} 208`} fill="none" stroke={tc} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${cx + 4} 198 Q${cx + 20} 212 ${cx + 35} 208`} fill="none" stroke={lc} strokeWidth="3" strokeLinecap="round" />
        </g>
      ) : (
        <g opacity="0.35">
          <path d={`M${cx - 2} 198 Q${cx - 16} 208 ${cx - 28} 206`} fill="none" stroke={tc} strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M${cx + 2} 198 Q${cx + 16} 210 ${cx + 30} 207`} fill="none" stroke={lc} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}

      {dna.branchStyle === "bottle" ? (
        <path d={`M${cx - dna.trunkWidth / 2} ${trunkTop + 20} Q${cx - dna.trunkWidth / 2 - 2} ${trunkTop + 10} ${cx - dna.trunkWidth / 2} ${trunkTop} L${cx + dna.trunkWidth / 2} ${trunkTop} Q${cx + dna.trunkWidth / 2 + 2} ${trunkTop + 10} ${cx + dna.trunkWidth / 2} ${trunkTop + 20} Z`}
          fill={isDone ? "rgba(52,211,153,0.7)" : `${tc}cc`} />
      ) : dna.branchStyle === "twisted" ? (
        <path d={`M${cx - 3} ${trunkTop + 52} Q${cx + 4} ${trunkTop + 35} ${cx - 2} ${trunkTop + 18} Q${cx + 3} ${trunkTop + 8} ${cx} ${trunkTop}`}
          fill="none" stroke={isDone ? "#34d399" : tc} strokeWidth={dna.trunkWidth * 0.5} strokeLinecap="round" />
      ) : (
        <rect x={cx - dna.trunkWidth / 2} y={trunkTop} width={dna.trunkWidth} height={trunkH} rx={dna.trunkWidth / 3}
          fill={isDone ? "rgba(52,211,153,0.7)" : `${tc}cc`}
          style={isDone ? { filter: "drop-shadow(0 0 5px rgba(52,211,153,0.5))" } : { filter: `drop-shadow(0 0 5px ${tc}88)` }} />
      )}

      {dna.branchStyle === "weeping" && (
        <>
          <path d={`M${cx} ${trunkTop} Q${cx - branchReach * 0.7} ${trunkTop + 15} ${cx - branchReach} ${trunkTop + 35}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <path d={`M${cx} ${trunkTop} Q${cx + branchReach * 0.7} ${trunkTop + 15} ${cx + branchReach} ${trunkTop + 35}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <path d={`M${cx} ${trunkTop} L${cx} ${trunkTop - 20}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        </>
      )}

      {dna.branchStyle === "conical" && (
        <>
          <path d={`M${cx} ${trunkTop} L${cx - branchReach * 0.8} ${trunkTop + 25}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" />
          <path d={`M${cx} ${trunkTop} L${cx + branchReach * 0.8} ${trunkTop + 25}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" />
          <path d={`M${cx} ${trunkTop - 8} L${cx - branchReach * 0.5} ${trunkTop + 10}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <path d={`M${cx} ${trunkTop - 8} L${cx + branchReach * 0.5} ${trunkTop + 10}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        </>
      )}

      {dna.branchStyle === "columnar" && (
        <path d={`M${cx} ${trunkTop} L${cx} ${trunkTop - 5}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      )}

      {dna.branchStyle === "gnarled" && (
        <>
          <path d={`M${cx} ${trunkTop + 20} Q${cx - 15} ${trunkTop + 10} ${cx - branchReach * 0.6} ${trunkTop}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d={`M${cx} ${trunkTop + 15} Q${cx + 12} ${trunkTop + 5} ${cx + branchReach * 0.5} ${trunkTop - 5}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" />
        </>
      )}

      {(dna.branchStyle === "sturdy" || dna.branchStyle === "spreading" || dna.branchStyle === "delicate" || dna.branchStyle === "upright") && (
        <>
          <path d={`M${cx - 2} ${trunkTop + 4} Q${cx - 22} ${trunkTop - 10} ${cx - branchReach * 0.8} ${trunkTop - 20}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M${cx + 2} ${trunkTop + 4} Q${cx + 22} ${trunkTop - 10} ${cx + branchReach * 0.8} ${trunkTop - 20}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M${cx} ${trunkTop} L${cx} ${trunkTop - 44}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      <g filter={`url(#sp-glow-${uid})`}>
        {dna.branchStyle === "weeping" ? (
          <>
            <LeafPath type="drooping" x={cx - branchReach} y={trunkTop + 35} size={12} color={lc} />
            <LeafPath type="drooping" x={cx + branchReach} y={trunkTop + 35} size={12} color={lc} />
            <LeafPath type="drooping" x={cx} y={trunkTop - 20} size={10} color={bc} />
          </>
        ) : dna.branchStyle === "conical" ? (
          <>
            <LeafPath type="needle" x={cx - branchReach * 0.8} y={trunkTop + 25} size={10} color={lc} rotation={-20} />
            <LeafPath type="needle" x={cx + branchReach * 0.8} y={trunkTop + 25} size={10} color={lc} rotation={20} />
            <LeafPath type="needle" x={cx} y={trunkTop - 8} size={8} color={bc} />
          </>
        ) : dna.branchStyle === "columnar" ? (
          <>
            <LeafPath type="fan" x={cx} y={trunkTop - 5} size={14} color={lc} rotation={-30} />
            <LeafPath type="fan" x={cx} y={trunkTop - 5} size={14} color={lc} rotation={0} />
            <LeafPath type="fan" x={cx} y={trunkTop - 5} size={14} color={bc} rotation={30} />
          </>
        ) : dna.branchStyle === "gnarled" ? (
          <>
            <LeafPath type="mini" x={cx - branchReach * 0.6} y={trunkTop} size={8} color={lc} />
            <LeafPath type="mini" x={cx + branchReach * 0.5} y={trunkTop - 5} size={7} color={bc} />
            <LeafPath type="mini" x={cx - 5} y={trunkTop - 15} size={6} color={tc} />
          </>
        ) : (
          <>
            <LeafPath type={dna.leafShape} x={cx - branchReach * 0.8} y={trunkTop - 20} size={11} color={lc} />
            <LeafPath type={dna.leafShape} x={cx} y={trunkTop - 44} size={11} color={bc} />
            <LeafPath type={dna.leafShape} x={cx + branchReach * 0.8} y={trunkTop - 20} size={11} color={tc} />
          </>
        )}
      </g>

      {dna.branchStyle !== "columnar" && (
        <>
          <rect x={cx - 68} y={trunkTop - 50} width={46} height={22} rx={5} fill="rgba(15,15,35,0.85)" stroke={`${lc}88`} strokeWidth="1" />
          <text x={cx - 45} y={trunkTop - 40} textAnchor="middle" fontSize="7" fontWeight="800" fontFamily="Inter, sans-serif" fill={lc}>⚓ ANCHOR</text>
          <text x={cx - 45} y={trunkTop - 32} textAnchor="middle" fontSize="6" fontWeight="600" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.7)">
            {(habit.anchor || "").length > 8 ? habit.anchor.slice(0, 8) + "…" : habit.anchor || "—"}
          </text>

          <rect x={cx - 23} y={trunkTop - 70} width={46} height={22} rx={5} fill="rgba(15,15,35,0.85)" stroke={`${bc}88`} strokeWidth="1" />
          <text x={cx} y={trunkTop - 60} textAnchor="middle" fontSize="7" fontWeight="800" fontFamily="Inter, sans-serif" fill={bc}>📚 HABIT</text>
          <text x={cx} y={trunkTop - 52} textAnchor="middle" fontSize="6" fontWeight="600" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.7)">
            {(habit.habit || "").length > 8 ? habit.habit.slice(0, 8) + "…" : habit.habit || "—"}
          </text>

          <rect x={cx + 22} y={trunkTop - 50} width={46} height={22} rx={5} fill="rgba(15,15,35,0.85)" stroke={`${tc}88`} strokeWidth="1" />
          <text x={cx + 45} y={trunkTop - 40} textAnchor="middle" fontSize="7" fontWeight="800" fontFamily="Inter, sans-serif" fill={tc}>🎁 REWARD</text>
          <text x={cx + 45} y={trunkTop - 32} textAnchor="middle" fontSize="6" fontWeight="600" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.7)">
            {(habit.reward || "").length > 8 ? habit.reward.slice(0, 8) + "…" : habit.reward || "—"}
          </text>
        </>
      )}

      <text x={cx} y={200} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.45)">
        {species.name.toUpperCase()}
      </text>
    </svg>
  );
}

function BloomTree({ habit, isDone, streak, species, habitId }) {
  const cx      = 110;
  const isSuper = streak >= 21;
  const tc      = species.trunkColor;
  const lc      = species.leafColor;
  const bc      = species.blossomColor;
  const ac      = species.accentColor;
  const dna     = species.dna;
  const uid     = `${species.key}-${habitId?.slice(-6) || "new"}`;

  const spread   = 72 * dna.canopySpread;
  const trunkH   = 62;
  const trunkTop = 228 - trunkH;

  const canopyPaths = {
    weeping:   `M${cx - spread * 0.7} ${trunkTop - 10} C${cx - spread} ${trunkTop - 40},${cx - spread * 0.3} ${trunkTop - 80},${cx} ${trunkTop - 90} C${cx + spread * 0.3} ${trunkTop - 80},${cx + spread} ${trunkTop - 40},${cx + spread * 0.7} ${trunkTop - 10} Z`,
    sturdy:    `M${cx - spread * 0.8} ${trunkTop - 5} C${cx - spread} ${trunkTop - 50},${cx - spread * 0.5} ${trunkTop - 100},${cx} ${trunkTop - 110} C${cx + spread * 0.5} ${trunkTop - 100},${cx + spread} ${trunkTop - 50},${cx + spread * 0.8} ${trunkTop - 5} Z`,
    delicate:  `M${cx - spread * 0.6} ${trunkTop} C${cx - spread * 0.8} ${trunkTop - 30},${cx - spread * 0.4} ${trunkTop - 70},${cx} ${trunkTop - 80} C${cx + spread * 0.4} ${trunkTop - 70},${cx + spread * 0.8} ${trunkTop - 30},${cx + spread * 0.6} ${trunkTop} Z`,
    conical:   `M${cx - spread * 0.4} ${trunkTop} L${cx} ${trunkTop - 110} L${cx + spread * 0.4} ${trunkTop} Z`,
    bottle:    `M${cx - spread * 0.3} ${trunkTop + 10} C${cx - spread * 0.5} ${trunkTop - 20},${cx - spread * 0.2} ${trunkTop - 50},${cx} ${trunkTop - 60} C${cx + spread * 0.2} ${trunkTop - 50},${cx + spread * 0.5} ${trunkTop - 20},${cx + spread * 0.3} ${trunkTop + 10} Z`,
    upright:   `M${cx - spread * 0.5} ${trunkTop} C${cx - spread * 0.7} ${trunkTop - 40},${cx - spread * 0.3} ${trunkTop - 90},${cx} ${trunkTop - 100} C${cx + spread * 0.3} ${trunkTop - 90},${cx + spread * 0.7} ${trunkTop - 40},${cx + spread * 0.5} ${trunkTop} Z`,
    twisted:   `M${cx - spread * 0.7} ${trunkTop - 5} C${cx - spread} ${trunkTop - 35},${cx - spread * 0.4} ${trunkTop - 75},${cx} ${trunkTop - 85} C${cx + spread * 0.4} ${trunkTop - 75},${cx + spread} ${trunkTop - 35},${cx + spread * 0.7} ${trunkTop - 5} Z`,
    columnar:  `M${cx - spread * 0.5} ${trunkTop} L${cx - spread * 0.3} ${trunkTop - 40} L${cx} ${trunkTop - 100} L${cx + spread * 0.3} ${trunkTop - 40} L${cx + spread * 0.5} ${trunkTop} Z`,
    gnarled:   `M${cx - spread * 0.5} ${trunkTop + 5} C${cx - spread * 0.7} ${trunkTop - 25},${cx - spread * 0.3} ${trunkTop - 60},${cx - 5} ${trunkTop - 70} C${cx + 5} ${trunkTop - 60},${cx + spread * 0.7} ${trunkTop - 25},${cx + spread * 0.5} ${trunkTop + 5} Z`,
    spreading: `M${cx - spread * 0.9} ${trunkTop} C${cx - spread} ${trunkTop - 45},${cx - spread * 0.4} ${trunkTop - 95},${cx} ${trunkTop - 105} C${cx + spread * 0.4} ${trunkTop - 95},${cx + spread} ${trunkTop - 45},${cx + spread * 0.9} ${trunkTop} Z`,
  };

  const canopyPath = canopyPaths[dna.branchStyle] || canopyPaths.sturdy;

  const leafPositions = useMemo(() => {
    const rand  = seededRandom(`${habitId || ""}${species.key}`);
    const positions = [];
    const count = dna.leafShape === "needle" ? 24 : dna.leafShape === "cluster" ? 18 : 15;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r     = (0.3 + rand() * 0.7) * spread * 0.8;
      positions.push({
        x:        cx + Math.cos(angle) * r,
        y:        trunkTop - 20 - rand() * (dna.branchStyle === "conical" ? 60 : 40),
        size:     6 + rand() * 8,
        rotation: rand() * 360,
        color:    rand() > 0.5 ? lc : (rand() > 0.5 ? bc : ac),
      });
    }
    return positions;
  }, [species.key, habitId, spread, trunkTop, dna.leafShape, dna.branchStyle, lc, bc, ac]);

  return (
    <svg viewBox="0 0 220 240" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id={`bl-ground-${uid}`} cx="50%" cy="0%" r="50%">
          <stop offset="0%" stopColor={isDone ? "#34d399" : tc} stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0f0f23" stopOpacity="0" />
        </radialGradient>
        <filter id={`bl-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`bl-trunk-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDone ? "#34d399" : tc} />
          <stop offset="60%" stopColor={lc} />
          <stop offset="100%" stopColor={ac} />
        </linearGradient>
      </defs>

      <ellipse cx={cx} cy={228} rx={spread} ry={11} fill={`url(#bl-ground-${uid})`} />

      {dna.branchStyle === "bottle" ? (
        <g opacity="0.45">
          <path d={`M${cx - 5} 218 Q${cx - 30} 235 ${cx - 50} 230`} fill="none" stroke={tc} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${cx + 5} 218 Q${cx + 30} 235 ${cx + 50} 230`} fill="none" stroke={lc} strokeWidth="3" strokeLinecap="round" />
        </g>
      ) : (
        <g opacity="0.45">
          <path d={`M${cx - 3} 218 Q${cx - 20} 230 ${cx - 36} 228`} fill="none" stroke={tc} strokeWidth="2" strokeLinecap="round" />
          <path d={`M${cx + 3} 218 Q${cx + 22} 232 ${cx + 38} 228`} fill="none" stroke={lc} strokeWidth="2" strokeLinecap="round" />
          <path d={`M${cx} 220 Q${cx - 5} 232 ${cx - 10} 236`} fill="none" stroke={ac} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {dna.branchStyle === "bottle" ? (
        <path d={`M${cx - dna.trunkWidth / 2} ${trunkTop + 20} Q${cx - dna.trunkWidth / 2 - 4} ${trunkTop + 10} ${cx - dna.trunkWidth / 2 - 2} ${trunkTop} Q${cx - dna.trunkWidth / 2} ${trunkTop - 5} ${cx} ${trunkTop - 5} Q${cx + dna.trunkWidth / 2} ${trunkTop - 5} ${cx + dna.trunkWidth / 2 + 2} ${trunkTop} Q${cx + dna.trunkWidth / 2 + 4} ${trunkTop + 10} ${cx + dna.trunkWidth / 2} ${trunkTop + 20} Z`}
          fill={`url(#bl-trunk-${uid})`}
          style={{ filter: `drop-shadow(0 0 ${isDone ? "8px rgba(52,211,153,0.6)" : `6px ${tc}66`})` }} />
      ) : dna.branchStyle === "twisted" ? (
        <path d={`M${cx - 4} ${trunkTop + 62} Q${cx + 6} ${trunkTop + 45} ${cx - 3} ${trunkTop + 28} Q${cx + 5} ${trunkTop + 15} ${cx - 2} ${trunkTop + 5} Q${cx + 3} ${trunkTop - 2} ${cx} ${trunkTop - 5}`}
          fill="none" stroke={`url(#bl-trunk-${uid})`} strokeWidth={dna.trunkWidth * 0.6} strokeLinecap="round" />
      ) : (
        <rect x={cx - dna.trunkWidth / 2} y={trunkTop} width={dna.trunkWidth} height={trunkH} rx={dna.trunkWidth / 3}
          fill={`url(#bl-trunk-${uid})`}
          style={{ filter: `drop-shadow(0 0 ${isDone ? "8px rgba(52,211,153,0.6)" : `6px ${tc}66`})` }} />
      )}

      {dna.branchStyle === "conical" ? (
        <>
          <path d={`M${cx} ${trunkTop} L${cx - spread * 0.5} ${trunkTop + 20}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <path d={`M${cx} ${trunkTop} L${cx + spread * 0.5} ${trunkTop + 20}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <path d={`M${cx} ${trunkTop - 15} L${cx - spread * 0.35} ${trunkTop - 5}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.8" />
          <path d={`M${cx} ${trunkTop - 15} L${cx + spread * 0.35} ${trunkTop - 5}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.8" />
          <path d={`M${cx} ${trunkTop - 35} L${cx - spread * 0.2} ${trunkTop - 25}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
          <path d={`M${cx} ${trunkTop - 35} L${cx + spread * 0.2} ${trunkTop - 25}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        </>
      ) : dna.branchStyle === "columnar" ? (
        <>
          <path d={`M${cx} ${trunkTop - 5} L${cx - spread * 0.6} ${trunkTop - 35}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <path d={`M${cx} ${trunkTop - 5} L${cx + spread * 0.6} ${trunkTop - 35}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <path d={`M${cx} ${trunkTop - 5} L${cx} ${trunkTop - 55}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d={`M${cx - 3} ${trunkTop + 2} Q${cx - 36} ${trunkTop - 14} ${cx - spread * 0.7} ${trunkTop - 28}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.2" strokeLinecap="round" />
          <path d={`M${cx + 3} ${trunkTop + 2} Q${cx + 36} ${trunkTop - 14} ${cx + spread * 0.7} ${trunkTop - 28}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.2" strokeLinecap="round" />
          <path d={`M${cx} ${trunkTop} L${cx} ${trunkTop - 54}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}

      <g filter={`url(#bl-glow-${uid})`}>
        <path d={canopyPath}
          fill={`${lc}${isDone ? "50" : "30"}`}
          stroke={lc} strokeWidth={isDone ? "1.8" : "1.4"} />

        {dna.branchStyle === "weeping" && (
          <>
            <path d={`M${cx - spread * 0.5} ${trunkTop - 30} Q${cx - spread * 0.6} ${trunkTop - 5} ${cx - spread * 0.5} ${trunkTop + 15}`} fill="none" stroke={`${lc}66`} strokeWidth="1.2" />
            <path d={`M${cx + spread * 0.5} ${trunkTop - 30} Q${cx + spread * 0.6} ${trunkTop - 5} ${cx + spread * 0.5} ${trunkTop + 15}`} fill="none" stroke={`${lc}66`} strokeWidth="1.2" />
          </>
        )}

        {isSuper && (
          <>
            <ellipse cx={cx - 8} cy={trunkTop + 10} rx={7} ry={4} fill={`${ac}44`} stroke={ac} strokeWidth="1" />
            <ellipse cx={cx + 12} cy={trunkTop + 14} rx={7} ry={4} fill={`${lc}44`} stroke={lc} strokeWidth="1" />
          </>
        )}
      </g>

      {leafPositions.map((leaf, i) => (
        <LeafPath key={i} type={dna.leafShape} x={leaf.x} y={leaf.y} size={leaf.size}
          color={leaf.color} rotation={leaf.rotation} />
      ))}

      {dna.leafShape !== "needle" && (
        <g>
          {Array.from({ length: isSuper ? 12 : 8 }, (_, i) => {
            const rand  = seededRandom(`blossom-${habitId || ""}-${i}`);
            const angle = (i / (isSuper ? 12 : 8)) * Math.PI * 2;
            const r     = spread * (0.4 + rand() * 0.4);
            const px    = cx + Math.cos(angle) * r;
            const py    = trunkTop - 20 - rand() * 30;
            return (
              <circle key={i} cx={px} cy={py} r={3 + rand() * 4}
                fill={i % 3 === 0 ? bc : (i % 3 === 1 ? lc : ac)} opacity="0.9" />
            );
          })}
        </g>
      )}

      <g>
        <rect x={4} y={trunkTop - 20} width={62} height={34} rx={7} fill="rgba(15,10,30,0.92)" stroke={`${lc}99`} strokeWidth="1.2" />
        <text x={35} y={trunkTop - 8} textAnchor="middle" fontSize="7.5" fontWeight="800" fontFamily="Inter, sans-serif" fill={lc}>⚓ ANCHOR</text>
        <text x={35} y={trunkTop + 4} textAnchor="middle" fontSize="6.5" fontWeight="600" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.85)">
          {(habit.anchor || "").length > 12 ? habit.anchor.slice(0, 12) + "…" : habit.anchor || "—"}
        </text>
      </g>

      <g>
        <rect x={cx - 31} y={trunkTop - 90} width={62} height={34} rx={7} fill="rgba(15,10,30,0.92)" stroke={`${tc}99`} strokeWidth="1.2" />
        <text x={cx} y={trunkTop - 78} textAnchor="middle" fontSize="7.5" fontWeight="800" fontFamily="Inter, sans-serif" fill={tc}>📚 HABIT</text>
        <text x={cx} y={trunkTop - 66} textAnchor="middle" fontSize="6.5" fontWeight="600" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.85)">
          {(habit.habit || "").length > 12 ? habit.habit.slice(0, 12) + "…" : habit.habit || "—"}
        </text>
      </g>

      <g>
        <rect x={154} y={trunkTop - 20} width={62} height={34} rx={7} fill="rgba(15,10,30,0.92)" stroke={`${bc}99`} strokeWidth="1.2" />
        <text x={185} y={trunkTop - 8} textAnchor="middle" fontSize="7.5" fontWeight="800" fontFamily="Inter, sans-serif" fill={bc}>🎁 REWARD</text>
        <text x={185} y={trunkTop + 4} textAnchor="middle" fontSize="6.5" fontWeight="600" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.85)">
          {(habit.reward || "").length > 12 ? habit.reward.slice(0, 12) + "…" : habit.reward || "—"}
        </text>
      </g>

      <circle cx={cx - spread * 0.9} cy={trunkTop - 60} r={2.5} fill={lc} opacity="0.8" />
      <circle cx={cx + spread * 0.9} cy={trunkTop - 65} r={2} fill={bc} opacity="0.8" />
      <circle cx={cx} cy={trunkTop - 100} r={2.2} fill={tc} opacity="0.9" />

      <rect x={cx - 30} y={214} width={60} height={16} rx={8}
        fill={isDone ? "rgba(52,211,153,0.18)" : `${ac}22`}
        stroke={isDone ? "rgba(52,211,153,0.45)" : `${ac}66`} strokeWidth="1" />
      <text x={cx} y={225} textAnchor="middle" fontSize="7.5" fontWeight="800" fontFamily="Inter, sans-serif"
        fill={isDone ? "#34d399" : ac} letterSpacing="0.5">
        {isSuper ? `✨ ${species.name.toUpperCase()}` : `🌸 ${species.name.toUpperCase()}`}
      </text>
    </svg>
  );
}

function HabitTree({ habit, isDone }) {
  const stage   = getTreeStage(habit.streak || 0);
  const species = getSpecies(habit.species);

  const effectiveSpecies = (!species || !species.dna)
    ? {
        ...TREE_SPECIES[0],
        key: "fallback",
        name: "Mystery Tree",
        dna: { trunkWidth: 6, canopySpread: 1.0, leafShape: "round", branchStyle: "sturdy" },
      }
    : species;

  if (stage === 0) return <SeedlingTree isDone={isDone} species={effectiveSpecies} habitId={habit.id} />;
  if (stage === 1) return <SaplingTree  habit={habit} isDone={isDone} species={effectiveSpecies} habitId={habit.id} />;
  return <BloomTree habit={habit} isDone={isDone} streak={habit.streak || 0} species={effectiveSpecies} habitId={habit.id} />;
}

function HeroTree() {
  const Petal = ({ px, py, r, color }) => {
    const petals = Array.from({ length: 5 }, (_, i) => {
      const a  = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const ex = px + Math.cos(a) * r;
      const ey = py + Math.sin(a) * r;
      return <ellipse key={i} cx={(px + ex) / 2} cy={(py + ey) / 2} rx={r * 0.52} ry={r * 0.28}
        transform={`rotate(${a * 180 / Math.PI + 90},${(px + ex) / 2},${(py + ey) / 2})`} fill={color} opacity="0.88" />;
    });
    return <g>{petals}<circle cx={px} cy={py} r={r * 0.35} fill="#fef3c7" opacity="0.95" /></g>;
  };

  return (
    <svg viewBox="0 0 160 200" width={130} height={163} aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="hero-tr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f472b6" /><stop offset="50%" stopColor="#a855f7" /><stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <radialGradient id="hero-gr" cx="50%" cy="0%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" /><stop offset="100%" stopColor="#0f0f23" stopOpacity="0" />
        </radialGradient>
        <filter id="hero-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx={80} cy={192} rx={52} ry={9} fill="url(#hero-gr)" />
      <g opacity="0.42">
        <path d="M78 184 Q60 196 46 193" fill="none" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M82 184 Q100 198 114 194" fill="none" stroke="#f472b6" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <rect x={74} y={126} width={12} height={60} rx={6} fill="url(#hero-tr)"
        style={{ filter: "drop-shadow(0 0 8px rgba(244,114,182,0.55))" }} />
      <path d="M77 128 Q54 112 40 96"  fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M83 128 Q106 112 120 96" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M80 126 L80 72"          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.8" strokeLinecap="round" />
      <g filter="url(#hero-glow)">
        <path d="M40 96 C18 80,12 54,32 44 C52 34,66 46,64 68 C62 88,52 108,40 96 Z"
          fill="rgba(244,114,182,0.28)" stroke="#f472b6" strokeWidth="1.6" className="grove-svg-leaf" style={{ animationDelay: "0s", transformOrigin: "40px 96px" }} />
        <path d="M80 72 C58 56,56 28,80 18 C104 8,110 32,102 52 C94 70,98 86,80 72 Z"
          fill="rgba(168,85,247,0.28)" stroke="#a855f7" strokeWidth="1.6" className="grove-svg-leaf" style={{ animationDelay: "0.5s", transformOrigin: "80px 72px" }} />
        <path d="M120 96 C142 80,150 54,132 42 C114 30,100 44,102 66 C104 86,110 108,120 96 Z"
          fill="rgba(52,211,153,0.28)" stroke="#34d399" strokeWidth="1.6" className="grove-svg-leaf" style={{ animationDelay: "1s", transformOrigin: "120px 96px" }} />
      </g>
      <g filter="url(#hero-glow)">
        <Petal px={40}  py={72} r={6.5} color="#f472b6" />
        <Petal px={80}  py={44} r={7}   color="#c084fc" />
        <Petal px={120} py={70} r={6.5} color="#34d399" />
      </g>
      <circle cx={30}  cy={34} r={2.5} fill="#f472b6" opacity="0.8" />
      <circle cx={130} cy={32} r={2}   fill="#34d399" opacity="0.8" />
      <circle cx={80}  cy={8}  r={2.2} fill="#a855f7" opacity="0.9" />
    </svg>
  );
}

function ConfettiBurst({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 26 }, (_, i) => ({
    id: i, ch: ["🌸", "✨", "💜", "💖", "🍃", "⭐", "🌱", "💫"][i % 8],
    x: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.4 + Math.random() * 1.2,
  }));
  return (
    <div className="hs-confetti-burst" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} style={{ left: `${p.x}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, fontSize: "1.15rem" }}>
          {p.ch}
        </span>
      ))}
    </div>
  );
}

function Particles() {
  const list = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i, ch: ["🌿", "🍃", "✨", "💜", "🌱", "💫"][i % 6],
      x: Math.random() * 100, y: Math.random() * 100,
      size: 0.7 + Math.random() * 0.75, dur: 6 + Math.random() * 8, delay: Math.random() * 5,
    })), []);
  return (
    <div className="hs-particles" aria-hidden="true">
      {list.map((p) => (
        <motion.span key={p.id} className="hs-particle"
          style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: `${p.size}rem` }}
          animate={{ y: [0, -16, 0], opacity: [0.12, 0.4, 0.12] }}
          transition={{ repeat: Infinity, duration: p.dur, delay: p.delay, ease: "easeInOut" }}>
          {p.ch}
        </motion.span>
      ))}
    </div>
  );
}

function StageBadge({ streak }) {
  const stage  = getTreeStage(streak);
  const stages = [
    { label: "Seedling 🌱", color: "#a855f7" },
    { label: "Sapling 🌿",  color: "#34d399" },
    { label: "Bloom 🌸",    color: "#f472b6" },
  ];
  return (
    <div className="grove-stage-badge">
      {stages.map((s, i) => (
        <div key={i} className={`grove-stage-step${i === stage ? " active" : i < stage ? " done" : ""}`} style={{ "--stage-color": s.color }}>
          <div className="grove-stage-dot" />
          <span className="grove-stage-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function SpeciesPill({ speciesKey }) {
  const s = getSpecies(speciesKey);
  return (
    <span className="hs-species-pill" style={{ "--sp-color": s.accentColor }}>
      {s.label}
    </span>
  );
}

function GroveTreeCard({ habit, onComplete, onDelete, onEdit }) {
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const today    = todayKey();
  const isDone   = !!habit.completions?.[today];
  const weekDots = useMemo(() => getWeekDots(habit.completions), [habit.completions]);
  const isFire   = (habit.streak || 0) >= 7;
  const species  = getSpecies(habit.species);

  return (
    <motion.div
      className={["grove-tree", isDone ? "grove-tree--done" : "", isFire ? "grove-tree--fire" : ""].filter(Boolean).join(" ")}
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit   ={{ opacity: 0, y: 12, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      whileHover={{ y: -4 }}
    >
      <div className="grove-tree__svg-wrap">
        <HabitTree habit={habit} isDone={isDone} />
      </div>

      <div className="grove-tree__panel">
        <div className="grove-tree__meta-row">
          <SpeciesPill speciesKey={habit.species} />
          <StageBadge streak={habit.streak || 0} />
        </div>

        <div className="grove-tree__header">
          <div className="grove-flame">
            <span className="grove-flame__fire">{isFire ? "🔥" : "🌿"}</span>
            <span className="grove-flame__num" style={{ color: species.accentColor }}>{habit.streak || 0}</span>
            <span className="grove-flame__unit">days</span>
          </div>
          <div className="grove-tree__streak-meta">
            <span className="grove-tree__streak-label">{habit.anchor} → {habit.habit}</span>
            <span className="grove-tree__best">🏆 Best: {habit.bestStreak || 0} days</span>
          </div>
          <div className="grove-tree__actions">
            {confirmDel ? (
              <div className="grove-del-confirm">
                <button className="hs-icon-btn hs-icon-btn--danger" onClick={() => { onDelete(habit.id); setConfirmDel(false); }} aria-label="Confirm delete"><FaCheck size={10} /></button>
                <button className="hs-icon-btn" onClick={() => setConfirmDel(false)} aria-label="Cancel"><FaTimes size={10} /></button>
              </div>
            ) : (
              <>
                <button className="hs-icon-btn" onClick={() => setShowHeatmap((v) => !v)} aria-label="Toggle heatmap" title="Show history">
                  <span style={{ fontSize: ".65rem", fontWeight: 900 }}>📊</span>
                </button>
                <button className="hs-icon-btn" onClick={() => onEdit(habit)} aria-label="Edit habit"><FaEdit size={10} /></button>
                <button className="hs-icon-btn hs-icon-btn--danger" onClick={() => setConfirmDel(true)} aria-label="Delete habit"><FaTrash size={10} /></button>
              </>
            )}
          </div>
        </div>

        <div className="grove-roots">
          {weekDots.map((d) => (
            <div className="grove-root" key={d.key}>
              <div className={`grove-root__dot${d.done ? " grove-root__dot--done" : ""}`}
                style={d.done ? { background: `linear-gradient(135deg, ${species.trunkColor}, ${species.accentColor})`, borderColor: "transparent", boxShadow: `0 0 10px ${species.accentColor}66` } : {}}
                title={d.key} aria-label={`${d.label}: ${d.done ? "completed" : "not done"}`}>
                {d.done && <FaCheck size={8} />}
              </div>
              <span className="grove-root__label">{d.label}</span>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {showHeatmap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              style={{ overflow: "hidden" }}>
              <HabitHeatmap completions={habit.completions || {}} speciesKey={habit.species} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          className={`grove-cta${isDone ? " grove-cta--done" : ""}`}
          style={isDone ? {} : { "--cta-color": species.accentColor }}
          onClick={() => !isDone && onComplete(habit.id)}
          disabled={isDone}
          whileTap={isDone ? {} : { scale: 0.96 }}
          aria-label={isDone ? "Completed today" : "Mark done today"}>
          {isDone
            ? <><FaCheck size={13} /> Done for today — come back tomorrow! 🌿</>
            : <><LuSprout size={14} /> Mark complete today</>}
        </motion.button>
      </div>

      <div className="grove-tree__ground" aria-hidden="true" />
    </motion.div>
  );
}

function HabitModal({ initial, onSave, onClose }) {
  const isEdit   = !!initial?.id;
  const [step,   setStep]   = useState(0);
  const [form,   setForm]   = useState({ anchor: initial?.anchor || "", habit: initial?.habit || "", reward: initial?.reward || "" });
  const [saving, setSaving] = useState(false);

  const meta       = STEP_META[step];
  const isLast     = step === STEP_META.length - 1;
  const canAdvance = form[meta.key].trim().length > 0;
  const allFilled  = form.anchor.trim() && form.habit.trim() && form.reward.trim();
  const progPct    = (step / (STEP_META.length - 1)) * 100;

  async function handleNext() {
    if (!canAdvance) return;
    if (isLast || isEdit) { setSaving(true); await onSave(form); setSaving(false); }
    else setStep((s) => s + 1);
  }

  return (
    <motion.div className="hs-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} role="dialog" aria-modal="true">
      <motion.div className="hs-modal"
        initial={{ scale: 0.88, opacity: 0, y: 28 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="hs-modal__strip" />
        <div className="hs-modal__header">
          <div>
            <span className="hs-modal__eyebrow">{isEdit ? "Edit habit stack ✏️" : "Plant a new habit 🌱"}</span>
            <p className="hs-modal__sub">{isEdit ? "Update your formula" : `Step ${step + 1} of ${STEP_META.length} — ${meta.label}`}</p>
          </div>
          <button className="hs-icon-btn" onClick={onClose} aria-label="Close"><FaTimes size={13} /></button>
        </div>
        {!isEdit && (
          <div className="hs-modal__progress">
            <motion.div className="hs-modal__progress-fill" animate={{ width: `${progPct}%` }} transition={{ duration: 0.35 }} />
          </div>
        )}
        {!isEdit && (
          <div className="hs-stepper">
            <div className="hs-stepper__line"><motion.div className="hs-stepper__line-fill" animate={{ width: `${progPct}%` }} transition={{ duration: 0.35 }} /></div>
            {STEP_META.map((s, i) => (
              <div key={s.key} className={["hs-stepper__step", i === step ? "active" : "", i < step ? "done" : ""].filter(Boolean).join(" ")} style={{ "--step-color": s.color }}>
                <span className="hs-stepper__inner">{i < step ? <FaCheck size={12} /> : s.emoji}</span>
                <span className="hs-stepper__label">{s.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="hs-modal__body">
          <AnimatePresence mode="wait">
            <motion.div key={isEdit ? "edit-all" : step}
              initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: ".85rem" }}>
              {!isEdit && (
                <div className="hs-step-hero" style={{ "--step-color": meta.color }}>
                  <div className="hs-step-hero__icon">{meta.emoji}</div>
                  <div><p className="hs-step-hero__title">{meta.label}</p><p className="hs-step-hero__hint">{meta.hint}</p></div>
                </div>
              )}
              {(isEdit ? STEP_META : [meta]).map((s) => {
                const stepIdx = STEP_META.findIndex((x) => x.key === s.key);
                return (
                  <div className="hs-field-group" key={s.key}>
                    <label className="hs-label" htmlFor={`hs-inp-${s.key}`} style={{ "--node-color": s.color }}>{s.emoji} {s.label}</label>
                    <input id={`hs-inp-${s.key}`} className="hs-input" value={form[s.key]}
                      placeholder={`e.g. ${ALL_SUGGESTIONS[stepIdx][0]}`} maxLength={60}
                      autoFocus={!isEdit}
                      onChange={(e) => setForm((f) => ({ ...f, [s.key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && !isEdit && handleNext()} />
                    {!isEdit && (
                      <div className="hs-suggestions">
                        {ALL_SUGGESTIONS[stepIdx].filter((sg) => !form[s.key] || sg.toLowerCase().includes(form[s.key].toLowerCase())).slice(0, 5).map((sg) => (
                          <button key={sg} type="button" className="hs-suggestion-chip" onClick={() => setForm((f) => ({ ...f, [s.key]: sg }))}>{sg}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {(form.anchor || form.habit || form.reward) && (
                <div className="hs-modal__preview">
                  <p className="hs-preview-label">Your habit chain</p>
                  <div className="hs-preview-chain">
                    {[
                      { key: "anchor", color: "#f472b6", prefix: "After:" },
                      { key: "habit",  color: "#a855f7", prefix: "Do:"    },
                      { key: "reward", color: "#34d399", prefix: "Then:"  },
                    ]
                      .filter((x) => form[x.key])
                      .map((x, i, arr) => (
                        <div key={x.key} className="hs-preview-chain__item">
                          <span className="hs-preview-chain__dot" style={{ background: x.color }} />
                          <span className="hs-preview-chain__text">{x.prefix} {form[x.key]}</span>
                          {i < arr.length - 1 && <span style={{ color: "var(--pookie-muted)", fontSize: ".75rem" }}>→</span>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hs-modal__footer">
          {!isEdit && step > 0 && <button className="hs-btn hs-btn--ghost" onClick={() => setStep((s) => s - 1)}>← Back</button>}
          <button className="hs-btn hs-btn--ghost" onClick={onClose}>Cancel</button>
          <motion.button className="hs-btn hs-btn--primary" onClick={handleNext}
            disabled={saving || (isEdit ? !allFilled : !canAdvance)} whileTap={{ scale: 0.95 }}>
            {saving ? "Saving…" : isEdit ? <><FaCheck size={12} /> Save changes</> : isLast ? <><LuSprout size={14} /> Plant habit 🌱</> : <>Next →</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function useHabitStats(habits) {
  return useMemo(() => {
    const today         = todayKey();
    const totalHabits   = habits.length;
    const doneToday     = habits.filter((h) => !!h.completions?.[today]).length;
    const totalDone     = habits.reduce((a, h) => a + Object.keys(h.completions || {}).length, 0);
    const bestStreak    = habits.reduce((a, h) => Math.max(a, h.bestStreak || 0), 0);
    const longestActive = habits.reduce((a, h) => Math.max(a, h.streak || 0), 0);
    return { totalHabits, doneToday, totalDone, bestStreak, longestActive };
  }, [habits]);
}

export default function HabitStacking() {
  const [user,      setUser]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [habits,    setHabits]    = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editHabit, setEditHabit] = useState(null);
  const [confetti,  setConfetti]  = useState(false);
  const [filter,    setFilter]    = useState("all");
  const [quoteIdx,  setQuoteIdx]  = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [isOnline,  setIsOnline]  = useState(navigator.onLine);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !isOnline) return;
    const queue = localStorage.getItem(OFFLINE_KEY);
    if (!queue) return;
    try {
      const parsed = JSON.parse(queue);
      if (parsed.userId === user.uid) {
        syncToFirebase(user.uid, parsed.habits).then((ok) => {
          if (ok) toast.success("Synced offline changes ☁️");
        });
      }
    } catch (e) {}
  }, [user, isOnline]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const cacheKey = `${CACHE_KEY_PREFIX}${user.uid}`;
    const cached   = localStorage.getItem(cacheKey);
    if (cached) { try { setHabits(JSON.parse(cached)); } catch (e) {} }

    const ref   = doc(db, "users", user.uid, "habitStack", "default");
    const unsub = onSnapshot(ref,
      (snap) => {
        const data = snap.exists() ? snap.data().habits || [] : [];
        setHabits(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        setLoading(false);
      },
      (err) => {
        console.error("HabitStack snapshot:", err);
        toast.error("Couldn't load your habits 💔");
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  const persist = useCallback((updated) => {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const ok = await syncToFirebase(user.uid, updated);
      if (!ok) toast.error("You're offline — saved locally 📴", { duration: 3000 });
    }, 700);
  }, [user]);

  const handleSave = useCallback(async (form) => {
    let updated;
    if (editHabit) {
      updated = habits.map((h) => (h.id === editHabit.id ? { ...h, ...form } : h));
      toast.success("Habit updated ✏️");
    } else {
      const newH = {
        id:          generateId(),
        ...form,
        species:     pickRandomSpecies(),
        streak:      0,
        bestStreak:  0,
        completions: {},
        createdAt:   new Date().toISOString(),
      };
      updated = [...habits, newH];
      const sp = getSpecies(newH.species);
      toast.success(`${sp.label} planted! 🌱 Your grove is growing.`);
    }
    setHabits(updated);
    persist(updated);
    setShowModal(false);
    setEditHabit(null);
  }, [habits, editHabit, persist]);

  const handleComplete = useCallback((habitId) => {
    const today = todayKey();
    const yKey  = yesterdayKey();
    let graceMsg = null;

    const updated = habits.map((h) => {
      if (h.id !== habitId || h.completions?.[today]) return h;
      const didYesterday = !!h.completions?.[yKey];
      let newStreak;
      if (didYesterday) {
        newStreak = (h.streak || 0) + 1;
      } else {
        const graceUsed = getGraceUsed(h);
        if (graceUsed === 0) {
          newStreak = (h.streak || 0) + 1;
          graceMsg  = "🧊 Grace day used — streak saved!";
        } else {
          newStreak = 1;
        }
      }
      return {
        ...h,
        completions: { ...h.completions, [today]: true },
        streak:      newStreak,
        bestStreak:  Math.max(h.bestStreak || 0, newStreak),
      };
    });

    const previous = habits;

    setHabits(updated);
    persist(updated);

    const h = updated.find((x) => x.id === habitId);
    const toastMsg = graceMsg || (
      (h?.streak || 0) >= 7 ? `🌸 ${h.streak}-day streak! Your tree is blooming!` :
      (h?.streak || 0) === 3 ? "🌿 3 days! Your sapling is growing!" :
      "✅ Habit done — tree growing! 🌳"
    );

    if ((h?.streak || 0) >= 7) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3200);
    }

    toast.custom(
      (t) => (
        <div className={`hs-undo-toast${t.visible ? " hs-undo-toast--visible" : ""}`}>
          <span>{toastMsg}</span>
          <button
            className="hs-undo-toast__btn"
            onClick={() => {
              setHabits(previous);
              persist(previous);
              toast.dismiss(t.id);
              toast("Completion undone ↩️", { icon: "↩️" });
            }}>
            Undo
          </button>
        </div>
      ),
      { duration: 5000, id: `undo-complete-${habitId}` }
    );
  }, [habits, persist]);

  const handleDelete = useCallback((habitId) => {
    const previous = habits;
    const updated  = habits.filter((h) => h.id !== habitId);

    setHabits(updated);
    persist(updated);

    toast.custom(
      (t) => (
        <div className={`hs-undo-toast${t.visible ? " hs-undo-toast--visible" : ""}`}>
          <span>Habit removed 🍂</span>
          <button
            className="hs-undo-toast__btn"
            onClick={() => {
              setHabits(previous);
              persist(previous);
              toast.dismiss(t.id);
              toast("Habit restored 🌱", { icon: "🌱" });
            }}>
            Undo
          </button>
        </div>
      ),
      { duration: 5000, id: `undo-delete-${habitId}` }
    );
  }, [habits, persist]);

  const stats        = useHabitStats(habits);
  const today        = todayKey();
  const pendingCount = habits.filter((h) => !h.completions?.[today]).length;
  const allDone      = habits.length > 0 && pendingCount === 0;
  const quote        = QUOTES[quoteIdx];

  const visible = useMemo(() => {
    if (filter === "pending") return habits.filter((h) => !h.completions?.[today]);
    if (filter === "done")    return habits.filter((h) =>  h.completions?.[today]);
    return habits;
  }, [habits, filter, today]);

  if (!user && !loading) {
    return (
      <div className="hs-page">
        <div className="hs-empty">
          <div className="hs-empty__seedling"><span className="hs-empty__seedling-leaf">🌿</span><div className="hs-empty__seedling-trunk" /></div>
          <h3>Your habit grove awaits</h3>
          <p>Log in to start planting habits and growing your personal grove 🌳</p>
          <a href="/login" className="hs-btn hs-btn--primary"><LuSprout size={15} /> Log in to start</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="hs-page">
        <div className="hs-grove">{[0, 1, 2].map((i) => <div key={i} className="hs-skeleton" />)}</div>
      </div>
    );
  }

  return (
    <div className="hs-page">
      <Particles />
      <ConfettiBurst active={confetti} />

      <AnimatePresence>
        {!isOnline && (
          <motion.div className="hs-offline-banner" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
            <LuWifiOff size={14} /> Offline — changes saved locally and will sync when reconnected
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="hs-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 22 }}>
        <div className="hs-hero__inner">
          <div className="hs-hero__left">
            <h1 className="hs-hero__title">Grow your <span className="hs-gradient-text">habit grove</span></h1>
            <p className="hs-hero__sub">Stack habits like leaves on a tree — anchor, do, reward. Each habit grows a unique tree species. 🌸</p>
            <div className="hs-stage-guide">
              {[
                { emoji: "🌱", label: "Seedling", desc: "0–2 days",  color: "#a855f7" },
                { emoji: "🌿", label: "Sapling",  desc: "3–6 days",  color: "#34d399" },
                { emoji: "🌸", label: "Bloom",    desc: "7+ days",   color: "#f472b6" },
              ].map((s, i) => (
                <div key={i} className="hs-stage-guide__item" style={{ "--sc": s.color }}>
                  <span className="hs-stage-guide__emoji">{s.emoji}</span>
                  <span className="hs-stage-guide__label">{s.label}</span>
                  <span className="hs-stage-guide__desc">{s.desc}</span>
                </div>
              ))}
            </div>

            <div className="hs-hero__actions">
              <motion.button className="hs-btn hs-btn--primary hs-btn--lg" onClick={() => { setEditHabit(null); setShowModal(true); }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <FaPlus size={13} /> Plant new habit
              </motion.button>
              <button className="hs-btn hs-btn--ghost" onClick={() => setQuoteIdx((i) => (i + 1) % QUOTES.length)} aria-label="Next quote">
                <LuSparkles size={14} /> Inspire me
              </button>
              {isOnline
                ? <span className="hs-online-badge"><LuWifi size={11} /> Synced</span>
                : <span className="hs-offline-badge"><LuWifiOff size={11} /> Offline</span>}
            </div>
          </div>
          <div className="hs-hero__tree-preview" aria-hidden="true"><HeroTree /></div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={quoteIdx} className="hs-quote-bar"
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.26 }}>
          <span className="hs-quote-bar__gem">💬</span>
          <span className="hs-quote-bar__text">"{quote.text}"</span>
          <span className="hs-quote-bar__author">— {quote.author}</span>
        </motion.div>
      </AnimatePresence>

      {habits.length === 0 && (
        <div className="hs-how">
          <p className="hs-how__title">How habit stacking works</p>
          <div className="hs-how__steps">
            {[
              { emoji: "⚓", label: "Anchor",  desc: "Pick an existing daily habit",    color: "#f472b6" }, null,
              { emoji: "📚", label: "Stack",   desc: "Add a new habit right after it",  color: "#a855f7" }, null,
              { emoji: "🎁", label: "Reward",  desc: "Celebrate to lock it in",         color: "#34d399" }, null,
              { emoji: "🌸", label: "Bloom",   desc: "7 days → your tree flowers!",     color: "#fb923c" },
            ].map((s, i) => s === null
              ? <div key={i} className="hs-how__connector">→</div>
              : (
                <div key={i} className="hs-how__step" style={{ "--step-color": s.color }}>
                  <div className="hs-how__step-icon">{s.emoji}</div>
                  <span className="hs-how__step-label">{s.label}</span>
                  <span className="hs-how__step-desc">{s.desc}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {habits.length > 0 && (
        <motion.div className="hs-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {[
            { icon: <LuTreePine   size={17} />, val: stats.totalHabits,                         label: "Habits",        accent: "#a855f7" },
            { icon: <FaCheck      size={14} />, val: `${stats.doneToday}/${stats.totalHabits}`, label: "Done today",    accent: "#34d399" },
            { icon: <LuFlame      size={17} />, val: stats.longestActive,                       label: "Top streak",    accent: "#f472b6" },
            { icon: <LuTarget     size={17} />, val: stats.totalDone,                           label: "Total done",    accent: "#60a5fa" },
            { icon: <LuTrendingUp size={17} />, val: stats.bestStreak,                          label: "All-time best", accent: "#fb923c" },
          ].map((s, i) => (
            <motion.div key={i} className="hs-stat" style={{ "--accent": s.accent }}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.06 }} whileHover={{ scale: 1.04 }}>
              <span className="hs-stat__icon">{s.icon}</span>
              <span className="hs-stat__value">{s.val}</span>
              <span className="hs-stat__label">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {pendingCount > 0 && habits.length > 0 && (
          <motion.div className="hs-pending-banner" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <LuZap size={16} />
            {pendingCount === 1 ? "1 habit left — almost there! 🌟" : `${pendingCount} habits still to do today 💪`}
          </motion.div>
        )}
      </AnimatePresence>

      {habits.length > 0 && (
        <div className="hs-filter-bar" role="group" aria-label="Filter habits">
          {[
            { key: "all",     label: "🌳 All",    count: habits.length               },
            { key: "pending", label: "⏳ Pending", count: pendingCount                },
            { key: "done",    label: "✅ Done",    count: habits.length - pendingCount },
          ].map((f) => (
            <button key={f.key} className={`hs-filter-btn${filter === f.key ? " hs-filter-btn--active" : ""}`} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 && habits.length === 0 ? (
        <motion.div className="hs-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
          <div className="hs-empty__seedling"><span className="hs-empty__seedling-leaf">🌱</span><div className="hs-empty__seedling-trunk" /></div>
          <h3>Your grove is empty</h3>
          <p>Plant your first habit — pick an anchor, add a habit, give yourself a reward, and watch your unique tree bloom! Each habit grows a different species 🌸</p>
          <motion.button className="hs-btn hs-btn--primary hs-btn--lg" onClick={() => { setEditHabit(null); setShowModal(true); }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <FaPlus size={13} /> Plant first habit
          </motion.button>
        </motion.div>
      ) : visible.length === 0 ? (
        <motion.div className="hs-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span style={{ fontSize: "2rem" }}>{filter === "pending" ? "🎉" : "🌿"}</span>
          <h3>{filter === "pending" ? "Nothing pending!" : "No habits here"}</h3>
          <p>{filter === "pending" ? "All habits done for today — amazing!" : "Switch the filter to see your habits."}</p>
        </motion.div>
      ) : (
        <div className="hs-grove">
          <AnimatePresence>
            {visible.map((h) => (
              <GroveTreeCard key={h.id} habit={h} onComplete={handleComplete} onDelete={handleDelete}
                onEdit={(h) => { setEditHabit(h); setShowModal(true); }} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {allDone && filter !== "pending" && (
          <motion.div className="hs-all-done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <span style={{ fontSize: "2.5rem" }}>🌸</span>
            <p>Your grove is blooming — all habits done for today!</p>
            <p style={{ fontSize: ".8rem", color: "var(--pookie-muted)", WebkitTextFillColor: "var(--pookie-muted)", background: "none", margin: 0 }}>
              Come back tomorrow to keep your streaks alive 🔥
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button className="hs-fab" onClick={() => { setEditHabit(null); setShowModal(true); }}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }} aria-label="Plant new habit" title="Plant new habit">
        <FaPlus size={22} />
      </motion.button>

      <AnimatePresence>
        {showModal && (
          <HabitModal key={editHabit?.id || "new"} initial={editHabit} onSave={handleSave}
            onClose={() => { setShowModal(false); setEditHabit(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}