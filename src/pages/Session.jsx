import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { doc, onSnapshot, updateDoc, deleteDoc, deleteField } from "firebase/firestore";
import { auth, db } from "../components/firebase";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import clockAnimation from "../assets/3d-clock-animation.json";
import "./Session.css";

function StartSession() {
  // Core state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Timer state
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [elapsedPomodoroTime, setElapsedPomodoroTime] = useState(0);
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [pomodoroRounds, setPomodoroRounds] = useState(0);
  
  // Real-time user data
  const [userData, setUserData] = useState(null);
  
  // Study fields
  const [studyFields, setStudyFields] = useState(["General"]);
  const [selectedField, setSelectedField] = useState("General");
  const [newFieldName, setNewFieldName] = useState("");
  
  // Tasks
  const [todoList, setTodoList] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [lastDeletedTask, setLastDeletedTask] = useState(null);
  
  // Refs for background timer
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const accumulatedTimeRef = useRef(0);
  const isRunningRef = useRef(false);
  const pomodoroModeRef = useRef(false);
  const selectedFieldRef = useRef("General");
  const userRef = useRef(null);
  
  // Real-time database listener
  const unsubscribeRef = useRef(null);

  // Helper functions
  const formatTime = useCallback((timeInSeconds) => {
    if (!timeInSeconds || timeInSeconds === 0) return "00:00:00";
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, []);

const localYMD = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localYearMonth = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const localWeekStart = (d = new Date(), weekStartsOn = 1 /* 1=Mon */) => {
  const day = d.getDay() === 0 ? 7 : d.getDay(); // 1..7
  const diff = day - weekStartsOn;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  return localYMD(start);
};


 const getTodayKey = useCallback(() => localYMD(), []);
 const getWeekKey = useCallback(() => localWeekStart(), []);
 const getMonthKey = useCallback(() => localYearMonth(), []);

  // Background timer that works even when tab is not active
  const updateTimer = useCallback(() => {
    if (isRunningRef.current && startTimeRef.current) {
      const now = Date.now();
      const elapsed = Math.floor((now - startTimeRef.current) / 1000) + accumulatedTimeRef.current;
      
      if (pomodoroModeRef.current) {
        const remaining = 25 * 60 - (elapsed % (25 * 60));
        setPomodoroTime(Math.max(0, remaining));
        setElapsedPomodoroTime(elapsed);
        
        if (remaining <= 0 && elapsed > 0) {
          // Pomodoro session completed
          const rounds = Math.floor(elapsed / (25 * 60)) + 1;
          setPomodoroRounds(rounds);
          
          if (rounds % 4 === 0) {
            toast.success("Time for a long break! (15-30 minutes)");
          } else {
            toast.success("Pomodoro completed! Time for a 5 minute break.");
          }
          
          setIsBreakTime(true);
          stopTimer();
        }
      } else {
        setTime(elapsed);
      }
    }
  }, []);

  // Setup background timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(updateTimer, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [updateTimer]);

  // Real-time data synchronization with better error handling
  const setupRealtimeListener = useCallback((userId) => {
    console.log("Setting up real-time listener for user:", userId);
    const docRef = doc(db, "users", userId);
    
    return onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        console.log("Real-time data update received:", data);
        setUserData(data);
        
        // Update local state with real-time data
        setTodoList(data.todoList || []);
        const fields = data.studyFields || ["General"];
        setStudyFields(fields);
        
        // Ensure selected field is valid
        const currentField = selectedFieldRef.current;
        if (!fields.includes(currentField)) {
          const firstField = fields[0] || "General";
          setSelectedField(firstField);
          selectedFieldRef.current = firstField;
        }
      } else {
        console.warn("User document does not exist, creating...");
        initializeUserDocument(userId);
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Real-time listener error:", error);
      toast.error("Connection issue with database. Retrying...");
      setLoading(false);
    });
  }, []);

  // Initialize user document with comprehensive structure matching your database
  const initializeUserDocument = useCallback(async (userId) => {
    console.log("Initializing user document for:", userId);
    const userDocRef = doc(db, "users", userId);
    const todayKey = getTodayKey();
    const weekKey = getWeekKey();
    const monthKey = getMonthKey();
    
    const initialData = {
      email: auth.currentUser?.email || "",
      name: auth.currentUser?.displayName || "User",
      createdAt: serverTimestamp(),
      
      // Tasks
      todoList: [],
      
      // Study fields
      studyFields: ["General"],
      
      // Field times - matches your database structure
      fieldTimes: {},
      
      // Time tracking totals
      totalTimeToday: 0,
      totalTimeWeek: 0,
      totalTimeMonth: 0,
      totalTimeAllTime: 0,
      
      // Last study tracking
      lastStudyDate: null,
      
      // Analytics data - matching your exact structure
      dailyStats: {
        [todayKey]: {
          totalTime: 0,
          fieldTimes: {},
          sessionsCount: 0
        }
      },
      weeklyStats: {
        [weekKey]: {
          totalTime: 0,
          fieldTimes: {},
          sessionsCount: 0
        }
      },
      monthlyStats: {
        [monthKey]: {
          totalTime: 0,
          fieldTimes: {},
          sessionsCount: 0
        }
      }
    };
    
    try {
      await setDoc(userDocRef, initialData);
      console.log("User document initialized successfully");
      toast.success("Profile setup completed!");
    } catch (error) {
      console.error("Error initializing user document:", error);
      toast.error("Failed to initialize user data");
    }
  }, [getTodayKey, getWeekKey, getMonthKey]);

  // Firebase Authentication and Real-time Data
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser ? "User logged in" : "User logged out");
      
      if (currentUser) {
        setUser(currentUser);
        userRef.current = currentUser;
        
        // Setup real-time listener
        unsubscribeRef.current = setupRealtimeListener(currentUser.uid);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        
        // Clean up listener if user logs out
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [setupRealtimeListener]);

  // Update refs when state changes
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    pomodoroModeRef.current = pomodoroMode;
  }, [pomodoroMode]);

  useEffect(() => {
    selectedFieldRef.current = selectedField;
  }, [selectedField]);

  // Timer Controls with enhanced database updates
  const startTimer = useCallback(() => {
    if (!user) {
      toast.error("Please log in to start a study session");
      return;
    }
    
    setIsRunning(true);
    setIsBreakTime(false);
    startTimeRef.current = Date.now();
    accumulatedTimeRef.current = pomodoroMode ? elapsedPomodoroTime : time;
    
    toast.success(`Study session started for ${selectedField}!`);
  }, [user, pomodoroMode, elapsedPomodoroTime, time, selectedField]);

  const stopTimer = useCallback(async () => {
    console.log("Stopping timer...");
    setIsRunning(false);
    
    if (!user || !userRef.current) {
      console.log("No user found, cannot save session");
      return;
    }
    
    const currentTime = Date.now();
    const sessionTime = startTimeRef.current ? 
      Math.floor((currentTime - startTimeRef.current) / 1000) + accumulatedTimeRef.current : 0;
    
    console.log("Session time calculated:", sessionTime, "seconds");
    
    if (sessionTime > 5) { // Only save sessions longer than 5 seconds
      try {
        await saveStudySession(sessionTime);
        
        const formattedTime = formatTime(sessionTime);
        toast.success(`Session saved! ${formattedTime} added to ${selectedField}`);
      } catch (error) {
        console.error("Error saving session:", error);
        toast.error("Failed to save session data");
      }
    }

    // Reset timer state
    setTime(0);
    setElapsedPomodoroTime(0);
    setPomodoroTime(25 * 60);
    accumulatedTimeRef.current = 0;
    startTimeRef.current = null;
  }, [user, formatTime, selectedField]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTime(0);
    setElapsedPomodoroTime(0);
    setPomodoroTime(25 * 60);
    setIsBreakTime(false);
    setPomodoroRounds(0);
    accumulatedTimeRef.current = 0;
    startTimeRef.current = null;
    toast.info("Timer reset");
  }, []);

  // Enhanced study session saving with atomic updates - matches your database structure exactly
  const saveStudySession = useCallback(async (sessionTime) => {
    if (!user || !userRef.current || sessionTime <= 0) {
      console.log("Invalid session save parameters");
      return;
    }

    console.log("Saving study session:", sessionTime, "seconds for field:", selectedFieldRef.current);
    const userDocRef = doc(db, "users", userRef.current.uid);
    const todayKey = getTodayKey();
    const weekKey = getWeekKey();
    const monthKey = getMonthKey();
    const currentField = selectedFieldRef.current;

    try {
      // Use atomic updates to prevent data conflicts - matching your exact database structure
      const updateData = {
        // Main field times and totals
        [`fieldTimes.${currentField}`]: increment(sessionTime),
        totalTimeToday: increment(sessionTime),
        totalTimeWeek: increment(sessionTime),
        totalTimeMonth: increment(sessionTime),
        totalTimeAllTime: increment(sessionTime),
        
        // Daily stats - exactly matching your structure
        [`dailyStats.${todayKey}.totalTime`]: increment(sessionTime),
        [`dailyStats.${todayKey}.fieldTimes.${currentField}`]: increment(sessionTime),
        [`dailyStats.${todayKey}.sessionsCount`]: increment(1),
        
        // Weekly stats - exactly matching your structure
        [`weeklyStats.${weekKey}.totalTime`]: increment(sessionTime),
        [`weeklyStats.${weekKey}.fieldTimes.${currentField}`]: increment(sessionTime),
        [`weeklyStats.${weekKey}.sessionsCount`]: increment(1),
        
        // Monthly stats - exactly matching your structure
        [`monthlyStats.${monthKey}.totalTime`]: increment(sessionTime),
        [`monthlyStats.${monthKey}.fieldTimes.${currentField}`]: increment(sessionTime),
        [`monthlyStats.${monthKey}.sessionsCount`]: increment(1),
        
        // Update metadata
        lastStudyDate: serverTimestamp(),
      };

      await updateDoc(userDocRef, updateData);
      console.log(`Study session saved successfully: ${sessionTime}s for ${currentField}`);
      
    } catch (error) {
      console.error("Error saving study session:", error);
      throw error;
    }
  }, [user, getTodayKey, getWeekKey, getMonthKey]);

  // Task Management with optimized updates - matching your database structure
  const handleAddTask = useCallback(async () => {
    if (!newTaskText.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    if (!user || !userRef.current) {
      toast.error("Please log in to add tasks");
      return;
    }
    
    const newTask = {
      id: Date.now() + Math.random(), // Ensure unique ID
      text: newTaskText.trim(),
      completed: false,
      priority: taskPriority,
      deadline: taskDeadline || null,
      createdAt: new Date().toISOString(),
      field: selectedField // Associate task with current field
    };

    try {
      const userDocRef = doc(db, "users", userRef.current.uid);
      const updatedList = [...todoList, newTask];
      
      await updateDoc(userDocRef, { todoList: updatedList });

      setNewTaskText("");
      setTaskPriority("Medium");
      setTaskDeadline("");
      toast.success("Task added successfully!");
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Failed to add task");
    }
  }, [newTaskText, user, taskPriority, taskDeadline, todoList, selectedField]);

  const handleEditTask = useCallback((id, text) => {
    setEditTaskId(id);
    setEditTaskText(text);
  }, []);

  const saveEditTask = useCallback(async (id) => {
    if (!editTaskText.trim()) {
      toast.error("Task cannot be empty");
      return;
    }

    if (!user || !userRef.current) return;

    try {
      const updatedList = todoList.map((task) =>
        task.id === id ? { ...task, text: editTaskText.trim(), updatedAt: new Date().toISOString() } : task
      );
      
      const userDocRef = doc(db, "users", userRef.current.uid);
      await updateDoc(userDocRef, { todoList: updatedList });

      setEditTaskId(null);
      setEditTaskText("");
      toast.success("Task updated successfully!");
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  }, [editTaskText, user, todoList]);

  const handleRemoveTask = useCallback(async (taskId) => {
    if (!user || !userRef.current) return;

    try {
      const taskToDelete = todoList.find((task) => task.id === taskId);
      setLastDeletedTask(taskToDelete);
      
      const updatedList = todoList.filter((task) => task.id !== taskId);
      const userDocRef = doc(db, "users", userRef.current.uid);
      await updateDoc(userDocRef, { todoList: updatedList });

      toast.success("Task deleted successfully!");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  }, [user, todoList]);

  const undoDeleteTask = useCallback(async () => {
    if (lastDeletedTask && user && userRef.current) {
      try {
        const updatedList = [...todoList, lastDeletedTask];
        const userDocRef = doc(db, "users", userRef.current.uid);
        await updateDoc(userDocRef, { todoList: updatedList });

        setLastDeletedTask(null);
        toast.success("Task restored successfully!");
      } catch (error) {
        console.error("Error restoring task:", error);
        toast.error("Failed to restore task");
      }
    }
  }, [lastDeletedTask, user, todoList]);

  const toggleTaskCompletion = useCallback(async (taskId) => {
    if (!user || !userRef.current) return;

    try {
     const wasCompleted = !!todoList.find(t => t.id === taskId)?.completed;
      const updatedList = todoList.map((task) =>
        task.id === taskId 
          ? { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : null }
          : task
      );
      
      const userDocRef = doc(db, "users", userRef.current.uid);
      await updateDoc(userDocRef, { todoList: updatedList });


     toast.success(wasCompleted ? "Task marked as pending" : "Task completed!");
    } catch (error) {
      console.error("Error toggling task:", error);
      toast.error("Failed to update task status");
    }
  }, [user, todoList]);
  // Study Field Management
  const addStudyField = useCallback(async () => {
    if (!newFieldName.trim()) {
      toast.error("Please enter a field name");
      return;
    }

    const trimmedFieldName = newFieldName.trim();
    
    if (studyFields.includes(trimmedFieldName)) {
      toast.error("Field already exists");
      return;
    }

    if (!user || !userRef.current) {
      toast.error("Please log in to add study fields");
      return;
    }

    try {
      const updatedFields = [...studyFields, trimmedFieldName];
      const userDocRef = doc(db, "users", userRef.current.uid);
      await updateDoc(userDocRef, { studyFields: updatedFields });

      setNewFieldName("");
      toast.success("Study field added successfully!");
    } catch (error) {
      console.error("Error adding field:", error);
      toast.error("Failed to add study field");
    }
  }, [newFieldName, studyFields, user]);

  const removeStudyField = useCallback(async (fieldToRemove) => {
    if (fieldToRemove === "General") {
      toast.error("Cannot remove the General field");
      return;
    }

    if (studyFields.length <= 1) {
      toast.error("Must have at least one study field");
      return;
    }

    if (!user || !userRef.current) return;

    try {
      const updatedFields = studyFields.filter(field => field !== fieldToRemove);
      const updateData = { studyFields: updatedFields };

      // Also remove the field from fieldTimes if it exists
      const currentFieldTimes = userData?.fieldTimes || {};
      if (currentFieldTimes[fieldToRemove]) {
        updateData[`fieldTimes.${fieldToRemove}`] = null; // Delete the field
      }

      const userDocRef = doc(db, "users", userRef.current.uid);
      await updateDoc(userDocRef, updateData);

      if (selectedField === fieldToRemove) {
        setSelectedField(updatedFields[0]);
      }

      toast.success("Study field removed");
    } catch (error) {
      console.error("Error removing field:", error);
      toast.error("Failed to remove study field");
    }
  }, [studyFields, user, userData?.fieldTimes, selectedField]);

  // Sorting functions
  const sortTasksByPriority = useCallback(() => {
    if (!user || !userRef.current) return;

    const priorityOrder = { High: 1, Medium: 2, Low: 3 };
    const sortedTasks = [...todoList].sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
    
    const userDocRef = doc(db, "users", userRef.current.uid);
    updateDoc(userDocRef, { todoList: sortedTasks });
    
    toast.info("Tasks sorted by priority");
  }, [user, todoList]);

  const sortTasksByDeadline = useCallback(() => {
    if (!user || !userRef.current) return;

    const sortedTasks = [...todoList].sort((a, b) => {
      const deadlineA = new Date(a.deadline || "2100-01-01");
      const deadlineB = new Date(b.deadline || "2100-01-01");
      return deadlineA - deadlineB;
    });
    
    const userDocRef = doc(db, "users", userRef.current.uid);
    updateDoc(userDocRef, { todoList: sortedTasks });
    
    toast.info("Tasks sorted by deadline");
  }, [user, todoList]);

  // Memoized calculations for better performance
  const filteredTasks = useMemo(() => {
    return todoList.filter((task) => {
      if (filterOption === "All") return true;
      if (filterOption === "Completed") return task.completed;
      if (filterOption === "Pending") return !task.completed;
      if (filterOption === "High") return task.priority === "High";
      if (filterOption === "Medium") return task.priority === "Medium";
      if (filterOption === "Low") return task.priority === "Low";
      return true;
    });
  }, [todoList, filterOption]);

  // Get task statistics
  const taskStats = useMemo(() => {
    const total = todoList.length;
    const completed = todoList.filter(task => task && task.completed).length;
    const pending = total - completed;
    const highPriority = todoList.filter(task => task && task.priority === "High").length;
    
    return { total, completed, pending, highPriority };
  }, [todoList]);

  // Get time statistics with fallback values - matching your database structure
  const timeStats = useMemo(() => {
    if (!userData) return { today: 0, week: 0, month: 0, allTime: 0 };
    
    return {
      today: userData.totalTimeToday || 0,
      week: userData.totalTimeWeek || 0,
      month: userData.totalTimeMonth || 0,
      allTime: userData.totalTimeAllTime || 0
    };
  }, [userData]);

  // Get field times with sorting - matching your database structure
  const sortedFieldTimes = useMemo(() => {
    if (!userData?.fieldTimes) return [];
    
    return Object.entries(userData.fieldTimes)
      .filter(([field, time]) => field && typeof time === 'number' && time > 0)
      .sort(([,a], [,b]) => b - a);
  }, [userData?.fieldTimes]);

  // Auto-save functionality for task editing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editTaskId && editTaskText.trim() && editTaskText !== todoList.find(t => t.id === editTaskId)?.text) {
        saveEditTask(editTaskId);
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [editTaskText, editTaskId, todoList, saveEditTask]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="session-container">
        <div className="loading-container">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2>Loading session data...</h2>
            <div className="loading-spinner"></div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="session-container">
        <div className="not-logged-in">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2>Please log in to start a study session</h2>
            <p>You need to be logged in to track your study time and manage tasks.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="session-container">
      {/* Header */}
      <header className="session-header">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Study Session</h1>
          <div className="time-stats">
            <p>Today: <strong>{formatTime(timeStats.today)}</strong></p>
            <p>This Week: <strong>{formatTime(timeStats.week)}</strong></p>
            <p>This Month: <strong>{formatTime(timeStats.month)}</strong></p>
          </div>
          <div className="session-stats">
            <span>Tasks: {taskStats.total}</span>
            <span>Completed: {taskStats.completed}</span>
            <span>Pending: {taskStats.pending}</span>
            <span>High Priority: {taskStats.highPriority}</span>
          </div>
        </motion.div>
      </header>

      {/* Timer Section */}
      <div className="timer-section">
        <div className="animation-container">
          <Lottie 
            animationData={clockAnimation} 
            loop={isRunning} 
            className="clock-animation" 
          />
        </div>
        
        <motion.div
          className="timer-container"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h2 className="selected-field-heading">
            Study Field: <span>{selectedField}</span>
          </h2>
          <h2>{pomodoroMode ? "Pomodoro Timer" : "Stopwatch"}</h2>
          
          {pomodoroMode && pomodoroRounds > 0 && (
            <div className="pomodoro-rounds">
              Round: {pomodoroRounds} | {isBreakTime ? "Break Time!" : "Study Time"}
            </div>
          )}
          
          <div className="timer-display">
            {formatTime(pomodoroMode ? pomodoroTime : time)}
          </div>
          
          <div className="timer-controls">
            {!isRunning ? (
              <button onClick={startTimer} className="start-button">
                Start
              </button>
            ) : (
              <button onClick={stopTimer} className="stop-button">
                Stop
              </button>
            )}
            <button onClick={resetTimer} className="reset-button">
              Reset
            </button>
          </div>
          
          <div className="pomodoro-mode-toggle">
            <label>
              <input
                type="checkbox"
                checked={pomodoroMode}
                onChange={(e) => setPomodoroMode(e.target.checked)}
                disabled={isRunning}
              />
              Enable Pomodoro Mode (25 min sessions)
            </label>
          </div>
          
          <div className="field-management">
            <div className="field-selector">
              <label htmlFor="studyField">Select Study Field:</label>
              <select
                id="studyField"
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                disabled={isRunning}
              >
                {studyFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            <div className="add-field-container">
              <input
                type="text"
                placeholder="Add a new field..."
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addStudyField()}
              />
              <button
                onClick={addStudyField}
                className="add-field-button"
              >
                Add Field
              </button>
            </div>
          </div>
        </motion.div>

        {/* Field Times Display */}
        <motion.div
          className="field-times-section"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2>Study Time by Field</h2>
          {sortedFieldTimes.length > 0 ? (
            <ul className="field-times-list">
              <AnimatePresence>
                {sortedFieldTimes.map(([field, time]) => (
                  <motion.li 
                    key={field} 
                    className="field-time-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="field-info">
                      <strong>{field}:</strong> 
                      <span className="field-time">{formatTime(time)}</span>
                    </div>
                    {field !== "General" && (
                      <button 
                        onClick={() => removeStudyField(field)}
                        className="remove-field-button"
                        title="Remove field"
                      >
                        ×
                      </button>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="no-data">Start studying to see your field statistics!</p>
          )}
        </motion.div>
      </div>

      {/* To-Do Section */}
      <motion.div
        className="todo-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <h2>To-Do List</h2>
        
        {/* Task Input */}
        <div className="todo-input-container">
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddTask()}
            className="task-input"
          />
          <select
            className="priority-selector"
            value={taskPriority}
            onChange={(e) => setTaskPriority(e.target.value)}
          >
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
          </select>
          <input
            type="date"
            className="deadline-input"
            value={taskDeadline}
            onChange={(e) => setTaskDeadline(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <button
            className="add-task-button"
            onClick={handleAddTask}
          >
            Add Task
          </button>
        </div>

        {/* Task Filters and Controls */}
        <div className="task-filters">
          <select
            className="filter-selector"
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value)}
          >
            <option value="All">All Tasks ({todoList.length})</option>
            <option value="Completed">Completed ({taskStats.completed})</option>
            <option value="Pending">Pending ({taskStats.pending})</option>
            <option value="High">High Priority ({taskStats.highPriority})</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
          <button onClick={sortTasksByPriority} className="sort-button">
            Sort by Priority
          </button>
          <button onClick={sortTasksByDeadline} className="sort-button">
            Sort by Deadline
          </button>
        </div>

        {/* Task List */}
        {filteredTasks.length > 0 ? (
          <ul className="todo-list">
            <AnimatePresence>
              {filteredTasks.map((task) => (
                <motion.li
                  key={task.id}
                  className={`todo-item ${task.completed ? "completed" : ""}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="task-content">
                    {editTaskId === task.id ? (
                      <input
                        className="edit-task-input"
                        value={editTaskText}
                        onChange={(e) => setEditTaskText(e.target.value)}
                        onBlur={() => saveEditTask(task.id)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") saveEditTask(task.id);
                          if (e.key === "Escape") {
                            setEditTaskId(null);
                            setEditTaskText("");
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="task-details">
                        <span
                          className={`task-text ${task.completed ? "completed" : ""}`}
                          onClick={() => toggleTaskCompletion(task.id)}
                        >
                          {task.text}
                        </span>
                        <div className="task-meta">
                          <span className={`task-priority priority-${task.priority.toLowerCase()}`}>
                            {task.priority} Priority
                          </span>
                          {task.deadline && (
                            <span className={`task-deadline ${new Date(task.deadline) < new Date() ? 'overdue' : ''}`}>
                              Due: {new Date(task.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="task-actions">
                    <button
                      className="complete-task-button"
                      title={task.completed ? "Mark as Pending" : "Mark as Completed"}
                      onClick={() => toggleTaskCompletion(task.id)}
                    >
                      {task.completed ? "↩" : "✓"}
                    </button>
                    <button
                      className="edit-task-button"
                      title="Edit Task"
                      onClick={() => handleEditTask(task.id, task.text)}
                    >
                      ✎
                    </button>
                    <button
                      className="remove-task-button"
                      title="Remove Task"
                      onClick={() => handleRemoveTask(task.id)}
                    >
                      🗑
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="empty-tasks">
            <p>
              {filterOption === "All" 
                ? "No tasks yet. Add your first task above!" 
                : `No ${filterOption.toLowerCase()} tasks found.`}
            </p>
          </div>
        )}

        {/* Undo Container */}
        <AnimatePresence>
          {lastDeletedTask && (
            <motion.div 
              className="undo-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <span>Task deleted: <strong>{lastDeletedTask.text}</strong></span>
              <button onClick={undoDeleteTask} className="undo-button">
                Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default StartSession;