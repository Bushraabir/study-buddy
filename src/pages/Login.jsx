import React, { useState } from "react";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../components/firebase";
import toast from "react-hot-toast";
import "./Login.css";

import loginAnimation from "../assets/login-animation.json"; 

function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const navigate = useNavigate();

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
      toast.success("Login successful!");
      navigate("/session");
    } catch (error) {
      console.error("Login error:", error.message);
      toast.error("Invalid login credentials. Please check your email and password.");
    }
    setSubmitting(false);
  };

  return (
    <div className="login-container">
      {/* Animation Section */}
      <motion.div
        className="animation-container"
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1 }}
      >
        <Lottie animationData={loginAnimation} loop={true} />
      </motion.div>

      {/* Form Section */}
      <motion.div
        className="form-container"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <h2>Welcome Back!</h2>
        <p>Please log in to your account</p>

        <Formik
          initialValues={{ email: "", password: "" }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="login-form">
              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email">
                  <FaUser /> Email
                </label>
                <Field
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  className="form-control"
                />
                <ErrorMessage
                  name="email"
                  component="div"
                  className="error-message"
                />
              </div>

              {/* Password Field */}
              <div className="form-group">
                <label htmlFor="password">
                  <FaLock /> Password
                </label>
                <div className="password-field">
                  <Field
                    type={passwordVisible ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                  >
                    {passwordVisible ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <ErrorMessage
                  name="password"
                  component="div"
                  className="error-message"
                />
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {isSubmitting ? "Logging in..." : "Login"}
              </motion.button>
            </Form>
          )}
        </Formik>

        <div className="login-footer">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="signup-link">
              Sign up here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;