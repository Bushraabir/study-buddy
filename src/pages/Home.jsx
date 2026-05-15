import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useInView,
  useMotionValue,
  animate,
  useSpring,
} from "framer-motion";
import { useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import heroAnimation from "../assets/hero-animation.json";
import { Helmet } from "react-helmet-async";
import "./Home.css";
import Tree from "../components/Tree";


/* ─────────────────────────────────────────
   SVG DECORATIONS — premium ornamental
───────────────────────────────────────── */
const OrnamentCross = ({ size = 24, color = "var(--pink)", style = {}, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className={className}>
    <path d="M12 2v20M2 12h20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 2v20M2 12h20" stroke={color} strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 12 12)" opacity="0.4" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

const DiamondSpark = ({ size = 20, color = "var(--pink)", style = {}, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style} className={className}>
    <path d="M10 1L11.8 8.2L19 10L11.8 11.8L10 19L8.2 11.8L1 10L8.2 8.2Z" fill={color} opacity="0.9" />
  </svg>
);


const PremiumGrid = () => (
  <svg className="pk-grid-bg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,158,210,0.04)" strokeWidth="1" />
      </pattern>
      <radialGradient id="grid-fade" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <mask id="grid-mask">
        <rect width="100%" height="100%" fill="url(#grid-fade)" />
      </mask>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" mask="url(#grid-mask)" />
  </svg>
);



/* ─────────────────────────────────────────
   COUNT-UP HOOK
───────────────────────────────────────── */
function CountUp({ target, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(count, target, {
      duration: 2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString()),
    });
    return controls.stop;
  }, [isInView, target, count]);

  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

/* ─────────────────────────────────────────
   MAGNETIC BUTTON HOOK
───────────────────────────────────────── */
function useMagnetic(strength = 0.25) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20 });
  const sy = useSpring(y, { stiffness: 300, damping: 20 });

  const prefersReduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  useEffect(() => {
    if (prefersReduced) return;
    const el = ref.current;
    if (!el) return;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      x.set((e.clientX - r.left - r.width / 2) * strength);
      y.set((e.clientY - r.top - r.height / 2) * strength);
    };
    const reset = () => { x.set(0); y.set(0); };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    return () => { el.removeEventListener("mousemove", move); el.removeEventListener("mouseleave", reset); };
  }, [prefersReduced]);

  return { ref, style: { x: sx, y: sy } };
}

/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */
const features = [
  {
    emoji: "🧠", title: "Smart Flashcards", tag: "spaced repetition",
    desc: "Adaptive cards powered by the SM-2 algorithm. Surfaces exactly what you need, exactly when you need it.",
    pills: ["SM-2 Algorithm", "Quiz Mode", "Deck System"], color: "pink", route: "/flash-cards",
  },
  {
    emoji: "⏱️", title: "Focus Timer", tag: "deep work",
    desc: "Pomodoro & stopwatch modes with real-time field tracking, strict mode, and session insights.",
    pills: ["Pomodoro", "Strict Mode", "Live Stats"], color: "lavender", route: "/session",
  },
  {
    emoji: "📝", title: "Rich Notes", tag: "knowledge base",
    desc: "Write beautifully with ReactQuill, organize by color, pin your favorites, and search instantly.",
    pills: ["Rich Text", "Pin & Color", "Search"], color: "peach", route: "/notes",
  },
  {
    emoji: "📊", title: "Graph Studio", tag: "visual math",
    desc: "Plot 2D and 3D equations with Plotly. Transform abstract math into gorgeous interactive visuals.",
    pills: ["2D Plots", "3D Surfaces", "mathjs"], color: "mint", route: "/plot-graph",
  },
];

const quotes = [
  { text: "Study hard what interests you in the most undisciplined, irreverent and original manner possible.", author: "Richard Feynman" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Education is not the filling of a bucket, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];

const stats = [
  { num: 12400, suffix: "+", label: "students", icon: "🌸" },
  { num: 1200000, suffix: "+", label: "flashcards", icon: "✨" },
  { num: 50000, suffix: "+", label: "sessions", icon: "🍓" },
  { num: 42, suffix: "%", prefix: "+", label: "focus boost", icon: "🌙" },
];

const ecosystem = [
  { icon: "⏱️", label: "Timer", color: "var(--lavender)" },
  { icon: "🧠", label: "Flashcards", color: "var(--pink)" },
  { icon: "📝", label: "Notes", color: "var(--peach)" },
  { icon: "📊", label: "Graphs", color: "var(--mint)" },
  { icon: "🏆", label: "Mastery", color: "var(--pink)" },
];

const faqs = [
  { q: "Is StudyBuddy completely free?", a: "Yes! All four study tools are 100% free, no credit card required, no paywalls. Just pure, unbothered studying." },
  { q: "How does spaced repetition work?", a: "Our SM-2 algorithm tracks how well you remember each card and schedules reviews at the optimal moment — just before you'd forget it." },
  { q: "Can I sync across devices?", a: "Absolutely. Your account syncs everything in real time — flashcards, notes, timer history — across all your devices." },
  { q: "What makes the Focus Timer special?", a: "It tracks time per subject field, shows live stats, and has a strict mode that blocks distractions. Your future self will thank you." },
];

/* ─────────────────────────────────────────
   FLIP CARD TEASER
───────────────────────────────────────── */
const sampleCards = [
  { q: "What is spaced repetition?", a: "A learning technique that schedules reviews at increasing intervals to maximize long-term retention." },
  { q: "Define neuroplasticity.", a: "The brain's ability to reorganize itself by forming new neural connections throughout life." },
  { q: "What is the Pomodoro Technique?", a: "25 min focused work + 5 min break cycles to maintain peak concentration and prevent burnout." },
];

function FlipCardTeaser() {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFlipped(true);
      setTimeout(() => {
        setIdx(p => (p + 1) % sampleCards.length);
        setFlipped(false);
      }, 700);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="pk-flip-scene" onClick={() => setFlipped(f => !f)}>
      <motion.div
        className="pk-flip-card"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="pk-flip-front">
          <span className="pk-flip-label">Question</span>
          <p>{sampleCards[idx].q}</p>
          <span className="pk-flip-hint">tap to flip ✦</span>
        </div>
        <div className="pk-flip-back">
          <span className="pk-flip-label">Answer</span>
          <p>{sampleCards[idx].a}</p>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MINI TIMER TEASER
───────────────────────────────────────── */
function TimerTeaser({ onStart }) {
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const max = 25 * 60;
  const pct = Math.min(secs / max, 1);
  const r = 54;
  const circ = 2 * Math.PI * r;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="pk-timer-teaser">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <circle cx="70" cy="70" r={r} stroke="url(#timer-grad)" strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <defs>
          <linearGradient id="timer-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--pink)" />
            <stop offset="100%" stopColor="var(--lavender)" />
          </linearGradient>
        </defs>
        <text x="70" y="66" textAnchor="middle" fill="var(--text)" fontSize="18" fontWeight="700" fontFamily="var(--font-m)">{fmt(secs)}</text>
        <text x="70" y="84" textAnchor="middle" fill="var(--text-3)" fontSize="9" fontFamily="var(--font-m)">POMODORO</text>
      </svg>
      <div className="pk-timer-controls">
        <motion.button className="pk-btn-primary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => setRunning(r => !r)}>
          {running ? "Pause ⏸" : "Start ▶"}
        </motion.button>
        <motion.button className="pk-btn-ghost" whileHover={{ scale: 1.03 }} onClick={onStart}>
          Real session →
        </motion.button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   FAQ ACCORDION
───────────────────────────────────────── */
function FAQItem({ q, a, i }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div className={`pk-faq-item${open ? " open" : ""}`}
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}>
      <button className="pk-faq-q" onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <motion.span className="pk-faq-icon" animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.3 }}>+</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="pk-faq-a"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function Home() {
  const navigate = useNavigate();
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);
  const primaryBtn = useMagnetic(0.3);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 350], [1, 0]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const logged = localStorage.getItem("isLoggedIn") === "true";
    setIsLoggedIn(!!token || logged);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(p => (p + 1) % quotes.length), 5500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const go = useCallback((route) => navigate(isLoggedIn ? route : "/login"), [isLoggedIn, navigate]);
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="pk-root">

      <Helmet>
        <title>StudyBuddy — Your Cutest Study Companion | Flashcards, Timer, Notes & Graphs</title>
        <meta name="description" content="Study smarter, glow harder. Free flashcards with spaced repetition, Pomodoro focus timer, rich notes, and 2D/3D graph plotting. All wrapped in the most adorable productivity app." />
        <link rel="canonical" href="https://study-buddy-seven-blush.vercel.app/" />
        
        {/* Open Graph */}
        <meta property="og:title" content="StudyBuddy — Your Cutest Study Companion" />
        <meta property="og:description" content="Free flashcards, Pomodoro timer, rich notes & beautiful graphs. Study smarter, glow harder ✨" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://study-buddy-seven-blush.vercel.app/" />
        <meta property="og:image" content="https://github.com/Bushraabir/study-buddy/blob/main/public/og-image.png?raw=true" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="StudyBuddy" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="StudyBuddy — Your Cutest Study Companion" />
        <meta name="twitter:description" content="Free flashcards, Pomodoro timer, rich notes & beautiful graphs. Study smarter, glow harder ✨" />
        <meta name="twitter:image" content="https://github.com/Bushraabir/study-buddy/blob/main/public/og-image.png?raw=true" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#0f0f23" />
      </Helmet>

      {/* ── atmospheric SVG grid ── */}
      <PremiumGrid />

      {/* ── ambient blobs ── */}
      <div className="pookie-blob blob-a" />
      <div className="pookie-blob blob-b" />
      <div className="pookie-blob blob-c" />
      <div className="pookie-blob blob-d" />

      {/* ── ambient stars ── */}
      <div className="pk-stars" aria-hidden>
        {[...Array(32)].map((_, i) => (
          <div key={i} className={`pk-star pk-star-${i}`} />
        ))}
      </div>

      {/* ── SVG ornaments scattered ── */}
      <OrnamentCross size={18} color="rgba(255,158,210,0.3)" style={{ position: "fixed", top: "14%", left: "6%", zIndex: 0 }} className="pk-ornament-spin" />
      <OrnamentCross size={12} color="rgba(201,184,255,0.25)" style={{ position: "fixed", top: "60%", right: "5%", zIndex: 0 }} className="pk-ornament-spin-slow" />
      <DiamondSpark size={14} color="rgba(255,214,165,0.4)" style={{ position: "fixed", top: "80%", left: "8%", zIndex: 0 }} className="pk-ornament-float" />
      <DiamondSpark size={10} color="rgba(168,237,202,0.4)" style={{ position: "fixed", top: "35%", right: "3%", zIndex: 0 }} className="pk-ornament-float-alt" />

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className="pk-hero" ref={heroRef}>


        <motion.div className="pk-hero-inner" style={{ y: heroY, opacity: heroOpacity }}>

          {/* LEFT */}
          <div className="pk-hero-text">
            <motion.div className="pk-badge"
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 300 }}>
              <DiamondSpark size={13} color="var(--pink)" />
              <span>your cutest study companion</span>
              <DiamondSpark size={13} color="var(--lavender)" />
            </motion.div>

            <motion.h1 className="pk-hero-title"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}>
              Study smarter,<br />
              <span className="pk-title-accent">glow harder</span>
              <span className="pk-title-star"> ✦</span>
            </motion.h1>

            <motion.p className="pk-hero-sub"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}>
              Flashcards, focus timers, rich notes & beautiful graphs — all wrapped
              in the most adorable productivity app you've ever seen. Let's get that grade, bestie 💕
            </motion.p>

            <motion.div className="pk-hero-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}>
              <motion.button ref={primaryBtn.ref} style={primaryBtn.style}
                className="pk-btn-primary" whileTap={{ scale: 0.97 }} onClick={() => go("/session")}>
                <span>Start studying</span>
                <span className="pk-btn-arrow">✦</span>
              </motion.button>
              <motion.button className="pk-btn-ghost" whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }} onClick={() => scrollTo("features")}>
                see features ↓
              </motion.button>
            </motion.div>



            <motion.div className="pk-hero-stats"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.95 }}>
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

          {/* RIGHT — orb */}
          <motion.div className="pk-hero-orb-wrap"
            initial={{ opacity: 0, scale: 0.85, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}>
            <div className="pk-orb-glow" />
            {/* Animated SVG rings */}
            <svg className="pk-orb-svg-rings" viewBox="0 0 360 360" fill="none">
              <circle cx="180" cy="180" r="140" stroke="rgba(255,158,210,0.08)" strokeWidth="1" className="pk-ring-spin" />
              <circle cx="180" cy="180" r="160" stroke="rgba(201,184,255,0.06)" strokeWidth="1" strokeDasharray="8 12" className="pk-ring-spin-rev" />
              <circle cx="180" cy="180" r="120" stroke="rgba(168,237,202,0.07)" strokeWidth="1" strokeDasharray="4 16" className="pk-ring-spin-slow" />
              {/* Orbital dot */}
              <circle cx="180" cy="40" r="4" fill="var(--pink)" opacity="0.7" className="pk-orbital-dot" />
              <circle cx="40" cy="180" r="3" fill="var(--lavender)" opacity="0.6" className="pk-orbital-dot-2" />
            </svg>
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
              <motion.div key={label} className={`pk-chip ${pos}`}
                animate={{ y: [0, pos.includes("t") ? -8 : 8, 0] }}
                transition={{ duration: 3.5 + Math.random() * 1.5, repeat: Infinity, ease: "easeInOut" }}>
                <span>{icon}</span><span>{label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div className="pk-scroll-cue"
          animate={{ y: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          onClick={() => scrollTo("features")}>
          <span>scroll</span>
          <div className="pk-scroll-dot" />
        </motion.div>
      </section>

      {/* ══════════════════════════════
          QUOTE TICKER
      ══════════════════════════════ */}
      <section className="pk-quote-belt">
        <div className="pk-quote-belt-inner">
          <AnimatePresence mode="wait">
            <motion.div key={quoteIdx} className="pk-quote-text"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45 }}>
              <DiamondSpark size={12} color="var(--pink)" style={{ flexShrink: 0 }} />
              <blockquote>
                &ldquo;{quotes[quoteIdx].text}&rdquo;
                <cite> — {quotes[quoteIdx].author}</cite>
              </blockquote>
              <DiamondSpark size={12} color="var(--lavender)" style={{ flexShrink: 0 }} />
            </motion.div>
          </AnimatePresence>
          <div className="pk-quote-dots">
            {quotes.map((_, i) => (
              <button key={i} className={`pk-qdot${i === quoteIdx ? " active" : ""}`}
                onClick={() => setQuoteIdx(i)} aria-label={`Quote ${i + 1}`} />
            ))}
          </div>
        </div>
      </section>

     



    <section>
      <Tree  onNavigate={(path) => navigate(path)}/>
    </section>







      {/* ══════════════════════════════
          FEATURES
      ══════════════════════════════ */}
      <section id="features" className="pk-features">
        <motion.div className="pk-section-header"
          initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="pk-section-tag">
            <DiamondSpark size={11} color="var(--pink)" /> everything you need
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
            <motion.div key={f.title} className={`pk-feature-card pk-card-${f.color}`}
              initial={{ opacity: 0, y: 48, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}>
              <div className="pk-card-glow" />
              {/* SVG corner ornament */}
              <svg className="pk-card-corner" width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M0 0 Q20 0 20 20" stroke="var(--card-accent, var(--pink))" strokeWidth="1" strokeOpacity="0.3" fill="none" />
                <circle cx="20" cy="20" r="2" fill="var(--card-accent, var(--pink))" opacity="0.3" />
              </svg>

              <div className="pk-card-top">
                <div className="pk-card-emoji-wrap"><span className="pk-card-emoji">{f.emoji}</span></div>
                <span className="pk-card-tag">{f.tag}</span>
              </div>
              <h3 className="pk-card-title">{f.title}</h3>
              <p className="pk-card-desc">{f.desc}</p>
              <div className="pk-card-pills">
                {f.pills.map(p => <span key={p} className="pk-pill">{p}</span>)}
              </div>
              <motion.button className="pk-card-btn"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => go(f.route)}
                aria-label={`Open ${f.title} feature`}>
                Open {f.title} →
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>

    

      {/* ══════════════════════════════
          LIVE TEASERS
      ══════════════════════════════ */}
      <section className="pk-teasers">
        <motion.div className="pk-section-header"
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55 }}>
          <div className="pk-section-tag">
            <DiamondSpark size={11} color="var(--peach)" /> try it now
          </div>
          <h2 className="pk-section-title">
            See it in <span className="pk-accent-pink">action ✦</span>
          </h2>
        </motion.div>

        <div className="pk-teasers-grid">
          {/* Flip card */}
          <motion.div className="pk-teaser-card"
            initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <div className="pk-teaser-label">
              <span className="pk-teaser-icon">🧠</span>
              <span>Flashcard Preview</span>
            </div>
            <FlipCardTeaser />
            <p className="pk-teaser-cta-txt">Auto-flipping every 3s — or tap to flip yourself</p>
            <motion.button className="pk-card-btn" whileHover={{ scale: 1.03 }}
              onClick={() => go("/flash-cards")}>Open Flashcards →</motion.button>
          </motion.div>

          {/* Mini timer */}
          <motion.div className="pk-teaser-card"
            initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <div className="pk-teaser-label">
              <span className="pk-teaser-icon">⏱️</span>
              <span>Focus Timer Preview</span>
            </div>
            <TimerTeaser onStart={() => go("/session")} />
            <p className="pk-teaser-cta-txt">25-min Pomodoro — try it right here</p>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════
          HOW IT WORKS
      ══════════════════════════════ */}
      <section className="pk-steps">
        <motion.div className="pk-section-header"
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55 }}>
          <div className="pk-section-tag">
            <DiamondSpark size={11} color="var(--lavender)" /> getting started
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
            <motion.div key={s.n} className="pk-step"
              initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.13, duration: 0.55 }}>
              {/* SVG step connector lines */}
              <div className="pk-step-num">{s.n}</div>
              <div className="pk-step-icon">{s.icon}</div>
              <h3 className="pk-step-title">{s.title}</h3>
              <p className="pk-step-body">{s.body}</p>
              {i < 2 && <div className="pk-step-connector" aria-hidden />}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          FAQ
      ══════════════════════════════ */}
      <section className="pk-faq-section">
        <motion.div className="pk-section-header"
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55 }}>
          <div className="pk-section-tag">
            <DiamondSpark size={11} color="var(--mint)" /> quick answers
          </div>
          <h2 className="pk-section-title">
            Got <span className="pk-accent-pink">questions? ✦</span>
          </h2>
        </motion.div>
        <div className="pk-faq-list">
          {faqs.map((f, i) => <FAQItem key={i} {...f} i={i} />)}
        </div>
      </section>

      {/* ══════════════════════════════
          CTA
      ══════════════════════════════ */}
      <section className="pk-cta">
        <div className="pk-cta-blob-a" />
        <div className="pk-cta-blob-b" />

        <motion.div className="pk-cta-card"
          initial={{ opacity: 0, scale: 0.94, y: 40 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>

          {/* SVG premium frame */}
          <svg className="pk-cta-frame" viewBox="0 0 780 480" fill="none" preserveAspectRatio="none">
            <rect x="1" y="1" width="778" height="478" rx="39" stroke="url(#frame-grad)" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="4" fill="var(--pink)" opacity="0.4" />
            <circle cx="760" cy="20" r="4" fill="var(--lavender)" opacity="0.4" />
            <circle cx="20" cy="460" r="4" fill="var(--peach)" opacity="0.4" />
            <circle cx="760" cy="460" r="4" fill="var(--mint)" opacity="0.4" />
            <path d="M20 40 L20 20 L40 20" stroke="var(--pink)" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
            <path d="M760 40 L760 20 L740 20" stroke="var(--lavender)" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
            <path d="M20 440 L20 460 L40 460" stroke="var(--peach)" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
            <path d="M760 440 L760 460 L740 460" stroke="var(--mint)" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
            <defs>
              <linearGradient id="frame-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--pink)" stopOpacity="0.3" />
                <stop offset="50%" stopColor="var(--lavender)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--mint)" stopOpacity="0.3" />
              </linearGradient>
            </defs>
          </svg>

          <div className="pk-cta-sparkles" aria-hidden>
            <DiamondSpark size={22} color="var(--pink)" style={{ position: "absolute", top: "12%", left: "8%" }} className="pk-ornament-float" />
            <DiamondSpark size={14} color="var(--lavender)" style={{ position: "absolute", top: "20%", right: "12%" }} className="pk-ornament-float-alt" />
            <DiamondSpark size={18} color="var(--peach)" style={{ position: "absolute", bottom: "18%", left: "15%" }} className="pk-ornament-float" />
            <DiamondSpark size={12} color="var(--mint)" style={{ position: "absolute", bottom: "12%", right: "8%" }} className="pk-ornament-float-alt" />
            <OrnamentCross size={16} color="rgba(255,158,210,0.3)" style={{ position: "absolute", top: "50%", left: "4%" }} className="pk-ornament-spin-slow" />
            <OrnamentCross size={12} color="rgba(201,184,255,0.25)" style={{ position: "absolute", top: "30%", right: "4%" }} className="pk-ornament-spin" />
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
            <motion.button className="pk-btn-primary pk-btn-xl"
              whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.97 }}
              onClick={() => go("/session")}>
              <span>Let&apos;s gooo 🚀</span>
            </motion.button>
            <motion.button className="pk-btn-ghost" whileHover={{ scale: 1.03 }}
              onClick={() => go("/flash-cards")}>
              try flashcards first
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── FAB ── */}
      <AnimatePresence>
        {scrolled && (
          <motion.button className="pk-fab"
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            ↑
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}