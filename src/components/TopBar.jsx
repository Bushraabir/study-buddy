import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import "./TopBar.css";

/**
 * A responsive, animated top navigation bar for the StudyBuddy application.
 *
 * This component listens for Firebase authentication state to conditionally
 * render authenticated routes (e.g. Study Session and Profile) and
 * displays either a login or logout button. The layout is optimised
 * for both desktop and mobile screens: on mobile the navigation items
 * appear inside a full‑screen overlay menu that slides down from the top.
 *
 * The implementation preserves all functionality from the original
 * version—authentication state monitoring, logout handling and route
 * navigation—while enhancing the visual design with smooth animations
 * and a polished dark theme. Use CSS custom properties to adjust colours
 * globally in `TopBar.css`.
 */
function TopBar() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Subscribe to Firebase auth state changes on mount.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Sign the user out and return to the home page.
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  // Close the mobile menu when a link is clicked.
  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <motion.header
      className="topbar"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="topbar__container">
        {/* Logo */}
        <div className="topbar__logo">
          <Link to="/" className="logo-link" onClick={handleLinkClick}>
            Study<span>Buddy</span>
          </Link>
        </div>
        {/* Desktop Navigation */}
        <nav className="topbar__nav topbar__nav--desktop">
          {user && (
            <Link to="/session" className="nav-link" onClick={handleLinkClick}>
              Study Session
            </Link>
          )}
          <Link to="/flash-cards" className="nav-link" onClick={handleLinkClick}>
            Flashcards
          </Link>
          <Link to="/notes" className="nav-link" onClick={handleLinkClick}>
            Notes
          </Link>
          <Link to="/plot-graph" className="nav-link" onClick={handleLinkClick}>
            Sketch Curves
          </Link>
          <Link to="/3d-graph" className="nav-link" onClick={handleLinkClick}>
            3D
          </Link>
          {user && (
            <Link to="/profile" className="nav-link" onClick={handleLinkClick}>
              Profile
            </Link>
          )}
        </nav>
        {/* Desktop Action Buttons */}
        <div className="topbar__actions">
          {user ? (
            <button
              onClick={handleLogout}
              className="action-button logout-button"
              aria-label="Logout"
            >
              Logout
            </button>
          ) : (
            <Link to="/login" className="action-button login-button" onClick={handleLinkClick}>
              Login
            </Link>
          )}
        </div>
        {/* Mobile Menu Toggle */}
        <div className="topbar__toggle">
          {!isMobileMenuOpen ? (
            <FaBars
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
            />
          ) : (
            <FaTimes
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
        </div>
      </div>
      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.nav
            key="mobile-menu"
            className="mobile-menu"
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {user && (
              <Link to="/session" className="mobile-menu-link" onClick={handleLinkClick}>
                Study Session
              </Link>
            )}
            <Link to="/flash-cards" className="mobile-menu-link" onClick={handleLinkClick}>
              Flashcards
            </Link>
            <Link to="/notes" className="mobile-menu-link" onClick={handleLinkClick}>
              Notes
            </Link>
            <Link to="/plot-graph" className="mobile-menu-link" onClick={handleLinkClick}>
              Sketch Curves
            </Link>
            <Link to="/3d-graph" className="mobile-menu-link" onClick={handleLinkClick}>
              3D
            </Link>
            {user && (
              <Link to="/profile" className="mobile-menu-link" onClick={handleLinkClick}>
                Profile
              </Link>
            )}
            {/* Mobile Authentication Actions */}
            <div className="mobile-actions">
              {user ? (
                <button
                  onClick={() => {
                    handleLogout();
                    handleLinkClick();
                  }}
                  className="action-button logout-button mobile-logout"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  className="action-button login-button mobile-login"
                  onClick={handleLinkClick}
                >
                  Login
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export default TopBar;
