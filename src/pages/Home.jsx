import React, { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import heroAnimation from "../assets/hero-animation.json";
import flashcardsAnimation from "../assets/flashcards-animation.json";
import "./Home.css";

/* ── tiny sparkle svg as inline component ── */
const Sparkle = ({ size = 16, color = "#ff9ed2", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path
      d="M12 2 L13.5 9 L20 12 L13.5 15 L12 22 L10.5 15 L4 12 L10.5 9 Z"
      fill={color}
      opacity="0.9"
    />
  </svg>
);

const FloatingBlob = ({ className }) => (
  <div className={`pookie-blob ${className}`} />
);

/* ── feature data ── */
const features = [
  {
    emoji: "🧠",
    title: "Smart Flashcards",
    tag: "spaced repetition",
    desc: "Adaptive cards that learn how you learn. Our algorithm surfaces exactly what you need, exactly when you need it.",
    pills: ["SM-2 Algorithm", "Quiz Mode", "Deck System"],
    color: "pink",
    route: "/flash-cards",
  },
  {
    emoji: "⏱️",
    title: "Focus Timer",
    tag: "deep work",
    desc: "Pomodoro & stopwatch modes with real-time field tracking, strict mode, and session insights that feel like a hug.",
    pills: ["Pomodoro", "Strict Mode", "Live Stats"],
    color: "lavender",
    route: "/session",
  },
  {
    emoji: "📝",
    title: "Rich Notes",
    tag: "knowledge base",
    desc: "Write beautifully with ReactQuill, organize by color, pin your favorites, and search everything instantly.",
    pills: ["Rich Text", "Pin & Color", "Search"],
    color: "peach",
    route: "/notes",
  },
  {
    emoji: "📊",
    title: "Graph Studio",
    tag: "visual math",
    desc: "Plot 2D and 3D equations with Plotly. Transform abstract math into gorgeous, interactive visuals.",
    pills: ["2D Plots", "3D Surfaces", "mathjs"],
    color: "mint",
    route: "/plot-graph",
  },
];

const quotes = [
  { text: "Study hard what interests you in the most undisciplined, irreverent and original manner possible.", author: "Richard Feynman" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Education is not the filling of a bucket, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
];

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 350], [1, 0]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const logged = localStorage.getItem("isLoggedIn") === "true";
    setIsLoggedIn(!!token || logged);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setQuoteIdx((p) => (p + 1) % quotes.length), 5500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (route) => navigate(isLoggedIn ? route : "/login");
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="pk-root">

      {/* ── atmospheric blobs ── */}
      <FloatingBlob className="blob-a" />
      <FloatingBlob className="blob-b" />
      <FloatingBlob className="blob-c" />
      <FloatingBlob className="blob-d" />

      {/* ── ambient stars ── */}
      <div className="pk-stars" aria-hidden>
        {[...Array(28)].map((_, i) => (
          <div key={i} className={`pk-star pk-star-${i}`} />
        ))}
      </div>

      {/* ════════════════════════════════
          HERO
      ════════════════════════════════ */}
      <section className="pk-hero" ref={heroRef}>
        <motion.div className="pk-hero-inner" style={{ y: heroY, opacity: heroOpacity }}>

          {/* left col */}
          <div className="pk-hero-text">
            <motion.div
              className="pk-badge"
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
            >
              <Sparkle size={14} color="#ff9ed2" />
              <span>your cutest study companion</span>
              <Sparkle size={14} color="#c9b8ff" />
            </motion.div>

            <motion.h1
              className="pk-hero-title"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            >
              Study smarter,<br />
              <span className="pk-title-accent">glow harder</span>
              <span className="pk-title-star"> ✦</span>
            </motion.h1>

            <motion.p
              className="pk-hero-sub"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Flashcards, focus timers, rich notes & beautiful graphs — all wrapped
              in the most adorable productivity app you&apos;ve ever seen. Let&apos;s get that grade, bestie 💕
            </motion.p>

            <motion.div
              className="pk-hero-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <motion.button
                className="pk-btn-primary"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => go("/session")}
              >
                <span>Start studying</span>
                <span className="pk-btn-arrow">✦</span>
              </motion.button>
              <motion.button
                className="pk-btn-ghost"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => scrollTo("features")}
              >
                see features ↓
              </motion.button>
            </motion.div>

            {/* mini stats row */}
            <motion.div
              className="pk-hero-stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.95 }}
            >
              {[
                { num: "4", label: "study tools" },
                { num: "∞", label: "flashcards" },
                { num: "100%", label: "free" },
              ].map(({ num, label }) => (
                <div key={label} className="pk-stat">
                  <span className="pk-stat-num">{num}</span>
                  <span className="pk-stat-label">{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* right col — lottie orb */}
          <motion.div
            className="pk-hero-orb-wrap"
            initial={{ opacity: 0, scale: 0.85, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="pk-orb-glow" />
            <div className="pk-orb-ring pk-orb-ring-1" />
            <div className="pk-orb-ring pk-orb-ring-2" />
            <div className="pk-orb">
              <Lottie animationData={heroAnimation} loop className="pk-lottie" />
            </div>

            {/* floating chips */}
            {[
              { icon: "🍓", label: "Spaced repetition", pos: "chip-tl" },
              { icon: "🌙", label: "Focus mode", pos: "chip-tr" },
              { icon: "🌸", label: "Rich notes", pos: "chip-bl" },
              { icon: "✨", label: "2D & 3D graphs", pos: "chip-br" },
            ].map(({ icon, label, pos }) => (
              <motion.div
                key={label}
                className={`pk-chip ${pos}`}
                animate={{ y: [0, pos.includes("t") ? -8 : 8, 0] }}
                transition={{ duration: 3.5 + Math.random(), repeat: Infinity, ease: "easeInOut" }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* scroll cue */}
        <motion.div
          className="pk-scroll-cue"
          animate={{ y: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          onClick={() => scrollTo("features")}
        >
          <span>scroll</span>
          <div className="pk-scroll-dot" />
        </motion.div>
      </section>

      {/* ════════════════════════════════
          QUOTE TICKER
      ════════════════════════════════ */}
      <section className="pk-quote-belt">
        <div className="pk-quote-belt-inner">
          <AnimatePresence mode="wait">
            <motion.div
              key={quoteIdx}
              className="pk-quote-text"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45 }}
            >
              <Sparkle size={13} color="#ffb3d9" style={{ flexShrink: 0 }} />
              <blockquote>
                &ldquo;{quotes[quoteIdx].text}&rdquo;
                <cite> — {quotes[quoteIdx].author}</cite>
              </blockquote>
              <Sparkle size={13} color="#c9b8ff" style={{ flexShrink: 0 }} />
            </motion.div>
          </AnimatePresence>
          <div className="pk-quote-dots">
            {quotes.map((_, i) => (
              <button
                key={i}
                className={`pk-qdot${i === quoteIdx ? " active" : ""}`}
                onClick={() => setQuoteIdx(i)}
                aria-label={`Quote ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          FEATURES
      ════════════════════════════════ */}
      <section id="features" className="pk-features">
        <motion.div
          className="pk-section-header"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="pk-section-tag">
            <Sparkle size={12} color="#ff9ed2" /> everything you need
          </div>
          <h2 className="pk-section-title">
            Tools that actually <span className="pk-accent-pink">slap</span> ✦
          </h2>
          <p className="pk-section-sub">
            Four powerful study tools, one beautiful workspace. No subscriptions, no limits, just vibes.
          </p>
        </motion.div>

        <div className="pk-features-grid">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className={`pk-feature-card pk-card-${f.color}`}
              initial={{ opacity: 0, y: 48, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
            >
              <div className="pk-card-glow" />

              <div className="pk-card-top">
                <div className="pk-card-emoji-wrap">
                  <span className="pk-card-emoji">{f.emoji}</span>
                </div>
                <span className="pk-card-tag">{f.tag}</span>
              </div>

              <h3 className="pk-card-title">{f.title}</h3>
              <p className="pk-card-desc">{f.desc}</p>

              <div className="pk-card-pills">
                {f.pills.map((p) => (
                  <span key={p} className="pk-pill">{p}</span>
                ))}
              </div>

              <motion.button
                className="pk-card-btn"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => go(f.route)}
              >
                Open {f.title} →
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════
          HOW IT WORKS — visual steps
      ════════════════════════════════ */}
      <section className="pk-steps">
        <motion.div
          className="pk-section-header"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="pk-section-tag">
            <Sparkle size={12} color="#c9b8ff" /> getting started
          </div>
          <h2 className="pk-section-title">
            Simple as <span className="pk-accent-lavender">1, 2, 3</span> 🌸
          </h2>
        </motion.div>

        <div className="pk-steps-row">
          {[
            { n: "01", icon: "🎀", title: "Create your account", body: "Sign up in seconds — no credit card, no nonsense. Just you and your goals." },
            { n: "02", icon: "🌷", title: "Set up your fields", body: "Add the subjects you're studying. The timer tracks time per field automatically." },
            { n: "03", icon: "💫", title: "Start your session", body: "Hit start, add tasks, review flashcards, and watch your stats grow every day." },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              className="pk-step"
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.13, duration: 0.55 }}
            >
              <div className="pk-step-num">{s.n}</div>
              <div className="pk-step-icon">{s.icon}</div>
              <h3 className="pk-step-title">{s.title}</h3>
              <p className="pk-step-body">{s.body}</p>
              {i < 2 && <div className="pk-step-connector" aria-hidden />}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════
          CTA
      ════════════════════════════════ */}
      <section className="pk-cta">
        <div className="pk-cta-blob-a" />
        <div className="pk-cta-blob-b" />

        <motion.div
          className="pk-cta-card"
          initial={{ opacity: 0, scale: 0.94, y: 40 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="pk-cta-sparkles" aria-hidden>
            <Sparkle size={22} color="#ff9ed2" style={{ position: "absolute", top: "12%", left: "8%" }} />
            <Sparkle size={14} color="#c9b8ff" style={{ position: "absolute", top: "20%", right: "12%" }} />
            <Sparkle size={18} color="#ffd6a5" style={{ position: "absolute", bottom: "18%", left: "15%" }} />
            <Sparkle size={12} color="#a8edca" style={{ position: "absolute", bottom: "12%", right: "8%" }} />
            <Sparkle size={10} color="#ff9ed2" style={{ position: "absolute", top: "55%", left: "4%" }} />
            <Sparkle size={16} color="#c9b8ff" style={{ position: "absolute", top: "40%", right: "5%" }} />
          </div>

          <div className="pk-cta-emoji-row">🎀 ✨ 🌙</div>
          <h2 className="pk-cta-title">
            Ready to become the<br />
            <span className="pk-cta-highlight">most studious pookie</span>?
          </h2>
          <p className="pk-cta-sub">
            Your future self is waiting. Open StudyBuddy, start a session, and turn "I should study" into "I slayed that exam" — one pomodoro at a time.
          </p>

          <div className="pk-cta-actions">
            <motion.button
              className="pk-btn-primary pk-btn-xl"
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => go("/session")}
            >
              <span>Let&apos;s gooo 🚀</span>
            </motion.button>
            <motion.button
              className="pk-btn-ghost"
              whileHover={{ scale: 1.03 }}
              onClick={() => go("/flash-cards")}
            >
              try flashcards first
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── fab ── */}
      <AnimatePresence>
        {scrolled && (
          <motion.button
            className="pk-fab"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}