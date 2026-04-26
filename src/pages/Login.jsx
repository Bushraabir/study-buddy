import React, { useState, useCallback } from "react";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaMagic } from "react-icons/fa";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../components/firebase";
import toast from "react-hot-toast";
import loginAnimation from "../assets/login-animation.json";
import "./Login.css";

// ── Validation Schema ──────────────────────────────────────────
const loginSchema = Yup.object({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: Yup.string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters"),
});

// ── Firebase error → human-readable message ────────────────────
const getFirebaseErrorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":
      return "No account found with this email address.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-email":
      return "Invalid email address format.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/invalid-credential":
      return "Invalid credentials. Please check your email and password.";
    default:
      return "Login failed. Please try again.";
  }
};

// ── Animation Variants ─────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const illustrationVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut", delay: 0.1 } },
};

const formVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut", delay: 0.2 } },
};

// ── Component ──────────────────────────────────────────────────
function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const navigate = useNavigate();

  const togglePassword = useCallback(() => {
    setPasswordVisible((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(async (values, { setSubmitting }) => {
    try {
      await signInWithEmailAndPassword(auth, values.email.trim(), values.password);
      toast.success("Welcome back! 🎉");
      navigate("/session");
    } catch (error) {
      const message = getFirebaseErrorMessage(error.code);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [navigate]);

  const handleMagicLink = useCallback(() => {
    navigate("/OTPAuth");
  }, [navigate]);

  return (
    <div className="studybuddy-auth-page">
      <motion.div
        className="studybuddy-auth-card"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── Left: Illustration ── */}
        <motion.div
          className="studybuddy-auth-illustration"
          variants={illustrationVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="studybuddy-auth-lottie">
            <Lottie animationData={loginAnimation} loop={true} />
          </div>
          <div className="studybuddy-auth-illustration-text">
            <h3>Study Smarter</h3>
            <p>Track sessions, master flashcards,<br />and reach your goals.</p>
          </div>
        </motion.div>

        {/* ── Right: Form ── */}
        <motion.div
          className="studybuddy-auth-form-panel"
          variants={formVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="studybuddy-auth-header">
            <h2>Welcome Back!</h2>
            <p>Sign in to continue your study journey</p>
          </div>

          <Formik
            initialValues={{ email: "", password: "" }}
            validationSchema={loginSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors, touched }) => (
              <Form className="studybuddy-auth-form" noValidate>

                {/* Email */}
                <div className="studybuddy-form-group">
                  <label className="studybuddy-form-label" htmlFor="login-email">
                    <FaEnvelope className="label-icon" />
                    Email Address
                  </label>
                  <div className="studybuddy-input-wrapper">
                    <Field
                      id="login-email"
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      className={`studybuddy-form-control ${
                        errors.email && touched.email ? "input-error" : ""
                      }`}
                      autoComplete="email"
                    />
                  </div>
                  <ErrorMessage
                    name="email"
                    render={(msg) => (
                      <span className="studybuddy-field-error">⚠ {msg}</span>
                    )}
                  />
                </div>

                {/* Password */}
                <div className="studybuddy-form-group">
                  <label className="studybuddy-form-label" htmlFor="login-password">
                    <FaLock className="label-icon" />
                    Password
                  </label>
                  <div className="studybuddy-input-wrapper">
                    <Field
                      id="login-password"
                      type={passwordVisible ? "text" : "password"}
                      name="password"
                      placeholder="Enter your password"
                      className={`studybuddy-form-control has-toggle ${
                        errors.password && touched.password ? "input-error" : ""
                      }`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="studybuddy-toggle-pw"
                      onClick={togglePassword}
                      aria-label={passwordVisible ? "Hide password" : "Show password"}
                    >
                      {passwordVisible ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <ErrorMessage
                    name="password"
                    render={(msg) => (
                      <span className="studybuddy-field-error">⚠ {msg}</span>
                    )}
                  />

                  {/* ── Forgot Password Link ── */}
                  <div className="studybuddy-forgot-row">
                    <Link to="/forgot-password" className="studybuddy-forgot-link">
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {/* Submit */}
                <motion.button
                  type="submit"
                  className="studybuddy-submit-btn"
                  disabled={isSubmitting}
                  whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="studybuddy-btn-spinner" />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </motion.button>
              </Form>
            )}
          </Formik>

          {/* ── Divider ── */}
          <div className="studybuddy-divider">
            <span />
            <p>or</p>
            <span />
          </div>

          {/* ── Magic Link Button ── */}
          <motion.button
            type="button"
            className="studybuddy-magic-btn"
            onClick={handleMagicLink}
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.01 }}
          >
            <FaMagic className="studybuddy-magic-icon" />
            Login with Magic Link
            <span className="studybuddy-magic-badge">No password</span>
          </motion.button>

          <div className="studybuddy-auth-footer">
            <p>
              Don't have an account?{" "}
              <Link to="/register">Create one free</Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Login;