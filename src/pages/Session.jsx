import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  writeBatch,
  increment,
  Timestamp,
  limit,
  deleteField,
} from "firebase/firestore";
import { auth, db } from "../components/firebase";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import clockAnimation from "../assets/3d-clock-animation.json";
import "./Session.css";

const staggerContainer = { animate: { transition: { staggerChildren: 0.07 } } };
const cardVariant = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 28 } },
};
const overlayVariant = {
  initial: { opacity: 0, y: 28, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 360, damping: 32 } },
  exit: { opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.18 } },
};

function fmtTime(s) {
  if (!s || s <= 0) return "00:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}
function fmtMins(s) {
  if (!s || s <= 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtHourLabel(i) {
  if (i === 0) return "12am";
  if (i < 12) return `${i}am`;
  if (i === 12) return "12pm";
  return `${i - 12}pm`;
}
function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localYM(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function localISOWeek(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function fmtClockTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtShortDate(date) {
  return new Date(date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function getTimestamp(l) {
  return l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
}
function startOfDay(d = new Date()) {
  const s = new Date(d); s.setHours(0, 0, 0, 0); return s;
}
function weekKeyStr(date = new Date()) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function formatTimerDisplay(seconds) {
  const m = Math.floor(Math.max(seconds, 0) / 60).toString().padStart(2, "0");
  const s = (Math.max(seconds, 0) % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const ENV_TYPE_MAP = {
  library: { color: "#a855f7", emoji: "📚" },
  cafe:    { color: "#f472b6", emoji: "☕" },
  home:    { color: "#fb7185", emoji: "🏠" },
  outdoor: { color: "#34d399", emoji: "🌳" },
  other:   { color: "#60a5fa", emoji: "📍" },
};
function envTypeInfo(type) {
  return ENV_TYPE_MAP[type] ?? ENV_TYPE_MAP.other;
}

const IDB_NAME    = "studybuddy_offline";
const IDB_VERSION = 1;
const IDB_STORE   = "sync_queue";

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}
async function idbEnqueue(item) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).add({ ...item, queuedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}
async function idbGetAll() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
async function idbDelete(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function applySessionChunk(uid, item) {
  const {
    sessionSeconds, dateKey, weekKey, monthKey, field, hourKey,
    isCheckpoint, completedPomodoros, abortedPomodoros,
    environment, environmentType,
  } = item;
  if (!uid || sessionSeconds <= 0) return;
  if (sessionSeconds >= 86400) {
    console.warn("Skipping session chunk > 24h");
    return;
  }
  const userDocRef = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userDocRef);
    if (!snap.exists()) return;
    const data          = snap.data();
    const todayKey      = localYMD();
    const currentWeekKey  = localISOWeek();
    const currentMonthKey = localYM();
    const prevDayTotal  = data.dailyStats?.[dateKey]?.totalTime || 0;
    const prevDayField  = data.dailyStats?.[dateKey]?.fieldTimes?.[field] || 0;
    const prevHourSecs  = data.dailyStats?.[dateKey]?.hourly?.[hourKey] || 0;
    const prevSessions  = data.dailyStats?.[dateKey]?.sessionsCount || 0;

    const updates = {
      [`fieldTimes.${field}`]:                                (data.fieldTimes?.[field] || 0) + sessionSeconds,
      totalTimeAllTime:                                       (data.totalTimeAllTime || 0) + sessionSeconds,
      [`dailyStats.${dateKey}.totalTime`]:                    prevDayTotal + sessionSeconds,
      [`dailyStats.${dateKey}.fieldTimes.${field}`]:          prevDayField + sessionSeconds,
      [`dailyStats.${dateKey}.hourly.${hourKey}`]:            prevHourSecs + sessionSeconds,
      [`dailyStats.${dateKey}.sessionsCount`]:                prevSessions + (isCheckpoint ? 0 : 1),
      [`weeklyStats.${weekKey}.totalTime`]:                   (data.weeklyStats?.[weekKey]?.totalTime || 0) + sessionSeconds,
      [`weeklyStats.${weekKey}.fieldTimes.${field}`]:         (data.weeklyStats?.[weekKey]?.fieldTimes?.[field] || 0) + sessionSeconds,
      [`weeklyStats.${weekKey}.sessionsCount`]:               (data.weeklyStats?.[weekKey]?.sessionsCount || 0) + (isCheckpoint ? 0 : 1),
      [`monthlyStats.${monthKey}.totalTime`]:                 (data.monthlyStats?.[monthKey]?.totalTime || 0) + sessionSeconds,
      [`monthlyStats.${monthKey}.fieldTimes.${field}`]:       (data.monthlyStats?.[monthKey]?.fieldTimes?.[field] || 0) + sessionSeconds,
      [`monthlyStats.${monthKey}.sessionsCount`]:             (data.monthlyStats?.[monthKey]?.sessionsCount || 0) + (isCheckpoint ? 0 : 1),
      lastStudyDate:    serverTimestamp(),
      lastStudyDateKey: dateKey,
    };
    if (completedPomodoros > 0) updates.pomodorosCompleted = (data.pomodorosCompleted || 0) + completedPomodoros;
    if (abortedPomodoros  > 0) updates.pomodorosAborted   = (data.pomodorosAborted  || 0) + abortedPomodoros;
    updates.totalTimeToday = dateKey === todayKey
      ? prevDayTotal + sessionSeconds
      : (data.dailyStats?.[todayKey]?.totalTime || 0);

    const weekTotal = Object.entries({ ...(data.dailyStats || {}) }).reduce((sum, [dk, ds]) => {
      if (localISOWeek(new Date(dk + "T12:00:00")) === currentWeekKey)
        return sum + (dk === dateKey ? prevDayTotal + sessionSeconds : (ds.totalTime || 0));
      return sum;
    }, 0);
    updates.totalTimeWeek = weekTotal;

    const monthTotal = Object.entries({ ...(data.dailyStats || {}) }).reduce((sum, [dk, ds]) => {
      return sum + (dk.startsWith(currentMonthKey)
        ? (dk === dateKey ? prevDayTotal + sessionSeconds : (ds.totalTime || 0))
        : 0);
    }, 0);
    updates.totalTimeMonth = monthTotal;
    tx.update(userDocRef, updates);
  });

  if (!isCheckpoint) {
    try {
      await addDoc(collection(db, "sessions"), {
        userId:              uid,
        startedAt:           Timestamp.fromDate(new Date(Date.now() - sessionSeconds * 1000)),
        endedAt:             serverTimestamp(),
        duration:            sessionSeconds,
        field,
        environment:         environment    ?? null,
        environmentType:     environmentType ?? null,
        completed:           completedPomodoros > 0 || sessionSeconds >= 60,
        pomodorosCompleted:  completedPomodoros,
        pomodorosAborted:    abortedPomodoros,
        strictMode:          false,
        deepWork:            false,
        distractions:        [],
        notes:               "",
        date:                dateKey,
        week:                weekKey,
      });
    } catch (e) {
      console.warn("Sessions doc write failed (non-critical):", e);
    }
  }
}

async function drainSyncQueue(uid, onProgress) {
  const items = await idbGetAll();
  if (!items.length) return 0;
  let synced = 0;
  for (const item of items) {
    try {
      if (item.type === "session_chunk") {
        await applySessionChunk(uid, item);
      } else if (item.type === "distraction") {
        const logRef = doc(collection(db, "distractions"));
        const batch  = writeBatch(db);
        batch.set(logRef, {
          userId: uid, type: item.dlType,
          timestamp: Timestamp.fromDate(new Date(item.timestamp)),
          date: item.date, week: item.week,
        });
        await batch.commit();
        await Promise.all([
          upsertDailySummary(uid, item.dlType),
          upsertWeeklySummary(uid, item.dlType),
        ]);
      }
      await idbDelete(item.id);
      synced++;
      onProgress?.(synced, items.length);
    } catch (err) {
      if (!navigator.onLine) break;
    }
  }
  return synced;
}

const DISTRACTION_TYPES = [
  { id: "phone",   label: "Phone",       emoji: "📱", color: "#f472b6", bg: "rgba(244,114,182,0.14)", tip: "Put it face-down in another room" },
  { id: "social",  label: "Social",      emoji: "📲", color: "#a855f7", bg: "rgba(168,85,247,0.14)",  tip: "Use app timers or greyscale mode" },
  { id: "noise",   label: "Noise",       emoji: "🔊", color: "#60a5fa", bg: "rgba(96,165,250,0.14)",  tip: "Try brown noise or noise-cancelling" },
  { id: "fatigue", label: "Fatigue",     emoji: "😴", color: "#34d399", bg: "rgba(52,211,153,0.14)",  tip: "20-min nap beats pushing through" },
  { id: "hunger",  label: "Hunger",      emoji: "🍔", color: "#fbbf24", bg: "rgba(251,191,36,0.14)",  tip: "Prep snacks before study sessions" },
  { id: "thought", label: "Mind Wander", emoji: "💭", color: "#fb7185", bg: "rgba(251,113,133,0.14)", tip: "Write it down, then refocus" },
  { id: "other",   label: "Other",       emoji: "❓", color: "#94a3b8", bg: "rgba(148,163,184,0.14)", tip: "Note what it was to spot patterns" },
];
function getDType(id) {
  return DISTRACTION_TYPES.find((t) => t.id === id) || DISTRACTION_TYPES[6];
}

async function upsertDailySummary(uid, typeId) {
  const key = localYMD();
  const ref = doc(db, "users", uid, "distractionSummaries", key);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { date: key, total: 1, byType: { [typeId]: 1 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { total: increment(1), [`byType.${typeId}`]: increment(1), updatedAt: serverTimestamp() });
  }
}
async function upsertWeeklySummary(uid, typeId) {
  const key = weekKeyStr();
  const ref = doc(db, "users", uid, "distractionWeekly", key);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { weekStart: key, total: 1, byType: { [typeId]: 1 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { total: increment(1), [`byType.${typeId}`]: increment(1), updatedAt: serverTimestamp() });
  }
}

const DW_DURATIONS       = [15, 25, 45, 60, 90, 120];
const SHIELD_MILESTONES  = [1, 3, 7, 14, 21, 30, 50, 75, 100];
const DEEP_WORK_QUOTES   = [
  "Deep work is the superpower of the 21st century.",
  "Focus is the new IQ.",
  "One hour of deep work outweighs eight hours of shallow drift.",
  "Protect the work. The world can wait.",
  "Your future self is watching. Make them proud.",
  "Excellence requires uninterrupted effort.",
];

function calcDWStreak(sessions = []) {
  if (!sessions.length) return 0;
  const days = [...new Set(
    sessions.filter((s) => s.completed).map((s) => {
      const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      return d.toISOString().slice(0, 10);
    }),
  )].sort().reverse();
  if (!days.length) return 0;
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.includes(key)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else if (i === 0)        { cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}
function dwShieldTier(streak) {
  if (streak >= 30) return { tier: "legendary", color: "#fbbf24", label: "Legendary" };
  if (streak >= 14) return { tier: "master",    color: "#a855f7", label: "Master" };
  if (streak >= 7)  return { tier: "warrior",   color: "#f472b6", label: "Warrior" };
  if (streak >= 3)  return { tier: "adept",     color: "#60a5fa", label: "Adept" };
  return                   { tier: "novice",    color: "#94a3b8", label: "Novice" };
}
function nextMilestone(streak) {
  return SHIELD_MILESTONES.find((m) => m > streak) ?? null;
}

function ShieldMini({ streak, size = 32 }) {
  const { color } = dwShieldTier(streak);
  return (
    <svg viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <path d="M50 4 L90 18 L90 52 C90 74 72 92 50 100 C28 92 10 74 10 52 L10 18 Z"
        fill={`${color}20`} stroke={color} strokeWidth="3" strokeLinejoin="round" />
      <text x="50" y="56" textAnchor="middle" dominantBaseline="middle" fill={color}
        fontSize="28" fontWeight="900" fontFamily="'Nunito', sans-serif">{streak}</text>
    </svg>
  );
}

function ShieldSVG({ streak, size = 100, active = false }) {
  const { color, tier } = dwShieldTier(streak);
  const fillPct = Math.min(streak * 3, 96);
  return (
    <motion.div
      style={{ width: size, height: size, display: "inline-block" }}
      animate={active ? {
        filter: [`drop-shadow(0 0 10px ${color}55)`, `drop-shadow(0 0 24px ${color}bb)`, `drop-shadow(0 0 10px ${color}55)`],
      } : { filter: `drop-shadow(0 0 8px ${color}44)` }}
      transition={{ repeat: active ? Infinity : 0, duration: 2.2, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <defs>
          <clipPath id={`sc-${tier}-${size}`}>
            <path d="M50 4 L90 18 L90 52 C90 74 72 92 50 100 C28 92 10 74 10 52 L10 18 Z" />
          </clipPath>
        </defs>
        <path d="M50 4 L90 18 L90 52 C90 74 72 92 50 100 C28 92 10 74 10 52 L10 18 Z"
          fill={`${color}14`} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <rect clipPath={`url(#sc-${tier}-${size})`} x="10" y={110 - fillPct} width="80" height={fillPct} fill={`${color}26`} />
        <text x="50" y="54" textAnchor="middle" dominantBaseline="middle" fill={color}
          fontSize="22" fontWeight="800" fontFamily="'Nunito', sans-serif">{streak}</text>
        <text x="50" y="70" textAnchor="middle" dominantBaseline="middle" fill={`${color}99`}
          fontSize="7.5" fontWeight="700" fontFamily="'Nunito', sans-serif" letterSpacing="1">DAY STREAK</text>
      </svg>
    </motion.div>
  );
}

function DWCircularTimer({ elapsed, total, active, paused }) {
  const r    = 80;
  const circ = 2 * Math.PI * r;
  const progress = total > 0 ? Math.min(elapsed / total, 1) : 0;
  const dash     = progress * circ;
  return (
    <div className="dw-ring-wrap">
      <svg viewBox="0 0 200 200" width="180" height="180">
        <circle cx="100" cy="100" r={r} className="dw-ring-track" strokeWidth="7" />
        <motion.circle cx="100" cy="100" r={r} className={`dw-ring-progress${paused ? " paused" : ""}`}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ - dash}
          transform="rotate(-90 100 100)"
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.45, ease: "linear" }} />
        {active && !paused && (
          <motion.circle cx="100" cy="100" r={r} fill="none" strokeWidth="1.5"
            stroke="rgba(244,114,182,0.20)"
            animate={{ opacity: [0.6, 0, 0.6], r: [r, r + 12, r] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }} />
        )}
      </svg>
      <div className="dw-ring-center">
        <span className="dw-ring-digits">{formatTimerDisplay(Math.max(total - elapsed, 0))}</span>
        <span className="dw-ring-label">{!active ? "ready" : paused ? "paused" : "deep work"}</span>
      </div>
    </div>
  );
}

function useInsights(userData, isRunning, liveSessionSeconds) {
  return useMemo(() => {
    const ds      = userData?.dailyStats || {};
    const entries = Object.entries(ds).filter(([, s]) => (s?.totalTime || 0) > 0);
    const hourlyTotals = Array(24).fill(0);
    const hourlyDays   = Array(24).fill(0);
    entries.forEach(([, stats]) => {
      const hourly = stats.hourly || {};
      Object.entries(hourly).forEach(([h, secs]) => {
        const hour = parseInt(h, 10);
        if (secs > 0) { hourlyTotals[hour] += secs; hourlyDays[hour] += 1; }
      });
    });
    if (isRunning && liveSessionSeconds > 0) hourlyTotals[new Date().getHours()] += liveSessionSeconds;
    let bestHour = -1, bestHourAvg = 0;
    hourlyTotals.forEach((total, hour) => {
      if (hourlyDays[hour] > 0) {
        const avg = total / hourlyDays[hour];
        if (avg > bestHourAvg) { bestHourAvg = avg; bestHour = hour; }
      }
    });
    const dowTotals = Array(7).fill(0);
    const dowCounts = Array(7).fill(0);
    entries.forEach(([date, stats]) => {
      const d   = new Date(date + "T12:00:00");
      const dow = d.getDay();
      dowTotals[dow] += stats?.totalTime || 0;
      dowCounts[dow] += 1;
    });
    if (isRunning && liveSessionSeconds > 0) dowTotals[new Date().getDay()] += liveSessionSeconds;
    let bestDow = -1, bestDowAvg = 0;
    dowTotals.forEach((total, dow) => {
      if (dowCounts[dow] > 0) {
        const avg = total / dowCounts[dow];
        if (avg > bestDowAvg) { bestDowAvg = avg; bestDow = dow; }
      }
    });
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const completed   = userData?.pomodorosCompleted || 0;
    const aborted     = userData?.pomodorosAborted   || 0;
    const total       = completed + aborted;
    const focusScore  = total > 0 ? Math.round((completed / total) * 100) : null;
    return {
      bestHour:              bestHour >= 0 ? fmtHourLabel(bestHour) : null,
      bestHourAvg:           bestHourAvg / 3600,
      mostProductiveDay:     bestDow >= 0 ? dayNames[bestDow] : null,
      mostProductiveDayShort:bestDow >= 0 ? dayShort[bestDow] : null,
      mostProductiveDayAvg:  bestDowAvg / 3600,
      focusScore,
      pomodorosCompleted: completed,
      pomodorosAborted:   aborted,
    };
  }, [userData, isRunning, liveSessionSeconds]);
}

function HourHistogram({ dailyStats, liveSeconds, isRunning }) {
  const todayKey  = localYMD();
  const todayData = dailyStats?.[todayKey] || {};
  const curHour   = new Date().getHours();
  const [hoveredHour, setHoveredHour] = useState(null);
  const hours = useMemo(() => {
    const hourly = todayData?.hourly || {};
    return Array.from({ length: 24 }, (_, i) => ({
      hour:    i,
      label:   i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
      seconds: hourly[String(i).padStart(2, "0")] || 0,
    }));
  }, [todayData]);
  const vals = useMemo(
    () => hours.map((h) => (h.hour === curHour && isRunning ? h.seconds + liveSeconds : h.seconds)),
    [hours, curHour, isRunning, liveSeconds],
  );
  const maxVal   = useMemo(() => Math.max(...vals, 1), [vals]);
  const totalToday = useMemo(() => vals.reduce((a, b) => a + b, 0), [vals]);
  const peakHour   = useMemo(() => {
    let best = -1, bestV = 0;
    vals.forEach((v, i) => { if (v > bestV) { bestV = v; best = i; } });
    return best;
  }, [vals]);
  return (
    <div className="hv2-wrap">
      <div className="hv2-bars">
        {vals.map((v, i) => {
          const pct       = Math.max((v / maxVal) * 100, v > 0 ? 5 : 0);
          const isLive    = i === curHour && isRunning;
          const isPeak    = i === peakHour && v > 0;
          const intensity = v / maxVal;
          let barBg;
          if (isLive)     barBg = "linear-gradient(to top, #059669, #34d399)";
          else if (v > 0) barBg = `rgba(192,132,252,${(0.22 + intensity * 0.68).toFixed(2)})`;
          else            barBg = "rgba(192,132,252,0.07)";
          return (
            <div key={i} className={`hv2-col${hoveredHour === i ? " hovered" : ""}`}
              onMouseEnter={() => setHoveredHour(i)} onMouseLeave={() => setHoveredHour(null)}>
              <div className="hv2-track">
                <motion.div className="hv2-bar"
                  style={{ background: barBg, boxShadow: isLive ? "0 0 8px rgba(52,211,153,0.55)" : isPeak && !isLive ? "0 0 6px rgba(192,132,252,0.5)" : "none" }}
                  initial={{ height: 0 }} animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.7, ease: [0.4,0,0.2,1], delay: i * 0.012 }} />
              </div>
              {i % 6 === 0 && <div className="hv2-tick">{hours[i].label}</div>}
            </div>
          );
        })}
      </div>
      <div className={`hv2-tooltip${hoveredHour !== null ? " visible" : ""}`}>
        {hoveredHour !== null && (
          <>
            <span className="hv2-tooltip-time">{fmtHourLabel(hoveredHour)}</span>
            <span className="hv2-tooltip-sep">·</span>
            <span className="hv2-tooltip-val">
              {vals[hoveredHour] > 0 ? fmtMins(vals[hoveredHour]) : "no activity"}
              {hoveredHour === curHour && isRunning ? " · live" : ""}
            </span>
          </>
        )}
      </div>
      <div className="hv2-footer">
        <div className="hv2-footer-item">
          <span className="hv2-footer-label">peak hour</span>
          <span className="hv2-footer-val">{peakHour >= 0 && totalToday > 0 ? fmtHourLabel(peakHour) : "—"}</span>
        </div>
        <div className="hv2-footer-item">
          <span className="hv2-footer-label">total today</span>
          <span className="hv2-footer-val">{totalToday > 0 ? fmtMins(totalToday) : "—"}</span>
        </div>
        <div className="hv2-legend">
          <span className="hv2-leg-dot" style={{ background: "#34d399" }} /><span>now</span>
          <span className="hv2-leg-dot" style={{ background: "rgba(192,132,252,0.75)", marginLeft: "0.75rem" }} /><span>past</span>
        </div>
      </div>
    </div>
  );
}

function FieldBreakdown({ fieldTimes, totalTime }) {
  const sorted = useMemo(() => {
    if (!fieldTimes) return [];
    return Object.entries(fieldTimes).filter(([, v]) => typeof v === "number" && v > 0).sort(([, a], [, b]) => b - a);
  }, [fieldTimes]);
  const COLORS = ["#a855f7","#34d399","#60a5fa","#fbbf24","#f87171","#a78bfa","#fb923c","#38bdf8"];
  if (!sorted.length) return <div className="empty-state-sm">No study time yet today!</div>;
  return (
    <div className="field-breakdown">
      {sorted.map(([field, secs], i) => {
        const pct = totalTime > 0 ? Math.round((secs / totalTime) * 100) : 0;
        return (
          <div key={field} className="fb-row">
            <div className="fb-info">
              <span className="fb-dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="fb-name">{field}</span>
              <span className="fb-time">{fmtMins(secs)}</span>
              <span className="fb-pct">{pct}%</span>
            </div>
            <div className="fb-bar-track">
              <motion.div className="fb-bar" style={{ background: COLORS[i % COLORS.length] }}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: [0.4,0,0.2,1], delay: i * 0.07 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InsightCards({ insights }) {
  const cards = [
    { icon: "🕐", label: "Best Hour",    value: insights.bestHour || "—",                        sub: insights.bestHour ? `avg ${insights.bestHourAvg.toFixed(1)}h/session` : "Keep studying to unlock",    hasBar: false },
    { icon: "📅", label: "Best Day",     value: insights.mostProductiveDayShort || "—",          sub: insights.mostProductiveDay ? `${insights.mostProductiveDayAvg.toFixed(1)}h avg` : "Need more data",   hasBar: false },
    { icon: "🎯", label: "Focus Score",  value: insights.focusScore !== null ? `${insights.focusScore}%` : "—", sub: insights.focusScore !== null ? `${insights.pomodorosCompleted} done · ${insights.pomodorosAborted} cut` : "Complete Pomodoros to track", hasBar: insights.focusScore !== null, barValue: insights.focusScore || 0 },
  ];
  return (
    <div className="ss-insights-grid">
      {cards.map((card, i) => (
        <motion.div key={card.label} className="ss-insight-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 24 }}>
          <div className="ss-insight-icon">{card.icon}</div>
          <div className="ss-insight-label">{card.label}</div>
          <div className="ss-insight-value">{card.value}</div>
          <div className="ss-insight-sub">{card.sub}</div>
          {card.hasBar && (
            <div className="ss-insight-bar">
              <motion.div className="ss-insight-bar-fill" initial={{ width: 0 }}
                animate={{ width: `${card.barValue}%` }}
                transition={{ duration: 1, ease: [0.4,0,0.2,1], delay: 0.3 }} />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export default function StartSession() {
  const [user, setUser]         = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading]   = useState(true);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncLockRef = useRef(false);

  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isRunning, setIsRunning]           = useState(false);
  const [pomodoroMode, setPomodoroMode]     = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [pomodoroRounds, setPomodoroRounds] = useState(0);
  const [isBreak, setIsBreak]               = useState(false);

  const [strictMode, setStrictMode] = useState(false);

  const [deepWorkEnabled, setDeepWorkEnabled] = useState(false);
  const [dwDuration, setDwDuration]           = useState(25);
  const [dwElapsed, setDwElapsed]             = useState(0);
  const [dwActive, setDwActive]               = useState(false);
  const [dwPaused, setDwPaused]               = useState(false);
  const [dwShowInterrupt, setDwShowInterrupt] = useState(false);
  const [dwShowHistory, setDwShowHistory]     = useState(false);
  const [dwDndEnabled, setDwDndEnabled]       = useState(false);
  const [dwSessions, setDwSessions]           = useState([]);
  const [dwUserData, setDwUserData]           = useState(null);
  const [dwLoading, setDwLoading]             = useState(false);
  const [dwTabSwitches, setDwTabSwitches]     = useState(0);
  const [dwShowDurationPicker, setDwShowDurationPicker] = useState(false);
  const dwSessionIdRef    = useRef(null);
  const dwSessionStartRef = useRef(null);
  const dwTabSwitchRef    = useRef(0);
  const dwQuoteRef        = useRef(DEEP_WORK_QUOTES[0]);

  const [inactivityModal, setInactivityModal] = useState(false);
  const lastInteractionRef   = useRef(Date.now());
  const inactivityCheckRef   = useRef(null);
  const modalAutoStopRef     = useRef(null);
  const INACTIVITY_LIMIT_MS  = 6 * 60 * 60 * 1000;
  const MODAL_RESPONSE_MS    = 60 * 1000;

  const [selectedField, setSelectedField]   = useState("General");
  const [newFieldName, setNewFieldName]     = useState("");
  const [removeModal, setRemoveModal]       = useState({ open: false, field: null, keepTime: false });

  const [todoList, setTodoList]         = useState([]);
  const [newTaskText, setNewTaskText]   = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [editingTask, setEditingTask]   = useState({ id: null, text: "" });
  const [lastDeleted, setLastDeleted]   = useState(null);

  const [recentSessions, setRecentSessions] = useState([]);
  const [editingSession, setEditingSession]   = useState(null);

  const [dlLogs, setDlLogs]                   = useState([]);
  const [dlDailySummaries, setDlDailySummaries] = useState({});
  const [dlWeeklySummaries, setDlWeeklySummaries] = useState({});
  const [dlLogging, setDlLogging]             = useState(false);
  const [dlLastLogged, setDlLastLogged]       = useState(null);
  const [dlTab, setDlTab]                     = useState("log");
  const [dlFilterType, setDlFilterType]       = useState(null);
  const dlUnsubLogsRef   = useRef(null);
  const dlUnsubDailyRef  = useRef(null);
  const dlUnsubWeeklyRef = useRef(null);

  const [activePanel, setActivePanel] = useState(null);
  const [navWarning, setNavWarning]   = useState({ open: false, cb: null });

  const [currentEnvironment, setCurrentEnvironment] = useState(null);
  const [userEnvironments, setUserEnvironments]     = useState([]);
  const [bestEnvironment, setBestEnvironment]       = useState(null);
  const [showEnvPicker, setShowEnvPicker]           = useState(false);
  const [envSuggestion, setEnvSuggestion]           = useState(null);

  const sessionStartWallTimeRef  = useRef(null);
  const sessionStartDateRef      = useRef(null);
  const accumulatedSecondsRef    = useRef(0);
  const isRunningRef             = useRef(false);
  const pomodoroModeRef          = useRef(false);
  const selectedFieldRef         = useRef("General");
  const strictModeRef            = useRef(false);
  const userRef                  = useRef(null);
  const unsubRef                 = useRef(null);
  const wakeLockRef              = useRef(null);
  const timerIntervalRef         = useRef(null);
  const checkpointIntervalRef    = useRef(null);
  const completedPomodorosInSessionRef = useRef(0);
  const isSavingDayBoundaryRef   = useRef(false);
  const checkpointBackoffRef     = useRef(1000);
  const currentEnvironmentRef    = useRef(null);

  const saveSessionChunkRef  = useRef(null);
  const getSegmentSecondsRef = useRef(null);

  useEffect(() => { isRunningRef.current  = isRunning;  }, [isRunning]);
  useEffect(() => { pomodoroModeRef.current = pomodoroMode; }, [pomodoroMode]);
  useEffect(() => { selectedFieldRef.current = selectedField; }, [selectedField]);
  useEffect(() => { strictModeRef.current = strictMode; }, [strictMode]);
  useEffect(() => { currentEnvironmentRef.current = currentEnvironment; }, [currentEnvironment]);

  const getSegmentSeconds = useCallback(() => {
    if (!sessionStartWallTimeRef.current) return 0;
    return Math.floor((Date.now() - sessionStartWallTimeRef.current) / 1000);
  }, []);
  const getTotalSessionSeconds = useCallback(() => {
    return accumulatedSecondsRef.current + getSegmentSeconds();
  }, [getSegmentSeconds]);

  useEffect(() => { getSegmentSecondsRef.current = getSegmentSeconds; }, [getSegmentSeconds]);

  const refreshQueueSize = useCallback(async () => {
    try { const items = await idbGetAll(); setQueueSize(items.length); } catch (_) {}
  }, []);

  const trySyncQueue = useCallback(async () => {
    if (!navigator.onLine || !userRef.current || syncLockRef.current) return;
    const items = await idbGetAll();
    if (!items.length) return;
    syncLockRef.current = true;
    setIsSyncing(true);
    try {
      const synced = await drainSyncQueue(userRef.current.uid, async () => { await refreshQueueSize(); });
      if (synced > 0) toast.success(`☁️ Synced ${synced} offline record${synced > 1 ? "s" : ""}!`);
    } catch (_) {}
    finally { syncLockRef.current = false; setIsSyncing(false); await refreshQueueSize(); }
  }, [refreshQueueSize]);

  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  trySyncQueue(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    refreshQueueSize();
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [trySyncQueue, refreshQueueSize]);

  const saveSessionChunk = useCallback(async (
    sessionSeconds, dateKey, weekKey, monthKey, field, hourKey,
    isCheckpoint = false, completedPomodoros = 0, abortedPomodoros = 0,
    meta = {}
  ) => {
    if (!userRef.current || sessionSeconds <= 0) return;
    if (sessionSeconds >= 86400) {
      toast.error("Session exceeds 24 hours — a day only has 24 hours!");
      return;
    }
    const uid     = userRef.current.uid;
    const payload = {
      sessionSeconds, dateKey, weekKey, monthKey, field, hourKey,
      isCheckpoint, completedPomodoros, abortedPomodoros,
      environment:     meta.environment     ?? null,
      environmentType: meta.environmentType ?? null,
    };
    if (!navigator.onLine) {
      await idbEnqueue({ type: "session_chunk", uid, ...payload });
      await refreshQueueSize();
      return;
    }
    try {
      await applySessionChunk(uid, payload);
    } catch (err) {
      if (!navigator.onLine || err?.code === "unavailable") {
        await idbEnqueue({ type: "session_chunk", uid, ...payload });
        await refreshQueueSize();
        toast("📦 Saved offline — will sync when connected.", { icon: "🔌" });
      } else { throw err; }
    }
  }, [refreshQueueSize]);

  useEffect(() => { saveSessionChunkRef.current = saveSessionChunk; }, [saveSessionChunk]);

  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request("screen"); } catch (_) {}
    }
  }, []);
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch (_) {}
      wakeLockRef.current = null;
    }
  }, []);
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible" && isRunningRef.current) await requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestWakeLock]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isRunningRef.current) {
        e.preventDefault();
        e.returnValue = "Timer is running — your session will be saved.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const stopTimerRef        = useRef(null);
  const strictGraceTimerRef = useRef(null);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!isRunningRef.current || !strictModeRef.current) return;
      if (document.hidden) {
        strictGraceTimerRef.current = setTimeout(() => {
          if (document.hidden && isRunningRef.current && strictModeRef.current) {
            toast.error("🔒 Strict mode: You left the tab! Timer paused.", { duration: 4000 });
            stopTimerRef.current?.();
          }
        }, 2000);
      } else {
        if (strictGraceTimerRef.current) { clearTimeout(strictGraceTimerRef.current); strictGraceTimerRef.current = null; }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (strictGraceTimerRef.current) clearTimeout(strictGraceTimerRef.current);
    };
  }, []);

  const recordInteraction = useCallback(() => { lastInteractionRef.current = Date.now(); }, []);

  useEffect(() => {
    const checkInactivity = () => {
      if (!isRunningRef.current || inactivityModal) return;
      if (Date.now() - lastInteractionRef.current >= INACTIVITY_LIMIT_MS) {
        setInactivityModal(true);
        modalAutoStopRef.current = setTimeout(async () => {
          setInactivityModal(false);
          toast.error("⏹ Timer stopped — no activity detected for 6 hours.", { duration: 5000 });
          await stopTimerRef.current?.();
        }, MODAL_RESPONSE_MS);
      }
    };
    inactivityCheckRef.current = setInterval(checkInactivity, 60 * 1000);
    return () => { clearInterval(inactivityCheckRef.current); clearTimeout(modalAutoStopRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inactivityModal]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "studyEnvironments"),
      where("userId", "==", user.uid),
      orderBy("focusScore", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setBestEnvironment({ id: snap.docs[0].id, ...snap.docs[0].data() });
      else setBestEnvironment(null);
    }, (err) => console.error("Best env listener:", err));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "studyEnvironments"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setUserEnvironments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("User envs listener:", err));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!currentEnvironment || !userData) { setEnvSuggestion(null); return; }
    const envStats = userData.environmentStats?.[currentEnvironment.name];
    if (!envStats) {
      const score    = currentEnvironment.focusScore ?? 0;
      const avgDur   = currentEnvironment.avgDuration ?? 0;
      if (score >= 80 && avgDur > 45 * 60) {
        setEnvSuggestion({ text: "🔥 You crush deep work here — try 90 min?", mode: "dw" });
      } else if (score > 0 && score < 50) {
        setEnvSuggestion({ text: "⚠️ Focus tends to drop here — stick to 25 min pomodoros", mode: "pomo" });
      } else {
        setEnvSuggestion(null);
      }
      return;
    }
    const avgFocus = envStats.avgFocusScore || 0;
    const avgDur   = envStats.avgDuration   || 0;
    if (avgFocus >= 80 && avgDur > 45 * 60) {
      setEnvSuggestion({ text: "🔥 You crush deep work here — try 90 min?", mode: "dw" });
    } else if (avgFocus < 50) {
      setEnvSuggestion({ text: "⚠️ Focus drops here — stick to 25 min pomodoros", mode: "pomo" });
    } else {
      setEnvSuggestion(null);
    }
  }, [currentEnvironment, userData]);

  const listenerRef = useRef({ unsub: null, uid: null });

  const setupListener = useCallback((uid) => {
    if (listenerRef.current.uid === uid) return;
    listenerRef.current.unsub?.();
    const ref   = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data   = snap.data();
        setUserData(data);
        setTodoList(data.todoList || []);
        const fields = data.studyFields || ["General"];
        setSelectedField((prev) => {
          const valid = fields.includes(prev) ? prev : fields[0] || "General";
          selectedFieldRef.current = valid;
          return valid;
        });
      } else { initDoc(uid); }
      setLoading(false);
    }, (err) => { console.error(err); toast.error("Database connection error"); setLoading(false); });
    listenerRef.current = { unsub, uid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initDoc = useCallback(async (uid) => {
    const dk = localYMD(); const wk = localISOWeek(); const mk = localYM();
    try {
      await setDoc(doc(db, "users", uid), {
        email: auth.currentUser?.email || "", name: auth.currentUser?.displayName || "User",
        createdAt: serverTimestamp(), todoList: [], studyFields: ["General"], fieldTimes: {},
        totalTimeToday: 0, totalTimeWeek: 0, totalTimeMonth: 0, totalTimeAllTime: 0,
        lastStudyDate: null, lastStudyDateKey: null, pomodorosCompleted: 0, pomodorosAborted: 0,
        dailyStats:  { [dk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0, hourly: {} } },
        weeklyStats: { [wk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
        monthlyStats:{ [mk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
      });
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u); userRef.current = u;
        setupListener(u.uid);
        trySyncQueue();
      } else {
        setUser(null); setUserData(null); setLoading(false); setLastDeleted(null);
        listenerRef.current.unsub?.();
        listenerRef.current = { unsub: null, uid: null };
      }
    });
    return () => {
      unsub();
      listenerRef.current.unsub?.();
      listenerRef.current = { unsub: null, uid: null };
    };
  }, [setupListener, trySyncQueue]);

  useEffect(() => {
    if (loading || !user) return;
    const saved = sessionStorage.getItem('sb_active_session');
    if (saved && !isRunning) {
      try {
        const { startTime, field, mode, accumulated, pomodoroMode: savedPomo, deepWorkEnabled: savedDw, dwDuration: savedDwDur } = JSON.parse(saved);
        const elapsed = Math.floor((Date.now() - startTime) / 1000) + (accumulated || 0);
        if (elapsed > 30 && elapsed < 8 * 3600) {
          toast((t) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                ⏱️ Recover {fmtMins(elapsed)} session?
              </span>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  style={{
                    background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.35)",
                    color: "#34d399", borderRadius: "999px", padding: "0.3rem 0.8rem",
                    fontSize: "0.76rem", fontWeight: 700, cursor: "pointer"
                  }}
                  onClick={() => {
                    accumulatedSecondsRef.current = accumulated || 0;
                    sessionStartWallTimeRef.current = startTime;
                    sessionStartDateRef.current = localYMD(new Date(startTime));
                    setSelectedField(field || "General");
                    selectedFieldRef.current = field || "General";
                    if (savedDw) {
                      setDeepWorkEnabled(true);
                      setDwDuration(savedDwDur || 25);
                    } else if (savedPomo) {
                      setPomodoroMode(true);
                    }
                    setIsRunning(true);
                    isRunningRef.current = true;
                    requestWakeLock();
                    toast.dismiss(t.id);
                    toast.success("✅ Session recovered — keep going!");
                  }}
                >
                  Resume
                </button>
                <button
                  style={{
                    background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                    color: "#94a3b8", borderRadius: "999px", padding: "0.3rem 0.8rem",
                    fontSize: "0.76rem", cursor: "pointer"
                  }}
                  onClick={() => {
                    sessionStorage.removeItem('sb_active_session');
                    toast.dismiss(t.id);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          ), { duration: 15000, id: 'session-recovery' });
        } else {
          sessionStorage.removeItem('sb_active_session');
        }
      } catch (_) {
        sessionStorage.removeItem('sb_active_session');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const startTimerInternal = useCallback(() => {
    sessionStartWallTimeRef.current  = Date.now();
    sessionStartDateRef.current      = localYMD();
    accumulatedSecondsRef.current    = 0;
    isRunningRef.current             = true;
  }, []);

  const checkDayBoundary = useCallback(async () => {
    if (!isRunningRef.current || !sessionStartDateRef.current) return;
    const todayKey = localYMD();
    if (sessionStartDateRef.current === todayKey || isSavingDayBoundaryRef.current) return;
    isSavingDayBoundaryRef.current = true;
    toast("🌙 New day — saving yesterday's progress…");
    const segSecs = getSegmentSecondsRef.current?.() ?? 0;
    if (segSecs > 0) {
      const dateKey  = sessionStartDateRef.current;
      const weekKey  = localISOWeek(new Date(dateKey + "T12:00:00"));
      const monthKey = localYM(new Date(dateKey   + "T12:00:00"));
      const hourKey  = String(new Date(sessionStartWallTimeRef.current).getHours()).padStart(2, "00");
      const env      = currentEnvironmentRef.current;
      try {
        await saveSessionChunkRef.current?.(
          segSecs, dateKey, weekKey, monthKey, selectedFieldRef.current, hourKey, true,
          0, 0,
          { environment: env?.name ?? null, environmentType: env?.type ?? null },
        );
        accumulatedSecondsRef.current   += segSecs;
        sessionStartWallTimeRef.current  = Date.now();
        sessionStartDateRef.current      = todayKey;
      } catch (e) { console.error("Midnight save failed:", e); }
    } else { sessionStartDateRef.current = todayKey; }
    isSavingDayBoundaryRef.current = false;
  }, []);

  useEffect(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    timerIntervalRef.current = setInterval(() => {
      if (!isRunningRef.current || !sessionStartWallTimeRef.current) return;
      const total            = getTotalSessionSeconds();
      const POMODORO_DURATION = 25 * 60;
      if (pomodoroModeRef.current) {
        const elapsed   = total % POMODORO_DURATION;
        const remaining = POMODORO_DURATION - elapsed;
        setPomodoroTimeLeft(remaining);
        const nowCompleted = Math.floor(total / POMODORO_DURATION);
        if (nowCompleted > completedPomodorosInSessionRef.current) {
          completedPomodorosInSessionRef.current = nowCompleted;
          setPomodoroRounds((prev) => {
            const next = prev + 1;
            toast.success(next % 4 === 0 ? "Long break time! (15–30 min) 🎉" : "Pomodoro done! Take a 5-min break ☕");
            return next;
          });
          setIsBreak(true);
          stopTimerRef.current?.();
        }
      } else { setDisplaySeconds(total); }

      checkDayBoundary();

      if (pomodoroModeRef.current && isRunningRef.current) {
        sessionStorage.setItem('sb_pomodoro_state', JSON.stringify({
          completed: completedPomodorosInSessionRef.current,
          startTime: sessionStartWallTimeRef.current,
        }));
      }

      if (isRunningRef.current && sessionStartWallTimeRef.current) {
        sessionStorage.setItem('sb_active_session', JSON.stringify({
          startTime: sessionStartWallTimeRef.current,
          field: selectedFieldRef.current,
          mode: pomodoroModeRef.current ? 'pomodoro' : deepWorkEnabled ? 'deepwork' : 'stopwatch',
          accumulated: accumulatedSecondsRef.current,
          pomodoroMode: pomodoroModeRef.current,
          deepWorkEnabled,
          dwDuration,
        }));
      }
    }, 1000);
    return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } };
  }, [getTotalSessionSeconds, checkDayBoundary, deepWorkEnabled, dwDuration]);

  const timerApiRef = useRef({});
  useEffect(() => {
    timerApiRef.current = {
      isRunning, selectedField,
      getSessionSeconds: getTotalSessionSeconds,
      showWarning: (cb) => {
        if (isRunning) { setNavWarning({ open: true, cb }); return true; }
        return false;
      },
    };
    window.studyBuddyTimerState = timerApiRef.current;
  }, [isRunning, selectedField, getTotalSessionSeconds]);
  useEffect(() => () => { delete window.studyBuddyTimerState; }, []);

  const showEnvPickerToast = useCallback(() => {
    if (currentEnvironmentRef.current || userEnvironments.length === 0) return;
    toast(
      (t) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>📍 Where are you studying?</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {userEnvironments.slice(0, 4).map((env) => {
              const { color, emoji } = envTypeInfo(env.type);
              return (
                <button
                  key={env.id}
                  style={{
                    background: `${color}18`, border: `1px solid ${color}40`,
                    color, borderRadius: "999px", padding: "0.28rem 0.75rem",
                    fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.3rem",
                  }}
                  onClick={() => {
                    setCurrentEnvironment(env);
                    currentEnvironmentRef.current = env;
                    toast.dismiss(t.id);
                    toast.success(`📍 ${env.name} — let's focus!`);
                  }}
                >
                  {emoji} {env.name}
                </button>
              );
            })}
            <button
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", borderRadius: "999px", padding: "0.28rem 0.75rem", fontSize: "0.78rem", cursor: "pointer" }}
              onClick={() => toast.dismiss(t.id)}
            >
              Skip
            </button>
          </div>
        </div>
      ),
      { duration: 8000 },
    );
  }, [userEnvironments]);

  const startTimer = useCallback(async () => {
    if (!userRef.current) return toast.error("Please log in first");
    completedPomodorosInSessionRef.current = 0;
    checkpointBackoffRef.current           = 1000;
    lastInteractionRef.current             = Date.now();
    setIsRunning(true); setIsBreak(false);
    startTimerInternal(); await requestWakeLock();

    const savedPomo = sessionStorage.getItem('sb_pomodoro_state');
    if (savedPomo) {
      try {
        const { completed, startTime } = JSON.parse(savedPomo);
        completedPomodorosInSessionRef.current = completed || 0;
        if (startTime && !sessionStartWallTimeRef.current) {
          sessionStartWallTimeRef.current = startTime;
        }
      } catch (_) {}
    }

    const modeStr    = deepWorkEnabled ? " · 🛡️ Deep Work" : pomodoroMode ? " · 🍅 Pomodoro" : "";
    const offlineStr = !isOnline ? " · 📦 Offline" : "";
    const envStr     = currentEnvironmentRef.current ? ` · 📍 ${currentEnvironmentRef.current.name}` : "";
    toast.success(`📚 Studying: ${selectedFieldRef.current}${strictModeRef.current ? " · 🔒" : ""}${modeStr}${envStr}${offlineStr}`, { duration: 2500 });

    showEnvPickerToast();

    if (envSuggestion) {
      setTimeout(() => {
        toast(
          (t) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.83rem" }}>{envSuggestion.text}</span>
              {envSuggestion.mode === "dw" && !deepWorkEnabled && (
                <button
                  style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.35)", color: "#a855f7", borderRadius: "999px", padding: "0.25rem 0.75rem", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => { setDeepWorkEnabled(true); toast.dismiss(t.id); }}
                >
                  Switch to Deep Work
                </button>
              )}
              {envSuggestion.mode === "pomo" && !pomodoroMode && (
                <button
                  style={{ background: "rgba(244,114,182,0.14)", border: "1px solid rgba(244,114,182,0.32)", color: "#f472b6", borderRadius: "999px", padding: "0.25rem 0.75rem", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => { setPomodoroMode(true); toast.dismiss(t.id); }}
                >
                  Switch to Pomodoro
                </button>
              )}
              <button
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "0.72rem", cursor: "pointer", textAlign: "left" }}
                onClick={() => toast.dismiss(t.id)}
              >
                Dismiss
              </button>
            </div>
          ),
          { duration: 10000 },
        );
      }, 1500);
    }
  }, [requestWakeLock, startTimerInternal, deepWorkEnabled, pomodoroMode, isOnline, envSuggestion, showEnvPickerToast]);

  const fetchRecentSessions = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!uid || !isOnline) return;
    try {
      const q = query(
        collection(db, "sessions"),
        where("userId", "==", uid),
        orderBy("endedAt", "desc"),
        limit(3)
      );
      const snap = await getDocs(q);
      setRecentSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Recent sessions fetch error:", err);
    }
  }, [isOnline]);

  useEffect(() => {
    if (user && isOnline) fetchRecentSessions();
  }, [user, isOnline, fetchRecentSessions]);

  const stopTimer = useCallback(async () => {
    if (!isRunningRef.current) return;
    isRunningRef.current = false; setIsRunning(false); await releaseWakeLock();
    clearTimeout(modalAutoStopRef.current); modalAutoStopRef.current = null;
    if (strictGraceTimerRef.current) { clearTimeout(strictGraceTimerRef.current); strictGraceTimerRef.current = null; }
    clearInterval(checkpointIntervalRef.current); checkpointIntervalRef.current = null;
    if (!sessionStartWallTimeRef.current) return;

    const sessionSeconds    = getTotalSessionSeconds();
    const dateKey           = sessionStartDateRef.current  || localYMD();
    const weekKey           = localISOWeek(new Date(dateKey + "T12:00:00"));
    const monthKey          = localYM(new Date(dateKey     + "T12:00:00"));
    const hourKey           = String(new Date().getHours()).padStart(2, "0");
    const field             = selectedFieldRef.current;
    const env               = currentEnvironmentRef.current;

    if (sessionSeconds >= 86400) {
      toast.error("⏹ You cannot study more than 24 hours — there are only 24 hours in a day! Session discarded.");
      sessionStartWallTimeRef.current  = null;
      sessionStartDateRef.current      = null;
      accumulatedSecondsRef.current    = 0;
      completedPomodorosInSessionRef.current = 0;
      setDisplaySeconds(0);
      setPomodoroTimeLeft(25 * 60);
      sessionStorage.removeItem('sb_pomodoro_state');
      sessionStorage.removeItem('sb_active_session');
      return;
    }

    let completedPomodoros  = 0, abortedPomodoros = 0;
    if (pomodoroModeRef.current) {
      completedPomodoros = completedPomodorosInSessionRef.current;
      const partialProgress = sessionSeconds % (25 * 60);
      if (partialProgress > 300 && partialProgress < 25 * 60) abortedPomodoros = 1;
    }

    sessionStartWallTimeRef.current  = null;
    sessionStartDateRef.current      = null;
    accumulatedSecondsRef.current    = 0;
    completedPomodorosInSessionRef.current = 0;
    setDisplaySeconds(0); setPomodoroTimeLeft(25 * 60);

    sessionStorage.removeItem('sb_pomodoro_state');
    sessionStorage.removeItem('sb_active_session');

    if (sessionSeconds > 5) {
      try {
        await saveSessionChunk(
          sessionSeconds, dateKey, weekKey, monthKey, field, hourKey,
          false, completedPomodoros, abortedPomodoros,
          { environment: env?.name ?? null, environmentType: env?.type ?? null },
        );
        if (isOnline) {
          const envMsg = env ? ` at ${env.name}` : "";
          toast.success(`✅ Saved! ${fmtTime(sessionSeconds)} for ${field}${envMsg}`);
          await fetchRecentSessions();
        } else {
          toast(`📦 ${fmtTime(sessionSeconds)} queued — syncs when online.`, { icon: "🔌" });
        }
      } catch (e) { console.error(e); toast.error("Failed to save session"); }
    }
  }, [getTotalSessionSeconds, releaseWakeLock, saveSessionChunk, isOnline, fetchRecentSessions]);

  useEffect(() => { stopTimerRef.current = stopTimer; }, [stopTimer]);

  useEffect(() => {
    if (!isRunning) { clearInterval(checkpointIntervalRef.current); checkpointIntervalRef.current = null; return; }
    checkpointIntervalRef.current = setInterval(async () => {
      if (!isRunningRef.current || !sessionStartWallTimeRef.current) return;
      const segSecs = getSegmentSeconds();
      if (segSecs < 60) return;
      const dateKey  = sessionStartDateRef.current || localYMD();
      const weekKey  = localISOWeek(new Date(dateKey + "T12:00:00"));
      const monthKey = localYM(new Date(dateKey     + "T12:00:00"));
      const hourKey  = String(new Date().getHours()).padStart(2, "0");
      const env      = currentEnvironmentRef.current;
      try {
        await saveSessionChunk(
          segSecs, dateKey, weekKey, monthKey, selectedFieldRef.current, hourKey, true,
          0, 0,
          { environment: env?.name ?? null, environmentType: env?.type ?? null },
        );
        accumulatedSecondsRef.current   += segSecs;
        sessionStartWallTimeRef.current  = Date.now();
        checkpointBackoffRef.current     = 1000;
      } catch (e) {
        console.error("Checkpoint failed:", e);
        checkpointBackoffRef.current = Math.min(checkpointBackoffRef.current * 2, 60000);
      }
    }, 60000);
    return () => { clearInterval(checkpointIntervalRef.current); checkpointIntervalRef.current = null; };
  }, [isRunning, getSegmentSeconds, saveSessionChunk]);

  const resetTimer = useCallback(async () => {
    clearInterval(checkpointIntervalRef.current); checkpointIntervalRef.current = null;
    clearTimeout(modalAutoStopRef.current); modalAutoStopRef.current = null;
    if (strictGraceTimerRef.current) { clearTimeout(strictGraceTimerRef.current); strictGraceTimerRef.current = null; }
    isRunningRef.current = false; setIsRunning(false); await releaseWakeLock();
    setDisplaySeconds(0); setPomodoroTimeLeft(25 * 60); setPomodoroRounds(0); setIsBreak(false);
    sessionStartWallTimeRef.current  = null;
    sessionStartDateRef.current      = null;
    accumulatedSecondsRef.current    = 0;
    completedPomodorosInSessionRef.current = 0;
    checkpointBackoffRef.current     = 1000;
    sessionStorage.removeItem('sb_pomodoro_state');
    sessionStorage.removeItem('sb_active_session');
    toast("Timer reset");
  }, [releaseWakeLock]);

  useEffect(() => {
    if (!userData || !userRef.current || !isOnline) return;
    const todayKey = localYMD();
    const lastKey  = userData.lastStudyDateKey;
    if (lastKey && lastKey !== todayKey) {
      const todayTotal = userData.dailyStats?.[todayKey]?.totalTime || 0;
      if (userData.totalTimeToday !== todayTotal) {
        const weekKey  = localISOWeek(); const monthKey = localYM();
        const weekTotal  = Object.entries(userData.dailyStats || {}).reduce((sum, [dk, ds]) => {
          if (localISOWeek(new Date(dk + "T12:00:00")) === weekKey) return sum + (ds.totalTime || 0);
          return sum;
        }, 0);
        const monthTotal = Object.entries(userData.dailyStats || {}).reduce((sum, [dk, ds]) => {
          if (dk.startsWith(monthKey)) return sum + (ds.totalTime || 0);
          return sum;
        }, 0);
        updateDoc(doc(db, "users", userRef.current.uid), {
          totalTimeToday: todayTotal, totalTimeWeek: weekTotal, totalTimeMonth: monthTotal,
        }).catch(console.error);
      }
    }
  }, [userData, isOnline]);

  const addField = async () => {
    const name = newFieldName.trim();
    if (!name) return toast.error("Enter a field name");
    const fields = userData?.studyFields || ["General"];
    if (fields.includes(name)) return toast.error("Field already exists");
    if (!userRef.current) return toast.error("Please log in first");
    try {
      await updateDoc(doc(db, "users", userRef.current.uid), { studyFields: [...fields, name] });
      setNewFieldName("");
      toast.success(`📚 "${name}" added`);
    } catch (e) {
      console.error("Add field error:", e);
      toast.error("Failed to add field: " + e.message);
    }
  };

  const openRemoveModal = useCallback((field) => {
    if (field === "General") return toast.error("Cannot remove General field");
    if ((userData?.studyFields || []).length <= 1) return toast.error("Need at least one field");
    setRemoveModal({ open: true, field, keepTime: false });
  }, [userData?.studyFields]);

  const confirmRemoveField = useCallback(async () => {
    const { field, keepTime } = removeModal;
    if (!field || !userRef.current) return;
    const uid    = userRef.current.uid;
    const fields = (userData?.studyFields || []).filter((f) => f !== field);
    try {
      const batch = writeBatch(db);
      const uRef  = doc(db, "users", uid);
      const updates = {
        studyFields:                          fields,
        [`fieldTimes.${field}`]:              deleteField(),
      };
      if (!keepTime) {
        const todayKey  = localYMD();
        const weekKey   = localISOWeek();
        const monthKey  = localYM();
        let todayNew = 0, weekNew = 0, monthNew = 0, allTimeNew = 0;
        Object.entries(userData?.dailyStats || {}).forEach(([dk, ds]) => {
          const remaining = Object.entries(ds.fieldTimes || {}).filter(([f]) => f !== field);
          const dayTotal  = remaining.reduce((s, [, v]) => s + (v || 0), 0);
          allTimeNew += dayTotal;
          if (dk === todayKey) todayNew = dayTotal;
          if (localISOWeek(new Date(dk + "T12:00:00")) === weekKey) weekNew += dayTotal;
          if (dk.startsWith(monthKey)) monthNew += dayTotal;
          updates[`dailyStats.${dk}.fieldTimes.${field}`] = deleteField();
          updates[`dailyStats.${dk}.totalTime`]           = dayTotal;
        });
        updates.totalTimeAllTime = allTimeNew;
        updates.totalTimeToday   = todayNew;
        updates.totalTimeWeek    = weekNew;
        updates.totalTimeMonth   = monthNew;
      }
      batch.update(uRef, updates);
      await batch.commit();
      if (selectedField === field) setSelectedField(fields[0] || "General");
      toast.success(`"${field}" removed`);
      setRemoveModal({ open: false, field: null, keepTime: false });
    } catch (e) { console.error(e); toast.error("Failed to remove field"); }
  }, [removeModal, userData, selectedField]);

  const userDocRef = useCallback(() => userRef.current ? doc(db, "users", userRef.current.uid) : null, []);

  const addTask = useCallback(async () => {
    if (!newTaskText.trim()) return toast.error("Enter a task");
    if (!userRef.current) return;
    const task = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      text: newTaskText.trim(), completed: false, priority: taskPriority,
      deadline: taskDeadline || null, createdAt: new Date().toISOString(), field: selectedField,
    };
    try {
      await updateDoc(userDocRef(), { todoList: [...todoList, task] });
      setNewTaskText(""); setTaskDeadline(""); setTaskPriority("Medium");
    } catch (e) { toast.error("Failed to add task"); }
  }, [newTaskText, taskPriority, taskDeadline, selectedField, todoList, userDocRef]);

  const toggleTask = useCallback(async (id) => {
    if (!userRef.current) return;
    const updated = todoList.map((t) => t.id === id ? { ...t, completed: !t.completed } : t);
    try { await updateDoc(userDocRef(), { todoList: updated }); }
    catch (e) { toast.error("Failed to update task"); }
  }, [todoList, userDocRef]);

  const deleteTask = useCallback(async (id) => {
    if (!userRef.current) return;
    setLastDeleted(todoList.find((t) => t.id === id));
    try { await updateDoc(userDocRef(), { todoList: todoList.filter((t) => t.id !== id) }); }
    catch (e) { toast.error("Failed to delete task"); }
  }, [todoList, userDocRef]);

  const undoDelete = useCallback(async () => {
    if (!lastDeleted || !userRef.current) return;
    try { await updateDoc(userDocRef(), { todoList: [...todoList, lastDeleted] }); setLastDeleted(null); }
    catch (e) { toast.error("Failed to restore task"); }
  }, [lastDeleted, todoList, userDocRef]);

  const saveEdit = useCallback(async (id) => {
    if (!editingTask.text.trim()) return toast.error("Task cannot be empty");
    const updated = todoList.map((t) => t.id === id ? { ...t, text: editingTask.text.trim() } : t);
    try { await updateDoc(userDocRef(), { todoList: updated }); setEditingTask({ id: null, text: "" }); }
    catch (e) { toast.error("Failed to update task"); }
  }, [editingTask, todoList, userDocRef]);

  const sortByPriority = useCallback(async () => {
    const order  = { High: 1, Medium: 2, Low: 3 };
    const sorted = [...todoList].sort((a, b) => (order[a.priority] || 4) - (order[b.priority] || 4));
    try { await updateDoc(userDocRef(), { todoList: sorted }); }
    catch (e) { toast.error("Sort failed"); }
  }, [todoList, userDocRef]);

  const sortByDeadline = useCallback(async () => {
    const sorted = [...todoList].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1; if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
    try { await updateDoc(userDocRef(), { todoList: sorted }); }
    catch (e) { toast.error("Sort failed"); }
  }, [todoList, userDocRef]);

  useEffect(() => { if (activePanel !== "tasks") setLastDeleted(null); }, [activePanel]);

  const handleDeleteSession = useCallback(async (sessionId, sessionData) => {
    if (!userRef.current) return;
    try {
      await deleteDoc(doc(db, "sessions", sessionId));
      const { duration, field, date, week, month } = sessionData;
      if (duration > 0) {
        const userDocRef2 = doc(db, "users", userRef.current.uid);
        const updates = {};
        const todayKey = localYMD();
        const currentWeekKey = localISOWeek();
        const currentMonthKey = localYM();

        updates[`fieldTimes.${field}`] = increment(-duration);
        updates.totalTimeAllTime = increment(-duration);

        if (date) {
          updates[`dailyStats.${date}.totalTime`] = increment(-duration);
          updates[`dailyStats.${date}.fieldTimes.${field}`] = increment(-duration);
          updates[`dailyStats.${date}.sessionsCount`] = increment(-1);
          if (date === todayKey) updates.totalTimeToday = increment(-duration);
        }
        if (week === currentWeekKey) updates.totalTimeWeek = increment(-duration);
        if (month === currentMonthKey) updates.totalTimeMonth = increment(-duration);
        if (week) {
          updates[`weeklyStats.${week}.totalTime`] = increment(-duration);
          updates[`weeklyStats.${week}.fieldTimes.${field}`] = increment(-duration);
          updates[`weeklyStats.${week}.sessionsCount`] = increment(-1);
        }
        if (month) {
          updates[`monthlyStats.${month}.totalTime`] = increment(-duration);
          updates[`monthlyStats.${month}.fieldTimes.${field}`] = increment(-duration);
          updates[`monthlyStats.${month}.sessionsCount`] = increment(-1);
        }
        await updateDoc(userDocRef2, updates);
      }
      toast.success("Session deleted");
      setRecentSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete session");
    }
  }, []);

  const handleUpdateSession = useCallback(async (sessionId, newField, newEnv) => {
    if (!userRef.current) return;
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;
      const oldData = sessionSnap.data();
      const oldField = oldData.field;
      const duration = oldData.duration || 0;
      const newFieldName = newField || oldField;
      const newEnvName = newEnv?.name ?? oldData.environment;
      const newEnvType = newEnv?.type ?? oldData.environmentType;

      await updateDoc(sessionRef, {
        field: newFieldName,
        environment: newEnvName,
        environmentType: newEnvType,
      });

      if (newFieldName !== oldField && duration > 0) {
        const userDocRef2 = doc(db, "users", userRef.current.uid);
        const { date, week, month } = oldData;
        const updates = {};
        updates[`fieldTimes.${oldField}`] = increment(-duration);
        updates[`fieldTimes.${newFieldName}`] = increment(duration);
        if (date) {
          updates[`dailyStats.${date}.fieldTimes.${oldField}`] = increment(-duration);
          updates[`dailyStats.${date}.fieldTimes.${newFieldName}`] = increment(duration);
        }
        if (week) {
          updates[`weeklyStats.${week}.fieldTimes.${oldField}`] = increment(-duration);
          updates[`weeklyStats.${week}.fieldTimes.${newFieldName}`] = increment(duration);
        }
        if (month) {
          updates[`monthlyStats.${month}.fieldTimes.${oldField}`] = increment(-duration);
          updates[`monthlyStats.${month}.fieldTimes.${newFieldName}`] = increment(duration);
        }
        await updateDoc(userDocRef2, updates);
      }

      toast.success("Session updated");
      setEditingSession(null);
      await fetchRecentSessions();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update session");
    }
  }, [fetchRecentSessions]);

  const fetchDWData = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!uid || !isOnline) return;
    setDwLoading(true);
    try {
      const q    = query(collection(db, "deepWorkSessions"), where("userId", "==", uid));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));
      setDwSessions(data);
      const uSnap = await getDoc(doc(db, "deepWorkStreak", uid));
      if (uSnap.exists()) setDwUserData(uSnap.data());
    } catch (err) { console.error(err); }
    finally { setDwLoading(false); }
  }, [isOnline]);

  useEffect(() => {
    if (deepWorkEnabled && userRef.current) fetchDWData();
  }, [deepWorkEnabled, fetchDWData]);

  useEffect(() => {
    if (!dwActive || dwPaused || isRunning) return;
    let rafId;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - dwSessionStartRef.current) / 1000);
      const clamped = Math.min(elapsed, dwDuration * 60);
      setDwElapsed(clamped);
      if (clamped >= dwDuration * 60) {
        handleDWComplete();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dwActive, dwPaused, dwDuration, isRunning]);

  useEffect(() => {
    if (!dwDndEnabled || !dwActive) return;
    function onVis() {
      if (document.hidden && !dwPaused) {
        dwTabSwitchRef.current += 1;
        setDwTabSwitches(dwTabSwitchRef.current);
        toast("🛡️ Deep work active — stay focused!", { icon: "⚠️" });
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [dwDndEnabled, dwActive, dwPaused]);

  const dwStreak        = useMemo(() => calcDWStreak(dwSessions), [dwSessions]);
  const dwLongestStreak = useMemo(() => dwUserData?.longestStreak ?? 0, [dwUserData]);
  const dwTotalHours    = useMemo(() => {
    const secs = dwSessions.filter((s) => s.completed).reduce((a, s) => a + (s.duration ?? 0), 0);
    return parseFloat((secs / 3600).toFixed(1));
  }, [dwSessions]);
  const dwCompletedCount = useMemo(() => dwSessions.filter((s) => s.completed).length, [dwSessions]);
  const dwTodayDone      = useMemo(() =>
    dwSessions.some((s) => {
      const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      return d.toISOString().slice(0, 10) === localYMD() && s.completed;
    }), [dwSessions]);
  const { color: dwColor, label: dwTierLabel } = useMemo(() => dwShieldTier(dwStreak), [dwStreak]);
  const dwNextMs = nextMilestone(dwStreak);

  const handleDWStart = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!uid) return toast.error("Please log in");
    if (!isOnline) return toast.error("Deep Work sessions require an internet connection");
    try {
      const ref = await addDoc(collection(db, "deepWorkSessions"), {
        userId: uid, duration: 0, planned: dwDuration * 60,
        completed: false, tabSwitches: 0, date: serverTimestamp(),
      });
      dwSessionIdRef.current    = ref.id;
      dwSessionStartRef.current = Date.now();
      dwTabSwitchRef.current    = 0;
      setDwElapsed(0); setDwTabSwitches(0);
      setDwActive(true); setDwPaused(false);
      dwQuoteRef.current = DEEP_WORK_QUOTES[Math.floor(Math.random() * DEEP_WORK_QUOTES.length)];
      toast.success("🛡️ Deep work session locked in!");
    } catch (err) { console.error(err); toast.error("Couldn't start session"); }
  }, [dwDuration, isOnline]);

  const handleDWComplete = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!dwSessionIdRef.current || !uid) return;
    const dur = Math.round((Date.now() - (dwSessionStartRef.current ?? Date.now())) / 1000);
    try {
      await updateDoc(doc(db, "deepWorkSessions", dwSessionIdRef.current), {
        duration: dur, completed: true, tabSwitches: dwTabSwitchRef.current, completedAt: serverTimestamp(),
      });
      const newStreak  = dwStreak + (dwTodayDone ? 0 : 1);
      const newLongest = Math.max(dwLongestStreak, newStreak);
      await setDoc(doc(db, "deepWorkStreak", uid),
        { userId: uid, longestStreak: newLongest, updatedAt: serverTimestamp() }, { merge: true });
      dwSessionIdRef.current = null; dwSessionStartRef.current = null;
      setDwActive(false); setDwPaused(false); setDwElapsed(0);
      if (SHIELD_MILESTONES.includes(newStreak)) {
        toast.success(`🎉 ${newStreak}-day milestone unlocked!`, { duration: 5000 });
      } else {
        toast.success(`Session complete! ${Math.round(dur / 60)}m of deep work locked in 💜`);
      }
      fetchDWData();
    } catch (err) { console.error(err); toast.error("Couldn't save session"); }
  }, [dwStreak, dwTodayDone, dwLongestStreak, fetchDWData]);

  const handleDWStop = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (dwSessionIdRef.current && uid) {
      const dur = Math.round((Date.now() - (dwSessionStartRef.current ?? Date.now())) / 1000);
      await updateDoc(doc(db, "deepWorkSessions", dwSessionIdRef.current), {
        duration: dur, completed: false, abandoned: true, tabSwitches: dwTabSwitchRef.current,
      }).catch(console.error);
    }
    dwSessionIdRef.current = null; dwSessionStartRef.current = null;
    setDwActive(false); setDwPaused(false); setDwElapsed(0); setDwShowInterrupt(false);
    toast("Session ended — rest up 💜", { icon: "🌙" });
    fetchDWData();
  }, [fetchDWData]);

  const handleDWAttemptStop = useCallback(() => {
    if (dwElapsed < 60) { handleDWStop(); return; }
    setDwPaused(true); setDwShowInterrupt(true);
  }, [dwElapsed, handleDWStop]);

  useEffect(() => {
    if (!user || !isOnline) { if (!isOnline) return; setDlLogs([]); return; }
    if (dlUnsubLogsRef.current) dlUnsubLogsRef.current();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const q = query(
      collection(db, "distractions"),
      where("userId", "==", user.uid),
      where("timestamp", ">=", Timestamp.fromDate(cutoff)),
      orderBy("timestamp", "desc"),
      limit(500),
    );
    dlUnsubLogsRef.current = onSnapshot(q, (snap) => {
      setDlLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("DL logs error:", err));
    return () => dlUnsubLogsRef.current?.();
  }, [user, isOnline]);

  useEffect(() => {
    if (!user || !isOnline) return;
    if (dlUnsubDailyRef.current) dlUnsubDailyRef.current();
    const cutoff    = new Date(); cutoff.setDate(cutoff.getDate() - 35);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const q = query(
      collection(db, "users", user.uid, "distractionSummaries"),
      where("date", ">=", cutoffKey), orderBy("date", "desc"),
    );
    dlUnsubDailyRef.current = onSnapshot(q, (snap) => {
      const map = {}; snap.docs.forEach((d) => { map[d.id] = d.data(); });
      setDlDailySummaries(map);
    }, (err) => console.error("DL daily error:", err));
    return () => dlUnsubDailyRef.current?.();
  }, [user, isOnline]);

  useEffect(() => {
    if (!user || !isOnline) return;
    if (dlUnsubWeeklyRef.current) dlUnsubWeeklyRef.current();
    const cutoff    = new Date(); cutoff.setDate(cutoff.getDate() - 56);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const q = query(
      collection(db, "users", user.uid, "distractionWeekly"),
      where("weekStart", ">=", cutoffKey), orderBy("weekStart", "desc"),
    );
    dlUnsubWeeklyRef.current = onSnapshot(q, (snap) => {
      const map = {}; snap.docs.forEach((d) => { map[d.id] = d.data(); });
      setDlWeeklySummaries(map);
    }, (err) => console.error("DL weekly error:", err));
    return () => dlUnsubWeeklyRef.current?.();
  }, [user, isOnline]);

  useEffect(() => {
    return () => {
      dlUnsubLogsRef.current?.();
      dlUnsubDailyRef.current?.();
      dlUnsubWeeklyRef.current?.();
    };
  }, []);

  const handleDLLog = useCallback(async (typeId) => {
    if (!user || dlLogging) return;
    setDlLogging(true); setDlLastLogged(typeId);
    const type = getDType(typeId);
    const now  = new Date();
    const logEntry = {
      userId: user.uid, type: typeId,
      timestamp: now.toISOString(),
      date: localYMD(), week: weekKeyStr(),
    };
    if (!isOnline) {
      await idbEnqueue({ type: "distraction", dlType: typeId, ...logEntry });
      await refreshQueueSize();
      setDlLogs((prev) => [{ id: `offline_${Date.now()}`, ...logEntry, timestamp: { toDate: () => now } }, ...prev]);
      toast.success(`${type.emoji} ${type.label} logged (offline)`, { duration: 1500 });
      setTimeout(() => setDlLastLogged(null), 1000);
      setDlLogging(false);
      return;
    }
    try {
      const logRef = doc(collection(db, "distractions"));
      const batch  = writeBatch(db);
      batch.set(logRef, {
        userId: user.uid, type: typeId, timestamp: serverTimestamp(),
        date: localYMD(), week: weekKeyStr(),
      });
      await batch.commit();
      await Promise.all([upsertDailySummary(user.uid, typeId), upsertWeeklySummary(user.uid, typeId)]);
      toast.success(`${type.emoji} ${type.label} logged`, { duration: 1500 });
      setTimeout(() => setDlLastLogged(null), 1000);
    } catch (err) {
      if (!navigator.onLine) {
        await idbEnqueue({ type: "distraction", dlType: typeId, ...logEntry });
        await refreshQueueSize();
        toast(`${type.emoji} Logged offline`, { duration: 1500 });
      } else { console.error(err); toast.error("Failed to log distraction"); }
    } finally { setDlLogging(false); }
  }, [user, dlLogging, isOnline, refreshQueueSize]);

  const handleDLDelete = useCallback(async (id) => {
    const item = dlLogs.find((l) => l.id === id);
    if (!item || !user) return;
    if (id.startsWith("offline_")) { setDlLogs((prev) => prev.filter((l) => l.id !== id)); return; }
    try {
      await deleteDoc(doc(db, "distractions", id));
      const dayKey = item.date || getTimestamp(item).toISOString().slice(0, 10);
      const wkKey  = item.week || weekKeyStr(getTimestamp(item));
      const dayRef = doc(db, "users", user.uid, "distractionSummaries", dayKey);
      const wkRef  = doc(db, "users", user.uid, "distractionWeekly",    wkKey);
      const [daySnap, wkSnap] = await Promise.all([getDoc(dayRef), getDoc(wkRef)]);
      const updates = [];
      if (daySnap.exists()) updates.push(updateDoc(dayRef, { total: increment(-1), [`byType.${item.type}`]: increment(-1), updatedAt: serverTimestamp() }));
      if (wkSnap.exists())  updates.push(updateDoc(wkRef,  { total: increment(-1), [`byType.${item.type}`]: increment(-1), updatedAt: serverTimestamp() }));
      await Promise.all(updates);
      toast.success("Log removed");
    } catch (err) { console.error(err); toast.error("Delete failed"); }
  }, [dlLogs, user]);

  const dlTodayLogs = useMemo(() => {
    const start = startOfDay();
    return dlLogs.filter((l) => getTimestamp(l) >= start);
  }, [dlLogs]);
  const dlTodayCounts = useMemo(() => {
    const c = {};
    dlTodayLogs.forEach((l) => { c[l.type] = (c[l.type] || 0) + 1; });
    return c;
  }, [dlTodayLogs]);
  const dlTodayBreakdown = useMemo(() =>
    DISTRACTION_TYPES.map((t) => ({ id: t.id, count: dlTodayLogs.filter((l) => l.type === t.id).length }))
      .filter((d) => d.count > 0).sort((a, b) => b.count - a.count),
    [dlTodayLogs]);
  const dlFilteredLogs = useMemo(() =>
    dlFilterType ? dlTodayLogs.filter((l) => l.type === dlFilterType) : dlTodayLogs,
    [dlTodayLogs, dlFilterType]);
  const dlTodayByHour = useMemo(() => {
    const groups = {};
    dlFilteredLogs.forEach((l) => {
      const h   = getTimestamp(l).getHours();
      const key = `${h.toString().padStart(2, "0")}:00`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([hour, items]) => ({ hour, items }));
  }, [dlFilteredLogs]);
  const dlStreak = useMemo(() => {
    let s = 0; const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d   = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (!dlDailySummaries[key] || dlDailySummaries[key].total === 0) break;
      s++;
    }
    return s;
  }, [dlDailySummaries]);
  const dlInsights = useMemo(() => {
    const result = [];
    if (dlTodayLogs.length === 0) return result;
    if (dlTodayBreakdown[0]) {
      const top  = dlTodayBreakdown[0];
      const type = getDType(top.id);
      result.push({ emoji: type.emoji, color: type.color, text: `${type.label} is your #1 distraction today (${top.count}×).`, action: type.tip });
    }
    const afternoon = dlTodayLogs.filter((l) => { const h = getTimestamp(l).getHours(); return h >= 13 && h < 18; });
    if (afternoon.length >= 3) {
      result.push({ emoji: "🌅", color: "#fbbf24", text: `${Math.round((afternoon.length / dlTodayLogs.length) * 100)}% of distractions hit in the afternoon.`, action: "Schedule deep work in the morning instead." });
    }
    const fatigue = dlTodayLogs.filter((l) => l.type === "fatigue").length;
    if (fatigue >= 2) result.push({ emoji: "😴", color: "#34d399", text: `Fatigue hit ${fatigue} times today — your brain needs rest.`, action: "A 20-min nap restores focus better than caffeine." });
    return result.slice(0, 3);
  }, [dlTodayLogs, dlTodayBreakdown]);

  const studyFields    = useMemo(() => userData?.studyFields || ["General"], [userData?.studyFields]);
  const liveSessionSeconds = useMemo(() => isRunning ? displaySeconds : 0, [isRunning, displaySeconds]);
  const timeStats      = useMemo(() => {
    const todayKey = localYMD(); const weekKey = localISOWeek(); const monthKey = localYM();
    const ds       = userData?.dailyStats || {};
    const today    = (ds[todayKey]?.totalTime || 0) + liveSessionSeconds;
    const week     = Object.entries(ds).reduce((sum, [dk, d]) => {
      return sum + (localISOWeek(new Date(dk + "T12:00:00")) === weekKey ? (dk === todayKey ? today : (d.totalTime || 0)) : 0);
    }, 0);
    const month = Object.entries(ds).reduce((sum, [dk, d]) => {
      return sum + (dk.startsWith(monthKey) ? (dk === todayKey ? today : (d.totalTime || 0)) : 0);
    }, 0);
    return { today, week, month, allTime: (userData?.totalTimeAllTime || 0) + liveSessionSeconds };
  }, [userData, liveSessionSeconds]);
  const filteredTasks  = useMemo(() => todoList.filter((t) => {
    if (filterOption === "All")       return true;
    if (filterOption === "Completed") return t.completed;
    if (filterOption === "Pending")   return !t.completed;
    return t.priority === filterOption;
  }), [todoList, filterOption]);
  const taskStats      = useMemo(() => {
    const total     = todoList.length;
    const completed = todoList.filter((t) => t.completed).length;
    return { total, completed, pending: total - completed, high: todoList.filter((t) => t.priority === "High").length };
  }, [todoList]);
  const todayFieldTimes = useMemo(() => {
    const todayKey = localYMD();
    const base     = { ...(userData?.dailyStats?.[todayKey]?.fieldTimes || {}) };
    if (isRunning && selectedField) base[selectedField] = (base[selectedField] || 0) + liveSessionSeconds;
    return base;
  }, [userData, isRunning, selectedField, liveSessionSeconds]);
  const todaySortedFields = useMemo(() =>
    Object.entries(todayFieldTimes).filter(([, v]) => typeof v === "number" && v > 0).sort(([, a], [, b]) => b - a),
    [todayFieldTimes]);
  const insights      = useInsights(userData, isRunning, liveSessionSeconds);
  const displayTime   = pomodoroMode ? pomodoroTimeLeft : displaySeconds;

  if (loading) {
    return (
      <div className="ss-page">
        <div className="ss-state">
          <div className="ss-spinner" />
          <p>Loading your session…</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="ss-page">
        <div className="ss-state">
          <div className="ss-lock-icon">🔒</div>
          <h2>Sign in to study</h2>
          <p>Your session data is saved to your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ss-page${strictMode && isRunning ? " strict-active" : ""}${deepWorkEnabled && dwActive ? " dw-active-page" : ""}`}
      onMouseMove={recordInteraction} onKeyDown={recordInteraction}
      onTouchStart={recordInteraction} onClick={recordInteraction}
    >
      <AnimatePresence>
        {inactivityModal && (
          <motion.div className="ss-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ss-modal" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}>
              <div className="ss-modal-head warning"><span>⏰ Still studying?</span></div>
              <div className="ss-modal-body">
                <p>Your timer has been running for <strong style={{ color: "#c084fc" }}>6 hours</strong> with no interaction.</p>
                <p style={{ color: "var(--t3)", fontSize: "0.85rem" }}>Timer auto-stops in 60 seconds if you don't respond.</p>
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-cancel" onClick={async () => { clearTimeout(modalAutoStopRef.current); modalAutoStopRef.current = null; setInactivityModal(false); toast.error("⏹ Session stopped."); await stopTimer(); }}>Stop Timer</button>
                <button className="ss-btn-danger" style={{ background: "var(--grad-start)" }} onClick={() => { clearTimeout(modalAutoStopRef.current); modalAutoStopRef.current = null; lastInteractionRef.current = Date.now(); setInactivityModal(false); toast.success("✅ Keep going — timer continues."); }}>Yes, I'm here!</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {navWarning.open && (
          <motion.div className="ss-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ss-modal" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}>
              <div className="ss-modal-head warning">
                <span>⏱️ Timer is Running</span>
                <button className="ss-modal-close" onClick={() => setNavWarning({ open: false, cb: null })}>✕</button>
              </div>
              <div className="ss-modal-body"><p>Navigating away will pause and save your session.</p></div>
              <div className="ss-modal-foot">
                <button className="ss-btn-cancel" onClick={() => setNavWarning({ open: false, cb: null })}>Keep Studying</button>
                <button className="ss-btn-danger" onClick={async () => { await stopTimer(); setNavWarning((prev) => { if (prev.cb) setTimeout(prev.cb, 100); return { open: false, cb: null }; }); }}>Pause & Leave</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {removeModal.open && (
          <motion.div className="ss-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>
            <motion.div className="ss-modal" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <div className="ss-modal-head info">
                <span>Remove Field</span>
                <button className="ss-modal-close" onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>✕</button>
              </div>
              <div className="ss-modal-body">
                <p>Remove <strong style={{ color: "#c084fc" }}>{removeModal.field}</strong>?</p>
                {userData?.fieldTimes?.[removeModal.field] > 0 && (
                  <label className="ss-check-row">
                    <input type="checkbox" checked={removeModal.keepTime} onChange={(e) => setRemoveModal((p) => ({ ...p, keepTime: e.target.checked }))} />
                    Keep {fmtMins(userData.fieldTimes[removeModal.field])} of study time
                  </label>
                )}
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-cancel" onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>Cancel</button>
                <button className="ss-btn-danger" onClick={confirmRemoveField}>Remove</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dwShowInterrupt && (
          <motion.div className="ss-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setDwShowInterrupt(false); setDwPaused(false); }}>
            <motion.div className="ss-modal dw-interrupt-modal" initial={{ opacity: 0, scale: 0.88, y: 28 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88, y: 28 }} onClick={(e) => e.stopPropagation()}>
              <div className="dw-interrupt-shield"><ShieldSVG streak={dwStreak} size={80} /></div>
              <div className="ss-modal-body" style={{ textAlign: "center", gap: "0.75rem" }}>
                <h3 style={{ color: "var(--t1)", fontFamily: "var(--font-d)", fontSize: "1.1rem" }}>Is this worth breaking your streak?</h3>
                <p style={{ color: "var(--t3)", fontStyle: "italic", fontSize: "0.85rem" }}>"{dwQuoteRef.current}"</p>
                {dwStreak > 0 && (
                  <p style={{ color: "var(--pk-red)", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                    ⚠️ Stopping risks your <strong>{dwStreak}-day streak</strong>
                  </p>
                )}
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-danger" style={{ background: "var(--grad-primary)" }} onClick={() => { setDwShowInterrupt(false); setDwPaused(false); }}>🛡️ Stay in deep work</button>
                <button className="ss-btn-cancel" onClick={handleDWStop}>End session</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEnvPicker && (
          <motion.div className="ss-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEnvPicker(false)}>
            <motion.div className="ss-modal" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <div className="ss-modal-head info">
                <span>📍 Choose Study Location</span>
                <button className="ss-modal-close" onClick={() => setShowEnvPicker(false)}>✕</button>
              </div>
              <div className="ss-modal-body">
                {userEnvironments.length === 0 ? (
                  <p style={{ color: "var(--t3)", fontSize: "0.88rem" }}>No spots saved yet — add them in the Environment page!</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    {userEnvironments.map((env) => {
                      const { color, emoji } = envTypeInfo(env.type);
                      const isSelected = currentEnvironment?.id === env.id;
                      return (
                        <button
                          key={env.id}
                          style={{
                            display: "flex", alignItems: "center", gap: "0.75rem",
                            padding: "0.85rem 1rem",
                            background: isSelected ? `${color}18` : "rgba(255,255,255,0.03)",
                            border: `1.5px solid ${isSelected ? color : "rgba(255,255,255,0.08)"}`,
                            borderRadius: "14px", cursor: "pointer", textAlign: "left",
                            transition: "all 0.18s",
                          }}
                          onClick={() => {
                            setCurrentEnvironment(isSelected ? null : env);
                            currentEnvironmentRef.current = isSelected ? null : env;
                            setShowEnvPicker(false);
                            if (!isSelected) toast.success(`📍 ${env.name} set!`);
                          }}
                        >
                          <span style={{ fontSize: "1.3rem" }}>{emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: "var(--t1)", fontSize: "0.9rem" }}>{env.name}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--t3)" }}>
                              {env.focusScore > 0 ? `${env.focusScore}% focus score` : "No data yet"}
                              {env.sessionCount > 0 ? ` · ${env.sessionCount} sessions` : ""}
                            </div>
                          </div>
                          {isSelected && <span style={{ color, fontSize: "1rem" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-cancel" onClick={() => setShowEnvPicker(false)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSession && (
          <motion.div className="ss-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingSession(null)}>
            <motion.div className="ss-modal" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <div className="ss-modal-head info">
                <span>Edit Session</span>
                <button className="ss-modal-close" onClick={() => setEditingSession(null)}>✕</button>
              </div>
              <div className="ss-modal-body">
                <label style={{ color: "var(--t3)", fontSize: "0.78rem", marginBottom: "0.3rem", display: "block" }}>Field</label>
                <select className="ss-select" style={{ width: "100%" }} value={editingSession.field} onChange={(e) => setEditingSession((p) => ({ ...p, field: e.target.value }))}>
                  {studyFields.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <label style={{ color: "var(--t3)", fontSize: "0.78rem", marginTop: "0.75rem", marginBottom: "0.3rem", display: "block" }}>Location</label>
                <select className="ss-select" style={{ width: "100%" }} value={editingSession.environment || ""} onChange={(e) => {
                  const env = userEnvironments.find((ue) => ue.name === e.target.value);
                  setEditingSession((p) => ({ ...p, environment: env?.name || null, environmentType: env?.type || null }));
                }}>
                  <option value="">No location</option>
                  {userEnvironments.map((env) => (
                    <option key={env.id} value={env.name}>
                      {envTypeInfo(env.type).emoji} {env.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-cancel" onClick={() => setEditingSession(null)}>Cancel</button>
                <button className="ss-btn-sm ss-btn-purple" onClick={() => handleUpdateSession(editingSession.id, editingSession.field, editingSession.environment ? { name: editingSession.environment, type: editingSession.environmentType } : null)}>Save Changes</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ss-container">
        <AnimatePresence>
          {!isOnline && (
            <motion.div className="ss-offline-banner" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <span>🔌</span>
              <span>Offline mode — timer keeps running, data queues locally</span>
              {queueSize > 0 && <span className="ss-offline-queue-badge">{queueSize} pending</span>}
            </motion.div>
          )}
          {isOnline && isSyncing && (
            <motion.div className="ss-sync-banner" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="ss-sync-spinner" />
              <span>Syncing offline data…</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="ss-main-grid" variants={staggerContainer} initial="initial" animate="animate">

          <motion.div className={`ss-card ss-timer-card${deepWorkEnabled ? " dw-mode" : ""}`} variants={cardVariant}>
            <div className="ss-mode-pill">
              {deepWorkEnabled ? (
                <>🛡️ Deep Work Mode {dwActive && <span className="ss-live-dot" style={{ background: "#a855f7" }} />}</>
              ) : pomodoroMode ? (
                <>🍅 Pomodoro Mode {isRunning && <span className="ss-live-dot" />}</>
              ) : (
                <>⏱️ Stopwatch {isRunning && <span className="ss-live-dot" />}</>
              )}
              {!isOnline && <span style={{ fontSize: "0.65rem", marginLeft: "0.3rem", opacity: 0.7 }}>· offline</span>}
            </div>

            <div className="ss-ring-wrap">
              {deepWorkEnabled && dwActive ? (
                <DWCircularTimer elapsed={dwElapsed} total={dwDuration * 60} active={dwActive} paused={dwPaused} />
              ) : (
                <>
                  <Lottie animationData={clockAnimation} loop={isRunning} className="ss-clock-lottie" />
                  <div className="ss-timer-overlay">
                    {pomodoroMode && pomodoroRounds > 0 && (
                      <div className="ss-round-badge">{isBreak ? "☕ Break" : `Round ${pomodoroRounds}`}</div>
                    )}
                    <div className={`ss-timer-digits${isRunning ? " running" : ""}${isBreak ? " break" : ""}`}>
                      {fmtTime(displayTime)}
                    </div>
                    <div className="ss-field-pill">
                      <span className="ss-field-dot" />
                      {selectedField}
                    </div>
                  </div>
                </>
              )}
            </div>

            <AnimatePresence>
              {deepWorkEnabled && dwActive && (
                <motion.div className="dw-inline-info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="dw-inline-shield-row">
                    <ShieldMini streak={dwStreak} size={36} />
                    <div className="dw-inline-streak-info">
                      <span className="dw-inline-streak-val" style={{ color: dwColor }}>{dwStreak}d streak · {dwTierLabel}</span>
                      {dwTabSwitches > 0 && <span className="dw-tab-warn-inline">⚠️ {dwTabSwitches} tab switch{dwTabSwitches > 1 ? "es" : ""}</span>}
                    </div>
                  </div>
                  <p className="dw-inline-quote">"{dwQuoteRef.current}"</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {bestEnvironment && !currentEnvironment && !isRunning && (
                <motion.div
                  className="ss-best-env-banner"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  onClick={() => { setCurrentEnvironment(bestEnvironment); currentEnvironmentRef.current = bestEnvironment; toast.success(`📍 ${bestEnvironment.name} set!`); }}
                  style={{ cursor: "pointer" }}
                >
                  <span style={{ fontSize: "1.1rem" }}>👑</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--t3)" }}>Your best focus spot</div>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem", color: envTypeInfo(bestEnvironment.type).color }}>
                      {bestEnvironment.name} · {bestEnvironment.focusScore ?? 0}% focus
                    </div>
                  </div>
                  <span style={{ color: "var(--t3)", fontSize: "0.8rem" }}>›</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {envSuggestion && !isRunning && (
                <motion.div
                  className="ss-env-suggestion"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                >
                  <span>{envSuggestion.text}</span>
                  {envSuggestion.mode === "dw" && (
                    <button className="ss-btn-sm ss-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.25rem 0.65rem" }}
                      onClick={() => { setDeepWorkEnabled(true); setPomodoroMode(false); }}>
                      Try Deep Work
                    </button>
                  )}
                  {envSuggestion.mode === "pomo" && (
                    <button className="ss-btn-sm ss-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.25rem 0.65rem" }}
                      onClick={() => { setPomodoroMode(true); setDeepWorkEnabled(false); }}>
                      Try Pomodoro
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="ss-controls">
              {deepWorkEnabled ? (
                <>
                  {!dwActive ? (
                    <motion.button className="ss-btn ss-btn-start" onClick={handleDWStart} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                      🛡️ Start Deep Work
                    </motion.button>
                  ) : (
                    <>
                      <button className="ss-btn ss-btn-stop" onClick={handleDWAttemptStop}>⏹ Stop</button>
                      <button className="ss-btn ss-btn-reset" onClick={() => setDwPaused((p) => !p)}>{dwPaused ? "▶" : "⏸"}</button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {isRunning
                    ? <button className="ss-btn ss-btn-stop"  onClick={stopTimer}  aria-label="Stop study session"  aria-pressed={true}>⏹ Stop</button>
                    : <button className="ss-btn ss-btn-start" onClick={startTimer} aria-label="Start study session" aria-pressed={false}>▶ Start</button>
                  }
                  <button className="ss-btn ss-btn-reset" onClick={resetTimer} aria-label="Reset timer">↺</button>
                </>
              )}
            </div>

            <div className="ss-mode-toggles">
              <label className={`ss-toggle-row ss-toggle-row--dw${(isRunning || dwActive) ? " disabled" : ""}${deepWorkEnabled ? " active" : ""}`}>
                <div className={`ss-toggle-track${deepWorkEnabled ? " on dw-on" : ""}`} onClick={() => {
                  if (isRunning || dwActive) return toast.error("Stop the current session first");
                  const next = !deepWorkEnabled; setDeepWorkEnabled(next);
                  if (next) setPomodoroMode(false);
                }}>
                  <div className="ss-toggle-thumb" />
                </div>
                <div className="ss-toggle-label-group">
                  <span className="ss-toggle-label-main">🛡️ Deep Work</span>
                  <span className="ss-toggle-label-sub">Countdown timer · streak tracking</span>
                </div>
                {deepWorkEnabled && (
                  <button className="dw-dur-inline-btn" onClick={(e) => { e.stopPropagation(); if (!dwActive) setDwShowDurationPicker((p) => !p); }}>
                    {dwDuration}m ▾
                  </button>
                )}
              </label>

              <AnimatePresence>
                {deepWorkEnabled && dwShowDurationPicker && !dwActive && (
                  <motion.div className="dw-dur-picker" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    {DW_DURATIONS.map((d) => (
                      <button key={d} className={`dw-dur-chip${dwDuration === d ? " active" : ""}`} onClick={() => { setDwDuration(d); setDwShowDurationPicker(false); }}>{d}m</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {deepWorkEnabled && (
                  <motion.label className="ss-toggle-row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <div className={`ss-toggle-track${dwDndEnabled ? " on" : ""}`} onClick={() => setDwDndEnabled((p) => !p)}>
                      <div className="ss-toggle-thumb" />
                    </div>
                    <div className="ss-toggle-label-group">
                      <span className="ss-toggle-label-main">{dwDndEnabled ? "🔕" : "🔔"} Tab-switch alerts</span>
                      <span className="ss-toggle-label-sub">Notifies when you leave the tab</span>
                    </div>
                  </motion.label>
                )}
              </AnimatePresence>

              {!deepWorkEnabled && (
                <label className={`ss-toggle-row${isRunning ? " disabled" : ""}`}>
                  <div className={`ss-toggle-track${pomodoroMode ? " on" : ""}`} onClick={() => !isRunning && setPomodoroMode((v) => !v)}>
                    <div className="ss-toggle-thumb" />
                  </div>
                  <div className="ss-toggle-label-group">
                    <span className="ss-toggle-label-main">🍅 Pomodoro</span>
                    <span className="ss-toggle-label-sub">25 min work blocks</span>
                  </div>
                </label>
              )}

              <button className={`ss-strict-btn${strictMode ? " on" : ""}`} onClick={() => {
                if (isRunning || dwActive) return toast.error("Stop timer to change strict mode");
                const next = !strictMode; setStrictMode(next);
                toast(next ? "🔒 Strict mode ON" : "🔓 Strict mode OFF");
              }}>
                <span className="ss-strict-indicator">{strictMode ? "🔒" : "🔓"}</span>
                <div className="ss-strict-text">
                  <span className="ss-strict-title">Strict Mode</span>
                  <span className="ss-strict-desc">{strictMode ? "Tab switch pauses timer (2s grace)" : "Timer continues while browsing"}</span>
                </div>
                <div className={`ss-strict-badge${strictMode ? " on" : ""}`}>{strictMode ? "ON" : "OFF"}</div>
              </button>
            </div>

            <AnimatePresence>
              {deepWorkEnabled && (
                <motion.div className="dw-stats-strip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="dw-stat-mini"><span style={{ color: dwColor }}>{dwStreak}d</span><span>Streak</span></div>
                  <div className="dw-stat-divider" />
                  <div className="dw-stat-mini"><span style={{ color: "#a855f7" }}>{dwLongestStreak}d</span><span>Best</span></div>
                  <div className="dw-stat-divider" />
                  <div className="dw-stat-mini"><span style={{ color: "#60a5fa" }}>{dwTotalHours}h</span><span>Total</span></div>
                  <div className="dw-stat-divider" />
                  <div className="dw-stat-mini"><span style={{ color: "#34d399" }}>{dwCompletedCount}</span><span>Sessions</span></div>
                  {dwNextMs !== null && (
                    <>
                      <div className="dw-stat-divider" />
                      <div className="dw-milestone-mini">
                        <div className="dw-milestone-mini-track">
                          <motion.div className="dw-milestone-mini-fill" style={{ "--mc": dwColor }}
                            initial={{ width: 0 }} animate={{ width: `${Math.round((dwStreak / dwNextMs) * 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }} />
                        </div>
                        <span style={{ color: dwColor, fontSize: "0.65rem" }}>{dwStreak}/{dwNextMs} ⭐</span>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {deepWorkEnabled && (
                <motion.div className={`dw-today-pill${dwTodayDone ? " done" : " pending"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {dwTodayDone ? "✅ Streak secured today — shield intact!" : "⚡ No deep work yet — protect the streak!"}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {deepWorkEnabled && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button className="dw-history-toggle" onClick={() => setDwShowHistory((p) => !p)}>
                    📈 Recent Sessions {dwShowHistory ? "▲" : "▼"}
                  </button>
                  <AnimatePresence>
                    {dwShowHistory && (
                      <motion.div className="dw-history-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}>
                        {dwLoading ? (
                          <p className="dw-history-note">Loading…</p>
                        ) : !isOnline ? (
                          <p className="dw-history-note">Session history unavailable offline</p>
                        ) : dwSessions.length === 0 ? (
                          <p className="dw-history-note">No sessions yet — start your first one! ✨</p>
                        ) : (
                          dwSessions.slice(0, 8).map((s, i) => {
                            const d    = s.date?.toDate ? s.date.toDate() : new Date(s.date);
                            const mins = Math.round((s.duration ?? 0) / 60);
                            return (
                              <motion.div key={s.id} className={`dw-history-row${s.completed ? " done" : " miss"}`}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                                <span className="dw-hrow-dot" />
                                <span className="dw-hrow-date">{fmtShortDate(d)}</span>
                                <span className="dw-hrow-dur">{mins}m</span>
                                <span className={`dw-hrow-status${s.completed ? "" : " miss"}`}>{s.completed ? "✓ Done" : "✗ Abandoned"}</span>
                              </motion.div>
                            );
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="ss-side-col">
            <div className="ss-field-env-row">
              {currentEnvironment ? (
                <button
                  className="ss-env-pill"
                  style={{ "--env-color": envTypeInfo(currentEnvironment.type).color }}
                  onClick={() => setShowEnvPicker(true)}
                  title="Click to change location"
                >
                  {envTypeInfo(currentEnvironment.type).emoji} {currentEnvironment.name}
                  <span
                    style={{ marginLeft: "0.3rem", opacity: 0.6, fontSize: "0.75rem" }}
                    onClick={(e) => { e.stopPropagation(); setCurrentEnvironment(null); currentEnvironmentRef.current = null; }}
                    title="Remove location"
                  >×</span>
                </button>
              ) : (
                <button className="ss-env-pill ss-env-pill--empty" onClick={() => setShowEnvPicker(true)}>
                  📍 Add location
                </button>
              )}
              <div className="ss-field-chips" style={{ marginBottom: 0 }}>
                {studyFields.map((f) => (
                  <button key={f}
                    className={`ss-field-chip${selectedField === f ? " selected" : ""}${(isRunning || dwActive) ? " locked" : ""}`}
                    onClick={() => !isRunning && !dwActive && setSelectedField(f)}>
                    {f}
                    {f !== "General" && (
                      <span className="ss-chip-remove" onClick={(e) => { e.stopPropagation(); openRemoveModal(f); }}>×</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <motion.div className="ss-card ss-field-card" variants={cardVariant}>
              <div className="ss-card-title"><span className="ss-card-icon">🎯</span>Add Field</div>
              <div className="ss-add-field-row">
                <input className="ss-input" type="text" placeholder="New field name…"
                  value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addField()} />
                <button className="ss-btn-sm ss-btn-purple" onClick={addField}>+ Add</button>
              </div>
            </motion.div>

            <motion.div className="ss-card ss-mini-stats" variants={cardVariant}>
              <div className="ss-card-title"><span className="ss-card-icon">📊</span>Overview</div>
              <div className="ss-mini-grid">
                {[
                  { label: "Today", val: fmtMins(timeStats.today), color: "#a855f7" },
                  { label: "Week",  val: fmtMins(timeStats.week),  color: "#34d399" },
                  { label: "Tasks", val: taskStats.total,           color: "#60a5fa" },
                  { label: "Done",  val: taskStats.completed,       color: "#fbbf24" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="ss-mini-item">
                    <div className="ss-mini-num" style={{ color }}>{val}</div>
                    <div className="ss-mini-label">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <AnimatePresence>
              {isRunning && (
                <motion.div className="ss-card ss-quick-distract" variants={cardVariant} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <div className="ss-card-title"><span className="ss-card-icon">⚡</span>Quick Log</div>
                  <p className="qdl-hint">Tap to log a distraction instantly</p>
                  <div className="qdl-grid">
                    {DISTRACTION_TYPES.slice(0, 4).map((type) => (
                      <motion.button key={type.id} className="qdl-btn"
                        style={{ "--btn-color": type.color, "--btn-bg": type.bg }}
                        onClick={() => handleDLLog(type.id)} whileTap={{ scale: 0.88 }} disabled={dlLogging}>
                        <span>{type.emoji}</span>
                        {(dlTodayCounts[type.id] || 0) > 0 && (
                          <span className="qdl-count" style={{ background: type.color }}>{dlTodayCounts[type.id]}</span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div className="ss-tab-bar" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
          {[
            { key: "tasks",    icon: "📋", label: "Tasks",        badge: taskStats.pending > 0 ? taskStats.pending : null },
            { key: "stats",    icon: "📊", label: "Stats",        badge: isRunning ? "●" : null },
            { key: "fields",   icon: "📚", label: "Fields",       badge: null },
            { key: "distract", icon: "⚡", label: "Distractions", badge: dlTodayLogs.length > 0 ? dlTodayLogs.length : null },
          ].map(({ key, icon, label, badge }) => (
            <button key={key} className={`ss-tab${activePanel === key ? " active" : ""}`}
              onClick={() => setActivePanel(activePanel === key ? null : key)}>
              <span className="ss-tab-icon">{icon}</span>
              <span className="ss-tab-label">{label}</span>
              {badge !== null && (
                <span className={`ss-tab-badge${badge === "●" ? " live" : ""}`}>{badge}</span>
              )}
            </button>
          ))}
        </motion.div>

        <AnimatePresence>
          {activePanel === "tasks" && (
            <motion.div className="ss-panel" variants={overlayVariant} initial="initial" animate="animate" exit="exit">
              <div className="ss-panel-header">
                <h2 className="ss-panel-title">📋 To-Do List</h2>
                <button className="ss-panel-close" onClick={() => setActivePanel(null)}>✕</button>
              </div>
              <div className="ss-task-add">
                <input className="ss-input" type="text" placeholder="Add a task…"
                  value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()} />
                <div className="ss-task-meta-row">
                  <select className="ss-select" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                    <option>Low</option><option>Medium</option><option>High</option>
                  </select>
                  <input className="ss-input ss-date-input" type="date" value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                  <button className="ss-btn-sm ss-btn-purple" onClick={addTask}>+ Add</button>
                </div>
              </div>
              <div className="ss-task-filter-row">
                <select className="ss-select" value={filterOption} onChange={(e) => setFilterOption(e.target.value)}>
                  <option value="All">All ({taskStats.total})</option>
                  <option value="Completed">Done ({taskStats.completed})</option>
                  <option value="Pending">Pending ({taskStats.pending})</option>
                  <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                </select>
                <button className="ss-btn-sm ss-btn-ghost" onClick={sortByPriority}>↕ Priority</button>
                <button className="ss-btn-sm ss-btn-ghost" onClick={sortByDeadline}>📅 Due</button>
              </div>
              <div className="ss-task-list">
                <AnimatePresence>
                  {filteredTasks.length > 0 ? filteredTasks.map((task) => (
                    <motion.div key={task.id} className={`ss-task-item${task.completed ? " done" : ""}`}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }} layout>
                      <div className="ss-task-body">
                        {editingTask.id === task.id ? (
                          <input className="ss-input" value={editingTask.text}
                            onChange={(e) => setEditingTask((p) => ({ ...p, text: e.target.value }))}
                            onBlur={() => saveEdit(task.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(task.id); if (e.key === "Escape") setEditingTask({ id: null, text: "" }); }}
                            autoFocus />
                        ) : (
                          <>
                            <div className={`ss-task-text${task.completed ? " done" : ""}`} onClick={() => toggleTask(task.id)}>{task.text}</div>
                            <div className="ss-task-chips">
                              <span className={`ss-priority-chip ${task.priority.toLowerCase()}`}>{task.priority}</span>
                              {task.deadline && (
                                <span className={`ss-deadline-chip${new Date(task.deadline) < new Date() && !task.completed ? " overdue" : ""}`}>
                                  📅 {new Date(task.deadline + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="ss-task-actions">
                        <button className="ss-task-btn" onClick={() => toggleTask(task.id)}>{task.completed ? "↩" : "✓"}</button>
                        <button className="ss-task-btn" onClick={() => setEditingTask({ id: task.id, text: task.text })}>✎</button>
                        <button className="ss-task-btn danger" onClick={() => deleteTask(task.id)}>🗑</button>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="empty-state-sm" style={{ padding: "2rem" }}>
                      {filterOption === "All" ? "No tasks yet — add one above!" : `No ${filterOption.toLowerCase()} tasks.`}
                    </div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {lastDeleted && (
                  <motion.div className="ss-undo-bar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                    Deleted: <strong>"{lastDeleted.text}"</strong>
                    <button className="ss-btn-sm ss-btn-purple" onClick={undoDelete}>Undo</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activePanel === "stats" && (
            <motion.div className="ss-panel" variants={overlayVariant} initial="initial" animate="animate" exit="exit">
              <div className="ss-panel-header">
                <h2 className="ss-panel-title">
                  📊 Today's Stats
                  {isRunning && <span className="ss-live-badge">● LIVE</span>}
                </h2>
                <button className="ss-panel-close" onClick={() => setActivePanel(null)}>✕</button>
              </div>
              <div className="ss-stats-grid">
                {[
                  { label: "Total Today", val: fmtTime(timeStats.today) },
                  { label: "Sessions",    val: (userData?.dailyStats?.[localYMD()]?.sessionsCount || 0) + (isRunning ? 1 : 0) },
                  { label: "Fields",      val: todaySortedFields.length },
                ].map(({ label, val }) => (
                  <div key={label} className="ss-stats-box">
                    <div className="ss-stats-box-label">{label}</div>
                    <div className="ss-stats-box-val">{val}</div>
                  </div>
                ))}
              </div>
              <div className="ss-section-label">Field Breakdown — Today</div>
              <FieldBreakdown fieldTimes={todayFieldTimes} totalTime={timeStats.today} />
              <div className="ss-section-label" style={{ marginTop: "1.5rem" }}>
                Hourly Activity {isRunning && <span className="ss-live-tag">live</span>}
              </div>
              <HourHistogram dailyStats={userData?.dailyStats} liveSeconds={liveSessionSeconds} isRunning={isRunning} />
              <div className="ss-section-label" style={{ marginTop: "1.5rem" }}>Study Insights</div>
              <InsightCards insights={insights} />
              <div className="ss-section-label" style={{ marginTop: "1.5rem" }}>Recent Sessions</div>
              <div className="ss-recent-sessions">
                {recentSessions.length === 0 ? (
                  <div className="empty-state-sm">No recent sessions found.</div>
                ) : (
                  recentSessions.map((s) => (
                    <motion.div key={s.id} className="ss-recent-session-row"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                      <div className="ss-recent-session-info">
                        <span className="ss-recent-session-field">{s.field}</span>
                        <span className="ss-recent-session-meta">
                          {fmtMins(s.duration)} · {s.environment || "No location"} · {fmtShortDate(s.endedAt?.toDate ? s.endedAt.toDate() : new Date(s.endedAt))}
                        </span>
                      </div>
                      <div className="ss-recent-session-actions">
                        <button className="ss-task-btn"
                          onClick={() => setEditingSession({
                            id: s.id,
                            field: s.field,
                            environment: s.environment,
                            environmentType: s.environmentType,
                          })}>✎</button>
                        <button className="ss-task-btn danger"
                          onClick={() => handleDeleteSession(s.id, s)}>🗑</button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activePanel === "fields" && (
            <motion.div className="ss-panel" variants={overlayVariant} initial="initial" animate="animate" exit="exit">
              <div className="ss-panel-header">
                <h2 className="ss-panel-title">📚 Field Times</h2>
                <button className="ss-panel-close" onClick={() => setActivePanel(null)}>✕</button>
              </div>
              <div className="ss-fields-list">
                {todaySortedFields.length > 0 ? todaySortedFields.map(([field, secs], i) => (
                  <motion.div key={field} className={`ss-field-row${field === selectedField && isRunning ? " active" : ""}`}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="ss-field-row-info">
                      <div className="ss-field-row-name">{field}</div>
                      <div className="ss-field-row-time">{fmtTime(secs)}</div>
                    </div>
                    {field !== "General" && (
                      <button className="ss-task-btn danger" onClick={() => openRemoveModal(field)}>✕</button>
                    )}
                  </motion.div>
                )) : (
                  <div className="empty-state-sm">No fields studied today yet — start a session!</div>
                )}
              </div>
            </motion.div>
          )}

          {activePanel === "distract" && (
            <motion.div className="ss-panel" variants={overlayVariant} initial="initial" animate="animate" exit="exit">
              <div className="ss-panel-header">
                <h2 className="ss-panel-title">
                  ⚡ Distraction Log
                  {dlStreak > 0 && <span className="dl-streak-badge">🔥 {dlStreak}d streak</span>}
                </h2>
                <button className="ss-panel-close" onClick={() => setActivePanel(null)}>✕</button>
              </div>
              <div className="dl-subtabs">
                {[
                  { id: "log",      label: "Log",      emoji: "⚡" },
                  { id: "today",    label: "Today",    emoji: "📅" },
                  { id: "insights", label: "Insights", emoji: "🧠" },
                ].map((tab) => (
                  <button key={tab.id} className={`dl-subtab${dlTab === tab.id ? " active" : ""}`} onClick={() => setDlTab(tab.id)}>
                    {tab.emoji} {tab.label}
                    {tab.id === "today"    && dlTodayLogs.length > 0 && <span className="dl-subtab-badge">{dlTodayLogs.length}</span>}
                    {tab.id === "insights" && dlInsights.length > 0  && <span className="dl-subtab-badge insights">{dlInsights.length}</span>}
                  </button>
                ))}
              </div>
              <div className="dl-stats-strip">
                <div className="dl-stat-item"><span style={{ color: "#f472b6", fontSize: "1.2rem", fontWeight: 900 }}>{dlTodayLogs.length}</span><span>Today</span></div>
                <div className="dl-stat-divider" />
                <div className="dl-stat-item"><span style={{ color: "#a855f7", fontSize: "1.2rem", fontWeight: 900 }}>{dlLogs.length}</span><span>30 days</span></div>
                <div className="dl-stat-divider" />
                <div className="dl-stat-item"><span style={{ color: "#fbbf24", fontSize: "1.2rem", fontWeight: 900 }}>{dlStreak}</span><span>Streak</span></div>
              </div>
              <AnimatePresence mode="wait">
                {dlTab === "log" && (
                  <motion.div key="dl-log" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <div className="dl-tappad-label">What distracted you?</div>
                    <div className="dl-tappad-hint">{!isOnline ? "Offline — logs queue locally and sync later" : "Tap instantly — don't break your flow"}</div>
                    <div className="dl-type-grid">
                      {DISTRACTION_TYPES.map((type, i) => (
                        <motion.div key={type.id} className="dl-btn-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <motion.button className={`dl-type-btn${dlLastLogged === type.id ? " flashing" : ""}`}
                            style={{ "--btn-color": type.color, "--btn-bg": type.bg }}
                            onClick={() => handleDLLog(type.id)} disabled={dlLogging}
                            whileHover={{ scale: 1.06, y: -3 }} whileTap={{ scale: 0.88 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                            <span className="dl-btn-emoji">{type.emoji}</span>
                            <span className="dl-btn-label">{type.label}</span>
                            {(dlTodayCounts[type.id] || 0) > 0 && (
                              <motion.span className="dl-btn-count" style={{ background: type.color }}
                                initial={{ scale: 0 }} animate={{ scale: 1 }} key={dlTodayCounts[type.id]}>
                                {dlTodayCounts[type.id]}
                              </motion.span>
                            )}
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                    {dlTodayBreakdown.length > 0 && (
                      <div className="dl-today-mini">
                        <p className="dl-mini-title">Today so far</p>
                        {dlTodayBreakdown.map((d) => {
                          const type = getDType(d.id);
                          return (
                            <div key={d.id} className="dl-mini-bar-row">
                              <span className="dl-mini-bar-emoji">{type.emoji}</span>
                              <div className="dl-mini-bar-track">
                                <motion.div className="dl-mini-bar-fill" style={{ "--bar-color": type.color }}
                                  initial={{ width: 0 }} animate={{ width: `${(d.count / dlTodayLogs.length) * 100}%` }}
                                  transition={{ duration: 0.6 }} />
                              </div>
                              <span className="dl-mini-bar-count" style={{ color: type.color }}>{d.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
                {dlTab === "today" && (
                  <motion.div key="dl-today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    {dlTodayBreakdown.length > 0 && (
                      <div className="dl-filter-bar">
                        <button className={`dl-filter-chip${!dlFilterType ? " active" : ""}`} onClick={() => setDlFilterType(null)}>All</button>
                        {dlTodayBreakdown.map((d) => {
                          const type = getDType(d.id);
                          return (
                            <button key={d.id} className={`dl-filter-chip${dlFilterType === d.id ? " active" : ""}`}
                              style={{ "--chip-color": type.color }} onClick={() => setDlFilterType(dlFilterType === d.id ? null : d.id)}>
                              {type.emoji} {d.count}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {dlTodayByHour.length > 0 ? (
                      <div className="dl-log-list">
                        {dlTodayByHour.map(({ hour, items }) => (
                          <div key={hour} className="dl-hour-group">
                            <p className="dl-hour-label">{hour}</p>
                            <AnimatePresence>
                              {items.map((item) => {
                                const type = getDType(item.type);
                                return (
                                  <motion.div key={item.id} className="dl-log-entry"
                                    style={{ "--entry-color": type.color }}
                                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 16, height: 0 }} layout>
                                    <span className="dl-entry-emoji">{type.emoji}</span>
                                    <div className="dl-entry-body">
                                      <span className="dl-entry-label" style={{ color: type.color }}>{type.label}</span>
                                      <span className="dl-entry-tip">{type.tip}</span>
                                    </div>
                                    <span className="dl-entry-time">{fmtClockTime(getTimestamp(item))}</span>
                                    <button className="dl-entry-delete" onClick={() => handleDLDelete(item.id)}>🗑</button>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state-sm" style={{ margin: "1.5rem 1.75rem" }}>
                        {dlFilterType ? `No ${getDType(dlFilterType).label.toLowerCase()} distractions today` : "No distractions logged yet — great focus! 🎯"}
                      </div>
                    )}
                  </motion.div>
                )}
                {dlTab === "insights" && (
                  <motion.div key="dl-insights" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    {dlInsights.length > 0 ? dlInsights.map((ins, i) => (
                      <motion.div key={i} className="dl-insight-card" style={{ "--ins-color": ins.color }}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                        <span className="dl-insight-emoji">{ins.emoji}</span>
                        <div>
                          <p className="dl-insight-text">{ins.text}</p>
                          {ins.action && <p className="dl-insight-action">💡 {ins.action}</p>}
                        </div>
                      </motion.div>
                    )) : (
                      <div className="empty-state-sm" style={{ margin: "1.5rem 1.75rem" }}>
                        Log a few distractions and insights will appear here 🧠
                      </div>
                    )}
                    {DISTRACTION_TYPES.filter((t) => (dlTodayCounts[t.id] || 0) > 0).map((type) => (
                      <div key={type.id} className="dl-tip-card" style={{ "--tip-color": type.color }}>
                        <span className="dl-tip-emoji">{type.emoji}</span>
                        <div>
                          <p className="dl-tip-label" style={{ color: type.color }}>{type.label}</p>
                          <p className="dl-tip-text">{type.tip}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}