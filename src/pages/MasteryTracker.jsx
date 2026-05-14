import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  FaPlus, FaTimes, FaFire, FaCheck, FaChevronDown,
  FaChevronUp, FaTrash, FaStar, FaTrophy, FaHistory,
  FaEdit, FaSort, FaSearch, FaFilter, FaDownload,
  FaGripVertical, FaLock, FaUnlock, FaRegStar,
} from "react-icons/fa";
import {
  LuBrain, LuSparkles, LuFlame, LuTarget, LuTrendingUp,
  LuZap, LuRefreshCw, LuLayoutDashboard,
  LuFileText, LuX,
} from "react-icons/lu";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from "recharts";
import { db, auth } from "../components/firebase";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-hot-toast";
import Seo from "../components/Seo";
import "./MasteryTracker.css";

// ── Constants ────────────────────────────────────────────────────────────────
const CONFIDENCE_LEVELS = [
  { min: 1, max: 2,  label: "Just started",    color: "#fb7185", bg: "rgba(251,113,133,0.15)", emoji: "😰", gradient: "linear-gradient(135deg,#fb7185,#f43f5e)" },
  { min: 3, max: 4,  label: "Getting there",   color: "#fb923c", bg: "rgba(251,146,60,0.15)",  emoji: "😅", gradient: "linear-gradient(135deg,#fb923c,#f97316)" },
  { min: 5, max: 6,  label: "Making progress", color: "#facc15", bg: "rgba(250,204,21,0.15)",  emoji: "🤔", gradient: "linear-gradient(135deg,#facc15,#eab308)" },
  { min: 7, max: 8,  label: "Feeling good",    color: "#a855f7", bg: "rgba(168,85,247,0.15)",  emoji: "😊", gradient: "linear-gradient(135deg,#a855f7,#7c3aed)" },
  { min: 9, max: 10, label: "I've got this!",  color: "#34d399", bg: "rgba(52,211,153,0.15)",  emoji: "🔥", gradient: "linear-gradient(135deg,#34d399,#10b981)" },
];

const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "confidence_asc", label: "Weakest first" },
  { value: "confidence_desc", label: "Strongest first" },
  { value: "name", label: "A – Z" },
  { value: "recent", label: "Recently updated" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "struggling", label: "Struggling (1-3)" },
  { value: "progressing", label: "Progressing (4-6)" },
  { value: "mastered", label: "Mastered (7-10)" },
  { value: "understood", label: "Understood ⭐" },
];

function getLevel(score) {
  return CONFIDENCE_LEVELS.find((l) => score >= l.min && score <= l.max) || CONFIDENCE_LEVELS[0];
}

function getMasteryPct(topics) {
  if (!topics?.length) return 0;
  return Math.round(topics.reduce((acc, t) => acc + (t.confidence || 1), 0) / (topics.length * 10) * 100);
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Confetti ─────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    emoji: ["✨", "💜", "💖", "⭐", "🧠", "🎉", "🌟", "💫"][i % 8],
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 1.2 + Math.random() * 1,
    rotate: Math.random() > 0.5 ? 360 : -360,
  }));
  return (
    <div className="mt-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="mt-confetti-piece"
          style={{ left: `${p.x}%` }}
          initial={{ y: -20, opacity: 1, scale: 1 }}
          animate={{ y: "110vh", opacity: 0, rotate: p.rotate, scale: 0.5 }}
          transition={{ delay: p.delay, duration: p.dur, ease: "easeIn" }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}

// ── Animated Ring ─────────────────────────────────────────────────────────────
function Ring({ pct, size = 80, stroke = 8, color = "#a855f7", label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const safeColor = color || "#a855f7";
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img" aria-label={`${pct}% mastery`}>
      <defs>
        <linearGradient id={`ring-grad-${pct}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={safeColor} stopOpacity="0.6" />
          <stop offset="100%" stopColor={safeColor} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(168,85,247,0.10)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={`url(#ring-grad-${pct})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${(circ * pct) / 100} ${circ}` }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" fill="#f8fafc"
        style={{ fontSize: size * 0.2, fontWeight: 900, fontFamily: "Nunito, sans-serif" }}>
        {pct}%
      </text>
      {label && (
        <text x={size / 2} y={size / 2 + size * 0.19} textAnchor="middle" fill="#94a3b8"
          style={{ fontSize: size * 0.14, fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>
          {label}
        </text>
      )}
    </svg>
  );
}

// ── Trend chart tooltip ───────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const lv = getLevel(payload[0]?.value || 1);
  return (
    <div className="mt-chart-tooltip">
      <p className="mt-tt-label">{label}</p>
      <p className="mt-tt-val" style={{ color: lv.color }}>
        {lv.emoji} {payload[0].value}/10 — {lv.label}
      </p>
    </div>
  );
}

// ── Heat cell (topic card) ────────────────────────────────────────────────────
function HeatCell({ topic, onClick, onDelete, dragHandle }) {
  const level = getLevel(topic.confidence || 1);
  const [hovering, setHovering] = useState(false);

  return (
    <motion.div
      className="mt-heat-cell"
      style={{ background: level.bg, borderColor: hovering ? level.color : `${level.color}44` }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      layout
    >
      {dragHandle && (
        <div className="mt-heat-drag" title="Drag to reorder">
          <FaGripVertical size={10} />
        </div>
      )}
      <button
        className="mt-heat-main"
        onClick={() => onClick(topic)}
        aria-label={`Rate ${topic.name}: currently ${topic.confidence}/10`}
      >
        <span className="mt-heat-emoji">{level.emoji}</span>
        <span className="mt-heat-name">{topic.name}</span>
        <div className="mt-heat-footer">
          <span className="mt-heat-score" style={{ color: level.color }}>{topic.confidence}/10</span>
          {topic.understoodAt && (
            <FaStar size={9} color="#fbbf24" aria-label="Understood" />
          )}
        </div>
        {topic.history?.length > 1 && (() => {
          const prev = topic.history[topic.history.length - 2]?.confidence;
          const curr = topic.confidence;
          const diff = curr - (prev || curr);
          if (diff === 0) return null;
          return (
            <span className="mt-heat-trend" style={{ color: diff > 0 ? "#34d399" : "#fb7185" }}>
              {diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`}
            </span>
          );
        })()}
      </button>
      <AnimatePresence>
        {hovering && (
          <motion.button
            className="mt-heat-delete"
            onClick={(e) => { e.stopPropagation(); onDelete(topic.id); }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            aria-label={`Delete topic ${topic.name}`}
          >
            <FaTimes size={9} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Confidence modal ──────────────────────────────────────────────────────────
function ConfidenceModal({ topic, subjectName, onSave, onClose }) {
  const [val, setVal] = useState(topic.confidence || 5);
  const [understood, setUnderstood] = useState(!!topic.understoodAt);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState("rate"); // "rate" | "history"
  const level = getLevel(val);

  const chartData = useMemo(() => {
    return (topic.history || []).map((h, i) => ({
      name: formatDate(h.date) || `Session ${i + 1}`,
      confidence: h.confidence,
    }));
  }, [topic.history]);

  return (
    <motion.div
      className="mt-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Rate confidence for ${topic.name}`}
    >
      <motion.div
        className="mt-modal"
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mt-modal-header">
          <div>
            <p className="mt-modal-subject">{subjectName}</p>
            <h3 className="mt-modal-topic">{topic.name}</h3>
            {topic.understoodAt && (
              <p className="mt-modal-understood-date">
                <FaStar size={10} color="#fbbf24" /> Understood on {formatDate(topic.understoodAt)}
              </p>
            )}
          </div>
          <button className="mt-modal-close" onClick={onClose} aria-label="Close">
            <FaTimes size={13} />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-modal-tabs" role="tablist">
          {["rate", "history"].map((t) => (
            <button
              key={t}
              className={`mt-modal-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
              role="tab"
              aria-selected={tab === t}
            >
              {t === "rate" ? <><LuTarget size={13} /> Rate</> : <><FaHistory size={11} /> History</>}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "rate" ? (
            <motion.div
              key="rate"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="mt-modal-panel"
            >
              {/* Level display */}
              <motion.div
                className="mt-slider-display"
                style={{ background: level.bg, borderColor: `${level.color}55` }}
                animate={{ background: level.bg, borderColor: `${level.color}55` }}
                transition={{ duration: 0.3 }}
              >
                <motion.span
                  className="mt-slider-emoji"
                  key={level.emoji}
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                >
                  {level.emoji}
                </motion.span>
                <div>
                  <motion.p
                    className="mt-slider-score"
                    style={{ color: level.color }}
                    key={val}
                    initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    {val} / 10
                  </motion.p>
                  <p className="mt-slider-label">{level.label}</p>
                </div>
                <div className="mt-slider-mini-bar">
                  <motion.div
                    className="mt-slider-mini-fill"
                    style={{ background: level.gradient }}
                    animate={{ width: `${val * 10}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>

              {/* Range slider */}
              <div className="mt-slider-wrap">
                <input
                  type="range" min={1} max={10} value={val}
                  onChange={(e) => setVal(Number(e.target.value))}
                  className="mt-slider"
                  style={{ "--thumb-color": level.color }}
                  aria-label="Confidence rating"
                  aria-valuemin={1} aria-valuemax={10} aria-valuenow={val}
                />
                <div className="mt-slider-ticks" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`mt-tick-btn${val === i + 1 ? " active" : ""}`}
                      style={{ color: val === i + 1 ? level.color : "var(--pookie-muted)" }}
                      onClick={() => setVal(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="mt-note-wrap">
                <textarea
                  className="mt-note-input"
                  placeholder="Optional note — what made it click? (or what's still confusing?) 💭"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={300}
                />
                {note.length > 0 && (
                  <span className="mt-note-count">{note.length}/300</span>
                )}
              </div>

              {/* Understood button */}
              <motion.button
                className={`mt-understood-btn${understood ? " active" : ""}`}
                onClick={() => setUnderstood((v) => !v)}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.975 }}
                aria-pressed={understood}
              >
                <LuSparkles size={15} />
                {understood ? "Marked as understood! 🎉" : "I finally understood this! 💡"}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="mt-modal-panel"
            >
              {chartData.length < 2 ? (
                <div className="mt-no-history">
                  <LuBarChart2 size={28} color="var(--pookie-muted)" />
                  <p>Rate this topic a few times to see your progress trend!</p>
                </div>
              ) : (
                <div className="mt-trend-chart">
                  <p className="mt-chart-title">Confidence over time</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone" dataKey="confidence"
                        stroke="#a855f7" strokeWidth={2.5}
                        fill="url(#chartGrad)"
                        dot={{ fill: "#a855f7", r: 4, strokeWidth: 2, stroke: "#0f0f23" }}
                        activeDot={{ r: 6, fill: "#f472b6" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Raw history list */}
              {topic.history?.length > 0 && (
                <div className="mt-history-list">
                  {[...topic.history].reverse().slice(0, 8).map((h, i) => {
                    const lv = getLevel(h.confidence);
                    return (
                      <div key={i} className="mt-history-item">
                        <span className="mt-history-emoji">{lv.emoji}</span>
                        <span className="mt-history-conf" style={{ color: lv.color }}>{h.confidence}/10</span>
                        <span className="mt-history-date">{formatDate(h.date)}</span>
                        {h.note && <span className="mt-history-note">"{h.note}"</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="mt-modal-actions">
          <button className="mt-btn-ghost" onClick={onClose}>Cancel</button>
          <motion.button
            className="mt-btn-primary"
            onClick={() => onSave(val, understood, note)}
            whileTap={{ scale: 0.95 }}
          >
            <FaCheck size={12} /> Save Rating
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Subject card ──────────────────────────────────────────────────────────────
function SubjectCard({
  subject, onTopicClick, onAddTopic, onDeleteSubject,
  onDeleteTopic, onEditSubject, expanded, onToggle,
  sortBy, filterBy,
}) {
  const [newTopic, setNewTopic] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(subject.name);
  const [topics, setTopics] = useState(subject.topics || []);
  const inputRef = useRef(null);

  // Sync topics when subject changes externally
  useEffect(() => {
    setTopics(subject.topics || []);
  }, [subject.topics]);

  const filteredTopics = useMemo(() => {
    let list = [...topics];
    // Filter
    if (filterBy === "struggling") list = list.filter((t) => t.confidence <= 3);
    else if (filterBy === "progressing") list = list.filter((t) => t.confidence >= 4 && t.confidence <= 6);
    else if (filterBy === "mastered") list = list.filter((t) => t.confidence >= 7);
    else if (filterBy === "understood") list = list.filter((t) => t.understoodAt);
    // Sort
    if (sortBy === "confidence_asc") list.sort((a, b) => (a.confidence || 1) - (b.confidence || 1));
    else if (sortBy === "confidence_desc") list.sort((a, b) => (b.confidence || 1) - (a.confidence || 1));
    else if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "recent") {
      list.sort((a, b) => {
        const aDate = a.history?.slice(-1)[0]?.date || 0;
        const bDate = b.history?.slice(-1)[0]?.date || 0;
        return new Date(bDate) - new Date(aDate);
      });
    }
    return list;
  }, [topics, sortBy, filterBy]);

  const pct = getMasteryPct(topics);
  const topLevel = getLevel(Math.max(1, Math.round(pct / 10)));

  function handleAddTopic(e) {
    e.preventDefault();
    const name = newTopic.trim();
    if (!name) return;
    onAddTopic(subject.id, name);
    setNewTopic("");
    setShowAdd(false);
  }

  function handleEditSave() {
    if (editName.trim() && editName.trim() !== subject.name) {
      onEditSubject(subject.id, editName.trim());
    }
    setEditing(false);
  }

  const understood = topics.filter((t) => t.understoodAt).length;

  return (
    <motion.div
      className="mt-subject-card"
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
    >
      {/* Card header */}
      <div className="mt-card-header">
        <div
          className="mt-card-header-left"
          onClick={onToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onToggle()}
          aria-expanded={expanded}
        >
          <Ring pct={pct} size={62} stroke={6} color={topLevel.color} />
          <div className="mt-card-title-wrap">
            {editing ? (
              <input
                className="mt-inline-edit"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleEditSave}
                onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditing(false); }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                aria-label="Edit subject name"
              />
            ) : (
              <h3 className="mt-card-title">{subject.name}</h3>
            )}
            <div className="mt-card-badges">
              <span className="mt-badge" style={{ background: "rgba(168,85,247,0.12)", color: "var(--pookie-purple)" }}>
                {topics.length} topic{topics.length !== 1 ? "s" : ""}
              </span>
              {understood > 0 && (
                <span className="mt-badge" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
                  <FaStar size={9} /> {understood} understood
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-card-actions">
          <button className="mt-icon-btn" onClick={(e) => { e.stopPropagation(); setShowAdd((v) => !v); }}
            title="Add topic" aria-label="Add topic">
            <FaPlus size={11} />
          </button>
          <button className="mt-icon-btn" onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Rename subject" aria-label="Rename subject">
            <FaEdit size={11} />
          </button>
          <button className="mt-icon-btn mt-icon-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDeleteSubject(subject.id); }}
            title="Delete subject" aria-label="Delete subject">
            <FaTrash size={11} />
          </button>
          <button className="mt-icon-btn" onClick={onToggle} aria-label={expanded ? "Collapse" : "Expand"}>
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
              <FaChevronDown size={11} />
            </motion.span>
          </button>
        </div>
      </div>

      {/* Add topic form */}
      <AnimatePresence>
        {showAdd && (
          <motion.form
            className="mt-add-topic-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAddTopic}
          >
            <input
              ref={inputRef}
              className="mt-input"
              placeholder="New topic (e.g. Integration by Parts)"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              autoFocus
              maxLength={80}
              aria-label="New topic name"
            />
            <button type="submit" className="mt-btn-primary" disabled={!newTopic.trim()}>Add</button>
            <button type="button" className="mt-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Topics heatmap */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            {filteredTopics.length === 0 && topics.length === 0 ? (
              <div className="mt-empty-topics">
                <LuBrain size={24} color="var(--pookie-muted)" />
                <p>No topics yet — add one above to start rating your confidence!</p>
              </div>
            ) : filteredTopics.length === 0 ? (
              <div className="mt-empty-topics">
                <FaFilter size={18} color="var(--pookie-muted)" />
                <p>No topics match this filter.</p>
              </div>
            ) : (
              <div className="mt-heatmap">
                {filteredTopics.map((t) => (
                  <HeatCell
                    key={t.id}
                    topic={t}
                    onClick={(topic) => onTopicClick(subject, topic)}
                    onDelete={(topicId) => onDeleteTopic(subject.id, topicId)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Overview radar chart ──────────────────────────────────────────────────────
function OverviewRadar({ subjects }) {
  const data = useMemo(() =>
    subjects.slice(0, 8).map((s) => ({
      subject: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
      mastery: getMasteryPct(s.topics),
    })),
    [subjects]
  );

  if (subjects.length < 3) return null;

  return (
    <div className="mt-radar-wrap">
      <p className="mt-section-label">
        <LuBarChart2 size={14} /> Overview
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(168,85,247,0.15)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} />
          <Radar
            name="Mastery" dataKey="mastery" stroke="#a855f7" fill="#a855f7"
            fillOpacity={0.2} strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MasteryTracker() {
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [subjects, setSubjects]     = useState([]);
  const [expanded, setExpanded]     = useState({});
  const [modalData, setModalData]   = useState(null);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [saving, setSaving]         = useState(false);
  const [confetti, setConfetti]     = useState(false);
  const [search, setSearch]         = useState("");
  const [sortBy, setSortBy]         = useState("default");
  const [filterBy, setFilterBy]     = useState("all");
  const [showRadar, setShowRadar]   = useState(false);
  const [view, setView]             = useState("grid"); // "grid" | "list"
  const saveTimerRef = useRef(null);

  // ── Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return unsub;
  }, []);

  // ── Firestore real-time listener ──
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const ref = doc(db, "users", user.uid, "mastery", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSubjects(snap.data().subjects || []);
        } else {
          setSubjects([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Mastery snapshot error:", err);
        toast.error("Couldn't load your mastery data 💔");
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  // ── Debounced persist ──
  const persist = useCallback(
    async (updated) => {
      if (!user) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await setDoc(
            doc(db, "users", user.uid, "mastery", user.uid),
            { userId: user.uid, subjects: updated, updatedAt: serverTimestamp() },
            { merge: true }
          );
        } catch (err) {
          console.error("Persist error:", err);
          toast.error("Autosave failed — check your connection 😓");
        }
      }, 800);
    },
    [user ]
  );

  // ── Handlers ──
  async function handleAddSubject(e) {
    e.preventDefault();
    const name = newSubject.trim();
    if (!name) return;
    setSaving(true);
    const newSub = { id: generateId(), name, topics: [], createdAt: new Date().toISOString() };
    const updated = [...subjects, newSub];
    setSubjects(updated);
    setExpanded((p) => ({ ...p, [newSub.id]: true }));
    await persist(updated);
    setNewSubject("");
    setShowAddSub(false);
    setSaving(false);
    toast.success(`"${name}" added! 🧠`);
  }

  async function handleDeleteSubject(subId) {
    const sub = subjects.find((s) => s.id === subId);
    const updated = subjects.filter((s) => s.id !== subId);
    setSubjects(updated);
    await persist(updated);
    toast.success(`"${sub?.name}" removed`);
  }

  async function handleEditSubject(subId, newName) {
    const updated = subjects.map((s) => s.id === subId ? { ...s, name: newName } : s);
    setSubjects(updated);
    await persist(updated);
    toast.success("Subject renamed ✏️");
  }

  async function handleAddTopic(subId, topicName) {
    const newTopic = {
      id: generateId(),
      name: topicName,
      confidence: 1,
      history: [],
      understoodAt: null,
      createdAt: new Date().toISOString(),
    };
    const updated = subjects.map((s) =>
      s.id === subId ? { ...s, topics: [...(s.topics || []), newTopic] } : s
    );
    setSubjects(updated);
    await persist(updated);
    toast.success("Topic added!");
  }

  async function handleDeleteTopic(subId, topicId) {
    const updated = subjects.map((s) =>
      s.id === subId
        ? { ...s, topics: (s.topics || []).filter((t) => t.id !== topicId) }
        : s
    );
    setSubjects(updated);
    await persist(updated);
    toast.success("Topic removed");
  }

  async function handleSaveConfidence(confidence, understood, note) {
    if (!modalData) return;
    const { subject, topic } = modalData;
    const now = new Date().toISOString();
    const histEntry = { date: now, confidence, ...(note.trim() ? { note: note.trim() } : {}) };
    const wasNewlyUnderstood = understood && !topic.understoodAt;

    const updated = subjects.map((s) => {
      if (s.id !== subject.id) return s;
      return {
        ...s,
        topics: (s.topics || []).map((t) => {
          if (t.id !== topic.id) return t;
          return {
            ...t,
            confidence,
            history: [...(t.history || []), histEntry],
            understoodAt: understood ? (t.understoodAt || now) : t.understoodAt,
          };
        }),
      };
    });

    setSubjects(updated);
    setModalData(null);
    await persist(updated);

    if (wasNewlyUnderstood) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3500);
      toast.success("You finally got it! 🎉 That feeling is EVERYTHING!", { duration: 4000 });
    } else {
      toast.success("Confidence updated 💜");
    }
  }

  // ── Expand all / collapse all ──
  function toggleAll(open) {
    const next = {};
    subjects.forEach((s) => { next[s.id] = open; });
    setExpanded(next);
  }

  // ── Filtered subjects ──
  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.topics || []).some((t) => t.name.toLowerCase().includes(q))
    );
  }, [subjects, search]);

  // ── Stats ──
  const stats = useMemo(() => {
    const totalTopics = subjects.reduce((a, s) => a + (s.topics?.length || 0), 0);
    const understoodCount = subjects.reduce(
      (a, s) => a + ((s.topics || []).filter((t) => t.understoodAt).length), 0
    );
    const overallPct = subjects.length
      ? Math.round(subjects.reduce((a, s) => a + getMasteryPct(s.topics), 0) / subjects.length)
      : 0;
    const weakTopics = subjects.reduce(
      (a, s) => a + ((s.topics || []).filter((t) => (t.confidence || 1) <= 3).length), 0
    );
    return { totalTopics, understoodCount, overallPct, weakTopics };
  }, [subjects]);

  // ── Unauthenticated ──
  if (!user && !loading) {
    return (
      <div className="mt-page">
        <Seo title="Mastery Tracker | StudyBuddy" />
        <div className="mt-gate">
          <div className="mt-gate-icon"><LuBrain size={36} /></div>
          <h2>Track your mastery</h2>
          <p>Build confidence heatmaps across every subject, topic by topic 🧠</p>
          <a href="/login" className="mt-btn-primary">Log in to start</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-loading">
        <motion.div
          animate={{ scale: [1, 1.18, 1], rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          style={{ fontSize: "3.5rem" }}
        >
          🧠
        </motion.div>
        <p>Loading your mastery map…</p>
      </div>
    );
  }

  return (
    <div className="mt-page">
      <Seo title="Mastery Tracker | StudyBuddy" description="Track confidence across subjects and topics" />
      <Confetti active={confetti} />

      {/* ── Header ── */}
      <motion.div
        className="mt-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className="mt-header-left">
          <div className="mt-header-icon">
            <LuBrain size={24} />
          </div>
          <div>
            <h1 className="mt-title">Mastery Tracker</h1>
            <p className="mt-subtitle">Rate your confidence per topic, watch yourself grow 🌱</p>
          </div>
        </div>
        <motion.button
          className="mt-btn-primary"
          onClick={() => setShowAddSub((v) => !v)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          <FaPlus size={12} /> Add Subject
        </motion.button>
      </motion.div>

      {/* ── Stats row ── */}
      <motion.div
        className="mt-stats-row"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { icon: <LuTarget size={17} />,    val: subjects.length,       label: "Subjects",   color: "var(--pookie-purple)" },
          { icon: <LuBrain size={17} />,     val: stats.totalTopics,     label: "Topics",     color: "var(--pookie-pink)" },
          { icon: <LuSparkles size={17} />,  val: stats.understoodCount, label: "Understood", color: "#34d399" },
          { icon: <LuTrendingUp size={17} />,val: `${stats.overallPct}%`,label: "Overall",    color: "#fbbf24" },
          { icon: <LuZap size={17} />,       val: stats.weakTopics,      label: "Need Work",  color: "#fb7185" },
        ].map((s, i) => (
          <motion.div
            key={i} className="mt-stat-card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            whileHover={{ scale: 1.03, borderColor: s.color }}
          >
            <span className="mt-stat-icon" style={{ color: s.color }}>{s.icon}</span>
            <span className="mt-stat-val" style={{ color: s.color }}>{s.val}</span>
            <span className="mt-stat-label">{s.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Add subject form ── */}
      <AnimatePresence>
        {showAddSub && (
          <motion.form
            className="mt-add-sub-form"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onSubmit={handleAddSubject}
          >
            <input
              className="mt-input mt-input--lg"
              placeholder="Subject name (e.g. Linear Algebra, Organic Chemistry…)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              autoFocus
              maxLength={60}
              aria-label="New subject name"
            />
            <button type="submit" className="mt-btn-primary" disabled={!newSubject.trim() || saving}>
              {saving ? "Saving…" : "Create"}
            </button>
            <button type="button" className="mt-btn-ghost" onClick={() => setShowAddSub(false)}>
              Cancel
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── Toolbar ── */}
      {subjects.length > 0 && (
        <div className="mt-toolbar">
          {/* Search */}
          <div className="mt-search-wrap">
            <FaSearch size={12} className="mt-search-icon" aria-hidden="true" />
            <input
              className="mt-search"
              placeholder="Search subjects or topics…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search subjects and topics"
            />
            {search && (
              <button className="mt-search-clear" onClick={() => setSearch("")} aria-label="Clear search">
                <FaTimes size={11} />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            className="mt-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort topics"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Filter */}
          <select
            className="mt-select"
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            aria-label="Filter topics"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Expand/Collapse */}
          <div className="mt-toolbar-group">
            <button className="mt-icon-btn" onClick={() => toggleAll(true)} title="Expand all" aria-label="Expand all">
              <FaChevronDown size={11} />
            </button>
            <button className="mt-icon-btn" onClick={() => toggleAll(false)} title="Collapse all" aria-label="Collapse all">
              <FaChevronUp size={11} />
            </button>
          </div>

          {/* Radar toggle */}
          {subjects.length >= 3 && (
            <button
              className={`mt-icon-btn${showRadar ? " active" : ""}`}
              onClick={() => setShowRadar((v) => !v)}
              title="Toggle overview radar"
              aria-label="Toggle radar chart"
              aria-pressed={showRadar}
            >
              <LuBarChart2 size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Radar overview ── */}
      <AnimatePresence>
        {showRadar && subjects.length >= 3 && (
          <motion.div
            className="mt-radar-card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <OverviewRadar subjects={subjects} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Legend ── */}
      {subjects.length > 0 && (
        <div className="mt-legend" role="list" aria-label="Confidence level legend">
          {CONFIDENCE_LEVELS.map((l) => (
            <div key={l.min} className="mt-legend-item" role="listitem">
              <span className="mt-legend-dot" style={{ background: l.color }} aria-hidden="true" />
              <span>{l.emoji} {l.label} ({l.min}–{l.max})</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Subject list ── */}
      {filteredSubjects.length === 0 && !loading ? (
        <motion.div
          className="mt-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {subjects.length === 0 ? (
            <>
              <div className="mt-empty-icon">🧠</div>
              <h3>No subjects yet, bestie</h3>
              <p>Add your first subject to start building your mastery heatmap!</p>
              <motion.button
                className="mt-btn-primary"
                onClick={() => setShowAddSub(true)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <FaPlus size={12} /> Add your first subject
              </motion.button>
            </>
          ) : (
            <>
              <div className="mt-empty-icon">🔍</div>
              <h3>No results found</h3>
              <p>Try a different search term or clear the filter.</p>
              <button className="mt-btn-ghost" onClick={() => { setSearch(""); setFilterBy("all"); }}>
                <LuX size={12} /> Clear filters
              </button>
            </>
          )}
        </motion.div>
      ) : (
        <div className="mt-subjects-list">
          <AnimatePresence>
            {filteredSubjects.map((sub) => (
              <SubjectCard
                key={sub.id}
                subject={sub}
                expanded={!!expanded[sub.id]}
                onToggle={() => setExpanded((p) => ({ ...p, [sub.id]: !p[sub.id] }))}
                onTopicClick={(subject, topic) => setModalData({ subject, topic })}
                onAddTopic={handleAddTopic}
                onDeleteSubject={handleDeleteSubject}
                onDeleteTopic={handleDeleteTopic}
                onEditSubject={handleEditSubject}
                sortBy={sortBy}
                filterBy={filterBy}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Confidence modal ── */}
      <AnimatePresence>
        {modalData && (
          <ConfidenceModal
            topic={modalData.topic}
            subjectName={modalData.subject.name}
            onSave={handleSaveConfidence}
            onClose={() => setModalData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}