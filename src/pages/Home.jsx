import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useAnimation } from "framer-motion"; // For animations
import { useInView } from "react-intersection-observer"; // For detecting scroll position
import { Link as ScrollLink } from "react-scroll"; // For smooth scrolling
import Lottie from "lottie-react"; // For Lottie animations
import "./Home.css";

// Import Lottie animation files
import heroAnimation from "../assets/hero-animation.json";
import flashcardsAnimation from "../assets/flashcards-animation.json";
import notesAnimation from "../assets/notes-animation.json";
import aiAssistantAnimation from "../assets/ai-assistant-animation.json";

function Home() {
  const controls = useAnimation(); // Framer Motion animation controls
  const [ref, inView] = useInView({ threshold: 0.1 }); // Detect if the section is in view

  useEffect(() => {
    // Trigger animation when the section comes into view
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-between hero-section md:flex-row">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
        >
          <h1 className="text-5xl font-bold text-white hero-title">
            Welcome to <span className="text-indigo-500">Study Buddy</span>
          </h1>
          <p className="mt-4 text-lg text-gray-300 hero-subtitle">
            Your personal assistant for smarter studying. Organize, learn, and
            achieve your goals effortlessly.
          </p>
          <div className="mt-6 hero-buttons">
            <Link to="/study-buddy/login">
              <button className="px-6 py-3 text-white transition bg-indigo-600 rounded-lg shadow-md primary-button hover:bg-indigo-700">
                Get Started
              </button>
            </Link>
            <ScrollLink
              to="quotes"
              smooth={true}
              duration={500}
              offset={-50}
              className="px-6 py-3 ml-4 text-gray-300 transition bg-gray-800 rounded-lg shadow-md cursor-pointer secondary-button hover:bg-gray-700"
            >
              Learn More
            </ScrollLink>
          </div>
        </motion.div>

        <motion.div
          className="hero-image"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
        >
          <Lottie
            animationData={heroAnimation}
            loop={true}
            style={{ width: "400px", height: "400px" }}
          />
        </motion.div>
      </section>

      {/* Motivational Quotes Section */}
      <section
        id="quotes"
        className="py-16 bg-gray-900 quotes-section"
        ref={ref}
      >
        <motion.div
          className="quotes-container"
          initial="hidden"
          animate={controls}
          variants={{
            hidden: { opacity: 0, y: 50 },
            visible: { opacity: 1, y: 0, transition: { duration: 1 } },
          }}
        >
          <h2 className="mb-12 text-4xl font-bold text-center text-white section-title">
            Get Inspired to Succeed
          </h2>
          <div className="px-8 text-center quotes-slider">
            {[
              {
                text: "Success is not the key to happiness. Happiness is the key to success. If you love what you are doing, you will be successful.",
                author: "Albert Schweitzer",
              },
              {
                text: "The only way to achieve the impossible is to believe it is possible.",
                author: "Charles Kingsleigh",
              },
            ].map((quote, index) => (
              <motion.div
                key={index}
                className="p-6 mt-8 bg-gray-800 rounded-lg shadow-lg quote-card"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 * index }}
              >
                <p className="text-lg italic text-gray-300 quote-text">
                  "{quote.text}"
                </p>
                <h4 className="mt-4 text-indigo-500 quote-author">
                  – {quote.author}
                </h4>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-gray-900 features-section">
        <h2 className="mb-12 text-4xl font-bold text-center text-white section-title">
          Why Choose Study Buddy?
        </h2>
        <div className="grid grid-cols-1 gap-8 px-8 features-grid md:grid-cols-3">
          {[
            {
              animation: flashcardsAnimation,
              title: "Flashcards",
              description:
                "Master any subject with customizable flashcards designed for active recall and spaced repetition.",
            },
            {
              animation: notesAnimation,
              title: "Smart Notes",
              description:
                "Take organized, searchable notes with advanced categorization and tagging.",
            },
            {
              animation: aiAssistantAnimation,
              title: "AI Assistant",
              description:
                "Ask AI to clarify concepts, generate summaries, or suggest study plans tailored to you.",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              className="p-6 text-center bg-gray-800 rounded-lg shadow-lg feature-card"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, scale: 0.9 },
                visible: {
                  opacity: 1,
                  scale: 1,
                  transition: { duration: 0.5, delay: index * 0.2 },
                },
              }}
            >
              <Lottie
                animationData={feature.animation}
                loop={true}
                style={{ height: "150px" }}
              />
              <h3 className="mt-4 text-xl font-semibold text-white feature-title">
                {feature.title}
              </h3>
              <p className="mt-2 text-gray-400 feature-description">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 text-center bg-indigo-600 cta-section">
        <h2 className="text-4xl font-bold text-white cta-title">
          Ready to Boost Your Learning?
        </h2>
        <p className="mt-4 text-lg text-gray-200 cta-text">
          Join thousands of students improving their study habits with Study
          Buddy.
        </p>
        <Link to="/study-buddy/session">
          <motion.button
            className="px-8 py-3 mt-6 text-indigo-600 transition bg-white rounded-lg shadow-md cta-button hover:bg-gray-100"
            whileHover={{ scale: 1.1 }}
          >
            Start Your Session
          </motion.button>
        </Link>
      </section>
    </div>
  );
}

export default Home;
