import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useAnimation, useScroll, useTransform } from "framer-motion";
import { useInView } from "react-intersection-observer";
import Lottie from "lottie-react";
import "./Home.css";

// Import Lottie animation files
import heroAnimation from "../assets/hero-animation.json";
import flashcardsAnimation from "../assets/flashcards-animation.json";
import notesAnimation from "../assets/notes-animation.json";
import aiAssistantAnimation from "../assets/ai-assistant-animation.json";

function Home() {
  const [currentQuote, setCurrentQuote] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isScrolled, setIsScrolled] = useState(false);
  
  const controls = useAnimation();
  const [ref, inView] = useInView({ threshold: 0.1 });
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 300], [0, -100]);
  const y2 = useTransform(scrollY, [0, 300], [0, -50]);

  const quotes = [
    {
      text: "Success is not the key to happiness. Happiness is the key to success. If you love what you are doing, you will be successful.",
      author: "Albert Schweitzer",
    },
    {
      text: "The only way to achieve the impossible is to believe it is possible.",
      author: "Charles Kingsleigh",
    },
    {
      text: "Education is the most powerful weapon which you can use to change the world.",
      author: "Nelson Mandela",
    },
    {
      text: "The beautiful thing about learning is that no one can take it away from you.",
      author: "B.B. King",
    }
  ];

  const features = [
    {
      animation: flashcardsAnimation,
      title: "Flashcards",
      description: "Master any subject with customizable flashcards designed for active recall and spaced repetition.",
      icon: "🧠",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      animation: notesAnimation,
      title: "Smart Notes",
      description: "Take organized, searchable notes with advanced categorization and tagging.",
      icon: "📝",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      animation: aiAssistantAnimation,
      title: "Visualize the Graph",
      description: "Visualize mathematical equations to understand them easily",
      icon: "📊",
      gradient: "from-green-500 to-teal-500"
    },
  ];

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
      setCurrentQuote((prev) => (prev + 1) % quotes.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [quotes.length]);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFeatureHover = (index) => {
    // Add ripple effect or additional animations here
  };

  return (
    <div className="home-container">
      {/* Cursor Follower */}
      <div 
        className="cursor-follower"
        style={{
          left: mousePosition.x,
          top: mousePosition.y,
        }}
      />

      {/* Floating Elements */}
      <div className="floating-elements">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className={`floating-element floating-element-${i + 1}`}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-particles">
          {[...Array(50)].map((_, i) => (
            <div key={i} className={`particle particle-${i}`} />
          ))}
        </div>

        <motion.div className="hero-grid">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <motion.div
              className="hero-badge"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <span className="hero-badge-icon">✨</span>
              <span>Welcome to the Future of Learning</span>
            </motion.div>

            <motion.h1 
              className="hero-title"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
            >
              Transform Your Study Journey with{" "}
              <motion.span 
                className="hero-title-highlight"
                animate={{ 
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                Study Buddy
              </motion.span>
            </motion.h1>

            <motion.p 
              className="hero-subtitle"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
            >
              Experience the next generation of personalized learning with AI-powered tools, 
              interactive features, and stunning visualizations that make studying addictive.
            </motion.p>

            <motion.div 
              className="hero-stats"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            >
              <div className="stat-item">
                <span className="stat-number">10K+</span>
                <span className="stat-label">Students</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">95%</span>
                <span className="stat-label">Success Rate</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">4.9★</span>
                <span className="stat-label">Rating</span>
              </div>
            </motion.div>

            <motion.div 
              className="hero-buttons"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.8 }}
            >
              <Link to="/login">
                <motion.button 
                  className="primary-button"
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 20px 40px rgba(90, 103, 216, 0.4)"
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>Start Your Journey</span>
                  <motion.span 
                    className="button-icon"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </motion.button>
              </Link>
              
              <motion.button
                onClick={() => scrollToSection('features')}
                className="secondary-button"
                whileHover={{ 
                  scale: 1.05,
                  backgroundColor: "rgba(45, 45, 58, 0.8)"
                }}
                whileTap={{ scale: 0.98 }}
              >
                <span>Explore Features</span>
                <span className="button-icon">↓</span>
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            className="hero-visual"
            style={{ y: y1 }}
            initial={{ opacity: 0, x: 100, rotateY: -30 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <div className="hero-visual-container">
              <motion.div 
                className="hero-visual-glow"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 8, 
                  repeat: Infinity, 
                  ease: "linear" 
                }}
              />
              <Lottie
                animationData={heroAnimation}
                loop={true}
                className="hero-lottie"
              />
              <div className="hero-visual-overlay">
                <motion.div 
                  className="floating-card floating-card-1"
                  animate={{ 
                    y: [0, -15, 0],
                    rotate: [0, 5, 0]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                >
                  <span className="card-icon">📚</span>
                  <span className="card-text">Smart Learning</span>
                </motion.div>
                
                <motion.div 
                  className="floating-card floating-card-2"
                  animate={{ 
                    y: [0, 20, 0],
                    rotate: [0, -5, 0]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: 1
                  }}
                >
                  <span className="card-icon">🎯</span>
                  <span className="card-text">Goal Tracking</span>
                </motion.div>

                <motion.div 
                  className="floating-card floating-card-3"
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 3, 0]
                  }}
                  transition={{ 
                    duration: 5, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: 2
                  }}
                >
                  <span className="card-icon">⚡</span>
                  <span className="card-text">Instant Results</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div 
          className="hero-scroll-indicator"
          animate={{ y: [0, 10, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          onClick={() => scrollToSection('quotes')}
        >
          <span>Scroll to explore</span>
          <div className="scroll-arrow">↓</div>
        </motion.div>
      </section>

      {/* Motivational Quotes Section */}
      <section id="quotes" className="quotes-section" ref={ref}>
        <div className="quotes-background">
          <motion.div 
            className="quotes-shape quotes-shape-1"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="quotes-shape quotes-shape-2"
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <motion.div
          className="quotes-container"
          initial="hidden"
          animate={controls}
          variants={{
            hidden: { opacity: 0, y: 100 },
            visible: { opacity: 1, y: 0, transition: { duration: 1 } },
          }}
        >
          <motion.h2 
            className="section-title"
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Daily Inspiration for Success
          </motion.h2>

          <div className="quotes-carousel">
            <motion.div 
              className="quote-track"
              animate={{ x: -currentQuote * 100 + "%" }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              {quotes.map((quote, index) => (
                <motion.div
                  key={index}
                  className="quote-slide"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: index === currentQuote ? 1 : 0.3, 
                    scale: index === currentQuote ? 1 : 0.9 
                  }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="quote-card-enhanced">
                    <div className="quote-decoration">
                      <span className="quote-mark">"</span>
                    </div>
                    <motion.p 
                      className="quote-text"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      {quote.text}
                    </motion.p>
                    <motion.div 
                      className="quote-author-section"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <div className="author-avatar">
                        {quote.author.split(' ').map(n => n[0]).join('')}
                      </div>
                      <h4 className="quote-author">— {quote.author}</h4>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <div className="quote-indicators">
              {quotes.map((_, index) => (
                <motion.button
                  key={index}
                  className={`quote-indicator ${index === currentQuote ? 'active' : ''}`}
                  onClick={() => setCurrentQuote(index)}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="features-background">
          <motion.div 
            className="features-grid-bg"
            animate={{ 
              backgroundPosition: ["0% 0%", "100% 100%"] 
            }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              repeatType: "reverse" 
            }}
          />
        </div>

        <motion.h2 
          className="section-title features-title"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          Powerful Features That Transform Learning
        </motion.h2>

        <motion.p 
          className="features-subtitle"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          Discover the tools that will revolutionize your study experience
        </motion.p>

        <div className="features-grid-container">
          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card-enhanced"
                initial={{ opacity: 0, y: 80, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  duration: 0.8, 
                  delay: index * 0.2,
                  ease: "easeOut"
                }}
                whileHover={{ 
                  y: -15,
                  scale: 1.02,
                  transition: { duration: 0.3 }
                }}
                viewport={{ once: true }}
                onHoverStart={() => handleFeatureHover(index)}
              >
                <motion.div 
                  className="feature-card-glow"
                  animate={{ 
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                />

                <div className="feature-header">
                  <motion.div 
                    className={`feature-icon-container bg-gradient-to-r ${feature.gradient}`}
                    whileHover={{ 
                      rotate: [0, -10, 10, 0],
                      scale: 1.1 
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <span className="feature-emoji">{feature.icon}</span>
                  </motion.div>
                  <div className="feature-animation-container">
                    <Lottie
                      animationData={feature.animation}
                      loop={true}
                      className="feature-lottie"
                    />
                  </div>
                </div>

                <div className="feature-content">
                  <motion.h3 
                    className="feature-title"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {feature.title}
                  </motion.h3>
                  <motion.p 
                    className="feature-description"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {feature.description}
                  </motion.p>
                </div>

                <motion.div 
                  className="feature-cta"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <motion.button 
                    className="feature-button"
                    whileHover={{ 
                      scale: 1.05,
                      backgroundColor: "#5a67d8"
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Explore {feature.title}
                    <span className="feature-button-arrow">→</span>
                  </motion.button>
                </motion.div>

                <div className="feature-particles">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className={`feature-particle feature-particle-${i + 1}`}
                      animate={{
                        y: [0, -20, 0],
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0]
                      }}
                      transition={{
                        duration: 2 + i * 0.5,
                        repeat: Infinity,
                        delay: i * 0.3
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="cta-section">
        <div className="cta-background">
          <motion.div 
            className="cta-wave cta-wave-1"
            animate={{ 
              x: [0, -100, 0],
              y: [0, -20, 0]
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
          <motion.div 
            className="cta-wave cta-wave-2"
            animate={{ 
              x: [0, 100, 0],
              y: [0, 15, 0]
            }}
            transition={{ 
              duration: 6, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 1
            }}
          />
        </div>

        <motion.div 
          className="cta-content"
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
        >
          <motion.div 
            className="cta-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <span className="cta-badge-icon">🚀</span>
            <span>Join the Revolution</span>
          </motion.div>

          <motion.h2 
            className="cta-title"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Ready to Transform Your Learning Journey?
          </motion.h2>

          <motion.p 
            className="cta-text"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Join thousands of students who have already revolutionized their study habits with Study Buddy. 
            Experience the future of education today.
          </motion.p>

          <motion.div 
            className="cta-stats-mini"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <div className="mini-stat">
              <span className="mini-stat-number">24/7</span>
              <span className="mini-stat-label">AI Support</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-number">∞</span>
              <span className="mini-stat-label">Possibilities</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-number">0$</span>
              <span className="mini-stat-label">To Start</span>
            </div>
          </motion.div>

          <motion.div 
            className="cta-buttons"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <Link to="/session">
              <motion.button
                className="cta-primary-button"
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 25px 50px rgba(255, 255, 255, 0.3)"
                }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.span 
                  className="cta-button-bg"
                  animate={{ 
                    x: ['-100%', '100%']
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                />
                <span className="cta-button-content">
                  <span>Start Your Session Now</span>
                  <motion.span 
                    className="cta-button-icon"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    ⚡
                  </motion.span>
                </span>
              </motion.button>
            </Link>

            <motion.button
              className="cta-secondary-button"
              whileHover={{ 
                scale: 1.05,
                backgroundColor: "rgba(255, 255, 255, 0.1)"
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => scrollToSection('features')}
            >
              <span>Learn More</span>
              <span className="cta-secondary-icon">↗</span>
            </motion.button>
          </motion.div>
        </motion.div>

        <div className="cta-particles">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className={`cta-particle cta-particle-${i + 1}`}
              animate={{
                y: [0, -window.innerHeight],
                opacity: [0, 1, 0],
                scale: [0, 1, 0]
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 5,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      </section>

      {/* Floating Action Button */}
      <motion.button
        className={`floating-action-button ${isScrolled ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ 
          boxShadow: [
            "0 0 20px rgba(90, 103, 216, 0.3)",
            "0 0 40px rgba(90, 103, 216, 0.6)",
            "0 0 20px rgba(90, 103, 216, 0.3)"
          ]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity 
        }}
      >
        <span className="fab-icon">↑</span>
      </motion.button>
    </div>
  );
}

export default Home;