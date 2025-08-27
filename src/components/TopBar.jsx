import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaTimes, FaGraduationCap, FaBook, FaStickyNote, FaChartLine, FaCube, FaUser, FaSignInAlt, FaSignOutAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import "./TopBar.css";

function TopBar() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Handle scroll effect for topbar styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if navigation should be blocked due to running timer
  const checkTimerBeforeNavigation = (callback) => {
    // Check if we have access to timer state from window
    if (window.studyBuddyTimerState && window.studyBuddyTimerState.isRunning) {
      // Show warning and return true if navigation should be blocked
      return window.studyBuddyTimerState.showWarning(callback);
    }
    return false; // Allow navigation
  };

  // Enhanced navigation handler
  const handleNavigation = (path) => {
    // Don't show warning if already on the target path
    if (location.pathname === path) {
      setMobileMenuOpen(false);
      return;
    }

    const navigateToPath = () => {
      setMobileMenuOpen(false);
      navigate(path);
    };

    // Check if timer is running before navigation
    const isBlocked = checkTimerBeforeNavigation(navigateToPath);
    
    if (!isBlocked) {
      // No timer running, proceed with navigation
      navigateToPath();
    }
    // If blocked, the warning modal will handle the navigation
  };

  // Sign out user and navigate to home
  const handleLogout = async () => {
    const performLogout = async () => {
      try {
        await signOut(auth);
        setMobileMenuOpen(false);
        navigate("/");
      } catch (error) {
        console.error("Error logging out:", error.message);
      }
    };

    // Check if timer is running before logout
    const isBlocked = checkTimerBeforeNavigation(performLogout);
    
    if (!isBlocked) {
      // No timer running, proceed with logout
      await performLogout();
    }
  };

  // Close mobile menu on link click
  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  const navItems = [
    { 
      path: "/session", 
      label: "Study Session", 
      icon: FaGraduationCap, 
      authRequired: true,
      description: "Focus mode sessions" 
    },
    { 
      path: "/flash-cards", 
      label: "Flashcards", 
      icon: FaBook, 
      authRequired: false,
      description: "Interactive learning cards" 
    },
    { 
      path: "/notes", 
      label: "Notes", 
      icon: FaStickyNote, 
      authRequired: false,
      description: "Digital notebook" 
    },
    { 
      path: "/plot-graph", 
      label: "Sketch Curves", 
      icon: FaChartLine, 
      authRequired: false,
      description: "Mathematical visualization" 
    },
    { 
      path: "/3d-graph", 
      label: "3D Graphs", 
      icon: FaCube, 
      authRequired: false,
      description: "3D mathematical models" 
    },
    { 
      path: "/profile", 
      label: "Profile", 
      icon: FaUser, 
      authRequired: true,
      description: "Your study progress" 
    }
  ];

  return (
    <>
      <motion.header
        className={`studybuddy-topbar ${isScrolled ? 'studybuddy-topbar--scrolled' : ''}`}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="studybuddy-topbar__container">
          {/* Enhanced Logo */}
          <motion.div 
            className="studybuddy-topbar__logo"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div 
              className="studybuddy-logo-link" 
              onClick={() => handleNavigation("/")}
              style={{ cursor: 'pointer' }}
            >
              <motion.div 
                className="studybuddy-logo-icon"
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1] 
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut"
                }}
              >
                <FaGraduationCap />
              </motion.div>
              <span className="studybuddy-logo-text">
                Study<span className="studybuddy-logo-accent">Buddy</span>
              </span>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="studybuddy-topbar__nav studybuddy-topbar__nav--desktop">
            {navItems.map((item, index) => {
              if (item.authRequired && !user) return null;
              const IconComponent = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <motion.div
                  key={item.path}
                  className={`studybuddy-nav-item ${isActive ? 'active' : ''}`}
                  whileHover={{ y: -3, scale: 1.05 }}
                  whileTap={{ y: 0, scale: 0.95 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div 
                    className="studybuddy-nav-link" 
                    onClick={() => handleNavigation(item.path)}
                    title={item.description}
                    style={{ cursor: 'pointer' }}
                  >
                    <motion.div className="studybuddy-nav-icon">
                      <IconComponent />
                    </motion.div>
                    <span className="studybuddy-nav-text">{item.label}</span>
                  </div>
                </motion.div>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="studybuddy-topbar__actions">
            {user ? (
              <motion.button
                onClick={handleLogout}
                className="studybuddy-action-button studybuddy-logout-button"
                whileHover={{ scale: 1.05, boxShadow: "0 8px 25px rgba(168, 85, 247, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                aria-label="Logout"
              >
                <FaSignOutAlt className="studybuddy-button-icon" />
                <span>Logout</span>
              </motion.button>
            ) : (
              <motion.div 
                whileHover={{ scale: 1.05, boxShadow: "0 8px 25px rgba(168, 85, 247, 0.4)" }} 
                whileTap={{ scale: 0.95 }}
              >
                <div 
                  className="studybuddy-action-button studybuddy-login-button" 
                  onClick={() => handleNavigation("/login")}
                  style={{ cursor: 'pointer' }}
                >
                  <FaSignInAlt className="studybuddy-button-icon" />
                  <span>Login</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <motion.div 
            className="studybuddy-topbar__toggle"
            whileTap={{ scale: 0.9 }}
          >
            <motion.button
              className="studybuddy-mobile-toggle-btn"
              animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            >
              {!isMobileMenuOpen ? (
                <FaBars aria-label="Open menu" />
              ) : (
                <FaTimes aria-label="Close menu" />
              )}
            </motion.button>
          </motion.div>
        </div>
      </motion.header>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              className="studybuddy-mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.nav
              className="studybuddy-mobile-menu"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="studybuddy-mobile-menu__header">
                <div className="studybuddy-mobile-logo">
                  <FaGraduationCap className="studybuddy-mobile-logo-icon" />
                  <span className="studybuddy-mobile-logo-text">StudyBuddy</span>
                </div>
              </div>

              <div className="studybuddy-mobile-menu__content">
                {navItems.map((item, index) => {
                  if (item.authRequired && !user) return null;
                  const IconComponent = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <motion.div
                      key={item.path}
                      className={`studybuddy-mobile-menu-item ${isActive ? 'active' : ''}`}
                      initial={{ x: 50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 10, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div 
                        className="studybuddy-mobile-menu-link" 
                        onClick={() => handleNavigation(item.path)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="studybuddy-mobile-link-content">
                          <motion.div 
                            className="studybuddy-mobile-link-icon"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                          >
                            <IconComponent />
                          </motion.div>
                          <div className="studybuddy-mobile-link-text">
                            <span className="studybuddy-mobile-link-title">{item.label}</span>
                            <span className="studybuddy-mobile-link-desc">{item.description}</span>
                          </div>
                        </div>
                        <motion.div 
                          className="studybuddy-mobile-link-arrow"
                          initial={{ x: -10, opacity: 0 }}
                          whileHover={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          →
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Mobile Authentication */}
              <motion.div 
                className="studybuddy-mobile-actions"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {user ? (
                  <motion.button
                    onClick={handleLogout}
                    className="studybuddy-mobile-action-button studybuddy-mobile-logout"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FaSignOutAlt className="studybuddy-button-icon" />
                    <span>Logout</span>
                  </motion.button>
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div
                      className="studybuddy-mobile-action-button studybuddy-mobile-login"
                      onClick={() => handleNavigation("/login")}
                      style={{ cursor: 'pointer' }}
                    >
                      <FaSignInAlt className="studybuddy-button-icon" />
                      <span>Login to StudyBuddy</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default TopBar;