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
} from "firebase/firestore";
import { auth, db } from "../components/firebase";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import clockAnimation from "../assets/3d-clock-animation.json";
import "./Session.css";

/* ─── Framer Motion Variants ─── */
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const cardVariant = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring", stiffness: 280, damping: 26 },
  },
};

const overlayVariant = {
  initial: { opacity: 0, y: 32, scale: 0.96 },
  animate: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring", stiffness: 340, damping: 30 },
  },
  exit: {
    opacity: 0, y: 20, scale: 0.97,
    transition: { duration: 0.2 },
  },
};

/* ─── Helpers ─── */
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
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// All date helpers use LOCAL time to avoid UTC drift bugs
function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localYM(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
// ISO week (Monday-based)
function localISOWeek(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/* ─── Insights Hook ─── */
function useInsights(userData, isRunning, liveSessionSeconds) {
  return useMemo(() => {
    const ds = userData?.dailyStats || {};
    const entries = Object.entries(ds).filter(([, s]) => (s?.totalTime || 0) > 0);

    /* ─── Best Study Hour ─── */
    const hourlyTotals = Array(24).fill(0);
    const hourlyDays = Array(24).fill(0);

    entries.forEach(([, stats]) => {
      const hourly = stats.hourly || {};
      Object.entries(hourly).forEach(([h, secs]) => {
        const hour = parseInt(h, 10);
        if (secs > 0) {
          hourlyTotals[hour] += secs;
          hourlyDays[hour] += 1;
        }
      });
    });

    // Add live session to current hour
    if (isRunning && liveSessionSeconds > 0) {
      const currentHour = new Date().getHours();
      hourlyTotals[currentHour] += liveSessionSeconds;
    }

    let bestHour = -1;
    let bestHourAvg = 0;
    hourlyTotals.forEach((total, hour) => {
      if (hourlyDays[hour] > 0) {
        const avg = total / hourlyDays[hour];
        if (avg > bestHourAvg) {
          bestHourAvg = avg;
          bestHour = hour;
        }
      }
    });

    const fmt12 = (h) => {
      if (h === 0) return "12:00 AM";
      if (h < 12) return `${h}:00 AM`;
      if (h === 12) return "12:00 PM";
      return `${h - 12}:00 PM`;
    };

    /* ─── Most Productive Day ─── */
    const dowTotals = Array(7).fill(0);
    const dowCounts = Array(7).fill(0);

    entries.forEach(([date, stats]) => {
      const d = new Date(date + "T12:00:00");
      const dow = d.getDay();
      const dayTotal = stats?.totalTime || 0;
      dowTotals[dow] += dayTotal;
      dowCounts[dow] += 1;
    });

    // Add live session to today's DOW
    if (isRunning && liveSessionSeconds > 0) {
      const todayDow = new Date().getDay();
      dowTotals[todayDow] += liveSessionSeconds;
    }

    let bestDow = -1;
    let bestDowAvg = 0;
    dowTotals.forEach((total, dow) => {
      if (dowCounts[dow] > 0) {
        const avg = total / dowCounts[dow];
        if (avg > bestDowAvg) {
          bestDowAvg = avg;
          bestDow = dow;
        }
      }
    });

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    /* ─── Focus Score (pomodoro-based) ─── */
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
  }, [userData, isRunning, liveSessionSeconds]);
}

/* ─── Hourly Histogram ─── */
function HourHistogram({ dailyStats, liveSeconds, isRunning }) {
  const todayKey = localYMD();
  const todayData = dailyStats?.[todayKey] || {};
  const curHour = new Date().getHours();

  const hours = useMemo(() => {
    const hourly = todayData?.hourly || {};
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
      seconds: hourly[String(i).padStart(2, "0")] || 0,
    }));
  }, [todayData]);

  const maxVal = useMemo(() => {
    const vals = hours.map((h) =>
      h.hour === curHour && isRunning ? h.seconds + liveSeconds : h.seconds
    );
    return Math.max(...vals, 1);
  }, [hours, curHour, isRunning, liveSeconds]);

  return (
    <div className="histogram-wrap">
      <div className="histogram-bars">
        {hours.map((h) => {
          const isLive = h.hour === curHour && isRunning;
          const secs = isLive ? h.seconds + liveSeconds : h.seconds;
          const pct = Math.min((secs / maxVal) * 100, 100);
          return (
            <div key={h.hour} className="histo-col">
              <div className="histo-bar-track">
                <motion.div
                  className={`histo-bar${h.hour === curHour ? " current" : ""}${isLive ? " live" : ""}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, secs > 0 ? 4 : 0)}%` }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  title={`${h.label}: ${fmtMins(secs)}`}
                />
              </div>
              {h.hour % 6 === 0 && <div className="histo-label">{h.label}</div>}
            </div>
          );
        })}
      </div>
      <div className="histogram-legend">
        <span className="hleg-dot current" /> Now
        <span className="hleg-dot live" style={{ marginLeft: "1rem" }} /> Live
      </div>
    </div>
  );
}

/* ─── Field Breakdown ─── */
function FieldBreakdown({ fieldTimes, totalTime }) {
  const sorted = useMemo(() => {
    if (!fieldTimes) return [];
    return Object.entries(fieldTimes)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [fieldTimes]);
  const COLORS = ["#a855f7", "#34d399", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#38bdf8"];
  if (!sorted.length)
    return <div className="empty-state-sm">No study time yet today!</div>;
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
              <motion.div className="fb-bar"
                style={{ background: COLORS[i % COLORS.length] }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: i * 0.07 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Insight Cards ─── */
function InsightCards({ insights }) {
  const cards = [
    {
      icon: "🕐",
      label: "Best Study Hour",
      value: insights.bestHour || "—",
      sub: insights.bestHour
        ? `avg ${insights.bestHourAvg.toFixed(1)}h per session`
        : "Keep studying to unlock",
      hasBar: false,
    },
    {
      icon: "📅",
      label: "Most Productive Day",
      value: insights.mostProductiveDayShort || "—",
      sub: insights.mostProductiveDay
        ? `${insights.mostProductiveDayAvg.toFixed(1)}h avg · ${insights.mostProductiveDay}`
        : "Need more data",
      hasBar: false,
    },
    {
      icon: "🎯",
      label: "Focus Score",
      value: insights.focusScore !== null ? `${insights.focusScore}%` : "—",
      sub: insights.focusScore !== null
        ? `${insights.pomodorosCompleted} done · ${insights.pomodorosAborted} cut short`
        : "Complete Pomodoros to track",
      hasBar: insights.focusScore !== null,
      barValue: insights.focusScore || 0,
    },
  ];

  return (
    <div className="ss-insights-grid">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          className="ss-insight-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 24 }}
        >
          <div className="ss-insight-icon">{card.icon}</div>
          <div className="ss-insight-label">{card.label}</div>
          <div className="ss-insight-value">{card.value}</div>
          <div className="ss-insight-sub">{card.sub}</div>
          {card.hasBar && (
            <div className="ss-insight-bar">
              <motion.div
                className="ss-insight-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${card.barValue}%` }}
                transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN SESSION COMPONENT
══════════════════════════════════════════════ */
export default function StartSession() {
  /* ─ Auth & data ─ */
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ─ Timer state ─ */
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [pomodoroRounds, setPomodoroRounds] = useState(0);
  const [isBreak, setIsBreak] = useState(false);

  /* ─ Strict Mode ─ */
  const [strictMode, setStrictMode] = useState(false);

  /* ─ Fields ─ */
  const [selectedField, setSelectedField] = useState("General");
  const [newFieldName, setNewFieldName] = useState("");
  const [removeModal, setRemoveModal] = useState({ open: false, field: null, keepTime: false });

  /* ─ Tasks ─ */
  const [todoList, setTodoList] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [editingTask, setEditingTask] = useState({ id: null, text: "" });
  const [lastDeleted, setLastDeleted] = useState(null);

  /* ─ Active panel ─ */
  const [activePanel, setActivePanel] = useState(null);
  const [navWarning, setNavWarning] = useState({ open: false, cb: null });

  /* ─── Core timer refs ─── */
  const sessionStartWallTimeRef = useRef(null);
  const sessionStartDateRef = useRef(null);
  const accumulatedSecondsRef = useRef(0);
  const isRunningRef = useRef(false);
  const pomodoroModeRef = useRef(false);
  const selectedFieldRef = useRef("General");
  const strictModeRef = useRef(false);
  const userRef = useRef(null);
  const unsubRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const checkpointIntervalRef = useRef(null);
  // Track completed pomodoro rounds to detect new completions
  const completedPomodorosInSessionRef = useRef(0);

  // FIX BUG #2: Guard to prevent concurrent day-boundary saves
  const isSavingDayBoundaryRef = useRef(false);

  // FIX BUG #7: Exponential backoff state for checkpoint failures
  const checkpointBackoffRef = useRef(1000); // start at 1s, double on fail, cap at 60s

  // Keep refs in sync
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { pomodoroModeRef.current = pomodoroMode; }, [pomodoroMode]);
  useEffect(() => { selectedFieldRef.current = selectedField; }, [selectedField]);
  useEffect(() => { strictModeRef.current = strictMode; }, [strictMode]);

  /* ─── Compute elapsed seconds for current segment ─── */
  const getSegmentSeconds = useCallback(() => {
    if (!sessionStartWallTimeRef.current) return 0;
    return Math.floor((Date.now() - sessionStartWallTimeRef.current) / 1000);
  }, []);

  /* ─── Total session seconds ─── */
  const getTotalSessionSeconds = useCallback(() => {
    return accumulatedSecondsRef.current + getSegmentSeconds();
  }, [getSegmentSeconds]);

  /* ═══ Wake Lock ═══ */
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
      if (document.visibilityState === "visible" && isRunningRef.current) {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestWakeLock]);

  /* ═══ beforeunload ═══ */
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

  /* ═══ Strict mode — FIX BUG #6: Use grace period instead of instant trigger ═══ */
  const stopTimerRef = useRef(null);
  const strictGraceTimerRef = useRef(null);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!isRunningRef.current || !strictModeRef.current) return;

      if (document.hidden) {
        // Start a 2-second grace period before triggering strict mode
        strictGraceTimerRef.current = setTimeout(() => {
          // Re-check: user might have come back within the grace period
          if (document.hidden && isRunningRef.current && strictModeRef.current) {
            toast.error("🔒 Strict mode: You left the tab! Timer paused.", { duration: 4000 });
            stopTimerRef.current?.();
          }
        }, 2000);
      } else {
        // User returned within grace period — cancel the pending stop
        if (strictGraceTimerRef.current) {
          clearTimeout(strictGraceTimerRef.current);
          strictGraceTimerRef.current = null;
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (strictGraceTimerRef.current) clearTimeout(strictGraceTimerRef.current);
    };
  }, []);

  /* ═══ Real-time Firestore listener ═══ */
  const setupListener = useCallback((uid) => {
    const ref = doc(db, "users", uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setTodoList(data.todoList || []);
        const fields = data.studyFields || ["General"];
        setSelectedField((prev) => {
          const valid = fields.includes(prev) ? prev : fields[0] || "General";
          selectedFieldRef.current = valid;
          return valid;
        });
      } else {
        initDoc(uid);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error("Database connection error");
      setLoading(false);
    });
  }, []); // eslint-disable-line

  const initDoc = useCallback(async (uid) => {
    const dk = localYMD(); const wk = localISOWeek(); const mk = localYM();
    const base = {
      email: auth.currentUser?.email || "",
      name: auth.currentUser?.displayName || "User",
      createdAt: serverTimestamp(),
      todoList: [],
      studyFields: ["General"],
      fieldTimes: {},
      totalTimeToday: 0, totalTimeWeek: 0, totalTimeMonth: 0, totalTimeAllTime: 0,
      lastStudyDate: null, lastStudyDateKey: null,
      pomodorosCompleted: 0,
      pomodorosAborted: 0,
      dailyStats: { [dk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0, hourly: {} } },
      weeklyStats: { [wk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
      monthlyStats: { [mk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
    };
    try { await setDoc(doc(db, "users", uid), base); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        userRef.current = u;
        unsubRef.current = setupListener(u.uid);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        // FIX BUG #4: Clear undo state on logout to prevent cross-user leakage
        setLastDeleted(null);
        unsubRef.current?.();
      }
    });
    // FIX BUG #5: Proper cleanup — unsub the auth listener and Firestore listener
    return () => {
      unsub();
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [setupListener]);

  /* ═══ Save session chunk ═══ */
  const saveSessionChunk = useCallback(async (
    sessionSeconds, dateKey, weekKey, monthKey, field, hourKey,
    isCheckpoint = false, completedPomodoros = 0, abortedPomodoros = 0
  ) => {
    if (!userRef.current || sessionSeconds <= 0) return;
    const uid = userRef.current.uid;
    const userDocRef = doc(db, "users", uid);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userDocRef);
      if (!snap.exists()) return;
      const data = snap.data();

      const todayKey = localYMD();
      const effectiveDateKey = dateKey || todayKey;
      const effectiveWeekKey = weekKey || localISOWeek();
      const effectiveMonthKey = monthKey || localYM();
      const currentWeekKey = localISOWeek();
      const currentMonthKey = localYM();

      const prevDayTotal = data.dailyStats?.[effectiveDateKey]?.totalTime || 0;
      const prevDayField = data.dailyStats?.[effectiveDateKey]?.fieldTimes?.[field] || 0;
      const prevHourSecs = data.dailyStats?.[effectiveDateKey]?.hourly?.[hourKey] || 0;
      const prevSessions = data.dailyStats?.[effectiveDateKey]?.sessionsCount || 0;

      const updates = {
        [`fieldTimes.${field}`]: (data.fieldTimes?.[field] || 0) + sessionSeconds,
        totalTimeAllTime: (data.totalTimeAllTime || 0) + sessionSeconds,
        [`dailyStats.${effectiveDateKey}.totalTime`]: prevDayTotal + sessionSeconds,
        [`dailyStats.${effectiveDateKey}.fieldTimes.${field}`]: prevDayField + sessionSeconds,
        [`dailyStats.${effectiveDateKey}.hourly.${hourKey}`]: prevHourSecs + sessionSeconds,
        [`dailyStats.${effectiveDateKey}.sessionsCount`]: prevSessions + (isCheckpoint ? 0 : 1),
        [`weeklyStats.${effectiveWeekKey}.totalTime`]: (data.weeklyStats?.[effectiveWeekKey]?.totalTime || 0) + sessionSeconds,
        [`weeklyStats.${effectiveWeekKey}.fieldTimes.${field}`]: (data.weeklyStats?.[effectiveWeekKey]?.fieldTimes?.[field] || 0) + sessionSeconds,
        [`weeklyStats.${effectiveWeekKey}.sessionsCount`]: (data.weeklyStats?.[effectiveWeekKey]?.sessionsCount || 0) + (isCheckpoint ? 0 : 1),
        [`monthlyStats.${effectiveMonthKey}.totalTime`]: (data.monthlyStats?.[effectiveMonthKey]?.totalTime || 0) + sessionSeconds,
        [`monthlyStats.${effectiveMonthKey}.fieldTimes.${field}`]: (data.monthlyStats?.[effectiveMonthKey]?.fieldTimes?.[field] || 0) + sessionSeconds,
        [`monthlyStats.${effectiveMonthKey}.sessionsCount`]: (data.monthlyStats?.[effectiveMonthKey]?.sessionsCount || 0) + (isCheckpoint ? 0 : 1),
        lastStudyDate: serverTimestamp(),
        lastStudyDateKey: effectiveDateKey,
      };

      // Pomodoro tracking
      if (completedPomodoros > 0) {
        updates.pomodorosCompleted = (data.pomodorosCompleted || 0) + completedPomodoros;
      }
      if (abortedPomodoros > 0) {
        updates.pomodorosAborted = (data.pomodorosAborted || 0) + abortedPomodoros;
      }

      // Always compute today/week/month relative to CURRENT date
      updates.totalTimeToday = effectiveDateKey === todayKey
        ? prevDayTotal + sessionSeconds
        : (data.dailyStats?.[todayKey]?.totalTime || 0);

      // Week total: sum all days in CURRENT week
      const weekTotal = Object.entries({ ...(data.dailyStats || {}) }).reduce((sum, [dk, ds]) => {
        if (localISOWeek(new Date(dk + "T12:00:00")) === currentWeekKey) {
          return sum + (dk === effectiveDateKey ? prevDayTotal + sessionSeconds : (ds.totalTime || 0));
        }
        return sum;
      }, 0);
      updates.totalTimeWeek = weekTotal;

      // Month total: sum all days in CURRENT month
      const monthTotal = Object.entries({ ...(data.dailyStats || {}) }).reduce((sum, [dk, ds]) => {
        if (dk.startsWith(currentMonthKey)) {
          return sum + (dk === effectiveDateKey ? prevDayTotal + sessionSeconds : (ds.totalTime || 0));
        }
        return sum;
      }, 0);
      updates.totalTimeMonth = monthTotal;

      tx.update(userDocRef, updates);
    });
  }, []);

  /* ═══ Internal start timer ═══ */
  const startTimerInternal = useCallback(() => {
    sessionStartWallTimeRef.current = Date.now();
    sessionStartDateRef.current = localYMD();
    accumulatedSecondsRef.current = 0;
    isRunningRef.current = true;
  }, []);

  /* ═══ Day-boundary check — FIX BUG #2: Guard against concurrent execution ═══ */
  const checkDayBoundary = useCallback(async () => {
    if (!isRunningRef.current || !sessionStartDateRef.current) return;
    const todayKey = localYMD();
    if (sessionStartDateRef.current === todayKey) return;
    // Prevent concurrent calls from stacking
    if (isSavingDayBoundaryRef.current) return;
    isSavingDayBoundaryRef.current = true;

    toast("🌙 New day — saving yesterday's progress…");
    const segSecs = getSegmentSeconds();
    if (segSecs > 0) {
      const dateKey = sessionStartDateRef.current;
      const weekKey = localISOWeek(new Date(dateKey + "T12:00:00"));
      const monthKey = localYM(new Date(dateKey + "T12:00:00"));
      const hourKey = String(new Date(sessionStartWallTimeRef.current).getHours()).padStart(2, "0");
      try {
        await saveSessionChunk(segSecs, dateKey, weekKey, monthKey, selectedFieldRef.current, hourKey, true);
      } catch (e) {
        console.error("Midnight save failed:", e);
        isSavingDayBoundaryRef.current = false;
        // Don't reset on failure — keep accumulating
        return;
      }
    }
    // Reset segment for new day WITHOUT stopping the timer
    sessionStartWallTimeRef.current = Date.now();
    sessionStartDateRef.current = todayKey;
    accumulatedSecondsRef.current = 0;
    isSavingDayBoundaryRef.current = false;
  }, [getSegmentSeconds, saveSessionChunk]);

  /* ═══ Timer tick ═══
     FIX BUG #1: Pomodoro completion detection — use stable ref comparison,
     only fire once per completed round, reset properly on stop. ═══ */
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      if (!isRunningRef.current || !sessionStartWallTimeRef.current) return;

      const total = getTotalSessionSeconds();
      const SESSION = 25 * 60;

      if (pomodoroModeRef.current) {
        const remaining = Math.max(0, SESSION - (total % SESSION));
        setPomodoroTimeLeft(remaining);

        // Detect new pomodoro completion via ref comparison
        const nowCompleted = Math.floor(total / SESSION);
        if (nowCompleted > completedPomodorosInSessionRef.current) {
          completedPomodorosInSessionRef.current = nowCompleted;
          setPomodoroRounds((prev) => {
            const next = prev + 1;
            toast.success(next % 4 === 0 ? "Long break time! (15–30 min) 🎉" : "Pomodoro done! Take a 5-min break ☕");
            return next;
          });
          setIsBreak(true);
          // stopTimerRef saves with pomodoro tracking
          stopTimerRef.current?.();
        }
      } else {
        setDisplaySeconds(total);
      }

      // Midnight boundary check — runs async but is guarded against concurrency
      checkDayBoundary();
    }, 1000);
    return () => clearInterval(timerIntervalRef.current);
  }, [getTotalSessionSeconds, checkDayBoundary]);

  /* ═══ Expose timer state for TopBar ═══ */
  useEffect(() => {
    window.studyBuddyTimerState = {
      isRunning,
      selectedField,
      getSessionSeconds: getTotalSessionSeconds,
      showWarning: (cb) => {
        if (isRunning) { setNavWarning({ open: true, cb }); return true; }
        return false;
      },
    };
    return () => { delete window.studyBuddyTimerState; };
  }, [isRunning, selectedField, getTotalSessionSeconds]);

  /* ═══ Timer Controls ═══ */
  const startTimer = useCallback(async () => {
    if (!userRef.current) return toast.error("Please log in first");
    completedPomodorosInSessionRef.current = 0;
    checkpointBackoffRef.current = 1000; // reset backoff on new session
    setIsRunning(true);
    setIsBreak(false);
    startTimerInternal();
    await requestWakeLock();
    toast.success(
      `📚 Studying: ${selectedFieldRef.current}${strictModeRef.current ? " · 🔒 Strict" : ""}`,
      { duration: 2000 }
    );
  }, [requestWakeLock, startTimerInternal]);

  const stopTimer = useCallback(async () => {
    if (!isRunningRef.current) return;
    isRunningRef.current = false;
    setIsRunning(false);
    await releaseWakeLock();

    // Clear strict mode grace timer if pending
    if (strictGraceTimerRef.current) {
      clearTimeout(strictGraceTimerRef.current);
      strictGraceTimerRef.current = null;
    }

    clearInterval(checkpointIntervalRef.current);
    checkpointIntervalRef.current = null;

    if (!sessionStartWallTimeRef.current) return;

    const sessionSeconds = getTotalSessionSeconds();
    const dateKey = sessionStartDateRef.current || localYMD();
    const weekKey = localISOWeek(new Date(dateKey + "T12:00:00"));
    const monthKey = localYM(new Date(dateKey + "T12:00:00"));
    const hourKey = String(new Date().getHours()).padStart(2, "0");
    const field = selectedFieldRef.current;

    // FIX BUG #8: Improved pomodoro aborted logic
    let completedPomodoros = 0;
    let abortedPomodoros = 0;
    if (pomodoroModeRef.current) {
      completedPomodoros = completedPomodorosInSessionRef.current;
      const SESSION = 25 * 60;
      const partialProgress = sessionSeconds % SESSION;
      // Only count as aborted if there was meaningful partial progress (> 5 min)
      // and this is a non-zero partial pomodoro (not exactly at a boundary)
      if (partialProgress > 300 && partialProgress < SESSION) {
        abortedPomodoros = 1;
      }
    }

    sessionStartWallTimeRef.current = null;
    sessionStartDateRef.current = null;
    accumulatedSecondsRef.current = 0;
    completedPomodorosInSessionRef.current = 0;
    setDisplaySeconds(0);
    setPomodoroTimeLeft(25 * 60);

    if (sessionSeconds > 5) {
      try {
        await saveSessionChunk(
          sessionSeconds, dateKey, weekKey, monthKey, field, hourKey,
          false, completedPomodoros, abortedPomodoros
        );
        toast.success(`✅ Saved! ${fmtTime(sessionSeconds)} for ${field}`);
      } catch (e) {
        console.error(e);
        toast.error("Failed to save session");
      }
    }
  }, [getTotalSessionSeconds, releaseWakeLock, saveSessionChunk]);

  useEffect(() => { stopTimerRef.current = stopTimer; }, [stopTimer]);

  // FIX BUG #7: Checkpoint with exponential backoff on failure
  useEffect(() => {
    if (!isRunning) {
      clearInterval(checkpointIntervalRef.current);
      checkpointIntervalRef.current = null;
      return;
    }

    const runCheckpoint = async () => {
      if (!isRunningRef.current || !sessionStartWallTimeRef.current) return;
      const segSecs = getSegmentSeconds();
      if (segSecs < 60) return;
      const dateKey = sessionStartDateRef.current || localYMD();
      const weekKey = localISOWeek(new Date(dateKey + "T12:00:00"));
      const monthKey = localYM(new Date(dateKey + "T12:00:00"));
      const hourKey = String(new Date().getHours()).padStart(2, "0");
      const field = selectedFieldRef.current;
      try {
        await saveSessionChunk(segSecs, dateKey, weekKey, monthKey, field, hourKey, true);
        // Success — reset backoff
        checkpointBackoffRef.current = 1000;
        // Only reset segment after successful save
        sessionStartWallTimeRef.current = Date.now();
        accumulatedSecondsRef.current = 0;
      } catch (e) {
        console.error("Checkpoint failed, will retry with backoff:", e);
        // Exponential backoff: 1s → 2s → 4s → … → 60s cap
        checkpointBackoffRef.current = Math.min(checkpointBackoffRef.current * 2, 60000);
      }
    };

    checkpointIntervalRef.current = setInterval(runCheckpoint, 60000);
    return () => clearInterval(checkpointIntervalRef.current);
  }, [isRunning, getSegmentSeconds, saveSessionChunk]);

  const resetTimer = useCallback(async () => {
    clearInterval(checkpointIntervalRef.current);
    if (strictGraceTimerRef.current) {
      clearTimeout(strictGraceTimerRef.current);
      strictGraceTimerRef.current = null;
    }
    isRunningRef.current = false;
    setIsRunning(false);
    await releaseWakeLock();
    setDisplaySeconds(0);
    setPomodoroTimeLeft(25 * 60);
    setPomodoroRounds(0);
    setIsBreak(false);
    sessionStartWallTimeRef.current = null;
    sessionStartDateRef.current = null;
    accumulatedSecondsRef.current = 0;
    completedPomodorosInSessionRef.current = 0;
    checkpointBackoffRef.current = 1000;
    toast("Timer reset");
  }, [releaseWakeLock]);

  /* ═══ Daily reset: recompute totalTimeToday if new day ═══ */
  useEffect(() => {
    if (!userData || !userRef.current) return;
    const todayKey = localYMD();
    const lastKey = userData.lastStudyDateKey;
    if (lastKey && lastKey !== todayKey) {
      const todayTotal = userData.dailyStats?.[todayKey]?.totalTime || 0;
      if (userData.totalTimeToday !== todayTotal) {
        const weekKey = localISOWeek();
        const monthKey = localYM();
        const weekTotal = Object.entries(userData.dailyStats || {}).reduce((sum, [dk, ds]) => {
          if (localISOWeek(new Date(dk + "T12:00:00")) === weekKey) return sum + (ds.totalTime || 0);
          return sum;
        }, 0);
        const monthTotal = Object.entries(userData.dailyStats || {}).reduce((sum, [dk, ds]) => {
          if (dk.startsWith(monthKey)) return sum + (ds.totalTime || 0);
          return sum;
        }, 0);
        updateDoc(doc(db, "users", userRef.current.uid), {
          totalTimeToday: todayTotal,
          totalTimeWeek: weekTotal,
          totalTimeMonth: monthTotal,
        }).catch(console.error);
      }
    }
  }, [userData]);

  /* ═══ Field Management ═══ */
  const addField = useCallback(async () => {
    const name = newFieldName.trim();
    if (!name) return toast.error("Enter a field name");
    const fields = userData?.studyFields || ["General"];
    if (fields.includes(name)) return toast.error("Field already exists");
    if (!userRef.current) return;
    try {
      await updateDoc(doc(db, "users", userRef.current.uid), { studyFields: [...fields, name] });
      setNewFieldName("");
      toast.success(`📚 "${name}" added`);
    } catch (e) { toast.error("Failed to add field"); }
  }, [newFieldName, userData?.studyFields]);

  const openRemoveModal = useCallback((field) => {
    if (field === "General") return toast.error("Cannot remove General field");
    if ((userData?.studyFields || []).length <= 1) return toast.error("Need at least one field");
    setRemoveModal({ open: true, field, keepTime: false });
  }, [userData?.studyFields]);

  /* FIX BUG #3: confirmRemoveField — properly redistribute time when keepTime=false.
     Recalculates each day's totalTime from its remaining fieldTimes so no
     precision is lost and all period totals stay consistent. */
  const confirmRemoveField = useCallback(async () => {
    const { field, keepTime } = removeModal;
    if (!field || !userRef.current) return;
    const uid = userRef.current.uid;
    const fields = (userData?.studyFields || []).filter((f) => f !== field);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, "users", uid));
        if (!snap.exists()) return;
        const data = snap.data();

        const updates = { studyFields: fields };
        // Remove the field from the fieldTimes top-level map
        updates[`fieldTimes.${field}`] = null;

        if (!keepTime) {
          const todayKey = localYMD();
          const weekKey = localISOWeek();
          const monthKey = localYM();
          let todayNew = 0, weekNew = 0, monthNew = 0, allTimeNew = 0;

          // For each day, recompute totalTime from remaining fieldTimes
          Object.entries(data.dailyStats || {}).forEach(([dk, ds]) => {
            const remainingFieldTimes = Object.entries(ds.fieldTimes || {})
              .filter(([f]) => f !== field);
            const dayTotal = remainingFieldTimes.reduce((s, [, v]) => s + (v || 0), 0);
            allTimeNew += dayTotal;

            if (dk === todayKey) todayNew = dayTotal;
            if (localISOWeek(new Date(dk + "T12:00:00")) === weekKey) weekNew += dayTotal;
            if (dk.startsWith(monthKey)) monthNew += dayTotal;

            // Null out this field's time for this day and update the day total
            updates[`dailyStats.${dk}.fieldTimes.${field}`] = null;
            updates[`dailyStats.${dk}.totalTime`] = dayTotal;
          });

          updates.totalTimeAllTime = allTimeNew;
          updates.totalTimeToday = todayNew;
          updates.totalTimeWeek = weekNew;
          updates.totalTimeMonth = monthNew;
        }

        tx.update(doc(db, "users", uid), updates);
      });

      if (selectedField === field) setSelectedField(fields[0] || "General");
      toast.success(`"${field}" removed`);
      setRemoveModal({ open: false, field: null, keepTime: false });
    } catch (e) { toast.error("Failed to remove field"); }
  }, [removeModal, userData, selectedField]);

  /* ═══ Task Helpers ═══ */
  const userDocRef = useCallback(() => {
    if (!userRef.current) return null;
    return doc(db, "users", userRef.current.uid);
  }, []);

  const addTask = useCallback(async () => {
    if (!newTaskText.trim()) return toast.error("Enter a task");
    if (!userRef.current) return;
    const task = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      text: newTaskText.trim(), completed: false,
      priority: taskPriority, deadline: taskDeadline || null,
      createdAt: new Date().toISOString(), field: selectedField,
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
    const task = todoList.find((t) => t.id === id);
    setLastDeleted(task);
    try {
      await updateDoc(userDocRef(), { todoList: todoList.filter((t) => t.id !== id) });
    } catch (e) { toast.error("Failed to delete task"); }
  }, [todoList, userDocRef]);

  const undoDelete = useCallback(async () => {
    if (!lastDeleted || !userRef.current) return;
    try {
      await updateDoc(userDocRef(), { todoList: [...todoList, lastDeleted] });
      setLastDeleted(null);
    } catch (e) { toast.error("Failed to restore task"); }
  }, [lastDeleted, todoList, userDocRef]);

  const saveEdit = useCallback(async (id) => {
    if (!editingTask.text.trim()) return toast.error("Task cannot be empty");
    const updated = todoList.map((t) => t.id === id ? { ...t, text: editingTask.text.trim() } : t);
    try {
      await updateDoc(userDocRef(), { todoList: updated });
      setEditingTask({ id: null, text: "" });
    } catch (e) { toast.error("Failed to update task"); }
  }, [editingTask, todoList, userDocRef]);

  const sortByPriority = useCallback(async () => {
    const order = { High: 1, Medium: 2, Low: 3 };
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

  // FIX BUG #4: Clear undo bar when tasks panel closes
  useEffect(() => {
    if (activePanel !== "tasks") setLastDeleted(null);
  }, [activePanel]);

  /* ═══ Derived / Memoised ═══ */
  const studyFields = useMemo(() => userData?.studyFields || ["General"], [userData?.studyFields]);
  const sortedFields = useMemo(() => {
    if (!userData?.fieldTimes) return [];
    return Object.entries(userData.fieldTimes)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [userData?.fieldTimes]);

  const liveSessionSeconds = useMemo(() => {
    if (!isRunning) return 0;
    return displaySeconds;
  }, [isRunning, displaySeconds]);

  const timeStats = useMemo(() => {
    const todayKey = localYMD();
    const weekKey = localISOWeek();
    const monthKey = localYM();
    const ds = userData?.dailyStats || {};
    const today = (ds[todayKey]?.totalTime || 0) + liveSessionSeconds;
    const week = Object.entries(ds).reduce((sum, [dk, d]) => {
      const isSameWeek = localISOWeek(new Date(dk + "T12:00:00")) === weekKey;
      return sum + (isSameWeek ? (dk === todayKey ? today : (d.totalTime || 0)) : 0);
    }, 0);
    const month = Object.entries(ds).reduce((sum, [dk, d]) => {
      return sum + (dk.startsWith(monthKey) ? (dk === todayKey ? today : (d.totalTime || 0)) : 0);
    }, 0);
    return {
      today,
      week,
      month,
      allTime: (userData?.totalTimeAllTime || 0) + liveSessionSeconds,
    };
  }, [userData, liveSessionSeconds]);

  const filteredTasks = useMemo(() => todoList.filter((t) => {
    if (filterOption === "All") return true;
    if (filterOption === "Completed") return t.completed;
    if (filterOption === "Pending") return !t.completed;
    return t.priority === filterOption;
  }), [todoList, filterOption]);

  const taskStats = useMemo(() => {
    const total = todoList.length;
    const completed = todoList.filter((t) => t.completed).length;
    return { total, completed, pending: total - completed, high: todoList.filter((t) => t.priority === "High").length };
  }, [todoList]);

  const todayFieldTimes = useMemo(() => {
    const todayKey = localYMD();
    const base = { ...(userData?.dailyStats?.[todayKey]?.fieldTimes || {}) };
    if (isRunning && selectedField) {
      base[selectedField] = (base[selectedField] || 0) + liveSessionSeconds;
    }
    return base;
  }, [userData, isRunning, selectedField, liveSessionSeconds]);

  const insights = useInsights(userData, isRunning, liveSessionSeconds);

  const displayTime = pomodoroMode ? pomodoroTimeLeft : displaySeconds;

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
    <div className={`ss-page${strictMode && isRunning ? " strict-active" : ""}`}>

      {/* ── Nav Warning Modal ── */}
      <AnimatePresence>
        {navWarning.open && (
          <motion.div className="ss-modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ss-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}>
              <div className="ss-modal-head warning">
                <span>⏱️ Timer is Running</span>
                <button className="ss-modal-close" onClick={() => setNavWarning({ open: false, cb: null })}>✕</button>
              </div>
              <div className="ss-modal-body">
                <p>Navigating away will pause and save your session.</p>
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-cancel" onClick={() => setNavWarning({ open: false, cb: null })}>Keep Studying</button>
                <button className="ss-btn-danger" onClick={async () => {
                  await stopTimer();
                  setNavWarning((prev) => {
                    if (prev.cb) setTimeout(prev.cb, 100);
                    return { open: false, cb: null };
                  });
                }}>Pause & Leave</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Field Removal Modal ── */}
      <AnimatePresence>
        {removeModal.open && (
          <motion.div className="ss-modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>
            <motion.div className="ss-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="ss-modal-head info">
                <span>Remove Field</span>
                <button className="ss-modal-close" onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>✕</button>
              </div>
              <div className="ss-modal-body">
                <p>Remove <strong style={{ color: "#c084fc" }}>{removeModal.field}</strong>?</p>
                {userData?.fieldTimes?.[removeModal.field] > 0 && (
                  <label className="ss-check-row">
                    <input type="checkbox" checked={removeModal.keepTime}
                      onChange={(e) => setRemoveModal((p) => ({ ...p, keepTime: e.target.checked }))} />
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

      <div className="ss-container">
        <motion.div className="ss-main-grid" variants={staggerContainer} initial="initial" animate="animate">

          {/* ── LEFT: Timer Card ── */}
          <motion.div className="ss-card ss-timer-card" variants={cardVariant}>
            <div className="ss-mode-pill">
              {pomodoroMode ? "🍅 Pomodoro Mode" : "⏱️ Stopwatch"}
              {isRunning && <span className="ss-live-dot" />}
            </div>

            <div className="ss-ring-wrap">
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
            </div>

            <div className="ss-controls">
              {isRunning
                ? <button className="ss-btn ss-btn-stop" onClick={stopTimer}>⏹ Stop</button>
                : <button className="ss-btn ss-btn-start" onClick={startTimer}>▶ Start</button>
              }
              <button className="ss-btn ss-btn-reset" onClick={resetTimer}>↺</button>
            </div>

            <div className="ss-bottom-controls">
              <label className={`ss-toggle-row${isRunning ? " disabled" : ""}`}>
                <div className={`ss-toggle-track${pomodoroMode ? " on" : ""}`}
                  onClick={() => !isRunning && setPomodoroMode((v) => !v)}>
                  <div className="ss-toggle-thumb" />
                </div>
                <span>Pomodoro (25 min)</span>
              </label>

              <button
                className={`ss-strict-btn${strictMode ? " on" : ""}`}
                onClick={() => {
                  if (isRunning) return toast.error("Stop timer to change strict mode");
                  const next = !strictMode;
                  setStrictMode(next);
                  toast(next ? "🔒 Strict mode ON" : "🔓 Strict mode OFF");
                }}
              >
                <div className="ss-strict-indicator">{strictMode ? "🔒" : "🔓"}</div>
                <div className="ss-strict-text">
                  <span className="ss-strict-title">Strict Mode</span>
                  <span className="ss-strict-desc">
                    {strictMode ? "Tab switching pauses timer (2s grace)" : "Timer continues while browsing"}
                  </span>
                </div>
                <div className={`ss-strict-badge${strictMode ? " on" : ""}`}>
                  {strictMode ? "ON" : "OFF"}
                </div>
              </button>
            </div>
          </motion.div>

          {/* ── RIGHT: Side Cards ── */}
          <div className="ss-side-col">
            <motion.div className="ss-card ss-field-card" variants={cardVariant}>
              <div className="ss-card-title">
                <span className="ss-card-icon">🎯</span>
                Study Field
              </div>
              <div className="ss-field-chips">
                {studyFields.map((f) => (
                  <button key={f}
                    className={`ss-field-chip${selectedField === f ? " selected" : ""}${isRunning ? " locked" : ""}`}
                    onClick={() => !isRunning && setSelectedField(f)}>
                    {f}
                    {f !== "General" && (
                      <span className="ss-chip-remove"
                        onClick={(e) => { e.stopPropagation(); openRemoveModal(f); }}>×</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="ss-add-field-row">
                <input className="ss-input" type="text" placeholder="Add new field…"
                  value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addField()} />
                <button className="ss-btn-sm ss-btn-purple" onClick={addField}>+ Add</button>
              </div>
            </motion.div>

            <motion.div className="ss-card ss-mini-stats" variants={cardVariant}>
              <div className="ss-card-title">
                <span className="ss-card-icon">📊</span>
                Session Overview
              </div>
              <div className="ss-mini-grid">
                {[
                  { label: "Tasks", val: taskStats.total, color: "#a855f7" },
                  { label: "Done", val: taskStats.completed, color: "#34d399" },
                  { label: "Pending", val: taskStats.pending, color: "#fbbf24" },
                  { label: "Urgent", val: taskStats.high, color: "#ef4444" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="ss-mini-item">
                    <div className="ss-mini-num" style={{ color }}>{val}</div>
                    <div className="ss-mini-label">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </motion.div>

        {/* ════ BOTTOM TAB BAR ════ */}
        <motion.div className="ss-tab-bar"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}>
          {[
            { key: "tasks", icon: "📋", label: "Tasks", badge: taskStats.pending > 0 ? taskStats.pending : null },
            { key: "stats", icon: "📊", label: "Stats", badge: isRunning ? "●" : null },
            { key: "fields", icon: "📚", label: "Fields", badge: null },
          ].map(({ key, icon, label, badge }) => (
            <button key={key}
              className={`ss-tab${activePanel === key ? " active" : ""}`}
              onClick={() => setActivePanel(activePanel === key ? null : key)}>
              <span className="ss-tab-icon">{icon}</span>
              <span className="ss-tab-label">{label}</span>
              {badge !== null && (
                <span className={`ss-tab-badge${badge === "●" ? " live" : ""}`}>{badge}</span>
              )}
            </button>
          ))}
        </motion.div>

        {/* ════ OVERLAY PANELS ════ */}
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
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    min={new Date().toISOString().split("T")[0]} />
                  <button className="ss-btn-sm ss-btn-purple" onClick={addTask}>+ Add</button>
                </div>
              </div>
              <div className="ss-task-filter-row">
                <select className="ss-select" value={filterOption} onChange={(e) => setFilterOption(e.target.value)}>
                  <option value="All">All ({taskStats.total})</option>
                  <option value="Completed">Done ({taskStats.completed})</option>
                  <option value="Pending">Pending ({taskStats.pending})</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <button className="ss-btn-sm ss-btn-ghost" onClick={sortByPriority}>↕ Priority</button>
                <button className="ss-btn-sm ss-btn-ghost" onClick={sortByDeadline}>📅 Due</button>
              </div>
              <div className="ss-task-list">
                <AnimatePresence>
                  {filteredTasks.length > 0 ? filteredTasks.map((task) => (
                    <motion.div key={task.id}
                      className={`ss-task-item${task.completed ? " done" : ""}`}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }} layout>
                      <div className="ss-task-body">
                        {editingTask.id === task.id ? (
                          <input className="ss-input" value={editingTask.text}
                            onChange={(e) => setEditingTask((p) => ({ ...p, text: e.target.value }))}
                            onBlur={() => saveEdit(task.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(task.id);
                              if (e.key === "Escape") setEditingTask({ id: null, text: "" });
                            }}
                            autoFocus />
                        ) : (
                          <>
                            <div className={`ss-task-text${task.completed ? " done" : ""}`} onClick={() => toggleTask(task.id)}>
                              {task.text}
                            </div>
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
                  <motion.div className="ss-undo-bar"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
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
                  { label: "Sessions", val: (userData?.dailyStats?.[localYMD()]?.sessionsCount || 0) + (isRunning ? 1 : 0) },
                  { label: "Fields", val: sortedFields.length },
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
              <HourHistogram
                dailyStats={userData?.dailyStats}
                liveSeconds={liveSessionSeconds}
                isRunning={isRunning}
              />

              <div className="ss-section-label" style={{ marginTop: "1.5rem" }}>
                Study Insights
                {isRunning && <span className="ss-live-tag">live</span>}
              </div>
              <InsightCards insights={insights} />
            </motion.div>
          )}

          {activePanel === "fields" && (
            <motion.div className="ss-panel" variants={overlayVariant} initial="initial" animate="animate" exit="exit">
              <div className="ss-panel-header">
                <h2 className="ss-panel-title">📚 All-Time Field Times</h2>
                <button className="ss-panel-close" onClick={() => setActivePanel(null)}>✕</button>
              </div>
              <div className="ss-fields-list">
                {sortedFields.length > 0 ? sortedFields.map(([field, secs], i) => (
                  <motion.div key={field}
                    className={`ss-field-row${field === selectedField && isRunning ? " active" : ""}`}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    <div className="ss-field-row-info">
                      <div className="ss-field-row-name">{field}</div>
                      <div className="ss-field-row-time">
                        {fmtTime(field === selectedField && isRunning ? secs + liveSessionSeconds : secs)}
                      </div>
                    </div>
                    {field !== "General" && (
                      <button className="ss-task-btn danger" onClick={() => openRemoveModal(field)}>✕</button>
                    )}
                  </motion.div>
                )) : (
                  <div className="empty-state-sm">Start studying to see field times!</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}