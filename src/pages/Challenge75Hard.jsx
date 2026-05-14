import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import { FaCheck, FaTimes, FaTrophy, FaRedo, FaPlus, FaHeart } from "react-icons/fa";
import {
  LuBookOpen, LuTarget, LuPencil, LuClock, LuTrendingUp, LuZap,
  LuCode, LuCalculator, LuMicroscope, LuBrain, LuSparkles,
  LuBell, LuCalendarPlus, LuChevronRight, LuFlame,
  LuPenTool, LuAtom, LuMusic2, LuLanguages, LuLeaf, LuTimer,
  LuCalendar, LuStar, LuSettings
} from "react-icons/lu";
import { db, auth } from "../components/firebase";
import {
  doc, getDoc, setDoc, collection,
  query, where, getDocs, addDoc, updateDoc,
  serverTimestamp, writeBatch, increment
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-hot-toast";


import workingAnim     from "../assets/working.json";
import instructionAnim from "../assets/instruction-animation.json";
import challengeAnim   from "../assets/challenge-animation.json";

import "./Challenge75Hard.css";

/* ─────────────────────── Service Worker Registration ─────────────────────── */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => console.log("SW registered:", reg.scope))
    .catch((err) => console.error("SW registration failed:", err));
}

/* ─────────────────────── Duration Presets ─────────────────────── */
const DURATION_PRESETS = [
  {
    id: "7",
    days: 7,
    label: "Starter Sprint",
    sub: "Build the habit",
    emoji: "🌱",
    color: "#34d399",
    color2: "#10b981",
    glow: "rgba(52,211,153,.22)",
    grad: "linear-gradient(135deg,#34d399,#10b981)",
    badge: "Beginner",
  },
  {
    id: "14",
    days: 14,
    label: "Two-Week Push",
    sub: "Momentum builder",
    emoji: "⚡",
    color: "#38bdf8",
    color2: "#0ea5e9",
    glow: "rgba(56,189,248,.22)",
    grad: "linear-gradient(135deg,#38bdf8,#0ea5e9)",
    badge: null,
  },
  {
    id: "30",
    days: 30,
    label: "Month Mastery",
    sub: "Identity shift",
    emoji: "🎯",
    color: "#fbbf24",
    color2: "#f59e0b",
    glow: "rgba(251,191,36,.22)",
    grad: "linear-gradient(135deg,#fbbf24,#f59e0b)",
    badge: "Popular",
  },
  {
    id: "75",
    days: 75,
    label: "75-Day Hard",
    sub: "The original",
    emoji: "🧠",
    color: "#818cf8",
    color2: "#a855f7",
    glow: "rgba(129,140,248,.22)",
    grad: "linear-gradient(135deg,#818cf8,#a855f7)",
    badge: "Classic",
  },
  {
    id: "180",
    days: 180,
    label: "Half-Year Haul",
    sub: "Scholar transformation",
    emoji: "🏆",
    color: "#f472b6",
    color2: "#ec4899",
    glow: "rgba(244,114,182,.22)",
    grad: "linear-gradient(135deg,#f472b6,#ec4899)",
    badge: "Elite",
  },
  {
    id: "custom",
    days: null,
    label: "Custom",
    sub: "Your timeline",
    emoji: "✏️",
    color: "#fb923c",
    color2: "#f97316",
    glow: "rgba(251,146,60,.22)",
    grad: "linear-gradient(135deg,#fb923c,#f97316)",
    badge: null,
  },
];

const CHAL_COL  = "study_challenges";
const LOGS_COL  = "study_logs";
const GRACE_MAX = 3;

const QUOTES = [
  { text: "Small consistent actions compound into extraordinary results.", author: "James Clear" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Study not to know more, but to understand more deeply.", author: "Seneca" },
  { text: "Learning is not attained by chance. It must be sought with ardor.", author: "Abigail Adams" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill.", author: "Brian Herbert" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "Excellence is not a destination but a continuous journey.", author: "Brian Tracy" },
  { text: "You don't rise to the level of your goals — you fall to the level of your systems.", author: "James Clear" },
];

const MODES = {
  deepWork: {
    id: "deepWork", label: "Deep Focus", subtitle: "Zero Distractions",
    emoji: "🧠", lottie: workingAnim,
    color: "#818cf8", color2: "#a855f7",
    glow: "rgba(129,140,248,.22)",
    grad: "linear-gradient(135deg,#818cf8,#a855f7)",
    description: "Ruthless deep work. Build the focus muscle that separates scholars from dreamers.",
    mantra: "Depth over breadth. Mastery over mediocrity.",
    tasks: [
      { id: "deep3h",    label: "3 hrs Deep Work",        hint: "Single session, zero distractions", Icon: LuClock,      color: "#818cf8" },
      { id: "problems",  label: "10+ Practice Problems",  hint: "Active solving, not passive reading", Icon: LuCalculator, color: "#a855f7" },
      { id: "read20",    label: "Read 20 Pages",           hint: "Textbook or academic paper",        Icon: LuBookOpen,   color: "#38bdf8" },
      { id: "notes",     label: "Structured Notes",        hint: "Cornell, Zettelkasten, mind-map",    Icon: LuPenTool,    color: "#34d399" },
      { id: "review",    label: "Spaced Repetition",       hint: "Flashcards or active recall",        Icon: LuMicroscope, color: "#fbbf24" },
      { id: "nopassive", label: "No Passive Scroll",       hint: "No mindless social or YouTube",      Icon: LuTarget,     color: "#fb923c" },
    ],
  },
  academic: {
    id: "academic", label: "Academic Edge", subtitle: "Scholar Mode",
    emoji: "📚", lottie: instructionAnim,
    color: "#38bdf8", color2: "#818cf8",
    glow: "rgba(56,189,248,.22)",
    grad: "linear-gradient(135deg,#38bdf8,#818cf8)",
    description: "Comprehensive academic excellence. Read, write, solve and review every single day.",
    mantra: "Knowledge compounds like interest. Start now.",
    tasks: [
      { id: "read30",    label: "Read 30 Pages",           hint: "Textbook, paper or non-fiction",     Icon: LuBookOpen,  color: "#38bdf8" },
      { id: "write",     label: "Write 500 Words",          hint: "Essay, journal, or synthesis notes", Icon: LuPencil,    color: "#818cf8" },
      { id: "problems2", label: "Problem Sets",             hint: "At least 8 practice questions",      Icon: LuAtom,      color: "#a855f7" },
      { id: "review2",   label: "Active Recall",            hint: "Quiz yourself without looking",      Icon: LuBrain,     color: "#34d399" },
      { id: "research",  label: "Research Hour",            hint: "Explore beyond the syllabus",        Icon: LuTrendingUp,color: "#fbbf24" },
      { id: "noscroll2", label: "Screen-Free Hour",         hint: "1 hr completely device-free",         Icon: LuLeaf,      color: "#fb923c" },
    ],
  },
  custom: {
    id: "custom", label: "My Challenge", subtitle: "Your Rules",
    emoji: "⚡", lottie: challengeAnim,
    color: "#f472b6", color2: "#fbbf24",
    glow: "rgba(244,114,182,.22)",
    grad: "linear-gradient(135deg,#f472b6,#fbbf24)",
    description: "Design your own challenge. Pick your tasks, set your standards, own your transformation.",
    mantra: "The best system is the one you'll actually follow.",
    tasks: [],
  },
};

const ICON_OPTIONS = [
  { id: "book",    Icon: LuBookOpen   },
  { id: "brain",   Icon: LuBrain      },
  { id: "target",  Icon: LuTarget     },
  { id: "zap",     Icon: LuZap        },
  { id: "clock",   Icon: LuClock      },
  { id: "pencil",  Icon: LuPencil     },
  { id: "code",    Icon: LuCode       },
  { id: "calc",    Icon: LuCalculator },
  { id: "micro",   Icon: LuMicroscope },
  { id: "music",   Icon: LuMusic2     },
  { id: "lang",    Icon: LuLanguages  },
  { id: "trend",   Icon: LuTrendingUp },
];
const COLORS   = ["#818cf8","#a855f7","#38bdf8","#34d399","#fbbf24","#f472b6","#fb923c","#f87171"];
const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.id, o.Icon]));

/* ═══════════════════════════════════════════════════════════════
   BULLETPROOF DATE HELPERS
═══════════════════════════════════════════════════════════════ */

/** Safely convert Firestore Timestamp | Date | string → Date */
function safeToDate(ts) {
  if (!ts) return new Date();
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  const p = new Date(ts);
  return isNaN(p.getTime()) ? new Date() : p;
}

/** UTC-based day number — immune to DST / timezone drift */
function getDayNumber(startDate, totalDays) {
  const start = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const now   = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.min(Math.max(Math.floor((today - start) / 86_400_000) + 1, 1), totalDays);
}

/** Zero-padded YYYY-MM-DD key for today */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════
   LOCAL ALARM SCHEDULER (survives tab closes via localStorage)
═══════════════════════════════════════════════════════════════ */
const ALARM_KEY = "s75-pending-alarms";

const AlarmScheduler = {
  schedule(id, title, body, delayMs) {
    let all = [];
    try { all = JSON.parse(localStorage.getItem(ALARM_KEY) || "[]"); } catch { all = []; }
    // Remove old entry with same id before adding fresh one
    all = all.filter(a => a.id !== id);
    all.push({ id, fireTime: Date.now() + delayMs, title, body, notified: false });
    localStorage.setItem(ALARM_KEY, JSON.stringify(all));
    AlarmScheduler.check();
  },

  check() {
    const now = Date.now();
    let all = [];
    try { all = JSON.parse(localStorage.getItem(ALARM_KEY) || "[]"); } catch { return []; }
    let changed = false;

    all.forEach((a) => {
      if (!a.notified && a.fireTime <= now) {
        a.notified = true;
        changed = true;
        if ("Notification" in window && Notification.permission === "granted") {
          navigator.serviceWorker?.ready.then((reg) =>
            reg.showNotification(a.title, {
              body: a.body,
              icon: "/favicon.ico",
              tag: a.id,
              requireInteraction: true,
            })
          ).catch(() => {
            // Fallback to basic Notification API if SW not available
            new Notification(a.title, { body: a.body, icon: "/favicon.ico" });
          });
        }
      }
    });

    if (changed) localStorage.setItem(ALARM_KEY, JSON.stringify(all));
    return all.filter((a) => !a.notified);
  },

  clearAll() {
    localStorage.removeItem(ALARM_KEY);
  },
};

/* ═══════════════════════════════════════════════════════════════
   FIRESTORE HELPERS
═══════════════════════════════════════════════════════════════ */
function chalId(uid, mode, durId)      { return `${uid}_${mode}_${durId}`; }
function userModeKey(uid, mode, durId) { return `${uid}_${mode}_${durId}`; }
function getDurPreset(durId)           { return DURATION_PRESETS.find(d => d.id === durId) || DURATION_PRESETS[3]; }
function serializeTasks(tasks)         { return tasks.map(({ Icon, ...rest }) => rest); } // eslint-disable-line
function hydrateTasks(tasks)           { return (tasks || []).map(t => ({ ...t, Icon: ICON_MAP[t.iconId] || LuTarget })); }

async function fetchChallenge(uid, mode, durId) {
  const snap = await getDoc("users", uid, CHAL_COL, chalId(uid, mode, durId));
  return snap.exists() ? snap.data() : null;
}

async function fetchLogs(uid, mode, durId) {
  const q    = query(
    collection(db, LOGS_COL),
    where("userModeKey", "==", userModeKey(uid, mode, durId)),
    where("archived", "==", false)
  );
  const snap = await getDocs(q);
  const logs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  logs.sort((a, b) => a.day - b.day);
  return logs;
}

async function upsertLog(uid, mode, durId, dayNum, fields) {
  const key  = userModeKey(uid, mode, durId);
  const q    = query(collection(db, LOGS_COL), where("userModeKey", "==", key), where("day", "==", dayNum));
  const snap = await getDocs(q);
  const base = { userModeKey: key, userId: uid, mode, durId, day: dayNum, archived: false };
  if (snap.empty) await addDoc(collection(db, LOGS_COL), { ...base, ...fields });
  else            await updateDoc(snap.docs[0].ref, fields);
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION HELPERS
═══════════════════════════════════════════════════════════════ */
async function requestNotifPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

/* ═══════════════════════════════════════════════════════════════
   CALENDAR HELPERS  — ICS now includes VALARM
═══════════════════════════════════════════════════════════════ */
function makeICS(title, description, durationDays) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + durationDays);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyBuddy//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:study-${Date.now()}@studybuddy.app`,
    `DTSTAMP:${fmt(now)}`,
    `DTSTART:${fmt(now)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `RRULE:FREQ=DAILY;COUNT=${durationDays}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Study time! Day check-in.",
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(content, filename) {
  const blob = new Blob([content], { type: "text/calendar" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function openGoogleCalendar(title, description, durationDays) {
  const now    = new Date();
  const end    = new Date(now);
  end.setDate(end.getDate() + durationDays);
  const fmt    = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\..+/, "") + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(now)}/${fmt(end)}`,
    details: description,
    recur: `RRULE:FREQ=DAILY;COUNT=${durationDays}`,
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank");
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */

function Burst({ active, accent = "#818cf8" }) {
  const pieces = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    id: i,
    emoji: ["✨","🌟","💫","⚡","💜","🔵","📚","🧠","🎯","💡","🌸","⭐"][i % 12],
    x:     Math.random() * 100,
    delay: Math.random() * 0.4,
    dur:   1.1 + Math.random() * 0.9,
    rot:   Math.random() * 720 - 360,
    size:  0.8 + Math.random() * 0.8,
  })), []); // eslint-disable-line
  if (!active) return null;
  return (
    <div className="s75-burst" aria-hidden="true">
      {pieces.map(p => (
        <motion.span key={p.id} className="s75-burst-piece"
          style={{ left: `${p.x}%`, fontSize: `${p.size}rem` }}
          initial={{ y: -10, opacity: 1 }}
          animate={{ y: "110vh", opacity: 0, rotate: p.rot }}
          transition={{ delay: p.delay, duration: p.dur, ease: "easeIn" }}>
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}

function ArcRing({ pct = 0, size = 90, stroke = 7, label, sub, c1 = "#818cf8", c2 = "#a855f7" }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct, 1);
  const gid  = `arc-${c1.replace("#", "")}-${size}`;
  return (
    <div className="s75-arc-ring" style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} className="s75-arc-bg" strokeWidth={stroke} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.1, ease: "easeOut" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: ".86rem", fontWeight: 900, color: "var(--pookie-text)", lineHeight: 1 }}>{label}</span>
        {sub && <span style={{ fontSize: ".5rem", color: "var(--pookie-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{sub}</span>}
      </div>
    </div>
  );
}

function Heatmap({ logs, accent, accent2, totalDays }) {
  const cells = useMemo(() => Array.from({ length: totalDays }, (_, i) => {
    const log = logs.find(l => l.day === i + 1);
    const pct = log ? Object.values(log.tasks || {}).filter(Boolean).length / (log.totalTasks || 6) : 0;
    return { day: i + 1, status: !log ? "future" : log.allDone ? "done" : "partial", pct };
  }), [logs, totalDays]);

  const cols = useMemo(() => {
    const c = [];
    for (let i = 0; i < cells.length; i += 7) c.push(cells.slice(i, i + 7));
    return c;
  }, [cells]);

  return (
    <div className="s75-heatmap-grid" role="grid" aria-label="Progress heatmap">
      {cols.map((col, ci) => (
        <div key={ci} className="s75-hm-col" role="row">
          {col.map(c => (
            <motion.div key={c.day}
              className={`s75-hm-cell ${c.status === "future" ? "s75-hm-future" : ""}`}
              role="gridcell"
              aria-label={`Day ${c.day}: ${c.status}`}
              style={
                c.status === "done"    ? { background: `linear-gradient(135deg,${accent},${accent2})` } :
                c.status === "partial" ? { background: accent, opacity: 0.15 + c.pct * 0.55 } : {}
              }
              title={`Day ${c.day}${c.status !== "future" ? ` — ${c.status}` : ""}`}
              whileHover={{ scale: 1.6, zIndex: 10 }}
              transition={{ type: "spring", stiffness: 500 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* Duration Picker */
function DurationPicker({ selected, onSelect, customDays, onCustomDays }) {
  return (
    <div className="s75-duration-section">
      <div className="s75-section-label">
        <LuTimer size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Choose your challenge length
      </div>
      <div className="s75-duration-scroll">
        {DURATION_PRESETS.map((d, i) => (
          <motion.button
            key={d.id}
            className={`s75-dur-card ${selected?.id === d.id ? "s75-dur-card-active" : ""}`}
            style={{ "--dur-color": d.color, "--dur-glow": d.glow, "--dur-grad": d.grad }}
            onClick={() => onSelect(d)}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            aria-pressed={selected?.id === d.id}
            aria-label={`${d.label}: ${d.days || "custom"} days`}>
            {d.badge && (
              <span className="s75-dur-badge" style={{ color: d.color, background: `${d.color}15`, borderColor: `${d.color}35` }}>
                {d.badge}
              </span>
            )}
            <div className="s75-dur-emoji">{d.emoji}</div>
            {d.id === "custom" ? (
              <div className="s75-dur-custom-input">
                <input
                  type="number"
                  min={3} max={365}
                  value={customDays || ""}
                  placeholder="—"
                  aria-label="Custom number of days"
                  onChange={e => {
                    const v = Math.min(365, Math.max(3, parseInt(e.target.value) || 0));
                    onCustomDays(v || "");
                    onSelect(d);
                  }}
                  onClick={e => { e.stopPropagation(); onSelect(d); }}
                  style={{ "--dur-color": d.color }}
                />
                <div className="s75-dur-label" style={{ color: d.color }}>days</div>
              </div>
            ) : (
              <div className="s75-dur-days">{d.days}</div>
            )}
            <div className="s75-dur-label">{d.label}</div>
            <div className="s75-dur-sub">{d.sub}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* Custom Task Builder */
function CustomBuilder({ tasks, onChange }) {
  const [label,  setLabel]  = useState("");
  const [hint,   setHint]   = useState("");
  const [iconId, setIconId] = useState("book");
  const [color,  setColor]  = useState(COLORS[0]);

  const add = useCallback(() => {
    if (!label.trim() || tasks.length >= 8) return;
    onChange([...tasks, {
      id:     `ct_${Date.now()}`,
      label:  label.trim(),
      hint:   hint.trim() || "Complete daily",
      iconId,
      color,
      Icon:   ICON_MAP[iconId] || LuTarget,
    }]);
    setLabel(""); setHint("");
  }, [label, hint, iconId, color, tasks, onChange]);

  return (
    <div className="s75-builder">
      <div className="s75-builder-list">
        {tasks.length === 0 && <p className="s75-builder-empty">✨ Add your daily study tasks below</p>}
        <AnimatePresence>
          {tasks.map((t, i) => (
            <motion.div key={t.id} className="s75-builder-item"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }} transition={{ delay: i * 0.04 }}>
              <div className="s75-bi-icon" style={{ background: `${t.color}20` }}>
                <t.Icon size={14} style={{ color: t.color }} />
              </div>
              <div className="s75-bi-text">
                <span className="s75-bi-name">{t.label}</span>
                <span className="s75-bi-sub">{t.hint}</span>
              </div>
              <button className="close-btn" onClick={() => onChange(tasks.filter(x => x.id !== t.id))}
                aria-label={`Remove task: ${t.label}`}>
                <FaTimes size={9} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {tasks.length < 8 && (
        <div className="s75-builder-form">
          <input className="field-input" placeholder="Task name (e.g. Read 20 pages)"
            value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()} maxLength={40}
            aria-label="Task name" />
          <input className="field-input" placeholder="Short hint (optional)"
            value={hint} onChange={e => setHint(e.target.value)} maxLength={60}
            aria-label="Task hint" />
          <div className="s75-picker-row">
            <div className="s75-icon-grid" role="group" aria-label="Choose icon">
              {ICON_OPTIONS.map(o => (
                <button key={o.id}
                  className={`s75-icon-opt ${iconId === o.id ? "s75-icon-sel" : ""}`}
                  style={{ color: iconId === o.id ? color : "var(--pookie-muted)" }}
                  onClick={() => setIconId(o.id)}
                  aria-label={o.id}
                  aria-pressed={iconId === o.id}>
                  <o.Icon size={14} />
                </button>
              ))}
            </div>
            <div className="s75-color-grid" role="group" aria-label="Choose colour">
              {COLORS.map(c => (
                <button key={c} className="s75-color-opt"
                  style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--pookie-bg),0 0 0 3.5px ${c}` : "none" }}
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c} />
              ))}
            </div>
          </div>
          <button className="s75-add-btn" onClick={add} disabled={!label.trim()}>
            <FaPlus size={10} /> Add Task
          </button>
        </div>
      )}
      {tasks.length >= 8 && <p className="s75-builder-max">Maximum 8 tasks — you're focused 🎯</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION + CALENDAR CARD  — with AlarmScheduler
═══════════════════════════════════════════════════════════════ */
function NotifCard({ cfg, durPreset, dayNum, totalDays, notifEnabled, setNotifEnabled, notifTime, setNotifTime }) {
  const [notifStatus, setNotifStatus] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) return Notification.permission;
    return "unsupported";
  });

  async function toggleNotifs() {
    if (!notifEnabled) {
      const perm = await requestNotifPermission();
      setNotifStatus(perm);
      if (perm === "granted") {
        setNotifEnabled(true);
        scheduleAlarm(notifTime, dayNum);
        toast.success("Reminders enabled! 🔔");
      } else if (perm === "denied") {
        toast.error("Notifications blocked. Enable them in browser settings.");
      } else if (perm === "unsupported") {
        toast.error("Your browser doesn't support notifications.");
      }
    } else {
      setNotifEnabled(false);
      AlarmScheduler.clearAll();
      toast("Reminders turned off.", { icon: "🔕" });
    }
  }

  function scheduleAlarm(time, day) {
    const [h, m] = time.split(":").map(Number);
    const now    = new Date();
    const fire   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1);
    const delay = fire.getTime() - Date.now();
    AlarmScheduler.schedule(
      `study-${day}`,
      "📚 Study Reminder",
      `Day ${day} — time to complete your tasks!`,
      delay
    );
  }

  function saveTime() {
    if (notifEnabled) {
      AlarmScheduler.clearAll();
      scheduleAlarm(notifTime, dayNum);
      toast.success(`Reminder set for ${notifTime} daily ⏰`);
    }
  }

  const title = `${cfg.emoji} ${cfg.label} — ${totalDays}-Day Study Challenge`;
  const desc  = `${cfg.description} Daily tasks: ${cfg.tasks.map(t => t.label || "").join(", ")}`;

  return (
    <div className="s75-notif-card glass-card-sm">
      <div className="s75-section-head">
        <span className="s75-section-title">
          <LuBell size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          Reminders &amp; Calendar
        </span>
      </div>

      <div className="s75-notif-row">
        <div className="s75-notif-label">
          Daily Study Reminder
          <small>{notifEnabled ? `Enabled — fires at ${notifTime}` : "Get a nudge every day"}</small>
        </div>
        {/* Accessible toggle switch */}
        <label className="s75-toggle" aria-label="Toggle daily reminders">
          <input
            type="checkbox"
            role="switch"
            aria-checked={notifEnabled}
            checked={notifEnabled}
            onChange={toggleNotifs}
            disabled={notifStatus === "denied"}
          />
          <span className="s75-toggle-track" aria-hidden="true" />
        </label>
      </div>

      {notifEnabled && (
        <motion.div className="s75-time-row"
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
          <label htmlFor="notif-time-input">Time:</label>
          <input
            id="notif-time-input"
            type="time"
            className="s75-time-input"
            value={notifTime}
            onChange={e => setNotifTime(e.target.value)}
            aria-label="Reminder time"
          />
          <button className="btn-ghost" style={{ padding: ".36rem .8rem", fontSize: ".74rem" }} onClick={saveTime}>
            Save
          </button>
        </motion.div>
      )}

      {notifStatus === "denied" && (
        <p style={{ fontSize: ".68rem", color: "var(--pookie-rose)", fontWeight: 700, margin: 0, lineHeight: 1.5 }}>
          ⚠️ Notifications are blocked. Allow them in your browser settings to enable reminders.
        </p>
      )}

      <div className="s75-divider" />

      <span style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--pookie-muted)", textTransform: "uppercase", letterSpacing: ".1em" }}>
        Add to Calendar
      </span>

      <div className="s75-cal-row">
        <button
          className="s75-cal-btn s75-cal-btn-primary"
          onClick={() => { openGoogleCalendar(title, desc, totalDays); toast.success("Opening Google Calendar…"); }}>
          <LuCalendarPlus size={12} /> Google
        </button>
        <button
          className="s75-cal-btn"
          onClick={() => { downloadICS(makeICS(title, desc, totalDays), "study-challenge.ics"); toast.success("Calendar file downloaded!"); }}>
          <LuCalendarPlus size={12} /> .ics file
        </button>
      </div>

      <p style={{ fontSize: ".66rem", color: "var(--pookie-muted)", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
        .ics works with Apple Calendar, Outlook &amp; most apps. Includes a native 15-min alarm.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INTRO SCREEN
═══════════════════════════════════════════════════════════════ */
function IntroScreen({ onPickModeAndDur, existingChallenges, selectedDur, onSelectDur, customDays, onCustomDays }) {
  const q = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);
  const effectiveDays = selectedDur?.id === "custom" ? (customDays || null) : selectedDur?.days;

  return (
    <div className="s75-intro-wrap">
      {/* Hero */}
      <div className="s75-hero">
        <motion.div className="s75-hero-text"
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }}>
          <motion.div className="s75-eyebrow"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <LuSparkles size={11} /> Flexible Study Challenge
          </motion.div>
          <h1 className="s75-hero-title">
            Transform your<br />
            <span className="s75-accent-word">mind</span> at your pace
          </h1>
          <p className="s75-hero-sub">
            7 days or 180 days — pick your timeline, choose your style, and build academic habits that actually stick.
          </p>
          <motion.blockquote style={{ margin: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <p style={{ fontSize: ".84rem", fontStyle: "italic", color: "var(--pookie-muted)", fontWeight: 600, lineHeight: 1.65, margin: 0 }}>
              "{q.text}"
            </p>
            <footer style={{ fontSize: ".68rem", fontWeight: 800, color: "var(--pookie-muted)", opacity: 0.7, marginTop: ".3rem" }}>
              — {q.author}
            </footer>
          </motion.blockquote>
          <motion.div className="s75-hero-actions"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            <button className="btn-primary" style={{ fontSize: ".95rem", padding: ".78rem 1.85rem" }}
              onClick={() => document.getElementById("s75-dur-anchor")?.scrollIntoView({ behavior: "smooth" })}>
              <LuFlame size={14} /> Choose Duration
            </button>
          </motion.div>
        </motion.div>

        <motion.div className="s75-hero-anim-wrap"
          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, type: "spring" }}>
          <div className="s75-hero-ring" aria-hidden="true" />
          <div className="s75-hero-anim">
            <Lottie animationData={workingAnim} loop style={{ width: "100%", height: "100%" }} />
          </div>
        </motion.div>
      </div>

      {/* Duration picker */}
      <div id="s75-dur-anchor">
        <DurationPicker selected={selectedDur} onSelect={onSelectDur} customDays={customDays} onCustomDays={onCustomDays} />
      </div>

      {/* Mode cards — only show after duration is picked */}
      <AnimatePresence>
        {effectiveDays && (
          <motion.div className="s75-modes-section"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Summary bar */}
            <div className="s75-selected-summary">
              <span className="s75-sel-pill" style={{ color: selectedDur.color }}>
                {selectedDur.emoji} {effectiveDays} days
              </span>
              <div className="s75-sel-divider" />
              <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--pookie-muted)" }}>
                {selectedDur.label} · Now choose your challenge style below
              </span>
              <button className="s75-sel-change"
                onClick={() => document.getElementById("s75-dur-anchor")?.scrollIntoView({ behavior: "smooth" })}>
                Change ↑
              </button>
            </div>

            <div className="s75-section-label">
              <LuStar size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Choose your challenge style
            </div>
            <div className="s75-mode-cards">
              {Object.values(MODES).map((m, i) => {
                const hasChal = !!existingChallenges[`${m.id}_${selectedDur.id}`];
                return (
                  <motion.button key={m.id}
                    className={`s75-mode-card ${hasChal ? "s75-card-active" : ""}`}
                    style={{ "--card-color": m.color, "--card-glow": m.glow, "--card-grad": m.grad }}
                    onClick={() => onPickModeAndDur(m.id, selectedDur, effectiveDays)}
                    initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    aria-label={`${hasChal ? "Continue" : "Start"} ${m.label} challenge`}>
                    {hasChal && <span className="s75-card-active-badge">Active</span>}
                    <span className="s75-card-emoji">{m.emoji}</span>
                    <div>
                      <p className="s75-card-title">{m.label}</p>
                      <p className="s75-card-sub">{m.subtitle}</p>
                    </div>
                    <p className="s75-card-desc">{m.description}</p>
                    <div className="s75-card-tasks">
                      {m.tasks.slice(0, 4).map(t => (
                        <span key={t.id} className="s75-task-chip"
                          style={{ color: t.color, borderColor: `${t.color}40`, background: `${t.color}10` }}>
                          <t.Icon size={9} /> {t.label}
                        </span>
                      ))}
                      {m.tasks.length > 4 && (
                        <span className="s75-task-chip" style={{ color: "var(--pookie-muted)", borderColor: "var(--pookie-border)" }}>
                          +{m.tasks.length - 4} more
                        </span>
                      )}
                      {m.id === "custom" && (
                        <span className="s75-task-chip" style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>
                          ⚡ You decide
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: ".35rem", color: m.color, fontSize: ".73rem", fontWeight: 800 }}>
                      {hasChal ? "Continue" : "Start"} <LuChevronRight size={12} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works */}
      <div className="s75-how">
        <div className="s75-section-label">How it works</div>
        <div className="s75-steps">
          {[
            { n: 1, title: "Pick Duration",   desc: "Choose from 7 days to 6 months. Or set a custom timeline.",      lottie: instructionAnim },
            { n: 2, title: "Daily Check-ins", desc: "Complete every task each day. Miss one? The clock resets to Day 1.", lottie: workingAnim    },
            { n: 3, title: "Cross the line",  desc: "You'll have built habits, knowledge, and discipline that last a lifetime.", lottie: challengeAnim },
          ].map((s, i) => (
            <motion.div key={s.n} className="s75-step glass-card-sm"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
              <div className="s75-step-num" aria-hidden="true">{s.n}</div>
              <div className="s75-step-anim">
                <Lottie animationData={s.lottie} loop style={{ width: "100%", height: "100%" }} />
              </div>
              <h3 className="s75-step-title">{s.title}</h3>
              <p className="s75-step-desc">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ChallengeHard() {
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  /* Duration state — persisted to localStorage */
  const [selectedDur, setSelectedDur] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sb-challenge-dur") || "null");
      return DURATION_PRESETS.find(d => d.id === saved) || null;
    } catch { return null; }
  });
  const [customDays, setCustomDays] = useState(() => {
    try { return parseInt(localStorage.getItem("sb-challenge-custom-days") || "0") || ""; } catch { return ""; }
  });

  useEffect(() => {
    localStorage.setItem("sb-challenge-dur", JSON.stringify(selectedDur?.id || null));
  }, [selectedDur]);
  useEffect(() => {
    localStorage.setItem("sb-challenge-custom-days", customDays.toString());
  }, [customDays]);

  /* Active challenge session */
  const [challenges,  setChallenges]  = useState({});
  const [logsMap,     setLogsMap]     = useState({});
  const [checked,     setChecked]     = useState({});
  const [customTasks, setCustomTasks] = useState([]);

  const [activeMode,  setActiveMode]  = useState(null);
  const [activeDurId, setActiveDurId] = useState(null);
  const [totalDays,   setTotalDays]   = useState(75);
  const [activeTab,   setActiveTab]   = useState("today");
  const [burst,       setBurst]       = useState(false);

  /* Modals */
  const [showRestart,      setShowRestart]      = useState(false);
  const [showGrace,        setShowGrace]        = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showCustomEd,     setShowCustomEd]     = useState(false);

  /* Notification state */
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("s75-notif-enabled") || "false"); } catch { return false; }
  });
  const [notifTime, setNotifTime] = useState(() => localStorage.getItem("s75-notif-time") || "09:00");

  useEffect(() => { localStorage.setItem("s75-notif-enabled", JSON.stringify(notifEnabled)); }, [notifEnabled]);
  useEffect(() => { localStorage.setItem("s75-notif-time", notifTime); }, [notifTime]);

  const burstTimer = useRef(null);
  useEffect(() => () => clearTimeout(burstTimer.current), []);

  /* Check pending alarms on mount */
  useEffect(() => { AlarmScheduler.check(); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return unsub;
  }, []);

  useEffect(() => { if (authReady && user) loadAll(); }, [authReady, user]); // eslint-disable-line

  /* Computed keys */
  const activeChalKey = activeMode && activeDurId ? `${activeMode}_${activeDurId}` : null;
  const challenge     = activeChalKey ? challenges[activeChalKey] : null;
  const logs          = activeChalKey ? (logsMap[activeChalKey] || []) : [];

  const getTasksFor = useCallback((mode) => {
    return mode === "custom" ? customTasks : (MODES[mode]?.tasks || []);
  }, [customTasks]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const modes  = ["deepWork", "academic", "custom"];
      const durIds = DURATION_PRESETS.map(d => d.id);
      const newChal = {}, newLogs = {}, newChecked = {};

      await Promise.all(
        modes.flatMap(mode => durIds.map(async durId => {
          try {
            const chal = await fetchChallenge(user.uid, mode, durId);
            if (!chal || chal.status === "idle") return;
            const key  = `${mode}_${durId}`;
            newChal[key]    = chal;
            const dl        = await fetchLogs(user.uid, mode, durId);
            newLogs[key]    = dl;
            const td        = chal.totalDays || 75;
            // ← Use safeToDate here instead of .toDate() directly
            const dn        = getDayNumber(safeToDate(chal.startedAt), td);
            const tl        = dl.find(l => l.day === dn);
            newChecked[key] = tl?.tasks || {};
            if (mode === "custom" && chal.customTasks) setCustomTasks(hydrateTasks(chal.customTasks));
          } catch (e) { console.warn("loadAll:", mode, durId, e); }
        }))
      );

      setChallenges(newChal);
      setLogsMap(newLogs);
      setChecked(newChecked);

      /* Restore last active challenge */
      const active = Object.entries(newChal).find(([, v]) => v?.status === "active");
      if (active && !activeMode) {
        const [key, data] = active;
        const [m, did]   = key.split("_");
        setActiveMode(m);
        setActiveDurId(did);
        setTotalDays(data.totalDays || 75);
        const dur = DURATION_PRESETS.find(d => d.id === did);
        if (dur) setSelectedDur(dur);
      }
    } catch (err) {
      console.error("loadAll:", err);
      toast.error("Failed to load data.");
    } finally { setLoading(false); }
  }, [user, activeMode]); // eslint-disable-line

  /* ── Start challenge ── */
  async function handleStart(mode, durPreset, days) {
    if (!user) return;
    const durId = durPreset.id;
    if (mode === "custom" && customTasks.length < 2) { toast.error("Add at least 2 tasks first ⚡"); return; }
    setSaving(true);
    try {
      const data = {
        userId: user.uid, mode, durId, totalDays: days, status: "active",
        startedAt: serverTimestamp(),
        streakDays: 0, completedDays: 0, restartCount: 0, graceUsed: 0,
      };
      if (mode === "custom") data.customTasks = serializeTasks(customTasks);
      await setDoc(doc(db, "users", user.uid, CHAL_COL, chalId(user.uid, mode, durId)), data);
      toast.success(`${MODES[mode].emoji} Day 1 of ${days} begins! Let's go! 🚀`);
      setShowStartConfirm(false);
      setActiveMode(mode);
      setActiveDurId(durId);
      setTotalDays(days);
      setActiveTab("today");
      await loadAll();
    } catch (err) {
      console.error("handleStart:", err);
      toast.error("Couldn't start. Try again.");
    } finally { setSaving(false); }
  }

  /* ── Toggle task ── */
  async function handleCheck(taskId) {
    if (!user || !challenge || !activeChalKey) return;
    const prev    = checked[activeChalKey] || {};
    const next    = { ...prev, [taskId]: !prev[taskId] };
    setChecked(c => ({ ...c, [activeChalKey]: next }));
    const tasks   = getTasksFor(activeMode);
    const allDone = tasks.every(t => next[t.id]);
    // ← safeToDate here
    const dayNum  = getDayNumber(safeToDate(challenge.startedAt), totalDays);
    setSaving(true);
    try {
      await upsertLog(user.uid, activeMode, activeDurId, dayNum, {
        dateKey: todayKey(), tasks: next, allDone, totalTasks: tasks.length, savedAt: serverTimestamp(),
      });
      const wasAllDone = (logsMap[activeChalKey] || []).find(l => l.day === dayNum)?.allDone;
      if (allDone && !wasAllDone) {
        const ref = doc(db,"users", uid, CHAL_COL, chalId(user.uid, activeMode, activeDurId));
        await updateDoc(ref, { streakDays: increment(1), completedDays: increment(1) });
        const freshSnap = await getDoc(ref);
        const freshData = freshSnap.data();
        if (freshData.completedDays >= totalDays) {
          await updateDoc(ref, { status: "completed" });
          freshData.status = "completed";
        }
        setChallenges(p => ({ ...p, [activeChalKey]: freshData }));
        setBurst(true);
        burstTimer.current = setTimeout(() => setBurst(false), 3200);
        toast.success(`🌟 Day ${dayNum} DONE! Keep the streak alive!`);
      }
      const freshLogs = await fetchLogs(user.uid, activeMode, activeDurId);
      setLogsMap(p => ({ ...p, [activeChalKey]: freshLogs }));
    } catch (err) {
      console.error("handleCheck:", err);
      toast.error("Save failed — check connection.");
      setChecked(c => ({ ...c, [activeChalKey]: prev }));
    } finally { setSaving(false); }
  }

  /* ── Restart ── */
  async function handleRestart() {
    if (!user || !activeChalKey) return;
    setSaving(true);
    try {
      const ref  = doc(db,"users", uid, CHAL_COL, chalId(user.uid, activeMode, activeDurId));
      const snap = await getDoc(ref);
      const prev = snap.data() || {};
      const nd   = {
        userId: user.uid, mode: activeMode, durId: activeDurId, totalDays,
        status: "active", startedAt: serverTimestamp(),
        streakDays: 0, completedDays: 0,
        restartCount: (prev.restartCount || 0) + 1, graceUsed: 0,
      };
      if (activeMode === "custom") nd.customTasks = serializeTasks(customTasks);
      await setDoc(ref, nd);
      const old = logsMap[activeChalKey] || [];
      if (old.length > 0) {
        const batch = writeBatch(db);
        old.forEach(l => { if (l._id) batch.update(doc(db, "users", uid, LOGS_COL, l._id), { archived: true }); });
        await batch.commit();
      }
      toast.success("🔄 Fresh start. Commit harder this time. 💪");
      setShowRestart(false);
      setChecked(c => ({ ...c, [activeChalKey]: {} }));
      await loadAll();
    } catch (err) {
      console.error("handleRestart:", err);
      toast.error("Restart failed.");
    } finally { setSaving(false); }
  }

  /* ── Grace day — NOW backfills yesterday's log ── */
  async function useGraceDay() {
    if (!user || !challenge || !activeChalKey) return;
    const used = challenge.graceUsed || 0;
    if (used >= GRACE_MAX) { toast.error("No grace days left."); return; }
    setSaving(true);
    try {
      // ← safeToDate
      const dayNum    = getDayNumber(safeToDate(challenge.startedAt), totalDays);
      const yesterday = dayNum - 1;

      /* Backfill yesterday's log so streak math stays correct */
      if (yesterday >= 1) {
        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        const yKey  = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, "0")}-${String(yDate.getDate()).padStart(2, "0")}`;
        const tasks = getTasksFor(activeMode);
        await upsertLog(user.uid, activeMode, activeDurId, yesterday, {
          dateKey:    yKey,
          tasks:      Object.fromEntries(tasks.map(t => [t.id, true])),
          allDone:    true,
          totalTasks: tasks.length,
          usedGrace:  true,
          savedAt:    serverTimestamp(),
        });
      }

      const ref = doc(db, "users", uid, CHAL_COL, chalId(user.uid, activeMode, activeDurId));
      await updateDoc(ref, { graceUsed: increment(1) });
      const snap = await getDoc(ref);
      setChallenges(p => ({ ...p, [activeChalKey]: snap.data() }));
      const freshLogs = await fetchLogs(user.uid, activeMode, activeDurId);
      setLogsMap(p => ({ ...p, [activeChalKey]: freshLogs }));

      toast.success(`🌿 Grace applied. ${GRACE_MAX - used - 1} left.`);
      setShowGrace(false);
    } catch (err) {
      console.error("useGraceDay:", err);
      toast.error("Grace day failed.");
    } finally { setSaving(false); }
  }

  /* ── Save custom tasks ── */
  async function saveCustomTasks() {
    if (!user || !activeDurId) return;
    try {
      await updateDoc(doc(db, "users", uid, CHAL_COL, chalId(user.uid, "custom", activeDurId)), { customTasks: serializeTasks(customTasks) });
      toast.success("Tasks updated ✅");
      setShowCustomEd(false);
    } catch { toast.error("Couldn't save tasks."); }
  }

  /* ── Reflection with auto-save ── */
  const [reflDraft, setReflDraft] = useState("");
  const cfg    = activeMode ? MODES[activeMode] : null;
  const durPre = activeDurId ? getDurPreset(activeDurId) : null;
  // ← safeToDate
  const dayNum = challenge ? getDayNumber(safeToDate(challenge.startedAt), totalDays) : 1;
  const todayLog = logs.find(l => l.day === dayNum);

  useEffect(() => { setReflDraft(todayLog?.reflection || ""); }, [activeChalKey, todayLog?.reflection]); // eslint-disable-line

  /* Auto-save reflection after 3 s of inactivity */
  useEffect(() => {
    if (!user || !challenge || reflDraft === (todayLog?.reflection || "")) return;
    const t = setTimeout(() => {
      upsertLog(user.uid, activeMode, activeDurId, dayNum, {
        reflection: reflDraft,
        savedAt:    serverTimestamp(),
      })
        .then(async () => {
          const fl = await fetchLogs(user.uid, activeMode, activeDurId);
          setLogsMap(p => ({ ...p, [activeChalKey]: fl }));
          toast.success("Auto-saved 💾", { duration: 1500 });
        })
        .catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [reflDraft]); // eslint-disable-line

  async function saveRefl() {
    if (!user || !challenge) return;
    try {
      await upsertLog(user.uid, activeMode, activeDurId, dayNum, { reflection: reflDraft, savedAt: serverTimestamp() });
      const fl = await fetchLogs(user.uid, activeMode, activeDurId);
      setLogsMap(p => ({ ...p, [activeChalKey]: fl }));
      toast.success("Reflection saved 📝");
    } catch { toast.error("Save failed."); }
  }

  /* ── Derived values ── */
  const tasks         = cfg ? getTasksFor(activeMode) : [];
  const modeChecked   = (activeChalKey && checked[activeChalKey]) || {};
  const doneTasks     = tasks.filter(t => modeChecked[t.id]).length;
  const taskPct       = tasks.length > 0 ? doneTasks / tasks.length : 0;
  const dayPct        = challenge ? (challenge.completedDays || 0) / totalDays : 0;
  const isCompleted   = challenge?.status === "completed";
  const allDoneToday  = doneTasks === tasks.length && tasks.length > 0;
  const graceUsed     = challenge?.graceUsed || 0;
  const graceRemaining = Math.max(GRACE_MAX - graceUsed, 0);
  const missedYesterday = challenge && dayNum > 1 ? !(logs.find(l => l.day === dayNum - 1)?.allDone) : false;
  const streak        = challenge?.streakDays || 0;
  const quoteToday    = QUOTES[dayNum % QUOTES.length];

  const stats = useMemo(() => {
    const done  = logs.filter(l => l.allDone).length;
    const total = logs.length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    let cur = 0, best = 0;
    logs.forEach(l => { if (l.allDone) { cur++; best = Math.max(best, cur); } else cur = 0; });
    return { done, total, pct, best };
  }, [logs]);

  /* ══════════════════════ RENDER GUARDS ══════════════════════ */

  if (!authReady || loading) return (
    <div className="s75-loading" role="status" aria-live="polite">
      <div className="s75-loading-pulse" />
      <Lottie animationData={workingAnim} loop style={{ width: 110, height: 110 }} />
      <p>Loading your challenge…</p>
    </div>
  );

  if (!user) return (
    <div className="s75-page">
      <Seo title="Study Challenge" />
      <div className="s75-mesh" aria-hidden="true" />
      <div className="s75-layout">
        <div className="s75-auth glass-card">
          <div className="s75-auth-anim">
            <Lottie animationData={challengeAnim} loop style={{ width: "100%", height: "100%" }} />
          </div>
          <h2 className="pookie-display-title">Start Your Study Challenge</h2>
          <p style={{ color: "var(--pookie-muted)", fontSize: ".9rem", fontWeight: 600, lineHeight: 1.65, margin: 0 }}>
            7 days or 6 months — pick your timeline and build habits that transform you.
          </p>
          <a href="/login" className="btn-primary" style={{ fontSize: ".95rem" }}>Log in to begin</a>
        </div>
      </div>
    </div>
  );

  /* ── Completed screen ── */
  if (isCompleted && cfg && durPre) return (
    <div className="s75-page">
      <Seo title={`${cfg.label} — COMPLETE! 🏆`} />
      <div className="s75-mesh" aria-hidden="true" />
      <Burst active accent={cfg.color} />
      <div className="s75-layout">
        <motion.div className="s75-complete-screen glass-card"
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="s75-complete-anim">
            <Lottie animationData={challengeAnim} loop style={{ width: "100%", height: "100%" }} />
          </div>
          <div style={{ fontSize: "3.5rem" }} aria-hidden="true">🏆</div>
          <h1 className="s75-complete-title pookie-display-title">YOU DID IT!</h1>
          <p className="s75-complete-sub">
            {totalDays} days. Every single task. You are a completely different scholar than who you were on Day 1.
          </p>
          <div className="s75-complete-stats">
            <div><span className="s75-cstat-num">{challenge.completedDays}</span><span className="s75-cstat-lbl">Days Done</span></div>
            <div><span className="s75-cstat-num">{challenge.restartCount || 0}</span><span className="s75-cstat-lbl">Restarts</span></div>
            <div><span className="s75-cstat-num">{tasks.length * totalDays}</span><span className="s75-cstat-lbl">Total Tasks</span></div>
          </div>
          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn-primary" onClick={handleRestart}><FaRedo size={11} /> Run it again</button>
            <button className="btn-ghost" onClick={() => { setActiveMode(null); setActiveDurId(null); }}>← New challenge</button>
          </div>
        </motion.div>
      </div>
    </div>
  );

  /* ── Intro (no active challenge) ── */
  if (!activeMode || !activeDurId) return (
    <div className="s75-page">
      <Seo title="Study Challenge — Choose Your Timeline" />
      <div className="s75-mesh" aria-hidden="true" />
      <div className="s75-layout">
        <IntroScreen
          onPickModeAndDur={(mode, dur, days) => {
            setActiveMode(mode);
            setActiveDurId(dur.id);
            setTotalDays(days);
            setActiveTab("today");
            setSelectedDur(dur);
          }}
          existingChallenges={challenges}
          selectedDur={selectedDur}
          onSelectDur={(d) => setSelectedDur(d)}
          customDays={customDays}
          onCustomDays={setCustomDays}
        />
      </div>
    </div>
  );

  /* ── No active challenge → Start panel ── */
  if (!challenge && cfg && durPre) {
    const effectiveDays = durPre.id === "custom" ? (customDays || 75) : durPre.days;
    return (
      <div className="s75-page">
        <Seo title={`Start ${cfg.label} — ${effectiveDays} Days`} />
        <div className="s75-mesh" aria-hidden="true" />
        <div className="s75-layout">
          {/* Breadcrumb */}
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 0 .5rem", display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button className="s75-link-sm" onClick={() => { setActiveMode(null); setActiveDurId(null); }}>← Back</button>
            <span style={{ fontSize: ".7rem", color: "var(--pookie-border2)" }}>|</span>
            <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--pookie-muted)" }}>
              {durPre.emoji} {effectiveDays}-day · {cfg.emoji} {cfg.label}
            </span>
          </div>

          <div style={{ maxWidth: 580, margin: "0 auto", paddingBottom: "3rem" }}>
            <motion.div className="glass-card s75-start-panel"
              style={{ position: "relative", overflow: "hidden" }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: cfg.grad }} aria-hidden="true" />

              <div className="s75-start-anim">
                <Lottie animationData={cfg.lottie} loop style={{ width: "100%", height: "100%" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", justifyContent: "center" }}>
                  <span style={{ fontSize: "1.8rem" }}>{cfg.emoji}</span>
                  <h2 style={{
                    fontFamily: "var(--pookie-display)", fontSize: "1.4rem", fontWeight: 900, margin: 0,
                    background: cfg.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}>{cfg.label}</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", justifyContent: "center" }}>
                  <span className="s75-dur-pill" style={{ color: durPre.color, borderColor: `${durPre.color}35`, background: `${durPre.color}10` }}>
                    {durPre.emoji} {effectiveDays} days
                  </span>
                  <span style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--pookie-muted)", textTransform: "uppercase", letterSpacing: ".09em" }}>
                    {durPre.label}
                  </span>
                </div>
              </div>

              <p className="s75-start-desc">{cfg.description}</p>
              <div className="s75-mantra-pill">
                <FaHeart size={10} style={{ color: cfg.color, flexShrink: 0 }} />
                <em>{cfg.mantra}</em>
              </div>

              {activeMode !== "custom" && tasks.length > 0 && (
                <div className="s75-task-preview">
                  {tasks.map(t => (
                    <div key={t.id} className="s75-task-chip"
                      style={{ color: t.color, borderColor: `${t.color}40`, background: `${t.color}10` }}>
                      <t.Icon size={10} /> {t.label}
                    </div>
                  ))}
                </div>
              )}

              {activeMode === "custom" && (
                <div style={{ width: "100%", textAlign: "left" }}>
                  <p style={{ fontSize: ".78rem", color: "var(--pookie-muted)", fontWeight: 600, textAlign: "center", margin: "0 0 .85rem" }}>
                    🛠 Build your task list (min 2, max 8):
                  </p>
                  <CustomBuilder tasks={customTasks} onChange={setCustomTasks} />
                </div>
              )}

              <motion.button className="btn-primary"
                style={{ fontSize: ".9rem", padding: ".78rem 1.85rem", background: cfg.grad, width: "100%", justifyContent: "center" }}
                onClick={() => setShowStartConfirm(true)}
                disabled={saving || (activeMode === "custom" && customTasks.length < 2)}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                {saving ? "Starting…" : `Begin ${cfg.label} — ${effectiveDays} Days ${cfg.emoji}`}
              </motion.button>

              <p className="s75-start-warn">
                ⚠️ Miss even one task on any day — restart from Day 1.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Confirm start modal */}
        <AnimatePresence>
          {showStartConfirm && (
            <motion.div className="pookie-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowStartConfirm(false)} role="dialog" aria-modal="true" aria-label="Confirm challenge start">
              <motion.div className="pookie-modal s75-modal-top" style={{ "--modal-grad": cfg.grad }}
                initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.88, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="s75-modal-anim">
                  <Lottie animationData={cfg.lottie} loop style={{ width: "100%", height: "100%" }} />
                </div>
                <h3 className="modal-title">Begin {cfg.label}? {cfg.emoji}</h3>
                <p className="modal-sub" style={{ textAlign: "center" }}>
                  <strong style={{ color: "var(--pookie-text)" }}>{effectiveDays} days.</strong> No compromises.
                  Miss a single task and the clock resets. This is a promise you make to yourself.
                </p>
                <p className="modal-sub" style={{ textAlign: "center", fontStyle: "italic", color: cfg.color, fontSize: ".82rem" }}>
                  "{cfg.mantra}"
                </p>
                <div className="modal-actions" style={{ justifyContent: "center" }}>
                  <button className="btn-ghost" onClick={() => setShowStartConfirm(false)}>Not yet</button>
                  <motion.button className="btn-primary" style={{ background: cfg.grad }}
                    onClick={() => handleStart(activeMode, durPre, effectiveDays)} disabled={saving} whileTap={{ scale: 0.96 }}>
                    {saving ? "Starting…" : `I'm ready! ${cfg.emoji}`}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ═══════════════════════ ACTIVE CHALLENGE UI ═══════════════════════ */
  if (!cfg || !durPre || !challenge) return null;

  return (
    <div className="s75-page" style={{ "--acc": cfg.color, "--acc2": cfg.color2 }}>
      <Seo title={`${cfg.label} — Day ${dayNum} / ${totalDays}`} />
      <div className="s75-mesh" aria-hidden="true" />
      <Burst active={burst} accent={cfg.color} />

      <div className="s75-app">
        {/* ════ LEFT SIDEBAR ════ */}
        <aside className="s75-sidebar" aria-label="Challenge info">
          {/* Identity card */}
          <motion.div className="s75-identity glass-card"
            style={{ "--card-grad": cfg.grad }}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
              <span className="s75-mode-pill" style={{ background: cfg.grad }}>
                {cfg.emoji} {cfg.label}
              </span>
              <button className="s75-link-sm" onClick={() => { setActiveMode(null); setActiveDurId(null); }}>Switch</button>
            </div>

            <div className="s75-dur-pill" style={{ color: durPre.color, borderColor: `${durPre.color}35`, background: `${durPre.color}08` }}>
              {durPre.emoji} {totalDays}-Day {durPre.label}
            </div>

            <div className="s75-day-display">
              <div className="s75-day-big" aria-label={`Day ${dayNum} of ${totalDays}`}>
                Day <span style={{ color: cfg.color }}>{dayNum}</span>
                <span> / {totalDays}</span>
              </div>
              <div className="s75-day-label">{totalDays - dayNum} days remaining · {Math.round(dayPct * 100)}% complete</div>
            </div>

            <div className="s75-arc-wrap">
              <ArcRing pct={dayPct} size={84} stroke={7}
                label={`${Math.round(dayPct * 100)}%`} sub="done"
                c1={cfg.color} c2={cfg.color2} />
              <div className="s75-arc-text">
                <div className="s75-arc-pct">{doneTasks}/{tasks.length} today</div>
                <div className="s75-arc-sub">tasks done<br />for Day {dayNum}</div>
              </div>
            </div>

            <div className="s75-streak-row">
              <div className="s75-streak-tile">
                <span className="s75-tile-val" style={{ color: cfg.color }}>🔥 {streak}</span>
                <span className="s75-tile-lbl">Streak</span>
              </div>
              <div className="s75-streak-tile">
                <span className="s75-tile-val" style={{ color: "#34d399" }}>🌿 {graceRemaining}</span>
                <span className="s75-tile-lbl">Grace left</span>
              </div>
            </div>

            <blockquote className="s75-quote-strip">
              <p className="s75-quote-text">"{quoteToday.text}"</p>
              <footer className="s75-quote-auth">— {quoteToday.author}</footer>
            </blockquote>

            {missedYesterday && (
              <motion.div className="s75-missed glass-card-sm" role="alert"
                animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}>
                <span className="s75-missed-text">⚠️ Missed yesterday</span>
                {graceRemaining > 0 ? (
                  <button className="btn-ghost" style={{ padding: ".28rem .65rem", fontSize: ".7rem" }}
                    onClick={() => setShowGrace(true)}>Use grace 🌿</button>
                ) : (
                  <button className="btn-danger" style={{ padding: ".28rem .65rem", fontSize: ".7rem" }}
                    onClick={() => setShowRestart(true)}>Restart</button>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Sidebar actions */}
          <motion.div className="s75-sidebar-actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <NotifCard cfg={cfg} durPreset={durPre} dayNum={dayNum} totalDays={totalDays}
              notifEnabled={notifEnabled} setNotifEnabled={setNotifEnabled}
              notifTime={notifTime} setNotifTime={setNotifTime} />
            <button className="s75-action-btn" onClick={() => setShowRestart(true)}>
              <span className="s75-action-icon">↩</span>
              <div className="s75-action-text">
                Restart Challenge
                <small>Reset to Day 1 (restart #{(challenge.restartCount || 0) + 1})</small>
              </div>
            </button>
          </motion.div>
        </aside>

        {/* ════ MAIN PANEL ════ */}
        <main className="s75-main" aria-label="Challenge content">
          {/* Nav tabs */}
          <motion.nav className="s75-nav glass-card-sm" aria-label="Challenge sections"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            {[
              ["today",    "📋 Today"],
              ["stats",    "📊 Stats"],
              ["calendar", "📅 Calendar"],
              ["settings", "⚙️ Settings"],
            ].map(([id, label]) => (
              <button key={id}
                className={`s75-nav-btn ${activeTab === id ? "s75-nav-active" : ""}`}
                style={activeTab === id ? { "--acc": cfg.color } : {}}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? "page" : undefined}>
                {label}
              </button>
            ))}
          </motion.nav>

          <AnimatePresence mode="wait">

            {/* ── TODAY TAB ── */}
            {activeTab === "today" && (
              <motion.div key="today"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <div className="glass-card" style={{ overflow: "hidden" }}>
                  <div className="s75-tasks-panel">
                    <div className="s75-section-head">
                      <span className="s75-section-title">Day {dayNum} Tasks</span>
                      {allDoneToday && (
                        <span style={{ fontSize: ".7rem", fontWeight: 800, color: cfg.color }} aria-live="polite">
                          ✨ All done!
                        </span>
                      )}
                    </div>
                    {tasks.map((task, i) => {
                      const done = !!modeChecked[task.id];
                      const Icon = task.Icon;
                      return (
                        <motion.button key={task.id}
                          className={`s75-task-row ${done ? "s75-done" : ""}`}
                          style={{ "--t-color": task.color }}
                          onClick={() => handleCheck(task.id)}
                          disabled={saving}
                          /* ← Accessibility patches */
                          role="checkbox"
                          aria-checked={done}
                          aria-label={`${task.label} — ${done ? "completed" : "not completed"}`}
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          whileTap={{ scale: 0.99 }}>
                          <div className="s75-task-icon-wrap"
                            style={{ background: `${task.color}18`, border: `1px solid ${task.color}28` }}>
                            {Icon && <Icon size={16} style={{ color: done ? task.color : `${task.color}66` }} aria-hidden="true" />}
                          </div>
                          <div className="s75-task-content">
                            <span className="s75-task-name">{task.label}</span>
                            <span className="s75-task-hint">{task.hint}</span>
                          </div>
                          <motion.div
                            className={`s75-check-ring ${done ? "s75-check-filled" : ""}`}
                            style={done ? { background: `linear-gradient(135deg,${task.color},${cfg.color2})` } : {}}
                            animate={done ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                            transition={{ duration: 0.28 }}
                            aria-hidden="true">
                            {done && <FaCheck size={9} />}
                          </motion.div>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="s75-task-progress" role="progressbar" aria-valuenow={doneTasks} aria-valuemin={0} aria-valuemax={tasks.length}>
                    <div className="s75-tp-bar">
                      <div className="s75-tp-fill"
                        style={{ width: `${taskPct * 100}%`, background: `linear-gradient(90deg,${cfg.color},${cfg.color2})` }} />
                    </div>
                    <span className="s75-tp-label">{doneTasks}/{tasks.length}</span>
                  </div>
                  <AnimatePresence>
                    {allDoneToday && (
                      <motion.div className="s75-all-done"
                        style={{ background: `linear-gradient(135deg,${cfg.color}12,${cfg.color2}12)`, border: `1px solid ${cfg.color}30` }}
                        initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                        role="status" aria-live="polite">
                        <span style={{ fontSize: "1.8rem" }} aria-hidden="true">🏆</span>
                        <div className="s75-all-done-text">
                          <div className="s75-all-done-title">Day {dayNum} complete! ({totalDays - dayNum} to go)</div>
                          <div className="s75-all-done-sub">Come back tomorrow and keep the streak alive. 📚</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Reflection — auto-saves after 3 s */}
                <motion.div className="glass-card s75-reflection"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                  <div className="s75-reflection-head">
                    <LuPencil size={14} style={{ color: cfg.color }} aria-hidden="true" />
                    <span className="s75-reflection-title">Today's Reflection</span>
                  </div>
                  <textarea className="field-input s75-refl-ta"
                    placeholder="What did you study? What clicked? What's still fuzzy? Honest reflection = faster growth."
                    value={reflDraft}
                    onChange={e => setReflDraft(e.target.value)}
                    maxLength={600} rows={4}
                    aria-label="Today's reflection" />
                  <div className="s75-refl-footer">
                    <span className="s75-refl-chars" aria-live="polite">{reflDraft.length}/600</span>
                    <button className="btn-ghost" style={{ padding: ".36rem .88rem", fontSize: ".76rem" }}
                      onClick={saveRefl} disabled={saving}>Save reflection</button>
                  </div>
                </motion.div>

                {/* Custom task editor */}
                {activeMode === "custom" && (
                  <motion.div className="glass-card" style={{ padding: "1.1rem 1.25rem" }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <button className="s75-link-sm" onClick={() => setShowCustomEd(v => !v)}
                      aria-expanded={showCustomEd}>
                      {showCustomEd ? "Close editor" : "⚙️ Edit my task list"}
                    </button>
                    <AnimatePresence>
                      {showCustomEd && (
                        <motion.div style={{ marginTop: "1rem" }}
                          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                          <CustomBuilder tasks={customTasks} onChange={setCustomTasks} />
                          <button className="btn-primary" style={{ marginTop: ".75rem", width: "100%", justifyContent: "center" }}
                            onClick={saveCustomTasks}>Save changes</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── STATS TAB ── */}
            {activeTab === "stats" && (
              <motion.div key="stats" style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <div className="glass-card">
                  <div className="s75-stats-grid">
                    {[
                      { label: "Days Done",      val: stats.done,       emoji: "✅", color: cfg.color   },
                      { label: "Consistency",    val: `${stats.pct}%`,  emoji: "📊", color: cfg.color2  },
                      { label: "Current Streak", val: streak,           emoji: "🔥", color: "#fbbf24"   },
                      { label: "Best Streak",    val: stats.best,       emoji: "🏆", color: "#34d399"   },
                    ].map((s, i) => (
                      <motion.div key={s.label} className="s75-stat-tile" style={{ "--tile-color": s.color }}
                        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                        <span className="s75-stat-emoji" aria-hidden="true">{s.emoji}</span>
                        <span className="s75-stat-val" style={{ color: s.color }}>{s.val}</span>
                        <span className="s75-stat-lbl">{s.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                {tasks.length > 0 && (
                  <div className="glass-card s75-breakdown">
                    <div className="s75-section-head">
                      <span className="s75-section-title">Task Completion Rate</span>
                    </div>
                    {tasks.map(task => {
                      const done = logs.filter(l => l.tasks?.[task.id]).length;
                      const rate = logs.length > 0 ? done / logs.length : 0;
                      return (
                        <div key={task.id} className="s75-bd-row">
                          <task.Icon size={13} style={{ color: task.color, flexShrink: 0 }} className="s75-bd-icon" aria-hidden="true" />
                          <span className="s75-bd-label">{task.label}</span>
                          <div className="s75-bd-bar" role="progressbar" aria-valuenow={Math.round(rate * 100)} aria-valuemin={0} aria-valuemax={100}>
                            <motion.div className="s75-bd-fill" style={{ background: task.color }}
                              initial={{ width: 0 }} animate={{ width: `${rate * 100}%` }} transition={{ duration: 0.7 }} />
                          </div>
                          <span className="s75-bd-pct" style={{ color: task.color }}>{Math.round(rate * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="glass-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: ".65rem" }}>
                  <div style={{ width: 100, height: 100 }}>
                    <Lottie animationData={workingAnim} loop style={{ width: "100%", height: "100%" }} />
                  </div>
                  <p style={{ fontSize: ".76rem", color: "var(--pookie-muted)", fontWeight: 600, fontStyle: "italic", textAlign: "center", margin: 0 }}>
                    Every session of data tells your story. Keep writing it.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── CALENDAR TAB ── */}
            {activeTab === "calendar" && (
              <motion.div key="calendar" style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <div className="glass-card s75-heatmap-wrap">
                  <div className="s75-section-head">
                    <span className="s75-section-title">{totalDays}-Day Progress Map</span>
                    <span style={{ fontSize: ".68rem", color: "var(--pookie-muted)", fontWeight: 700 }}>
                      {logs.filter(l => l.allDone).length} perfect days
                    </span>
                  </div>
                  <div className="s75-hm-legend" aria-hidden="true">
                    <span><span className="s75-hm-dot" style={{ background: `linear-gradient(135deg,${cfg.color},${cfg.color2})` }} /> Done</span>
                    <span><span className="s75-hm-dot" style={{ background: cfg.color, opacity: 0.45 }} /> Partial</span>
                    <span><span className="s75-hm-dot s75-hm-future" /> Upcoming</span>
                  </div>
                  <Heatmap logs={logs} accent={cfg.color} accent2={cfg.color2} totalDays={totalDays} />
                  <p className="s75-hm-note">
                    {Math.max(totalDays - dayNum, 0)} days remaining · Day {dayNum} of {totalDays}
                  </p>
                </div>
                {logs.filter(l => l.reflection).length > 0 && (
                  <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: ".75rem" }}>
                    <span className="s75-section-title">Recent Reflections</span>
                    {logs.filter(l => l.reflection).slice(-3).reverse().map(l => (
                      <div key={l.day} style={{ padding: ".7rem .9rem", background: "var(--pookie-surface2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: ".25rem" }}>
                        <span style={{ fontSize: ".63rem", fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: ".08em" }}>Day {l.day}</span>
                        <p style={{ fontSize: ".78rem", color: "var(--pookie-muted)", fontWeight: 600, margin: 0, lineHeight: 1.6 }}>{l.reflection}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === "settings" && (
              <motion.div key="settings" style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <NotifCard cfg={cfg} durPreset={durPre} dayNum={dayNum} totalDays={totalDays}
                  notifEnabled={notifEnabled} setNotifEnabled={setNotifEnabled}
                  notifTime={notifTime} setNotifTime={setNotifTime} />

                <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: ".85rem" }}>
                  <span className="s75-section-title">
                    <LuSettings size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} aria-hidden="true" />
                    Challenge Info
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
                    {[
                      { label: "Mode",      val: `${cfg.emoji} ${cfg.label}` },
                      { label: "Duration",  val: `${durPre.emoji} ${totalDays} days` },
                      { label: "Progress",  val: `${challenge.completedDays || 0} / ${totalDays}` },
                      { label: "Restarts",  val: challenge.restartCount || 0 },
                    ].map(item => (
                      <div key={item.label} style={{ background: "var(--pookie-surface2)", border: "1px solid var(--pookie-border)", borderRadius: 12, padding: ".65rem .85rem" }}>
                        <div style={{ fontSize: ".62rem", fontWeight: 700, color: "var(--pookie-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: ".2rem" }}>{item.label}</div>
                        <div style={{ fontSize: ".88rem", fontWeight: 800, color: "var(--pookie-text)" }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                  <button className="s75-link-sm" style={{ alignSelf: "flex-start" }}
                    onClick={() => { setActiveMode(null); setActiveDurId(null); }}>
                    ← Switch challenge / duration
                  </button>
                </div>

                <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: ".75rem", borderColor: "rgba(251,113,133,.2)" }}>
                  <span className="s75-section-title" style={{ color: "var(--pookie-rose)" }}>Danger Zone</span>
                  <p style={{ fontSize: ".76rem", color: "var(--pookie-muted)", fontWeight: 600, margin: 0, lineHeight: 1.55 }}>
                    Restarting resets to Day 1 but keeps your history archived. Restart #{(challenge.restartCount || 0) + 1}.
                  </p>
                  <button className="btn-danger" style={{ width: "fit-content" }} onClick={() => setShowRestart(true)}>
                    <FaRedo size={11} /> Restart Challenge
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ════ MODALS ════ */}

      {/* Restart modal */}
      <AnimatePresence>
        {showRestart && (
          <motion.div className="pookie-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowRestart(false)} role="dialog" aria-modal="true" aria-label="Restart challenge">
            <motion.div className="pookie-modal s75-modal-top" style={{ "--modal-grad": cfg.grad }}
              initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: "2.5rem", textAlign: "center" }} aria-hidden="true">📚</div>
              <h3 className="modal-title">Start over?</h3>
              <p className="modal-sub" style={{ textAlign: "center" }}>
                You reached Day <strong style={{ color: "var(--pookie-text)" }}>{dayNum}</strong> of {totalDays}.
                That discipline is yours forever. This will be restart #{(challenge.restartCount || 0) + 1}.
              </p>
              <div className="modal-actions" style={{ justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setShowRestart(false)}>Keep going 💪</button>
                <motion.button className="btn-primary" onClick={handleRestart} disabled={saving} whileTap={{ scale: 0.96 }}>
                  <FaRedo size={11} /> {saving ? "Restarting…" : "Restart Day 1"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grace modal */}
      <AnimatePresence>
        {showGrace && (
          <motion.div className="pookie-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowGrace(false)} role="dialog" aria-modal="true" aria-label="Use grace day">
            <motion.div className="pookie-modal s75-modal-top" style={{ "--modal-grad": "linear-gradient(90deg,#34d399,#059669)" }}
              initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: "2.5rem", textAlign: "center" }} aria-hidden="true">🌿</div>
              <h3 className="modal-title">Use a grace day?</h3>
              <p className="modal-sub" style={{ textAlign: "center" }}>
                Life happens. You have <strong style={{ color: "var(--pookie-text)" }}>{graceRemaining}</strong> grace day{graceRemaining !== 1 ? "s" : ""} left.
                This will backfill yesterday's log so your streak stays intact.
              </p>
              <div className="modal-actions" style={{ justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => { setShowGrace(false); setShowRestart(true); }}>Restart instead</button>
                <motion.button className="btn-primary"
                  style={{ background: "linear-gradient(135deg,#34d399,#059669)" }}
                  onClick={useGraceDay} disabled={saving} whileTap={{ scale: 0.96 }}>
                  {saving ? "Applying…" : "🌿 Use grace day"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}