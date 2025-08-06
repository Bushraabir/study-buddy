import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast"; // For notifications

// Importing the individual page components
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";

import FlashCards from "./pages/FlashCards";
import Notes from "./pages/Notes";
import Profile from "./pages/Profile";
import TopBar from "./components/TopBar";
import { auth } from "./components/firebase";
import StartSession from "./pages/Session";
import PlotGraph from "./pages/PlotGraph";
import AdvancedEquationVisualizer from "./pages/3D";

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="loading-screen">Loading...</div>; // Replace with a proper loading spinner
  }

  const ProtectedRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <Router >
      <div className="flex h-screen">
        <div className="flex flex-col flex-1">
          {/* Topbar for actions like profile, search, etc. */}
          <TopBar />

          <div className="flex-1 p-6 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Routes */}
              <Route
                path="y/profile"
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
      </div>

      {/* Toast for notifications */}
      <Toaster position="top-right" />
    </Router>
  );
}

export default App;
