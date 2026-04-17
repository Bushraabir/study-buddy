import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaBars, FaTimes, FaGraduationCap, FaBook, FaStickyNote,
  FaChartLine, FaCube, FaUser, FaSignInAlt, FaSignOutAlt,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import "./TopBar.css";

/* ─── Nav item definitions ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { path: "/session",    label: "Study Session", icon: FaGraduationCap, authRequired: true,  desc: "Focus mode & timers" },
  { path: "/flash-cards",label: "Flashcards",    icon: FaBook,          authRequired: false, desc: "Interactive learning cards" },
  { path: "/notes",      label: "Notes",         icon: FaStickyNote,    authRequired: false, desc: "Rich digital notebook" },
  { path: "/plot-graph", label: "Sketch Curves", icon: FaChartLine,     authRequired: false, desc: "2D math visualization" },
  { path: "/3d-graph",   label: "3D Graphs",     icon: FaCube,          authRequired: false, desc: "3D mathematical models" },
  { path: "/profile",    label: "Profile",       icon: FaUser,          authRequired: true,  desc: "Your study progress" },
];

/* ─── Animation variants ────────────────────────────────────────────────── */
const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};

const drawerVariants = {
  hidden:  { x: "100%", opacity: 0 },
  visible: { x: 0,      opacity: 1, transition: { type: "spring", stiffness: 320, damping: 32 } },
  exit:    { x: "100%", opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

const navItemVariants = {
  hidden:  { x: 40, opacity: 0 },
  visible: (i) => ({ x: 0, opacity: 1, transition: { delay: i * 0.06, duration: 0.28 } }),
};

/* ─── Component ─────────────────────────────────────────────────────────── */
function TopBar() {
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [user,        setUser]        = useState(null);
  const [isScrolled,  setIsScrolled]  = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();

  /* Auth listener */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return unsub;
  }, []);

  /* Scroll listener */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Lock body scroll when drawer is open */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  /* Escape key closes drawer */
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Close drawer on route change */
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  /* Timer-aware navigation */
  const checkTimer = useCallback((callback) => {
    if (window.studyBuddyTimerState?.isRunning) {
      return window.studyBuddyTimerState.showWarning(callback);
    }
    return false;
  }, []);

  const handleNav = useCallback((path) => {
    if (location.pathname === path) { setDrawerOpen(false); return; }
    const go = () => { setDrawerOpen(false); navigate(path); };
    if (!checkTimer(go)) go();
  }, [location.pathname, navigate, checkTimer]);

  /* Logout */
  const handleLogout = useCallback(async () => {
    const doLogout = async () => {
      try {
        await signOut(auth);
        setDrawerOpen(false);
        navigate("/");
        toast.success("Logged out successfully");
      } catch (err) {
        toast.error("Logout failed. Please try again.");
        console.error("Logout error:", err.message);
      }
    };
    if (!checkTimer(doLogout)) doLogout();
  }, [navigate, checkTimer]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.authRequired || user
  );

  return (
    <>
      {/* ── Sticky TopBar ───────────────────────────────────────────────── */}
      <motion.header
        className={`studybuddy-topbar${isScrolled ? " studybuddy-topbar--scrolled" : ""}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="studybuddy-topbar__container">

          {/* Logo */}
          <motion.div
            className="studybuddy-topbar__logo"
            whileHover={{ scale: 1.04 }}
            whileTap={  { scale: 0.96 }}
          >
            <div
              className="studybuddy-logo-link"
              onClick={() => handleNav("/")}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleNav("/")}
              aria-label="StudyBuddy home"
            >
              <motion.span
                className="studybuddy-logo-icon"
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              >
                <FaGraduationCap />
              </motion.span>
              <span className="studybuddy-logo-text">
                Study<span className="studybuddy-logo-accent">Buddy</span>
              </span>
            </div>
          </motion.div>

          {/* Desktop nav */}
          <nav className="studybuddy-topbar__nav studybuddy-topbar__nav--desktop" aria-label="Main navigation">
            {visibleItems.map((item, i) => {
              const Icon     = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <motion.div
                  key={item.path}
                  className={`studybuddy-nav-item${isActive ? " active" : ""}`}
                  whileHover={{ y: -2, scale: 1.04 }}
                  whileTap={  { y: 0,  scale: 0.96 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0  }}
                  transition={{ delay: i * 0.07 }}
                >
                  <div
                    className={`studybuddy-nav-link${isActive ? " active" : ""}`}
                    onClick={() => handleNav(item.path)}
                    title={item.desc}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleNav(item.path)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="studybuddy-nav-icon"><Icon /></span>
                    <span className="studybuddy-nav-text">{item.label}</span>
                  </div>
                </motion.div>
              );
            })}
          </nav>

          {/* Desktop actions */}
          <div className="studybuddy-topbar__actions">
            {user ? (
              <motion.button
                onClick={handleLogout}
                className="studybuddy-action-button studybuddy-logout-button"
                whileHover={{ scale: 1.04 }}
                whileTap={  { scale: 0.96 }}
                aria-label="Log out"
              >
                <span className="studybuddy-button-icon"><FaSignOutAlt /></span>
                <span>Logout</span>
              </motion.button>
            ) : (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <div
                  className="studybuddy-action-button studybuddy-login-button"
                  onClick={() => handleNav("/login")}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleNav("/login")}
                  aria-label="Log in"
                >
                  <span className="studybuddy-button-icon"><FaSignInAlt /></span>
                  <span>Login</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="studybuddy-topbar__toggle">
            <motion.button
              className="studybuddy-mobile-toggle-btn"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={drawerOpen}
              whileTap={{ scale: 0.92 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={drawerOpen ? "close" : "open"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0,   opacity: 1 }}
                  exit={{    rotate:  90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  {drawerOpen ? <FaTimes /> : <FaBars />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>

        </div>
      </motion.header>

      {/* ── Mobile Drawer ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="studybuddy-mobile-backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.nav
              className="studybuddy-mobile-menu"
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-label="Mobile navigation"
              role="dialog"
              aria-modal="true"
            >
              {/* Drawer header */}
              <div className="studybuddy-mobile-menu__header">
                <div className="studybuddy-mobile-logo">
                  <span className="studybuddy-mobile-logo-icon"><FaGraduationCap /></span>
                  <span className="studybuddy-mobile-logo-text">StudyBuddy</span>
                </div>
                <button
                  className="studybuddy-mobile-close-btn"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <FaTimes />
                </button>
              </div>

              {/* Nav links */}
              <div className="studybuddy-mobile-menu__content">
                <div className="studybuddy-mobile-section-label">Navigation</div>

                {visibleItems.map((item, i) => {
                  const Icon     = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <motion.div
                      key={item.path}
                      className={`studybuddy-mobile-menu-item${isActive ? " active" : ""}`}
                      custom={i}
                      variants={navItemVariants}
                      initial="hidden"
                      animate="visible"
                      whileTap={{ scale: 0.97 }}
                    >
                      <div
                        className="studybuddy-mobile-menu-link"
                        onClick={() => handleNav(item.path)}
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && handleNav(item.path)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="studybuddy-mobile-link-icon"><Icon /></span>
                        <div className="studybuddy-mobile-link-text">
                          <span className="studybuddy-mobile-link-title">{item.label}</span>
                          <span className="studybuddy-mobile-link-desc">{item.desc}</span>
                        </div>
                        <span className="studybuddy-mobile-link-arrow">›</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer auth button */}
              <motion.div
                className="studybuddy-mobile-actions"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                transition={{ delay: visibleItems.length * 0.06 + 0.1 }}
              >
                {user ? (
                  <motion.button
                    onClick={handleLogout}
                    className="studybuddy-mobile-action-button studybuddy-mobile-logout"
                    whileTap={{ scale: 0.97 }}
                    aria-label="Log out"
                  >
                    <span className="studybuddy-button-icon"><FaSignOutAlt /></span>
                    <span>Logout</span>
                  </motion.button>
                ) : (
                  <motion.div whileTap={{ scale: 0.97 }}>
                    <div
                      className="studybuddy-mobile-action-button studybuddy-mobile-login"
                      onClick={() => handleNav("/login")}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && handleNav("/login")}
                      aria-label="Log in to StudyBuddy"
                    >
                      <span className="studybuddy-button-icon"><FaSignInAlt /></span>
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