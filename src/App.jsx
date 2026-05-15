import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged, isSignInWithEmailLink } from 'firebase/auth';
import { auth } from './components/firebase';
import TopBar from './components/TopBar';



// eager — always needed on first load
import Home       from './pages/Home';
import Login      from './pages/Login';
import Register   from './pages/Register';
import OTPAuth    from './pages/OTPAuth';
import ForgotPass from './pages/Forgotpass';
import FlashCards  from './pages/FlashCards';
import Notes       from './pages/Notes';
import PlotGraph   from './pages/PlotGraph';
import Graph3D     from './pages/3D';
import StartSession from './pages/Session';
import Profile     from './pages/Profile';

// lazy — phase 2
const Challenge75Hard      = lazy(() => import('./pages/Challenge75Hard'));
const MasteryTracker       = lazy(() => import('./pages/MasteryTracker'));
const EnvironmentOptimizer = lazy(() => import('./pages/EnvironmentOptimizer'));

// lazy — phase 3
const HabitStacking = lazy(() => import('./pages/HabitStacking'));

// lazy — phase 4
const TimeCapsule     = lazy(() => import('./pages/TimeCapsule'));
const ResourceLibrary = lazy(() => import('./pages/ResourceLibrary'));

function PageLoader() {
  return (
    <div className="pookie-loading">
      <span className="pookie-spin" style={{ fontSize: '2rem' }}>✦</span>
      <span>Loading…</span>
    </div>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Protected({ user, children }) {
  return (
    <ProtectedRoute user={user}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

export default function App() {
  const [user, setUser]     = useState(null);
  const [ready, setReady]   = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  if (!ready) return <PageLoader />;

  const isMagicLink = isSignInWithEmailLink(auth, window.location.href);
  const params      = new URLSearchParams(window.location.search);
  const isReset     = params.get('mode') === 'resetPassword' && params.get('oobCode');

  return (
    <Router>
      <TopBar user={user} />
      <Helmet>
        <html lang="en" />
        <title>Study Buddy — Track Sessions, Build Habits, Ace Exams</title>
        <meta name="description" content="Study Buddy is a free study session tracker with Pomodoro timer, flashcards, notes, 3D graphs, habit stacking, and curated resources. Built for students." />
      </Helmet>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* public */}
          <Route
            path="/"
            element={
              isMagicLink ? <Navigate to={`/OTPAuth${window.location.search}`} replace />
              : isReset   ? <Navigate to={`/forgot-password${window.location.search}`} replace />
              : <Home />
            }
          />
          <Route path="/login"          element={user ? <Navigate to="/session" replace /> : <Login />} />
          <Route path="/register"       element={user ? <Navigate to="/session" replace /> : <Register />} />
          <Route path="/forgot-password" element={<ForgotPass />} />
          <Route
            path="/OTPAuth"
            element={isMagicLink ? <OTPAuth /> : user ? <Navigate to="/session" replace /> : <OTPAuth />}
          />

          {/* core protected — eager */}
          <Route path="/profile"     element={<ProtectedRoute user={user}><Profile /></ProtectedRoute>} />
          <Route path="/session"     element={<ProtectedRoute user={user}><StartSession /></ProtectedRoute>} />
          <Route path="/flash-cards" element={<ProtectedRoute user={user}><FlashCards /></ProtectedRoute>} />
          <Route path="/notes"       element={<ProtectedRoute user={user}><Notes /></ProtectedRoute>} />
          <Route path="/plot-graph"  element={<ProtectedRoute user={user}><PlotGraph /></ProtectedRoute>} />
          <Route path="/3d-graph"    element={<ProtectedRoute user={user}><Graph3D /></ProtectedRoute>} />

          {/* phase 2 */}
          <Route path="/75hard"       element={<Protected user={user}><Challenge75Hard /></Protected>} />
          <Route path="/mastery"      element={<Protected user={user}><MasteryTracker /></Protected>} />
          <Route path="/environment"  element={<Protected user={user}><EnvironmentOptimizer /></Protected>} />

          {/* phase 3 */}
          <Route path="/habit-stacking" element={<Protected user={user}><HabitStacking /></Protected>} />

          {/* phase 4 */}
          <Route path="/time-capsule" element={<Protected user={user}><TimeCapsule /></Protected>} />
          <Route path="/resources"    element={<Protected user={user}><ResourceLibrary /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background:    'rgba(15,15,35,0.95)',
            color:         '#f8fafc',
            border:        '1px solid rgba(244,114,182,0.25)',
            borderRadius:  '12px',
            fontFamily:    'Nunito, sans-serif',
            fontWeight:    600,
            backdropFilter:'blur(16px)',
            boxShadow:     '0 8px 32px rgba(168,85,247,0.15)',
          },
          success: { iconTheme: { primary: '#a855f7', secondary: '#f8fafc' } },
          error:   { iconTheme: { primary: '#fb7185', secondary: '#f8fafc' } },
        }}
      />
    </Router>
  );
}