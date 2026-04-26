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

/* ─── Animation Variants ─── */
const fadeUp = {
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0  },
  exit:       { opacity: 0, y: -8 },
  transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
};
const listVariants = { animate: { transition: { staggerChildren: 0.05 } } };
const itemVariant  = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

const panelVariants = {
  initial: { opacity: 0, y: 40, scale: 0.97 },
  animate: { opacity: 1, y: 0,  scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 28 } },
  exit:    { opacity: 0, y: 30, scale: 0.97,
    transition: { duration: 0.22 } },
};

/* ─── Helpers ─── */
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
  const day  = d.getDay() === 0 ? 7 : d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (day - 1));
  return localYMD(start);
}

/* ─── Per-Hour Histogram ─── */
function HourHistogram({ dailyStats, isRunning, selectedField, liveSeconds }) {
  const todayKey = localYMD();
  const todayData = dailyStats?.[todayKey] || {};

  // Build 24-hour array from dailyStats hourly breakdown
  // We store per-hour data as dailyStats[date].hourly[HH] = seconds
  const hours = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
      seconds: todayData?.hourly?.[String(i).padStart(2, "0")] || 0,
    }));
    // Add live seconds to current hour
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
          const isCur = h.hour === curHour;
          return (
            <div key={h.hour} className="histo-col">
              <div className="histo-bar-track">
                <motion.div
                  className={`histo-bar ${isCur ? "current" : ""} ${h.live ? "live" : ""}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  title={`${h.label}: ${fmtMins(h.seconds)}`}
                />
              </div>
              {(h.hour % 3 === 0) && (
                <div className="histo-label">{h.label}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="histogram-legend">
        <span className="hleg-dot current" /> Current hour
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

  const COLORS = [
    "var(--purple-400)", "#34d399", "#60a5fa", "#fbbf24",
    "#f87171", "#a78bfa", "#fb923c", "#38bdf8",
  ];

  if (!sorted.length) {
    return <div className="no-fields-msg">No study time recorded today yet!</div>;
  }

  return (
    <div className="field-breakdown">
      {sorted.map(([field, secs], i) => {
        const pct = totalTime > 0 ? Math.round((secs / totalTime) * 100) : 0;
        return (
          <div key={field} className="fb-row">
            <div className="fb-info">
              <span className="fb-dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="fb-name">{field}</span>
              <span className="fb-time">{fmtTime(secs)}</span>
              <span className="fb-pct">{pct}%</span>
            </div>
            <div className="fb-bar-track">
              <motion.div
                className="fb-bar"
                style={{ background: COLORS[i % COLORS.length] }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: i * 0.06 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SESSION COMPONENT
═══════════════════════════════════════════════ */
function StartSession() {
  /* ─ Auth & data ─ */
  const [user, setUser]         = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading]   = useState(true);

  /* ─ Timer ─ */
  const [time, setTime]                           = useState(0);
  const [isRunning, setIsRunning]                 = useState(false);
  const [pomodoroMode, setPomodoroMode]           = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft]   = useState(25 * 60);
  const [pomodoroRounds, setPomodoroRounds]       = useState(0);
  const [isBreak, setIsBreak]                     = useState(false);

  /* ─ Strict Mode ─ */
  const [strictMode, setStrictMode] = useState(false);
  const strictModeRef = useRef(false);
  useEffect(() => { strictModeRef.current = strictMode; }, [strictMode]);

  /* ─ Fields ─ */
  const [selectedField, setSelectedField] = useState("General");
  const [newFieldName, setNewFieldName]   = useState("");

  /* ─ Field removal modal ─ */
  const [removeModal, setRemoveModal]   = useState({ open: false, field: null, keepTime: false });

  /* ─ Tasks ─ */
  const [todoList, setTodoList]         = useState([]);
  const [newTaskText, setNewTaskText]   = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [editingTask, setEditingTask]   = useState({ id: null, text: "" });
  const [lastDeleted, setLastDeleted]   = useState(null);

  /* ─ Overlay panels ─ */
  const [showTasks, setShowTasks]   = useState(false);
  const [showStats, setShowStats]   = useState(false);

  /* ─ Nav warning ─ */
  const [navWarning, setNavWarning] = useState({ open: false, cb: null });

  /* ─ Refs ─ */
  const timerRef           = useRef(null);
  const startTimeRef       = useRef(null);
  const accumulatedRef     = useRef(0);
  const isRunningRef       = useRef(false);
  const pomodoroModeRef    = useRef(false);
  const selectedFieldRef   = useRef("General");
  const userRef            = useRef(null);
  const unsubRef           = useRef(null);

  /* ─ Keep refs in sync ─ */
  useEffect(() => { isRunningRef.current    = isRunning;     }, [isRunning]);
  useEffect(() => { pomodoroModeRef.current = pomodoroMode;  }, [pomodoroMode]);
  useEffect(() => { selectedFieldRef.current = selectedField; }, [selectedField]);

  /* ═══ Date helpers ═══ */
  const todayKey = useCallback(() => localYMD(),       []);
  const weekKey  = useCallback(() => localWeekStart(), []);
  const monthKey = useCallback(() => localYM(),        []);

  /* ═══ Real-time listener ═══ */
  const setupListener = useCallback((uid) => {
    const ref = doc(db, "users", uid);
    return onSnapshot(
      ref,
      (snap) => {
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
      },
      (err) => {
        console.error(err);
        toast.error("Database connection error");
        setLoading(false);
      }
    );
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
      dailyStats:   { [dk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0, hourly: {} } },
      weeklyStats:  { [wk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
      monthlyStats: { [mk]: { totalTime: 0, fieldTimes: {}, sessionsCount: 0 } },
    };
    try { await setDoc(doc(db, "users", uid), base); }
    catch (e) { console.error(e); }
  }, []);

  /* ═══ Auth listener ═══ */
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
        unsubRef.current?.();
      }
    });
    return () => { unsub(); unsubRef.current?.(); };
  }, [setupListener]);

  /* ═══ Background Timer Tick ═══ */
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

  /* ═══ Visibility / Tab switching ═══ */
  useEffect(() => {
    const onHide = () => {
      if (!isRunningRef.current) return;
      if (strictModeRef.current) {
        // Strict mode: pause and warn
        toast.error("🔒 Strict mode: tab switch detected! Timer paused.");
        stopTimer();
      }
      // Non-strict: do nothing — timer keeps running
    };
    const onUnload = (e) => {
      if (isRunningRef.current) { e.preventDefault(); e.returnValue = "Timer running!"; }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []); // eslint-disable-line

  /* ═══ Expose timer state for TopBar ═══ */
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
      [`fieldTimes.${field}`]:                                   increment(sessionTime),
      totalTimeToday:                                            increment(sessionTime),
      totalTimeWeek:                                             increment(sessionTime),
      totalTimeMonth:                                            increment(sessionTime),
      totalTimeAllTime:                                          increment(sessionTime),
      [`dailyStats.${dk}.totalTime`]:                            increment(sessionTime),
      [`dailyStats.${dk}.fieldTimes.${field}`]:                  increment(sessionTime),
      [`dailyStats.${dk}.sessionsCount`]:                        increment(1),
      [`dailyStats.${dk}.hourly.${curHour}`]:                    increment(sessionTime),
      [`weeklyStats.${wk}.totalTime`]:                           increment(sessionTime),
      [`weeklyStats.${wk}.fieldTimes.${field}`]:                 increment(sessionTime),
      [`weeklyStats.${wk}.sessionsCount`]:                       increment(1),
      [`monthlyStats.${mk}.totalTime`]:                          increment(sessionTime),
      [`monthlyStats.${mk}.fieldTimes.${field}`]:                increment(sessionTime),
      [`monthlyStats.${mk}.sessionsCount`]:                      increment(1),
      lastStudyDate: serverTimestamp(),
    });
  }, []);

  /* ═══ Timer Controls ═══ */
  const startTimer = useCallback(() => {
    if (!userRef.current) return toast.error("Please log in first");
    setIsRunning(true);
    setIsBreak(false);
    startTimeRef.current = Date.now();
    accumulatedRef.current = pomodoroMode ? (25 * 60 - pomodoroTimeLeft) : time;
    toast.success(`📚 Studying ${selectedField}${strictMode ? " · 🔒 Strict" : ""}`);
  }, [pomodoroMode, pomodoroTimeLeft, time, selectedField, strictMode]);

  const stopTimer = useCallback(async () => {
    setIsRunning(false);
    if (!userRef.current || !startTimeRef.current) return;
    const sessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000) + accumulatedRef.current;
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    setTime(0);
    setPomodoroTimeLeft(25 * 60);
    if (sessionTime > 5) {
      try {
        await saveSession(sessionTime);
        toast.success(`✅ Session saved! ${fmtTime(sessionTime)} for ${selectedFieldRef.current}`);
      } catch (e) {
        console.error(e);
        toast.error("Failed to save session");
      }
    }
  }, [saveSession]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTime(0);
    setPomodoroTimeLeft(25 * 60);
    setPomodoroRounds(0);
    setIsBreak(false);
    startTimeRef.current   = null;
    accumulatedRef.current = 0;
    toast("Timer reset");
  }, []);

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
    const uid   = userRef.current.uid;
    const fields = (userData?.studyFields || []).filter((f) => f !== field);
    const fieldTime = userData?.fieldTimes?.[field] || 0;
    const dk = localYMD(); const wk = localWeekStart(); const mk = localYM();
    const update = {
      studyFields: fields,
      [`fieldTimes.${field}`]: null,
      [`dailyStats.${dk}.fieldTimes.${field}`]:    null,
      [`weeklyStats.${wk}.fieldTimes.${field}`]:   null,
      [`monthlyStats.${mk}.fieldTimes.${field}`]:  null,
    };
    if (!keepTime && fieldTime > 0) {
      update.totalTimeAllTime = increment(-fieldTime);
    }
    try {
      await updateDoc(doc(db, "users", uid), update);
      if (selectedField === field) setSelectedField(fields[0] || "General");
      toast.success(`"${field}" removed`);
      setRemoveModal({ open: false, field: null, keepTime: false });
    } catch (e) { toast.error("Failed to remove field"); }
  }, [removeModal, userData, selectedField]);

  /* ═══ Task Management ═══ */
  const userDocRef = useCallback(() => {
    if (!userRef.current) return null;
    return doc(db, "users", userRef.current.uid);
  }, []);

  const addTask = useCallback(async () => {
    if (!newTaskText.trim()) return toast.error("Enter a task");
    if (!userRef.current) return;
    const task = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      text: newTaskText.trim(),
      completed: false,
      priority: taskPriority,
      deadline: taskDeadline || null,
      createdAt: new Date().toISOString(),
      field: selectedField,
    };
    try {
      const ref = userDocRef();
      await updateDoc(ref, { todoList: [...todoList, task] });
      setNewTaskText("");
      setTaskDeadline("");
      setTaskPriority("Medium");
      toast.success("Task added!");
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
      toast.success("Task deleted");
    } catch (e) { toast.error("Failed to delete task"); }
  }, [todoList, userDocRef]);

  const undoDelete = useCallback(async () => {
    if (!lastDeleted || !userRef.current) return;
    try {
      await updateDoc(userDocRef(), { todoList: [...todoList, lastDeleted] });
      setLastDeleted(null);
      toast.success("Task restored!");
    } catch (e) { toast.error("Failed to restore task"); }
  }, [lastDeleted, todoList, userDocRef]);

  const saveEdit = useCallback(async (id) => {
    if (!editingTask.text.trim()) return toast.error("Task cannot be empty");
    if (!userRef.current) return;
    const updated = todoList.map((t) => t.id === id ? { ...t, text: editingTask.text.trim() } : t);
    try {
      await updateDoc(userDocRef(), { todoList: updated });
      setEditingTask({ id: null, text: "" });
      toast.success("Task updated!");
    } catch (e) { toast.error("Failed to update task"); }
  }, [editingTask, todoList, userDocRef]);

  const sortByPriority = useCallback(async () => {
    if (!userRef.current) return;
    const order = { High: 1, Medium: 2, Low: 3 };
    const sorted = [...todoList].sort((a, b) => (order[a.priority] || 4) - (order[b.priority] || 4));
    try { await updateDoc(userDocRef(), { todoList: sorted }); toast.success("Sorted by priority"); }
    catch (e) { toast.error("Sort failed"); }
  }, [todoList, userDocRef]);

  const sortByDeadline = useCallback(async () => {
    if (!userRef.current) return;
    const sorted = [...todoList].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
    try { await updateDoc(userDocRef(), { todoList: sorted }); toast.success("Sorted by deadline"); }
    catch (e) { toast.error("Sort failed"); }
  }, [todoList, userDocRef]);

  /* ═══ Nav warning handlers ═══ */
  const handleContinueStudying = () => setNavWarning({ open: false, cb: null });
  const handlePauseNavigate = async () => {
    await stopTimer();
    setNavWarning((prev) => {
      if (prev.cb) setTimeout(prev.cb, 100);
      return { open: false, cb: null };
    });
  };

  /* ═══ Derived / Memoised ═══ */
  const studyFields = useMemo(() => userData?.studyFields || ["General"], [userData?.studyFields]);

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

  const filteredTasks = useMemo(() => {
    return todoList.filter((t) => {
      if (filterOption === "All")       return true;
      if (filterOption === "Completed") return t.completed;
      if (filterOption === "Pending")   return !t.completed;
      if (filterOption === "High")      return t.priority === "High";
      if (filterOption === "Medium")    return t.priority === "Medium";
      if (filterOption === "Low")       return t.priority === "Low";
      return true;
    });
  }, [todoList, filterOption]);

  const taskStats = useMemo(() => {
    const total     = todoList.length;
    const completed = todoList.filter((t) => t.completed).length;
    const high      = todoList.filter((t) => t.priority === "High").length;
    return { total, completed, pending: total - completed, high };
  }, [todoList]);

  const timerDisplayClass = useMemo(() => {
    if (isBreak)   return "timer-display break";
    if (isRunning) return "timer-display running";
    return "timer-display";
  }, [isBreak, isRunning]);

  // Live seconds for histogram (current running session only)
  const liveSeconds = useMemo(() => {
    if (!isRunning || !startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, [isRunning, time]); // re-eval every tick via `time`

  /* ═══ Render ═══ */
  if (loading) {
    return (
      <div className="session-page">
        <div className="session-state">
          <div className="spinner" />
          <h2>Loading session…</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="session-page">
        <div className="session-state">
          <span style={{ fontSize: "3rem" }}>🔒</span>
          <h2>Not logged in</h2>
          <p>Please sign in to start a study session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="session-page">
      <div className="session-container">

        {/* ── Nav Warning Modal ── */}
        <AnimatePresence>
          {navWarning.open && (
            <motion.div className="modal-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="modal-box"
                initial={{ opacity: 0, scale: 0.88, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                <div className="modal-head warning">
                  <h3 className="red">⏱️ Timer Running</h3>
                  <button className="modal-close" onClick={handleContinueStudying}>✕</button>
                </div>
                <div className="modal-body">
                  <p className="modal-text">
                    You have an active study timer running. Navigating away will pause it and save your progress so far.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn-modal-cancel" onClick={handleContinueStudying}>Keep Studying</button>
                  <button className="btn-modal-confirm danger" onClick={handlePauseNavigate}>Pause & Leave</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Field Removal Modal ── */}
        <AnimatePresence>
          {removeModal.open && (
            <motion.div className="modal-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>
              <motion.div className="modal-box"
                initial={{ opacity: 0, scale: 0.88, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                onClick={(e) => e.stopPropagation()}>
                <div className="modal-head info">
                  <h3 className="purple">Remove Field</h3>
                  <button className="modal-close" onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>✕</button>
                </div>
                <div className="modal-body">
                  <p className="modal-text">
                    Remove <strong style={{ color: "var(--text-accent)" }}>{removeModal.field}</strong>?
                    {userData?.fieldTimes?.[removeModal.field] > 0 && (
                      <> This field has <strong style={{ color: "var(--text-accent)" }}>{fmtTime(userData.fieldTimes[removeModal.field])}</strong> of study time.</>
                    )}
                  </p>
                  {userData?.fieldTimes?.[removeModal.field] > 0 && (
                    <>
                      <label className="modal-check-row">
                        <input type="checkbox"
                          checked={removeModal.keepTime}
                          onChange={(e) => setRemoveModal((p) => ({ ...p, keepTime: e.target.checked }))}
                        />
                        Keep study time (add to total time)
                      </label>
                      <p className="modal-subtext">
                        {removeModal.keepTime ? "✅ Time will be preserved in your total" : "⚠️ Time will be permanently deleted"}
                      </p>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn-modal-cancel" onClick={() => setRemoveModal({ open: false, field: null, keepTime: false })}>Cancel</button>
                  <button className={`btn-modal-confirm ${removeModal.keepTime ? "warning" : "danger"}`} onClick={confirmRemoveField}>
                    {removeModal.keepTime ? "Remove (Keep Time)" : "Remove Field"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Page Header ── */}
        <motion.header className="session-header" {...fadeUp}>
          <h1 className="session-title">Study Session</h1>
          <div className="session-quick-stats">
            <div className="qs-badge">📅 Today <strong>{fmtTime(timeStats.today)}</strong></div>
            <div className="qs-badge">📆 Week  <strong>{fmtTime(timeStats.week)}</strong></div>
            <div className="qs-badge">🗓️ Month <strong>{fmtTime(timeStats.month)}</strong></div>
            <div className="qs-badge">📚 Field <strong>{selectedField}</strong></div>
          </div>
        </motion.header>

        {/* ── Timer Layout ── */}
        <motion.div className="timer-layout"
          initial="initial" animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.1 } } }}>

          {/* Clock + Overview Panel */}
          <motion.div className="glass-card clock-panel" variants={itemVariant}>
            <Lottie animationData={clockAnimation} loop={isRunning} className="clock-lottie" />
            <div className="time-overview">
              {[{ label: "Today", val: timeStats.today }, { label: "Week", val: timeStats.week }, { label: "Month", val: timeStats.month }]
                .map(({ label, val }) => (
                  <div key={label} className="time-ov-row">
                    <span className="time-ov-label">{label}</span>
                    <span className="time-ov-val">{fmtTime(val)}</span>
                  </div>
                ))}
            </div>
            <div className="task-mini-stats">
              <div className="tms-item"><div className="tms-num purple">{taskStats.total}</div><div className="tms-label">Tasks</div></div>
              <div className="tms-item"><div className="tms-num green">{taskStats.completed}</div><div className="tms-label">Done</div></div>
              <div className="tms-item"><div className="tms-num yellow">{taskStats.pending}</div><div className="tms-label">Pending</div></div>
              <div className="tms-item"><div className="tms-num red">{taskStats.high}</div><div className="tms-label">High</div></div>
            </div>
          </motion.div>

          {/* Main Timer Panel */}
          <motion.div className="glass-card timer-panel" variants={itemVariant}>
            <div className="timer-mode-label">
              {pomodoroMode ? "🍅 Pomodoro" : "⏱️ Stopwatch"}
            </div>
            <div className="timer-field-tag">Studying: <span>{selectedField}</span></div>
            {pomodoroMode && pomodoroRounds > 0 && (
              <div className="pomodoro-badge">Round {pomodoroRounds} · {isBreak ? "☕ Break" : "📖 Study"}</div>
            )}
            <div className={timerDisplayClass}>
              {fmtTime(pomodoroMode ? pomodoroTimeLeft : time)}
            </div>
            <div className="timer-controls">
              {isRunning
                ? <button className="btn-timer btn-stop"  onClick={stopTimer}>⏹ Stop</button>
                : <button className="btn-timer btn-start" onClick={startTimer}>▶ Start</button>}
              <button className="btn-timer btn-reset" onClick={resetTimer}>↺ Reset</button>
            </div>

            {/* Strict Mode toggle */}
            <button
              className={`strict-mode-btn ${strictMode ? "active" : ""} ${isRunning ? "locked" : ""}`}
              onClick={() => {
                if (isRunning) return toast.error("Stop the timer to change strict mode");
                setStrictMode((v) => !v);
                toast(strictMode ? "🔓 Strict mode off — tab switching allowed" : "🔒 Strict mode on — tab switches will pause timer", { icon: strictMode ? "🔓" : "🔒" });
              }}
              title={strictMode ? "Strict mode ON — click to disable" : "Enable strict mode to block tab switching"}
            >
              <span className="strict-icon">{strictMode ? "🔒" : "🔓"}</span>
              <span className="strict-label">Strict Mode</span>
              <span className={`strict-pill ${strictMode ? "on" : "off"}`}>{strictMode ? "ON" : "OFF"}</span>
            </button>
            {strictMode && (
              <p className="strict-hint">Tab switching will pause the timer automatically</p>
            )}
            {!strictMode && (
              <p className="strict-hint muted">Timer continues if you switch tabs (e.g. reading)</p>
            )}

            <label className={`pomodoro-toggle ${isRunning ? "disabled" : ""}`}>
              <input type="checkbox" checked={pomodoroMode}
                onChange={(e) => !isRunning && setPomodoroMode(e.target.checked)} disabled={isRunning} />
              Enable Pomodoro Mode (25 min sessions)
            </label>

            {/* Field Management */}
            <div className="field-mgmt">
              <div className="field-select-wrap">
                <label>Select Study Field</label>
                <select className="field-select" value={selectedField}
                  onChange={(e) => setSelectedField(e.target.value)} disabled={isRunning}>
                  {studyFields.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="add-field-row">
                <input className="field-input" type="text" placeholder="New study field…"
                  value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addField()} />
                <button className="btn-add-field" onClick={addField}>+ Add</button>
              </div>
            </div>
          </motion.div>

          {/* Field Times Panel */}
          <motion.div className="glass-card field-times-panel" variants={itemVariant}>
            <div className="panel-title">Time by Field</div>
            {sortedFields.length > 0 ? (
              <motion.div className="field-times-list" variants={listVariants} initial="initial" animate="animate">
                <AnimatePresence>
                  {sortedFields.map(([field, t]) => (
                    <motion.div key={field}
                      className={`ft-item ${field === selectedField && isRunning ? "active" : ""}`}
                      variants={itemVariant} initial="initial" animate="animate"
                      exit={{ opacity: 0, x: 20 }}>
                      <div className="ft-info">
                        <div className="ft-name">{field}</div>
                        <div className="ft-time">{fmtTime(t)}</div>
                      </div>
                      {field !== "General" && (
                        <button className="ft-remove" onClick={() => openRemoveModal(field)} title="Remove field">✕</button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="no-fields-msg">Start a session to see field times!</div>
            )}
          </motion.div>
        </motion.div>

        {/* ── Floating Action Buttons ── */}
        <motion.div className="fab-row"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}>
          <button
            className={`fab-btn tasks-fab ${showTasks ? "active" : ""}`}
            onClick={() => { setShowTasks((v) => !v); setShowStats(false); }}>
            <span className="fab-icon">📋</span>
            <span className="fab-text">Tasks</span>
            {taskStats.pending > 0 && <span className="fab-badge">{taskStats.pending}</span>}
          </button>
          <button
            className={`fab-btn stats-fab ${showStats ? "active" : ""}`}
            onClick={() => { setShowStats((v) => !v); setShowTasks(false); }}>
            <span className="fab-icon">📊</span>
            <span className="fab-text">Study Statistics</span>
            {isRunning && <span className="fab-live-dot" />}
          </button>
        </motion.div>

        {/* ── Tasks Panel (overlay) ── */}
        <AnimatePresence>
          {showTasks && (
            <motion.div className="overlay-panel tasks-panel glass-card"
              variants={panelVariants} initial="initial" animate="animate" exit="exit">
              <div className="op-header">
                <h2 className="op-title">📋 To-Do List</h2>
                <button className="op-close" onClick={() => setShowTasks(false)}>✕</button>
              </div>

              {/* Task Input */}
              <div className="task-input-row">
                <input className="task-text-input" type="text" placeholder="Add a new task…"
                  value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()} />
                <select className="priority-select" value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
                <input className="deadline-input" type="date" value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  min={new Date().toISOString().split("T")[0]} />
                <button className="btn-add-task" onClick={addTask}>+ Add</button>
              </div>

              {/* Filters */}
              <div className="task-filters-row">
                <select className="filter-select" value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value)}>
                  <option value="All">All ({taskStats.total})</option>
                  <option value="Completed">Completed ({taskStats.completed})</option>
                  <option value="Pending">Pending ({taskStats.pending})</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
                <button className="btn-sort" onClick={sortByPriority}>↕ Priority</button>
                <button className="btn-sort" onClick={sortByDeadline}>📅 Deadline</button>
              </div>

              {/* Task List */}
              {filteredTasks.length > 0 ? (
                <motion.div className="task-list" variants={listVariants} initial="initial" animate="animate">
                  <AnimatePresence>
                    {filteredTasks.map((task) => (
                      <motion.div key={task.id}
                        className={`task-item ${task.completed ? "done" : ""}`}
                        variants={itemVariant} initial="initial" animate="animate"
                        exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }} layout>
                        <div className="task-body">
                          {editingTask.id === task.id ? (
                            <input className="task-edit-input" value={editingTask.text}
                              onChange={(e) => setEditingTask((p) => ({ ...p, text: e.target.value }))}
                              onBlur={() => saveEdit(task.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(task.id);
                                if (e.key === "Escape") setEditingTask({ id: null, text: "" });
                              }} autoFocus />
                          ) : (
                            <>
                              <div className={`task-text-display ${task.completed ? "done" : ""}`}
                                onClick={() => toggleTask(task.id)}>{task.text}</div>
                              <div className="task-meta-row">
                                <span className={`priority-chip ${task.priority.toLowerCase()}`}>{task.priority}</span>
                                {task.deadline && (
                                  <span className={`deadline-chip ${new Date(task.deadline) < new Date() && !task.completed ? "overdue" : ""}`}>
                                    {new Date(task.deadline) < new Date() && !task.completed ? "⚠️ " : "📅 "}
                                    {new Date(task.deadline + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="task-actions">
                          <button className="task-btn complete" title={task.completed ? "Mark pending" : "Mark done"}
                            onClick={() => toggleTask(task.id)}>{task.completed ? "↩" : "✓"}</button>
                          <button className="task-btn edit" title="Edit"
                            onClick={() => setEditingTask({ id: task.id, text: task.text })}>✎</button>
                          <button className="task-btn delete" title="Delete"
                            onClick={() => deleteTask(task.id)}>🗑</button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div className="empty-tasks">
                  {filterOption === "All" ? "No tasks yet — add one above!" : `No ${filterOption.toLowerCase()} tasks.`}
                </div>
              )}

              {/* Undo bar */}
              <AnimatePresence>
                {lastDeleted && (
                  <motion.div className="undo-bar"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                    <span>Deleted: <strong>"{lastDeleted.text}"</strong></span>
                    <button className="btn-undo" onClick={undoDelete}>Undo</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Study Statistics Panel (overlay) ── */}
        <AnimatePresence>
          {showStats && (
            <motion.div className="overlay-panel stats-panel glass-card"
              variants={panelVariants} initial="initial" animate="animate" exit="exit">
              <div className="op-header">
                <h2 className="op-title">📊 Today's Study Statistics</h2>
                <div className="op-header-right">
                  {isRunning && <span className="live-badge">● LIVE</span>}
                  <button className="op-close" onClick={() => setShowStats(false)}>✕</button>
                </div>
              </div>

              {/* Total today */}
              <div className="stats-total-row">
                <div className="stats-total-box">
                  <div className="stats-total-label">Total Today</div>
                  <div className="stats-total-val">{fmtTime(timeStats.today + (isRunning ? liveSeconds : 0))}</div>
                </div>
                <div className="stats-total-box">
                  <div className="stats-total-label">Sessions</div>
                  <div className="stats-total-val">
                    {userData?.dailyStats?.[localYMD()]?.sessionsCount || 0}
                  </div>
                </div>
                <div className="stats-total-box">
                  <div className="stats-total-label">Fields Active</div>
                  <div className="stats-total-val">{sortedFields.length}</div>
                </div>
              </div>

              {/* Field Breakdown */}
              <div className="stats-section-title">Field Breakdown</div>
              <FieldBreakdown
                fieldTimes={userData?.dailyStats?.[localYMD()]?.fieldTimes}
                totalTime={timeStats.today + (isRunning ? liveSeconds : 0)}
              />

              {/* Hourly Histogram */}
              <div className="stats-section-title" style={{ marginTop: "1.75rem" }}>
                Activity by Hour
                {isRunning && <span className="live-tag">live</span>}
              </div>
              <HourHistogram
                dailyStats={userData?.dailyStats}
                isRunning={isRunning}
                selectedField={selectedField}
                liveSeconds={liveSeconds}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default StartSession;