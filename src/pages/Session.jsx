import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { doc, onSnapshot, updateDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
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
  
  // Field removal modal state
  const [showFieldRemovalModal, setShowFieldRemovalModal] = useState(false);
  const [fieldToRemove, setFieldToRemove] = useState(null);
  const [keepTimeOnRemoval, setKeepTimeOnRemoval] = useState(false);
  
  // Tasks
  const [todoList, setTodoList] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [lastDeletedTask, setLastDeletedTask] = useState(null);
  
  // Tab change warning state
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  
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
        const sessionLength = 25 * 60; // 25 minutes
        const currentSessionTime = elapsed % sessionLength;
        const remaining = sessionLength - currentSessionTime;
        
        setPomodoroTime(Math.max(0, remaining));
        setElapsedPomodoroTime(elapsed);
        
        if (remaining <= 0 && elapsed >= sessionLength) {
          // Pomodoro session completed
          const rounds = Math.floor(elapsed / sessionLength) + 1;
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

  // Tab visibility change detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRunningRef.current) {
        // Tab is being hidden and timer is running
        toast.error("Timer paused - tab changed while studying!");
        stopTimer();
      }
    };

    const handleBeforeUnload = (e) => {
      if (isRunningRef.current) {
        const message = "Timer is running! Are you sure you want to leave?";
        e.returnValue = message;
        return message;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Navigation warning effect
  useEffect(() => {
    // Set timer running state in window for TopBar access
    window.studyBuddyTimerState = {
      isRunning: isRunning,
      showWarning: (callback) => {
        if (isRunning) {
          setShowTabWarning(true);
          setPendingNavigation(() => callback);
          return true; // Prevent navigation
        }
        return false; // Allow navigation
      }
    };

    return () => {
      delete window.studyBuddyTimerState;
    };
  }, [isRunning]);

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
  }, [user, formatTime, selectedField, saveStudySession]);

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

  // Handle tab warning responses
  const handleContinueWithTimer = () => {
    setShowTabWarning(false);
    setPendingNavigation(null);
    toast.info("Navigation cancelled - timer still running");
  };

  const handlePauseAndNavigate = async () => {
    await stopTimer();
    setShowTabWarning(false);
    
    if (pendingNavigation) {
      setTimeout(() => {
        pendingNavigation();
        setPendingNavigation(null);
      }, 100);
    }
  };

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

  // Initiate field removal confirmation
  const initiateFieldRemoval = useCallback((fieldName) => {
    if (fieldName === "General") {
      toast.error("Cannot remove the General field");
      return;
    }

    if (studyFields.length <= 1) {
      toast.error("Must have at least one study field");
      return;
    }

    setFieldToRemove(fieldName);
    setKeepTimeOnRemoval(false);
    setShowFieldRemovalModal(true);
  }, [studyFields]);

  // Confirm field removal with time handling
  const confirmFieldRemoval = useCallback(async () => {
    if (!fieldToRemove || !user || !userRef.current) return;

    try {
      const updatedFields = studyFields.filter(field => field !== fieldToRemove);
      const userDocRef = doc(db, "users", userRef.current.uid);
      
      // Get current field time
      const fieldTime = userData?.fieldTimes?.[fieldToRemove] || 0;
      
      const updateData = { studyFields: updatedFields };

      if (keepTimeOnRemoval && fieldTime > 0) {
        // Add field time to total time and remove from field times
        updateData.totalTimeAllTime = increment(fieldTime);
        updateData[`fieldTimes.${fieldToRemove}`] = null; // This will delete the field from fieldTimes
        
        // Also need to handle stats removal but add time to totals
        const todayKey = getTodayKey();
        const weekKey = getWeekKey();
        const monthKey = getMonthKey();
        
        // Add to daily stats total if field time exists in daily stats
        const dailyFieldTime = userData?.dailyStats?.[todayKey]?.fieldTimes?.[fieldToRemove] || 0;
        if (dailyFieldTime > 0) {
          updateData[`dailyStats.${todayKey}.fieldTimes.${fieldToRemove}`] = null;
        }
        
        // Add to weekly stats total if field time exists in weekly stats
        const weeklyFieldTime = userData?.weeklyStats?.[weekKey]?.fieldTimes?.[fieldToRemove] || 0;
        if (weeklyFieldTime > 0) {
          updateData[`weeklyStats.${weekKey}.fieldTimes.${fieldToRemove}`] = null;
        }
        
        // Add to monthly stats total if field time exists in monthly stats
        const monthlyFieldTime = userData?.monthlyStats?.[monthKey]?.fieldTimes?.[fieldToRemove] || 0;
        if (monthlyFieldTime > 0) {
          updateData[`monthlyStats.${monthKey}.fieldTimes.${fieldToRemove}`] = null;
        }
        
        toast.success(`Field "${fieldToRemove}" removed and ${formatTime(fieldTime)} added to total time`);
      } else {
        // Remove field and its time completely
        updateData[`fieldTimes.${fieldToRemove}`] = null;
        updateData.totalTimeAllTime = increment(-fieldTime); // Subtract from total
        
        // Remove from all stats
        const todayKey = getTodayKey();
        const weekKey = getWeekKey();
        const monthKey = getMonthKey();
        
        updateData[`dailyStats.${todayKey}.fieldTimes.${fieldToRemove}`] = null;
        updateData[`weeklyStats.${weekKey}.fieldTimes.${fieldToRemove}`] = null;
        updateData[`monthlyStats.${monthKey}.fieldTimes.${fieldToRemove}`] = null;
        
        if (fieldTime > 0) {
          toast.success(`Field "${fieldToRemove}" and ${formatTime(fieldTime)} of study time removed`);
        } else {
          toast.success(`Field "${fieldToRemove}" removed`);
        }
      }

      await updateDoc(userDocRef, updateData);

      // Update selected field if necessary
      if (selectedField === fieldToRemove) {
        setSelectedField(updatedFields[0]);
      }

      // Reset modal state
      setShowFieldRemovalModal(false);
      setFieldToRemove(null);
      setKeepTimeOnRemoval(false);
    } catch (error) {
      console.error("Error removing field:", error);
      toast.error("Failed to remove study field");
    }
  }, [fieldToRemove, studyFields, user, userData, keepTimeOnRemoval, selectedField, formatTime, getTodayKey, getWeekKey, getMonthKey]);

  const cancelFieldRemoval = useCallback(() => {
    setShowFieldRemovalModal(false);
    setFieldToRemove(null);
    setKeepTimeOnRemoval(false);
  }, []);

  // Fixed sorting functions with proper async updates
  const sortTasksByPriority = useCallback(async () => {
    if (!user || !userRef.current || todoList.length === 0) return;

    const priorityOrder = { High: 1, Medium: 2, Low: 3 };
    const sortedTasks = [...todoList].sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 4;
      const priorityB = priorityOrder[b.priority] || 4;
      return priorityA - priorityB;
    });
    
    // Only update if the order actually changed
    const hasChanged = sortedTasks.some((task, index) => task.id !== todoList[index]?.id);
    
    if (!hasChanged) {
      toast.info("Tasks are already sorted by priority");
      return;
    }
    
    try {
      const userDocRef = doc(db, "users", userRef.current.uid);
      await updateDoc(userDocRef, { todoList: sortedTasks });
      toast.success("Tasks sorted by priority");
    } catch (error) {
      console.error("Error sorting tasks:", error);
      toast.error("Failed to sort tasks");
    }
  }, [user, todoList]);

  const sortTasksByDeadline = useCallback(async () => {
    if (!user || !userRef.current || todoList.length === 0) return;

    const sortedTasks = [...todoList].sort((a, b) => {
      // Handle tasks without deadlines
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1; // Tasks without deadline go to end
      if (!b.deadline) return -1; // Tasks without deadline go to end
      
      const deadlineA = new Date(a.deadline);
      const deadlineB = new Date(b.deadline);
      return deadlineA - deadlineB;
    });
    
    // Only update if the order actually changed
    const hasChanged = sortedTasks.some((task, index) => task.id !== todoList[index]?.id);
    
    if (!hasChanged) {
      toast.info("Tasks are already sorted by deadline");
      return;
    }
    
    try {
      const userDocRef = doc(db, "users", userRef.current.uid);
      await updateDoc(userDocRef, { todoList: sortedTasks });
      toast.success("Tasks sorted by deadline");
    } catch (error) {
      console.error("Error sorting tasks:", error);
      toast.error("Failed to sort tasks");
    }
  }, [user, todoList]);

  // Memoized calculations for better performance
  const filteredTasks = useMemo(() => {
    if (!Array.isArray(todoList)) return [];
    
    return todoList.filter((task) => {
      if (!task) return false;
      
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
    if (!Array.isArray(todoList)) return { total: 0, completed: 0, pending: 0, highPriority: 0 };
    
    const validTasks = todoList.filter(task => task);
    const total = validTasks.length;
    const completed = validTasks.filter(task => task.completed).length;
    const pending = total - completed;
    const highPriority = validTasks.filter(task => task.priority === "High").length;
    
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
      {/* Tab Warning Modal */}
      <AnimatePresence>
        {showTabWarning && (
          <motion.div
            className="warning-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.div
              className="warning-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '1rem',
                maxWidth: '400px',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              <h3 style={{ marginBottom: '1rem', color: '#f39c12' }}>Timer is Running!</h3>
              <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                You have an active study timer running. Please pause it before navigating to another page to save your progress.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={handlePauseAndNavigate}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Pause & Navigate
                </button>
                <button
                  onClick={handleContinueWithTimer}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Continue Studying
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Field Removal Confirmation Modal */}
      <AnimatePresence>
        {showFieldRemovalModal && (
          <motion.div
            className="warning-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.div
              className="warning-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '1rem',
                maxWidth: '450px',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              <h3 style={{ marginBottom: '1rem', color: '#e74c3c' }}>Remove Study Field</h3>
              <p style={{ marginBottom: '1rem', color: '#666' }}>
                Are you sure you want to remove the field "{fieldToRemove}"?
              </p>
              {userData?.fieldTimes?.[fieldToRemove] > 0 && (
                <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '0.9rem' }}>
                  This field has {formatTime(userData.fieldTimes[fieldToRemove])} of study time.
                </p>
              )}
              
              {userData?.fieldTimes?.[fieldToRemove] > 0 && (
                <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={keepTimeOnRemoval}
                      onChange={(e) => setKeepTimeOnRemoval(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.9rem' }}>
                      Keep the study time and add it to total time
                    </span>
                  </label>
                  <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                    {keepTimeOnRemoval 
                      ? "Time will be preserved and added to your total study time" 
                      : "Time will be permanently deleted"}
                  </p>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={cancelFieldRemoval}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmFieldRemoval}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: keepTimeOnRemoval ? '#f39c12' : '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {keepTimeOnRemoval ? 'Remove Field (Keep Time)' : 'Remove Field (Delete Time)'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="session-header">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Study Session</h1>
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
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
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
        </div>
        
        <motion.div
          className="timer-container"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h2>{pomodoroMode ? "Pomodoro Timer" : "Stopwatch"}</h2>
          <h2 className="selected-field-heading">
            Study Field: <span>{selectedField}</span>
          </h2>
          
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
                        onClick={() => initiateFieldRemoval(field)}
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
            <option value="All">All Tasks ({taskStats.total})</option>
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