// src/components/TopBar.jsx  v4.1
// ─── StudyBuddy TopBar ────────────────────────────────────────────────────────
// Features:
//  • Desktop: sticky glass bar with dropdown groups + settings/profile/logout
//  • Mobile: slide-in drawer with accordion groups
//  • Page-visibility: filters nav items per user's Settings preferences
//  • Settings link always present when logged in (gear icon)
//  • Timer-aware navigation (warns before leaving an active session)
//  • Reads pageVisibility from Firestore in real-time via onSnapshot
//  • v4.1: Theme context integration for correct theme-aware bar class
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaBars, FaTimes, FaBook, FaStickyNote,
  FaChartLine, FaCube, FaUser, FaSignInAlt, FaSignOutAlt,
  FaBrain, FaChevronDown, FaBoxOpen, FaCog,
} from "react-icons/fa";
import {
  LuDumbbell, LuFlame, LuMapPin, LuLibrary, LuClock,
} from "react-icons/lu";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";
import { NAV_PAGES } from "../pages/Settings";
import "./TopBar.css";

// ─── Static nav structure ─────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "Study Tools",
    items: [
      { path: "/session",     label: "Study Session",  icon: LuClock,     visId: "session",     authRequired: true,  desc: "Focus timer & Pomodoro" },
      { path: "/flash-cards", label: "Flashcards",     icon: FaBook,      visId: "flashcards",  authRequired: false, desc: "Interactive learning cards" },
      { path: "/notes",       label: "Notes",          icon: FaStickyNote,visId: "notes",       authRequired: false, desc: "Rich digital notebook" },
    ],
  },
  {
    label: "Math & Graphs",
    items: [
      { path: "/plot-graph",  label: "Sketch Curves",  icon: FaChartLine, visId: "plotgraph",   authRequired: false, desc: "2D math visualization" },
      { path: "/3d-graph",    label: "3D Graphs",      icon: FaCube,      visId: "3dgraph",     authRequired: false, desc: "3D mathematical surfaces" },
    ],
  },
  {
    label: "Challenges",
    items: [
      { path: "/75hard",         label: "75 Hard",        icon: LuDumbbell, visId: "75hard",   authRequired: true, desc: "75-day mental toughness" },
      { path: "/habit-stacking", label: "Habit Stacking", icon: LuFlame,    visId: "habits",   authRequired: true, desc: "Link habits for momentum" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { path: "/mastery",     label: "Mastery Tracker", icon: FaBrain,   visId: "mastery",     authRequired: true, desc: "Subject confidence heatmap" },
      { path: "/environment", label: "Environment",     icon: LuMapPin,  visId: "environment", authRequired: true, desc: "Focus location insights" },
    ],
  },
  {
    label: "Library",
    items: [
      { path: "/time-capsule", label: "Time Capsule", icon: FaBoxOpen,  visId: "timecapsule", authRequired: true, desc: "Letters to future self" },
      { path: "/resources",    label: "Resources",    icon: LuLibrary,  visId: "resources",   authRequired: true, desc: "Curated study materials" },
    ],
  },
];

// ─── Animation variants ───────────────────────────────────────────────────────
const backdropV = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22 } },
  exit:    { opacity: 0, transition: { duration: 0.18 } },
};
const drawerV = {
  hidden:  { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
  exit:    { x: "100%", opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};
const dropdownV = {
  hidden:  { opacity: 0, y: -8, scale: 0.96 },
  visible: { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.17, ease: "easeOut" } },
  exit:    { opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.13 } },
};

// ─── Dropdown (desktop) ───────────────────────────────────────────────────────
function DropdownMenu({ group, user, onNav, activePathname }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => setOpen(false), [activePathname]);

  if (group.items.length === 0) return null;
  const isGroupActive = group.items.some((i) => i.path === activePathname);

  return (
    <div className="sb-dd-wrap" ref={ref}>
      <button
        className={`sb-dd-trigger${isGroupActive ? " active" : ""}${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="sb-dd-label">{group.label}</span>
        <FaChevronDown
          size={9}
          className="sb-dd-chevron"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="sb-dd-panel"
            variants={dropdownV}
            initial="hidden" animate="visible" exit="exit"
            role="menu"
          >
            <div className="sb-dd-panel-label">{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activePathname === item.path;
              return (
                <button
                  key={item.path}
                  className={`sb-dd-item${isActive ? " active" : ""}`}
                  onClick={() => { onNav(item.path); setOpen(false); }}
                  role="menuitem"
                >
                  <span className="sb-dd-item-icon"><Icon size={14} /></span>
                  <span className="sb-dd-item-text">
                    <span className="sb-dd-item-label">{item.label}</span>
                    <span className="sb-dd-item-desc">{item.desc}</span>
                  </span>
                  {isActive && <span className="sb-dd-active-dot" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Mobile accordion group ───────────────────────────────────────────────────
function MobileGroup({ group, user, onNav, activePathname, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);

  if (group.items.length === 0) return null;
  const isGroupActive = group.items.some((i) => i.path === activePathname);

  return (
    <div className={`sb-mob-group${isGroupActive ? " sb-mob-group--active" : ""}`}>
      <button
        className={`sb-mob-group-header${isGroupActive ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="sb-mob-group-label">{group.label}</span>
        <FaChevronDown
          size={10}
          className="sb-mob-chevron"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: 0.22, ease: "easeOut" } }}
            exit={{    height: 0,    opacity: 0, transition: { duration: 0.18, ease: "easeIn"  } }}
            style={{ overflow: "hidden" }}
          >
            <div className="sb-mob-items">
              {group.items.map((item, i) => {
                const Icon = item.icon;
                const isActive = activePathname === item.path;
                return (
                  <motion.button
                    key={item.path}
                    className={`sb-mob-item${isActive ? " active" : ""}`}
                    onClick={() => onNav(item.path)}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.22 } }}
                  >
                    <span className={`sb-mob-item-icon${isActive ? " active" : ""}`}>
                      <Icon size={16} />
                    </span>
                    <span className="sb-mob-item-text">
                      <span className="sb-mob-item-label">{item.label}</span>
                      <span className="sb-mob-item-desc">{item.desc}</span>
                    </span>
                    {isActive
                      ? <span className="sb-mob-active-pill">current</span>
                      : <span className="sb-mob-arrow">›</span>
                    }
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main TopBar ──────────────────────────────────────────────────────────────
export default function TopBar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user,       setUser]       = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [pageVis,    setPageVis]    = useState({});

  const navigate = useNavigate();
  const location = useLocation();
  const visUnsubRef = useRef(null);

  // ── Auth listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (visUnsubRef.current) {
        visUnsubRef.current();
        visUnsubRef.current = null;
      }

      if (u) {
        visUnsubRef.current = onSnapshot(
          doc(db, "users", u.uid),
          (snap) => {
            if (snap.exists()) {
              setPageVis(snap.data().pageVisibility || {});
            }
          },
          () => {}
        );
      } else {
        setPageVis({});
      }
    });

    return () => {
      unsub();
      if (visUnsubRef.current) visUnsubRef.current();
    };
  }, []);

  // ── Scroll detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsScrolled(window.scrollY > 18);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // ── Body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // ── Keyboard: Escape closes drawer ────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Close drawer on route change ──────────────────────────────────────────
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // ── Timer-aware nav guard ─────────────────────────────────────────────────
  const checkTimer = useCallback((cb) => {
    if (window.studyBuddyTimerState?.isRunning) {
      return window.studyBuddyTimerState.showWarning(cb);
    }
    return false;
  }, []);

  const handleNav = useCallback((path) => {
    if (location.pathname === path) { setDrawerOpen(false); return; }
    const go = () => { setDrawerOpen(false); navigate(path); };
    if (!checkTimer(go)) go();
  }, [location.pathname, navigate, checkTimer]);

  const handleLogout = useCallback(async () => {
    const doLogout = async () => {
      try {
        await signOut(auth);
        setDrawerOpen(false);
        navigate("/");
        toast.success("Logged out — see you soon! 💜");
      } catch {
        toast.error("Logout failed");
      }
    };
    if (!checkTimer(doLogout)) doLogout();
  }, [navigate, checkTimer]);

  // ── Filtered nav groups (visibility + auth) ───────────────────────────────
  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.authRequired && !user) return false;
        if (user && pageVis[item.visId] === false) return false;
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, [user, pageVis]);

  const activeGroupIndex = useMemo(
    () => filteredGroups.findIndex((g) => g.items.some((i) => i.path === location.pathname)),
    [filteredGroups, location.pathname]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Sticky bar ──────────────────────────────────────────────────── */}
      <motion.header
        className={`sb-bar${isScrolled ? " sb-bar--scrolled" : ""}`}
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="sb-inner">

          {/* Logo */}
          <button
            className="sb-logo"
            onClick={() => handleNav("/")}
            aria-label="StudyBuddy — go home"
          >
            <span className="sb-logo-img">
              <img src="/favicon.png" alt="" aria-hidden="true" />
            </span>
            <span className="sb-logo-text">
              Study<span className="sb-logo-accent">Buddy</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="sb-desktop-nav" aria-label="Primary navigation">
            <div className="sb-nav-divider" aria-hidden="true" />
            <div className="sb-dropdowns">
              {filteredGroups.map((group) => (
                <DropdownMenu
                  key={group.label}
                  group={group}
                  user={user}
                  onNav={handleNav}
                  activePathname={location.pathname}
                />
              ))}
            </div>
          </nav>

          {/* Desktop right-side actions */}
          <div className="sb-actions">
            {user ? (
              <>
                {/* Settings gear */}
                <button
                  className={`sb-icon-btn${location.pathname === "/settings" ? " active" : ""}`}
                  onClick={() => handleNav("/settings")}
                  title="Settings"
                  aria-label="Settings"
                >
                  <FaCog size={14} />
                </button>

                {/* Profile avatar */}
                <button
                  className={`sb-avatar-btn${location.pathname === "/profile" ? " active" : ""}`}
                  onClick={() => handleNav("/profile")}
                  title="Your profile"
                  aria-label="Profile"
                >
                  {user.photoURL
                    ? <img src={user.photoURL} alt="Profile" className="sb-avatar-img" />
                    : <span className="sb-avatar-initial">
                        {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                      </span>
                  }
                  <span className="sb-avatar-online" />
                </button>

                {/* Logout */}
                <button className="sb-btn sb-btn--logout" onClick={handleLogout}>
                  <FaSignOutAlt size={12} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button className="sb-btn sb-btn--login" onClick={() => handleNav("/login")}>
                <FaSignInAlt size={12} />
                <span>Login</span>
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={`sb-hamburger${drawerOpen ? " open" : ""}`}
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
          >
            <span className="sb-hamburger-bar" />
            <span className="sb-hamburger-bar" />
            <span className="sb-hamburger-bar" />
          </button>

        </div>
      </motion.header>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="sb-backdrop"
              variants={backdropV}
              initial="hidden" animate="visible" exit="exit"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.nav
              className="sb-drawer"
              variants={drawerV}
              initial="hidden" animate="visible" exit="exit"
              aria-label="Mobile navigation"
              role="dialog"
              aria-modal="true"
            >
              {/* Drawer header */}
              <div className="sb-drawer-header">
                <div className="sb-drawer-logo-wrap">
                  <img src="/favicon.png" alt="StudyBuddy" className="sb-drawer-favicon" />
                  <span className="sb-drawer-logo-text">StudyBuddy</span>
                </div>
                <button
                  className="sb-drawer-close"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              {/* User card */}
              {user && (
                <div className="sb-drawer-user">
                  <div className="sb-drawer-user-avatar">
                    {user.photoURL
                      ? <img src={user.photoURL} alt="Profile" />
                      : <span>{(user.displayName || user.email || "U").charAt(0).toUpperCase()}</span>
                    }
                    <span className="sb-drawer-user-online" />
                  </div>
                  <div className="sb-drawer-user-info">
                    <span className="sb-drawer-user-name">{user.displayName || "Study pookie"}</span>
                    <span className="sb-drawer-user-email">{user.email}</span>
                  </div>
                  <button
                    className="sb-drawer-settings-btn"
                    onClick={() => handleNav("/settings")}
                    aria-label="Settings"
                    title="Settings"
                  >
                    <FaCog size={13} />
                  </button>
                </div>
              )}

              {/* Nav groups */}
              <div className="sb-drawer-body">
                {filteredGroups.map((group, i) => (
                  <MobileGroup
                    key={group.label}
                    group={group}
                    user={user}
                    onNav={handleNav}
                    activePathname={location.pathname}
                    defaultOpen={i === activeGroupIndex || i === 0}
                  />
                ))}

                {/* Profile & Settings links in drawer */}
                {user && (
                  <div className="sb-drawer-quick-links">
                    <button
                      className={`sb-drawer-quick-link${location.pathname === "/profile" ? " active" : ""}`}
                      onClick={() => handleNav("/profile")}
                    >
                      <FaUser size={13} />
                      <span>My Profile</span>
                    </button>
                    <button
                      className={`sb-drawer-quick-link${location.pathname === "/settings" ? " active" : ""}`}
                      onClick={() => handleNav("/settings")}
                    >
                      <FaCog size={13} />
                      <span>Settings</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sb-drawer-footer">
                {user ? (
                  <button className="sb-drawer-logout" onClick={handleLogout}>
                    <FaSignOutAlt size={13} />
                    <span>Log out</span>
                  </button>
                ) : (
                  <button className="sb-drawer-login" onClick={() => handleNav("/login")}>
                    <FaSignInAlt size={13} />
                    <span>Login to StudyBuddy</span>
                  </button>
                )}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}