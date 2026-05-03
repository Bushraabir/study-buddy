import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { auth, db, storage } from "../components/firebase";
import {
  onAuthStateChanged, updateProfile, deleteUser,
  reauthenticateWithCredential, EmailAuthProvider,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine,
} from "recharts";
import "./Profile.css";

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -12 },
};
const staggerList = { animate: { transition: { staggerChildren: 0.06 } } };
const rowVariant = { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0, transition: { duration: 0.35 } } };

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localYM(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function localISOWeek(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const thu = new Date(date);
  thu.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(thu.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((thu - yearStart) / 86400000) + 1) / 7);
  return `${thu.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function formatTime(s) {
  if (!s || s <= 0) return "00:00:00";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}
function formatHours(s) {
  if (!s || s <= 0) return "0h";
  const h = s / 3600;
  return h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`;
}
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Data Helpers ─────────────────────────────────────────────────────────────
function calcStreak(dailyStats) {
  if (!dailyStats) return 0;
  let streak = 0;
  const today = new Date();
  const todayKey = localYMD(today);
  const todayHasStudy = (dailyStats[todayKey]?.totalTime || 0) > 0;
  const startOffset = todayHasStudy ? 0 : 1;
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = localYMD(d);
    if ((dailyStats[key]?.totalTime || 0) > 0) streak++;
    else break;
  }
  return streak;
}
function deriveTimeStats(dailyStats) {
  if (!dailyStats) return { today: 0, week: 0, month: 0, allTime: 0 };
  const todayKey = localYMD(), weekKey = localISOWeek(), monthKey = localYM();
  let today = 0, week = 0, month = 0, allTime = 0;
  Object.entries(dailyStats).forEach(([dk, ds]) => {
    const t = ds?.totalTime || 0;
    allTime += t;
    if (dk === todayKey) today += t;
    if (localISOWeek(new Date(dk + "T12:00:00")) === weekKey) week += t;
    if (dk.startsWith(monthKey)) month += t;
  });
  return { today, week, month, allTime };
}
function getLast30Days(dailyStats) {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = localYMD(d);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const shortLabel = i % 5 === 0 ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    days.push({ key, label, shortLabel, hours: (dailyStats?.[key]?.totalTime || 0) / 3600, sessions: dailyStats?.[key]?.sessionsCount || 0 });
  }
  return days;
}
function getLast12Weeks(dailyStats) {
  const weeks = [];
  const today = new Date();
  for (let w = 11; w >= 0; w--) {
    let total = 0;
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - w * 7);
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart); day.setDate(weekStart.getDate() - d);
      total += dailyStats?.[localYMD(day)]?.totalTime || 0;
    }
    weeks.push({
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      hours: total / 3600,
    });
  }
  return weeks;
}
function getHeatmapData(dailyStats) {
  const data = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = localYMD(d);
    data.push({ key, seconds: dailyStats?.[key]?.totalTime || 0 });
  }
  return data;
}
function getHourlyDistribution(dailyStats) {
  const hours = Array(24).fill(0).map((_, i) => ({ hour: i, value: 0, label: i % 6 === 0 ? `${i}:00` : "" }));
  // Simulate from session data if available
  Object.values(dailyStats || {}).forEach((ds) => {
    if (ds?.totalTime > 0) {
      const random = Math.floor(Math.random() * 16) + 6;
      if (hours[random]) hours[random].value += (ds.totalTime / 3600);
    }
  });
  return hours;
}

async function compressImage(file, maxW = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PALETTE = ["#d4609a", "#8b6fd4", "#3eb57d", "#c87020", "#06b6d4", "#c0365e"];
const CHART_COLORS = {
  primary: "#d4609a",
  secondary: "#8b6fd4",
  accent: "#3eb57d",
  warn: "#c87020",
  cyan: "#06b6d4",
};

// ─── AnimatedNumber ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 0 }) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    let start = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1000, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(+(value * ease).toFixed(decimals));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, decimals]);
  return <>{displayed}</>;
}

// ─── Radial Progress ─────────────────────────────────────────────────────────
function RadialProgress({ value, max = 100, size = 120, stroke = 10, color = "#d4609a", label, sublabel }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    let start = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const run = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 900, 1);
      setAnimated((1 - Math.pow(1 - p, 3)) * pct);
      if (p < 1) rafRef.current = requestAnimationFrame(run);
    };
    rafRef.current = requestAnimationFrame(run);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pct]);
  const dash = animated * circ;
  return (
    <div className="radial-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }} />
      </svg>
      <div className="radial-label">
        <div className="radial-val">{label}</div>
        {sublabel && <div className="radial-sub">{sublabel}</div>}
      </div>
    </div>
  );
}

// ─── Custom Tooltip for Recharts ──────────────────────────────────────────────
function CustomTooltip({ active, payload, label, unit = "h" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="recharts-custom-tooltip">
      <div className="rct-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="rct-row">
          <span className="rct-dot" style={{ background: entry.color }} />
          <span className="rct-name">{entry.name}</span>
          <span className="rct-value" style={{ color: entry.color }}>
            {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Study Activity Section ───────────────────────────────────────────────────
function StudyActivitySection({ dailyStats, liveSessionSeconds }) {
  const [activeTab, setActiveTab] = useState("area");
  const todayKey = localYMD();

  const last30 = useMemo(() => {
    const data = getLast30Days(dailyStats);
    return data.map((d) =>
      d.key === todayKey ? { ...d, hours: d.hours + liveSessionSeconds / 3600 } : d
    );
  }, [dailyStats, liveSessionSeconds, todayKey]);

  const last12w = useMemo(() => getLast12Weeks(dailyStats), [dailyStats]);

  const weekdayAvg = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const totals = Array(7).fill(0), counts = Array(7).fill(0);
    Object.entries(dailyStats || {}).forEach(([dk, ds]) => {
      const dow = new Date(dk + "T12:00:00").getDay();
      totals[dow] += (ds?.totalTime || 0) / 3600;
      if ((ds?.totalTime || 0) > 0) counts[dow]++;
    });
    return days.map((day, i) => ({
      day,
      avg: counts[i] > 0 ? +(totals[i] / counts[i]).toFixed(2) : 0,
      total: +totals[i].toFixed(2),
    }));
  }, [dailyStats]);

  const monthlyTrend = useMemo(() => {
    const months = {};
    Object.entries(dailyStats || {}).forEach(([dk, ds]) => {
      const m = dk.slice(0, 7);
      months[m] = (months[m] || 0) + (ds?.totalTime || 0) / 3600;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, hours]) => ({
        label: new Date(key + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        hours: +hours.toFixed(2),
      }));
  }, [dailyStats]);

  const tabs = [
    { id: "area", label: "30-Day Trend", icon: "📈" },
    { id: "bar", label: "Weekly", icon: "📊" },
    { id: "weekday", label: "By Weekday", icon: "📅" },
    { id: "monthly", label: "Monthly", icon: "🗓️" },
  ];

  const maxHours = useMemo(() => Math.max(...last30.map((d) => d.hours), 0.1), [last30]);

  return (
    <div className="activity-section">
      <div className="activity-tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`activity-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="at-icon">{t.icon}</span>
            <span className="at-label">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "area" && (
          <motion.div key="area" className="chart-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="chart-meta">
              <div className="chart-meta-stat">
                <span className="cms-label">Peak day</span>
                <span className="cms-val" style={{ color: CHART_COLORS.primary }}>
                  {formatHours(Math.max(...last30.map(d => d.hours)) * 3600)}
                </span>
              </div>
              <div className="chart-meta-stat">
                <span className="cms-label">Daily avg</span>
                <span className="cms-val" style={{ color: CHART_COLORS.secondary }}>
                  {formatHours((last30.reduce((a, d) => a + d.hours, 0) / last30.filter(d => d.hours > 0).length || 0) * 3600)}
                </span>
              </div>
              <div className="chart-meta-stat">
                <span className="cms-label">Active days</span>
                <span className="cms-val" style={{ color: CHART_COLORS.accent }}>
                  {last30.filter(d => d.hours > 0).length}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={last30} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4609a" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#d4609a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b6fd4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b6fd4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shortLabel" tick={{ fill: "#7a6e94", fontSize: 10, fontFamily: "DM Mono, monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7a6e94", fontSize: 10, fontFamily: "DM Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={last30.reduce((a, d) => a + d.hours, 0) / (last30.filter(d => d.hours > 0).length || 1)}
                  stroke="#d4609a" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Area type="monotone" dataKey="hours" name="Hours" stroke="#d4609a" strokeWidth={2.5}
                  fill="url(#areaGrad1)" dot={false} activeDot={{ r: 5, fill: "#d4609a", stroke: "#0d0b14", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {activeTab === "bar" && (
          <motion.div key="bar" className="chart-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="chart-meta">
              <div className="chart-meta-stat">
                <span className="cms-label">Best week</span>
                <span className="cms-val" style={{ color: CHART_COLORS.primary }}>
                  {formatHours(Math.max(...last12w.map(d => d.hours)) * 3600)}
                </span>
              </div>
              <div className="chart-meta-stat">
                <span className="cms-label">Total (12w)</span>
                <span className="cms-val" style={{ color: CHART_COLORS.secondary }}>
                  {formatHours(last12w.reduce((a, d) => a + d.hours, 0) * 3600)}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={last12w} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={20}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b6fd4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#d4609a" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#7a6e94", fontSize: 9, fontFamily: "DM Mono, monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7a6e94", fontSize: 10, fontFamily: "DM Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(212,96,154,0.06)" }} />
                <Bar dataKey="hours" name="Hours" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {activeTab === "weekday" && (
          <motion.div key="weekday" className="chart-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="chart-meta">
              <div className="chart-meta-stat">
                <span className="cms-label">Best day</span>
                <span className="cms-val" style={{ color: CHART_COLORS.primary }}>
                  {weekdayAvg.reduce((best, d) => d.avg > best.avg ? d : best, weekdayAvg[0])?.day || "—"}
                </span>
              </div>
              <div className="chart-meta-stat">
                <span className="cms-label">Weakest day</span>
                <span className="cms-val" style={{ color: CHART_COLORS.warn }}>
                  {weekdayAvg.reduce((worst, d) => d.avg < worst.avg ? d : worst, weekdayAvg[0])?.day || "—"}
                </span>
              </div>
            </div>
            <div className="weekday-grid">
              {weekdayAvg.map((d, i) => {
                const maxAvg = Math.max(...weekdayAvg.map(x => x.avg), 0.1);
                const pct = (d.avg / maxAvg) * 100;
                const color = PALETTE[i % PALETTE.length];
                return (
                  <div key={d.day} className="weekday-col">
                    <div className="weekday-bar-wrap">
                      <motion.div className="weekday-bar-fill"
                        style={{ background: `linear-gradient(180deg, ${color}, ${color}88)`, boxShadow: `0 0 12px ${color}40` }}
                        initial={{ height: 0 }} animate={{ height: `${Math.max(pct, 3)}%` }}
                        transition={{ duration: 0.8, delay: i * 0.06, ease: [0.34, 1.4, 0.64, 1] }} />
                    </div>
                    <div className="weekday-label" style={{ color: pct > 70 ? color : "#7a6e94" }}>{d.day}</div>
                    <div className="weekday-avg">{d.avg > 0 ? `${d.avg.toFixed(1)}h` : "—"}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === "monthly" && (
          <motion.div key="monthly" className="chart-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="chart-meta">
              <div className="chart-meta-stat">
                <span className="cms-label">Best month</span>
                <span className="cms-val" style={{ color: CHART_COLORS.primary }}>
                  {monthlyTrend.reduce((b, d) => d.hours > b.hours ? d : b, monthlyTrend[0] || { hours: 0, label: "—" })?.label}
                </span>
              </div>
              <div className="chart-meta-stat">
                <span className="cms-label">Total (6mo)</span>
                <span className="cms-val" style={{ color: CHART_COLORS.cyan }}>
                  {formatHours(monthlyTrend.reduce((a, d) => a + d.hours, 0) * 3600)}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#d4609a" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#7a6e94", fontSize: 10, fontFamily: "DM Mono, monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7a6e94", fontSize: 10, fontFamily: "DM Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="hours" name="Hours" stroke="url(#lineGlow)"
                  strokeWidth={3} dot={{ r: 5, fill: "#d4609a", stroke: "#0d0b14", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#06b6d4", stroke: "#0d0b14", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Fields Radar Chart ───────────────────────────────────────────────────────
function FieldsRadarChart({ fieldStats }) {
  const data = useMemo(() => {
    const top6 = fieldStats.slice(0, 6);
    const max = top6[0]?.[1] || 1;
    return top6.map(([field, time]) => ({
      field: field.length > 10 ? field.slice(0, 9) + "…" : field,
      value: Math.round((time / max) * 100),
      hours: time / 3600,
    }));
  }, [fieldStats]);

  if (data.length < 3) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="field" tick={{ fill: "#b8aed4", fontSize: 10, fontFamily: "DM Sans, sans-serif" }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Study %" dataKey="value" stroke="#d4609a" fill="#d4609a" fillOpacity={0.18}
          dot={{ r: 4, fill: "#d4609a", strokeWidth: 0 }} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload;
          return (
            <div className="recharts-custom-tooltip">
              <div className="rct-label">{d?.field}</div>
              <div className="rct-row">
                <span className="rct-dot" style={{ background: "#d4609a" }} />
                <span className="rct-name">Focus %</span>
                <span className="rct-value" style={{ color: "#d4609a" }}>{d?.value}%</span>
              </div>
              <div className="rct-row">
                <span className="rct-dot" style={{ background: "#8b6fd4" }} />
                <span className="rct-name">Time</span>
                <span className="rct-value" style={{ color: "#8b6fd4" }}>{d?.hours?.toFixed(1)}h</span>
              </div>
            </div>
          );
        }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Pie / Donut ──────────────────────────────────────────────────────────────
function FieldDonut({ fieldStats }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const data = useMemo(() => fieldStats.slice(0, 6).map(([name, value]) => ({ name, value })), [fieldStats]);
  const total = data.reduce((a, d) => a + d.value, 0);

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
    if (activeIndex !== index) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontFamily="DM Mono, monospace" fontWeight={700}>
        {Math.round((data[index].value / total) * 100)}%
      </text>
    );
  };

  return (
    <div className="donut-container">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
            paddingAngle={3} dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            labelLine={false} label={renderLabel}>
            {data.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                style={{ filter: activeIndex === index ? `drop-shadow(0 0 8px ${PALETTE[index % PALETTE.length]}80)` : "none", cursor: "pointer", transition: "opacity 0.2s" }} />
            ))}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0];
            return (
              <div className="recharts-custom-tooltip">
                <div className="rct-label">{d.name}</div>
                <div className="rct-row">
                  <span className="rct-dot" style={{ background: d.payload.fill || PALETTE[0] }} />
                  <span className="rct-name">Time</span>
                  <span className="rct-value" style={{ color: d.payload.fill || PALETTE[0] }}>{formatHours(d.value)}</span>
                </div>
                <div className="rct-row">
                  <span className="rct-dot" style={{ background: "#7a6e94" }} />
                  <span className="rct-name">Share</span>
                  <span className="rct-value" style={{ color: "#94a3b8" }}>{Math.round((d.value / total) * 100)}%</span>
                </div>
              </div>
            );
          }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-legend">
        {data.map(({ name, value }, i) => {
          const color = PALETTE[i % PALETTE.length];
          return (
            <div key={i} className={`donut-legend-item ${activeIndex === i ? "active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}>
              <div className="legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
              <span className="legend-name">{name.slice(0, 14)}</span>
              <span className="legend-pct" style={{ color }}>{Math.round((value / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Activity Heatmap ─────────────────────────────────────────────────────────
function ActivityHeatmap({ data }) {
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef(null);
  const max = useMemo(() => Math.max(...data.map((d) => d.seconds), 1), [data]);

  const getColor = useCallback((seconds) => {
    if (seconds === 0) return "rgba(255,255,255,0.04)";
    const i = seconds / max;
    if (i < 0.25) return "rgba(212,96,154,0.22)";
    if (i < 0.5) return "rgba(212,96,154,0.45)";
    if (i < 0.75) return "rgba(212,96,154,0.72)";
    return "#d4609a";
  }, [max]);

  const { weeks, monthLabels } = useMemo(() => {
    const weeksArr = [];
    let week = [];
    data.forEach((d) => { week.push(d); if (week.length === 7) { weeksArr.push(week); week = []; } });
    if (week.length) weeksArr.push(week);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = [];
    let lastMonth = -1;
    weeksArr.forEach((w, wi) => {
      const m = new Date(w[0].key + "T12:00:00").getMonth();
      if (m !== lastMonth) { labels.push({ idx: wi, label: months[m] }); lastMonth = m; }
    });
    return { weeks: weeksArr, monthLabels: labels };
  }, [data]);

  const handleCellEnter = useCallback((e, day) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = wrapRef.current?.getBoundingClientRect();
    setHovered(day);
    if (parentRect) {
      setTooltipPos({ x: rect.left - parentRect.left + rect.width / 2, y: rect.top - parentRect.top });
    }
  }, []);

  return (
    <div className="heatmap-scroll-outer">
      <div className="heatmap-wrap" ref={wrapRef}>
        <div className="heatmap-month-row">
          {monthLabels.map((ml) => (
            <div key={ml.label + ml.idx} className="heatmap-month-label" style={{ gridColumn: ml.idx + 1 }}>{ml.label}</div>
          ))}
        </div>
        <div className="heatmap-grid">
          {weeks.map((w, wi) => (
            <div key={wi} className="heatmap-col">
              {w.map((day) => (
                <div key={day.key}
                  className={`heatmap-cell ${hovered?.key === day.key ? "heatmap-cell-hov" : ""}`}
                  style={{ background: getColor(day.seconds) }}
                  onMouseEnter={(e) => handleCellEnter(e, day)}
                  onMouseLeave={() => setHovered(null)}
                  onTouchStart={(e) => handleCellEnter(e, day)}
                  onTouchEnd={() => setTimeout(() => setHovered(null), 1500)} />
              ))}
            </div>
          ))}
        </div>
        {hovered && (
          <motion.div className="heatmap-tooltip"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            style={{ left: tooltipPos.x, top: tooltipPos.y - 52, transform: "translateX(-50%)", position: "absolute" }}>
            <strong>{hovered.key}</strong>
            <span>{hovered.seconds > 0 ? formatHours(hovered.seconds) : "No study"}</span>
          </motion.div>
        )}
        <div className="heatmap-legend">
          <span className="heatmap-legend-lbl">Less</span>
          {[0, 0.2, 0.45, 0.7, 1].map((v, i) => (
            <div key={i} className="heatmap-cell" style={{ background: getColor(v * max) }} />
          ))}
          <span className="heatmap-legend-lbl">More</span>
        </div>
      </div>
    </div>
  );
}

// ─── Productivity Score ───────────────────────────────────────────────────────
function ProductivityScore({ streak, avgDailyHours, completionRate }) {
  const score = Math.min(Math.round(streak * 3 + avgDailyHours * 15 + completionRate * 0.4), 100);
  const grade = score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D";
  const gradeColor = { S: "#d4609a", A: "#3eb57d", B: "#8b6fd4", C: "#c87020", D: "#c0365e" }[grade];
  const gaugeData = [
    { name: "Score", value: score },
    { name: "Gap", value: 100 - score },
  ];
  return (
    <div className="productivity-score-wrap">
      <div className="score-gauge-wrap">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={gaugeData} cx="50%" cy="50%" startAngle={220} endAngle={-40}
              innerRadius={52} outerRadius={70} paddingAngle={0} dataKey="value">
              <Cell fill={gradeColor} style={{ filter: `drop-shadow(0 0 10px ${gradeColor}60)` }} />
              <Cell fill="rgba(255,255,255,0.05)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="gauge-center">
          <div className="gauge-score" style={{ color: gradeColor }}>
            <AnimatedNumber value={score} />
          </div>
          <div className="gauge-grade" style={{ color: gradeColor }}>{grade}</div>
        </div>
      </div>
      <div className="score-breakdown">
        <div className="score-row"><span>🔥 Streak</span><span>{streak}d</span></div>
        <div className="score-row"><span>📈 Daily avg</span><span>{avgDailyHours.toFixed(1)}h</span></div>
        <div className="score-row"><span>✅ Tasks</span><span>{completionRate}%</span></div>
      </div>
    </div>
  );
}

// ─── Study Personality ────────────────────────────────────────────────────────
function StudyPersonality({ streak, avgDailyHours, fieldCount, completionRate }) {
  const personality = useMemo(() => {
    if (streak >= 30 && avgDailyHours >= 3) return { title: "Grandmaster", icon: "👑", desc: "Unstoppable consistency" };
    if (streak >= 14) return { title: "Streak Legend", icon: "🔥", desc: "Two weeks strong" };
    if (avgDailyHours >= 4) return { title: "Deep Diver", icon: "🤿", desc: "Marathon focus sessions" };
    if (fieldCount >= 5) return { title: "Polymath", icon: "🦉", desc: "Jack of all trades" };
    if (completionRate >= 90) return { title: "Task Crusher", icon: "⚡", desc: "Todo-list terminator" };
    if (streak >= 7) return { title: "Week Warrior", icon: "💪", desc: "Building the habit" };
    return { title: "Rookie", icon: "🌱", desc: "Every expert started here" };
  }, [streak, avgDailyHours, fieldCount, completionRate]);
  return (
    <motion.div className="personality-badge" whileHover={{ scale: 1.04 }}>
      <div className="personality-icon">{personality.icon}</div>
      <div className="personality-title">{personality.title}</div>
      <div className="personality-desc">{personality.desc}</div>
    </motion.div>
  );
}

// ─── Trend Arrow ──────────────────────────────────────────────────────────────
function TrendArrow({ current, previous }) {
  if (!previous || previous === 0) return null;
  const diff = ((current - previous) / previous) * 100;
  const isUp = diff >= 0;
  return (
    <motion.span className="trend-arrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ color: isUp ? "#3eb57d" : "#c0365e" }}>
      {isUp ? "▲" : "▼"} {Math.abs(diff).toFixed(0)}%
    </motion.span>
  );
}

// ─── Profile Insight Cards ────────────────────────────────────────────────────
function ProfileInsightCards({ userData }) {
  const insights = useMemo(() => {
    const ds = userData?.dailyStats || {};
    const dowTotals = Array(7).fill(0), dowCounts = Array(7).fill(0);
    Object.entries(ds).filter(([, s]) => (s?.totalTime || 0) > 0).forEach(([date, stats]) => {
      const dow = new Date(date + "T12:00:00").getDay();
      dowTotals[dow] += stats?.totalTime || 0;
      dowCounts[dow]++;
    });
    let bestDow = -1, bestDowAvg = 0;
    dowTotals.forEach((total, dow) => {
      if (dowCounts[dow] > 0) {
        const avg = total / dowCounts[dow];
        if (avg > bestDowAvg) { bestDowAvg = avg; bestDow = dow; }
      }
    });
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return {
      mostProductiveDayShort: bestDow >= 0 ? dayNames[bestDow].slice(0, 3) : null,
      mostProductiveDay: bestDow >= 0 ? dayNames[bestDow] : null,
      mostProductiveDayAvg: bestDowAvg / 3600,
      fieldCount: userData?.studyFields?.length || 0,
    };
  }, [userData]);

  const cards = [
    { icon: "📅", label: "Best Day", value: insights.mostProductiveDayShort || "—", sub: insights.mostProductiveDay ? `${insights.mostProductiveDayAvg.toFixed(1)}h avg` : "Need more data" },
    { icon: "📚", label: "Fields Tracked", value: insights.fieldCount, sub: "active subjects" },
    { icon: "🎯", label: "Study Score", value: `${Math.min(Math.round((insights.fieldCount * 5) + insights.mostProductiveDayAvg * 10), 99)}%`, sub: "consistency rating" },
  ];

  return (
    <div className="profile-insights-grid">
      {cards.map((card, i) => (
        <motion.div key={card.label} className="profile-insight-card"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, type: "spring", stiffness: 260, damping: 22 }}>
          <div className="pic-icon">{card.icon}</div>
          <div className="pic-label">{card.label}</div>
          <div className="pic-value">{card.value}</div>
          <div className="pic-sub">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Profile Component ───────────────────────────────────────────────────
function Profile() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [origName, setOrigName] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [delPass, setDelPass] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState(null);
  const [liveSessionSeconds, setLiveSessionSeconds] = useState(0);
  const [liveField, setLiveField] = useState(null);
  const [fieldsView, setFieldsView] = useState("bars");

  const unsubRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarMenuRef = useRef(null);

  // Live session state polling
  useEffect(() => {
    const interval = setInterval(() => {
      const state = window.studyBuddyTimerState;
      if (state?.isRunning && typeof state?.getSessionSeconds === "function") {
        setLiveSessionSeconds(state.getSessionSeconds());
        setLiveField(state.selectedField || null);
      } else { setLiveSessionSeconds(0); setLiveField(null); }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) setShowAvatarMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const setupListener = useCallback((uid) => {
    return onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
      else setUserData(null);
      setLoading(false);
    }, (err) => { console.error(err); toast.error("Failed to load profile"); setLoading(false); });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u); setDisplayName(u.displayName || ""); setOrigName(u.displayName || "");
        setProfilePicUrl(u.photoURL || null);
        unsubRef.current = setupListener(u.uid);
      } else {
        setUser(null); setUserData(null); setProfilePicUrl(null); setLoading(false);
        unsubRef.current?.(); unsubRef.current = null;
      }
    });
    return () => { unsub(); unsubRef.current?.(); };
  }, [setupListener]);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) return toast.error("Name cannot be empty");
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), { name: displayName.trim(), updatedAt: serverTimestamp() });
      setOrigName(displayName.trim()); setEditing(false);
      toast.success("Profile updated! ✨");
    } catch { toast.error("Failed to update profile"); }
  }, [user, displayName]);

  const handleCancelEdit = useCallback(() => { setDisplayName(origName); setEditing(false); }, [origName]);

  // ── Fix: Use correct storage bucket path for upload ──────────────────────
  const handlePicUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) return toast.error("Only JPG, PNG or WebP images");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8MB");

    setUploadingPic(true); setShowAvatarMenu(false);
    try {
      const compressed = await compressImage(file, 800, 0.85);
      const uploadFile = compressed || file;
      // Use the simple path — Firebase SDK resolves bucket from getStorage() config
      const storageRef = ref(storage, `profilePics/${user.uid}`);
      await uploadBytes(storageRef, uploadFile, { contentType: "image/jpeg" });
      const url = await getDownloadURL(storageRef);
      await updateProfile(user, { photoURL: url });
      await updateDoc(doc(db, "users", user.uid), { photoURL: url, updatedAt: serverTimestamp() });
      setProfilePicUrl(url);
      toast.success("Profile picture updated! 🌸");
    } catch (err) {
      console.error("Upload error:", err);
      if (err.code === "storage/unauthorized") toast.error("Upload denied — check Firebase Storage rules in console.");
      else if (err.code === "storage/unknown") toast.error("Storage CORS error. Add CORS config to Firebase Storage bucket.");
      else toast.error(err.message || "Upload failed");
    } finally { setUploadingPic(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }, [user]);

  const handleRemovePic = useCallback(async () => {
    setShowAvatarMenu(false);
    if (!profilePicUrl) return;
    setUploadingPic(true);
    try {
      try { await deleteObject(ref(storage, `profilePics/${user.uid}`)); } catch { /* ignore */ }
      await updateProfile(user, { photoURL: null });
      await updateDoc(doc(db, "users", user.uid), { photoURL: null, updatedAt: serverTimestamp() });
      setProfilePicUrl(null);
      toast.success("Profile picture removed");
    } catch { toast.error("Failed to remove picture"); }
    finally { setUploadingPic(false); }
  }, [user, profilePicUrl]);

  const handleDelete = useCallback(async () => {
    if (delConfirm !== "DELETE" || !delPass) return toast.error("Enter password and type DELETE");
    setIsDeleting(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, delPass);
      await reauthenticateWithCredential(user, cred);
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      toast.success("Account deleted");
    } catch (e) {
      if (e.code === "auth/wrong-password") toast.error("Wrong password");
      else toast.error(e.message);
    } finally { setIsDeleting(false); }
  }, [user, delPass, delConfirm]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const streak = useMemo(() => calcStreak(userData?.dailyStats), [userData?.dailyStats]);

  const heatmapData = useMemo(() => {
    const data = getHeatmapData(userData?.dailyStats);
    const todayKey = localYMD();
    return data.map((d) => d.key === todayKey ? { ...d, seconds: d.seconds + liveSessionSeconds } : d);
  }, [userData?.dailyStats, liveSessionSeconds]);

  const baseTimeStats = useMemo(() => deriveTimeStats(userData?.dailyStats), [userData?.dailyStats]);
  const timeStats = useMemo(() => ({
    today: baseTimeStats.today + liveSessionSeconds,
    week: baseTimeStats.week + liveSessionSeconds,
    month: baseTimeStats.month + liveSessionSeconds,
    allTime: baseTimeStats.allTime + liveSessionSeconds,
  }), [baseTimeStats, liveSessionSeconds]);

  const taskStats = useMemo(() => {
    const list = userData?.todoList || [];
    const completed = list.filter((t) => t.completed).length;
    return { total: list.length, completed, pending: list.length - completed };
  }, [userData?.todoList]);

  const completionRate = useMemo(() => {
    if (!taskStats.total) return 0;
    return Math.round((taskStats.completed / taskStats.total) * 100);
  }, [taskStats]);

  const activeFieldSet = useMemo(() => new Set(userData?.studyFields || []), [userData?.studyFields]);

  const fieldStats = useMemo(() => {
    const totals = {};
    Object.values(userData?.dailyStats || {}).forEach((ds) => {
      Object.entries(ds.fieldTimes || {}).forEach(([field, secs]) => {
        if (!activeFieldSet.has(field) || typeof secs !== "number" || secs <= 0) return;
        totals[field] = (totals[field] || 0) + secs;
      });
    });
    if (liveField && liveSessionSeconds > 0 && activeFieldSet.has(liveField))
      totals[liveField] = (totals[liveField] || 0) + liveSessionSeconds;
    return Object.entries(totals).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  }, [userData?.dailyStats, activeFieldSet, liveField, liveSessionSeconds]);

  const avgDailyHours = useMemo(() => {
    const activeDays = heatmapData.filter((d) => d.seconds > 0).length;
    if (!activeDays) return 0;
    return (timeStats.allTime / 3600) / activeDays;
  }, [heatmapData, timeStats.allTime]);

  const lastWeekKey = useMemo(() => localISOWeek(new Date(Date.now() - 7 * 86400000)), []);
  const lastWeekTotal = useMemo(() => {
    let sum = 0;
    Object.entries(userData?.dailyStats || {}).forEach(([dk, ds]) => {
      if (localISOWeek(new Date(dk + "T12:00:00")) === lastWeekKey) sum += ds?.totalTime || 0;
    });
    return sum;
  }, [userData?.dailyStats, lastWeekKey]);

  // Time pills data for mini bar chart
  const last7Totals = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - (6 - i));
      return (userData?.dailyStats?.[localYMD(d)]?.totalTime || 0) / 3600;
    });
  }, [userData?.dailyStats]);

  const miniBarData = useMemo(() => {
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    return last7Totals.map((h, i) => ({ day: days[i], h }));
  }, [last7Totals]);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          {[220, 160, 300, 220, 260].map((h, i) => <div key={i} className="skeleton-card" style={{ height: h }} />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-state">
          <div className="auth-lock">🔒</div>
          <h2>Not logged in</h2>
          <p>Sign in to view your profile and study statistics.</p>
        </div>
      </div>
    );
  }

  const isLive = liveSessionSeconds > 0;
  const initials = (displayName || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: "none" }} onChange={handlePicUpload} />

      <div className="profile-container">

        {/* ── Hero Card ──────────────────────────────────────────────────── */}
        <motion.div className="glass-card profile-hero" {...fadeUp}>
          <div className="hero-bg-pattern" />
          <div className="hero-inner">
            {/* Avatar */}
            <div className="avatar-zone" ref={avatarMenuRef}>
              <div className="avatar-glow" />
              <div className="avatar-wrapper">
                <div className={`avatar${uploadingPic ? " uploading" : ""}`}
                  onClick={() => setShowAvatarMenu((v) => !v)}>
                  {profilePicUrl ? (
                    <img src={profilePicUrl} alt="Profile"
                      onError={(e) => { e.currentTarget.style.display = "none"; setProfilePicUrl(null); }} />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <div className="avatar-overlay">{uploadingPic ? "⏳" : "📷"}</div>
                </div>
                <div className={`avatar-status${isLive ? " studying" : ""}`} />
              </div>
              <AnimatePresence>
                {showAvatarMenu && (
                  <motion.div className="avatar-menu"
                    initial={{ opacity: 0, scale: 0.9, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    transition={{ type: "spring", stiffness: 340, damping: 24 }}>
                    <button className="avatar-menu-btn" onClick={() => { setShowAvatarMenu(false); fileInputRef.current?.click(); }}>
                      📷 {profilePicUrl ? "Change photo" : "Upload photo"}
                    </button>
                    {profilePicUrl && (
                      <button className="avatar-menu-btn danger" onClick={handleRemovePic}>🗑️ Remove photo</button>
                    )}
                    <button className="avatar-menu-btn" onClick={() => setShowAvatarMenu(false)}>✕ Cancel</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Info */}
            <div className="hero-info">
              {editing ? (
                <div className="edit-mode">
                  <input className="edit-name-input" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancelEdit(); }}
                    autoFocus placeholder="Your display name" />
                  <div className="edit-actions">
                    <button className="btn-save" onClick={handleSave}>✓ Save</button>
                    <button className="btn-cancel" onClick={handleCancelEdit}>✕ Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="hero-name-row">
                    <h1 className="hero-name">{displayName || "Anonymous"}</h1>
                    <button className="edit-btn" onClick={() => setEditing(true)}>✏️</button>
                  </div>
                  <p className="hero-email">{user.email}</p>
                  <div className="hero-chips">
                    {userData?.createdAt && <span className="chip">📅 Joined {formatDate(userData.createdAt)}</span>}
                    <span className="chip">📚 {userData?.studyFields?.length || 0} fields</span>
                    {isLive && <span className="chip chip-live">🟢 {liveField}</span>}
                  </div>
                </>
              )}
            </div>

            {/* Right side */}
            <div className="hero-right">
              <StudyPersonality streak={streak} avgDailyHours={avgDailyHours}
                fieldCount={userData?.studyFields?.length || 0} completionRate={completionRate} />
              <div className="hero-metrics">
                {[
                  { icon: "🔥", val: streak, lbl: "Day Streak", raw: false },
                  { icon: "⏱️", val: formatHours(timeStats.allTime), lbl: "All-Time", raw: true },
                  { icon: "✅", val: completionRate, lbl: "Tasks Done", suffix: "%", raw: false },
                ].map(({ icon, val, lbl, raw, suffix }) => (
                  <div key={lbl} className="metric-pill">
                    <span className="metric-icon">{icon}</span>
                    <div>
                      <div className="metric-val">{raw ? val : <><AnimatedNumber value={val} />{suffix || ""}</>}</div>
                      <div className="metric-lbl">{lbl}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Productivity Score + Time Stats ────────────────────────────── */}
        <div className="two-col-grid">
          <motion.div className="glass-card section-card score-card" {...fadeUp} transition={{ delay: 0.07 }}>
            <div className="section-title"><span>🏆</span> Productivity Score {isLive && <span className="live-badge">LIVE</span>}</div>
            <ProductivityScore streak={streak} avgDailyHours={avgDailyHours} completionRate={completionRate} />
          </motion.div>

          <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.10 }}>
            <div className="section-title"><span>⏰</span> Study Time {isLive && <span className="live-badge">LIVE</span>}</div>
            <div className="time-pills">
              {[
                { label: "Today", val: timeStats.today, icon: "🌅", color: "#d4609a" },
                { label: "This Week", val: timeStats.week, icon: "📆", color: "#8b6fd4", showTrend: true },
                { label: "This Month", val: timeStats.month, icon: "🗓️", color: "#3eb57d" },
                { label: "All Time", val: timeStats.allTime, icon: "🏅", color: "#c87020" },
              ].map(({ label, val, icon, color, showTrend }) => (
                <div key={label} className="time-pill">
                  <div className="time-pill-icon" style={{ color }}>{icon}</div>
                  <div className="time-pill-body">
                    <div className="time-pill-val" style={{ color }}>{formatTime(val)}</div>
                    <div className="time-pill-lbl">{label}</div>
                  </div>
                  {/* Mini sparkline bar */}
                  <div className="time-pill-mini">
                    {miniBarData.map((d, i) => (
                      <div key={i} className="mini-bar" style={{
                        height: `${Math.max((d.h / Math.max(...last7Totals, 0.1)) * 100, 5)}%`,
                        background: color, opacity: 0.4 + (i / 6) * 0.6
                      }} />
                    ))}
                  </div>
                  {showTrend && <TrendArrow current={timeStats.week} previous={lastWeekTotal} />}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Insights ──────────────────────────────────────────────────── */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.12 }}>
          <div className="section-title"><span>💡</span> Study Insights</div>
          <ProfileInsightCards userData={userData} />
        </motion.div>

        {/* ── Study Activity (Recharts) ──────────────────────────────────── */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.14 }}>
          <div className="section-title">
            <span>📊</span> Study Activity {isLive && <span className="live-badge">LIVE</span>}
          </div>
          <StudyActivitySection dailyStats={userData?.dailyStats} liveSessionSeconds={liveSessionSeconds} />
        </motion.div>

        {/* ── Year Heatmap ───────────────────────────────────────────────── */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.17 }}>
          <div className="section-title"><span>🗓️</span> Year Activity Heatmap</div>
          <ActivityHeatmap data={heatmapData} />
        </motion.div>

        {/* ── Fields Breakdown ───────────────────────────────────────────── */}
        {fieldStats.length > 0 && (
          <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.20 }}>
            <div className="section-header">
              <div className="section-title">
                <span>🎓</span> Study Fields {isLive && liveField && <span className="live-badge">LIVE — {liveField}</span>}
              </div>
              <div className="chart-tabs">
                {[["bars", "Bars"], ["donut", "Donut"], ["radar", "Radar"]].map(([v, lbl]) => (
                  <button key={v} className={`chart-tab ${fieldsView === v ? "active" : ""}`} onClick={() => setFieldsView(v)}>{lbl}</button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {fieldsView === "bars" && (
                <motion.div key="bars" className="fields-bars-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.div className="field-list" variants={staggerList} initial="initial" animate="animate">
                    {fieldStats.slice(0, 8).map(([field, time], idx) => {
                      const pct = (time / fieldStats[0][1]) * 100;
                      const color = PALETTE[idx % PALETTE.length];
                      const isActive = field === liveField && isLive;
                      return (
                        <motion.div key={field} className={`field-row${isActive ? " field-row-live" : ""}`} variants={rowVariant}>
                          <div className="field-rank" style={{ color }}>#{idx + 1}</div>
                          <div className="field-info">
                            <div className="field-name-row">
                              <span className="field-name">
                                {isActive && <span className="field-live-dot" />}{field}
                              </span>
                              <span className="field-time-badge" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                                {formatHours(time)}
                              </span>
                            </div>
                            <div className="field-bar-track">
                              <motion.div className="field-bar-fill"
                                style={{ background: `linear-gradient(90deg, ${color}bb, ${color})` }}
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.9, delay: idx * 0.07, ease: [0.34, 1.56, 0.64, 1] }} />
                            </div>
                          </div>
                          <div className="field-exact">{formatTime(time)}</div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              )}
              {fieldsView === "donut" && (
                <motion.div key="donut" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <FieldDonut fieldStats={fieldStats} />
                </motion.div>
              )}
              {fieldsView === "radar" && (
                <motion.div key="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {fieldStats.length >= 3
                    ? <FieldsRadarChart fieldStats={fieldStats} />
                    : <div className="empty-state">Need at least 3 fields to show radar chart.</div>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Task Performance ───────────────────────────────────────────── */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.23 }}>
          <div className="section-title"><span>🎯</span> Task Performance</div>
          <div className="task-viz">
            <div className="task-radials">
              {[
                { val: taskStats.completed, max: taskStats.total || 1, color: "#3eb57d", label: <AnimatedNumber value={taskStats.completed} />, sub: "Done" },
                { val: taskStats.pending, max: taskStats.total || 1, color: "#c87020", label: <AnimatedNumber value={taskStats.pending} />, sub: "Pending" },
                { val: completionRate, max: 100, color: "#d4609a", label: <><AnimatedNumber value={completionRate} />%</>, sub: "Rate" },
              ].map(({ val, max, color, label, sub }) => (
                <div key={sub} className="task-radial-item">
                  <RadialProgress value={val} max={max} size={110} stroke={10} color={color} label={label} sublabel={sub} />
                </div>
              ))}
            </div>
            <div className="task-progress-section">
              <div className="task-progress-header">
                <span className="task-progress-lbl">Completion Progress</span>
                <span className="task-progress-count">{taskStats.completed} / {taskStats.total} tasks</span>
              </div>
              <div className="task-progress-track">
                <motion.div className="task-progress-fill" initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Danger Zone ────────────────────────────────────────────────── */}
        <motion.div className="glass-card danger-section" {...fadeUp} transition={{ delay: 0.28 }}>
          <div className="section-title"><span>⚙️</span> Account Management</div>
          <div className="danger-box">
            <div className="danger-title">⚠️ Danger Zone</div>
            <p className="danger-desc">Permanently deletes your account and all study data. Cannot be undone.</p>
            <button className="btn-danger" onClick={() => setShowDelete(true)}>Delete My Account</button>
          </div>
        </motion.div>
      </div>

      {/* ── Delete Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDelete && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !isDeleting && setShowDelete(false)}>
            <motion.div className="modal-box"
              initial={{ opacity: 0, scale: 0.88, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 30 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>⚠️ Delete Account</h3>
                <button className="modal-close" onClick={() => setShowDelete(false)} disabled={isDeleting}>✕</button>
              </div>
              <div className="modal-body">
                <p className="modal-warn">This will permanently delete your account and ALL data. Cannot be undone.</p>
                <div className="modal-field">
                  <label className="modal-label">Current password</label>
                  <input type="password" className="modal-input" value={delPass}
                    onChange={(e) => setDelPass(e.target.value)} placeholder="Enter your password"
                    disabled={isDeleting} autoComplete="current-password" />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Type DELETE to confirm</label>
                  <input type="text" className="modal-input" value={delConfirm}
                    onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" disabled={isDeleting} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-modal-cancel" onClick={() => setShowDelete(false)} disabled={isDeleting}>Cancel</button>
                <button className="btn-modal-delete" onClick={handleDelete}
                  disabled={isDeleting || delConfirm !== "DELETE" || !delPass}>
                  {isDeleting ? "Deleting…" : "Delete Account"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Profile;