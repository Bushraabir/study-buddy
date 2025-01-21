import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa"; // Icons
import { motion } from "framer-motion"; // Animations for mobile menu and topbar
import { auth } from "./firebase"; // Firebase authentication
import "./TopBar.css"; // CSS file for styling

function TopBar() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);


  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login"); // Redirect to login after logout
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  return (
    <motion.header
      className="flex items-center justify-between px-6 py-4 bg-gray-900 shadow-md topbar-container"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Logo */}
      <div className="logo">
        <Link to="/" className="text-2xl font-bold text-indigo-500">
          Study<span className="text-white">Buddy</span>
        </Link>
      </div>

      {/* Navigation Menu (Desktop) */}
      <nav className="items-center hidden space-x-6 nav-menu md:flex">
      {user && (
          <Link to="/study-buddy/session" className="nav-link">
            Study Session
          </Link>
        )}

        <Link to="/study-buddy/flash-cards" className="nav-link">
          Flashcards
        </Link>
        <Link to="/study-buddy/notes" className="nav-link">
          Notes
        </Link>
        <Link to="/study-buddy/plot-graph" className="nav-link">
          Sketch Curves
        </Link>
        <Link to="/study-buddy/3d-graph" className="nav-link">
          3D
        </Link>
        {/* Show Profile button only if the user is logged in */}
        {user && (
          <Link to="/study-buddy/profile" className="nav-link">
            Profile
          </Link>
        )}
      </nav>

      {/* Mobile Menu Toggle */}
      <div className="flex items-center mobile-menu-button md:hidden">
        {!isMobileMenuOpen ? (
          <FaBars
            className="text-2xl text-gray-300 cursor-pointer"
            onClick={() => setMobileMenuOpen(true)}
          />
        ) : (
          <FaTimes
            className="text-2xl text-gray-300 cursor-pointer"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.nav
          className="fixed top-0 left-0 z-50 flex flex-col items-center justify-center w-full h-full bg-gray-900 mobile-menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Link
            to="/study-buddy/dashboard"
            className="mb-4 text-xl text-gray-300"
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            to="/study-buddy/flash-cards"
            className="mb-4 text-xl text-gray-300"
            onClick={() => setMobileMenuOpen(false)}
          >
            Flashcards
          </Link>
          <Link
            to="/study-buddy/notes"
            className="mb-4 text-xl text-gray-300"
            onClick={() => setMobileMenuOpen(false)}
          >
            Notes
          </Link>
 

          {/* Show Profile button in mobile menu if user is logged in */}
          {user && (
            <Link
              to="/study-buddy/profile"
              className="text-xl text-gray-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile
            </Link>
          )}
        </motion.nav>
      )}

      {/* Login/Logout Buttons */}
      <div className="items-center hidden space-x-4 md:flex">
        {user ? (
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-white bg-red-500 rounded-md logout-button hover:bg-red-600"
          >
            Logout
          </button>
        ) : (
          <Link
            to="/study-buddy/login"
            className="px-4 py-2 text-white bg-blue-500 rounded-md login-button hover:bg-blue-600"
          >
            Login
          </Link>
        )}
      </div>
    </motion.header>
  );
}

export default TopBar;
