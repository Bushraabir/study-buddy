import React, { useState } from "react";
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import { Tooltip } from "react-tooltip";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { auth, db } from "../components/firebase";
import Lottie from "lottie-react";
import registrationAnimation from "../assets/login-animation.json"; // Lottie file
import "./Register.css";

function Register() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  // Validation Schema
  const validationSchema = Yup.object({
    name: Yup.string()
      .required("Name is required")
      .min(3, "Name must be at least 3 characters"),
    email: Yup.string()
      .email("Invalid email address")
      .required("Email is required"),
    password: Yup.string()
      .required("Password is required")
      .min(6, "Password must be at least 6 characters")
      .matches(
        /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,}$/,
        "Password must contain letters and numbers"
      ),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password"), null], "Passwords must match")
      .required("Confirm Password is required"),
  });

  // Form Submission
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      // Save user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: values.name,
        email: user.email,
        createdAt: new Date(),
      });

      toast.success("Registration successful!", { position: "top-center" });
      window.location.href = "/profile"; // Redirect to profile page
    } catch (error) {
      console.error("Registration error:", error.message);
      toast.error(`Registration failed: ${error.message}`, {
        position: "bottom-center",
      });
    }
    setSubmitting(false);
  };

  return (
    <div className="register-container">
      {/* Animation Section */}
      <motion.div
        className="animation-container"
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1 }}
      >
        <Lottie animationData={registrationAnimation} loop={true} />
      </motion.div>

      {/* Form Section */}
      <motion.div
        className="form-container"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <h2>Create an Account</h2>
        <p>Join us and unlock the full potential of your study experience!</p>

        <Formik
          initialValues={{
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="register-form">
              {/* Name Field */}
              <div className="form-group">
                <label htmlFor="name">
                  <FaUser /> Name
                </label>
                <Field
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  className="form-control"
                  data-tooltip="Enter your full name"
                />
                <Tooltip anchorSelect="[data-tooltip]" />
                <ErrorMessage
                  name="name"
                  component="div"
                  className="error-message"
                />
              </div>

              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email">
                  <FaEnvelope /> Email
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

              {/* Confirm Password Field */}
              <div className="form-group">
                <label htmlFor="confirmPassword">
                  <FaLock /> Confirm Password
                </label>
                <div className="password-field">
                  <Field
                    type={confirmPasswordVisible ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm your password"
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() =>
                      setConfirmPasswordVisible(!confirmPasswordVisible)
                    }
                  >
                    {confirmPasswordVisible ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <ErrorMessage
                  name="confirmPassword"
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
                {isSubmitting ? "Registering..." : "Register"}
              </motion.button>
            </Form>
          )}
        </Formik>
      </motion.div>
    </div>
  );
}

export default Register;
