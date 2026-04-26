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
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../components/firebase";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import clockAnimation from "../assets/3d-clock-animation.json";
import "./Session.css";

/* ─── Framer Motion Variants ─── */
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
};

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
function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localYM(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function localWeekStart(d = new Date()) {
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (day - 1));
  return localYMD(start);
}

/* ─── SVG Circular Progress Ring ─── */
function ProgressRing({ progress, size = 220, strokeWidth = 10, color = "#a855f7", children }) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <div className="progress-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="progress-ring-inner">{children}</div>
    </div>
  );
}

/* ─── Hourly Histogram ─── */
function HourHistogram({ dailyStats, isRunning, liveSeconds }) {
  const todayKey = localYMD();
  const todayData = dailyStats?.[todayKey] || {};
  const hours = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
      seconds: todayData?.hourly?.[String(i).padStart(2, "0")] || 0,
    }));
    if (isRunning) {
      const curHour = new Date().getHours();
      arr[curHour] = { ...arr[curHour], seconds: arr[curHour].seconds + liveSeconds, live: true };
    }
    return arr;
  }, [todayData, isRunning, liveSeconds]);
  const maxVal = useMemo(() => Math.max(...hours.map((h) => h.seconds), 1), [hours]);
  const curHour = new Date().getHours();
  return (
    <div className="histogram-wrap">
      <div className="histogram-bars">
        {hours.map((h) => {
          const pct = Math.min((h.seconds / maxVal) * 100, 100);
          return (
            <div key={h.hour} className="histo-col">
              <div className="histo-bar-track">
                <motion.div
                  className={`histo-bar${h.hour === curHour ? " current" : ""}${h.live ? " live" : ""}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, 4)}%` }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  title={`${h.label}: ${fmtMins(h.seconds)}`}
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

/* ══════════════════════════════════════════════
   MAIN SESSION COMPONENT
══════════════════════════════════════════════ */
export default function StartSession() {
  /* ─ Auth & data ─ */
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ─ Timer ─ */
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [pomodoroRounds, setPomodoroRounds] = useState(0);
  const [isBreak, setIsBreak] = useState(false);

  /* ─ Strict Mode ─ */
  const [strictMode, setStrictMode] = useState(false);
  const strictModeRef = useRef(false);
  useEffect(() => { strictModeRef.current = strictMode; }, [strictMode]);

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

  /* ─ Active panel: null | 'tasks' | 'stats' | 'fields' ─ */
  const [activePanel, setActivePanel] = useState(null);

  /* ─ Nav warning ─ */
  const [navWarning, setNavWarning] = useState({ open: false, cb: null });

  /* ─ Refs ─ */
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const accumulatedRef = useRef(0);
  const isRunningRef = useRef(false);
  const pomodoroModeRef = useRef(false);
  const selectedFieldRef = useRef("General");
  const userRef = useRef(null);
  const unsubRef = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { pomodoroModeRef.current = pomodoroMode; }, [pomodoroMode]);
  useEffect(() => { selectedFieldRef.current = selectedField; }, [selectedField]);

  /* ═══ Wake Lock (mobile screen-off) ═══ */
  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (e) { /* silently ignore */ }
    }
  }, []);
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch (e) { /* ignore */ }
      wakeLockRef.current = null;
    }
  }, []);

  // Re-acquire wake lock when page becomes visible again (mobile)
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible" && isRunningRef.current) {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestWakeLock]);

  /* ═══ Prevent tab close / navigation during strict mode ═══ */
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isRunningRef.current && strictModeRef.current) {
        e.preventDefault();
        e.returnValue = "🔒 Strict mode is ON — are you sure you want to leave?";
        return e.returnValue;
      } else if (isRunningRef.current) {
        e.preventDefault();
        e.returnValue = "Timer is running!";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /* ═══ Tab visibility — strict vs non-strict ═══ */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isRunningRef.current && strictModeRef.current) {
        toast.error("🔒 Strict mode: You left the tab! Timer paused.", { duration: 4000 });
        stopTimer();
      }
      // Non-strict: timer keeps running silently
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []); // eslint-disable-line

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
    const dk = localYMD(); const wk = localWeekStart(); const mk = localYM();
    const base = {
      email: auth.currentUser?.email || "",
      name: auth.currentUser?.displayName || "User",
      createdAt: serverTimestamp(),
      todoList: [],
      studyFields: ["General"],
      fieldTimes: {},
      totalTimeToday: 0, totalTimeWeek: 0, totalTimeMonth: 0, totalTimeAllTime: 0,
      lastStudyDate: null,
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
        setUser(null); setUserData(null); setLoading(false);
        unsubRef.current?.();
      }
    });
    return () => { unsub(); unsubRef.current?.(); };
  }, [setupListener]);

  /* ═══ Timer Tick ═══ */
  const tick = useCallback(() => {
    if (!isRunningRef.current || !startTimeRef.current) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + accumulatedRef.current;
    if (pomodoroModeRef.current) {
      const SESSION = 25 * 60;
      const remaining = Math.max(0, SESSION - (elapsed % SESSION));
      setPomodoroTimeLeft(remaining);
      if (remaining === 0) {
        const rounds = Math.floor(elapsed / SESSION) + 1;
        setPomodoroRounds(rounds);
        toast.success(rounds % 4 === 0 ? "Long break time! (15–30 min)" : "Pomodoro done! Take a 5-min break 🎉");
        setIsBreak(true);
        stopTimer();
      }
    } else {
      setTime(elapsed);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [tick]);

  /* ═══ Expose state for TopBar ═══ */
  useEffect(() => {
    window.studyBuddyTimerState = {
      isRunning,
      showWarning: (cb) => {
        if (isRunning) { setNavWarning({ open: true, cb }); return true; }
        return false;
      },
    };
    return () => { delete window.studyBuddyTimerState; };
  }, [isRunning]);

  /* ═══ Save session ═══ */
  const saveSession = useCallback(async (sessionTime) => {
    if (!userRef.current || sessionTime <= 0) return;
    const uid = userRef.current.uid;
    const field = selectedFieldRef.current;
    const dk = localYMD(); const wk = localWeekStart(); const mk = localYM();
    const curHour = String(new Date().getHours()).padStart(2, "0");
    await updateDoc(doc(db, "users", uid), {
      [`fieldTimes.${field}`]: increment(sessionTime),
      totalTimeToday: increment(sessionTime),
      totalTimeWeek: increment(sessionTime),
      totalTimeMonth: increment(sessionTime),
      totalTimeAllTime: increment(sessionTime),
      [`dailyStats.${dk}.totalTime`]: increment(sessionTime),
      [`dailyStats.${dk}.fieldTimes.${field}`]: increment(sessionTime),
      [`dailyStats.${dk}.sessionsCount`]: increment(1),
      [`dailyStats.${dk}.hourly.${curHour}`]: increment(sessionTime),
      [`weeklyStats.${wk}.totalTime`]: increment(sessionTime),
      [`weeklyStats.${wk}.fieldTimes.${field}`]: increment(sessionTime),
      [`weeklyStats.${wk}.sessionsCount`]: increment(1),
      [`monthlyStats.${mk}.totalTime`]: increment(sessionTime),
      [`monthlyStats.${mk}.fieldTimes.${field}`]: increment(sessionTime),
      [`monthlyStats.${mk}.sessionsCount`]: increment(1),
      lastStudyDate: serverTimestamp(),
    });
  }, []);

  /* ═══ Timer Controls ═══ */
  const startTimer = useCallback(async () => {
    if (!userRef.current) return toast.error("Please log in first");
    setIsRunning(true);
    setIsBreak(false);
    startTimeRef.current = Date.now();
    accumulatedRef.current = pomodoroMode ? (25 * 60 - pomodoroTimeLeft) : time;
    await requestWakeLock();
    toast.success(`📚 Studying: ${selectedField}${strictMode ? " · 🔒 Strict" : ""}`, { duration: 2000 });
  }, [pomodoroMode, pomodoroTimeLeft, time, selectedField, strictMode, requestWakeLock]);

  const stopTimer = useCallback(async () => {
    setIsRunning(false);
    await releaseWakeLock();
    if (!userRef.current || !startTimeRef.current) return;
    const sessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000) + accumulatedRef.current;
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    setTime(0);
    setPomodoroTimeLeft(25 * 60);
    if (sessionTime > 5) {
      try {
        await saveSession(sessionTime);
        toast.success(`✅ Saved! ${fmtTime(sessionTime)} for ${selectedFieldRef.current}`);
      } catch (e) { toast.error("Failed to save session"); }
    }
  }, [saveSession, releaseWakeLock]);

  const resetTimer = useCallback(async () => {
    setIsRunning(false);
    await releaseWakeLock();
    setTime(0); setPomodoroTimeLeft(25 * 60); setPomodoroRounds(0); setIsBreak(false);
    startTimeRef.current = null; accumulatedRef.current = 0;
    toast("Timer reset");
  }, [releaseWakeLock]);

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

  const confirmRemoveField = useCallback(async () => {
    const { field, keepTime } = removeModal;
    if (!field || !userRef.current) return;
    const uid = userRef.current.uid;
    const fields = (userData?.studyFields || []).filter((f) => f !== field);
    const fieldTime = userData?.fieldTimes?.[field] || 0;
    const dk = localYMD(); const wk = localWeekStart(); const mk = localYM();
    const update = {
      studyFields: fields,
      [`fieldTimes.${field}`]: null,
      [`dailyStats.${dk}.fieldTimes.${field}`]: null,
      [`weeklyStats.${wk}.fieldTimes.${field}`]: null,
      [`monthlyStats.${mk}.fieldTimes.${field}`]: null,
    };
    if (!keepTime && fieldTime > 0) update.totalTimeAllTime = increment(-fieldTime);
    try {
      await updateDoc(doc(db, "users", uid), update);
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

  /* ═══ Derived / Memoised ═══ */
  const studyFields = useMemo(() => userData?.studyFields || ["General"], [userData?.studyFields]);
  const sortedFields = useMemo(() => {
    if (!userData?.fieldTimes) return [];
    return Object.entries(userData.fieldTimes)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [userData?.fieldTimes]);
  const timeStats = useMemo(() => ({
    today: userData?.totalTimeToday || 0,
    week: userData?.totalTimeWeek || 0,
    month: userData?.totalTimeMonth || 0,
    allTime: userData?.totalTimeAllTime || 0,
  }), [userData]);
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
  const liveSeconds = useMemo(() => {
    if (!isRunning || !startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, [isRunning, time]);

  // Pomodoro ring progress
const timerColor = isBreak ? "#fbbf24" : isRunning ? "#34d399" : "#a855f7";


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

  const displayTime = pomodoroMode ? pomodoroTimeLeft : time;

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
                  setNavWarning((prev) => { if (prev.cb) setTimeout(prev.cb, 100); return { open: false, cb: null }; });
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



        {/* ════════════════════
            MAIN CONTENT GRID
        ════════════════════ */}
        <motion.div className="ss-main-grid" variants={staggerContainer} initial="initial" animate="animate">

          {/* ── LEFT: Timer Card ── */}
          <motion.div className="ss-card ss-timer-card" variants={cardVariant}>

            {/* Mode Pill */}
            <div className="ss-mode-pill">
              {pomodoroMode ? "🍅 Pomodoro Mode" : "⏱️ Stopwatch"}
              {isRunning && <span className="ss-live-dot" />}
            </div>

            <div className="ss-ring-wrap">
              <Lottie
                animationData={clockAnimation}
                loop={isRunning}
                className="ss-clock-lottie"
              />
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

            {/* Controls */}
            <div className="ss-controls">
              {isRunning
                ? <button className="ss-btn ss-btn-stop" onClick={stopTimer}>⏹ Stop</button>
                : <button className="ss-btn ss-btn-start" onClick={startTimer}>▶ Start</button>
              }
              <button className="ss-btn ss-btn-reset" onClick={resetTimer}>↺</button>
            </div>

            <div className="ss-bottom-controls">
            {/* Pomodoro Toggle */}
              <label className={`ss-toggle-row${isRunning ? " disabled" : ""}`}>
                <div className={`ss-toggle-track${pomodoroMode ? " on" : ""}`}
                  onClick={() => !isRunning && setPomodoroMode((v) => !v)}>
                  <div className="ss-toggle-thumb" />
                </div>
                <span>Pomodoro (25 min)</span>
              </label>

              {/* Strict Mode */}
              <button
                className={`ss-strict-btn${strictMode ? " on" : ""}`}
                onClick={() => {
                  if (isRunning) return toast.error("Stop timer to change strict mode");
                  const next = !strictMode;
                  setStrictMode(next);
                  toast(next ? "🔒 Strict mode ON" : "🔓 Strict mode OFF", {
                    icon: next ? "🔒" : "🔓",
                  });
                }}
              >
                <div className={`ss-strict-indicator${strictMode ? " on" : ""}`}>
                  {strictMode ? "🔒" : "🔓"}
                </div>
                <div className="ss-strict-text">
                  <span className="ss-strict-title">Strict Mode</span>
                  <span className="ss-strict-desc">
                    {strictMode
                      ? "Tab switching pauses timer · Exit blocked"
                      : "Timer continues while browsing"}
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

            {/* Field Selector Card */}
            <motion.div className="ss-card ss-field-card" variants={cardVariant}>
              <div className="ss-card-title">
                <span className="ss-card-icon">🎯</span>
                Study Field
              </div>
              <div className="ss-field-chips">
                {studyFields.map((f) => (
                  <button
                    key={f}
                    className={`ss-field-chip${selectedField === f ? " selected" : ""}${isRunning ? " locked" : ""}`}
                    onClick={() => !isRunning && setSelectedField(f)}
                  >
                    {f}
                    {f !== "General" && (
                      <span className="ss-chip-remove"
                        onClick={(e) => { e.stopPropagation(); openRemoveModal(f); }}>×</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="ss-add-field-row">
                <input
                  className="ss-input"
                  type="text"
                  placeholder="Add new field…"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addField()}
                />
                <button className="ss-btn-sm ss-btn-purple" onClick={addField}>+ Add</button>
              </div>
            </motion.div>

            {/* Mini Stats Grid */}
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

        {/* ════════════════════
            BOTTOM TAB BAR
        ════════════════════ */}
        <motion.div className="ss-tab-bar"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}>
          {[
            { key: "tasks", icon: "📋", label: "Tasks", badge: taskStats.pending > 0 ? taskStats.pending : null },
            { key: "stats", icon: "📊", label: "Stats", badge: isRunning ? "●" : null },
            { key: "fields", icon: "📚", label: "Fields", badge: null },
          ].map(({ key, icon, label, badge }) => (
            <button
              key={key}
              className={`ss-tab${activePanel === key ? " active" : ""}`}
              onClick={() => setActivePanel(activePanel === key ? null : key)}
            >
              <span className="ss-tab-icon">{icon}</span>
              <span className="ss-tab-label">{label}</span>
              {badge !== null && (
                <span className={`ss-tab-badge${badge === "●" ? " live" : ""}`}>{badge}</span>
              )}
            </button>
          ))}
        </motion.div>

        {/* ════════════════════
            OVERLAY PANELS
        ════════════════════ */}
        <AnimatePresence>
          {activePanel === "tasks" && (
            <motion.div className="ss-panel" variants={overlayVariant} initial="initial" animate="animate" exit="exit">
              <div className="ss-panel-header">
                <h2 className="ss-panel-title">📋 To-Do List</h2>
                <button className="ss-panel-close" onClick={() => setActivePanel(null)}>✕</button>
              </div>

              {/* Add Task */}
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

              {/* Filters */}
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

              {/* Task List */}
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
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(task.id); if (e.key === "Escape") setEditingTask({ id: null, text: "" }); }}
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
                  { label: "Total Today", val: fmtTime(timeStats.today + (isRunning ? liveSeconds : 0)) },
                  { label: "Sessions", val: userData?.dailyStats?.[localYMD()]?.sessionsCount || 0 },
                  { label: "Fields", val: sortedFields.length },
                ].map(({ label, val }) => (
                  <div key={label} className="ss-stats-box">
                    <div className="ss-stats-box-label">{label}</div>
                    <div className="ss-stats-box-val">{val}</div>
                  </div>
                ))}
              </div>

              <div className="ss-section-label">Field Breakdown</div>
              <FieldBreakdown
                fieldTimes={userData?.dailyStats?.[localYMD()]?.fieldTimes}
                totalTime={timeStats.today + (isRunning ? liveSeconds : 0)}
              />

              <div className="ss-section-label" style={{ marginTop: "1.5rem" }}>
                Hourly Activity {isRunning && <span className="ss-live-tag">live</span>}
              </div>
              <HourHistogram dailyStats={userData?.dailyStats} isRunning={isRunning} liveSeconds={liveSeconds} />
            </motion.div>
          )}

          {activePanel === "fields" && (
            <motion.div className="ss-panel" variants={overlayVariant} initial="initial" animate="animate" exit="exit">
              <div className="ss-panel-header">
                <h2 className="ss-panel-title">📚 All Field Times</h2>
                <button className="ss-panel-close" onClick={() => setActivePanel(null)}>✕</button>
              </div>
              <div className="ss-fields-list">
                {sortedFields.length > 0 ? sortedFields.map(([field, secs], i) => (
                  <motion.div key={field} className={`ss-field-row${field === selectedField && isRunning ? " active" : ""}`}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    <div className="ss-field-row-info">
                      <div className="ss-field-row-name">{field}</div>
                      <div className="ss-field-row-time">{fmtTime(secs)}</div>
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