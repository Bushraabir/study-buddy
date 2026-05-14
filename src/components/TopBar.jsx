import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaBars, FaTimes, FaGraduationCap, FaBook, FaStickyNote,
  FaChartLine, FaCube, FaUser, FaSignInAlt, FaSignOutAlt,
  FaFire, FaBrain, FaLeaf, FaChevronDown, FaFlask,
  FaMap, FaBoxOpen, FaLayerGroup, FaBookOpen,
} from "react-icons/fa";
import {
  LuDumbbell, LuFlame, LuTarget, LuZap, LuMapPin,
  LuShuffle, LuLibrary, LuClock, LuShield,
} from "react-icons/lu";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import "./TopBar.css";

/* ─── Nav structure ──────────────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Study Tools",
    items: [
      { path: "/session",    label: "Study Session",  icon: LuClock,      authRequired: true,  desc: "Focus timer & Pomodoro" },
      { path: "/flash-cards",label: "Flashcards",     icon: FaBook,       authRequired: false, desc: "Interactive learning cards" },
      { path: "/notes",      label: "Notes",          icon: FaStickyNote, authRequired: false, desc: "Rich digital notebook" },
    ],
  },
  {
    label: "Math & Graphs",
    items: [
      { path: "/plot-graph", label: "Sketch Curves",  icon: FaChartLine,  authRequired: false, desc: "2D math visualization" },
      { path: "/3d-graph",   label: "3D Graphs",      icon: FaCube,       authRequired: false, desc: "3D mathematical surfaces" },
    ],
  },
  {
    label: "Challenges",
    items: [
      { path: "/75hard",          label: "75 Hard",         icon: LuDumbbell,  authRequired: true,  desc: "75-day mental toughness"},
     { path: "/habit-stacking",  label: "Habit Stacking",  icon: LuFlame,     authRequired: true,  desc: "Link habits for momentum" },
   ],
  },
  {
    label: "Analytics",
    items: [
      { path: "/mastery",      label: "Mastery Tracker",  icon: FaBrain,    authRequired: true, desc: "Subject confidence heatmap" },
      { path: "/environment",  label: "Environment",      icon: LuMapPin,   authRequired: true, desc: "Focus location insights" },
   ],
  },
  {
    label: "Library",
    items: [
      { path: "/time-capsule",  label: "Time Capsule",  icon: FaBoxOpen,   authRequired: true,  desc: "Letters to future self" },
      { path: "/resources",     label: "Resources",     icon: LuLibrary,   authRequired: true,  desc: "Curated study materials" },
    ],
  },
];

/* flat list for mobile */
const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);


/* ─── Animation variants ─────────────────────────────────────────────────── */
const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};
const drawerVariants = {
  hidden:  { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 320, damping: 32 } },
  exit:    { x: "100%", opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};
const dropdownVariants = {
  hidden:  { opacity: 0, y: -6, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.18, ease: "easeOut" } },
  exit:    { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.13 } },
};
const navItemVariants = {
  hidden:  { x: 40, opacity: 0 },
  visible: (i) => ({ x: 0, opacity: 1, transition: { delay: i * 0.045, duration: 0.26 } }),
};

/* ─── Dropdown menu ──────────────────────────────────────────────────────── */
function DropdownMenu({ group, user, onNav, activePathname }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visibleItems = group.items.filter((i) => !i.authRequired || user);
  if (visibleItems.length === 0) return null;

  const isGroupActive = visibleItems.some((i) => i.path === activePathname);

  return (
    <div className="sb-dropdown-wrap" ref={ref}>
      <button
        className={`sb-dropdown-trigger${isGroupActive ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span>{group.label}</span>
        <FaChevronDown
          size={10}
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="sb-dropdown-panel"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="menu"
          >
            <div className="sb-dropdown-label">{group.label}</div>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePathname === item.path;
              return (
                <button
                  key={item.path}
                  className={`sb-dropdown-item${isActive ? " active" : ""}`}
                  onClick={() => { onNav(item.path); setOpen(false); }}
                  role="menuitem"
                >
                  <span className="sb-drop-icon"><Icon size={15} /></span>
                  <span className="sb-drop-text">
                    <span className="sb-drop-label">{item.label}</span>
                    <span className="sb-drop-desc">{item.desc}</span>
                  </span>
                  {item.badge && <span className="sb-badge">{item.badge}</span>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Mobile accordion group ─────────────────────────────────────────────── */
function MobileGroup({ group, user, onNav, activePathname, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const visibleItems = group.items.filter((i) => !i.authRequired || user);
  if (visibleItems.length === 0) return null;

  return (
    <div className="sb-mob-group">
      <button
        className="sb-mob-group-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="sb-mob-group-label">{group.label}</span>
        <FaChevronDown
          size={11}
          style={{
            transition: "transform 0.22s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--pookie-muted)",
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {visibleItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = activePathname === item.path;
              return (
                <motion.div
                  key={item.path}
                  custom={i}
                  variants={navItemVariants}
                  initial="hidden"
                  animate="visible"
                  className={`sb-mob-item${isActive ? " active" : ""}`}
                >
                  <button className="sb-mob-link" onClick={() => onNav(item.path)}>
                    <span className="sb-mob-icon"><Icon size={17} /></span>
                    <span className="sb-mob-text">
                      <span className="sb-mob-title">{item.label}</span>
                      <span className="sb-mob-desc">{item.desc}</span>
                    </span>
                    {item.badge && <span className="sb-badge">{item.badge}</span>}
                    <span className="sb-mob-arrow">›</span>
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main TopBar ────────────────────────────────────────────────────────── */
export default function TopBar() {
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [user, setUser]               = useState(null);
  const [isScrolled, setIsScrolled]   = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();

  /* Auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return unsub;
  }, []);

  /* Scroll */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Body lock */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  /* Escape */
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Close drawer on route change */
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  /* Timer-aware navigation */
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



  /* Active group index (for default-open accordion) */
  const activeGroupIndex = NAV_GROUPS.findIndex((g) =>
    g.items.some((i) => i.path === location.pathname)
  );

  return (
    <>
      {/* ── Sticky bar ─────────────────────────────────────────────────── */}
      <motion.header
        className={`sb-bar${isScrolled ? " sb-bar--scrolled" : ""}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="sb-container">

          {/* Logo */}
          <div
            className="sb-logo"
            onClick={() => handleNav("/")}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleNav("/")}
            aria-label="StudyBuddy Home"
          >
            <span className="sb-logo-icon">
              <img src="/favicon.png" alt="StudyBuddy" style={{ width: "1.7rem", height: "1.7rem", objectFit: "contain" }} />
            </span>
            <span className="sb-logo-text">
              Study<span className="sb-logo-accent">Buddy</span>
            </span>
          </div>

          {/* Desktop nav: pinned pills + dropdowns */}
          <nav className="sb-desktop-nav" aria-label="Primary navigation">
            
       

            {/* Divider */}
            <div className="sb-nav-divider" aria-hidden="true" />

            {/* Dropdown groups */}
            <div className="sb-dropdowns">
              {NAV_GROUPS.map((group) => (
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

          {/* Desktop actions */}
          <div className="sb-actions">
            {user ? (
              <>
                <button
                  className="sb-profile-btn"
                  onClick={() => handleNav("/profile")}
                  title="Your profile"
                  aria-label="Profile"
                >
                  <FaUser size={14} />
                </button>
                <button className="sb-btn sb-btn--logout" onClick={handleLogout}>
                  <FaSignOutAlt size={13} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button className="sb-btn sb-btn--login" onClick={() => handleNav("/OTPAuth")}>
                <FaSignInAlt size={13} />
                <span>Login</span>
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="sb-toggle">
            <button
              className="sb-hamburger"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={drawerOpen ? "x" : "bars"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0,   opacity: 1 }}
                  exit={{   rotate:  90, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  style={{ display: "flex" }}
                >
                  {drawerOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="sb-backdrop"
              variants={backdropVariants}
              initial="hidden" animate="visible" exit="exit"
              onClick={() => setDrawerOpen(false)}
            />

            <motion.nav
              className="sb-drawer"
              variants={drawerVariants}
              initial="hidden" animate="visible" exit="exit"
              aria-label="Mobile navigation"
              role="dialog"
              aria-modal="true"
            >
              {/* Drawer header */}
              <div className="sb-drawer-header">
                <div className="sb-drawer-logo">
                  <img src="/favicon.png" alt="StudyBuddy" style={{ width: "22px", height: "22px", objectFit: "contain" }} />
                  <span className="sb-drawer-logo-text">StudyBuddy</span>
                </div>
                <button
                  className="sb-drawer-close"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                >
                  <FaTimes size={15} />
                </button>
              </div>

              {/* User badge if logged in */}
              {user && (
                <div className="sb-drawer-user">
                  <div className="sb-drawer-avatar">
                    {user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="sb-drawer-user-info">
                    <span className="sb-drawer-user-name">
                      {user.displayName || "Study pookie"}
                    </span>
                    <span className="sb-drawer-user-email">{user.email}</span>
                  </div>
                </div>
              )}

              {/* Accordion groups */}
              <div className="sb-drawer-body">
                {NAV_GROUPS.map((group, i) => (
                  <MobileGroup
                    key={group.label}
                    group={group}
                    user={user}
                    onNav={handleNav}
                    activePathname={location.pathname}
                    defaultOpen={i === activeGroupIndex || i === 0}
                  />
                ))}
              </div>

              {/* Drawer footer actions */}
              <div className="sb-drawer-footer">
                {user ? (
                  <button className="sb-mob-btn sb-mob-btn--logout" onClick={handleLogout}>
                    <FaSignOutAlt size={14} />
                    <span>Logout</span>
                  </button>
                ) : (
                  <button
                    className="sb-mob-btn sb-mob-btn--login"
                    onClick={() => handleNav("/OTPAuth")}
                  >
                    <FaSignInAlt size={14} />
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

