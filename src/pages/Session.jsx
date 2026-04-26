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

/* ─── Helpers ─────────────────────────────────────────────── */
function fmtTime(s) {
  if (!s || s <= 0) return "00:00:00";
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}
function fmtMins(s) {
  if (!s || s <= 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function localYM(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function localWeekStart(d = new Date()) {
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const s = new Date(d);
  s.setDate(d.getDate() - (day - 1));
  return localYMD(s);
}

const PRIORITY_ORDER = { High: 1, Medium: 2, Low: 3 };
const FIELD_COLORS = [
  "#a855f7","#34d399","#60a5fa","#fbbf24",
  "#f87171","#818cf8","#fb923c","#38bdf8",
];

/* ─── Sub-components ──────────────────────────────────────── */

function StatBadge({ label, value, icon }) {
  return (
    <div className="ss-stat-badge">
      <span className="ss-stat-icon">{icon}</span>
      <div>
        <div className="ss-stat-label">{label}</div>
        <div className="ss-stat-value">{value}</div>
      </div>
    </div>
  );
}

function CircularProgress({ pct, size = 200, stroke = 14, color = "#a855f7", children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  return (
    <div className="circ-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="circ-inner">{children}</div>
    </div>
  );
}

function HourHistogram({ dailyStats, isRunning, liveSeconds }) {
  const todayKey = localYMD();
  const todayData = dailyStats?.[todayKey] || {};
  const curHour = new Date().getHours();

  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i-12}p`,
      seconds: (todayData?.hourly?.[String(i).padStart(2,"0")] || 0) + (isRunning && i === curHour ? liveSeconds : 0),
      live: isRunning && i === curHour,
    }));
  }, [todayData, isRunning, liveSeconds, curHour]);

  const maxVal = useMemo(() => Math.max(...hours.map(h => h.seconds), 1), [hours]);

  return (
    <div className="histo-wrap">
      <div className="histo-bars">
        {hours.map(h => {
          const pct = Math.min((h.seconds / maxVal) * 100, 100);
          return (
            <div key={h.hour} className="histo-col" title={`${h.label}: ${fmtMins(h.seconds)}`}>
              <div className="histo-track">
                <motion.div
                  className={`histo-fill ${h.hour === curHour ? "cur" : ""} ${h.live ? "live" : ""}`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: pct / 100 }}
                  style={{ originY: 1 }}
                  transition={{ duration: 0.5, ease: [0.4,0,0.2,1] }}
                />
              </div>
              {h.hour % 6 === 0 && <span className="histo-lbl">{h.label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldBar({ field, secs, total, color, idx }) {
  const pct = total > 0 ? Math.round((secs / total) * 100) : 0;
  return (
    <div className="fb-item">
      <div className="fb-top">
        <span className="fb-dot" style={{ background: color }} />
        <span className="fb-name">{field}</span>
        <span className="fb-time">{fmtTime(secs)}</span>
        <span className="fb-pct">{pct}%</span>
      </div>
      <div className="fb-track">
        <motion.div
          className="fb-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.4,0,0.2,1], delay: idx * 0.05 }}
        />
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function StartSession() {
  /* Auth */
  const [user, setUser]         = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading]   = useState(true);

  /* Timer */
  const [time, setTime]               = useState(0);
  const [isRunning, setIsRunning]     = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  const [pomodoroLeft, setPomodoroLeft] = useState(25 * 60);
  const [pomodoroRounds, setPomodoroRounds] = useState(0);
  const [isBreak, setIsBreak]         = useState(false);

  /* Strict Mode */
  const [strictMode, setStrictMode]   = useState(false);
  const strictRef = useRef(false);
  useEffect(() => { strictRef.current = strictMode; }, [strictMode]);

  /* Wake Lock */
  const wakeLockRef = useRef(null);
  const acquireWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (_) {}
  }, []);
  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === "visible" && isRunning) {
        await acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isRunning, acquireWakeLock]);

  /* Fields */
  const [selectedField, setSelectedField] = useState("General");
  const [newFieldName, setNewFieldName]   = useState("");

  /* Remove Field Modal */
  const [removeModal, setRemoveModal] = useState({ open: false, field: null, keepTime: false });

  /* Tasks */
  const [todoList, setTodoList]       = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [editingTask, setEditingTask]   = useState({ id: null, text: "" });
  const [lastDeleted, setLastDeleted]   = useState(null);

  /* Active Tab */
  const [activeTab, setActiveTab] = useState("timer"); // timer | tasks | stats

  /* Nav Warning */
  const [navWarning, setNavWarning] = useState({ open: false, cb: null });

  /* Strict Block Overlay */
  const [strictBlock, setStrictBlock] = useState(false);

  /* Refs */
  const timerRef         = useRef(null);
  const startTimeRef     = useRef(null);
  const accumulatedRef   = useRef(0);
  const isRunningRef     = useRef(false);
  const pomodoroModeRef  = useRef(false);
  const selectedFieldRef = useRef("General");
  const userRef          = useRef(null);
  const unsubRef         = useRef(null);

  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { pomodoroModeRef.current = pomodoroMode; }, [pomodoroMode]);
  useEffect(() => { selectedFieldRef.current = selectedField; }, [selectedField]);

  /* Firestore helpers */
  const todayKey = useCallback(() => localYMD(), []);
  const weekKey  = useCallback(() => localWeekStart(), []);
  const monthKey = useCallback(() => localYM(), []);

  const setupListener = useCallback((uid) => {
    const ref = doc(db, "users", uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setTodoList(data.todoList || []);
        const fields = data.studyFields || ["General"];
        setSelectedField(prev => {
          const v = fields.includes(prev) ? prev : fields[0] || "General";
          selectedFieldRef.current = v;
          return v;
        });
      } else {
        initDoc(uid);
      }
      setLoading(false);
    }, err => {
      console.error(err);
      toast.error("Database connection error");
      setLoading(false);
    });
  }, []); // eslint-disable-line

  const initDoc = useCallback(async (uid) => {
    const dk = localYMD(), wk = localWeekStart(), mk = localYM();
    const base = {
      email: auth.currentUser?.email || "",
      name: auth.currentUser?.displayName || "User",
      createdAt: serverTimestamp(),
      todoList: [], studyFields: ["General"], fieldTimes: {},
      totalTimeToday: 0, totalTimeWeek: 0, totalTimeMonth: 0, totalTimeAllTime: 0,
      lastStudyDate: null,
      dailyStats:   { [dk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0, hourly: {} } },
      weeklyStats:  { [wk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
      monthlyStats: { [mk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
    };
    try { await setDoc(doc(db, "users", uid), base); } catch (e) { console.error(e); }
  }, []);

  /* Auth listener */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (u) {
        setUser(u); userRef.current = u;
        unsubRef.current = setupListener(u.uid);
      } else {
        setUser(null); setUserData(null); setLoading(false);
        unsubRef.current?.();
      }
    });
    return () => { unsub(); unsubRef.current?.(); };
  }, [setupListener]);

  /* Tab-switch / visibility handling */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (!isRunningRef.current) return;
        if (strictRef.current) {
          setStrictBlock(true);
          // Timer keeps running — we do NOT stop it
          toast.error("🔒 You left the tab! Return to continue your session.", { duration: 4000 });
        }
        // Non-strict: timer continues silently
      } else {
        // Came back
        if (strictRef.current && isRunningRef.current) {
          setStrictBlock(false);
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* beforeunload — strict mode blocks page exit */
  useEffect(() => {
    const onUnload = (e) => {
      if (isRunningRef.current) {
        e.preventDefault();
        e.returnValue = strictRef.current
          ? "🔒 Strict mode is ON — you cannot leave while the timer is running!"
          : "Timer is running! Leaving will save your progress so far.";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  /* Timer tick — uses wall-clock diff so it survives tab hiding / screen off */
  const tick = useCallback(() => {
    if (!isRunningRef.current || !startTimeRef.current) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + accumulatedRef.current;
    if (pomodoroModeRef.current) {
      const SESSION = 25 * 60;
      const remaining = Math.max(0, SESSION - (elapsed % SESSION));
      setPomodoroLeft(remaining);
      if (remaining === 0) {
        setPomodoroRounds(r => r + 1);
        toast.success("🍅 Pomodoro complete! Take a break.");
        setIsBreak(true);
        stopTimerInternal(elapsed);
      }
    } else {
      setTime(elapsed);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [tick]);

  /* Expose for TopBar */
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

  /* Save session */
  const saveSession = useCallback(async (sessionTime) => {
    if (!userRef.current || sessionTime <= 0) return;
    const uid = userRef.current.uid;
    const field = selectedFieldRef.current;
    const dk = localYMD(), wk = localWeekStart(), mk = localYM();
    const curHour = String(new Date().getHours()).padStart(2, "0");
    await updateDoc(doc(db, "users", uid), {
      [`fieldTimes.${field}`]:                               increment(sessionTime),
      totalTimeToday:                                        increment(sessionTime),
      totalTimeWeek:                                         increment(sessionTime),
      totalTimeMonth:                                        increment(sessionTime),
      totalTimeAllTime:                                      increment(sessionTime),
      [`dailyStats.${dk}.totalTime`]:                        increment(sessionTime),
      [`dailyStats.${dk}.fieldTimes.${field}`]:              increment(sessionTime),
      [`dailyStats.${dk}.sessionsCount`]:                    increment(1),
      [`dailyStats.${dk}.hourly.${curHour}`]:                increment(sessionTime),
      [`weeklyStats.${wk}.totalTime`]:                       increment(sessionTime),
      [`weeklyStats.${wk}.fieldTimes.${field}`]:             increment(sessionTime),
      [`weeklyStats.${wk}.sessionsCount`]:                   increment(1),
      [`monthlyStats.${mk}.totalTime`]:                      increment(sessionTime),
      [`monthlyStats.${mk}.fieldTimes.${field}`]:            increment(sessionTime),
      [`monthlyStats.${mk}.sessionsCount`]:                  increment(1),
      lastStudyDate: serverTimestamp(),
    });
  }, []);

  const stopTimerInternal = useCallback(async (overrideTime) => {
    setIsRunning(false);
    releaseWakeLock();
    if (!userRef.current || !startTimeRef.current) return;
    const sessionTime = overrideTime !== undefined
      ? overrideTime
      : Math.floor((Date.now() - startTimeRef.current) / 1000) + accumulatedRef.current;
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    setTime(0);
    setPomodoroLeft(25 * 60);
    if (sessionTime > 5) {
      try {
        await saveSession(sessionTime);
        toast.success(`✅ Saved ${fmtTime(sessionTime)} for ${selectedFieldRef.current}`);
      } catch (e) {
        toast.error("Failed to save session");
      }
    }
  }, [saveSession, releaseWakeLock]);

  const startTimer = useCallback(async () => {
    if (!userRef.current) return toast.error("Please log in first");
    setIsRunning(true);
    setIsBreak(false);
    startTimeRef.current = Date.now();
    accumulatedRef.current = pomodoroMode ? (25 * 60 - pomodoroLeft) : time;
    await acquireWakeLock();
    toast.success(`📚 Studying: ${selectedField}${strictMode ? "  🔒 Strict mode ON" : ""}`);
  }, [pomodoroMode, pomodoroLeft, time, selectedField, strictMode, acquireWakeLock]);

  const stopTimer  = useCallback(() => stopTimerInternal(), [stopTimerInternal]);
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    releaseWakeLock();
    setTime(0);
    setPomodoroLeft(25 * 60);
    setPomodoroRounds(0);
    setIsBreak(false);
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    toast("Timer reset");
  }, [releaseWakeLock]);

  /* Field management */
  const userDocRef = useCallback(() => userRef.current ? doc(db, "users", userRef.current.uid) : null, []);

  const addField = useCallback(async () => {
    const name = newFieldName.trim();
    if (!name) return toast.error("Enter a field name");
    const fields = userData?.studyFields || ["General"];
    if (fields.includes(name)) return toast.error("Field already exists");
    if (!userRef.current) return;
    try {
      await updateDoc(userDocRef(), { studyFields: [...fields, name] });
      setNewFieldName("");
      toast.success(`"${name}" added`);
    } catch { toast.error("Failed to add field"); }
  }, [newFieldName, userData?.studyFields, userDocRef]);

  const openRemoveModal = useCallback((field) => {
    if (field === "General") return toast.error("Cannot remove General field");
    if ((userData?.studyFields || []).length <= 1) return toast.error("Need at least one field");
    setRemoveModal({ open: true, field, keepTime: false });
  }, [userData?.studyFields]);

  const confirmRemoveField = useCallback(async () => {
    const { field, keepTime } = removeModal;
    if (!field || !userRef.current) return;
    const uid = userRef.current.uid;
    const fields = (userData?.studyFields || []).filter(f => f !== field);
    const fieldTime = userData?.fieldTimes?.[field] || 0;
    const dk = localYMD(), wk = localWeekStart(), mk = localYM();
    const update = {
      studyFields: fields,
      [`fieldTimes.${field}`]: null,
      [`dailyStats.${dk}.fieldTimes.${field}`]:   null,
      [`weeklyStats.${wk}.fieldTimes.${field}`]:  null,
      [`monthlyStats.${mk}.fieldTimes.${field}`]: null,
    };
    if (!keepTime && fieldTime > 0) update.totalTimeAllTime = increment(-fieldTime);
    try {
      await updateDoc(doc(db, "users", uid), update);
      if (selectedField === field) setSelectedField(fields[0] || "General");
      toast.success(`"${field}" removed`);
      setRemoveModal({ open: false, field: null, keepTime: false });
    } catch { toast.error("Failed to remove field"); }
  }, [removeModal, userData, selectedField]);

  /* Task management */
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
      toast.success("Task added!");
    } catch { toast.error("Failed to add task"); }
  }, [newTaskText, taskPriority, taskDeadline, selectedField, todoList, userDocRef]);

  const toggleTask = useCallback(async (id) => {
    if (!userRef.current) return;
    const updated = todoList.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    try { await updateDoc(userDocRef(), { todoList: updated }); }
    catch { toast.error("Failed to update task"); }
  }, [todoList, userDocRef]);

  const deleteTask = useCallback(async (id) => {
    const task = todoList.find(t => t.id === id);
    setLastDeleted(task);
    try {
      await updateDoc(userDocRef(), { todoList: todoList.filter(t => t.id !== id) });
      toast.success("Task deleted");
    } catch { toast.error("Failed to delete task"); }
  }, [todoList, userDocRef]);

  const undoDelete = useCallback(async () => {
    if (!lastDeleted || !userRef.current) return;
    try {
      await updateDoc(userDocRef(), { todoList: [...todoList, lastDeleted] });
      setLastDeleted(null); toast.success("Task restored!");
    } catch { toast.error("Failed to restore"); }
  }, [lastDeleted, todoList, userDocRef]);

  const saveEdit = useCallback(async (id) => {
    if (!editingTask.text.trim()) return toast.error("Task cannot be empty");
    if (!userRef.current) return;
    const updated = todoList.map(t => t.id === id ? { ...t, text: editingTask.text.trim() } : t);
    try {
      await updateDoc(userDocRef(), { todoList: updated });
      setEditingTask({ id: null, text: "" }); toast.success("Task updated!");
    } catch { toast.error("Failed to update task"); }
  }, [editingTask, todoList, userDocRef]);

  const sortByPriority = useCallback(async () => {
    const sorted = [...todoList].sort((a, b) => (PRIORITY_ORDER[a.priority]||4) - (PRIORITY_ORDER[b.priority]||4));
    try { await updateDoc(userDocRef(), { todoList: sorted }); toast.success("Sorted by priority"); }
    catch { toast.error("Sort failed"); }
  }, [todoList, userDocRef]);

  const sortByDeadline = useCallback(async () => {
    const sorted = [...todoList].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1; if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
    try { await updateDoc(userDocRef(), { todoList: sorted }); toast.success("Sorted by deadline"); }
    catch { toast.error("Sort failed"); }
  }, [todoList, userDocRef]);

  /* Nav warning */
  const handleContinueStudying = () => setNavWarning({ open: false, cb: null });
  const handlePauseNavigate    = async () => {
    await stopTimer();
    setNavWarning(prev => { if (prev.cb) setTimeout(prev.cb, 100); return { open: false, cb: null }; });
  };

  /* Derived */
  const studyFields  = useMemo(() => userData?.studyFields || ["General"], [userData?.studyFields]);
  const sortedFields = useMemo(() => {
    if (!userData?.fieldTimes) return [];
    return Object.entries(userData.fieldTimes)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [userData?.fieldTimes]);

  const timeStats = useMemo(() => ({
    today:   userData?.totalTimeToday   || 0,
    week:    userData?.totalTimeWeek    || 0,
    month:   userData?.totalTimeMonth   || 0,
    allTime: userData?.totalTimeAllTime || 0,
  }), [userData]);

  const filteredTasks = useMemo(() => todoList.filter(t => {
    if (filterOption === "All")       return true;
    if (filterOption === "Completed") return t.completed;
    if (filterOption === "Pending")   return !t.completed;
    return t.priority === filterOption;
  }), [todoList, filterOption]);

  const taskStats = useMemo(() => {
    const total     = todoList.length;
    const completed = todoList.filter(t => t.completed).length;
    const high      = todoList.filter(t => t.priority === "High").length;
    return { total, completed, pending: total - completed, high };
  }, [todoList]);

  const liveSeconds = useMemo(() => {
    if (!isRunning || !startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, [isRunning, time]);

  const pomodoroProgress = pomodoroMode ? ((25 * 60 - pomodoroLeft) / (25 * 60)) * 100 : 0;
  const displayTime = pomodoroMode ? pomodoroLeft : time;
  const timerState  = isBreak ? "break" : isRunning ? "running" : "idle";

  /* ── Render ─────────────────────────────────────────────── */
  if (loading) return (
    <div className="ss-page"><div className="ss-center-state">
      <div className="ss-spinner" /><p>Loading session…</p>
    </div></div>
  );
  if (!user) return (
    <div className="ss-page"><div className="ss-center-state">
      <span className="ss-big-icon">🔒</span>
      <h2>Not Logged In</h2><p>Please sign in to start a study session.</p>
    </div></div>
  );

  const TABS = [
    { id: "timer", label: "Timer",      icon: "⏱" },
    { id: "tasks", label: "Tasks",      icon: "📋", badge: taskStats.pending || null },
    { id: "stats", label: "Statistics", icon: "📊", live: isRunning },
  ];

  return (
    <div className="ss-page">

      {/* ── Strict Block Overlay ── */}
      <AnimatePresence>
        {strictBlock && isRunning && (
          <motion.div className="ss-strict-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ss-strict-box"
              initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}>
              <div className="ss-strict-icon">🔒</div>
              <h2>Strict Mode Active</h2>
              <p>You switched tabs! Your timer is still running. Come back and focus.</p>
              <button className="ss-btn-primary" onClick={() => setStrictBlock(false)}>
                I'm Back — Resume Focus
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav Warning Modal ── */}
      <AnimatePresence>
        {navWarning.open && (
          <motion.div className="ss-modal-back"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ss-modal"
              initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}>
              <div className="ss-modal-head ss-modal-head--warn">
                <h3>⏱ Timer Running</h3>
                <button className="ss-modal-close" onClick={handleContinueStudying}>✕</button>
              </div>
              <div className="ss-modal-body">
                <p>Navigating away will stop your timer and save progress so far.</p>
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-ghost" onClick={handleContinueStudying}>Keep Studying</button>
                <button className="ss-btn-danger" onClick={handlePauseNavigate}>Stop & Leave</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Remove Field Modal ── */}
      <AnimatePresence>
        {removeModal.open && (
          <motion.div className="ss-modal-back"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>
            <motion.div className="ss-modal" onClick={e => e.stopPropagation()}
              initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}>
              <div className="ss-modal-head">
                <h3>Remove Field</h3>
                <button className="ss-modal-close" onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>✕</button>
              </div>
              <div className="ss-modal-body">
                <p>Remove <strong style={{ color: "#c084fc" }}>{removeModal.field}</strong>?
                  {userData?.fieldTimes?.[removeModal.field] > 0 && (
                    <> This field has <strong style={{ color: "#c084fc" }}>{fmtTime(userData.fieldTimes[removeModal.field])}</strong> of study time.</>
                  )}
                </p>
                {userData?.fieldTimes?.[removeModal.field] > 0 && (
                  <label className="ss-check-row">
                    <input type="checkbox" checked={removeModal.keepTime}
                      onChange={e => setRemoveModal(p => ({ ...p, keepTime: e.target.checked }))} />
                    Keep time in totals
                  </label>
                )}
              </div>
              <div className="ss-modal-foot">
                <button className="ss-btn-ghost" onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>Cancel</button>
                <button className="ss-btn-danger" onClick={confirmRemoveField}>Remove</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ss-container">

        {/* ── Page Header ── */}
        <motion.div className="ss-header"
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4,0,0.2,1] }}>
          <div className="ss-header-left">
            <Lottie animationData={clockAnimation} loop={isRunning} className="ss-lottie" />
            <div>
              <h1 className="ss-title">Study Session</h1>
              <p className="ss-subtitle">
                {isRunning
                  ? <><span className="ss-live-dot" />Studying <strong>{selectedField}</strong></>
                  : "Ready to focus?"}
              </p>
            </div>
          </div>
          <div className="ss-header-stats">
            <StatBadge icon="📅" label="Today"   value={fmtTime(timeStats.today)} />
            <StatBadge icon="📆" label="Week"    value={fmtTime(timeStats.week)} />
            <StatBadge icon="🗓" label="Month"   value={fmtTime(timeStats.month)} />
            <StatBadge icon="📚" label="Field"   value={selectedField} />
          </div>
        </motion.div>

        {/* ── Tab Bar ── */}
        <div className="ss-tabbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`ss-tab ${activeTab === tab.id ? "ss-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="ss-tab-icon">{tab.icon}</span>
              <span className="ss-tab-label">{tab.label}</span>
              {tab.badge > 0 && <span className="ss-tab-badge">{tab.badge}</span>}
              {tab.live && <span className="ss-tab-live" />}
            </button>
          ))}
        </div>

        {/* ── Tab Panels ── */}
        <AnimatePresence mode="wait">

          {/* ══ TIMER TAB ══════════════════════════════════════ */}
          {activeTab === "timer" && (
            <motion.div key="timer"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: [0.4,0,0.2,1] }}
              className="ss-panel">

              <div className="ss-timer-grid">

                {/* Clock Card */}
                <div className="ss-card ss-clock-card">
                  <CircularProgress
                    pct={pomodoroMode ? pomodoroProgress : 0}
                    size={220}
                    stroke={12}
                    color={timerState === "running" ? "#34d399" : timerState === "break" ? "#fbbf24" : "#a855f7"}
                  >
                    <div className={`ss-timer-face ss-timer-face--${timerState}`}>
                      <div className="ss-timer-mode">
                        {pomodoroMode ? "🍅 Pomodoro" : "⏱ Stopwatch"}
                      </div>
                      <div className="ss-timer-digits">{fmtTime(displayTime)}</div>
                      {pomodoroMode && pomodoroRounds > 0 && (
                        <div className="ss-pomodoro-rounds">Round {pomodoroRounds}</div>
                      )}
                    </div>
                  </CircularProgress>

                  <div className="ss-timer-controls">
                    {isRunning
                      ? <button className="ss-btn-stop" onClick={stopTimer}>⏹ Stop</button>
                      : <button className="ss-btn-start" onClick={startTimer}>▶ Start</button>}
                    <button className="ss-btn-reset" onClick={resetTimer} disabled={isRunning}>↺ Reset</button>
                  </div>

                  <label className={`ss-toggle-row ${isRunning ? "ss-toggle-row--locked" : ""}`}>
                    <input type="checkbox" checked={pomodoroMode}
                      onChange={e => !isRunning && setPomodoroMode(e.target.checked)} disabled={isRunning} />
                    <span className="ss-toggle-label">Pomodoro Mode (25 min)</span>
                  </label>
                </div>

                {/* Right Column */}
                <div className="ss-timer-right">

                  {/* Strict Mode Card */}
                  <div className="ss-card ss-strict-card">
                    <div className="ss-card-title">Focus Mode</div>
                    <div className="ss-strict-row">
                      <div className="ss-strict-info">
                        <span className="ss-strict-bigicon">{strictMode ? "🔒" : "🔓"}</span>
                        <div>
                          <div className="ss-strict-name">Strict Mode</div>
                          <div className="ss-strict-desc">
                            {strictMode
                              ? "Tab switching triggers a warning. Page exit is blocked while timer runs."
                              : "Timer runs in background. You can switch tabs freely."}
                          </div>
                        </div>
                      </div>
                      <button
                        className={`ss-strict-toggle ${strictMode ? "ss-strict-toggle--on" : ""} ${isRunning ? "ss-strict-toggle--locked" : ""}`}
                        onClick={() => {
                          if (isRunning) return toast.error("Stop the timer to change strict mode");
                          const next = !strictMode;
                          setStrictMode(next);
                          toast(next ? "🔒 Strict mode ON" : "🔓 Strict mode OFF", { icon: next ? "🔒" : "🔓" });
                        }}
                        title={isRunning ? "Stop timer to change strict mode" : "Toggle strict mode"}
                      >
                        <span className="ss-strict-knob" />
                      </button>
                    </div>
                    <div className="ss-strict-pills">
                      <span className={`ss-pill ${strictMode ? "ss-pill--red" : "ss-pill--muted"}`}>
                        {strictMode ? "✕ Tab switching triggers warning" : "✓ Tab switching: allowed"}
                      </span>
                      <span className={`ss-pill ${strictMode ? "ss-pill--red" : "ss-pill--green"}`}>
                        {strictMode ? "✕ Page exit: blocked while running" : "✓ Page exit: allowed"}
                      </span>
                      <span className="ss-pill ss-pill--green">
                        ✓ Screen off: timer continues (mobile)
                      </span>
                    </div>
                  </div>

                  {/* Field Management Card */}
                  <div className="ss-card ss-field-card">
                    <div className="ss-card-title">Study Field</div>
                    <select className="ss-select" value={selectedField}
                      onChange={e => setSelectedField(e.target.value)} disabled={isRunning}>
                      {studyFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="ss-add-field-row">
                      <input className="ss-input" type="text" placeholder="New field…"
                        value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addField()} />
                      <button className="ss-btn-add" onClick={addField}>+ Add</button>
                    </div>
                    {sortedFields.length > 0 && (
                      <div className="ss-field-list">
                        {sortedFields.map(([field, t], i) => (
                          <div key={field} className={`ss-field-item ${field === selectedField && isRunning ? "ss-field-item--active" : ""}`}>
                            <span className="ss-field-dot" style={{ background: FIELD_COLORS[i % FIELD_COLORS.length] }} />
                            <span className="ss-field-name">{field}</span>
                            <span className="ss-field-time">{fmtTime(t)}</span>
                            {field !== "General" && (
                              <button className="ss-field-remove" onClick={() => openRemoveModal(field)} title="Remove">✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ TASKS TAB ══════════════════════════════════════ */}
          {activeTab === "tasks" && (
            <motion.div key="tasks"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: [0.4,0,0.2,1] }}
              className="ss-panel">

              <div className="ss-card ss-tasks-card">
                <div className="ss-tasks-header">
                  <h2 className="ss-card-title-lg">📋 To-Do List</h2>
                  <div className="ss-task-mini-stats">
                    <span className="ss-mini-stat ss-mini-stat--purple">{taskStats.total} total</span>
                    <span className="ss-mini-stat ss-mini-stat--green">{taskStats.completed} done</span>
                    <span className="ss-mini-stat ss-mini-stat--yellow">{taskStats.pending} pending</span>
                    <span className="ss-mini-stat ss-mini-stat--red">{taskStats.high} high</span>
                  </div>
                </div>

                {/* Input */}
                <div className="ss-task-input-group">
                  <input className="ss-input ss-task-main-input" type="text"
                    placeholder="What do you need to do?"
                    value={newTaskText} onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTask()} />
                  <div className="ss-task-input-row">
                    <select className="ss-select ss-select--sm" value={taskPriority}
                      onChange={e => setTaskPriority(e.target.value)}>
                      <option value="Low">🟢 Low</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="High">🔴 High</option>
                    </select>
                    <input className="ss-input ss-input--date" type="date"
                      value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)}
                      min={new Date().toISOString().split("T")[0]} />
                    <button className="ss-btn-primary" onClick={addTask}>+ Add Task</button>
                  </div>
                </div>

                {/* Filters + Sort */}
                <div className="ss-task-filter-row">
                  <select className="ss-select ss-select--sm" value={filterOption}
                    onChange={e => setFilterOption(e.target.value)}>
                    <option value="All">All ({taskStats.total})</option>
                    <option value="Completed">Completed ({taskStats.completed})</option>
                    <option value="Pending">Pending ({taskStats.pending})</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                  <button className="ss-btn-ghost ss-btn-ghost--sm" onClick={sortByPriority}>↕ Priority</button>
                  <button className="ss-btn-ghost ss-btn-ghost--sm" onClick={sortByDeadline}>📅 Deadline</button>
                </div>

                {/* Task List */}
                {filteredTasks.length > 0 ? (
                  <div className="ss-task-list">
                    <AnimatePresence>
                      {filteredTasks.map(task => (
                        <motion.div key={task.id}
                          className={`ss-task-item ${task.completed ? "ss-task-item--done" : ""} ss-task-item--${task.priority.toLowerCase()}`}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }} layout>
                          <div className="ss-task-body">
                            {editingTask.id === task.id ? (
                              <input className="ss-task-edit-input" value={editingTask.text}
                                onChange={e => setEditingTask(p => ({ ...p, text: e.target.value }))}
                                onBlur={() => saveEdit(task.id)}
                                onKeyDown={e => { if (e.key==="Enter") saveEdit(task.id); if (e.key==="Escape") setEditingTask({id:null,text:""}); }}
                                autoFocus />
                            ) : (
                              <>
                                <div className={`ss-task-text ${task.completed ? "ss-task-text--done" : ""}`}
                                  onClick={() => toggleTask(task.id)}>{task.text}</div>
                                <div className="ss-task-meta">
                                  <span className={`ss-priority-chip ss-priority-chip--${task.priority.toLowerCase()}`}>{task.priority}</span>
                                  {task.deadline && (
                                    <span className={`ss-deadline-chip ${new Date(task.deadline) < new Date() && !task.completed ? "ss-deadline-chip--overdue" : ""}`}>
                                      {new Date(task.deadline) < new Date() && !task.completed ? "⚠ " : "📅 "}
                                      {new Date(task.deadline + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="ss-task-actions">
                            <button className="ss-task-btn ss-task-btn--check" onClick={() => toggleTask(task.id)}
                              title={task.completed ? "Mark pending" : "Mark done"}>{task.completed ? "↩" : "✓"}</button>
                            <button className="ss-task-btn ss-task-btn--edit" onClick={() => setEditingTask({ id: task.id, text: task.text })}
                              title="Edit">✎</button>
                            <button className="ss-task-btn ss-task-btn--del" onClick={() => deleteTask(task.id)}
                              title="Delete">🗑</button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="ss-empty">
                    {filterOption === "All" ? "No tasks yet — add one above!" : `No ${filterOption.toLowerCase()} tasks.`}
                  </div>
                )}

                <AnimatePresence>
                  {lastDeleted && (
                    <motion.div className="ss-undo-bar"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                      <span>Deleted: <strong>"{lastDeleted.text}"</strong></span>
                      <button className="ss-btn-primary ss-btn-primary--sm" onClick={undoDelete}>Undo</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ══ STATS TAB ══════════════════════════════════════ */}
          {activeTab === "stats" && (
            <motion.div key="stats"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: [0.4,0,0.2,1] }}
              className="ss-panel">

              <div className="ss-stats-grid">

                {/* Summary row */}
                <div className="ss-card ss-stats-summary">
                  <div className="ss-stats-summary-head">
                    <h2 className="ss-card-title-lg">📊 Study Statistics</h2>
                    {isRunning && <span className="ss-live-badge">● LIVE</span>}
                  </div>
                  <div className="ss-summary-row">
                    {[
                      { label: "Today",    val: fmtTime(timeStats.today + (isRunning ? liveSeconds : 0)) },
                      { label: "This Week",val: fmtTime(timeStats.week) },
                      { label: "Month",    val: fmtTime(timeStats.month) },
                      { label: "All Time", val: fmtTime(timeStats.allTime + (isRunning ? liveSeconds : 0)) },
                      { label: "Sessions", val: userData?.dailyStats?.[localYMD()]?.sessionsCount || 0 },
                      { label: "Fields",   val: sortedFields.length },
                    ].map(({ label, val }) => (
                      <div key={label} className="ss-summary-box">
                        <div className="ss-summary-label">{label}</div>
                        <div className="ss-summary-val">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Field Breakdown */}
                {sortedFields.length > 0 && (
                  <div className="ss-card">
                    <div className="ss-card-title">Field Breakdown</div>
                    <div className="ss-field-breakdown">
                      {sortedFields.map(([field, secs], i) => (
                        <FieldBar key={field} field={field} secs={secs}
                          total={timeStats.today + (isRunning ? liveSeconds : 0)}
                          color={FIELD_COLORS[i % FIELD_COLORS.length]} idx={i} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Hourly Chart */}
                <div className="ss-card">
                  <div className="ss-card-title">
                    Activity by Hour
                    {isRunning && <span className="ss-live-tag">live</span>}
                  </div>
                  <HourHistogram
                    dailyStats={userData?.dailyStats}
                    isRunning={isRunning}
                    liveSeconds={liveSeconds}
                  />
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}