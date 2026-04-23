import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../components/firebase";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import loginAnimation from "../assets/login-animation.json";
import "./OTPAuth.css";

// ── Steps ──────────────────────────────────────────────────────
const STEP = { EMAIL: "email", OTP: "otp", NAME: "name", DONE: "done" };

// ── OTP digit count ────────────────────────────────────────────
const OTP_LENGTH = 6;

// ── Particle background (purely decorative) ────────────────────
function Particles() {
  return (
    <div className="otp-particles" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} className="otp-particle" style={{ "--i": i }} />
      ))}
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────
function StepDots({ step }) {
  const steps = [STEP.EMAIL, STEP.OTP, STEP.NAME];
  const idx = steps.indexOf(step);
  return (
    <div className="otp-step-dots">
      {steps.map((s, i) => (
        <span
          key={s}
          className={`otp-step-dot ${i <= idx ? "otp-step-dot--active" : ""} ${
            i < idx ? "otp-step-dot--done" : ""
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function OTPAuth() {
  const [step, setStep] = useState(STEP.EMAIL);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const digitRefs = useRef([]);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // ── Handle magic link return on page load ──────────────────
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = localStorage.getItem("sb_otp_email");
      if (savedEmail) {
        handleMagicLinkSignIn(savedEmail);
      } else {
        // Edge case: opened on a different device
        const promptedEmail = window.prompt(
          "Please enter your email to confirm sign-in:"
        );
        if (promptedEmail) {
          handleMagicLinkSignIn(promptedEmail.trim().toLowerCase());
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resend countdown ───────────────────────────────────────
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [resendTimer]);

  // ── Build actionCodeSettings dynamically ──────────────────
  // CRITICAL FIX: url must be the exact page origin so Firebase
  // sends the link back here. This domain MUST be added to
  // Firebase Console → Authentication → Settings → Authorized domains.
  const getActionCodeSettings = useCallback(() => {
    return {
      // Use the current page origin + pathname so the link returns
      // to whichever host/port you're running on (localhost or prod).
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    };
  }, []);

  // ── Send magic link ────────────────────────────────────────
  const sendMagicLink = useCallback(
    async (emailAddr) => {
      const actionCodeSettings = getActionCodeSettings();
      await sendSignInLinkToEmail(auth, emailAddr, actionCodeSettings);
      localStorage.setItem("sb_otp_email", emailAddr);
    },
    [getActionCodeSettings]
  );

  // ── Step 1: Email submit ───────────────────────────────────
  const handleEmailSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        toast.error("Please enter a valid email address.");
        return;
      }
      setLoading(true);
      try {
        await sendMagicLink(trimmed);
        setEmail(trimmed);
        setResendTimer(60);
        setStep(STEP.OTP);
        toast.success("✉️ Magic link sent! Check your inbox.");
      } catch (err) {
        console.error("sendSignInLinkToEmail error:", err.code, err.message);

        // Provide actionable error messages per Firebase error code
        if (err.code === "auth/operation-not-allowed") {
          toast.error(
            "Email link sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in methods.",
            { duration: 6000 }
          );
        } else if (err.code === "auth/unauthorized-continue-uri") {
          toast.error(
            `Domain not authorized. Add "${window.location.hostname}" to Firebase Console → Authentication → Settings → Authorized domains.`,
            { duration: 8000 }
          );
        } else if (err.code === "auth/invalid-email") {
          toast.error("Invalid email address.");
        } else if (err.code === "auth/too-many-requests") {
          toast.error("Too many attempts. Please wait a few minutes.");
        } else {
          toast.error(`Failed to send link: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [email, sendMagicLink]
  );

  // ── Magic link sign-in handler ─────────────────────────────
  const handleMagicLinkSignIn = useCallback(
    async (emailAddr) => {
      setLoading(true);
      try {
        const result = await signInWithEmailLink(
          auth,
          emailAddr,
          window.location.href
        );
        localStorage.removeItem("sb_otp_email");
        // Clean the OOB code from the URL without a page reload
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        // Check Firestore for existing user
        const userRef = doc(db, "users", result.user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          toast.success("Welcome back! 🎉");
          navigate("/session");
        } else {
          setStep(STEP.NAME);
          setLoading(false);
        }
      } catch (err) {
        console.error("signInWithEmailLink error:", err.code, err.message);
        if (err.code === "auth/invalid-action-code") {
          toast.error(
            "Link expired or already used. Please request a new one.",
            { duration: 5000 }
          );
        } else if (err.code === "auth/invalid-email") {
          toast.error("Email mismatch. Please re-enter your email.");
        } else {
          toast.error("Sign-in failed. Please try again.");
        }
        setStep(STEP.EMAIL);
        setLoading(false);
      }
    },
    [navigate]
  );

  // ── OTP digits input (decorative UX) ──────────────────────
  const handleDigitChange = useCallback(
    (i, val) => {
      const char = val.replace(/\D/g, "").slice(-1);
      const next = [...otp];
      next[i] = char;
      setOtp(next);
      if (char && i < OTP_LENGTH - 1) digitRefs.current[i + 1]?.focus();
    },
    [otp]
  );

  const handleDigitKeyDown = useCallback(
    (i, e) => {
      if (e.key === "Backspace" && !otp[i] && i > 0) {
        digitRefs.current[i - 1]?.focus();
      }
    },
    [otp]
  );

  const handleDigitPaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((c, idx) => {
      next[idx] = c;
    });
    setOtp(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    digitRefs.current[focusIdx]?.focus();
  }, []);

  // ── Resend ─────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await sendMagicLink(email);
      setResendTimer(60);
      toast.success("New magic link sent!");
    } catch (err) {
      console.error("Resend error:", err.code, err.message);
      toast.error("Couldn't resend. Try again.");
    } finally {
      setLoading(false);
    }
  }, [email, resendTimer, sendMagicLink]);

  // ── Step 3: Name submit (new user) ─────────────────────────
  const handleNameSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || trimmed.length < 2) {
        toast.error("Please enter your full name (at least 2 characters).");
        return;
      }
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("No authenticated user found.");
        await setDoc(doc(db, "users", user.uid), {
          name: trimmed,
          email: user.email,
          createdAt: serverTimestamp(),
          lastStudyDate: null,
          totalTimeToday: 0,
          totalTimeWeek: 0,
          totalTimeMonth: 0,
          totalTimeAllTime: 0,
          studyFields: ["General"],
          fieldTimes: {},
          todoList: [],
          dailyStats: {},
          weeklyStats: {},
          monthlyStats: {},
        });
        toast.success("Account created! Let's start studying 🚀");
        navigate("/session");
      } catch (err) {
        console.error("Firestore setDoc error:", err.message);
        toast.error("Something went wrong saving your profile. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [name, navigate]
  );

  // ── Slide variants ─────────────────────────────────────────
  const slideIn = {
    initial: { opacity: 0, x: 40, filter: "blur(4px)" },
    animate: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
    },
    exit: {
      opacity: 0,
      x: -40,
      filter: "blur(4px)",
      transition: { duration: 0.25 },
    },
  };

  return (
    <div className="otp-page">
      <Particles />

      {/* Ambient orbs */}
      <div className="otp-orb otp-orb--1" />
      <div className="otp-orb otp-orb--2" />
      <div className="otp-orb otp-orb--3" />

      <motion.div
        className="otp-shell"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* ── Left panel ── */}
        <div className="otp-panel otp-panel--left">
          <div className="otp-lottie-wrap">
            <Lottie animationData={loginAnimation} loop />
          </div>
          <div className="otp-brand">
            <h1 className="otp-brand-name">StudyBuddy</h1>
            <p className="otp-brand-tagline">
              No passwords.
              <br />
              Just pure focus.
            </p>
          </div>
          <ul className="otp-perks">
            {[
              "Track every study session",
              "Master topics with flashcards",
              "Visualize your progress",
            ].map((p) => (
              <li key={p}>
                <span className="otp-perk-dot" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right panel ── */}
        <div className="otp-panel otp-panel--right">
          <StepDots step={step} />

          <AnimatePresence mode="wait">
            {/* ── STEP: EMAIL ── */}
            {step === STEP.EMAIL && (
              <motion.div key="email" className="otp-form-wrap" {...slideIn}>
                <div className="otp-form-header">
                  <div className="otp-icon-badge">✉️</div>
                  <h2>Welcome</h2>
                  <p>
                    Enter your email and we'll send you a magic link — no
                    password needed.
                  </p>
                </div>
                <form onSubmit={handleEmailSubmit} noValidate>
                  <div className="otp-field-group">
                    <label htmlFor="otp-email" className="otp-label">
                      Email address
                    </label>
                    <input
                      id="otp-email"
                      type="email"
                      className="otp-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <motion.button
                    type="submit"
                    className="otp-btn otp-btn--primary"
                    disabled={loading}
                    whileTap={{ scale: 0.97 }}
                  >
                    {loading ? <span className="otp-spinner" /> : null}
                    {loading ? "Sending…" : "Send Magic Link →"}
                  </motion.button>
                </form>
                <p className="otp-footnote">Works for both sign in &amp; sign up.</p>
              </motion.div>
            )}

            {/* ── STEP: OTP / WAITING ── */}
            {step === STEP.OTP && (
              <motion.div key="otp" className="otp-form-wrap" {...slideIn}>
                <div className="otp-form-header">
                  <div className="otp-icon-badge">🔗</div>
                  <h2>Check your email</h2>
                  <p>
                    We sent a magic link to <strong>{email}</strong>. Click it
                    to continue.
                  </p>
                </div>

                {/* Visual OTP digits — decorative only */}
                <div
                  className="otp-digits"
                  onPaste={handleDigitPaste}
                  aria-label="One-time code display"
                >
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (digitRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      className={`otp-digit ${d ? "otp-digit--filled" : ""}`}
                      aria-label={`Digit ${i + 1}`}
                    />
                  ))}
                </div>

                <p className="otp-hint">
                  💡 Open the link on <strong>this device</strong> — it will
                  sign you in automatically.
                </p>

                <div className="otp-actions-row">
                  <button
                    type="button"
                    className="otp-btn otp-btn--ghost"
                    onClick={() => {
                      setStep(STEP.EMAIL);
                      setOtp(Array(OTP_LENGTH).fill(""));
                    }}
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    className={`otp-btn otp-btn--outline ${
                      resendTimer > 0 ? "otp-btn--disabled" : ""
                    }`}
                    onClick={handleResend}
                    disabled={resendTimer > 0 || loading}
                  >
                    {loading
                      ? "Sending…"
                      : resendTimer > 0
                      ? `Resend in ${resendTimer}s`
                      : "Resend link"}
                  </button>
                </div>

                <div className="otp-waiting-indicator">
                  <span className="otp-pulse" />
                  Waiting for you to click the link…
                </div>
              </motion.div>
            )}

            {/* ── STEP: NAME (new user) ── */}
            {step === STEP.NAME && (
              <motion.div key="name" className="otp-form-wrap" {...slideIn}>
                <div className="otp-form-header">
                  <div className="otp-icon-badge">🎉</div>
                  <h2>One last thing</h2>
                  <p>
                    What should we call you? This is your StudyBuddy display
                    name.
                  </p>
                </div>
                <form onSubmit={handleNameSubmit} noValidate>
                  <div className="otp-field-group">
                    <label htmlFor="otp-name" className="otp-label">
                      Your name
                    </label>
                    <input
                      id="otp-name"
                      type="text"
                      className="otp-input"
                      placeholder="e.g. Alex Johnson"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <motion.button
                    type="submit"
                    className="otp-btn otp-btn--primary"
                    disabled={loading}
                    whileTap={{ scale: 0.97 }}
                  >
                    {loading ? <span className="otp-spinner" /> : null}
                    {loading ? "Setting up…" : "Start Studying 🚀"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}