import React, { useState } from "react";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom"; // For navigation
import { auth } from "../components/firebase"; 
import loginAnimation from "../assets/login-animation.json"; 
import "./Login.css";

function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const navigate = useNavigate(); // To handle redirection

  // Validation schema for form fields
  const validationSchema = Yup.object({
    email: Yup.string()
      .email("Invalid email address")
      .required("Email is required"),
    password: Yup.string()
      .required("Password is required")
      .min(6, "Password must be at least 6 characters"),
  });

  // Form submission handler
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast.success("Login successful!", { position: "top-center" });
      navigate("/study-buddy/session"); // Redirect to Profile.jsx
    } catch (error) {
      console.error("Login error:", error.message);
      toast.error("Invalid login. Please check your credentials.", {
        position: "bottom-center",
      });
    }
    setSubmitting(false);
  };

  return (
    <div className="login-container">
      {/* Left Section: Animation */}
      <motion.div
        className="login-animation-container"
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1 }}
      >
        <Lottie
          animationData={loginAnimation}
          loop={true}
          className="login-animation"
        />
      </motion.div>

      {/* Right Section: Form */}
      <motion.div
        className="login-card"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <h1 className="login-title">Welcome Back!</h1>
        <p className="login-subtitle">Please log in to your account</p>

        <Formik
          initialValues={{ email: "", password: "" }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="login-form">
              {/* Email Field */}
              <motion.div
                className="form-group"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="input-icon">
                  <FaUser className="icon" />
                  <Field
                    type="email"
                    name="email"
                    placeholder="Email Address"
                    className="form-input"
                  />
                </div>
                <ErrorMessage
                  name="email"
                  component="div"
                  className="error-message"
                />
              </motion.div>

              {/* Password Field */}
              <motion.div
                className="form-group"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="input-icon">
                  <FaLock className="icon" />
                  <Field
                    type={passwordVisible ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    className="form-input"
                  />
                  <div
                    className="password-toggle"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                  >
                    {passwordVisible ? (
                      <FaEyeSlash className="icon" />
                    ) : (
                      <FaEye className="icon" />
                    )}
                  </div>
                </div>
                <ErrorMessage
                  name="password"
                  component="div"
                  className="error-message"
                />
              </motion.div>



              {/* Submit Button */}
              <motion.button
                type="submit"
                className="login-button"
                disabled={isSubmitting}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.8 }}
              >
                {isSubmitting ? "Logging in..." : "Login"}
              </motion.button>
            </Form>
          )}
        </Formik>

        <div className="login-footer">
          <p>
            Don’t have an account?{" "}
            <a href="/study-buddy/register" className="signup-link">
              Sign up here
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
