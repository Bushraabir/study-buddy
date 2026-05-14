import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBookOpen, FaVideo, FaLink, FaGraduationCap, FaWrench,
  FaStar, FaRegStar, FaCheck, FaTimes, FaPlus, FaSearch,
  FaExternalLinkAlt, FaTrash, FaLightbulb,
  FaChevronDown, FaHeart, FaRegHeart, FaListUl,
  FaClipboardList, FaUser,
} from "react-icons/fa";
import { LuSparkles, LuZap, LuBookMarked, LuShapes } from "react-icons/lu";
import { MdOutlineTimer } from "react-icons/md";
import { toast } from "react-hot-toast";
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, orderBy, getDoc,
  arrayUnion, arrayRemove, setDoc,
} from "firebase/firestore";
import { db, auth } from "../components/firebase";
import "./ResourceLibrary.css";

/* ─── Constants ──────────────────────────────────────────────────── */
const TYPES = [
  { key: "all",     label: "All",     icon: <LuShapes /> },
  { key: "video",   label: "Video",   icon: <FaVideo /> },
  { key: "article", label: "Article", icon: <FaBookOpen /> },
  { key: "course",  label: "Course",  icon: <FaGraduationCap /> },
  { key: "tool",    label: "Tool",    icon: <FaWrench /> },
];
const DIFFICULTIES = ["all", "beginner", "intermediate", "advanced"];
const DIFF_META = {
  beginner:     { label: "Beginner",     color: "mint",  dot: "#34d399" },
  intermediate: { label: "Intermediate", color: "amber", dot: "#fbbf24" },
  advanced:     { label: "Advanced",     color: "rose",  dot: "#fb7185" },
};
const TYPE_META = {
  video:   { icon: <FaVideo />,         label: "Video",   color: "var(--pookie-rose)" },
  article: { icon: <FaBookOpen />,      label: "Article", color: "var(--pookie-purple)" },
  course:  { icon: <FaGraduationCap />, label: "Course",  color: "var(--pookie-pink)" },
  tool:    { icon: <FaWrench />,        label: "Tool",    color: "#34d399" },
};
const SUBJECT_ALIASES = {
  "math":             ["calculus","algebra","linear algebra","geometry","trigonometry","statistics","probability"],
  "calculus":         ["math","derivatives","integrals","limits","functions"],
  "linear algebra":   ["math","vectors","matrices","eigenvalues"],
  "statistics":       ["math","probability","data","analysis"],
  "physics":          ["mechanics","kinematics","forces","electromagnetism","thermodynamics"],
  "chemistry":        ["organic chemistry","inorganic","biochemistry","molecules","reactions"],
  "biology":          ["cells","evolution","genetics","ecology","anatomy","microbiology"],
  "computer science": ["programming","algorithms","data structures","coding","software"],
  "programming":      ["computer science","coding","javascript","python","web development"],
  "javascript":       ["programming","web development","frontend","react","node"],
  "python":           ["programming","data science","machine learning","backend"],
  "data science":     ["programming","python","statistics","machine learning"],
  "machine learning": ["data science","python","neural networks","deep learning","ai"],
  "study skills":     ["learning","productivity","focus","technique","memory"],
  "productivity":     ["study skills","focus","time management","habits"],
  "design":           ["ui","ux","graphic design","figma","creative"],
  "economics":        ["finance","microeconomics","macroeconomics","markets"],
};
const WEB_DOMAINS = [
  { key: "all",             label: "Everywhere",   icon: "🔍" },
  { key: "youtube.com",     label: "YouTube",      icon: "📺" },
  { key: "khanacademy.org", label: "Khan Academy", icon: "🎓" },
  { key: "coursera.org",    label: "Coursera",     icon: "🏛️" },
  { key: "github.com",      label: "GitHub",       icon: "💻" },
  { key: "medium.com",      label: "Medium",       icon: "📝" },
  { key: "wikipedia.org",   label: "Wikipedia",    icon: "📚" },
];
const SEED_RESOURCES = [
  { title: "Khan Academy – Calculus", url: "https://www.khanacademy.org/math/calculus-1", type: "course", subjects: ["Math","Calculus"], difficulty: "beginner", duration: "Self-paced", tags: ["calculus","derivatives","integrals","limits"], addedBy: "admin", rating: 4.8 },
  { title: "3Blue1Brown – Linear Algebra", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab", type: "video", subjects: ["Math","Linear Algebra"], difficulty: "intermediate", duration: "~3 hours", tags: ["linear algebra","vectors","matrices"], addedBy: "admin", rating: 4.9 },
  { title: "Khan Academy – Statistics", url: "https://www.khanacademy.org/math/statistics-probability", type: "course", subjects: ["Math","Statistics"], difficulty: "beginner", duration: "Self-paced", tags: ["statistics","probability","data"], addedBy: "admin", rating: 4.7 },
  { title: "Paul's Online Math Notes", url: "https://tutorial.math.lamar.edu/", type: "article", subjects: ["Math","Calculus"], difficulty: "intermediate", duration: "Reference", tags: ["notes","reference","examples"], addedBy: "admin", rating: 4.7 },
  { title: "Brilliant – Math Courses", url: "https://brilliant.org/courses/", type: "course", subjects: ["Math"], difficulty: "intermediate", duration: "Self-paced", tags: ["interactive","problems","logic"], addedBy: "admin", rating: 4.5 },
  { title: "MIT OCW – Physics I", url: "https://ocw.mit.edu/courses/8-01l-physics-i-classical-mechanics-fall-2005/", type: "course", subjects: ["Physics","Mechanics"], difficulty: "advanced", duration: "Full semester", tags: ["physics","mechanics","MIT"], addedBy: "admin", rating: 4.7 },
  { title: "Khan Academy – Physics", url: "https://www.khanacademy.org/science/physics", type: "course", subjects: ["Physics"], difficulty: "beginner", duration: "Self-paced", tags: ["physics","forces","energy"], addedBy: "admin", rating: 4.5 },
  { title: "Khan Academy – Chemistry", url: "https://www.khanacademy.org/science/chemistry", type: "course", subjects: ["Chemistry"], difficulty: "beginner", duration: "Self-paced", tags: ["chemistry","atoms","reactions"], addedBy: "admin", rating: 4.5 },
  { title: "Professor Dave – Organic Chemistry", url: "https://www.youtube.com/playlist?list=PLbyjwya3J7hWmTCiEtKlW1y5Q2bTkD6-T", type: "video", subjects: ["Chemistry","Organic Chemistry"], difficulty: "intermediate", duration: "~20 hours", tags: ["organic chemistry","reactions"], addedBy: "admin", rating: 4.7 },
  { title: "Crash Course – Biology", url: "https://www.youtube.com/playlist?list=PL3EED4C1D684D3ADF", type: "video", subjects: ["Biology"], difficulty: "beginner", duration: "~6 hours", tags: ["biology","cells","evolution","genetics"], addedBy: "admin", rating: 4.6 },
  { title: "freeCodeCamp – JavaScript", url: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/", type: "course", subjects: ["Programming","JavaScript"], difficulty: "beginner", duration: "300 hours", tags: ["javascript","web","coding"], addedBy: "admin", rating: 4.8 },
  { title: "Harvard CS50", url: "https://cs50.harvard.edu/x/", type: "course", subjects: ["Computer Science","Programming"], difficulty: "beginner", duration: "12 weeks", tags: ["cs50","harvard","computer science","python"], addedBy: "admin", rating: 4.9 },
  { title: "The Odin Project", url: "https://www.theodinproject.com/", type: "course", subjects: ["Programming","Web Development"], difficulty: "beginner", duration: "Self-paced", tags: ["full stack","javascript","projects"], addedBy: "admin", rating: 4.8 },
  { title: "LeetCode", url: "https://leetcode.com/", type: "tool", subjects: ["Programming","Computer Science"], difficulty: "intermediate", duration: "Practice", tags: ["algorithms","interview","coding"], addedBy: "admin", rating: 4.5 },
  { title: "MDN Web Docs", url: "https://developer.mozilla.org/", type: "article", subjects: ["Programming","Web Development"], difficulty: "intermediate", duration: "Reference", tags: ["reference","javascript","html","css"], addedBy: "admin", rating: 4.9 },
  { title: "Kaggle – Learn", url: "https://www.kaggle.com/learn", type: "course", subjects: ["Data Science","Python"], difficulty: "intermediate", duration: "Self-paced", tags: ["machine learning","pandas","python"], addedBy: "admin", rating: 4.7 },
  { title: "Fast.ai – Practical Deep Learning", url: "https://www.fast.ai/", type: "course", subjects: ["Data Science","Machine Learning"], difficulty: "intermediate", duration: "7 weeks", tags: ["deep learning","pytorch","ai"], addedBy: "admin", rating: 4.8 },
  { title: "The Feynman Technique", url: "https://fs.blog/feynman-technique/", type: "article", subjects: ["Study Skills"], difficulty: "beginner", duration: "10 min", tags: ["learning","technique","understanding"], addedBy: "admin", rating: 4.7 },
  { title: "Anki", url: "https://apps.ankiweb.net/", type: "tool", subjects: ["Study Skills"], difficulty: "beginner", duration: "Instant", tags: ["flashcards","memory","spaced repetition"], addedBy: "admin", rating: 4.8 },
  { title: "Excalidraw", url: "https://excalidraw.com", type: "tool", subjects: ["General","Study Skills"], difficulty: "beginner", duration: "Instant", tags: ["diagrams","mind maps","visual"], addedBy: "admin", rating: 4.5 },
  { title: "Pomofocus – Pomodoro Timer", url: "https://pomofocus.io/", type: "tool", subjects: ["Study Skills","Productivity"], difficulty: "beginner", duration: "Instant", tags: ["timer","pomodoro","focus"], addedBy: "admin", rating: 4.4 },
  { title: "Khan Academy – Economics", url: "https://www.khanacademy.org/economics-finance-domain", type: "course", subjects: ["Economics"], difficulty: "beginner", duration: "Self-paced", tags: ["economics","finance","micro","macro"], addedBy: "admin", rating: 4.5 },
  { title: "Figma – Design Tool", url: "https://www.figma.com/", type: "tool", subjects: ["Design","UI/UX"], difficulty: "beginner", duration: "Instant", tags: ["design","prototyping","ui"], addedBy: "admin", rating: 4.8 },
];

/* ─── SVG Growth Stage Illustrations ────────────────────────────── */
function SeedPlantedSVG({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="40" height="40">
      <defs>
        <radialGradient id="sp-soil" cx="50%" cy="80%" r="50%">
          <stop offset="0%" stopColor="#3d2b1f"/>
          <stop offset="100%" stopColor="#1a120b"/>
        </radialGradient>
        <radialGradient id="sp-seed" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#d4a574"/>
          <stop offset="50%" stopColor="#8b6914"/>
          <stop offset="100%" stopColor="#4a3728"/>
        </radialGradient>
        <filter id="sp-glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="165" rx="70" ry="25" fill="url(#sp-soil)"/>
      <ellipse cx="100" cy="152" rx="18" ry="12" fill="url(#sp-seed)" filter="url(#sp-glow)"/>
      <ellipse cx="95" cy="148" rx="6" ry="3" fill="rgba(255,255,255,0.3)" transform="rotate(-15 95 148)"/>
      <path d="M100 140 Q100 125 95 115" stroke="#34d399" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6"/>
      <circle cx="95" cy="112" r="3" fill="#34d399" opacity="0.5"/>
      <g fill="#fbbf24" opacity="0.7">
        <circle cx="70" cy="130" r="1.5"/>
        <circle cx="130" cy="125" r="2"/>
        <circle cx="140" cy="145" r="1"/>
        <circle cx="60" cy="145" r="1.5"/>
      </g>
    </svg>
  );
}

function StartedSVG({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="40" height="40">
      <defs>
        <linearGradient id="st-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669"/>
          <stop offset="50%" stopColor="#34d399"/>
          <stop offset="100%" stopColor="#6ee7b7"/>
        </linearGradient>
        <radialGradient id="st-soil" cx="50%" cy="80%" r="50%">
          <stop offset="0%" stopColor="#3d2b1f"/>
          <stop offset="100%" stopColor="#1a120b"/>
        </radialGradient>
        <filter id="st-glow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="170" rx="65" ry="22" fill="url(#st-soil)"/>
      <path d="M100 168 Q100 140 100 110" stroke="url(#st-grad)" strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#st-glow)"/>
      <path d="M100 140 Q75 130 65 115 Q80 125 100 135" fill="#34d399" opacity="0.9"/>
      <path d="M100 140 Q75 130 65 115" stroke="#059669" strokeWidth="1.5" fill="none"/>
      <path d="M100 135 Q125 125 135 110 Q120 120 100 130" fill="#6ee7b7" opacity="0.85"/>
      <path d="M100 135 Q125 125 135 110" stroke="#059669" strokeWidth="1.5" fill="none"/>
      <circle cx="70" cy="118" r="2.5" fill="#60a5fa" opacity="0.6"/>
      <circle cx="130" cy="113" r="2" fill="#60a5fa" opacity="0.5"/>
    </svg>
  );
}

function GrowingSVG({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="40" height="40">
      <defs>
        <linearGradient id="gr-stem" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669"/>
          <stop offset="100%" stopColor="#34d399"/>
        </linearGradient>
        <linearGradient id="gr-leaf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399"/>
          <stop offset="100%" stopColor="#10b981"/>
        </linearGradient>
        <filter id="gr-glow">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="175" rx="60" ry="20" fill="#1a120b"/>
      <path d="M100 173 Q102 130 100 80" stroke="url(#gr-stem)" strokeWidth="5" fill="none" strokeLinecap="round" filter="url(#gr-glow)"/>
      <path d="M100 130 Q70 120 55 100" stroke="url(#gr-stem)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M100 110 Q130 100 145 80" stroke="url(#gr-stem)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <ellipse cx="55" cy="95" rx="18" ry="10" fill="url(#gr-leaf)" transform="rotate(-30 55 95)" opacity="0.9"/>
      <ellipse cx="145" cy="75" rx="18" ry="10" fill="url(#gr-leaf)" transform="rotate(30 145 75)" opacity="0.9"/>
      <ellipse cx="100" cy="72" rx="6" ry="10" fill="#a855f7" opacity="0.7"/>
      <ellipse cx="100" cy="68" rx="4" ry="6" fill="#d8b4fe" opacity="0.5"/>
    </svg>
  );
}

function AlmostSVG({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="40" height="40">
      <defs>
        <linearGradient id="al-stem" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669"/>
          <stop offset="100%" stopColor="#34d399"/>
        </linearGradient>
        <radialGradient id="al-flower" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f472b6"/>
          <stop offset="50%" stopColor="#ec4899"/>
          <stop offset="100%" stopColor="#be185d"/>
        </radialGradient>
        <radialGradient id="al-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24"/>
          <stop offset="100%" stopColor="#d97706"/>
        </radialGradient>
        <filter id="al-glow">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="180" rx="55" ry="18" fill="#1a120b"/>
      <path d="M100 178 Q98 120 100 70" stroke="url(#al-stem)" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <ellipse cx="75" cy="130" rx="20" ry="12" fill="#34d399" transform="rotate(-25 75 130)" opacity="0.85"/>
      <ellipse cx="125" cy="115" rx="18" ry="10" fill="#10b981" transform="rotate(25 125 115)" opacity="0.85"/>
      <g transform="translate(100, 65)" filter="url(#al-glow)">
        <ellipse cx="0" cy="-22" rx="10" ry="18" fill="url(#al-flower)" opacity="0.7"/>
        <ellipse cx="19" cy="-11" rx="10" ry="18" fill="url(#al-flower)" opacity="0.7" transform="rotate(72)"/>
        <ellipse cx="12" cy="17" rx="10" ry="18" fill="url(#al-flower)" opacity="0.7" transform="rotate(144)"/>
        <ellipse cx="-12" cy="17" rx="10" ry="18" fill="url(#al-flower)" opacity="0.7" transform="rotate(216)"/>
        <ellipse cx="-19" cy="-11" rx="10" ry="18" fill="url(#al-flower)" opacity="0.7" transform="rotate(288)"/>
      </g>
      <g transform="translate(100, 65)">
        <ellipse cx="0" cy="-18" rx="8" ry="14" fill="#f9a8d4" opacity="0.9"/>
        <ellipse cx="15" cy="-9" rx="8" ry="14" fill="#f9a8d4" opacity="0.9" transform="rotate(72)"/>
        <ellipse cx="10" cy="14" rx="8" ry="14" fill="#f9a8d4" opacity="0.9" transform="rotate(144)"/>
        <ellipse cx="-10" cy="14" rx="8" ry="14" fill="#f9a8d4" opacity="0.9" transform="rotate(216)"/>
        <ellipse cx="-15" cy="-9" rx="8" ry="14" fill="#f9a8d4" opacity="0.9" transform="rotate(288)"/>
        <circle cx="0" cy="0" r="10" fill="url(#al-center)"/>
        <circle cx="0" cy="0" r="6" fill="#fbbf24" opacity="0.5"/>
      </g>
    </svg>
  );
}

function CompleteSVG({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="40" height="40">
      <defs>
        <linearGradient id="co-stem" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669"/>
          <stop offset="100%" stopColor="#34d399"/>
        </linearGradient>
        <radialGradient id="co-flower" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fbcfe8"/>
          <stop offset="40%" stopColor="#f472b6"/>
          <stop offset="100%" stopColor="#db2777"/>
        </radialGradient>
        <radialGradient id="co-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef3c7"/>
          <stop offset="50%" stopColor="#fbbf24"/>
          <stop offset="100%" stopColor="#d97706"/>
        </radialGradient>
        <filter id="co-glow">
          <feGaussianBlur stdDeviation="8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="100" cy="80" r="60" fill="rgba(244,114,182,0.08)" filter="url(#co-glow)"/>
      <ellipse cx="100" cy="185" rx="50" ry="15" fill="#1a120b"/>
      <path d="M100 183 Q102 110 100 55" stroke="url(#co-stem)" strokeWidth="5" fill="none" strokeLinecap="round" filter="url(#co-glow)"/>
      <ellipse cx="72" cy="125" rx="22" ry="14" fill="#34d399" transform="rotate(-20 72 125)" opacity="0.9"/>
      <ellipse cx="128" cy="110" rx="20" ry="12" fill="#10b981" transform="rotate(20 128 110)" opacity="0.9"/>
      <g transform="translate(100, 50)" filter="url(#co-glow)">
        <g opacity="0.8">
          <ellipse cx="0" cy="-28" rx="12" ry="22" fill="url(#co-flower)"/>
          <ellipse cx="26" cy="-14" rx="12" ry="22" fill="url(#co-flower)" transform="rotate(60)"/>
          <ellipse cx="26" cy="14" rx="12" ry="22" fill="url(#co-flower)" transform="rotate(120)"/>
          <ellipse cx="0" cy="28" rx="12" ry="22" fill="url(#co-flower)" transform="rotate(180)"/>
          <ellipse cx="-26" cy="14" rx="12" ry="22" fill="url(#co-flower)" transform="rotate(240)"/>
          <ellipse cx="-26" cy="-14" rx="12" ry="22" fill="url(#co-flower)" transform="rotate(300)"/>
        </g>
        <g opacity="0.95">
          <ellipse cx="0" cy="-20" rx="8" ry="16" fill="#f9a8d4"/>
          <ellipse cx="17" cy="-10" rx="8" ry="16" fill="#f9a8d4" transform="rotate(60)"/>
          <ellipse cx="17" cy="10" rx="8" ry="16" fill="#f9a8d4" transform="rotate(120)"/>
          <ellipse cx="0" cy="20" rx="8" ry="16" fill="#f9a8d4" transform="rotate(180)"/>
          <ellipse cx="-17" cy="10" rx="8" ry="16" fill="#f9a8d4" transform="rotate(240)"/>
          <ellipse cx="-17" cy="-10" rx="8" ry="16" fill="#f9a8d4" transform="rotate(300)"/>
        </g>
        <circle cx="0" cy="0" r="14" fill="url(#co-center)"/>
        <circle cx="0" cy="0" r="10" fill="#fbbf24" opacity="0.4"/>
        <g fill="#fbbf24">
          <circle cx="-4" cy="-4" r="2"/>
          <circle cx="4" cy="-3" r="1.5"/>
          <circle cx="0" cy="5" r="2"/>
          <circle cx="-3" cy="3" r="1"/>
          <circle cx="5" cy="2" r="1.5"/>
        </g>
      </g>
      <g fill="#fbbf24">
        <path d="M60 40 L61 44 L65 45 L61 46 L60 50 L59 46 L55 45 L59 44 Z"/>
        <path d="M155 32 L156 35 L159 36 L156 37 L155 40 L154 37 L151 36 L154 35 Z"/>
      </g>
      <g transform="translate(100, 50)">
        <circle cx="0" cy="0" r="22" fill="rgba(52,211,153,0.15)" stroke="#34d399" strokeWidth="2"/>
        <path d="M-7 2 L-2 7 L8 -5" stroke="#34d399" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
}

function GrowthStageSVG({ pct, className }) {
  if (pct === 100)  return <CompleteSVG className={className} />;
  if (pct >= 75)    return <AlmostSVG className={className} />;
  if (pct >= 50)    return <GrowingSVG className={className} />;
  if (pct > 0)      return <StartedSVG className={className} />;
  return <SeedPlantedSVG className={className} />;
}

/* ─── Thumbnail Helpers ──────────────────────────────────────────── */
function getThumbnail(url) {
  const yt = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch { return null; }
}
function getFallbackGradient(title, type) {
  const map = {
    video:   ["#f472b6","#db2777"],
    article: ["#a855f7","#7c3aed"],
    course:  ["#34d399","#059669"],
    tool:    ["#fbbf24","#d97706"],
  };
  const [c1, c2] = map[type] || map.article;
  const init = (title || "?").charAt(0).toUpperCase();
  const c1e = c1.replace(/#/g, "%23");
  const c2e = c2.replace(/#/g, "%23");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="100%25" y2="100%25"><stop offset="0%25" stop-color="${c1e}"/><stop offset="100%25" stop-color="${c2e}"/></linearGradient></defs><rect width="100%25" height="100%25" fill="url(%23g)"/><text x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="sans-serif" font-size="80" font-weight="bold" opacity="0.8">${init}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ─── localStorage helpers ───────────────────────────────────────── */
function logRecentView(resource) {
  try {
    const recent = JSON.parse(localStorage.getItem("rl_recent") || "[]");
    const next = [
      { id: resource.id, title: resource.title, url: resource.url, type: resource.type, viewedAt: Date.now() },
      ...recent.filter((r) => r.id !== resource.id),
    ].slice(0, 8);
    localStorage.setItem("rl_recent", JSON.stringify(next));
  } catch {}
}
function getRecentViews() {
  try { return JSON.parse(localStorage.getItem("rl_recent") || "[]"); } catch { return []; }
}

/* ─── Web search helper ──────────────────────────────────────────── */
function openWebSearch(q, domain) {
  const enc = encodeURIComponent(q);
  const site = domain !== "all" ? `+site:${domain}` : "";
  window.open(`https://www.google.com/search?q=${enc}${site}`, "_blank", "noopener,noreferrer");
}

/* ─── Premium SVG Empty State Illustrations ──────────────────────── */
function IllustrationEmpty({ tab }) {
  if (tab === "saved") return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="rl-myres-empty-svg">
      <defs>
        <radialGradient id="es-saved-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(244,114,182,0.12)"/>
          <stop offset="100%" stopColor="rgba(244,114,182,0)"/>
        </radialGradient>
        <filter id="es-saved-glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="70" cy="108" rx="48" ry="9" fill="rgba(244,114,182,0.08)"/>
      <circle cx="70" cy="56" r="40" fill="url(#es-saved-bg)"/>
      <rect x="34" y="28" width="72" height="58" rx="13" fill="rgba(168,85,247,0.10)" stroke="rgba(244,114,182,0.35)" strokeWidth="1.5"/>
      <rect x="34" y="28" width="72" height="8" rx="4" fill="rgba(244,114,182,0.18)"/>
      <path d="M50 55 L70 38 L90 55 L90 80 L50 80 Z" fill="none" stroke="rgba(244,114,182,0.6)" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M50 55 L70 38 L90 55" fill="none" stroke="rgba(168,85,247,0.8)" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M62 80 L62 64 L78 64 L78 80" fill="rgba(244,114,182,0.15)" stroke="rgba(244,114,182,0.4)" strokeWidth="1.5"/>
      <circle cx="107" cy="28" r="8" fill="rgba(244,114,182,0.2)" stroke="rgba(244,114,182,0.5)" strokeWidth="1.5" filter="url(#es-saved-glow)"/>
      <path d="M104 28 L107 31 L111 25" stroke="rgba(244,114,182,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <g opacity="0.5">
        <circle cx="26" cy="42" r="2.5" fill="rgba(168,85,247,0.6)"/>
        <circle cx="118" cy="68" r="2" fill="rgba(244,114,182,0.6)"/>
        <circle cx="30" cy="78" r="1.5" fill="rgba(251,113,133,0.6)"/>
      </g>
    </svg>
  );
  if (tab === "completed") return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="rl-myres-empty-svg">
      <defs>
        <radialGradient id="es-done-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(52,211,153,0.14)"/>
          <stop offset="100%" stopColor="rgba(52,211,153,0)"/>
        </radialGradient>
        <filter id="es-done-glow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="70" cy="108" rx="48" ry="9" fill="rgba(52,211,153,0.08)"/>
      <circle cx="70" cy="56" r="40" fill="url(#es-done-bg)" filter="url(#es-done-glow)"/>
      <circle cx="70" cy="56" r="28" fill="none" stroke="rgba(52,211,153,0.25)" strokeWidth="1.5" strokeDasharray="4 4"/>
      <circle cx="70" cy="56" r="20" fill="rgba(52,211,153,0.12)" stroke="rgba(52,211,153,0.4)" strokeWidth="1.5"/>
      <path d="M59 56 L66 63 L82 47" stroke="rgba(52,211,153,0.9)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="106" cy="28" r="7" fill="rgba(251,191,36,0.18)" stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" filter="url(#es-done-glow)"/>
      <path d="M106 25 L106 28 L108 28" stroke="rgba(251,191,36,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
      <g fill="rgba(52,211,153,0.4)">
        <circle cx="28" cy="42" r="2"/>
        <circle cx="116" cy="70" r="2.5"/>
        <circle cx="34" cy="80" r="1.5"/>
      </g>
    </svg>
  );
  if (tab === "myresources") return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="rl-myres-empty-svg">
      <defs>
        <radialGradient id="es-my-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(168,85,247,0.12)"/>
          <stop offset="100%" stopColor="rgba(168,85,247,0)"/>
        </radialGradient>
        <filter id="es-my-glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="70" cy="108" rx="48" ry="9" fill="rgba(168,85,247,0.08)"/>
      <circle cx="70" cy="56" r="40" fill="url(#es-my-bg)"/>
      <rect x="30" y="30" width="68" height="52" rx="11" fill="rgba(168,85,247,0.08)" stroke="rgba(168,85,247,0.32)" strokeWidth="1.5"/>
      <rect x="38" y="42" width="52" height="5" rx="2.5" fill="rgba(244,114,182,0.5)"/>
      <rect x="38" y="54" width="40" height="4" rx="2" fill="rgba(168,85,247,0.4)"/>
      <rect x="38" y="64" width="30" height="4" rx="2" fill="rgba(168,85,247,0.3)"/>
      <circle cx="107" cy="30" r="11" fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5" filter="url(#es-my-glow)"/>
      <path d="M107 26 L107 30 M105 28 L109 28" stroke="rgba(168,85,247,0.9)" strokeWidth="2" strokeLinecap="round"/>
      <g opacity="0.45">
        <circle cx="24" cy="48" r="2.5" fill="rgba(244,114,182,0.8)"/>
        <circle cx="118" cy="72" r="2" fill="rgba(168,85,247,0.8)"/>
      </g>
    </svg>
  );
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="rl-myres-empty-svg">
      <defs>
        <radialGradient id="es-disc-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(244,114,182,0.10)"/>
          <stop offset="100%" stopColor="rgba(244,114,182,0)"/>
        </radialGradient>
        <filter id="es-disc-glow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="70" cy="108" rx="48" ry="9" fill="rgba(244,114,182,0.06)"/>
      <circle cx="60" cy="54" r="28" fill="url(#es-disc-bg)" filter="url(#es-disc-glow)"/>
      <circle cx="60" cy="54" r="22" fill="none" stroke="rgba(168,85,247,0.28)" strokeWidth="1.5"/>
      <circle cx="60" cy="54" r="14" fill="none" stroke="rgba(168,85,247,0.18)" strokeWidth="1.5"/>
      <path d="M76 70 L90 84" stroke="rgba(244,114,182,0.65)" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="91" cy="85" r="5" fill="rgba(244,114,182,0.25)" stroke="rgba(244,114,182,0.6)" strokeWidth="1.5"/>
      <path d="M52 46 L68 38" stroke="rgba(168,85,247,0.55)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M52 62 L68 70" stroke="rgba(168,85,247,0.55)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="107" cy="26" r="7" fill="rgba(244,114,182,0.2)" stroke="rgba(244,114,182,0.5)" strokeWidth="1.5" filter="url(#es-disc-glow)"/>
      <path d="M104 26 L107 29 L111 23" stroke="rgba(244,114,182,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ─── Premium Hero Decoration SVG ───────────────────────────────── */
function HeroDecoration() {
  return (
    <svg className="rl-hero__deco" width="260" height="180" viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="hd-glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Orbiting rings */}
      <circle cx="130" cy="90" r="75" stroke="rgba(244,114,182,0.2)" strokeWidth="1" strokeDasharray="5 8"/>
      <circle cx="130" cy="90" r="52" stroke="rgba(168,85,247,0.18)" strokeWidth="0.8" strokeDasharray="3 6"/>
      <circle cx="130" cy="90" r="30" stroke="rgba(251,113,133,0.22)" strokeWidth="1.2"/>
      {/* Center orb */}
      <circle cx="130" cy="90" r="20" fill="rgba(244,114,182,0.12)" stroke="rgba(244,114,182,0.4)" strokeWidth="1.5" filter="url(#hd-glow)"/>
      <path d="M120 90 L128 98 L142 82" stroke="rgba(244,114,182,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Orbiting dots */}
      <circle cx="130" cy="15" r="5" fill="rgba(168,85,247,0.7)" filter="url(#hd-glow)"/>
      <circle cx="205" cy="90" r="4" fill="rgba(244,114,182,0.7)" filter="url(#hd-glow)"/>
      <circle cx="55" cy="90" r="3" fill="rgba(251,113,133,0.6)" filter="url(#hd-glow)"/>
      <circle cx="130" cy="165" r="4" fill="rgba(168,85,247,0.5)"/>
      {/* Sparkle stars */}
      <path d="M38 30 L39.5 35 L44.5 36.5 L39.5 38 L38 43 L36.5 38 L31.5 36.5 L36.5 35 Z" fill="rgba(168,85,247,0.55)"/>
      <path d="M220 50 L221 54 L225 55 L221 56 L220 60 L219 56 L215 55 L219 54 Z" fill="rgba(244,114,182,0.5)"/>
      <path d="M20 120 L21 123 L24 124 L21 125 L20 128 L19 125 L16 124 L19 123 Z" fill="rgba(251,113,133,0.45)"/>
      <path d="M238 130 L238.8 132.8 L241.6 133.6 L238.8 134.4 L238 137.2 L237.2 134.4 L234.4 133.6 L237.2 132.8 Z" fill="rgba(168,85,247,0.4)"/>
      {/* Diamonds */}
      <path d="M50 55 L60 45 L70 55 L60 65 Z" fill="rgba(168,85,247,0.18)" stroke="rgba(168,85,247,0.4)" strokeWidth="0.8"/>
      <path d="M185 125 L194 116 L203 125 L194 134 Z" fill="rgba(244,114,182,0.15)" stroke="rgba(244,114,182,0.35)" strokeWidth="0.8"/>
      {/* Mini open ring */}
      <circle cx="18" cy="60" r="7" stroke="rgba(168,85,247,0.4)" strokeWidth="1.2" fill="none"/>
      <circle cx="242" cy="108" r="5" stroke="rgba(244,114,182,0.4)" strokeWidth="1" fill="none"/>
    </svg>
  );
}

/* ─── Star Rating ────────────────────────────────────────────────── */
function StarRating({ value }) {
  const stars = Math.round(value);
  return (
    <span className="rl-stars" aria-label={`${value} out of 5`}>
      {[1,2,3,4,5].map((s) => s <= stars
        ? <FaStar key={s} className="rl-stars__filled" />
        : <FaRegStar key={s} className="rl-stars__empty" />
      )}
      <span className="rl-stars__val">{value.toFixed(1)}</span>
    </span>
  );
}

/* ─── Note Editor ────────────────────────────────────────────────── */
function NoteEditor({ resourceId, initialNote, onSave, onClose }) {
  const [text, setText] = useState(initialNote || "");
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }} className="rl-note-editor"
    >
      <textarea
        className="rl-note-input"
        placeholder="Why is this useful? Key takeaways? ✨"
        value={text} onChange={(e) => setText(e.target.value)} rows={3}
        autoFocus
      />
      <div className="rl-note-actions">
        <button className="rl-btn rl-btn--ghost rl-btn--sm" onClick={onClose}>Cancel</button>
        <button className="rl-btn rl-btn--primary rl-btn--sm" onClick={() => onSave(resourceId, text)}>
          Save Note 💛
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Web Search Bridge ──────────────────────────────────────────── */
function WebSearchBridge({ weakSubjects }) {
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("all");
  const suggestions = useMemo(() =>
    (weakSubjects?.length ? weakSubjects.slice(0,4) : ["study resources"])
      .map((s) => `Best ${s} tutorials`),
    [weakSubjects]
  );
  return (
    <motion.div className="rl-web-bridge" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rl-web-bridge__header">
        <div className="rl-web-bridge__icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(52,211,153,0.8)" strokeWidth="1.5"/>
            <path d="M2 12 Q7 8 12 12 Q17 16 22 12" stroke="rgba(52,211,153,0.8)" strokeWidth="1.5" fill="none"/>
            <path d="M12 2 Q8 7 8 12 Q8 17 12 22" stroke="rgba(52,211,153,0.8)" strokeWidth="1.5" fill="none"/>
            <path d="M12 2 Q16 7 16 12 Q16 17 12 22" stroke="rgba(52,211,153,0.8)" strokeWidth="1.5" fill="none"/>
          </svg>
        </div>
        <div>
          <h4 className="rl-web-bridge__title">Find More Resources</h4>
          <p className="rl-web-bridge__desc">Search the web for resources not in the library yet 🌐</p>
        </div>
      </div>
      <div className="rl-web-bridge__search">
        <div className="rl-web-bridge__input-wrap">
          <FaSearch className="rl-web-bridge__input-icon" />
          <input
            className="rl-web-bridge__input"
            placeholder="What do you want to learn? e.g. React hooks"
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && q.trim() && openWebSearch(q, domain)}
          />
        </div>
        <motion.button
          className="rl-btn rl-btn--primary rl-btn--sm"
          onClick={() => q.trim() && openWebSearch(q, domain)}
          whileTap={{ scale: 0.95 }} disabled={!q.trim()}
        >
          <FaExternalLinkAlt size={11} /> Search
        </motion.button>
      </div>
      <div className="rl-web-bridge__domains">
        {WEB_DOMAINS.map((d) => (
          <button key={d.key} className={`rl-domain-chip${domain === d.key ? " rl-domain-chip--active" : ""}`} onClick={() => setDomain(d.key)}>
            <span>{d.icon}</span> {d.label}
          </button>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="rl-web-bridge__suggested">
          <span className="rl-web-bridge__label">✨ Based on your weak topics</span>
          <div className="rl-web-bridge__chips">
            {suggestions.map((s, i) => (
              <button key={i} className="rl-suggested-chip" onClick={() => openWebSearch(s, "all")}>{s}</button>
            ))}
          </div>
        </div>
      )}
      <p className="rl-web-bridge__hint">💡 Found something great? Use "Add Resource" to save it for everyone!</p>
    </motion.div>
  );
}

/* ─── Resource Card ──────────────────────────────────────────────── */
function ResourceCard({
  resource, userStatus, onSave, onComplete, onDismiss, onDelete,
  onAddToPlaylist, isOwner, delay = 0, resourceNotes,
  editingNote, onEditNote, onSaveNote,
}) {
  const tm        = TYPE_META[resource.type] || TYPE_META.article;
  const dm        = DIFF_META[resource.difficulty] || DIFF_META.beginner;
  const saved     = userStatus === "saved";
  const completed = userStatus === "completed";
  const thumb     = getThumbnail(resource.url);
  const fallback  = getFallbackGradient(resource.title, resource.type);
  const isEditing = editingNote === resource.id;
  const hasNote   = !!resourceNotes[resource.id];

  async function handleShare() {
    const text = `📚 "${resource.title}"\n${resource.url}\n(via my StudyBuddy Library 🩷)`;
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard! 🩷");
  }

  return (
    <motion.div
      className={`rl-card rl-card--${resource.type}${completed ? " rl-card--completed" : ""}`}
      initial={{ opacity: 0, y: 22, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, y: -10 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
      whileHover={{ y: -6, transition: { type: "spring", stiffness: 400, damping: 20 } }}
      layout
    >
      {/* Ambient glow orb */}
      <div className="rl-card__ambient" aria-hidden="true" />

      {/* Thumbnail */}
      <div className="rl-card__thumb-wrap">
        <img
          src={thumb || fallback}
          alt=""
          className="rl-card__thumb"
          loading="lazy"
          onError={(e) => { e.target.src = fallback; }}
        />
        <div className="rl-card__thumb-overlay" />
        <div className="rl-card__thumb-badge" style={{ color: tm.color }}>
          {tm.icon} {tm.label}
        </div>
        {completed && (
          <motion.div
            className="rl-card__ribbon"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            🌸 Done
          </motion.div>
        )}
        {isOwner && <div className="rl-card__owner-badge">✨ You added this</div>}
      </div>

      <div className="rl-card__body">
        <h3 className="rl-card__title">{resource.title}</h3>
        <div className="rl-card__meta-row">
          <span className={`rl-diff rl-diff--${dm.color}`}>
            <span className="rl-diff__dot" style={{ background: dm.dot }} />
            {dm.label}
          </span>
          <span className="rl-card__duration"><MdOutlineTimer /> {resource.duration}</span>
        </div>
        <div className="rl-card__subjects">
          {resource.subjects?.map((s) => <span key={s} className="rl-subject-chip">{s}</span>)}
        </div>
        {resource.tags?.length > 0 && (
          <div className="rl-card__tags">
            {resource.tags.slice(0, 4).map((t) => <span key={t} className="rl-tag">#{t}</span>)}
          </div>
        )}
        {hasNote && !isEditing && (
          <div className="rl-note-preview">
            <FaLightbulb size={10} style={{ flexShrink: 0, marginTop: 2, color: "#fbbf24" }} />
            {resourceNotes[resource.id]}
          </div>
        )}
        <AnimatePresence>
          {isEditing && (
            <NoteEditor
              resourceId={resource.id}
              initialNote={resourceNotes[resource.id]}
              onSave={onSaveNote}
              onClose={() => onEditNote(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="rl-card__footer">
        <StarRating value={resource.rating || 4.5} />
        <div className="rl-card__actions">
          <motion.button
            className={`rl-action-btn rl-action-btn--save${saved ? " rl-action-btn--active" : ""}`}
            onClick={() => onSave(resource)} whileTap={{ scale: 0.82 }} title={saved ? "Unsave" : "Save for later 🩷"}
          >
            {saved ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <motion.button
            className={`rl-action-btn rl-action-btn--complete${completed ? " rl-action-btn--done" : ""}`}
            onClick={() => onComplete(resource)} whileTap={{ scale: 0.82 }} title={completed ? "Mark incomplete" : "Mark complete ✓"}
          >
            <FaCheck />
          </motion.button>
          <motion.button
            className="rl-action-btn rl-action-btn--playlist"
            onClick={() => onAddToPlaylist(resource)} whileTap={{ scale: 0.82 }} title="Add to playlist"
          >
            <FaListUl />
          </motion.button>
          <motion.button
            className={`rl-action-btn${hasNote ? " rl-action-btn--active-note" : ""}`}
            onClick={() => onEditNote(isEditing ? null : resource.id)}
            whileTap={{ scale: 0.82 }} title={hasNote ? "Edit note 💛" : "Add note"}
          >
            <FaLightbulb />
          </motion.button>
          <motion.button
            className="rl-action-btn rl-action-btn--share"
            onClick={handleShare} whileTap={{ scale: 0.82 }} title="Copy link"
          >
            <FaLink />
          </motion.button>
          <a
            className="rl-action-btn rl-action-btn--open"
            href={resource.url} target="_blank" rel="noopener noreferrer"
            title="Open resource ↗" onClick={() => logRecentView(resource)}
          >
            <FaExternalLinkAlt />
          </a>
          {!(isOwner || resource.addedBy === "admin") && (
            <motion.button className="rl-action-btn" onClick={() => onDismiss(resource)} whileTap={{ scale: 0.82 }} title="Dismiss">
              <FaTimes />
            </motion.button>
          )}
          {isOwner && (
            <motion.button className="rl-action-btn rl-action-btn--delete" onClick={() => onDelete(resource.id)} whileTap={{ scale: 0.82 }} title="Delete">
              <FaTrash />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Smart Recommender ──────────────────────────────────────────── */
function SmartRecommender({ resources, userResources, masteryData, playlists, onDismiss, onAddToPlaylist }) {
  const [expanded, setExpanded] = useState(true);

  const weakSubjects = useMemo(() => {
    const weak = new Set();
    masteryData?.subjects?.forEach((sub) => {
      sub.topics?.forEach((t) => { if ((t.confidence || 1) <= 4) { weak.add(sub.name); weak.add(t.name); } });
    });
    return [...weak];
  }, [masteryData]);

  const suggestions = useMemo(() => {
    if (!resources.length) return [];
    const weakSet = new Set(weakSubjects.map((s) => s.toLowerCase()));
    const studiedSubjects = new Set();
    const savedOrCompleted = new Set();
    const queuedIds = new Set();

    masteryData?.subjects?.forEach((sub) => {
      studiedSubjects.add(sub.name.toLowerCase());
      sub.topics?.forEach((t) => studiedSubjects.add((t.name || sub.name).toLowerCase()));
    });
    playlists?.forEach((p) => {
      p.focusSubjects?.forEach((s) => studiedSubjects.add(s.toLowerCase()));
      p.resourceIds?.forEach((id) => queuedIds.add(id));
    });
    Object.entries(userResources).forEach(([id, status]) => {
      if (status === "saved" || status === "completed") savedOrCompleted.add(id);
    });

    return resources
      .filter((r) => !savedOrCompleted.has(r.id) && !queuedIds.has(r.id))
      .map((r) => {
        let score = 0;
        const reasons = [];
        const rSubs = (r.subjects || []).map((s) => s.toLowerCase());
        const expanded = new Set(rSubs);
        rSubs.forEach((s) => (SUBJECT_ALIASES[s] || []).forEach((a) => expanded.add(a)));
        expanded.forEach((s) => {
          if (weakSet.has(s)) { score += 15; if (!reasons.some((x) => x.includes("struggling"))) reasons.push(`You're struggling with ${s}`); }
          else if (studiedSubjects.has(s)) { score += 6; if (reasons.length < 2) reasons.push(`Matches your ${s} studies`); }
        });
        playlists?.forEach((p) => {
          const focus = (p.focusSubjects || []).map((s) => s.toLowerCase());
          if (focus.some((f) => expanded.has(f))) { score += 4; if (reasons.length < 2) reasons.push(`Fits "${p.name}"`); }
        });
        if (r.difficulty === "beginner" && weakSet.size > 0) score += 2;
        score += (r.rating || 4) * 0.5;
        return { ...r, score, reasons };
      })
      .filter((r) => r.score > 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [resources, userResources, masteryData, playlists, weakSubjects]);

  if (!suggestions.length) return null;

  return (
    <motion.div className="rl-smart-panel" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      {/* Top shimmer line */}
      <div className="rl-smart-panel__shimmer" aria-hidden="true" />

      <div className="rl-smart-header" onClick={() => setExpanded((v) => !v)}>
        <div className="rl-smart-title">
          <span className="rl-smart-title__icon"><LuSparkles /></span>
          Smart Picks For You
          <span className="rl-smart-count">{suggestions.length}</span>
        </div>
        <div className="rl-smart-actions-top">
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: "spring", stiffness: 300 }}>
            <FaChevronDown size={11} />
          </motion.span>
          <button className="rl-icon-btn" onClick={(e) => { e.stopPropagation(); onDismiss(); }} aria-label="Dismiss">
            <FaTimes size={11} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="rl-smart-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            {suggestions.map((s, i) => {
              const tm = TYPE_META[s.type] || TYPE_META.article;
              return (
                <motion.div
                  key={s.id}
                  className="rl-smart-row"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, type: "spring", stiffness: 300 }}
                >
                  <div className="rl-smart-rank">#{i + 1}</div>
                  <div className="rl-smart-info">
                    <p className="rl-smart-title-text">{s.title}</p>
                    <p className="rl-smart-why">{s.reasons.join(" · ")} · {tm.label}</p>
                    <div className="rl-smart-meta">
                      <StarRating value={s.rating || 4.5} />
                      <span className="rl-smart-diff">{DIFF_META[s.difficulty]?.label}</span>
                      <span className="rl-smart-dur">{s.duration}</span>
                    </div>
                  </div>
                  <div className="rl-smart-ctas">
                    <motion.button
                      className="rl-btn rl-btn--primary rl-btn--sm"
                      onClick={() => onAddToPlaylist(s)}
                      whileTap={{ scale: 0.94 }}
                    >
                      <FaListUl size={10} /> Queue
                    </motion.button>
                    <a className="rl-btn rl-btn--ghost rl-btn--sm" href={s.url} target="_blank" rel="noopener noreferrer">
                      <FaExternalLinkAlt size={10} />
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Playlist Picker Modal ──────────────────────────────────────── */
function PlaylistPickerModal({ resource, playlists, onClose, onAdd, onCreate }) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  return (
    <motion.div className="rl-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="rl-modal rl-modal--sm"
        initial={{ scale: 0.86, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rl-modal__header">
          <FaClipboardList className="rl-modal__icon" />
          <h2 className="rl-modal__title">Add to Playlist 🌸</h2>
          <button className="rl-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="rl-modal__sub">
          "{resource.title.slice(0, 50)}{resource.title.length > 50 ? "…" : ""}"
        </p>
        <div className="rl-playlist-list">
          {playlists.length === 0 && !creating && (
            <div className="rl-playlist-list__empty">No playlists yet, bestie! Create your first study path 🎯</div>
          )}
          {playlists.map((p) => (
            <motion.button key={p.id} className="rl-playlist-option" onClick={() => onAdd(p.id, resource.id)}
              whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}>
              <div className="rl-playlist-option__info">
                <span className="rl-playlist-option__name">{p.name}</span>
                <span className="rl-playlist-option__count">{p.resourceIds?.length || 0} items · {p.focusSubjects?.[0] || "General"}</span>
              </div>
              <div className="rl-playlist-option__progress">
                <div className="rl-playlist-option__bar" style={{
                  width: `${p.resourceIds?.length ? ((p.completedIds?.length || 0) / p.resourceIds.length) * 100 : 0}%`
                }} />
              </div>
            </motion.button>
          ))}
        </div>
        {creating ? (
          <div className="rl-create-playlist">
            <input className="rl-modal__input" placeholder="Playlist name (e.g. Calculus Bootcamp 🚀)"
              value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { onCreate(newName.trim(), resource.id); setCreating(false); setNewName(""); } }}
            />
            <div className="rl-modal__actions">
              <button className="rl-btn rl-btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="rl-btn rl-btn--primary" onClick={() => { if (newName.trim()) { onCreate(newName.trim(), resource.id); setCreating(false); setNewName(""); } }} disabled={!newName.trim()}>
                Create & Add ✨
              </button>
            </div>
          </div>
        ) : (
          <button className="rl-btn rl-btn--ghost rl-btn--full" onClick={() => setCreating(true)}>
            <FaPlus size={11} /> Create New Playlist
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Roadmap Tree Card ──────────────────────────────────────────── */
function RoadmapTree({ playlist, resources, onDelete, onToggleComplete, delay = 0 }) {
  const [expanded, setExpanded] = useState(true);

  const items = useMemo(() => {
    const map = new Map(resources.map((r) => [r.id, r]));
    return (playlist.resourceIds || []).map((id) => map.get(id)).filter(Boolean);
  }, [playlist.resourceIds, resources]);

  const total = playlist.resourceIds?.length || 0;
  const done  = playlist.completedIds?.length || 0;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  const statusLabel = pct === 100 ? "Complete!" : pct >= 75 ? "Almost there" : pct >= 50 ? "Growing" : pct > 0 ? "Started" : "Seed planted";

  return (
    <motion.div
      className="rl-roadmap"
      initial={{ opacity: 0, y: 28, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 250, damping: 22 }}
      layout
    >
      {/* Glowing top bar */}
      <div className="rl-roadmap__topbar" aria-hidden="true" />

      {/* Header */}
      <div className="rl-roadmap__header" onClick={() => setExpanded((v) => !v)}>
        {/* Flower garden (emoji + progress) */}
        <div className="rl-roadmap__garden">
          {total > 0 && [...Array(Math.min(total, 8))].map((_, i) => (
            <motion.div
              key={i}
              className={`rl-roadmap__flower${i < done ? " rl-roadmap__flower--bloom" : " rl-roadmap__flower--bud"}`}
              initial={false}
              animate={i < done
                ? { scale: [0.6, 1.25, 1], rotate: [0, -12, 0] }
                : { scale: 0.85 }
              }
              transition={{ delay: i * 0.07, type: "spring", stiffness: 320 }}
            >
              {i < done ? "🌸" : "🌱"}
            </motion.div>
          ))}
          {total === 0 && <span className="rl-roadmap__empty-garden">🌿</span>}
        </div>

        <div className="rl-roadmap__info">
          <h3 className="rl-roadmap__name">{playlist.name}</h3>
          <div className="rl-roadmap__meta">
            <span className="rl-roadmap__progress-text">{done}/{total} milestones</span>
            <span className="rl-roadmap__meta-sep">·</span>
            <span className="rl-roadmap__focus">{playlist.focusSubjects?.[0] || "General"}</span>
            <span className="rl-roadmap__meta-sep">·</span>
            <span className={`rl-roadmap__status-badge${pct === 100 ? " rl-roadmap__status-badge--done" : ""}`}>
              <GrowthStageSVG pct={pct} className="rl-roadmap__status-svg" />
              {statusLabel}
            </span>
          </div>
        </div>

        <motion.div
          className="rl-roadmap__expand-btn"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 320 }}
        >
          <FaChevronDown size={13} />
        </motion.div>
      </div>

      {/* Tree body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="rl-roadmap__tree"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          >
            {/* Trunk */}
            <div className="rl-roadmap__trunk" aria-hidden="true">
              <div className="rl-roadmap__trunk-line">
                <div className="rl-roadmap__trunk-orb" />
              </div>
            </div>

            {/* Branch nodes */}
            <div className="rl-roadmap__branches">
              {items.map((r, i) => {
                const isDone = playlist.completedIds?.includes(r.id);
                const isLast = i === items.length - 1;
                const tm     = TYPE_META[r.type] || TYPE_META.article;

                return (
                  <motion.div
                    key={r.id}
                    className={`rl-roadmap__node${isDone ? " rl-roadmap__node--done" : ""}`}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.09, type: "spring", stiffness: 300 }}
                  >
                    {/* Connector */}
                    <div className="rl-roadmap__connector">
                      <motion.div
                        className={`rl-roadmap__dot${isDone ? " rl-roadmap__dot--bloom" : ""}`}
                        animate={isDone ? {
                          scale: [1, 1.5, 1],
                          boxShadow: ["0 0 0 rgba(52,211,153,0)", "0 0 22px rgba(52,211,153,0.5)", "0 0 8px rgba(52,211,153,0.2)"],
                        } : {}}
                        transition={{ duration: 0.65 }}
                      >
                        {isDone
                          ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420 }}>🌸</motion.span>
                          : <span className="rl-roadmap__dot-inner" style={{ background: tm.color }} />
                        }
                      </motion.div>
                      {!isLast && <div className="rl-roadmap__vine" />}
                    </div>

                    {/* Node card */}
                    <motion.div
                      className="rl-roadmap__node-card"
                      whileHover={{ x: 5, scale: 1.012 }}
                      transition={{ type: "spring", stiffness: 420 }}
                    >
                      {/* Glow */}
                      <div
                        className="rl-roadmap__node-glow"
                        style={{
                          background: isDone
                            ? "radial-gradient(circle at 25% 50%, rgba(52,211,153,0.10), transparent 65%)"
                            : "radial-gradient(circle at 25% 50%, rgba(168,85,247,0.06), transparent 65%)",
                        }}
                      />

                      <div className="rl-roadmap__node-top">
                        <span className="rl-roadmap__node-badge" style={{ color: tm.color }}>
                          {tm.icon} {tm.label}
                        </span>
                        {/* Complete toggle */}
                        <motion.button
                          className={`rl-roadmap__check${isDone ? " rl-roadmap__check--done" : ""}`}
                          onClick={() => onToggleComplete(playlist.id, r.id)}
                          whileTap={{ scale: 0.82 }}
                          whileHover={{ scale: 1.12 }}
                          aria-label={isDone ? "Mark incomplete" : "Complete milestone"}
                        >
                          {isDone
                            ? <motion.div initial={{ rotate: 0 }} animate={{ rotate: [0, -18, 18, 0] }} transition={{ duration: 0.55 }}>🌸</motion.div>
                            : <div className="rl-roadmap__check-ring" />
                          }
                        </motion.button>
                      </div>

                      <h4 className={`rl-roadmap__node-title${isDone ? " rl-roadmap__node-title--done" : ""}`}>
                        {r.title}
                      </h4>

                      <div className="rl-roadmap__node-meta">
                        <span className="rl-roadmap__node-diff">{DIFF_META[r.difficulty]?.label}</span>
                        <span className="rl-roadmap__node-dur">{r.duration}</span>
                        <StarRating value={r.rating || 4.5} />
                      </div>

                      {r.subjects?.length > 0 && (
                        <div className="rl-roadmap__node-subjects">
                          {r.subjects.slice(0, 2).map((s) => (
                            <span key={s} className="rl-roadmap__subject-petal">{s}</span>
                          ))}
                        </div>
                      )}

                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rl-roadmap__node-link"
                        onClick={() => logRecentView(r)}
                      >
                        <FaExternalLinkAlt size={10} /> Open Resource
                        {isDone && <span className="rl-roadmap__done-tag">Completed ✨</span>}
                      </a>
                    </motion.div>
                  </motion.div>
                );
              })}

              {items.length === 0 && (
                <div className="rl-roadmap__empty-branch">
                  <span className="rl-roadmap__empty-seed">🌰</span>
                  <p>No milestones yet. Add resources to grow your tree! 🌱</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="rl-roadmap__footer">
        <div className="rl-roadmap__progress-bar">
          <motion.div
            className="rl-roadmap__progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.3 }}
          />
        </div>
        <span className="rl-roadmap__pct-label">{pct}%</span>
        <motion.button
          className="rl-roadmap__delete"
          onClick={() => onDelete(playlist.id)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          <FaTrash size={10} /> Remove Path
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Add Resource Modal ─────────────────────────────────────────── */
function AddResourceModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: "", url: "", type: "article", subjects: "", difficulty: "beginner", duration: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim() || !form.url.trim()) { toast.error("Title and URL are required 🩷"); return; }
    setSaving(true);
    await onSave({
      ...form,
      subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      rating: 4.0,
      addedBy: "user",
    });
    setSaving(false);
  }

  return (
    <motion.div className="rl-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="rl-modal"
        initial={{ scale: 0.86, opacity: 0, y: 28 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rl-modal__header">
          <LuSparkles className="rl-modal__icon" />
          <h2 className="rl-modal__title">Add Resource ✨</h2>
          <button className="rl-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="rl-modal__grid">
          {[
            { key: "title", label: "Title", placeholder: "e.g. Khan Academy – Calculus", full: true },
            { key: "url",   label: "URL",   placeholder: "https://…", full: true },
          ].map(({ key, label, placeholder, full }) => (
            <div key={key} className={`rl-modal__field${full ? " rl-modal__field--full" : ""}`}>
              <label className="rl-modal__label">{label}</label>
              <input className="rl-modal__input" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
            </div>
          ))}
          <div className="rl-modal__field">
            <label className="rl-modal__label">Type</label>
            <select className="rl-modal__input" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {["video","article","course","tool"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="rl-modal__field">
            <label className="rl-modal__label">Difficulty</label>
            <select className="rl-modal__input" value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
              {["beginner","intermediate","advanced"].map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
          <div className="rl-modal__field">
            <label className="rl-modal__label">Duration</label>
            <input className="rl-modal__input" value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="e.g. 15 min" />
          </div>
          <div className="rl-modal__field">
            <label className="rl-modal__label">Subjects (comma sep.)</label>
            <input className="rl-modal__input" value={form.subjects} onChange={(e) => set("subjects", e.target.value)} placeholder="Math, Physics" />
          </div>
          <div className="rl-modal__field rl-modal__field--full">
            <label className="rl-modal__label">Tags (comma sep.)</label>
            <input className="rl-modal__input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="calculus, derivatives" />
          </div>
        </div>
        <div className="rl-modal__actions">
          <button className="rl-btn rl-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="rl-btn rl-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving… 🌸" : <><FaPlus /> Add Resource</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function ResourceLibrary() {
  const [resources,     setResources]     = useState([]);
  const [userResources, setUserResources] = useState({});
  const [playlists,     setPlaylists]     = useState([]);
  const [masteryData,   setMasteryData]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [showAdd,       setShowAdd]       = useState(false);
  const [showRec,       setShowRec]       = useState(true);
  const [playlistPick,  setPlaylistPick]  = useState(null);
  const [resourceNotes, setResourceNotes] = useState({});
  const [editingNote,   setEditingNote]   = useState(null);
  const [recent,        setRecent]        = useState([]);

  const [search,        setSearch]        = useState("");
  const [activeType,    setActiveType]    = useState("all");
  const [activeDiff,    setActiveDiff]    = useState("all");
  const [activeSubject, setActiveSubject] = useState("all");
  const [activeTab,     setActiveTab]     = useState("discover");
  const [sortBy,        setSortBy]        = useState("rating");

  const userId = auth?.currentUser?.uid;
  const searchRef = useRef(null);

  useEffect(() => { setRecent(getRecentViews()); }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
      if (e.key === "Escape") { setShowAdd(false); setPlaylistPick(null); setEditingNote(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const globalSnap = await getDocs(collection(db, "resources"));
      const global = globalSnap.docs.map((d) => ({ id: d.id, ...d.data(), scope: "global" }));
      const pSnap = await getDocs(collection(db, "users", userId, "resources"));
      const personal = pSnap.docs.map((d) => ({ id: d.id, ...d.data(), scope: "personal" }));
      const map = new Map();
      global.forEach((r) => map.set(r.id, r));
      personal.forEach((r) => map.set(r.id, r));
      let merged = [...map.values()];
      if (merged.length === 0) {
        const added = await Promise.all(SEED_RESOURCES.map((r) => addDoc(collection(db, "resources"), { ...r, createdAt: serverTimestamp() })));
        merged = SEED_RESOURCES.map((r, i) => ({ id: added[i].id, ...r, scope: "global" }));
      }
      setResources(merged);

      const uSnap = await getDocs(query(collection(db, "users", userId, "userResources"), where("userId", "==", userId)));
      const statusMap = {};
      uSnap.forEach((d) => { statusMap[d.data().resourceId] = d.data().status; });
      setUserResources(statusMap);

      const plSnap = await getDocs(collection(db, "users", userId, "playlists"));
      setPlaylists(plSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const mDoc = await getDoc(doc(db, "users", userId, "mastery", userId));
      if (mDoc.exists()) setMasteryData(mDoc.data());

      const noteSnap = await getDocs(collection(db, "users", userId, "resourceNotes"));
      const noteMap = {};
      noteSnap.forEach((d) => { noteMap[d.id] = d.data().note; });
      setResourceNotes(noteMap);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load resources 😿");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function setStatus(resource, status) {
    if (!userId) { toast.error("Sign in to save resources 🩷"); return; }
    const current = userResources[resource.id];
    if (current === status) {
      setUserResources((u) => { const n = { ...u }; delete n[resource.id]; return n; });
      const snap = await getDocs(query(collection(db, "users", userId, "userResources"), where("userId", "==", userId), where("resourceId", "==", resource.id)));
      snap.forEach((d) => deleteDoc(doc(db, "users", userId, "userResources", d.id)));
      return;
    }
    setUserResources((u) => ({ ...u, [resource.id]: status }));
    const snap = await getDocs(query(collection(db, "users", userId, "userResources"), where("userId", "==", userId), where("resourceId", "==", resource.id)));
    if (snap.empty) {
      await addDoc(collection(db, "users", userId, "userResources"), { userId, resourceId: resource.id, status, savedAt: serverTimestamp() });
    } else {
      snap.forEach((d) => updateDoc(doc(db, "users", userId, "userResources", d.id), { status }));
    }
    const msgs = { saved: "Saved for later! 🩷", completed: "Marked complete! 🌸", dismissed: "Dismissed" };
    toast.success(msgs[status] || "Updated ✨");
  }

  async function saveNote(resourceId, noteText) {
    if (!userId) return;
    await setDoc(doc(db, "users", userId, "resourceNotes", resourceId), { note: noteText, updatedAt: serverTimestamp() });
    setResourceNotes((prev) => ({ ...prev, [resourceId]: noteText }));
    setEditingNote(null);
    toast.success("Note saved 💛");
  }

  async function createPlaylist(name, firstResourceId) {
    if (!userId || !name) return;
    const newPl = {
      name, description: "",
      focusSubjects: resources.find((r) => r.id === firstResourceId)?.subjects || ["General"],
      resourceIds: firstResourceId ? [firstResourceId] : [],
      completedIds: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "users", userId, "playlists"), newPl);
    setPlaylists((prev) => [...prev, { id: ref.id, ...newPl }]);
    toast.success(`Playlist "${name}" created! 🎯`);
    setPlaylistPick(null);
  }

  async function addToPlaylist(playlistId, resourceId) {
    if (!userId) return;
    await updateDoc(doc(db, "users", userId, "playlists", playlistId), { resourceIds: arrayUnion(resourceId), updatedAt: serverTimestamp() });
    setPlaylists((prev) => prev.map((p) => p.id === playlistId ? { ...p, resourceIds: [...(p.resourceIds || []), resourceId] } : p));
    toast.success("Added to playlist ✨");
    setPlaylistPick(null);
  }

  async function togglePlaylistComplete(playlistId, resourceId) {
    if (!userId) return;
    const pl     = playlists.find((p) => p.id === playlistId);
    const isDone = pl?.completedIds?.includes(resourceId);
    const ref    = doc(db, "users", userId, "playlists", playlistId);
    if (isDone) {
      await updateDoc(ref, { completedIds: arrayRemove(resourceId), updatedAt: serverTimestamp() });
      setPlaylists((prev) => prev.map((p) => p.id === playlistId ? { ...p, completedIds: (p.completedIds || []).filter((id) => id !== resourceId) } : p));
    } else {
      await updateDoc(ref, { completedIds: arrayUnion(resourceId), updatedAt: serverTimestamp() });
      setPlaylists((prev) => prev.map((p) => p.id === playlistId ? { ...p, completedIds: [...(p.completedIds || []), resourceId] } : p));
      toast.success("Milestone bloomed! 🌸");
    }
  }

  async function deletePlaylist(id) {
    if (!userId) return;
    await deleteDoc(doc(db, "users", userId, "playlists", id));
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    toast.success("Playlist removed 🌿");
  }

  async function handleAdd(data) {
    try {
      const ref = await addDoc(collection(db, "users", userId, "resources"), { ...data, userId, createdAt: serverTimestamp() });
      setResources((prev) => [{ id: ref.id, ...data, scope: "personal" }, ...prev]);
      setShowAdd(false);
      toast.success("Resource added! 🌟");
    } catch { toast.error("Failed to save resource 😿"); }
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, "users", userId, "resources", id));
      setResources((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resource removed 🗑️");
    } catch { toast.error("Couldn't delete 😿"); }
  }

  const allSubjects = useMemo(() => {
    const set = new Set();
    resources.forEach((r) => r.subjects?.forEach((s) => set.add(s)));
    return ["all", ...set];
  }, [resources]);

  const weakSubjectsForBridge = useMemo(() => {
    const weak = new Set();
    masteryData?.subjects?.forEach((sub) => {
      sub.topics?.forEach((t) => { if ((t.confidence || 1) <= 4) { weak.add(sub.name); if (t.name) weak.add(t.name); } });
    });
    return [...weak];
  }, [masteryData]);

  const myResourceCount = useMemo(() => resources.filter((r) => r.userId === userId).length, [resources, userId]);

  const filtered = useMemo(() => {
    let list = resources.filter((r) => userResources[r.id] !== "dismissed");
    if (activeTab === "saved")       list = list.filter((r) => userResources[r.id] === "saved");
    if (activeTab === "completed")   list = list.filter((r) => userResources[r.id] === "completed");
    if (activeTab === "myresources") list = list.filter((r) => r.userId === userId);
    if (activeType    !== "all") list = list.filter((r) => r.type === activeType);
    if (activeDiff    !== "all") list = list.filter((r) => r.difficulty === activeDiff);
    if (activeSubject !== "all") list = list.filter((r) => r.subjects?.includes(activeSubject));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.includes(q)) ||
        r.subjects?.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (sortBy === "rating") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sortBy === "newest") list = [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return list;
  }, [resources, userResources, activeTab, activeType, activeDiff, activeSubject, search, sortBy, userId]);

  const savedCount     = Object.values(userResources).filter((s) => s === "saved").length;
  const completedCount = Object.values(userResources).filter((s) => s === "completed").length;

  const TABS = [
    { key: "discover",    label: "Discover",     icon: <LuZap />,           count: null },
    { key: "saved",       label: "Saved",        icon: <FaHeart />,         count: savedCount },
    { key: "completed",   label: "Completed",    icon: <FaCheck />,         count: completedCount },
    { key: "myresources", label: "My Resources", icon: <FaUser />,          count: myResourceCount },
    { key: "playlists",   label: "My Paths",     icon: <FaClipboardList />, count: playlists.length },
    { key: "web",         label: "Find More",    icon: <FaSearch />,        count: null },
  ];

  const showGrid = activeTab !== "playlists" && activeTab !== "web";

  return (
    <div className="rl-page">
      {/* Ambient background */}
      <div className="rl-bg" aria-hidden="true">
        <div className="rl-bg__blob rl-bg__blob--1" />
        <div className="rl-bg__blob rl-bg__blob--2" />
        <div className="rl-bg__blob rl-bg__blob--3" />
        <div className="rl-bg__grid" />
      </div>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <motion.div
        className="rl-hero"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <div className="rl-hero__left">
          <motion.div
            className="rl-hero__icon-wrap"
            whileHover={{ scale: 1.08, rotate: -4 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <LuBookMarked />
            <div className="rl-hero__icon-ring" />
          </motion.div>
          <div>
            <h1 className="rl-hero__title">
              Resource Library
              <motion.span
                className="rl-hero__sparkle"
                animate={{ rotate: [0, 14, -8, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <LuSparkles />
              </motion.span>
            </h1>
            <p className="rl-hero__sub">Curated free resources matched to your study journey ✨</p>
          </div>
        </div>

        <div className="rl-hero__counters">
          {[
            { val: resources.length,  label: "Resources",  color: "pink" },
            { val: savedCount,        label: "Saved",      color: "purple" },
            { val: completedCount,    label: "Completed",  color: "mint" },
            { val: playlists.length,  label: "Playlists",  color: "rose" },
          ].map(({ val, label, color }) => (
            <motion.div
              key={label}
              className={`rl-counter rl-counter--${color}`}
              whileHover={{ scale: 1.06, y: -3 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <span className="rl-counter__val">{val}</span>
              <span className="rl-counter__label">{label}</span>
            </motion.div>
          ))}
        </div>

        <HeroDecoration />
      </motion.div>

      {/* ── Smart Recommender ─────────────────────────────────────── */}
      <AnimatePresence>
        {showRec && activeTab === "discover" && (
          <SmartRecommender
            resources={resources} userResources={userResources}
            masteryData={masteryData} playlists={playlists}
            onDismiss={() => setShowRec(false)}
            onAddToPlaylist={(res) => setPlaylistPick(res)}
          />
        )}
      </AnimatePresence>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="rl-tabs">
        {TABS.map((tab) => (
          <motion.button
            key={tab.key}
            className={`rl-tab${activeTab === tab.key ? " rl-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            whileTap={{ scale: 0.95 }}
          >
            {tab.icon} {tab.label}
            {tab.count > 0 && (
              <motion.span
                className="rl-tab-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420 }}
              >
                {tab.count}
              </motion.span>
            )}
          </motion.button>
        ))}
        <div className="rl-tabs__spacer" />
        <motion.button
          className="rl-btn rl-btn--primary rl-btn--sm"
          onClick={() => setShowAdd(true)}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.04 }}
        >
          <FaPlus size={11} /> Add Resource
        </motion.button>
      </div>

      {/* ── Web Tab ──────────────────────────────────────────────── */}
      {activeTab === "web" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <WebSearchBridge weakSubjects={weakSubjectsForBridge} />
          <motion.div className="rl-empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <IllustrationEmpty tab="discover" />
            <h3 className="rl-empty__title">Search the wider web 🌐</h3>
            <p className="rl-empty__sub">
              Find resources on YouTube, Khan Academy, and more. When you find something great, add it for everyone! 🩷
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* ── Playlists Tab ─────────────────────────────────────────── */}
      {activeTab === "playlists" && (
        <motion.div className="rl-playlists-grid" layout>
          <AnimatePresence>
            {playlists.length === 0 ? (
              <motion.div
                className="rl-roadmap-empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ gridColumn: "1 / -1" }}
              >
                <motion.div
                  className="rl-roadmap-empty__garden"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  🌱🌿🍃
                </motion.div>
                <h3 className="rl-roadmap-empty__title">Your garden is empty, bestie</h3>
                <p className="rl-roadmap-empty__sub">
                  Plant your first learning path by saving resources and watching them bloom into flowers as you complete them! 🌸
                </p>
                <motion.button
                  className="rl-btn rl-btn--primary"
                  onClick={() => setActiveTab("discover")}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <LuZap /> Discover Resources
                </motion.button>
              </motion.div>
            ) : (
              playlists.map((p, i) => (
                <RoadmapTree
                  key={p.id}
                  playlist={p}
                  resources={resources}
                  onDelete={deletePlaylist}
                  onToggleComplete={togglePlaylistComplete}
                  delay={Math.min(i * 0.05, 0.3)}
                />
              ))
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Discover / Saved / Completed / My Resources ──────────── */}
      {showGrid && (
        <>
          {/* Recent bar */}
          {activeTab === "discover" && recent.length > 0 && (
            <motion.div className="rl-recent-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="rl-recent-label">⏱ Recently Viewed</span>
              <div className="rl-recent-chips">
                {recent.map((r) => (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="rl-recent-chip" onClick={() => logRecentView(r)}>
                    <span className="rl-recent-chip__dot" style={{ background: TYPE_META[r.type]?.color || "var(--pookie-pink)" }} />
                    {r.title.slice(0, 28)}{r.title.length > 28 ? "…" : ""}
                  </a>
                ))}
              </div>
            </motion.div>
          )}

          {/* Controls */}
          <div className="rl-controls">
            <div className="rl-search-wrap">
              <FaSearch className="rl-search-wrap__icon" />
              <input
                ref={searchRef}
                className="rl-search"
                placeholder="Search resources, subjects, tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {!search && <span className="rl-search-shortcut">Press /</span>}
              {search && (
                <motion.button
                  className="rl-search-wrap__clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  whileTap={{ scale: 0.85 }}
                >
                  <FaTimes />
                </motion.button>
              )}
            </div>

            <div className="rl-filter-row">
              <div className="rl-filter-group">
                {TYPES.map((t) => (
                  <motion.button
                    key={t.key}
                    className={`rl-filter-chip${activeType === t.key ? " rl-filter-chip--active" : ""}`}
                    onClick={() => setActiveType(t.key)}
                    whileTap={{ scale: 0.94 }}
                  >
                    {t.icon} {t.label}
                  </motion.button>
                ))}
              </div>
              <div className="rl-filter-group rl-filter-group--right">
                <select className="rl-select" value={activeDiff} onChange={(e) => setActiveDiff(e.target.value)}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d === "all" ? "All levels" : DIFF_META[d].label}</option>)}
                </select>
                <select className="rl-select" value={activeSubject} onChange={(e) => setActiveSubject(e.target.value)}>
                  {allSubjects.map((s) => <option key={s} value={s}>{s === "all" ? "All subjects" : s}</option>)}
                </select>
                <select className="rl-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="rating">⭐ Top Rated</option>
                  <option value="newest">✨ Newest</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rl-results-count">
            {loading ? "Loading your resources… 🌸" : `${filtered.length} resource${filtered.length !== 1 ? "s" : ""}`}
            {search && <span> matching "<em>{search}</em>"</span>}
          </div>

          {loading ? (
            <div className="rl-grid">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="rl-skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div className="rl-empty" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <IllustrationEmpty tab={activeTab} />
              <h3 className="rl-empty__title">
                {activeTab === "saved" ? "Nothing saved yet 🩷" :
                 activeTab === "completed" ? "Nothing completed yet 🌱" :
                 activeTab === "myresources" ? "No personal resources yet ✨" :
                 "No resources found 🔍"}
              </h3>
              <p className="rl-empty__sub">
                {activeTab === "discover" ? "Try adjusting your filters, or add a new resource! 🌟" :
                 activeTab === "myresources" ? "Add resources you discover on the web and build your own collection. 📚" :
                 "Save or complete some resources first 💜"}
              </p>
              {(activeTab === "discover" || activeTab === "myresources") && (
                <motion.button
                  className="rl-btn rl-btn--primary"
                  onClick={() => setShowAdd(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaPlus /> Add First Resource
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div className="rl-grid" layout>
              <AnimatePresence mode="popLayout">
                {filtered.map((r, i) => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    userStatus={userResources[r.id]}
                    onSave={(res)          => setStatus(res, "saved")}
                    onComplete={(res)      => setStatus(res, "completed")}
                    onDismiss={(res)       => setStatus(res, "dismissed")}
                    onDelete={handleDelete}
                    onAddToPlaylist={(res) => setPlaylistPick(res)}
                    isOwner={r.userId === userId}
                    delay={Math.min(i * 0.035, 0.28)}
                    resourceNotes={resourceNotes}
                    editingNote={editingNote}
                    onEditNote={setEditingNote}
                    onSaveNote={saveNote}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <AddResourceModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
        )}
        {playlistPick && (
          <PlaylistPickerModal
            resource={playlistPick}
            playlists={playlists}
            onClose={() => setPlaylistPick(null)}
            onAdd={addToPlaylist}
            onCreate={createPlaylist}
          />
        )}
      </AnimatePresence>
    </div>
  );
}