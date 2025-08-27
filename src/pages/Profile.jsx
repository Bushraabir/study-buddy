import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../components/firebase";
import { onAuthStateChanged, updateProfile, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import "./Profile.css";

function Profile() {
  // Core state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  
  // Account deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Stats time period
  const [selectedTimePeriod, setSelectedTimePeriod] = useState("week");
  
  // Real-time listener
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

  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return "Never";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }, []);

  const calculateStreak = useCallback((dailyStats) => {
    if (!dailyStats) return 0;
    
    const today = new Date();
    let streak = 0;
    
    for (let i = 0; i < 365; i++) { // Check up to 365 days back
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateKey = checkDate.toISOString().split('T')[0];
      
      if (dailyStats[dateKey] && dailyStats[dateKey].totalTime > 0) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }, []);

  // Real-time data listener
  const setupRealtimeListener = useCallback((userId) => {
    console.log("Setting up real-time listener for profile:", userId);
    const docRef = doc(db, "users", userId);
    
    return onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        console.log("Profile data updated:", data);
        setUserData(data);
      } else {
        console.warn("User document does not exist");
        setUserData(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Real-time listener error:", error);
      toast.error("Failed to load profile data");
      setLoading(false);
    });
  }, []);

  // Firebase Authentication
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || "");
        setOriginalDisplayName(currentUser.displayName || "");
        
        // Setup real-time listener
        unsubscribeRef.current = setupRealtimeListener(currentUser.uid);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        
        // Clean up listener
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

  // Profile management
  const handleUpdateProfile = useCallback(async () => {
    if (!user || !displayName.trim()) {
      toast.error("Please enter a valid display name");
      return;
    }

    try {
      await updateProfile(user, {
        displayName: displayName.trim()
      });

      // Update user document in Firestore
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        name: displayName.trim(),
        updatedAt: serverTimestamp()
      });

      setOriginalDisplayName(displayName.trim());
      setIsEditingProfile(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  }, [user, displayName]);

  const cancelEditProfile = useCallback(() => {
    setDisplayName(originalDisplayName);
    setIsEditingProfile(false);
  }, [originalDisplayName]);

  // Account deletion
  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmation !== "DELETE" || !currentPassword) {
      toast.error("Please enter your password and type 'DELETE' to confirm");
      return;
    }

    setIsDeleting(true);

    try {
      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Delete user document from Firestore
      const userDocRef = doc(db, "users", user.uid);
      await deleteDoc(userDocRef);

      // Delete user account
      await deleteUser(user);

      toast.success("Account deleted successfully");
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Error deleting account:", error);
      if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password");
      } else if (error.code === "auth/requires-recent-login") {
        toast.error("Please log out and log back in before deleting your account");
      } else {
        toast.error("Failed to delete account: " + error.message);
      }
    } finally {
      setIsDeleting(false);
    }
  }, [user, deleteConfirmation, currentPassword]);

  // Memoized calculations
  const profileStats = useMemo(() => {
    if (!userData) return null;

    const totalTasks = userData.todoList?.length || 0;
    const completedTasks = userData.todoList?.filter(task => task.completed).length || 0;
    const studyStreak = calculateStreak(userData.dailyStats);
    const totalFields = userData.studyFields?.length || 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      studyStreak,
      totalFields,
      totalStudyTime: userData.totalTimeAllTime || 0,
      averageDailyTime: studyStreak > 0 ? Math.round((userData.totalTimeAllTime || 0) / studyStreak) : 0
    };
  }, [userData, calculateStreak]);

  const timeStats = useMemo(() => {
    if (!userData) return null;

    return {
      today: userData.totalTimeToday || 0,
      week: userData.totalTimeWeek || 0,
      month: userData.totalTimeMonth || 0,
      allTime: userData.totalTimeAllTime || 0
    };
  }, [userData]);

  const fieldStats = useMemo(() => {
    if (!userData?.fieldTimes) return [];
    
    return Object.entries(userData.fieldTimes)
      .filter(([field, time]) => field && typeof time === 'number' && time > 0)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5); // Top 5 fields
  }, [userData?.fieldTimes]);

  const recentActivity = useMemo(() => {
    if (!userData?.dailyStats) return [];
    
    const activities = Object.entries(userData.dailyStats)
      .filter(([date, stats]) => stats && stats.totalTime > 0)
      .map(([date, stats]) => ({
        date,
        totalTime: stats.totalTime,
        sessions: stats.sessionsCount || 0,
        fields: Object.keys(stats.fieldTimes || {}).length
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7); // Last 7 days with activity
    
    return activities;
  }, [userData?.dailyStats]);

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-container">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2>Loading profile...</h2>
            <div className="loading-spinner"></div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-container">
        <div className="not-logged-in">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2>Please log in to view your profile</h2>
            <p>You need to be logged in to access your profile and statistics.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {/* Profile Header */}
      <motion.div
        className="profile-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="profile-info">
          <div className="avatar">
            {(displayName || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            {isEditingProfile ? (
              <div className="edit-profile-container">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter display name"
                  className="display-name-input"
                  autoFocus
                />
                <div className="edit-actions">
                  <button onClick={handleUpdateProfile} className="save-button">
                    Save
                  </button>
                  <button onClick={cancelEditProfile} className="cancel-button">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1>{displayName || "Anonymous User"}</h1>
                <p className="user-email">{user.email}</p>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="edit-profile-button"
                >
                  Edit Profile
                </button>
              </>
            )}
          </div>
        </div>
        
        {userData && (
          <div className="account-info">
            <p>Member since: {formatDate(userData.createdAt)}</p>
            <p>Last study: {formatDate(userData.lastStudyDate)}</p>
          </div>
        )}
      </motion.div>

      {/* Quick Stats Cards */}
      {profileStats && (
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="stat-card highlight">
            <div className="stat-icon">🔥</div>
            <div className="stat-content">
              <h3>{profileStats.studyStreak}</h3>
              <p>Day Streak</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <h3>{formatTime(profileStats.totalStudyTime)}</h3>
              <p>Total Study Time</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{profileStats.completionRate}%</h3>
              <p>Task Completion</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-content">
              <h3>{profileStats.totalFields}</h3>
              <p>Study Fields</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Time Statistics */}
      {timeStats && (
        <motion.div
          className="time-stats-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2>Study Time Overview</h2>
          <div className="time-stats-grid">
            <div className="time-stat-item">
              <h4>Today</h4>
              <p>{formatTime(timeStats.today)}</p>
            </div>
            <div className="time-stat-item">
              <h4>This Week</h4>
              <p>{formatTime(timeStats.week)}</p>
            </div>
            <div className="time-stat-item">
              <h4>This Month</h4>
              <p>{formatTime(timeStats.month)}</p>
            </div>
            <div className="time-stat-item">
              <h4>All Time</h4>
              <p>{formatTime(timeStats.allTime)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Field Statistics */}
      {fieldStats.length > 0 && (
        <motion.div
          className="field-stats-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h2>Top Study Fields</h2>
          <div className="field-stats-list">
            {fieldStats.map(([field, time], index) => (
              <div key={field} className="field-stat-item">
                <div className="field-rank">#{index + 1}</div>
                <div className="field-info">
                  <h4>{field}</h4>
                  <p>{formatTime(time)}</p>
                </div>
                <div className="field-bar">
                  <div 
                    className="field-progress" 
                    style={{ width: `${(time / fieldStats[0][1]) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Task Statistics */}
      {profileStats && (
        <motion.div
          className="task-stats-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <h2>Task Performance</h2>
          <div className="task-stats-grid">
            <div className="task-stat-card">
              <h3>Total Tasks</h3>
              <div className="task-stat-value">{profileStats.totalTasks}</div>
            </div>
            <div className="task-stat-card completed">
              <h3>Completed</h3>
              <div className="task-stat-value">{profileStats.completedTasks}</div>
            </div>
            <div className="task-stat-card pending">
              <h3>Pending</h3>
              <div className="task-stat-value">{profileStats.pendingTasks}</div>
            </div>
            <div className="task-stat-card rate">
              <h3>Completion Rate</h3>
              <div className="task-stat-value">{profileStats.completionRate}%</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <motion.div
          className="recent-activity-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
        >
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {recentActivity.map((activity) => (
              <div key={activity.date} className="activity-item">
                <div className="activity-date">
                  {new Date(activity.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                  })}
                </div>
                <div className="activity-details">
                  <div className="activity-time">{formatTime(activity.totalTime)}</div>
                  <div className="activity-meta">
                    {activity.sessions} sessions • {activity.fields} fields
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Account Management */}
      <motion.div
        className="account-management-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <h2>Account Management</h2>
        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <p>This action cannot be undone. This will permanently delete your account and all associated data.</p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="delete-account-button"
          >
            Delete My Account
          </button>
        </div>
      </motion.div>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              className="delete-modal"
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Delete Account</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowDeleteModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-content">
                <div className="warning-message">
                  ⚠️ This action is irreversible! All your study data, tasks, and progress will be permanently deleted.
                </div>
                
                <div className="confirmation-inputs">
                  <div className="input-group">
                    <label>Enter your current password:</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="password-input"
                    />
                  </div>
                  
                  <div className="input-group">
                    <label>Type "DELETE" to confirm:</label>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="Type DELETE here"
                      className="confirmation-input"
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-actions">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="cancel-delete-button"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="confirm-delete-button"
                  disabled={isDeleting || deleteConfirmation !== "DELETE" || !currentPassword}
                >
                  {isDeleting ? "Deleting..." : "Delete Account"}
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