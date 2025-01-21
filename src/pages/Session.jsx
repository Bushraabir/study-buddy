import React, { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../components/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import clockAnimation from "../assets/3d-clock-animation.json";
import "./Session.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

function StartSession() {
  // State variables for user, time, tasks, and study fields
  const [user, setUser] = useState(null);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // Default 25 minutes
  const [elapsedPomodoroTime, setElapsedPomodoroTime] = useState(0);
  const [totalTimeToday, setTotalTimeToday] = useState(0);
  const [todoList, setTodoList] = useState([]);
  const [studyFields, setStudyFields] = useState(["General"]);
  const [selectedField, setSelectedField] = useState("General");
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [lastDeletedTask, setLastDeletedTask] = useState(null);
  const [fieldTimes, setFieldTimes] = useState({});
  // Firebase: Fetch user and tasks when authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          setTodoList(data.todoList || []);
          setStudyFields(data.studyFields || ["General"]);
          setTotalTimeToday(data.totalTimeToday || 0);
        }

        // Real-time updates from Firebase
        onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setTodoList(data.todoList || []);
            setStudyFields(data.studyFields || ["General"]);
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Timer logic (handles both Pomodoro and Stopwatch modes)
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        if (pomodoroMode) {
          setPomodoroTime((prev) => {
            if (prev <= 1) {
              stopTimer();
              toast.info("Pomodoro session ended!", { position: "top-center" });
              return 25 * 60; // Reset Pomodoro timer
            }
            setElapsedPomodoroTime((elapsed) => elapsed + 1);
            return prev - 1;
          });
        } else {
          setTime((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, pomodoroMode]);

  // Timer controls
  const startTimer = () => setIsRunning(true);

  const stopTimer = async () => {
    setIsRunning(false);
    const timeToAdd = pomodoroMode ? elapsedPomodoroTime : time;
  
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const updatedFieldTimes = {
        ...fieldTimes,
        [selectedField]: (fieldTimes[selectedField] || 0) + timeToAdd,
      };
  
      await updateDoc(userRef, {
        totalTimeToday: totalTimeToday + timeToAdd,
        fieldTimes: updatedFieldTimes,
      });
  
      setFieldTimes(updatedFieldTimes);
      setTotalTimeToday((prev) => prev + timeToAdd);
    }
  
    setTime(0);
    setElapsedPomodoroTime(0);
    setPomodoroTime(25 * 60);
  };
  

  // Task management functions
  const handleAddTask = async (taskText) => {
    const newTask = {
      id: Date.now(),
      text: taskText,
      completed: false,
      priority: taskPriority,
      deadline: taskDeadline || null,
    };
    const updatedList = [...todoList, newTask];
    setTodoList(updatedList);

    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { todoList: updatedList });
    }

    setTaskPriority("Medium");
    setTaskDeadline("");
    toast.success("Task added!", { position: "top-center" });
  };

  const handleEditTask = (id, text) => {
    setEditTaskId(id);
    setEditTaskText(text);
  };

  const saveEditTask = async (id) => {
    const updatedList = todoList.map((task) =>
      task.id === id ? { ...task, text: editTaskText } : task
    );
    setTodoList(updatedList);
    setEditTaskId(null);
    setEditTaskText("");

    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { todoList: updatedList });
    }

    toast.info("Task updated!", { position: "top-center" });
  };

  const handleRemoveTask = async (taskId) => {
    const taskToDelete = todoList.find((task) => task.id === taskId);
    setLastDeletedTask(taskToDelete);
    const updatedList = todoList.filter((task) => task.id !== taskId);
    setTodoList(updatedList);

    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { todoList: updatedList });
    }

    toast.warning("Task deleted!", { position: "top-center" });
  };

  const undoDeleteTask = async () => {
    if (lastDeletedTask) {
      const updatedList = [...todoList, lastDeletedTask];
      setTodoList(updatedList);

      if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { todoList: updatedList });
      }

      setLastDeletedTask(null);
      toast.success("Task restored!", { position: "top-center" });
    }
  };

  const toggleTaskCompletion = async (taskId) => {
    const updatedList = todoList.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    setTodoList(updatedList);

    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { todoList: updatedList });
    }

    toast.info("Task status updated!", { position: "top-center" });
  };

  // Sorting and filtering
  const sortTasksByPriority = () => {
    const sortedTasks = [...todoList].sort((a, b) => {
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    setTodoList(sortedTasks);
  };

  const sortTasksByDeadline = () => {
    const sortedTasks = [...todoList].sort((a, b) => {
      const deadlineA = new Date(a.deadline || "2100-01-01");
      const deadlineB = new Date(b.deadline || "2100-01-01");
      return deadlineA - deadlineB;
    });
    setTodoList(sortedTasks);
  };

  const filteredTasks = todoList.filter((task) => {
    if (filterOption === "All") return true;
    if (filterOption === "Completed") return task.completed;
    if (filterOption === "Pending") return !task.completed;
    if (filterOption === "High") return task.priority === "High";
    if (filterOption === "Low") return task.priority === "Low";
    return true;
  });

  // Utility function for formatting time
  const formatTime = (timeInSeconds) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };
  const addStudyField = async (newField) => {
    if (!newField || studyFields.includes(newField)) {
      toast.error("Field already exists or is invalid", { position: "top-center" });
      return;
    }
  
    const updatedFields = [...studyFields, newField];
    setStudyFields(updatedFields);
  
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { studyFields: updatedFields });
    }
  
    toast.success("Study field added!", { position: "top-center" });
  };



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
          <p>Today's total study duration: {formatTime(totalTimeToday)}</p>
        </motion.div>
      </header>

      {/* Timer Section */}
      <div className="timer-section">
  <div className="animation-container">
    <Lottie animationData={clockAnimation} loop className="clock-animation" />
  </div>
  <motion.div
    className="timer-container"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.2, duration: 0.5 }}
  >

        {/* Study Field Heading */}
        <h2 className="selected-field-heading">
      Study Field: <span>{selectedField}</span>
    </h2>
    <h2>{pomodoroMode ? "Pomodoro Timer" : "Stopwatch"}</h2>
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
          Pause
        </button>
      )}
    </div>
    <div className="pomodoro-mode-toggle">
      <label>
        <input
          type="checkbox"
          checked={pomodoroMode}
          onChange={() => setPomodoroMode(!pomodoroMode)}
        />
        Enable Pomodoro Mode
      </label>
    </div>
    <div className="field-management">
      <div className="field-selector">
        <label htmlFor="studyField">Select Study Field: </label>
        <select
          id="studyField"
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.value.trim() !== "") {
              addStudyField(e.target.value.trim());
              e.target.value = "";
            }
          }}
        />
        <button
          onClick={() => {
            const input = document.querySelector(".add-field-container input");
            if (input.value.trim() !== "") {
              addStudyField(input.value.trim());
              input.value = "";
            }
          }}
          className="add-field-button"
        >
          Add Field
        </button>
      </div>
    </div>
  </motion.div>

  <motion.div
    className="field-times-section"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.4, duration: 0.5 }}
  >
    <h2>Field Timers</h2>
    <ul className="field-times-list">
      {Object.entries(fieldTimes).map(([field, time]) => (
        <li key={field} className="field-time-item">
          <strong>{field}:</strong> {formatTime(time)}
        </li>
      ))}
    </ul>
  </motion.div>
</div>


      {/* To-Do Section */}
      <motion.div
        className="todo-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <h2>To-Do List</h2>
        <div className="todo-input-container">
          <input
            type="text"
            placeholder="Add a new task..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim() !== "") {
                handleAddTask(e.target.value.trim());
                e.target.value = "";
              }
            }}
          />
          <select
            className="priority-selector"
            onChange={(e) => setTaskPriority(e.target.value)}
            defaultValue="Medium"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <input
            type="date"
            className="deadline-input"
            onChange={(e) => setTaskDeadline(e.target.value)}
          />
          <button
            className="add-task-button"
            onClick={() => {
              const taskInput = document.querySelector(".todo-input-container input");
              if (taskInput.value.trim() !== "") {
                handleAddTask(taskInput.value.trim());
                taskInput.value = "";
              }
            }}
          >
            Add
          </button>
        </div>

        <div className="task-filters">
          <select
            className="filter-selector"
            onChange={(e) => setFilterOption(e.target.value)}
            defaultValue="All"
          >
            <option value="All">All</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="High">High Priority</option>
            <option value="Low">Low Priority</option>
          </select>
          <button onClick={sortTasksByPriority}>Sort by Priority</button>
          <button onClick={sortTasksByDeadline}>Sort by Deadline</button>
        </div>

        <ul className="todo-list">
          {filteredTasks.map((task) => (
            <li
              key={task.id}
              className={`todo-item ${task.completed ? "completed" : ""} ${
                task.priority.toLowerCase()
              }`}
            >
              <div className="task-content">
                {editTaskId === task.id ? (
                  <input
                    className="edit-task-input"
                    value={editTaskText}
                    onChange={(e) => setEditTaskText(e.target.value)}
                    onBlur={() => saveEditTask(task.id)}
                  />
                ) : (
                  <div>
                    <span
                      className={`task-text ${task.completed ? "done" : ""}`}
                      title="Task details"
                    >
                      {task.text}
                    </span>
                    <span className="task-priority">[{task.priority}]</span>
                    {task.deadline && (
                      <span className="task-deadline">
                        (Due: {new Date(task.deadline).toLocaleDateString()} )
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="task-actions">
                <button
                  className="complete-task-button"
                  title="Mark as Completed"
                  onClick={() => toggleTaskCompletion(task.id)}
                >
                  <i className="fas fa-check-circle"></i>
                </button>
                <button
                  className="edit-task-button"
                  title="Edit Task"
                  onClick={() => handleEditTask(task.id, task.text)}
                >
                  <i className="fas fa-edit"></i>
                </button>
                <button
                  className="remove-task-button"
                  title="Remove Task"
                  onClick={() => handleRemoveTask(task.id)}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>

        {lastDeletedTask && (
          <div className="undo-container">
            <span>Task deleted: {lastDeletedTask.text}</span>
            <button onClick={undoDeleteTask}>Undo</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default StartSession;
