import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaLock, FaUnlock, FaEnvelope, FaEnvelopeOpen,
  FaStar, FaQuoteLeft, FaChevronDown, FaChevronUp,
} from "react-icons/fa";
import {
  LuSparkles, LuCalendar, LuPenLine, LuMailOpen,
  LuLock, LuTrash2, LuCheck, LuHourglass,
  LuRefreshCw, LuX,
} from "react-icons/lu";
import { db, auth } from "../components/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-hot-toast";

import "./TimeCapsule.css";

const CHALLENGE_TYPES = [
  { value: "7day",   label: "7-Day Spark",     emoji: "⚡", days: 7,   color: "#60a5fa", desc: "A week of focused intention" },
  { value: "21day",  label: "21-Day Habit",     emoji: "🌱", days: 21,  color: "#34d399", desc: "Build a lasting habit" },
  { value: "30day",  label: "30-Day Challenge", emoji: "🔥", days: 30,  color: "#fb923c", desc: "One month of growth" },
  { value: "75hard", label: "75 Hard",          emoji: "💪", days: 75,  color: "#a855f7", desc: "The ultimate discipline test" },
  { value: "100day", label: "100-Day Journey",  emoji: "🚀", days: 100, color: "#f472b6", desc: "Long-haul transformation" },
  { value: "custom", label: "Custom Date",      emoji: "📅", days: null, color: "#fbbf24", desc: "Choose your own delivery date" },
];

const PROMPT_TEMPLATES = [
  { emoji: "🌟", text: "Dear future me, I hope you've become the person you're working so hard to be right now…" },
  { emoji: "💪", text: "Hey you — did you actually do it? I'm writing this because I believe you can…" },
  { emoji: "🧠", text: "Right now I'm struggling with [subject]. By the time you read this, I hope you've mastered it…" },
  { emoji: "🎯", text: "My biggest goal right now is [goal]. Future me, please tell me you didn't give up…" },
  { emoji: "💌", text: "I want you to remember this moment — the uncertainty, the effort, the growth…" },
  { emoji: "🔥", text: "You started this challenge because [reason]. Don't forget why you began…" },
];

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch { return ""; }
}

function formatCountdown(deliverAt) {
  const now    = Date.now();
  const target = new Date(deliverAt).getTime();
  const diff   = target - now;
  if (diff <= 0) return null;
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0)  return { label: `${days}d ${hours}h remaining` };
  if (hours > 0) return { label: `${hours}h ${minutes}m remaining` };
  return { label: `${minutes}m remaining — almost time!` };
}

function isDelivered(capsule) {
  return new Date(capsule.deliverAt).getTime() <= Date.now();
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    emoji: ["💌", "✨", "💜", "💖", "⭐", "🎉", "🌟", "💫", "📬"][i % 9],
    x: Math.random() * 100,
    delay: Math.random() * 0.7,
    dur: 1.2 + Math.random() * 1.1,
    rot: Math.random() > 0.5 ? 360 : -360,
  }));
  return (
    <div className="tc-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="tc-confetti-piece"
          style={{ left: `${p.x}%` }}
          initial={{ y: -20, opacity: 1, scale: 1.2 }}
          animate={{ y: "110vh", opacity: 0, rotate: p.rot, scale: 0.4 }}
          transition={{ delay: p.delay, duration: p.dur, ease: "easeIn" }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}

// ── Countdown ring ────────────────────────────────────────────────────────────
function CountdownRing({ deliverAt, totalDays, size = 72, stroke = 7 }) {
  const now     = Date.now();
  const target  = new Date(deliverAt).getTime();
  const created = target - totalDays * 24 * 60 * 60 * 1000;
  const elapsed = now - created;
  const total   = target - created;
  const pct     = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  const r       = (size - stroke) / 2;
  const circ    = 2 * Math.PI * r;
  const remaining = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img" aria-label={`${remaining} days remaining`}>
      <defs>
        <linearGradient id="tcRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(168,85,247,0.10)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="url(#tcRingGrad)" strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${(circ * pct) / 100} ${circ}` }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" fill="#f8fafc"
        style={{ fontSize: size * 0.22, fontWeight: 900, fontFamily: "Nunito, sans-serif" }}>
        {remaining}
      </text>
      <text x={size / 2} y={size / 2 + size * 0.2} textAnchor="middle" fill="#94a3b8"
        style={{ fontSize: size * 0.14, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
        days
      </text>
    </svg>
  );
}

// ── Sealed envelope ───────────────────────────────────────────────────────────
function SealedEnvelope({ challengeType }) {
  const type = CHALLENGE_TYPES.find((c) => c.value === challengeType) || CHALLENGE_TYPES[2];
  return (
    <div className="tc-envelope" aria-hidden="true">
      <motion.div
        className="tc-env-body"
        style={{ borderColor: `${type.color}44` }}
        animate={{ y: [0, -3, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      >
        <div className="tc-env-flap" style={{ background: `linear-gradient(135deg, ${type.color}22, ${type.color}44)` }} />
        <div className="tc-env-seal" style={{ background: type.color }}>
          <span>{type.emoji}</span>
        </div>
        <div className="tc-env-lines">
          <span /><span /><span />
        </div>
      </motion.div>
      <div className="tc-env-shadow" />
    </div>
  );
}

// ── Writer modal ──────────────────────────────────────────────────────────────
function WriterModal({ onSave, onClose }) {
  const [step, setStep]             = useState(1);
  const [challengeType, setChType]  = useState("30day");
  const [customDate, setCustomDate] = useState("");
  const [content, setContent]       = useState("");
  const [charCount, setCharCount]   = useState(0);
  const [saving, setSaving]         = useState(false);
  const [showPrompts, setPrompts]   = useState(false);
  const textareaRef                 = useRef(null);

  const selectedChallenge = CHALLENGE_TYPES.find((c) => c.value === challengeType);

  const deliverAt = useMemo(() => {
    if (challengeType === "custom") {
      return customDate ? new Date(customDate).toISOString() : null;
    }
    const d = new Date();
    d.setDate(d.getDate() + selectedChallenge.days);
    return d.toISOString();
  }, [challengeType, customDate, selectedChallenge]);

  const totalDays = useMemo(() => {
    if (challengeType === "custom" && customDate) {
      return Math.max(1, Math.ceil((new Date(customDate) - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    return selectedChallenge?.days || 30;
  }, [challengeType, customDate, selectedChallenge]);

  function handlePrompt(text) {
    setContent((prev) => prev ? prev + "\n\n" + text : text);
    setCharCount((prev) => prev + (prev ? 2 + text.length : text.length));
    setPrompts(false);
    textareaRef.current?.focus();
  }

  function handleContentChange(e) {
    setContent(e.target.value);
    setCharCount(e.target.value.length);
  }

  async function handleSave() {
    setSaving(true);
    await onSave({ challengeType, content: content.trim(), deliverAt, totalDays });
    setSaving(false);
  }

  const canProceedStep1 = challengeType !== "custom" || (customDate && new Date(customDate) > new Date());
  const canProceedStep2 = content.trim().length >= 20;

  return (
    <motion.div
      className="pookie-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Write a time capsule letter"
    >
      <motion.div
        className="tc-writer-modal"
        initial={{ scale: 0.88, opacity: 0, y: 32 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 290, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div className="tc-steps" aria-label="Step indicator">
          {["Choose challenge", "Write letter", "Seal & send"].map((s, i) => (
            <div key={i} className={`tc-step${step > i + 1 ? " done" : step === i + 1 ? " active" : ""}`}>
              <div className="tc-step-dot">
                {step > i + 1 ? <LuCheck size={10} /> : i + 1}
              </div>
              <span className="tc-step-label">{s}</span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              className="tc-step-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="tc-modal-header">
                <h2 className="modal-title">When should future you read this?</h2>
                <p className="modal-sub">Pick a challenge to set your delivery date ✨</p>
              </div>

              <div className="tc-challenge-grid">
                {CHALLENGE_TYPES.map((c) => (
                  <motion.button
                    key={c.value}
                    className={`tc-challenge-btn${challengeType === c.value ? " active" : ""}`}
                    style={challengeType === c.value
                      ? { borderColor: c.color, background: `${c.color}18`, boxShadow: `0 0 0 1px ${c.color}40` }
                      : {}}
                    onClick={() => setChType(c.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    aria-pressed={challengeType === c.value}
                  >
                    <span className="tc-ch-emoji">{c.emoji}</span>
                    <div className="tc-ch-info">
                      <span className="tc-ch-name" style={challengeType === c.value ? { color: c.color } : {}}>
                        {c.label}
                      </span>
                      <span className="tc-ch-desc">{c.desc}</span>
                    </div>
                    {c.days && (
                      <span className="tc-ch-days" style={{ color: c.color }}>{c.days}d</span>
                    )}
                  </motion.button>
                ))}
              </div>

              {challengeType === "custom" && (
                <motion.div
                  className="tc-custom-date"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <label className="field-label">Delivery date</label>
                  <input
                    type="date"
                    className="field-input"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                    aria-label="Custom delivery date"
                  />
                </motion.div>
              )}

              {deliverAt && (
                <div className="tc-delivery-preview">
                  <LuCalendar size={14} color="var(--pookie-purple)" />
                  <span>Letter will be unlocked on <strong>{formatDate(deliverAt)}</strong></span>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <motion.button
                  className="btn-primary"
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  whileTap={{ scale: 0.96 }}
                >
                  Write letter <span>→</span>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              className="tc-step-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="tc-modal-header">
                <h2 className="modal-title">Write to future you 💌</h2>
                <p className="modal-sub">Be honest, be hopeful, be real. Future you is listening.</p>
              </div>

              <button
                className="tc-prompts-toggle"
                onClick={() => setPrompts((v) => !v)}
                aria-expanded={showPrompts}
              >
                <LuSparkles size={13} />
                Need inspiration? Try a prompt
                {showPrompts ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
              </button>

              <AnimatePresence>
                {showPrompts && (
                  <motion.div
                    className="tc-prompts-list"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    {PROMPT_TEMPLATES.map((p, i) => (
                      <button key={i} className="tc-prompt-item" onClick={() => handlePrompt(p.text)}>
                        <span>{p.emoji}</span>
                        <span>{p.text}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="tc-letter-wrap">
                <div className="tc-letter-header">
                  <span className="tc-letter-to">Dear Future Me,</span>
                  <span className="tc-letter-date">
                    {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  className="tc-letter-body"
                  placeholder="Start writing… what do you want future you to know? What are you feeling right now? What do you hope for?"
                  value={content}
                  onChange={handleContentChange}
                  maxLength={5000}
                  rows={10}
                  aria-label="Letter content"
                />
                <div className="tc-letter-footer">
                  <span className="tc-char-count" style={{ color: charCount > 4500 ? "#fb7185" : "var(--pookie-muted)" }}>
                    {charCount}/5000
                  </span>
                  {charCount < 20 && (
                    <span className="tc-min-note">Write at least 20 characters to continue</span>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <motion.button
                  className="btn-primary"
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  whileTap={{ scale: 0.96 }}
                >
                  Preview & seal <span>→</span>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              className="tc-step-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="tc-modal-header">
                <h2 className="modal-title">Ready to seal the capsule? 🔒</h2>
                <p className="modal-sub">Once sealed, you can't edit it — only open it on delivery day.</p>
              </div>

              <div className="tc-confirm-preview glass-card-sm">
                <SealedEnvelope challengeType={challengeType} />
                <div className="tc-confirm-details">
                  <div className="tc-confirm-row">
                    <span className="tc-confirm-label">Challenge</span>
                    <span className="tc-confirm-val">
                      {selectedChallenge?.emoji} {selectedChallenge?.label}
                    </span>
                  </div>
                  <div className="tc-confirm-row">
                    <span className="tc-confirm-label">Unlocks on</span>
                    <span className="tc-confirm-val" style={{ color: "var(--pookie-pink)" }}>
                      {formatDate(deliverAt)}
                    </span>
                  </div>
                  <div className="tc-confirm-row">
                    <span className="tc-confirm-label">Days sealed</span>
                    <span className="tc-confirm-val" style={{ color: "var(--pookie-purple)" }}>
                      {totalDays} days
                    </span>
                  </div>
                  <div className="tc-confirm-row">
                    <span className="tc-confirm-label">Length</span>
                    <span className="tc-confirm-val">{charCount} characters</span>
                  </div>
                </div>
              </div>

              <div className="tc-letter-snippet">
                <FaQuoteLeft size={14} color="var(--pookie-purple)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p>{content.slice(0, 160)}{content.length > 160 ? "…" : ""}</p>
              </div>

              <div className="modal-actions">
                <button className="btn-ghost" onClick={() => setStep(2)}>← Edit letter</button>
                <motion.button
                  className="btn-primary tc-btn-seal"
                  onClick={handleSave}
                  disabled={saving}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {saving ? (
                    <><LuRefreshCw size={13} className="pookie-spin" /> Sealing…</>
                  ) : (
                    <><LuLock size={13} /> Seal the capsule 💌</>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Open letter modal ─────────────────────────────────────────────────────────
function OpenLetterModal({ capsule, onClose, onDelete }) {
  const challenge = CHALLENGE_TYPES.find((c) => c.value === capsule.challengeType) || CHALLENGE_TYPES[2];
  const [showDelete, setShowDelete] = useState(false);

  return (
    <motion.div
      className="pookie-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Read time capsule letter"
    >
      <motion.div
        className="tc-open-modal"
        initial={{ scale: 0.88, opacity: 0, y: 32 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tc-open-header" style={{ borderBottomColor: `${challenge.color}33` }}>
          <div className="tc-open-from">
            <div className="tc-open-icon" style={{ background: `${challenge.color}20`, borderColor: `${challenge.color}44` }}>
              <FaEnvelopeOpen size={20} color={challenge.color} />
            </div>
            <div>
              <p className="tc-open-eyebrow" style={{ color: challenge.color }}>
                {challenge.emoji} {challenge.label} — Letter from your past self
              </p>
              <p className="tc-open-date">Written on {formatDate(capsule.createdAt)}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <LuX size={14} />
          </button>
        </div>

        <div className="tc-open-letter">
          <div className="tc-ol-salutation">Dear Future Me,</div>
          <div className="tc-ol-body">{capsule.content}</div>
          <div className="tc-ol-sign">
            <span>With love & hope,</span>
            <span className="tc-ol-signed">Past You · {formatDate(capsule.createdAt)}</span>
          </div>
        </div>

        <div className="tc-open-footer">
          <div className="tc-open-meta">
            <span>📬 Delivered on {formatDate(capsule.openedAt || new Date().toISOString())}</span>
            <span>⏳ Sealed for {capsule.totalDays} days</span>
          </div>
          <div className="tc-open-actions">
            {!showDelete ? (
              <button className="btn-ghost tc-btn-ghost--danger" onClick={() => setShowDelete(true)}>
                <LuTrash2 size={13} /> Archive
              </button>
            ) : (
              <div className="tc-delete-confirm">
                <span>Delete forever?</span>
                <button className="btn-ghost" onClick={() => setShowDelete(false)}>No</button>
                <button className="btn-danger" onClick={() => { onDelete(capsule.id); onClose(); }}>
                  Yes, delete
                </button>
              </div>
            )}
            <button className="btn-primary" onClick={onClose}>
              <LuCheck size={13} /> Close letter
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Capsule card ──────────────────────────────────────────────────────────────
function CapsuleCard({ capsule, onOpen, onDelete }) {
  const challenge = CHALLENGE_TYPES.find((c) => c.value === capsule.challengeType) || CHALLENGE_TYPES[2];
  const delivered = isDelivered(capsule);
  const countdown = !delivered ? formatCountdown(capsule.deliverAt) : null;
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      className={`tc-capsule-card${delivered ? " delivered" : " locked"}`}
      style={{
        borderColor: delivered ? `${challenge.color}55` : `${challenge.color}28`,
        boxShadow: hover && delivered ? `0 0 0 1px ${challenge.color}40, var(--pookie-shadow-h)` : undefined,
      }}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {delivered && hover && (
        <motion.div
          className="tc-card-glow"
          style={{ background: `radial-gradient(ellipse at center, ${challenge.color}18, transparent 70%)` }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        />
      )}

      <div
        className="pookie-badge"
        style={delivered
          ? { background: `${challenge.color}20`, color: challenge.color }
          : { background: "rgba(148,163,184,0.1)", color: "var(--pookie-muted)" }
        }
      >
        {delivered ? <><FaUnlock size={11} /> Delivered</> : <><LuLock size={11} /> Sealed</>}
      </div>

      <div className="tc-card-body">
        <div className="tc-card-visual">
          {delivered ? (
            <motion.div
              className="tc-delivered-icon"
              style={{ background: `${challenge.color}18`, borderColor: `${challenge.color}44` }}
              animate={hover ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              <FaEnvelopeOpen size={26} color={challenge.color} />
            </motion.div>
          ) : (
            <CountdownRing
              deliverAt={capsule.deliverAt}
              totalDays={capsule.totalDays}
              size={72}
              stroke={7}
            />
          )}
        </div>

        <div className="tc-card-info">
          <div className="tc-card-challenge" style={{ color: challenge.color }}>
            {challenge.emoji} {challenge.label}
          </div>
          <p className="tc-card-written">Written {formatDate(capsule.createdAt)}</p>

          {delivered ? (
            <p className="tc-card-unlocked">📬 Unlocked {formatDate(capsule.deliverAt)}</p>
          ) : countdown ? (
            <p className="tc-card-countdown">
              <LuHourglass size={12} /> {countdown.label}
            </p>
          ) : null}

          {delivered && capsule.content && (
            <p className="tc-card-snippet">
              "{capsule.content.slice(0, 80)}{capsule.content.length > 80 ? "…" : ""}"
            </p>
          )}

          {!delivered && (
            <p className="tc-card-locked-hint">
              🔒 You'll be able to read this on {formatDate(capsule.deliverAt)}
            </p>
          )}
        </div>
      </div>

      <div className="tc-card-actions">
        {delivered ? (
          <motion.button
            className="tc-btn-open"
            style={{ background: `linear-gradient(135deg, ${challenge.color}cc, ${challenge.color})` }}
            onClick={() => onOpen(capsule)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <FaEnvelopeOpen size={13} /> Open Letter
          </motion.button>
        ) : (
          <button className="tc-btn-sealed" disabled aria-label="Letter is sealed until delivery date">
            <LuLock size={12} /> Sealed until {formatDate(capsule.deliverAt)}
          </button>
        )}

        {delivered && (
          <button
            className="tc-btn-icon-danger"
            onClick={() => onDelete(capsule.id)}
            title="Delete capsule"
            aria-label="Delete capsule"
          >
            <LuTrash2 size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TimeCapsule() {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [capsules, setCapsules]   = useState([]);
  const [showWriter, setWriter]   = useState(false);
  const [openCapsule, setOpenCap] = useState(null);
  const [confetti, setConfetti]   = useState(false);
  const [tab, setTab]             = useState("all");
  const saveRef                   = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const ref = doc(db,  "timeCapsules", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setCapsules(snap.exists() ? snap.data().capsules || [] : []);
      setLoading(false);
    }, (err) => {
      console.error("TimeCapsule snapshot error:", err);
      toast.error("Couldn't load your capsules 💔");
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!capsules.length) return;
    const nowDelivered = capsules.filter((c) => isDelivered(c) && !c.openedAt && !c.notifiedDelivery);
    if (nowDelivered.length > 0) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 4000);
      toast.success(
        `📬 ${nowDelivered.length === 1 ? "A letter" : `${nowDelivered.length} letters`} from past you ${nowDelivered.length === 1 ? "has" : "have"} arrived!`,
        { duration: 5000 }
      );
      const updated = capsules.map((c) =>
        nowDelivered.find((d) => d.id === c.id) ? { ...c, notifiedDelivery: true } : c
      );
      persist(updated);
    }
  }, [capsules.length]);

  const persist = useCallback(async (updated) => {
    if (!user) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(db, "timeCapsules", user.uid),
          { userId: user.uid, capsules: updated, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.error("Persist error:", err);
        toast.error("Autosave failed — check your connection 😓");
      }
    }, 600);
  }, [user]);

  async function handleSaveCapsule(data) {
    const newCapsule = {
      id: generateId(),
      ...data,
      delivered: false,
      openedAt: null,
      notifiedDelivery: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...capsules, newCapsule];
    setCapsules(updated);
    setWriter(false);
    await persist(updated);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 3500);
    toast.success("💌 Capsule sealed! Future you will thank you.", { duration: 4000 });
  }

  async function handleOpenCapsule(capsule) {
    setOpenCap(capsule);
    if (!capsule.openedAt) {
      const updated = capsules.map((c) =>
        c.id === capsule.id ? { ...c, openedAt: new Date().toISOString(), delivered: true } : c
      );
      setCapsules(updated);
      await persist(updated);
    }
  }

  async function handleDeleteCapsule(id) {
    const updated = capsules.filter((c) => c.id !== id);
    setCapsules(updated);
    await persist(updated);
    toast.success("Capsule archived");
  }

  const filteredCapsules = useMemo(() => {
    const sorted = [...capsules].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (tab === "sealed")    return sorted.filter((c) => !isDelivered(c));
    if (tab === "delivered") return sorted.filter((c) => isDelivered(c));
    return sorted;
  }, [capsules, tab]);

  const stats = useMemo(() => ({
    total:     capsules.length,
    sealed:    capsules.filter((c) => !isDelivered(c)).length,
    delivered: capsules.filter((c) => isDelivered(c)).length,
    opened:    capsules.filter((c) => c.openedAt).length,
  }), [capsules]);

  if (!user && !loading) {
    return (
      <div className="tc-page">
      
        <div className="pookie-auth-gate">
          <div className="tc-gate-icon">💌</div>
          <h2>Letters to your future self</h2>
          <p>Seal a letter today. Open it when your challenge is done. Watch yourself grow. 🌱</p>
          <a href="/login" className="btn-primary">Log in to start</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pookie-loading">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ fontSize: "3.5rem" }}
        >
          💌
        </motion.div>
        <p>Opening the vault…</p>
      </div>
    );
  }

  return (
    <div className="tc-page">
      <Confetti active={confetti} />

      {/* Hero */}
      <motion.div
        className="tc-hero glass-card"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 24 }}
      >
        <div className="tc-hero-left">
          <div className="tc-hero-icon">
            <motion.span
              animate={{ rotate: [0, 5, -5, 0], y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              style={{ fontSize: "1.8rem", display: "block" }}
            >
              💌
            </motion.span>
          </div>
          <div>
            <h1 className="tc-title">Time Capsule</h1>
            <p className="tc-subtitle">Letters from past you, delivered to future you 🕰️</p>
          </div>
        </div>
        <motion.button
          className="btn-primary tc-btn-write"
          onClick={() => setWriter(true)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          <LuPenLine size={14} /> Write a Letter
        </motion.button>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="tc-stats-row"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
      >
        {[
          { val: stats.total,     label: "Letters",   color: "var(--pookie-purple)", icon: <FaEnvelope size={15} /> },
          { val: stats.sealed,    label: "Sealed",    color: "var(--pookie-pink)",   icon: <LuLock size={15} /> },
          { val: stats.delivered, label: "Delivered", color: "#34d399",              icon: <LuMailOpen size={15} /> },
          { val: stats.opened,    label: "Opened",    color: "#fbbf24",              icon: <FaStar size={15} /> },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="pookie-stat-card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            whileHover={{ scale: 1.04, borderColor: s.color }}
          >
            <span style={{ color: s.color }}>{s.icon}</span>
            <span className="pookie-stat-val" style={{ color: s.color }}>{s.val}</span>
            <span className="pookie-stat-label">{s.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <div className="tc-tabs pookie-tabs" role="tablist">
        {[
          { id: "all",       label: "All",       emoji: "📬", count: stats.total },
          { id: "sealed",    label: "Sealed",    emoji: "🔒", count: stats.sealed },
          { id: "delivered", label: "Delivered", emoji: "💌", count: stats.delivered },
        ].map((t) => (
          <button
            key={t.id}
            className={`pookie-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
            role="tab"
            aria-selected={tab === t.id}
          >
            {t.emoji} {t.label}
            {t.count > 0 && (
              <span className={`tc-tab-badge${tab === t.id ? " active" : ""}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {filteredCapsules.length === 0 ? (
          <motion.div
            key="empty"
            className="tc-empty glass-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {capsules.length === 0 ? (
              <>
                <div className="tc-empty-visual">
                  <SealedEnvelope challengeType="30day" />
                </div>
                <h3 className="pookie-display-title" style={{ fontSize: "1.5rem" }}>No letters yet, bestie</h3>
                <p>
                  Write your first letter to future you. Seal it with hope, open it with pride.
                  This is the most powerful kind of self-reflection. 💜
                </p>
                <motion.button
                  className="btn-primary"
                  onClick={() => setWriter(true)}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                >
                  <LuPenLine size={14} /> Write your first letter
                </motion.button>
              </>
            ) : tab === "sealed" ? (
              <>
                <div className="tc-empty-icon">🔓</div>
                <h3 className="pookie-display-title" style={{ fontSize: "1.5rem" }}>No sealed capsules</h3>
                <p>All your capsules have been delivered! Write a new one to start fresh.</p>
                <button className="btn-primary" onClick={() => setWriter(true)}>
                  <LuPenLine size={14} /> Write a new letter
                </button>
              </>
            ) : (
              <>
                <div className="tc-empty-icon">📭</div>
                <h3 className="pookie-display-title" style={{ fontSize: "1.5rem" }}>No delivered capsules yet</h3>
                <p>Your sealed letters will appear here when their delivery date arrives.</p>
                <button className="btn-ghost" onClick={() => setTab("sealed")}>
                  View sealed letters →
                </button>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="tc-capsules-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {tab !== "sealed" && stats.delivered > 0 && filteredCapsules.some(isDelivered) && (
              <motion.div
                className="tc-delivered-banner"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span>📬</span>
                <span>
                  {stats.delivered} letter{stats.delivered !== 1 ? "s" : ""} from past you {stats.delivered === 1 ? "is" : "are"} waiting — open {stats.delivered === 1 ? "it" : "them"} when you're ready 💜
                </span>
              </motion.div>
            )}

            <AnimatePresence>
              {filteredCapsules.map((capsule) => (
                <CapsuleCard
                  key={capsule.id}
                  capsule={capsule}
                  onOpen={handleOpenCapsule}
                  onDelete={handleDeleteCapsule}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showWriter && (
          <WriterModal onSave={handleSaveCapsule} onClose={() => setWriter(false)} />
        )}
        {openCapsule && (
          <OpenLetterModal
            capsule={openCapsule}
            onClose={() => setOpenCap(null)}
            onDelete={(id) => { handleDeleteCapsule(id); setOpenCap(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}