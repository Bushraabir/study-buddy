import React, { useState, useCallback } from "react";
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../components/firebase";
import toast from "react-hot-toast";
import Lottie from "lottie-react";
import registrationAnimation from "../assets/login-animation.json";
import "./Login.css";   // shared auth design system
import "./Register.css"; // register-specific overrides

// ── Validation Schema ──────────────────────────────────────────
const registerSchema = Yup.object({
  name: Yup.string()
    .trim()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be 50 characters or fewer"),
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: Yup.string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters")
    .matches(
      /^(?=.*[A-Za-z])(?=.*\d)/,
      "Password must contain at least one letter and one number"
    ),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords do not match")
    .required("Please confirm your password"),
});

// ── Firebase error → human-readable message ────────────────────
const getFirebaseErrorMessage = (code) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in instead.";
    case "auth/invalid-email":
      return "Invalid email address format.";
    case "auth/weak-password":
      return "Password is too weak. Please choose a stronger one.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/too-many-requests":
      return "Too many requests. Please wait a moment and try again.";
    default:
      return "Registration failed. Please try again.";
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
function Register() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const navigate = useNavigate();

  const togglePassword = useCallback(() => setPasswordVisible((p) => !p), []);
  const toggleConfirm = useCallback(() => setConfirmVisible((p) => !p), []);

  const handleSubmit = useCallback(async (values, { setSubmitting }) => {
    try {
      // 1. Create Firebase Auth user
      const { user } = await createUserWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password
      );

      // 2. Set displayName on the Auth profile
      await updateProfile(user, { displayName: values.name.trim() });

      // 3. Write user document to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: values.name.trim(),
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
    } catch (error) {
      const message = getFirebaseErrorMessage(error.code);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [navigate]);

  return (
    <div className="studybuddy-auth-page">
      <motion.div
        className="studybuddy-auth-card studybuddy-auth-card--register"
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
            <Lottie animationData={registrationAnimation} loop={true} />
          </div>
          <div className="studybuddy-auth-illustration-text">
            <h3>Join StudyBuddy</h3>
            <p>Build habits, track progress,<br />and ace every exam.</p>
          </div>
        </motion.div>

        {/* ── Right: Form ── */}
        <motion.div
          className="studybuddy-auth-form-panel studybuddy-auth-form--register"
          variants={formVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="studybuddy-auth-header">
            <h2>Create Account</h2>
            <p>It's free — get started in seconds</p>
          </div>

          <Formik
            initialValues={{ name: "", email: "", password: "", confirmPassword: "" }}
            validationSchema={registerSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors, touched }) => (
              <Form className="studybuddy-auth-form" noValidate>

                {/* Name */}
                <div className="studybuddy-form-group">
                  <label className="studybuddy-form-label" htmlFor="reg-name">
                    <FaUser className="label-icon" />
                    Full Name
                  </label>
                  <div className="studybuddy-input-wrapper">
                    <Field
                      id="reg-name"
                      type="text"
                      name="name"
                      placeholder="Your full name"
                      className={`studybuddy-form-control ${
                        errors.name && touched.name ? "input-error" : ""
                      }`}
                      autoComplete="name"
                    />
                  </div>
                  <ErrorMessage
                    name="name"
                    render={(msg) => (
                      <span className="studybuddy-field-error">⚠ {msg}</span>
                    )}
                  />
                </div>

                {/* Email */}
                <div className="studybuddy-form-group">
                  <label className="studybuddy-form-label" htmlFor="reg-email">
                    <FaEnvelope className="label-icon" />
                    Email Address
                  </label>
                  <div className="studybuddy-input-wrapper">
                    <Field
                      id="reg-email"
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
                  <label className="studybuddy-form-label" htmlFor="reg-password">
                    <FaLock className="label-icon" />
                    Password
                  </label>
                  <div className="studybuddy-input-wrapper">
                    <Field
                      id="reg-password"
                      type={passwordVisible ? "text" : "password"}
                      name="password"
                      placeholder="Min 6 chars, letters + numbers"
                      className={`studybuddy-form-control has-toggle ${
                        errors.password && touched.password ? "input-error" : ""
                      }`}
                      autoComplete="new-password"
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
                </div>

                {/* Confirm Password */}
                <div className="studybuddy-form-group">
                  <label className="studybuddy-form-label" htmlFor="reg-confirm">
                    <FaLock className="label-icon" />
                    Confirm Password
                  </label>
                  <div className="studybuddy-input-wrapper">
                    <Field
                      id="reg-confirm"
                      type={confirmVisible ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Re-enter your password"
                      className={`studybuddy-form-control has-toggle ${
                        errors.confirmPassword && touched.confirmPassword
                          ? "input-error"
                          : ""
                      }`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="studybuddy-toggle-pw"
                      onClick={toggleConfirm}
                      aria-label={confirmVisible ? "Hide password" : "Show password"}
                    >
                      {confirmVisible ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <ErrorMessage
                    name="confirmPassword"
                    render={(msg) => (
                      <span className="studybuddy-field-error">⚠ {msg}</span>
                    )}
                  />
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
                      Creating account…
                    </>
                  ) : (
                    "Create Account"
                  )}
                </motion.button>
              </Form>
            )}
          </Formik>

          <div className="studybuddy-auth-footer">
            <p>
              Already have an account?{" "}
              <Link to="/login">Sign in here</Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Register;