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

const staggerList = {
  animate: { transition: { staggerChildren: 0.07 } },
};

const rowVariant = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
};

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
  const h = (s / 3600).toFixed(1);
  return `${h}h`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function calcStreak(dailyStats) {
  if (!dailyStats) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (dailyStats[key]?.totalTime > 0) streak++;
    else break;
  }
  return streak;
}

function getLast7Days(dailyStats) {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({
      key,
      label,
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
    for (let d = 0; d < 7; d++) {
      const day = new Date(today);
      day.setDate(today.getDate() - w * 7 - d);
      const key = day.toISOString().split("T")[0];
      total += dailyStats?.[key]?.totalTime || 0;
    }
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - w * 7);
    weeks.push({
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      seconds: total,
    });
  }
  return weeks;
}

function getHeatmapData(dailyStats) {
  const data = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    data.push({ key, seconds: dailyStats?.[key]?.totalTime || 0 });
  }
  return data;
}

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, suffix = "", decimals = 0 }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = null;
    const duration = 1200;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayed(+(value * ease).toFixed(decimals));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, decimals]);
  return <>{displayed}{suffix}</>;
}

/* ─── Radial Progress Ring ─── */
function RadialProgress({ value, max = 100, size = 120, stroke = 10, color = "#a855f7", label, sublabel }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1000, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setAnimated(ease * pct);
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [pct]);

  const dash = animated * circ;

  return (
    <div className="radial-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
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
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={d.key || i}
              className="barchart-col"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && d.seconds > 0 && (
                <motion.div
                  className="bar-tooltip"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <strong>{formatHours(d.seconds)}</strong>
                  {d.sessions !== undefined && <span>{d.sessions} sessions</span>}
                </motion.div>
              )}
              <div className="bar-outer">
                <motion.div
                  className="bar-fill"
                  style={{ background: isHovered ? "#c084fc" : color }}
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                />
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
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`)
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Donut Chart ─── */
const DONUT_COLORS = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

function DonutChart({ segments, size = 200 }) {
  const [hovered, setHovered] = useState(null);
  const [animated, setAnimated] = useState(0);
  const r = size / 2 - 30;
  const circ = 2 * Math.PI * r;
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
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={isHov ? 22 : 16}
              strokeLinecap="round"
              style={{
                cursor: "pointer",
                filter: isHov ? `drop-shadow(0 0 10px ${color}90)` : "none",
                transformOrigin: `${cx}px ${cy}px`,
                transform: isHov ? "scale(1.06)" : "scale(1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(i)}
              onTouchEnd={() => setHovered(null)}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 22} fill="rgba(168,85,247,0.05)" stroke="rgba(168,85,247,0.15)" strokeWidth="1" />
        {hovered !== null && segments[hovered] ? (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="15" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {formatHours(segments[hovered].value)}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="Inter, sans-serif">
              {(segments[hovered].label || "").slice(0, 14)}
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fill="#c084fc" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
              {segments.length} fields
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="Inter, sans-serif">hover to explore</text>
          </>
        )}
      </svg>
      <div className="donut-legend">
        {segments.slice(0, 6).map((seg, i) => {
          const color = DONUT_COLORS[i % DONUT_COLORS.length];
          return (
            <div
              key={i}
              className={`donut-legend-item ${hovered === i ? "active" : ""}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
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

  const weeks = [];
  let week = [];
  data.forEach((d) => {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length) weeks.push(week);

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const m = new Date(w[0].key + "T00:00:00").getMonth();
    if (m !== lastMonth) { monthLabels.push({ idx: wi, label: months[m] }); lastMonth = m; }
  });

  return (
    <div className="heatmap-scroll-outer">
      <div className="heatmap-wrap">
        <div className="heatmap-month-row">
          {monthLabels.map((ml) => (
            <div key={ml.label + ml.idx} className="heatmap-month-label" style={{ gridColumn: ml.idx + 1 }}>
              {ml.label}
            </div>
          ))}
        </div>
        <div className="heatmap-grid">
          {weeks.map((w, wi) => (
            <div key={wi} className="heatmap-col">
              {w.map((day) => (
                <div
                  key={day.key}
                  className={`heatmap-cell ${hovered?.key === day.key ? "heatmap-cell-hov" : ""}`}
                  style={{ background: getColor(day.seconds) }}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                />
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
      <RadialProgress
        value={score}
        max={100}
        size={140}
        stroke={12}
        color={gradeColor}
        label={<><AnimatedNumber value={score} /><span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>/100</span></>}
        sublabel="Score"
      />
      <div className="score-grade" style={{ color: gradeColor, textShadow: `0 0 20px ${gradeColor}60` }}>
        {grade}
      </div>
      <div className="score-breakdown">
        <div className="score-row"><span>🔥 Streak</span><span style={{ color: "#c084fc" }}>{streak}d</span></div>
        <div className="score-row"><span>📈 Daily avg</span><span style={{ color: "#c084fc" }}>{avgDailyHours.toFixed(1)}h</span></div>
        <div className="score-row"><span>✅ Tasks</span><span style={{ color: "#c084fc" }}>{completionRate}%</span></div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PROFILE COMPONENT
═══════════════════════════════════════════════ */
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

  const unsubRef = useRef(null);

  const setupListener = useCallback((uid) => {
    const ref = doc(db, "users", uid);
    return onSnapshot(ref, (snap) => {
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
        unsubRef.current = setupListener(u.uid);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        unsubRef.current?.();
      }
    });
    return () => { unsub(); unsubRef.current?.(); };
  }, [setupListener]);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) return toast.error("Name cannot be empty");
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), { name: displayName.trim(), updatedAt: serverTimestamp() });
      setOrigName(displayName.trim());
      setEditing(false);
      toast.success("Profile updated!");
    } catch (e) {
      toast.error("Failed to update profile");
    }
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
    } finally {
      setIsDeleting(false);
    }
  }, [user, delPass, delConfirm]);

  /* ─── Derived Data ─── */
  const streak = useMemo(() => calcStreak(userData?.dailyStats), [userData?.dailyStats]);
  const timeStats = useMemo(() => ({
    today: userData?.totalTimeToday || 0,
    week: userData?.totalTimeWeek || 0,
    month: userData?.totalTimeMonth || 0,
    allTime: userData?.totalTimeAllTime || 0,
  }), [userData]);

  const taskStats = useMemo(() => {
    const list = userData?.todoList || [];
    const completed = list.filter((t) => t.completed).length;
    return { total: list.length, completed, pending: list.length - completed };
  }, [userData?.todoList]);

  const completionRate = useMemo(() => {
    if (!taskStats.total) return 0;
    return Math.round((taskStats.completed / taskStats.total) * 100);
  }, [taskStats]);

  const fieldStats = useMemo(() => {
    if (!userData?.fieldTimes) return [];
    return Object.entries(userData.fieldTimes)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [userData?.fieldTimes]);

  const weekData = useMemo(() => getLast7Days(userData?.dailyStats), [userData?.dailyStats]);
  const weekMaxSec = useMemo(() => Math.max(...weekData.map((d) => d.seconds), 1), [weekData]);
  const weeklyData = useMemo(() => getLast12Weeks(userData?.dailyStats), [userData?.dailyStats]);
  const weeklyMaxSec = useMemo(() => Math.max(...weeklyData.map((d) => d.seconds), 1), [weeklyData]);
  const heatmapData = useMemo(() => getHeatmapData(userData?.dailyStats), [userData?.dailyStats]);

  const avgDailyHours = useMemo(() => {
    const activeDays = heatmapData.filter((d) => d.seconds > 0).length;
    if (!activeDays) return 0;
    return (timeStats.allTime / 3600) / activeDays;
  }, [heatmapData, timeStats.allTime]);

  const donutSegments = useMemo(() =>
    fieldStats.slice(0, 6).map(([label, value]) => ({ label, value })),
    [fieldStats]
  );

  const sparklineData = useMemo(() => weekData.map((d) => d.seconds), [weekData]);

  const activity = useMemo(() => {
    if (!userData?.dailyStats) return [];
    return Object.entries(userData.dailyStats)
      .filter(([, s]) => s?.totalTime > 0)
      .map(([date, s]) => ({
        date,
        totalTime: s.totalTime,
        sessions: s.sessionsCount || 0,
        fields: Object.keys(s.fieldTimes || {}).length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }, [userData?.dailyStats]);

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
              <div className="avatar-status" title="Online" />
            </div>

            <div className="hero-info">
              {editing ? (
                <div className="edit-mode">
                  <input
                    className="edit-name-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancelEdit(); }}
                    autoFocus
                    placeholder="Your display name"
                  />
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
              <span className="live-badge">LIVE</span>
            </div>
            <ProductivityScore streak={streak} avgDailyHours={avgDailyHours} completionRate={completionRate} />
          </motion.div>

          <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.10 }}>
            <div className="section-title"><span>⏰</span> Study Time</div>
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

        {/* ════ BAR CHART ════ */}
        <motion.div className="glass-card section-card" {...fadeUp} transition={{ delay: 0.14 }}>
          <div className="section-header">
            <div className="section-title"><span>📊</span> Study Activity</div>
            <div className="chart-tabs">
              {[["week", "7 Days"], ["month", "12 Weeks"]].map(([v, lbl]) => (
                <button key={v} className={`chart-tab ${chartView === v ? "active" : ""}`} onClick={() => setChartView(v)}>
                  {lbl}
                </button>
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
                <BarChart
                  data={weeklyData.map((w) => ({ ...w, label: w.label.split(" ")[0] }))}
                  maxVal={weeklyMaxSec}
                  color="#3b82f6"
                />
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
            <div className="section-title"><span>🎓</span> Study Fields Breakdown</div>
            <div className="fields-layout">
              <div className="donut-side">
                <DonutChart segments={donutSegments} size={200} />
              </div>
              <div className="field-bars-side">
                <motion.div className="field-list" variants={staggerList} initial="initial" animate="animate">
                  {fieldStats.slice(0, 8).map(([field, time], idx) => {
                    const pct = (time / fieldStats[0][1]) * 100;
                    const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                    return (
                      <motion.div key={field} className="field-row" variants={rowVariant}>
                        <div className="field-rank" style={{ color }}>{idx + 1}</div>
                        <div className="field-info">
                          <div className="field-name-row">
                            <span className="field-name">{field}</span>
                            <span className="field-time-badge" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                              {formatHours(time)}
                            </span>
                          </div>
                          <div className="field-bar-track">
                            <motion.div
                              className="field-bar-fill"
                              style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.9, delay: idx * 0.07, ease: [0.34, 1.56, 0.64, 1] }}
                            />
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
                <RadialProgress value={taskStats.completed} max={taskStats.total || 1} size={110} stroke={10} color="#10b981"
                  label={<AnimatedNumber value={taskStats.completed} />} sublabel="Done" />
              </div>
              <div className="task-radial-item">
                <RadialProgress value={taskStats.pending} max={taskStats.total || 1} size={110} stroke={10} color="#f59e0b"
                  label={<AnimatedNumber value={taskStats.pending} />} sublabel="Pending" />
              </div>
              <div className="task-radial-item">
                <RadialProgress value={completionRate} max={100} size={110} stroke={10} color="#a855f7"
                  label={<><AnimatedNumber value={completionRate} />%</>} sublabel="Rate" />
              </div>
            </div>
            <div className="task-progress-section">
              <div className="task-progress-header">
                <span className="task-progress-lbl">Completion Progress</span>
                <span className="task-progress-count">{taskStats.completed} / {taskStats.total} tasks</span>
              </div>
              <div className="task-progress-track">
                <motion.div
                  className="task-progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                />
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
                const d = new Date(a.date + "T00:00:00");
                const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
                const barWidth = Math.min(a.totalTime / 14400, 1) * 100;
                return (
                  <motion.div key={a.date} className="activity-row" variants={rowVariant}>
                    <div className="activity-date-block">
                      <div className="activity-day">{dayLabel}</div>
                      <div className="activity-date">{dateLabel}</div>
                    </div>
                    <div className="activity-bar-col">
                      <motion.div
                        className="activity-bar"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        style={{ width: `${barWidth}%`, transformOrigin: "left" }}
                        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                      />
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
            <p className="danger-desc">
              Permanently deletes your account and all study data, flashcards, notes, and statistics. Cannot be undone.
            </p>
            <button className="btn-danger" onClick={() => setShowDelete(true)}>Delete My Account</button>
          </div>
        </motion.div>

      </div>

      {/* ════ DELETE MODAL ════ */}
      <AnimatePresence>
        {showDelete && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <p className="modal-warn">This will permanently delete your account and ALL data. This cannot be undone.</p>
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