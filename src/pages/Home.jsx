import React, { useEffect, useState } from "react";
import { motion, useAnimation, useScroll, useTransform } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useNavigate } from "react-router-dom";
import './Home.css'
import Lottie from "lottie-react";
import heroAnimation from "../assets/hero-animation.json";
import flashcardsAnimation from "../assets/flashcards-animation.json";
import notesAnimation from "../assets/notes-animation.json";
import aiAssistantAnimation from "../assets/ai-assistant-animation.json";


function Home() {
  const [currentQuote, setCurrentQuote] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const navigate = useNavigate();
  const controls = useAnimation();
  const [ref, inView] = useInView({ threshold: 0.1 });
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 300], [0, -50]);

  const studyQuotes = [
    {
      text: "Education is the most powerful weapon which you can use to change the world.",
      author: "Nelson Mandela",
      category: "Inspiration"
    },
    {
      text: "The beautiful thing about learning is that no one can take it away from you.",
      author: "B.B. King",
      category: "Growth"
    },
    {
      text: "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.",
      author: "Richard Feynman",
      category: "Method"
    },
    {
      text: "The expert in anything was once a beginner.",
      author: "Helen Hayes",
      category: "Progress"
    }
  ];

  const studyFeatures = [
    {
      title: "Smart Flashcards",
      description: "Master concepts with AI-powered spaced repetition. Our adaptive algorithm helps you focus on what you need to learn most.",
      icon: "🧠",
      lottie: flashcardsAnimation,
      gradient: "from-purple-600 to-purple-400",
      benefits: ["Spaced Repetition", "Progress Tracking", "Custom Categories"],
     
    },
    {
      title: "Organized Notes",
      description: "Create structured, searchable notes with advanced organization tools. Link concepts and build your knowledge graph.",
      icon: "📚",
      lottie: flashcardsAnimation,
      gradient: "from-blue-600 to-blue-400",
      benefits: ["Smart Search", "Topic Linking", "Export Options"],
     
    },
    {
      title: "Visual Learning",
      description: "Transform complex equations and concepts into interactive visualizations that make understanding intuitive.",
      icon: "📊",
      lottie: flashcardsAnimation,
      gradient: "from-green-600 to-green-400",
      benefits: ["Interactive Graphs", "3D Models", "Step-by-Step"],
    
    },
  ];

  // Check login status on component mount
  useEffect(() => {
    // Check if user is logged in - you can replace this with your actual authentication logic
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const userLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(!!token || userLoggedIn);
  }, []);

  // Navigation handler for protected routes
  const handleProtectedNavigation = (route) => {
    if (isLoggedIn) {
      navigate(route);
    } else {
      navigate('/login');
    }
  };

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % studyQuotes.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [studyQuotes.length]);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="study-home-container">
      {/* Enhanced Cursor Follower */}
      <div 
        className="enhanced-cursor"
        style={{
          left: mousePosition.x,
          top: mousePosition.y,
        }}
      />

      {/* Study-themed Floating Elements */}
      <div className="study-particles">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className={`study-particle study-particle-${i + 1}`}
            animate={{
              y: [0, -30, 0],
              x: [0, 15, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Hero Section - Study Focused */}
      <section className="study-hero-section">
        <div className="hero-background-pattern">
          {[...Array(30)].map((_, i) => (
            <div key={i} className={`pattern-dot pattern-dot-${i}`} />
          ))}
        </div>

        <div className="study-hero-container">
          <motion.div
            className="study-hero-content"
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.div
              className="study-hero-badge"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <span className="badge-icon">🎓</span>
              <span>Your Personal Study Companion</span>
            </motion.div>

            <motion.h1 
              className="study-hero-title"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              Master Any Subject with{" "}
              <span className="hero-highlight">Study Buddy</span>
            </motion.h1>

            <motion.p 
              className="study-hero-subtitle"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              Unlock your learning potential with AI-powered study tools, personalized learning paths, 
              and proven techniques that make complex subjects simple and engaging.
            </motion.p>

            <motion.div 
              className="study-hero-actions"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
            >
              <motion.button 
                className="primary-study-button"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 20px 40px rgba(90, 103, 216, 0.3)"
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleProtectedNavigation("/session")}
              >
                <span>Start Learning Today</span>
                <span className="button-arrow">→</span>
              </motion.button>
              
              <motion.button
                onClick={() => scrollToSection('features')}
                className="secondary-study-button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>Explore Features</span>
                <span className="button-down">↓</span>
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            className="study-hero-visual"
            style={{ y: y1 }}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <div className="hero-visual-wrapper">
              <motion.div 
                className="visual-glow-effect"
                animate={{ 
                  scale: [1, 1.05, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              />
              
              <div className="hero-animation-placeholder">
                <div className="animation-circle">
                  <div className="inner-circle">
                   <Lottie
                    animationData={heroAnimation}
                    loop={true}
                    className="hero-lottie"
                  />
                  </div>
                </div>
              </div>
              
              {/* Study Context Cards */}
              <motion.div 
                className="study-context-card card-1"
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <span className="context-icon">📖</span>
                <div className="context-text">
                  <span className="context-title">Active Learning</span>
                  <span className="context-subtitle">Engage & Retain</span>
                </div>
              </motion.div>
              
              <motion.div 
                className="study-context-card card-2"
                animate={{ y: [5, -5, 5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <span className="context-icon">🎯</span>
                <div className="context-text">
                  <span className="context-title">Goal Tracking</span>
                  <span className="context-subtitle">Stay Motivated</span>
                </div>
              </motion.div>

              <motion.div 
                className="study-context-card card-3"
                animate={{ y: [-6, 7, -3] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <span className="context-icon">⚡</span>
                <div className="context-text">
                  <span className="context-title">Quick Results</span>
                  <span className="context-subtitle">See Progress</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <motion.div 
          className="scroll-indicator"
          animate={{ y: [0, 8, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
          onClick={() => scrollToSection('quotes')}
        >
          <span className="scroll-text">Discover More</span>
          <div className="scroll-icon">↓</div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="study-features-section">
        <div className="features-background-grid">
          <div className="grid-pattern" />
        </div>

        <div className="features-content-wrapper">
          <motion.div 
            className="features-header-content"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="features-main-title">Powerful Study Tools</h2>
            <p className="features-main-subtitle">
              Everything you need to excel in your studies, powered by cutting-edge technology
            </p>
          </motion.div>

          <div className="study-features-grid">
            {studyFeatures.map((feature, index) => (
              <motion.div
                key={index}
                className="enhanced-feature-card"
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.6, 
                  delay: index * 0.15
                }}
                whileHover={{ 
                  y: -4,
                  transition: { duration: 0.3 }
                }}
                viewport={{ once: true }}
              >
                <div className="feature-card-background" />
                
                <div className="feature-visual-section">
                  <motion.div 
                    className={`feature-icon-wrapper bg-gradient-to-br ${feature.gradient}`}
                    whileHover={{ 
                      scale: 1.05 
                    }}
                    transition={{ duration: 0.4 }}
                  >
                    <span className="feature-icon-emoji">{feature.icon}</span>
                  </motion.div>
                   <h3 className="feature-card-title">{feature.title}</h3>
                </div>

                <div className="feature-text-content">
                  <p className="feature-card-description">{feature.description}</p>
                  
                  <div className="feature-benefits-list">
                    {feature.benefits.map((benefit, idx) => (
                      <div key={idx} className="benefit-item">
                        <span className="benefit-check">✓</span>
                        <span className="benefit-text">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>


              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Call to Action */}
      <section className="study-cta-section">
        <div className="cta-background-effects">
          <motion.div 
            className="cta-wave wave-1"
            animate={{ 
              x: [0, -50, 0],
              y: [0, -20, 0]
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
          <motion.div 
            className="cta-wave wave-2"
            animate={{ 
              x: [0, 50, 0],
              y: [0, 15, 0]
            }}
            transition={{ 
              duration: 6, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 2
            }}
          />
        </div>

        <motion.div 
          className="study-cta-content"
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <motion.div 
            className="cta-launch-badge"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <span className="launch-icon">🚀</span>
            <span>Transform Your Learning</span>
          </motion.div>

          <motion.h2 
            className="cta-main-title"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Ready to Achieve Academic Excellence?
          </motion.h2>

          <motion.p 
            className="cta-main-text"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Join thousands of successful students who have transformed their study habits. 
            Start your personalized learning journey today and see immediate results.
          </motion.p>

          <motion.div 
            className="cta-feature-highlights"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <div className="highlight-item">
              <span className="highlight-number">24/7</span>
              <span className="highlight-label">AI Tutoring</span>
            </div>
            <div className="highlight-item">
              <span className="highlight-number">∞</span>
              <span className="highlight-label">Study Resources</span>
            </div>
            <div className="highlight-item">
              <span className="highlight-number">Free</span>
              <span className="highlight-label">To Get Started</span>
            </div>
          </motion.div>

          <motion.div 
            className="cta-action-buttons"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <motion.button
              className="cta-primary-action"
              whileHover={{ 
                scale: 1.02,
                boxShadow: "0 25px 50px rgba(255, 255, 255, 0.25)"
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleProtectedNavigation("/session")}
            >
              <motion.div 
                className="button-shimmer"
                animate={{ 
                  x: ['-100%', '100%']
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "linear" 
                }}
              />
              <span className="button-content">
                <span>Begin Your Journey</span>
                <span className="primary-icon">⚡</span>
              </span>
            </motion.button>

            <motion.button
              className="cta-secondary-action"
              whileHover={{ 
                scale: 1.02,
                backgroundColor: "rgba(255, 255, 255, 0.08)"
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => scrollToSection('features')}
            >
              <span>Learn More</span>
              <span className="secondary-icon">↗</span>
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Enhanced Floating Particles */}
        <div className="cta-floating-elements">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className={`cta-floating-particle particle-${i + 1}`}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 0.8, 0],
                scale: [0, 1.2, 0]
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 4,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      </section>

      {/* Enhanced Floating Action Button */}
      <motion.button
        className={`enhanced-fab ${isScrolled ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ 
          boxShadow: [
            "0 8px 25px rgba(90, 103, 216, 0.3)",
            "0 15px 35px rgba(90, 103, 216, 0.5)",
            "0 8px 25px rgba(90, 103, 216, 0.3)"
          ]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity 
        }}
      >
        <span className="fab-icon-enhanced">↑</span>
      </motion.button>
    </div>
  );
}

export default Home;