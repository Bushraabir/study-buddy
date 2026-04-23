import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Importing the individual page components
import Home from "./pages/Home";
import FlashCards from "./pages/FlashCards";
import Notes from "./pages/Notes";
import Profile from "./pages/Profile";
import TopBar from "./components/TopBar";
import { auth } from "./components/firebase";
import StartSession from "./pages/Session";
import PlotGraph from "./pages/PlotGraph";
import AdvancedEquationVisualizer from "./pages/3D";
import { onAuthStateChanged } from "firebase/auth";
import "./App.css";
import OTPAuth from "./pages/OTPAuth";

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const ProtectedRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/OTPAuth" replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        {/* Topbar for actions like profile, search, etc. */}
        <TopBar user={user} />

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route 
              path="/OTPAuth" 
              element={user ? <Navigate to="/session" replace /> : <OTPAuth />} 
            />

            {/* Protected Routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/flash-cards"
              element={
                <ProtectedRoute>
                  <FlashCards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notes"
              element={
                <ProtectedRoute>
                  <Notes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/plot-graph"
              element={
                <ProtectedRoute>
                  <PlotGraph />
                </ProtectedRoute>
              }
            />
            <Route
              path="/3d-graph"
              element={
                <ProtectedRoute>
                  <AdvancedEquationVisualizer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/session"
              element={
                <ProtectedRoute>
                  <StartSession />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>

      {/* Toast for notifications */}
      <Toaster position="top-right" />
    </Router>
  );
}

export default App;