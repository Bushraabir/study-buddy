// src/pages/Settings.jsx
// ─── Settings Page ────────────────────────────────────────────────────────────
// Handles: profile pic upload, display name, theme selection,
//          navigation visibility toggles, account deletion.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { auth, db, storage } from "../components/firebase";
import { onAuthStateChanged, updateProfile, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import {
  doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef, uploadBytes, getDownloadURL, deleteObject,
} from "firebase/storage";
import { Helmet } from "react-helmet-async";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { THEMES, THEME_IDS } from "../themes";
import { useTheme } from "../context/ThemeContext";
import "./Settings.css";

// ─── Nav pages list (mirrors TopBar NAV_GROUPS) ───────────────────────────────
export const NAV_PAGES = [
  { id: "session",      label: "Study Session",  icon: "⏱️",  path: "/session" },
  { id: "flashcards",   label: "Flashcards",     icon: "📇",  path: "/flash-cards" },
  { id: "notes",        label: "Notes",          icon: "📝",  path: "/notes" },
  { id: "plotgraph",    label: "2D Graphs",      icon: "📈",  path: "/plot-graph" },
  { id: "3dgraph",      label: "3D Graphs",      icon: "🧊",  path: "/3d-graph" },
  { id: "75hard",       label: "75 Hard",        icon: "💪",  path: "/75hard" },
  { id: "habits",       label: "Habit Stacking", icon: "🔥",  path: "/habit-stacking" },
  { id: "mastery",      label: "Mastery Tracker",icon: "🎯",  path: "/mastery" },
  { id: "environment",  label: "Environment",    icon: "🌍",  path: "/environment" },
  { id: "timecapsule",  label: "Time Capsule",   icon: "📦",  path: "/time-capsule" },
  { id: "resources",    label: "Resources",      icon: "📚",  path: "/resources" },
];

export const getDefaultVisibility = () =>
  Object.fromEntries(NAV_PAGES.map((p) => [p.id, true]));

// ─── Image compression helper ─────────────────────────────────────────────────
async function compressImage(file, maxPx = 800, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width  * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(resolve, "image/webp", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`st-toggle ${checked ? "on" : "off"} ${disabled ? "disabled" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="st-toggle-knob" />
    </button>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon, children, danger = false }) {
  return (
    <motion.div
      className={`st-section${danger ? " st-section--danger" : ""}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="st-section-head">
        <span className="st-section-icon">{icon}</span>
        <h2 className="st-section-title">{title}</h2>
      </div>
      <div className="st-section-body">{children}</div>
    </motion.div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────
function DeleteModal({ isOpen, onClose, user }) {
  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [loading,  setLoading]    = useState(false);

  const canDelete =
    confirm.toLowerCase() === "delete my account" &&
    password.length >= 6;

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    try {
      // Re-authenticate first
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
      // Delete Firestore doc
      await deleteDoc(doc(db, "users", user.uid));
      // Delete Firebase Auth account
      await deleteUser(user);
      toast.success("Account deleted. Goodbye! 💜");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password") toast.error("Wrong password");
      else toast.error("Deletion failed — try again");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="st-modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="st-modal"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{   scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="st-modal-head">
          <h3>⚠️ Delete Account</h3>
          <button className="st-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="st-modal-body">
          <p className="st-modal-warn">
            This permanently deletes your account, study data, flashcards, notes, and all records.
            <strong> This cannot be undone.</strong>
          </p>
          <label className="st-field-label">Current password</label>
          <input
            type="password"
            className="st-field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          <label className="st-field-label" style={{ marginTop: "0.85rem" }}>
            Type <strong>delete my account</strong> to confirm
          </label>
          <input
            type="text"
            className="st-field-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="delete my account"
          />
        </div>
        <div className="st-modal-footer">
          <button className="st-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="st-btn-delete"
            onClick={handleDelete}
            disabled={!canDelete || loading}
          >
            {loading ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Settings Component ──────────────────────────────────────────────────
export default function Settings() {
  const { themeId, setThemeId } = useTheme();

  const [user,         setUser]         = useState(null);
  const [userData,     setUserData]     = useState(null);
  const [loading,      setLoading]      = useState(true);

  // Profile
  const [displayName,  setDisplayName]  = useState("");
  const [nameChanged,  setNameChanged]  = useState(false);
  const [savingName,   setSavingName]   = useState(false);
  const [profilePicUrl,setProfilePicUrl]= useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Nav visibility
  const [pageVis,      setPageVis]      = useState(getDefaultVisibility());
  const [savingVis,    setSavingVis]    = useState(false);

  // Modals
  const [showDelete,   setShowDelete]   = useState(false);

  const unsubRef = useRef(null);
  const fileRef  = useRef(null);

  // ── Auth + snapshot ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setDisplayName(u.displayName || "");
        setProfilePicUrl(u.photoURL || null);
        unsubRef.current = onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserData(data);
            setPageVis(data.pageVisibility || getDefaultVisibility());
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
        unsubRef.current?.();
      }
    });
    return () => { unsub(); unsubRef.current?.(); };
  }, []);

  // ── Profile picture ────────────────────────────────────────────────────────
  const handlePicUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setUploadingPic(true);
    try {
      const blob    = await compressImage(file, 800, 0.85);
      const sRef    = storageRef(storage, `profilePics/${user.uid}`);
      await uploadBytes(sRef, blob || file, { contentType: "image/webp" });
      const url     = await getDownloadURL(sRef);
      await updateProfile(user, { photoURL: url });
      await updateDoc(doc(db, "users", user.uid), {
        photoURL:  url,
        updatedAt: serverTimestamp(),
      });
      setProfilePicUrl(url);
      toast.success("Profile photo updated! 📸");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed — try a smaller image");
    } finally {
      setUploadingPic(false);
    }
  }, [user]);

  const handleRemovePic = useCallback(async () => {
    if (!user || !profilePicUrl) return;
    try {
      const sRef = storageRef(storage, `profilePics/${user.uid}`);
      await deleteObject(sRef).catch(() => {}); // ignore if already gone
      await updateProfile(user, { photoURL: null });
      await updateDoc(doc(db, "users", user.uid), {
        photoURL:  null,
        updatedAt: serverTimestamp(),
      });
      setProfilePicUrl(null);
      toast.success("Photo removed");
    } catch {
      toast.error("Removal failed");
    }
  }, [user, profilePicUrl]);

  // ── Display name ───────────────────────────────────────────────────────────
  const handleNameSave = useCallback(async () => {
    if (!displayName.trim() || !user) return;
    setSavingName(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), {
        name:      displayName.trim(),
        updatedAt: serverTimestamp(),
      });
      setNameChanged(false);
      toast.success("Name updated! ✏️");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSavingName(false);
    }
  }, [displayName, user]);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const handleThemeChange = useCallback(async (id) => {
    await setThemeId(id); // ThemeContext handles Firestore write
    toast.success(`${THEMES[id].emoji} Theme set to ${THEMES[id].name}`);
  }, [setThemeId]);

  // ── Page visibility ────────────────────────────────────────────────────────
  const togglePage = useCallback(async (pageId) => {
    const next = { ...pageVis, [pageId]: !pageVis[pageId] };
    setPageVis(next);
    setSavingVis(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        pageVisibility: next,
        updatedAt:      serverTimestamp(),
      });
    } catch {
      toast.error("Couldn't save visibility");
    } finally {
      setSavingVis(false);
    }
  }, [pageVis, user]);

  const resetVisibility = useCallback(async () => {
    const def = getDefaultVisibility();
    setPageVis(def);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        pageVisibility: def,
        updatedAt:      serverTimestamp(),
      });
    }
    toast.success("Navigation reset to default");
  }, [user]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="st-page">
        <div className="st-container">
          {[200, 160, 280, 200].map((h, i) => (
            <div key={i} className="st-skeleton" style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="st-page">
        <div className="st-auth-gate">
          <div className="st-gate-lock">🔒</div>
          <h2>Sign in to access Settings</h2>
          <p>Your preferences are tied to your account.</p>
        </div>
      </div>
    );
  }

  const initials = (displayName || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="st-page">
      <Helmet>
        <title>Settings | StudyBuddy</title>
        <meta name="description" content="Customize your StudyBuddy profile, theme, and navigation preferences." />
      </Helmet>

      {/* Ambient orbs */}
      <div className="st-orb st-orb-1" />
      <div className="st-orb st-orb-2" />

      <div className="st-container">

        {/* Page header */}
        <motion.div
          className="st-page-header"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="st-page-title">⚙️ Settings</h1>
          <p className="st-page-sub">Customise your StudyBuddy experience</p>
        </motion.div>

        {/* ── 1. Profile Management ─────────────────────────────────────── */}
        <Section title="Profile Management" icon="👤">
          <div className="st-profile-grid">

            {/* Avatar column */}
            <div className="st-avatar-col">
              <div className="st-avatar-wrap">
                <div className="st-avatar-glow" />
                <div className="st-avatar">
                  {uploadingPic && (
                    <div className="st-avatar-loading">⏳</div>
                  )}
                  {profilePicUrl
                    ? <img src={profilePicUrl} alt="Profile" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    : <span>{initials}</span>}
                </div>
              </div>
              <div className="st-avatar-actions">
                <button
                  className="st-btn-upload"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPic}
                >
                  {uploadingPic ? "Uploading…" : "📷 Change photo"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePicUpload}
                />
                {profilePicUrl && (
                  <button className="st-btn-remove" onClick={handleRemovePic}>
                    🗑️ Remove
                  </button>
                )}
              </div>
            </div>

            {/* Fields column */}
            <div className="st-fields-col">
              {/* Display name */}
              <div className="st-field-group">
                <label className="st-field-label">Display Name</label>
                <div className="st-field-row">
                  <input
                    type="text"
                    className="st-field-input"
                    value={displayName}
                    maxLength={40}
                    onChange={(e) => { setDisplayName(e.target.value); setNameChanged(true); }}
                    placeholder="Your display name"
                    onKeyDown={(e) => e.key === "Enter" && nameChanged && handleNameSave()}
                  />
                  <button
                    className="st-btn-save"
                    onClick={handleNameSave}
                    disabled={!nameChanged || savingName}
                  >
                    {savingName ? "…" : "Save"}
                  </button>
                </div>
                <p className="st-field-hint">Shown on your profile and leaderboards</p>
              </div>

              {/* Email (read-only) */}
              <div className="st-field-group">
                <label className="st-field-label">Email</label>
                <div className="st-field-readonly">{user.email}</div>
                <p className="st-field-hint">Email cannot be changed here</p>
              </div>

              {/* Joined */}
              {userData?.createdAt && (
                <div className="st-field-group">
                  <label className="st-field-label">Member since</label>
                  <div className="st-field-readonly">
                    {(userData.createdAt.toDate?.() || new Date(userData.createdAt))
                      .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── 2. Theme Selection ────────────────────────────────────────── */}
        <Section title="Theme Selection" icon="🎨">
          <p className="st-section-desc">
            Pick a visual theme — your choice syncs across all your devices.
          </p>
          <div className="st-theme-grid">
            {THEME_IDS.map((id) => {
              const t       = THEMES[id];
              const active  = themeId === id;
              return (
                <motion.button
                  key={id}
                  className={`st-theme-card ${active ? "st-theme-card--active" : ""}`}
                  onClick={() => handleThemeChange(id)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{  scale: 0.97 }}
                  title={`Switch to ${t.name}`}
                >
                  {/* Mini preview */}
                  <div
                    className="st-theme-preview"
                    style={{ background: t.previewBg, border: `2px solid ${t.swatches[1]}22` }}
                  >
                    <div
                      className="st-theme-preview-card"
                      style={{ background: t.previewCard, borderRadius: t.vars["--pookie-radius"] }}
                    />
                    <div
                      className="st-theme-preview-bar"
                      style={{ background: t.previewAccent }}
                    />
                    <div
                      className="st-theme-preview-dot"
                      style={{ background: t.swatches[2] || t.previewAccent }}
                    />
                  </div>

                  {/* Swatches */}
                  <div className="st-theme-swatches">
                    {t.swatches.map((c, i) => (
                      <span key={i} className="st-swatch" style={{ background: c }} />
                    ))}
                  </div>

                  <div className="st-theme-info">
                    <span className="st-theme-emoji">{t.emoji}</span>
                    <span className="st-theme-name">{t.name}</span>
                  </div>
                  <p className="st-theme-desc">{t.description}</p>

                  {active && (
                    <motion.div
                      className="st-theme-check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      ✓
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </Section>

        {/* ── 3. Navigation Preferences ─────────────────────────────────── */}
        <Section title="Navigation Preferences" icon="🧭">
          <p className="st-section-desc">
            Hide pages you don't use to keep your navigation tidy.
            Hidden pages are still accessible via direct URL.
          </p>
          <div className="st-nav-grid">
            {NAV_PAGES.map((page) => (
              <div key={page.id} className="st-nav-item">
                <div className="st-nav-item-left">
                  <span className="st-nav-icon">{page.icon}</span>
                  <span className="st-nav-label">{page.label}</span>
                </div>
                <Toggle
                  checked={pageVis[page.id] !== false}
                  onChange={() => togglePage(page.id)}
                  disabled={savingVis}
                />
              </div>
            ))}
          </div>
          <div className="st-nav-footer">
            <button className="st-btn-reset" onClick={resetVisibility}>
              ↺ Reset to defaults
            </button>
            <span className="st-nav-active-count">
              {Object.values(pageVis).filter(Boolean).length} / {NAV_PAGES.length} pages visible
            </span>
          </div>
        </Section>

        {/* ── 4. Danger Zone ────────────────────────────────────────────── */}
        <Section title="Account Management" icon="🔐" danger>
          <div className="st-danger-box">
            <div className="st-danger-info">
              <h3 className="st-danger-title">⚠️ Delete Account</h3>
              <p className="st-danger-desc">
                Permanently deletes your account and all associated data including
                study sessions, flashcards, notes, and streaks. This cannot be undone.
              </p>
            </div>
            <button
              className="st-btn-delete-account"
              onClick={() => setShowDelete(true)}
            >
              Delete My Account
            </button>
          </div>
        </Section>

      </div>

      {/* Delete modal */}
      <AnimatePresence>
        {showDelete && (
          <DeleteModal
            isOpen
            onClose={() => setShowDelete(false)}
            user={user}
          />
        )}
      </AnimatePresence>
    </div>
  );
}