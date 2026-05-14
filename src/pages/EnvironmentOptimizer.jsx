import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMapPin, FiPlus, FiX, FiTrendingUp, FiClock, FiZap,
  FiChevronRight, FiEdit2, FiTrash2, FiWifi, FiVolume2,
  FiSun, FiMoon, FiStar, FiBarChart2, FiCheck, FiAlertCircle,
} from "react-icons/fi";
import {
  MdLocalLibrary, MdCoffee, MdHome, MdPark, MdLocationOn,
} from "react-icons/md";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../components/firebase";
import toast from "react-hot-toast";
import "./EnvironmentOptimizer.css";

// ─── constants ──────────────────────────────────────────────────────────────

const ENV_TYPES = [
  { value: "library",  label: "Library",  Icon: MdLocalLibrary, color: "#a855f7" },
  { value: "cafe",     label: "Café",     Icon: MdCoffee,       color: "#f472b6" },
  { value: "home",     label: "Home",     Icon: MdHome,         color: "#fb7185" },
  { value: "outdoor",  label: "Outdoor",  Icon: MdPark,         color: "#34d399" },
  { value: "other",    label: "Other",    Icon: MdLocationOn,   color: "#60a5fa" },
];

const AVAILABLE_TAGS = [
  { value: "quiet",    Icon: FiVolume2 },
  { value: "bright",   Icon: FiSun     },
  { value: "wifi",     Icon: FiWifi    },
  { value: "evening",  Icon: FiMoon    },
  { value: "morning",  Icon: FiSun     },
  { value: "busy",     Icon: FiZap     },
];

const EMPTY_FORM = {
  name: "",
  type: "library",
  tags: [],
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function focusLabel(score) {
  if (score >= 80) return { text: "Peak Focus",   cls: "peak"   };
  if (score >= 55) return { text: "Good Focus",   cls: "good"   };
  if (score >= 30) return { text: "Decent",       cls: "decent" };
  return              { text: "Distracting",   cls: "low"    };
}

function typeInfo(typeValue) {
  return ENV_TYPES.find((t) => t.value === typeValue) ?? ENV_TYPES[4];
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

/** Animated ring that fills based on 0-100 score */
function FocusRing({ score = 0, size = 64 }) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const { cls } = focusLabel(score);

  return (
    <svg className={`eo-ring eo-ring--${cls}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="eo-ring__track" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        className="eo-ring__fill"
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ "--circ": circ, "--dash": dash }}
      />
      <text x="50%" y="54%" textAnchor="middle" className="eo-ring__text">{score}</text>
    </svg>
  );
}

/** Single environment card */
function EnvCard({ env, onEdit, onDelete, isTop }) {
  const { Icon, color } = typeInfo(env.type);
  const { text: flabel, cls: fcls } = focusLabel(env.focusScore ?? 0);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <motion.div
      layout
      className={`eo-card ${isTop ? "eo-card--top" : ""}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
    >
      {isTop && (
        <span className="eo-card__crown" title="Best focus spot">
          <FiStar /> Top Spot
        </span>
      )}

      {/* header */}
      <div className="eo-card__header">
        <span className="eo-card__icon" style={{ "--env-color": color }}>
          <Icon size={20} />
        </span>
        <div className="eo-card__meta">
          <h3 className="eo-card__name">{env.name}</h3>
          <span className="eo-card__type">{typeInfo(env.type).label}</span>
        </div>
        <div className="eo-card__actions">
          <button className="eo-icon-btn" onClick={() => onEdit(env)} title="Edit">
            <FiEdit2 size={14} />
          </button>
          {confirmDel ? (
            <motion.div className="eo-del-confirm" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
              <button className="eo-icon-btn eo-icon-btn--danger" onClick={() => onDelete(env.id)} title="Confirm delete">
                <FiCheck size={14} />
              </button>
              <button className="eo-icon-btn" onClick={() => setConfirmDel(false)} title="Cancel">
                <FiX size={14} />
              </button>
            </motion.div>
          ) : (
            <button className="eo-icon-btn" onClick={() => setConfirmDel(true)} title="Delete">
              <FiTrash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ring + label */}
      <div className="eo-card__score-row">
        <FocusRing score={env.focusScore ?? 0} size={72} />
        <div className="eo-card__score-info">
          <span className={`eo-badge eo-badge--${fcls}`}>{flabel}</span>
          <p className="eo-card__sessions">
            <FiBarChart2 size={12} /> {env.sessionCount ?? 0} session{env.sessionCount !== 1 ? "s" : ""}
          </p>
          {env.avgDuration > 0 && (
            <p className="eo-card__duration">
              <FiClock size={12} /> avg {formatDuration(env.avgDuration)}
            </p>
          )}
        </div>
      </div>

      {/* tags */}
      {env.tags?.length > 0 && (
        <div className="eo-card__tags">
          {env.tags.map((t) => {
            const tag = AVAILABLE_TAGS.find((a) => a.value === t);
            return (
              <span key={t} className="eo-tag">
                {tag && <tag.Icon size={10} />} {t}
              </span>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/** Add / Edit modal */
function EnvModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function toggleTag(val) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(val) ? f.tags.filter((t) => t !== val) : [...f.tags, val],
    }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error("Give this spot a name!"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <motion.div
      className="eo-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="eo-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eo-modal__header">
          <h2>{initial ? "Edit" : "Add"} Study Spot</h2>
          <button className="eo-icon-btn" onClick={onClose}><FiX size={18} /></button>
        </div>

        <div className="eo-modal__body">
          {/* name */}
          <label className="eo-label">Spot Name</label>
          <input
            className="eo-input"
            placeholder="e.g. Library 3rd Floor"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={60}
          />

          {/* type */}
          <label className="eo-label">Environment Type</label>
          <div className="eo-type-grid">
            {ENV_TYPES.map(({ value, label, Icon, color }) => (
              <button
                key={value}
                className={`eo-type-btn ${form.type === value ? "eo-type-btn--active" : ""}`}
                style={{ "--env-color": color }}
                onClick={() => setForm((f) => ({ ...f, type: value }))}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* tags */}
          <label className="eo-label">Characteristics</label>
          <div className="eo-tag-grid">
            {AVAILABLE_TAGS.map(({ value, Icon }) => (
              <button
                key={value}
                className={`eo-tag-btn ${form.tags.includes(value) ? "eo-tag-btn--active" : ""}`}
                onClick={() => toggleTag(value)}
              >
                <Icon size={12} /> {value}
              </button>
            ))}
          </div>
        </div>

        <div className="eo-modal__footer">
          <button className="eo-btn eo-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="eo-btn eo-btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Spot"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Top insight banner */
function InsightBanner({ environments }) {
  const insight = useMemo(() => {
    if (!environments.length) return null;
    const sorted = [...environments].sort((a, b) => (b.focusScore ?? 0) - (a.focusScore ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (sorted.length === 1) {
      return { text: `You've logged ${best.sessionCount ?? 0} sessions at "${best.name}" — keep it up! ✨`, type: "info" };
    }

    const diff = (best.focusScore ?? 0) - (worst.focusScore ?? 0);
    if (diff >= 20) {
      return {
        text: `You focus ${diff}% better at "${best.name}" than "${worst.name}" — consider studying there more often 💜`,
        type: "tip",
      };
    }

    // time-of-day tip from tags
    const morningSpots = environments.filter((e) => e.tags?.includes("morning"));
    if (morningSpots.length) {
      return { text: `Morning vibes detected at "${morningSpots[0].name}" ☀️ — early birds catch the grades!`, type: "info" };
    }

    return { text: `You're tracking ${environments.length} study spots — data is your superpower 📊`, type: "info" };
  }, [environments]);

  if (!insight) return null;

  return (
    <motion.div
      className={`eo-insight eo-insight--${insight.type}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <FiZap size={15} />
      <p>{insight.text}</p>
    </motion.div>
  );
}

/** Mini bar comparison */
function ComparePanel({ environments }) {
  if (environments.length < 2) return null;
  const sorted = [...environments].sort((a, b) => (b.focusScore ?? 0) - (a.focusScore ?? 0)).slice(0, 5);
  const max = sorted[0].focusScore ?? 1;

  return (
    <motion.div
      className="eo-compare"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h3 className="eo-section-title"><FiTrendingUp size={14} /> Focus Comparison</h3>
      <div className="eo-compare__bars">
        {sorted.map((env, i) => {
          const pct = Math.round(((env.focusScore ?? 0) / max) * 100);
          const { color } = typeInfo(env.type);
          return (
            <div key={env.id} className="eo-compare__row">
              <span className="eo-compare__name">{env.name}</span>
              <div className="eo-compare__bar-wrap">
                <motion.div
                  className="eo-compare__bar"
                  style={{ "--bar-color": color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.07, duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <span className="eo-compare__score">{env.focusScore ?? 0}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function EnvironmentOptimizer() {
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null); // null | "add" | env object
  const [activeTab, setActiveTab]       = useState("spots"); // "spots" | "compare"

  const userId = auth.currentUser?.uid;

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchEnvironments = useCallback(async () => {
    if (!userId) return;
    try {
      const q    = query(collection(db, "studyEnvironments"), where("userId", "==", userId));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEnvironments(data);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load your study spots 😔");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchEnvironments(); }, [fetchEnvironments]);

  // ── recalc focus score from sessions ──────────────────────────────────────
  const recalcFocusScore = useCallback(async (envName) => {
    if (!userId) return null;
    try {
      const q = query(
        collection(db, "sessions"),
        where("userId",      "==", userId),
        where("environment", "==", envName),
      );
      const snap = await getDocs(q);
      if (snap.empty) return { score: 0, count: 0, avgDuration: 0 };

      const sessions = snap.docs.map((d) => d.data());
      const completed = sessions.filter((s) => s.completed).length;
      const score     = Math.round((completed / sessions.length) * 100);
      const avgDur    = Math.round(sessions.reduce((acc, s) => acc + (s.duration ?? 0), 0) / sessions.length);
      return { score, count: sessions.length, avgDuration: avgDur };
    } catch {
      return null;
    }
  }, [userId]);

  // ── save (add or update) ──────────────────────────────────────────────────
  const handleSave = useCallback(async (form) => {
    if (!userId) return;

    try {
      if (modal?.id) {
        // edit
        const ref = doc(db, "users", uid, "studyEnvironments", modal.id);
        await updateDoc(ref, {
          name:      form.name.trim(),
          type:      form.type,
          tags:      form.tags,
          updatedAt: serverTimestamp(),
        });
        toast.success("Spot updated ✨");
      } else {
        // add — try fetching live score from existing sessions
        const live = await recalcFocusScore(form.name.trim());
        await addDoc(collection(db, "studyEnvironments"), {
          userId,
          name:         form.name.trim(),
          type:         form.type,
          tags:         form.tags,
          focusScore:   live?.score       ?? 0,
          sessionCount: live?.count       ?? 0,
          avgDuration:  live?.avgDuration ?? 0,
          createdAt:    serverTimestamp(),
          updatedAt:    serverTimestamp(),
        });
        toast.success("New spot added 📍");
      }

      setModal(null);
      fetchEnvironments();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save — try again 💔");
    }
  }, [userId, modal, fetchEnvironments, recalcFocusScore]);

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    try {
      await deleteDoc(doc(db, "users", uid, "studyEnvironments", id));
      setEnvironments((prev) => prev.filter((e) => e.id !== id));
      toast.success("Spot removed 🗑️");
    } catch {
      toast.error("Couldn't delete — try again");
    }
  }, []);

  // ── refresh scores from session data ──────────────────────────────────────
  const handleRefreshScores = useCallback(async () => {
    if (!environments.length) return;
    const toastId = toast.loading("Recalculating focus scores…");
    try {
      await Promise.all(
        environments.map(async (env) => {
          const live = await recalcFocusScore(env.name);
          if (live && live.count > 0) {
            await updateDoc(doc(db, "users", uid, "studyEnvironments", env.id), {
              focusScore:   live.score,
              sessionCount: live.count,
              avgDuration:  live.avgDuration,
              updatedAt:    serverTimestamp(),
            });
          }
        }),
      );
      toast.success("Scores updated from your sessions 🎯", { id: toastId });
      fetchEnvironments();
    } catch {
      toast.error("Refresh failed", { id: toastId });
    }
  }, [environments, recalcFocusScore, fetchEnvironments]);

  // ── derived ────────────────────────────────────────────────────────────────
  const topEnvId = useMemo(() => {
    if (!environments.length) return null;
    return environments.reduce((best, e) => (e.focusScore ?? 0) > (best.focusScore ?? 0) ? e : best).id;
  }, [environments]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="eo-page">
      {/* page header */}
      <motion.div
        className="eo-hero"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="eo-hero__left">
          <span className="eo-hero__eyebrow"><FiMapPin size={13} /> Environment Optimizer</span>
          <h1 className="eo-hero__title">Where do you<br /><span className="eo-gradient-text">focus best?</span></h1>
          <p className="eo-hero__sub">Track your study spots and discover where your brain thrives the most 🧠</p>
        </div>
        <div className="eo-hero__actions">
          <button className="eo-btn eo-btn--ghost eo-btn--sm" onClick={handleRefreshScores} title="Sync with session data">
            <FiTrendingUp size={14} /> Refresh Scores
          </button>
          <button className="eo-btn eo-btn--primary" onClick={() => setModal("add")}>
            <FiPlus size={15} /> Add Spot
          </button>
        </div>
      </motion.div>

      {/* insight banner */}
      <InsightBanner environments={environments} />

      {/* tabs */}
      <div className="eo-tabs">
        {["spots", "compare"].map((tab) => (
          <button
            key={tab}
            className={`eo-tab ${activeTab === tab ? "eo-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "spots"   ? <><FiMapPin size={13} /> My Spots</>   : null}
            {tab === "compare" ? <><FiBarChart2 size={13} /> Compare</> : null}
          </button>
        ))}
      </div>

      {/* content */}
      <AnimatePresence mode="wait">
        {activeTab === "spots" && (
          <motion.div
            key="spots"
            className="eo-grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="eo-skeleton" />
              ))
            ) : environments.length === 0 ? (
              <EmptyState onAdd={() => setModal("add")} />
            ) : (
              <AnimatePresence>
                {environments.map((env) => (
                  <EnvCard
                    key={env.id}
                    env={env}
                    isTop={env.id === topEnvId && environments.length > 1}
                    onEdit={(e) => setModal(e)}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        )}

        {activeTab === "compare" && (
          <motion.div
            key="compare"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {environments.length < 2 ? (
              <div className="eo-empty-compare">
                <FiAlertCircle size={28} />
                <p>Add at least 2 study spots to compare 💡</p>
                <button className="eo-btn eo-btn--primary eo-btn--sm" onClick={() => { setActiveTab("spots"); setModal("add"); }}>
                  <FiPlus size={14} /> Add Spot
                </button>
              </div>
            ) : (
              <ComparePanel environments={environments} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* modal */}
      <AnimatePresence>
        {modal && (
          <EnvModal
            initial={modal === "add" ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <motion.div
      className="eo-empty"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="eo-empty__icon">📍</div>
      <h3>No spots logged yet, bestie!</h3>
      <p>Start tracking where you study to unlock focus insights ✨</p>
      <button className="eo-btn eo-btn--primary" onClick={onAdd}>
        <FiPlus size={15} /> Add Your First Spot
      </button>
    </motion.div>
  );
}