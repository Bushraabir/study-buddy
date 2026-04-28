import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../components/firebase";
import {
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import "./Profile.css";

/* ─── Animation Variants ─── */
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const staggerList = { animate: { transition: { staggerChildren: 0.07 } } };
const rowVariant = { initial: { opacity: 0, x: -16 }, animate: { opacity: 1, x: 0 } };

/* ─── Date helpers (LOCAL time, matching Session page) ─── */
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

/* ─── Helpers ─── */
function formatTime(s) {
  if (!s || s <= 0) return "00:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}
function formatHours(s) {
  if (!s || s <= 0) return "0h";
  return `${(s / 3600).toFixed(1)}h`;
}
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ─── Streak calculation — doesn't penalise today ─── */
function calcStreak(dailyStats) {
  if (!dailyStats) return 0;
  let streak = 0;
  const today = new Date();
  const todayKey = localYMD(today);
  const todayHasStudy = (dailyStats[todayKey]?.totalTime || 0) > 0;

  // Start from today if studied, else yesterday (don't break streak for current day)
  const startOffset = todayHasStudy ? 0 : 1;

  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localYMD(d);
    if ((dailyStats[key]?.totalTime || 0) > 0) streak++;
    else break;
  }
  return streak;
}

/* ─── Derive time stats from dailyStats (single source of truth) ─── */
function deriveTimeStats(dailyStats) {
  if (!dailyStats) return { today: 0, week: 0, month: 0, allTime: 0 };
  const todayKey = localYMD();
  const weekKey = localISOWeek();
  const monthKey = localYM();
  let today = 0, week = 0, month = 0, allTime = 0;
  Object.entries(dailyStats).forEach(([dk, ds]) => {
    const t = ds?.totalTime || 0;
    allTime += t;
    if (dk === todayKey) today += t;
    // FIX BUG #9: Use noon anchor for DST safety — avoids day-shift on DST transitions
    if (localISOWeek(new Date(dk + "T12:00:00")) === weekKey) week += t;
    if (dk.startsWith(monthKey)) month += t;
  });
  return { today, week, month, allTime };
}

function getLast7Days(dailyStats) {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localYMD(d);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({
      key, label,
      seconds: dailyStats?.[key]?.totalTime || 0,
      sessions: dailyStats?.[key]?.sessionsCount || 0,
    });
  }
  return days;
}

function getLast12Weeks(dailyStats) {
  const weeks = [];
  const today = new Date();
  for (let w = 11; w >= 0; w--) {
    let total = 0;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - w * 7);
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() - d);
      const key = localYMD(day);
      total += dailyStats?.[key]?.totalTime || 0;
    }
    const shortLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weeks.push({ label: shortLabel, seconds: total });
  }
  return weeks;
}

/* FIX PERF #4: getHeatmapData is memoized at call site with stable dailyStats reference.
   Computation only runs when dailyStats changes, not every render/tick. */
function getHeatmapData(dailyStats) {
  const data = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localYMD(d);
    data.push({ key, seconds: dailyStats?.[key]?.totalTime || 0 });
  }
  return data;
}

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, suffix = "", decimals = 0 }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(+(value * ease).toFixed(decimals));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, decimals]);
  return <>{displayed}{suffix}</>;
}

/* ─── Radial Progress ─── */
function RadialProgress({ value, max = 100, size = 120, stroke = 10, color = "#a855f7", label, sublabel }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    let start = null;
    const run = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1000, 1);
      setAnimated((1 - Math.pow(1 - p, 3)) * pct);
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }, [pct]);

  const dash = animated * circ;
  return (
    <div className="radial-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }} />
      </svg>
      <div className="radial-label">
        <div className="radial-val">{label}</div>
        {sublabel && <div className="radial-sub">{sublabel}</div>}
      </div>
    </div>
  );
}

/* ─── Bar Chart ─── */
function BarChart({ data, maxVal, color = "#a855f7" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const max = maxVal || Math.max(...data.map((d) => d.seconds), 1);
  return (
    <div className="barchart-wrap">
      <div className="barchart-bars">
        {data.map((d, i) => {
          const pct = max > 0 ? (d.seconds / max) * 100 : 0;
          const isHov = hoveredIdx === i;
          return (
            <div key={d.key || i} className="barchart-col"
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
              {isHov && d.seconds > 0 && (
                <motion.div className="bar-tooltip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <strong>{formatHours(d.seconds)}</strong>
                  {d.sessions !== undefined && <span>{d.sessions} sessions</span>}
                </motion.div>
              )}
              <div className="bar-outer">
                <motion.div className="bar-fill" style={{ background: isHov ? "#c084fc" : color }}
                  initial={{ height: 0 }} animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.06, ease: [0.34, 1.56, 0.64, 1] }} />
              </div>
              <div className="bar-label">{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Sparkline ─── */
function Sparkline({ data, color = "#a855f7", width = 120, height = 40 }) {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - (v / max) * height}`
  ).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  const gradId = `sg-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Donut Chart ─── */
const DONUT_COLORS = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

function DonutChart({ segments, size = 200 }) {
  const [hovered, setHovered] = useState(null);
  const [animated, setAnimated] = useState(0);
  const r = size / 2 - 30;
  const cx = size / 2;
  const cy = size / 2;

  useEffect(() => {
    let start = null;
    const run = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setAnimated(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }, []);

  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let cumulative = 0;

  return (
    <div className="donut-container">
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
          cumulative += pct;
          const animPct = animated * pct;
          const endAngle = (cumulative - pct + animPct) * 2 * Math.PI - Math.PI / 2;
          const gap = 0.04;
          const x1 = cx + r * Math.cos(startAngle + gap);
          const y1 = cy + r * Math.sin(startAngle + gap);
          const x2 = cx + r * Math.cos(endAngle - gap);
          const y2 = cy + r * Math.sin(endAngle - gap);
          const largeArc = animPct > 0.5 ? 1 : 0;
          const isHov = hovered === i;
          const color = DONUT_COLORS[i % DONUT_COLORS.length];
          return (
            <path key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none" stroke={color} strokeWidth={isHov ? 22 : 16} strokeLinecap="round"
              style={{
                cursor: "pointer",
                filter: isHov ? `drop-shadow(0 0 10px ${color}90)` : "none",
                transformOrigin: `${cx}px ${cy}px`,
                transform: isHov ? "scale(1.06)" : "scale(1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(i)} onTouchEnd={() => setHovered(null)} />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 22} fill="rgba(168,85,247,0.05)"
          stroke="rgba(168,85,247,0.15)" strokeWidth="1" />
        {hovered !== null && segments[hovered] ? (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="15"
              fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {formatHours(segments[hovered].value)}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="10"
              fontFamily="Inter, sans-serif">
              {(segments[hovered].label || "").slice(0, 14)}
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fill="#c084fc" fontSize="13"
              fontWeight="700" fontFamily="Inter, sans-serif">
              {segments.length} fields
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="10"
              fontFamily="Inter, sans-serif">
              hover to explore
            </text>
          </>
        )}
      </svg>
      <div className="donut-legend">
        {segments.slice(0, 6).map((seg, i) => {
          const color = DONUT_COLORS[i % DONUT_COLORS.length];
          return (
            <div key={i} className={`donut-legend-item ${hovered === i ? "active" : ""}`}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div className="legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
              <span className="legend-name">{(seg.label || "").slice(0, 14)}</span>
              <span className="legend-pct">{Math.round((seg.value / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Year Heatmap ─── */
function ActivityHeatmap({ data }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...data.map((d) => d.seconds), 1);
  const getColor = (seconds) => {
    if (seconds === 0) return "rgba(255,255,255,0.04)";
    const i = seconds / max;
    if (i < 0.25) return "rgba(168,85,247,0.22)";
    if (i < 0.5) return "rgba(168,85,247,0.45)";
    if (i < 0.75) return "rgba(168,85,247,0.70)";
    return "#a855f7";
  };

  // FIX PERF #4: Memoize the weeks computation — doesn't need to rerun every render
  const { weeks, monthLabels } = useMemo(() => {
    const weeksArr = [];
    let week = [];
    data.forEach((d) => {
      week.push(d);
      if (week.length === 7) { weeksArr.push(week); week = []; }
    });
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

  return (
    <div className="heatmap-scroll-outer">
      <div className="heatmap-wrap">
        <div className="heatmap-month-row">
          {monthLabels.map((ml) => (
            <div key={ml.label + ml.idx} className="heatmap-month-label"
              style={{ gridColumn: ml.idx + 1 }}>
              {ml.label}
            </div>
          ))}
        </div>
        <div className="heatmap-grid">
          {weeks.map((w, wi) => (
            <div key={wi} className="heatmap-col">
              {w.map((day) => (
                <div key={day.key}
                  className={`heatmap-cell ${hovered?.key === day.key ? "heatmap-cell-hov" : ""}`}
                  style={{ background: getColor(day.seconds) }}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)} />
              ))}
            </div>
          ))}
        </div>
        {hovered && (
          <motion.div className="heatmap-tooltip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
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

/* ─── Productivity Score ─── */
function ProductivityScore({ streak, avgDailyHours, completionRate }) {
  const score = Math.min(Math.round(streak * 3 + avgDailyHours * 15 + completionRate * 0.4), 100);
  const grade = score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D";
  const gradeColor = { S: "#a855f7", A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#ef4444" }[grade];
  return (
    <div className="productivity-score-wrap">
      <RadialProgress value={score} max={100} size={140} stroke={12} color={gradeColor}
        label={<><AnimatedNumber value={score} /><span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>/100</span></>}
        sublabel="Score" />
      <div className="score-grade" style={{ color: gradeColor, textShadow: `0 0 20px ${gradeColor}60` }}>{grade}</div>
      <div className="score-breakdown">
        <div className="score-row"><span>🔥 Streak</span><span style={{ color: "#c084fc" }}>{streak}d</span></div>
        <div className="score-row"><span>📈 Daily avg</span><span style={{ color: "#c084fc" }}>{avgDailyHours.toFixed(1)}h</span></div>
        <div className="score-row"><span>✅ Tasks</span><span style={{ color: "#c084fc" }}>{completionRate}%</span></div>
      </div>
    </div>
  );
}

/* ─── Insight Cards ─── */
function ProfileInsightCards({ userData }) {
  const insights = useMemo(() => {
    const ds = userData?.dailyStats || {};
    const entries = Object.entries(ds).filter(([, s]) => (s?.totalTime || 0) > 0);

    // Best Study Hour
    const hourlyTotals = Array(24).fill(0);
    const hourlyDays = Array(24).fill(0);
    entries.forEach(([, stats]) => {
      const hourly = stats.hourly || {};
      Object.entries(hourly).forEach(([h, secs]) => {
        const hour = parseInt(h, 10);
        if (secs > 0) { hourlyTotals[hour] += secs; hourlyDays[hour] += 1; }
      });
    });

    let bestHour = -1;
    let bestHourAvg = 0;
    hourlyTotals.forEach((total, hour) => {
      if (hourlyDays[hour] > 0) {
        const avg = total / hourlyDays[hour];
        if (avg > bestHourAvg) { bestHourAvg = avg; bestHour = hour; }
      }
    });

    const fmt12 = (h) => {
      if (h === 0) return "12 AM";
      if (h < 12) return `${h} AM`;
      if (h === 12) return "12 PM";
      return `${h - 12} PM`;
    };

    // Most Productive Day
    const dowTotals = Array(7).fill(0);
    const dowCounts = Array(7).fill(0);
    entries.forEach(([date, stats]) => {
      // FIX BUG #9: noon anchor for DST safety
      const d = new Date(date + "T12:00:00");
      const dow = d.getDay();
      dowTotals[dow] += stats?.totalTime || 0;
      dowCounts[dow] += 1;
    });

    let bestDow = -1;
    let bestDowAvg = 0;
    dowTotals.forEach((total, dow) => {
      if (dowCounts[dow] > 0) {
        const avg = total / dowCounts[dow];
        if (avg > bestDowAvg) { bestDowAvg = avg; bestDow = dow; }
      }
    });
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Focus Score
    const completed = userData?.pomodorosCompleted || 0;
    const aborted = userData?.pomodorosAborted || 0;
    const total = completed + aborted;
    const focusScore = total > 0 ? Math.round((completed / total) * 100) : null;

    return {
      bestHour: bestHour >= 0 ? fmt12(bestHour) : null,
      bestHourAvg: bestHourAvg / 3600,
      mostProductiveDay: bestDow >= 0 ? dayNames[bestDow] : null,
      mostProductiveDayShort: bestDow >= 0 ? dayShort[bestDow] : null,
      mostProductiveDayAvg: bestDowAvg / 3600,
      focusScore,
      pomodorosCompleted: completed,
      pomodorosAborted: aborted,
    };
  }, [userData]);

  const cards = [
    {
      icon: "🕐",
      label: "Peak Study Hour",
      value: insights.bestHour || "—",
      sub: insights.bestHour ? `avg ${insights.bestHourAvg.toFixed(1)}h per session` : "No data yet",
      barValue: null,
    },
    {
      icon: "📅",
      label: "Best Day of Week",
      value: insights.mostProductiveDayShort || "—",
      sub: insights.mostProductiveDay
        ? `${insights.mostProductiveDayAvg.toFixed(1)}h avg · ${insights.mostProductiveDay}`
        : "Need more sessions",
      barValue: null,
    },
    {
      icon: "🎯",
      label: "Pomodoro Score",
      value: insights.focusScore !== null ? `${insights.focusScore}%` : "—",
      sub: insights.focusScore !== null
        ? `${insights.pomodorosCompleted} complete · ${insights.pomodorosAborted} interrupted`
        : "Start Pomodoro mode to track",
      barValue: insights.focusScore,
    },
  ];

  return (
    <div className="profile-insights-grid">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          className="profile-insight-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, type: "spring", stiffness: 260, damping: 22 }}
        >
          <div className="pic-icon">{card.icon}</div>
          <div className="pic-label">{card.label}</div>
          <div className="pic-value">{card.value}</div>
          <div className="pic-sub">{card.sub}</div>
          {card.barValue !== null && (
            <div className="pic-bar">
              <motion.div
                className="pic-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${card.barValue}%` }}
                transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PROFILE COMPONENT
══════════════════════════════════════════════ */
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
  const [chartView, setChartView] = useState("week");

  // Live session bridging from Session page
  const [liveSessionSeconds, setLiveSessionSeconds] = useState(0);
  const [liveField, setLiveField] = useState(null);
  const liveIntervalRef = useRef(null);

  const unsubRef = useRef(null);

  useEffect(() => {
    liveIntervalRef.current = setInterval(() => {
      const state = window.studyBuddyTimerState;
      if (state?.isRunning && state?.getSessionSeconds) {
        setLiveSessionSeconds(state.getSessionSeconds());
        setLiveField(state.selectedField || null);
      } else {
        setLiveSessionSeconds(0);
        setLiveField(null);
      }
    }, 1000);
    return () => clearInterval(liveIntervalRef.current);
  }, []);

  const setupListener = useCallback((uid) => {
    return onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
      else setUserData(null);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error("Failed to load profile data");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setDisplayName(u.displayName || "");
        setOrigName(u.displayName || "");
        // FIX BUG #5: Store unsub so we can cleanly tear it down
        unsubRef.current = setupListener(u.uid);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        // FIX BUG #4: Clear any lingering undo state on logout (cross-user safety)
        // (Profile doesn't have undo, but nulling userData protects downstream renders)
        unsubRef.current?.();
        unsubRef.current = null;
      }
    });
    // FIX BUG #5: Proper double-cleanup — both auth listener and Firestore listener
    return () => {
      unsub();
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [setupListener]);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) return toast.error("Name cannot be empty");
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), { name: displayName.trim(), updatedAt: serverTimestamp() });
      setOrigName(displayName.trim());
      setEditing(false);
      toast.success("Profile updated!");
    } catch (e) { toast.error("Failed to update profile"); }
  }, [user, displayName]);

  const handleCancelEdit = useCallback(() => { setDisplayName(origName); setEditing(false); }, [origName]);

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

  /* ─── Derived Data ─── */

  // FIX PERF #2 & #3: Separate fast-changing live state from stable derived data.
  // streak, heatmapData, and fieldStats only recompute on dailyStats changes,
  // not on every liveSessionSeconds tick.

  const streak = useMemo(() => calcStreak(userData?.dailyStats), [userData?.dailyStats]);

  // FIX PERF #4: heatmapData memoized — only recomputes when dailyStats changes
  const heatmapData = useMemo(() => getHeatmapData(userData?.dailyStats), [userData?.dailyStats]);

  const baseTimeStats = useMemo(() => deriveTimeStats(userData?.dailyStats), [userData?.dailyStats]);

  // Live stats layer on top of stable base — only liveSessionSeconds triggers this
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

  // Only include ACTIVE study fields to avoid showing removed fields
  const activeFieldSet = useMemo(() => {
    return new Set(userData?.studyFields || []);
  }, [userData?.studyFields]);

  // FIX PERF #3: fieldStats memoized on dailyStats + activeFieldSet, not live tick
  const fieldStatsBase = useMemo(() => {
    const totals = {};
    Object.values(userData?.dailyStats || {}).forEach((ds) => {
      Object.entries(ds.fieldTimes || {}).forEach(([field, secs]) => {
        if (!activeFieldSet.has(field)) return;
        if (typeof secs !== "number" || secs <= 0) return;
        totals[field] = (totals[field] || 0) + secs;
      });
    });
    return totals;
  }, [userData?.dailyStats, activeFieldSet]);

  // Apply live session on top of stable base
  const fieldStats = useMemo(() => {
    const totals = { ...fieldStatsBase };
    if (liveField && liveSessionSeconds > 0 && activeFieldSet.has(liveField)) {
      totals[liveField] = (totals[liveField] || 0) + liveSessionSeconds;
    }
    return Object.entries(totals)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [fieldStatsBase, liveField, liveSessionSeconds, activeFieldSet]);

  // FIX PERF #3: weekData base memoized separately from live seconds
  const weekDataBase = useMemo(() => getLast7Days(userData?.dailyStats), [userData?.dailyStats]);

  const weekData = useMemo(() => {
    const todayKey = localYMD();
    return weekDataBase.map((d) =>
      d.key === todayKey ? { ...d, seconds: d.seconds + liveSessionSeconds } : d
    );
  }, [weekDataBase, liveSessionSeconds]);

  const weekMaxSec = useMemo(() => Math.max(...weekData.map((d) => d.seconds), 1), [weekData]);

  // FIX PERF #3: weeklyData only recalculates when dailyStats changes
  const weeklyData = useMemo(() => getLast12Weeks(userData?.dailyStats), [userData?.dailyStats]);
  const weeklyMaxSec = useMemo(() => Math.max(...weeklyData.map((d) => d.seconds), 1), [weeklyData]);

  const avgDailyHours = useMemo(() => {
    const activeDays = heatmapData.filter((d) => d.seconds > 0).length;
    if (!activeDays) return 0;
    return (timeStats.allTime / 3600) / activeDays;
  }, [heatmapData, timeStats.allTime]);

  const donutSegments = useMemo(
    () => fieldStats.slice(0, 6).map(([label, value]) => ({ label, value })),
    [fieldStats]
  );
  const sparklineData = useMemo(() => weekData.map((d) => d.seconds), [weekData]);

  // Recent activity
  const activity = useMemo(() => {
    if (!userData?.dailyStats) return [];
    return Object.entries(userData.dailyStats)
      .filter(([, s]) => s?.totalTime > 0)
      .map(([date, s]) => ({
        date,
        totalTime: s.totalTime + (date === localYMD() ? liveSessionSeconds : 0),
        sessions: s.sessionsCount || 0,
        fields: Object.keys(s.fieldTimes || {}).length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }, [userData?.dailyStats, liveSessionSeconds]);

  /* ─── Loading Skeleton ─── */
  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          {[200, 160, 200, 140, 180].map((h, i) => (
            <div key={i} className="skeleton-card" style={{ height: h }} />
          ))}
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

      <div className="profile-container">

        {/* ════ HERO HEADER ════ */}
        <motion.div className="glass-card profile-hero" {...fadeUp} transition={{ duration: 0.4 }}>
          <div className="hero-bg-pattern" />
          <div className="hero-inner">
            <div className="avatar-zone">
              <div className="avatar-glow" />
              <div className="avatar">{initials}</div>
              <div className={`avatar-status${isLive ? " studying" : ""}`}
                title={isLive ? "Currently studying" : "Online"} />
            </div>

            <div className="hero-info">
              {editing ? (
                <div className="edit-mode">
                  <input className="edit-name-input" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
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
                    <button className="edit-btn" onClick={() => setEditing(true)} title="Edit name">✏️</button>
                  </div>
                  <p className="hero-email">{user.email}</p>
                  <div className="hero-chips">
                    {userData?.createdAt && <span className="chip">📅 Joined {formatDate(userData.createdAt)}</span>}
                    {userData?.lastStudyDate && <span className="chip">⚡ Active {formatDate(userData.lastStudyDate)}</span>}
                    <span className="chip">📚 {userData?.studyFields?.length || 0} fields</span>
                    {isLive && <span className="chip chip-live">🟢 Studying: {liveField}</span>}
                  </div>
                </>
              )}
            </div>

            <div className="hero-metrics">
              {[
                { icon: "🔥", val: <AnimatedNumber value={streak} />, lbl: "Day Streak" },
                { icon: "⏱️", val: formatHours(timeStats.allTime), lbl: "All-Time" },
                { icon: "✅", val: <><AnimatedNumber value={completionRate} />%</>, lbl: "Tasks Done" },
              ].map(({ icon, val, lbl }) => (
                <div key={lbl} className="metric-pill">
                  <span className="metric-icon">{icon}</span>
                  <div>
                    <div className="metric-val">{val}</div>
                    <div className="metric-lbl">{lbl}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ════ SCORE + STUDY TIME ════ */}
        <div className="two-col-grid">
          <motion.div className="glass-card section-card score-card" {...fadeUp} transition={{ delay: 0.08 }}>
            <div className="section-title">
              <span>🏆</span> Productivity Score
              {isLive && <span className="live-badge">LIVE</span>}
            </div>
            <ProductivityScore streak={streak} avgDailyHours={avgDailyHours} completionRate={completionRate} />
          </motion.div>

          <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.10 }}>
            <div className="section-title">
              <span>⏰</span> Study Time
              {isLive && <span className="live-badge">LIVE</span>}
            </div>
            <div className="time-pills">
              {[
                { label: "Today", val: timeStats.today, icon: "🌅", color: "#a855f7" },
                { label: "This Week", val: timeStats.week, icon: "📆", color: "#3b82f6" },
                { label: "This Month", val: timeStats.month, icon: "🗓️", color: "#10b981" },
                { label: "All Time", val: timeStats.allTime, icon: "🏅", color: "#f59e0b" },
              ].map(({ label, val, icon, color }) => (
                <div key={label} className="time-pill">
                  <div className="time-pill-icon" style={{ color }}>{icon}</div>
                  <div className="time-pill-body">
                    <div className="time-pill-val" style={{ color }}>{formatTime(val)}</div>
                    <div className="time-pill-lbl">{label}</div>
                  </div>
                  <div className="time-pill-spark">
                    <Sparkline data={sparklineData} color={color} width={56} height={26} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ════ STUDY INSIGHTS ════ */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.12 }}>
          <div className="section-title">
            <span>💡</span> Study Insights
          </div>
          <ProfileInsightCards userData={userData} />
        </motion.div>

        {/* ════ BAR CHART ════ */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.14 }}>
          <div className="section-header">
            <div className="section-title">
              <span>📊</span> Study Activity
              {isLive && <span className="live-badge">LIVE</span>}
            </div>
            <div className="chart-tabs">
              {[["week", "7 Days"], ["month", "12 Weeks"]].map(([v, lbl]) => (
                <button key={v} className={`chart-tab ${chartView === v ? "active" : ""}`}
                  onClick={() => setChartView(v)}>{lbl}</button>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            {chartView === "week" ? (
              <motion.div key="week" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <BarChart data={weekData} maxVal={weekMaxSec} color="#a855f7" />
              </motion.div>
            ) : (
              <motion.div key="month" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <BarChart data={weeklyData} maxVal={weeklyMaxSec} color="#3b82f6" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ════ HEATMAP ════ */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.18 }}>
          <div className="section-title"><span>🗓️</span> Year Activity Heatmap</div>
          <ActivityHeatmap data={heatmapData} />
        </motion.div>

        {/* ════ FIELDS BREAKDOWN ════ */}
        {fieldStats.length > 0 && (
          <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.22 }}>
            <div className="section-title">
              <span>🎓</span> Study Fields Breakdown
              {isLive && liveField && <span className="live-badge">LIVE — {liveField}</span>}
            </div>
            <div className="fields-layout">
              <div className="donut-side">
                <DonutChart segments={donutSegments} size={200} />
              </div>
              <div className="field-bars-side">
                <motion.div className="field-list" variants={staggerList} initial="initial" animate="animate">
                  {fieldStats.slice(0, 8).map(([field, time], idx) => {
                    const pct = (time / fieldStats[0][1]) * 100;
                    const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                    const isActive = field === liveField && isLive;
                    return (
                      <motion.div key={field}
                        className={`field-row${isActive ? " field-row-live" : ""}`}
                        variants={rowVariant}>
                        <div className="field-rank" style={{ color }}>{idx + 1}</div>
                        <div className="field-info">
                          <div className="field-name-row">
                            <span className="field-name">
                              {isActive && <span className="field-live-dot" />}
                              {field}
                            </span>
                            <span className="field-time-badge"
                              style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                              {formatHours(time)}
                            </span>
                          </div>
                          <div className="field-bar-track">
                            <motion.div className="field-bar-fill"
                              style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.9, delay: idx * 0.07, ease: [0.34, 1.56, 0.64, 1] }} />
                          </div>
                        </div>
                        <div className="field-exact">{formatTime(time)}</div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════ TASK PERFORMANCE ════ */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.26 }}>
          <div className="section-title"><span>🎯</span> Task Performance</div>
          <div className="task-viz">
            <div className="task-radials">
              <div className="task-radial-item">
                <RadialProgress value={taskStats.completed} max={taskStats.total || 1}
                  size={110} stroke={10} color="#10b981"
                  label={<AnimatedNumber value={taskStats.completed} />} sublabel="Done" />
              </div>
              <div className="task-radial-item">
                <RadialProgress value={taskStats.pending} max={taskStats.total || 1}
                  size={110} stroke={10} color="#f59e0b"
                  label={<AnimatedNumber value={taskStats.pending} />} sublabel="Pending" />
              </div>
              <div className="task-radial-item">
                <RadialProgress value={completionRate} max={100}
                  size={110} stroke={10} color="#a855f7"
                  label={<><AnimatedNumber value={completionRate} />%</>} sublabel="Rate" />
              </div>
            </div>
            <div className="task-progress-section">
              <div className="task-progress-header">
                <span className="task-progress-lbl">Completion Progress</span>
                <span className="task-progress-count">{taskStats.completed} / {taskStats.total} tasks</span>
              </div>
              <div className="task-progress-track">
                <motion.div className="task-progress-fill"
                  initial={{ width: 0 }} animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }} />
                {completionRate > 0 && (
                  <div className="task-progress-glow" style={{ left: `${completionRate}%` }} />
                )}
              </div>
              <div className="task-progress-ticks">
                {[0, 25, 50, 75, 100].map((v) => (
                  <div key={v} className="task-tick">
                    <div className="tick-mark" />
                    <div className="tick-label">{v}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ════ RECENT ACTIVITY ════ */}
        {activity.length > 0 && (
          <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.30 }}>
            <div className="section-title"><span>📅</span> Recent Activity</div>
            <motion.div className="activity-list" variants={staggerList} initial="initial" animate="animate">
              {activity.map((a) => {
                // FIX BUG #9: noon anchor for DST safety
                const d = new Date(a.date + "T12:00:00");
                const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
                const barWidth = Math.min(a.totalTime / 14400, 1) * 100;
                const isToday = a.date === localYMD();
                return (
                  <motion.div key={a.date}
                    className={`activity-row${isToday && isLive ? " activity-row-live" : ""}`}
                    variants={rowVariant}>
                    <div className="activity-date-block">
                      <div className="activity-day">{isToday ? "Today" : dayLabel}</div>
                      <div className="activity-date">{dateLabel}</div>
                    </div>
                    <div className="activity-bar-col">
                      <motion.div className="activity-bar"
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                        style={{ width: `${barWidth}%`, transformOrigin: "left" }}
                        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }} />
                    </div>
                    <div className="activity-right">
                      <span className="activity-time">{formatTime(a.totalTime)}</span>
                      <span className="activity-meta">{a.sessions}s · {a.fields}f</span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}

        {/* ════ ACCOUNT / DANGER ZONE ════ */}
        <motion.div className="glass-card danger-section" {...fadeUp} transition={{ delay: 0.34 }}>
          <div className="section-title"><span>⚙️</span> Account Management</div>
          <div className="danger-box">
            <div className="danger-title">⚠️ Danger Zone</div>
            <p className="danger-desc">Permanently deletes your account and all study data. Cannot be undone.</p>
            <button className="btn-danger" onClick={() => setShowDelete(true)}>Delete My Account</button>
          </div>
        </motion.div>
      </div>

      {/* ════ DELETE MODAL ════ */}
      <AnimatePresence>
        {showDelete && (
          <motion.div className="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !isDeleting && setShowDelete(false)}>
            <motion.div className="modal-box"
              initial={{ opacity: 0, scale: 0.88, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
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
                    onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE"
                    disabled={isDeleting} />
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