import React, { useState, useCallback, useRef } from "react";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaShieldAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import {
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../components/firebase";
import toast from "react-hot-toast";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import "./Forgotpass.css";

// ── Validation Schemas 
const emailSchema = Yup.object({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
});

const otpSchema = Yup.object({
  otp: Yup.string()
    .length(6, "OTP must be exactly 6 digits")
    .matches(/^\d+$/, "OTP must contain only numbers")
    .required("OTP is required"),
});

const passwordSchema = Yup.object({
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .matches(/[A-Z]/, "Must contain at least one uppercase letter")
    .matches(/[0-9]/, "Must contain at least one number")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords do not match")
    .required("Please confirm your password"),
});

// ── Firebase error → readable message ────────────────────────
const getErrorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":
      return "No account found with this email address.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait before trying again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/expired-action-code":
      return "This reset code has expired. Please request a new one.";
    case "auth/invalid-action-code":
      return "Invalid reset code. Please check and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
};

// ── Password strength helper ──────────────────────────────────
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "#f87171" };
  if (score <= 2) return { score, label: "Fair", color: "#fb923c" };
  if (score <= 3) return { score, label: "Good", color: "#facc15" };
  if (score <= 4) return { score, label: "Strong", color: "#4ade80" };
  return { score, label: "Very Strong", color: "#a855f7" };
};

// ── Animation Variants ────────────────────────────────────────
const pageVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const stepVariants = {
  enter: (dir) => ({
    opacity: 0,
    x: dir === "forward" ? 48 : -48,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.38, ease: "easeOut" },
  },
  exit: (dir) => ({
    opacity: 0,
    x: dir === "forward" ? -48 : 48,
    transition: { duration: 0.28, ease: "easeIn" },
  }),
};

// ── OTP Input Component ───────────────────────────────────────
function OTPInput({ value, onChange }) {
  const inputsRef = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[idx] = val;
    onChange(newDigits.join(""));
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
      const newDigits = [...digits];
      newDigits[idx - 1] = "";
      onChange(newDigits.join(""));
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="fp-otp-row">
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputsRef.current[idx] = el)}
          className={`fp-otp-cell ${digits[idx] ? "fp-otp-cell--filled" : ""}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[idx] || ""}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

// ── Step indicators ───────────────────────────────────────────
const STEPS = ["Email", "Verify", "Reset"];

function StepDots({ current }) {
  return (
    <div className="fp-stepper">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className={`fp-step ${i < current ? "fp-step--done" : i === current ? "fp-step--active" : ""}`}>
            <div className="fp-step-dot">
              {i < current ? (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <polyline points="1.5,5 4,7.5 8.5,2.5" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span className="fp-step-label">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`fp-step-line ${i < current ? "fp-step-line--done" : ""}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
function ForgotPass() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If arriving from Firebase email link (oobCode in URL), skip to step 2
  const oobCode = searchParams.get("oobCode");
  const [step, setStep] = useState(oobCode ? 2 : 0);
  const [direction, setDirection] = useState("forward");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [confirmPwVisible, setConfirmPwVisible] = useState(false);
  const [passwordVal, setPasswordVal] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const goForward = () => { setDirection("forward"); setStep((s) => s + 1); };
  const goBack = () => { setDirection("back"); setStep((s) => s - 1); };

  // ── Step 0: Send reset email ──────────────────────────────
  const handleSendEmail = useCallback(async (values, { setSubmitting }) => {
    try {
      await sendPasswordResetEmail(auth, values.email.trim(), {
        url: `${window.location.origin}/forgot-password`,
        handleCodeInApp: false,
      });
      setEmail(values.email.trim());
      toast.success("Reset link sent! Check your inbox.");
      goForward();
    } catch (error) {
      toast.error(getErrorMessage(error.code));
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ── Step 1: Verify OTP (oobCode from email link) ──────────
  // Since Firebase password reset sends a link (not a numeric OTP),
  // we guide the user to open the link which appends ?oobCode= to this page.
  // We auto-advance to step 2 if oobCode is present in the URL.
  // The "OTP" UX here lets the user paste the code from their email URL manually.
  const handleVerifyOtp = useCallback(async () => {
    if (otp.length !== 6) {
      setOtpError("Please enter the 6-digit code from your email.");
      return;
    }
    setOtpError("");
    // Since Firebase doesn't send numeric OTPs natively,
    // we treat the 6-digit entry as a UX step and rely on the oobCode in URL.
    // If user arrived via the link, oobCode is already set and we skip here.
    // Otherwise prompt them to click the link in their email.
    if (!oobCode) {
      toast("Please click the link in your email to continue. It will bring you back here automatically.", { icon: "📧", duration: 5000 });
      return;
    }
    goForward();
  }, [otp, oobCode]);

  const handleResend = useCallback(async () => {
    if (!email || resendCooldown > 0) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("New reset email sent!");
      setResendCooldown(60);
      cooldownRef.current = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error(getErrorMessage(error.code));
    }
  }, [email, resendCooldown]);

  // ── Step 2: Confirm new password ──────────────────────────
  const handleResetPassword = useCallback(async (values, { setSubmitting }) => {
    if (!oobCode) {
      toast.error("Invalid reset session. Please restart the process.");
      setSubmitting(false);
      return;
    }
    try {
      await verifyPasswordResetCode(auth, oobCode);
      await confirmPasswordReset(auth, oobCode, values.password);
      toast.success("Password reset successfully! Please log in.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      toast.error(getErrorMessage(error.code));
    } finally {
      setSubmitting(false);
    }
  }, [oobCode, navigate]);

  const strength = getPasswordStrength(passwordVal);

  return (
    <div className="fp-page">
      <motion.div
        className="fp-card"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── Header ── */}
        <div className="fp-card-header">
          <div className="fp-shield-icon">
            <FaShieldAlt />
          </div>
          <h2 className="fp-title">Reset Password</h2>
          <p className="fp-subtitle">We'll get you back in safely</p>
        </div>

        {/* ── Step Indicators ── */}
        <StepDots current={step} />

        {/* ── Steps ── */}
        <div className="fp-step-content">
          <AnimatePresence mode="wait" custom={direction}>

            {/* STEP 0 — Email */}
            {step === 0 && (
              <motion.div
                key="step-email"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="fp-step-body"
              >
                <p className="fp-step-desc">
                  Enter the email address linked to your account and we'll send you a reset link.
                </p>
                <Formik
                  initialValues={{ email: "" }}
                  validationSchema={emailSchema}
                  onSubmit={handleSendEmail}
                >
                  {({ isSubmitting, errors, touched }) => (
                    <Form className="fp-form" noValidate>
                      <div className="fp-form-group">
                        <label className="fp-label" htmlFor="fp-email">
                          <FaEnvelope className="fp-label-icon" />
                          Email Address
                        </label>
                        <div className="fp-input-wrap">
                          <Field
                            id="fp-email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            className={`fp-input ${errors.email && touched.email ? "fp-input--error" : ""}`}
                          />
                        </div>
                        <ErrorMessage
                          name="email"
                          render={(msg) => <span className="fp-field-error">⚠ {msg}</span>}
                        />
                      </div>

                      <motion.button
                        type="submit"
                        className="fp-btn fp-btn--primary"
                        disabled={isSubmitting}
                        whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
                      >
                        {isSubmitting ? (
                          <><span className="fp-spinner" />Sending…</>
                        ) : (
                          "Send Reset Link"
                        )}
                      </motion.button>
                    </Form>
                  )}
                </Formik>
              </motion.div>
            )}

            {/* STEP 1 — Check Email / Verify */}
            {step === 1 && (
              <motion.div
                key="step-verify"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="fp-step-body"
              >
                <div className="fp-email-sent-icon">📬</div>
                <p className="fp-step-desc">
                  A reset link was sent to <strong>{email}</strong>. Open your inbox and click the link — it will bring you right back here to set your new password.
                </p>

                <div className="fp-verify-tips">
                  <div className="fp-tip">
                    <span className="fp-tip-num">1</span>
                    <span>Open the email from StudyBuddy</span>
                  </div>
                  <div className="fp-tip">
                    <span className="fp-tip-num">2</span>
                    <span>Click <strong>"Reset Password"</strong> in the email</span>
                  </div>
                  <div className="fp-tip">
                    <span className="fp-tip-num">3</span>
                    <span>You'll return here automatically to set a new password</span>
                  </div>
                </div>

                <div className="fp-resend-row">
                  <span className="fp-resend-label">Didn't receive it?</span>
                  <button
                    type="button"
                    className="fp-resend-btn"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Email"}
                  </button>
                </div>

                <button
                  type="button"
                  className="fp-btn fp-btn--ghost"
                  onClick={goBack}
                >
                  <FaArrowLeft style={{ marginRight: 8 }} />
                  Use a different email
                </button>
              </motion.div>
            )}

            {/* STEP 2 — New Password (reached via oobCode in URL) */}
            {step === 2 && (
              <motion.div
                key="step-reset"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="fp-step-body"
              >
                <p className="fp-step-desc">
                  Choose a strong new password for your account.
                </p>
                <Formik
                  initialValues={{ password: "", confirmPassword: "" }}
                  validationSchema={passwordSchema}
                  onSubmit={handleResetPassword}
                >
                  {({ isSubmitting, errors, touched }) => (
                    <Form className="fp-form" noValidate>
                      {/* New Password */}
                      <div className="fp-form-group">
                        <label className="fp-label" htmlFor="fp-password">
                          <FaLock className="fp-label-icon" />
                          New Password
                        </label>
                        <div className="fp-input-wrap">
                          <Field name="password">
                            {({ field }) => (
                              <input
                                {...field}
                                id="fp-password"
                                type={pwVisible ? "text" : "password"}
                                placeholder="Min. 8 characters"
                                autoComplete="new-password"
                                className={`fp-input fp-input--pw ${errors.password && touched.password ? "fp-input--error" : ""}`}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setPasswordVal(e.target.value);
                                }}
                              />
                            )}
                          </Field>
                          <button
                            type="button"
                            className="fp-pw-toggle"
                            onClick={() => setPwVisible((v) => !v)}
                            aria-label={pwVisible ? "Hide password" : "Show password"}
                          >
                            {pwVisible ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                        {/* Strength bar */}
                        {passwordVal && (
                          <div className="fp-strength">
                            <div className="fp-strength-track">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <div
                                  key={n}
                                  className="fp-strength-seg"
                                  style={{
                                    background: n <= strength.score ? strength.color : "rgba(255,255,255,0.08)",
                                    transition: "background 0.3s ease",
                                  }}
                                />
                              ))}
                            </div>
                            <span className="fp-strength-label" style={{ color: strength.color }}>
                              {strength.label}
                            </span>
                          </div>
                        )}
                        <ErrorMessage name="password" render={(msg) => <span className="fp-field-error">⚠ {msg}</span>} />
                      </div>

                      {/* Confirm Password */}
                      <div className="fp-form-group">
                        <label className="fp-label" htmlFor="fp-confirm">
                          <FaLock className="fp-label-icon" />
                          Confirm Password
                        </label>
                        <div className="fp-input-wrap">
                          <Field
                            id="fp-confirm"
                            name="confirmPassword"
                            type={confirmPwVisible ? "text" : "password"}
                            placeholder="Repeat your password"
                            autoComplete="new-password"
                            className={`fp-input fp-input--pw ${errors.confirmPassword && touched.confirmPassword ? "fp-input--error" : ""}`}
                          />
                          <button
                            type="button"
                            className="fp-pw-toggle"
                            onClick={() => setConfirmPwVisible((v) => !v)}
                            aria-label={confirmPwVisible ? "Hide" : "Show"}
                          >
                            {confirmPwVisible ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                        <ErrorMessage name="confirmPassword" render={(msg) => <span className="fp-field-error">⚠ {msg}</span>} />
                      </div>

                      <motion.button
                        type="submit"
                        className="fp-btn fp-btn--primary"
                        disabled={isSubmitting}
                        whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
                      >
                        {isSubmitting ? (
                          <><span className="fp-spinner" />Resetting…</>
                        ) : (
                          "Set New Password"
                        )}
                      </motion.button>
                    </Form>
                  )}
                </Formik>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="fp-footer">
          <Link to="/login" className="fp-back-login">
            <FaArrowLeft style={{ marginRight: 6, fontSize: 11 }} />
            Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default ForgotPass;