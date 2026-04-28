import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db, storage } from "../components/firebase";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTrash, FaRegHeart, FaHeart, FaThumbtack, FaArrowLeft,
  FaEdit, FaSave, FaSearch, FaPlus, FaTimes, FaProjectDiagram,
  FaImage, FaLink, FaTag, FaFolder, FaStar, FaEye,
  FaColumns, FaBars, FaChevronRight, FaChevronDown,
  FaFile, FaMarkdown, FaDownload,
} from "react-icons/fa";
import "./Notes.css";

/* ─── Wiki-link parser ──────────────────────────────────────────────────── */
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

function parseWikiLinks(text) {
  const links = [];
  let m;
  while ((m = WIKILINK_RE.exec(text)) !== null) links.push(m[1]);
  return links;
}

function renderWithWikiLinks(html, allNotes, onNoteClick) {
  // Replace [[Note Title]] with clickable spans
  return html.replace(WIKILINK_RE, (_, title) => {
    const target = allNotes.find(
      (n) => stripHtml(n.text).slice(0, 60).trim() === title.trim()
    );
    const cls = target ? "wiki-link" : "wiki-link wiki-link--missing";
    const id = target ? `data-noteid="${target.id}"` : "";
    return `<span class="${cls}" ${id} data-title="${title}">${title}</span>`;
  });
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || "";
}

/* ─── Graph View Component ──────────────────────────────────────────────── */
function GraphView({ notes, onSelectNote, selectedId }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!notes.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Build nodes & edges
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const nodes = notes.map((n, i) => ({
      id: n.id,
      label: stripHtml(n.text).slice(0, 22) || "Note",
      x: W / 2 + Math.cos((i / notes.length) * Math.PI * 2) * (W * 0.3),
      y: H / 2 + Math.sin((i / notes.length) * Math.PI * 2) * (H * 0.3),
      vx: 0, vy: 0,
      note: n,
    }));

    const edges = [];
    notes.forEach((n) => {
      parseWikiLinks(n.text).forEach((title) => {
        const target = notes.find(
          (t) => stripHtml(t.text).slice(0, 60).includes(title)
        );
        if (target) edges.push({ from: n.id, to: target.id });
      });
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;

    // Force simulation
    const simulate = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 2200 / (dist * dist);
          ns[i].vx -= (dx / dist) * force;
          ns[i].vy -= (dy / dist) * force;
          ns[j].vx += (dx / dist) * force;
          ns[j].vy += (dy / dist) * force;
        }
      }
      // Attraction along edges
      es.forEach(({ from, to }) => {
        const a = ns.find((n) => n.id === from);
        const b = ns.find((n) => n.id === to);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = dist * 0.015;
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force;
        b.vy -= (dy / dist) * force;
      });
      // Center gravity
      ns.forEach((n) => {
        n.vx += (W / 2 - n.x) * 0.008;
        n.vy += (H / 2 - n.y) * 0.008;
        n.vx *= 0.82; n.vy *= 0.82;
        if (!dragRef.current || dragRef.current.id !== n.id) {
          n.x += n.vx; n.y += n.vy;
        }
        n.x = Math.max(30, Math.min(W - 30, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      });

      // Draw
      ctx.clearRect(0, 0, W, H);

      // Edges
      es.forEach(({ from, to }) => {
        const a = ns.find((n) => n.id === from);
        const b = ns.find((n) => n.id === to);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(168,85,247,0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Nodes
      ns.forEach((n) => {
        const isSelected = n.id === selectedId;
        const r = isSelected ? 14 : 9;

        // Glow
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2.5);
        grad.addColorStop(0, isSelected ? "rgba(244,114,182,0.5)" : "rgba(168,85,247,0.3)");
        grad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#f472b6" : "#a855f7";
        ctx.shadowColor = isSelected ? "#f472b6" : "#a855f7";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.font = "11px Inter, sans-serif";
        ctx.fillStyle = "rgba(226,232,240,0.88)";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + r + 13);
      });

      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);

    // Click
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = nodesRef.current.find((n) => {
        const dx = n.x - mx; const dy = n.y - my;
        return Math.sqrt(dx * dx + dy * dy) < 18;
      });
      if (hit) onSelectNote(hit.note);
    };

    // Drag
    const handleMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = nodesRef.current.find((n) => {
        const dx = n.x - mx; const dy = n.y - my;
        return Math.sqrt(dx * dx + dy * dy) < 18;
      });
      if (hit) dragRef.current = hit;
    };
    const handleMouseMove = (e) => {
      if (!dragRef.current) return;
      const rect = canvas.getBoundingClientRect();
      dragRef.current.x = e.clientX - rect.left;
      dragRef.current.y = e.clientY - rect.top;
    };
    const handleMouseUp = () => { dragRef.current = null; };

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
    };
  }, [notes, selectedId, onSelectNote]);

  return (
    <div className="nb-graph-container">
      <div className="nb-graph-header">
        <FaProjectDiagram />
        <span>Knowledge Graph</span>
        <span className="nb-graph-count">{notes.length} notes · {
          notes.reduce((a, n) => a + parseWikiLinks(n.text).length, 0)
        } links</span>
      </div>
      <canvas ref={canvasRef} className="nb-graph-canvas" />
    </div>
  );
}

/* ─── Sidebar Tree ──────────────────────────────────────────────────────── */
function Sidebar({ notes, selectedNote, onSelect, searchTerm, setSearchTerm, onNewNote }) {
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(() =>
    notes.filter((n) =>
      stripHtml(n.text).toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [notes, searchTerm]
  );

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  return (
    <motion.aside
      className={`nb-sidebar${collapsed ? " nb-sidebar--collapsed" : ""}`}
      initial={false}
      animate={{ width: collapsed ? 48 : 260 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <div className="nb-sidebar-top">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className="nb-sidebar-search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <FaSearch className="nb-search-icon" />
              <input
                placeholder="Search notes…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="nb-search-input"
              />
              {searchTerm && (
                <button className="nb-search-clear" onClick={() => setSearchTerm("")}>
                  <FaTimes />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <button className="nb-sidebar-toggle" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? <FaChevronRight /> : <FaBars />}
        </button>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            className="nb-sidebar-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button className="nb-new-note-btn" onClick={onNewNote}>
              <FaPlus /> New Note
            </button>

            {pinned.length > 0 && (
              <div className="nb-sidebar-section">
                <div className="nb-sidebar-section-label">
                  <FaThumbtack /> Pinned
                </div>
                {pinned.map((n) => (
                  <SidebarItem key={n.id} note={n} active={selectedNote?.id === n.id} onSelect={onSelect} />
                ))}
              </div>
            )}

            <div className="nb-sidebar-section">
              <div className="nb-sidebar-section-label">
                <FaFile /> All Notes
              </div>
              {rest.map((n) => (
                <SidebarItem key={n.id} note={n} active={selectedNote?.id === n.id} onSelect={onSelect} />
              ))}
              {filtered.length === 0 && (
                <p className="nb-sidebar-empty">No notes found</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

function SidebarItem({ note, active, onSelect }) {
  const title = stripHtml(note.text).slice(0, 34) || "Untitled";
  return (
    <motion.div
      className={`nb-sidebar-item${active ? " active" : ""}`}
      onClick={() => onSelect(note)}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.97 }}
    >
      <FaFile className="nb-sidebar-item-icon" />
      <span className="nb-sidebar-item-title">{title}</span>
      {note.favorite && <FaHeart className="nb-sidebar-item-fav" />}
    </motion.div>
  );
}

/* ─── Editor Panel ──────────────────────────────────────────────────────── */
function EditorPanel({ note, allNotes, onSave, onDelete, onToggleFav, onTogglePin, onBack, onSelectNote }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [uploading, setUploading] = useState(false);
  const quillRef = useRef(null);

  useEffect(() => { setDraft(note); setEditing(false); }, [note]);

  const handleImageUpload = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `notes-images/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const editor = quillRef.current?.getEditor();
      if (editor) {
        const range = editor.getSelection(true);
        editor.insertEmbed(range.index, "image", url);
      }
    } catch (e) {
      console.error(e);
    } finally { setUploading(false); }
  }, []);

  const insertWikiLink = useCallback(() => {
    const title = prompt("Note title to link:");
    if (!title) return;
    const editor = quillRef.current?.getEditor();
    if (editor) {
      const range = editor.getSelection(true);
      editor.insertText(range.index, `[[${title}]]`);
    }
  }, []);

  const handleContentClick = useCallback((e) => {
    const el = e.target.closest(".wiki-link");
    if (!el) return;
    const id = el.dataset.noteid;
    const title = el.dataset.title;
    if (id) {
      const target = allNotes.find((n) => n.id === id);
      if (target) onSelectNote(target);
    }
  }, [allNotes, onSelectNote]);

  const renderedHtml = useMemo(() =>
    renderWithWikiLinks(draft.text || "", allNotes, onSelectNote),
    [draft.text, allNotes, onSelectNote]
  );

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        ["blockquote", "code-block"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
    },
  }), []);

  return (
    <div className="nb-editor-panel">
      {/* Toolbar */}
      <div className="nb-editor-toolbar">
        <button className="nb-toolbar-btn nb-toolbar-back" onClick={onBack}>
          <FaArrowLeft />
        </button>

        <div className="nb-breadcrumb">
          <span>Notes</span>
          <FaChevronRight className="nb-breadcrumb-sep" />
          <span className="nb-breadcrumb-current">
            {stripHtml(note.text).slice(0, 32) || "Untitled"}
          </span>
        </div>

        <div className="nb-editor-actions">
          {editing ? (
            <>
              <button
                className="nb-toolbar-btn nb-toolbar-save"
                onClick={() => { onSave(draft); setEditing(false); }}
              >
                <FaSave /> Save
              </button>
              <button
                className="nb-toolbar-btn"
                onClick={() => { setDraft(note); setEditing(false); }}
              >
                <FaTimes />
              </button>
            </>
          ) : (
            <button className="nb-toolbar-btn" onClick={() => setEditing(true)}>
              <FaEdit /> Edit
            </button>
          )}

          {editing && (
            <>
              <button className="nb-toolbar-btn nb-toolbar-wiki" onClick={insertWikiLink} title="Insert [[wiki link]]">
                <FaLink /> Wiki Link
              </button>
              <label className="nb-toolbar-btn nb-toolbar-img" title="Upload image">
                {uploading ? "⏳" : <><FaImage /> Image</>}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleImageUpload(e.target.files[0])}
                />
              </label>
            </>
          )}

          <button
            className={`nb-toolbar-btn ${note.favorite ? "nb-toolbar-fav-active" : ""}`}
            onClick={() => onToggleFav(note.id, note.favorite)}
          >
            {note.favorite ? <FaHeart /> : <FaRegHeart />}
          </button>
          <button
            className={`nb-toolbar-btn ${note.pinned ? "nb-toolbar-pin-active" : ""}`}
            onClick={() => onTogglePin(note.id, note.pinned)}
          >
            <FaThumbtack />
          </button>
          <button className="nb-toolbar-btn nb-toolbar-delete" onClick={() => onDelete(note.id)}>
            <FaTrash />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="nb-editor-body">
        {/* Tags row */}
        <div className="nb-editor-tags">
          {(editing ? draft.tags : note.tags)?.filter(Boolean).map((t, i) => (
            <span key={i} className="nb-tag-pill"># {t}</span>
          ))}
          {editing && (
            <input
              className="nb-tag-input"
              placeholder="+ add tags, comma separated"
              value={draft.tags?.join(", ") || ""}
              onChange={(e) =>
                setDraft({ ...draft, tags: e.target.value.split(",").map((t) => t.trim()) })
              }
            />
          )}
        </div>

        {/* Quill editor or rendered view */}
        {editing ? (
          <div className="nb-quill-wrapper">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={draft.text}
              onChange={(v) => setDraft({ ...draft, text: v })}
              modules={quillModules}
              className="nb-quill"
              placeholder="Start writing… use [[Note Title]] to link notes"
            />
          </div>
        ) : (
          <div
            className="nb-note-view ql-editor"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            onClick={handleContentClick}
          />
        )}

        {/* Backlinks */}
        <BacklinksPanel noteId={note.id} allNotes={allNotes} onSelect={onSelectNote} />
      </div>

      {/* Meta footer */}
      <div className="nb-editor-footer">
        <span>{note.timestamp?.toDate?.()?.toLocaleString() || ""}</span>
        <span>{stripHtml(note.text).split(/\s+/).filter(Boolean).length} words</span>
      </div>
    </div>
  );
}

function BacklinksPanel({ noteId, allNotes, onSelect }) {
  const backlinks = useMemo(() =>
    allNotes.filter((n) => {
      const links = parseWikiLinks(n.text);
      const title = stripHtml(allNotes.find((x) => x.id === noteId)?.text || "").slice(0, 60);
      return links.some((l) => title.includes(l)) && n.id !== noteId;
    }),
    [noteId, allNotes]
  );

  if (!backlinks.length) return null;

  return (
    <div className="nb-backlinks">
      <div className="nb-backlinks-label">🔗 Linked here from</div>
      {backlinks.map((n) => (
        <div key={n.id} className="nb-backlink-item" onClick={() => onSelect(n)}>
          <FaFile />
          <span>{stripHtml(n.text).slice(0, 48) || "Untitled"}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Create Note Modal ─────────────────────────────────────────────────── */
function CreateNoteModal({ onClose, onCreate }) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const quillRef = useRef(null);

  const quillModules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline"],
      ["blockquote", "code-block"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"], ["clean"],
    ],
  }), []);

  return (
    <motion.div
      className="nb-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="nb-create-modal"
        initial={{ scale: 0.88, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nb-modal-header">
          <span>✨ New Note</span>
          <button className="nb-modal-close" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="nb-modal-body">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={text}
            onChange={setText}
            modules={quillModules}
            className="nb-create-quill"
            placeholder="Start writing… use [[Note Title]] to link notes"
          />
          <input
            className="nb-modal-tags-input"
            placeholder="# Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div className="nb-modal-footer">
          <button className="nb-modal-cancel" onClick={onClose}>Cancel</button>
          <motion.button
            className="nb-modal-save"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (text.trim()) {
                onCreate(text, tags.split(",").map((t) => t.trim()).filter(Boolean));
                onClose();
              }
            }}
            disabled={!text.trim()}
          >
            <FaSave /> Save Note
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Notes Grid (home view) ────────────────────────────────────────────── */
function NoteCard({ note, onSelect, onToggleFav, onDelete }) {
  const title = stripHtml(note.text).slice(0, 48) || "Untitled";
  const preview = stripHtml(note.text).slice(0, 120);
  const links = parseWikiLinks(note.text);

  return (
    <motion.div
      className={`nb-card${note.pinned ? " nb-card--pinned" : ""}`}
      variants={{ hidden: { opacity: 0, y: 16, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1 } }}
      whileHover={{ y: -5, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(note)}
      layout
    >
      {note.pinned && <div className="nb-card-pin"><FaThumbtack /></div>}

      <div className="nb-card-body">
        <p className="nb-card-title">{title}</p>
        <p className="nb-card-preview">{preview}</p>

        {links.length > 0 && (
          <div className="nb-card-links">
            {links.slice(0, 3).map((l, i) => (
              <span key={i} className="nb-card-link-chip">[[{l}]]</span>
            ))}
          </div>
        )}

        {note.tags?.filter(Boolean).length > 0 && (
          <div className="nb-card-tags">
            {note.tags.slice(0, 3).map((t, i) => (
              <span key={i} className="nb-card-tag">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="nb-card-footer">
        <span className="nb-card-date">
          {note.timestamp?.toDate?.()?.toLocaleDateString() || ""}
        </span>
        <div className="nb-card-actions" onClick={(e) => e.stopPropagation()}>
          <motion.button
            className={`nb-card-action${note.favorite ? " active-fav" : ""}`}
            onClick={() => onToggleFav(note.id, note.favorite)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
          >
            {note.favorite ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <motion.button
            className="nb-card-action nb-card-action--delete"
            onClick={() => onDelete(note.id)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
          >
            <FaTrash />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Notes Component ──────────────────────────────────────────────── */
export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | graph
  const [filterFav, setFilterFav] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const colRef = collection(db, "notes");

  /* Real-time listener */
  useEffect(() => {
    const unsub = onSnapshot(colRef, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
      });
      setNotes(data);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  /* CRUD */
  const handleCreate = useCallback(async (text, tags) => {
    await addDoc(colRef, {
      text, tags, favorite: false, pinned: false,
      timestamp: serverTimestamp(),
    });
  }, []);

  const handleSave = useCallback(async (updated) => {
    await updateDoc(doc(db, "notes", updated.id), {
      text: updated.text,
      tags: updated.tags || [],
    });
    setSelectedNote((prev) => prev?.id === updated.id ? updated : prev);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this note?")) return;
    await deleteDoc(doc(db, "notes", id));
    if (selectedNote?.id === id) setSelectedNote(null);
  }, [selectedNote]);

  const handleToggleFav = useCallback(async (id, cur) => {
    await updateDoc(doc(db, "notes", id), { favorite: !cur });
  }, []);

  const handleTogglePin = useCallback(async (id, cur) => {
    await updateDoc(doc(db, "notes", id), { pinned: !cur });
  }, []);

  const displayNotes = useMemo(() =>
    notes.filter((n) =>
      (!filterFav || n.favorite) &&
      (stripHtml(n.text).toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())))
    ),
    [notes, filterFav, searchTerm]
  );

  return (
    <div className="nb-root">
      {/* Ambient background orbs */}
      <div className="nb-bg-orb nb-bg-orb--1" />
      <div className="nb-bg-orb nb-bg-orb--2" />
      <div className="nb-bg-orb nb-bg-orb--3" />

      {/* Sidebar */}
      <Sidebar
        notes={notes}
        selectedNote={selectedNote}
        onSelect={setSelectedNote}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onNewNote={() => setShowCreate(true)}
      />

      {/* Main content */}
      <main className="nb-main">
        {/* Top bar */}
        <div className="nb-topbar">
          <div className="nb-topbar-left">
            <h1 className="nb-title">
              <span className="nb-title-icon">✦</span>
              My Notebook
            </h1>
            <span className="nb-note-count">{notes.length} notes</span>
          </div>

          <div className="nb-topbar-right">
            <button
              className={`nb-view-btn${filterFav ? " active" : ""}`}
              onClick={() => setFilterFav((v) => !v)}
            >
              <FaHeart /> Favorites
            </button>
            <button
              className={`nb-view-btn${viewMode === "graph" ? " active" : ""}`}
              onClick={() => setViewMode((v) => v === "graph" ? "grid" : "graph")}
            >
              <FaProjectDiagram /> Graph View
            </button>
            <motion.button
              className="nb-new-btn"
              onClick={() => setShowCreate(true)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <FaPlus /> New Note
            </motion.button>
          </div>
        </div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          {selectedNote ? (
            <motion.div
              key="editor"
              className="nb-editor-wrapper"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <EditorPanel
                note={selectedNote}
                allNotes={notes}
                onSave={handleSave}
                onDelete={handleDelete}
                onToggleFav={handleToggleFav}
                onTogglePin={handleTogglePin}
                onBack={() => setSelectedNote(null)}
                onSelectNote={setSelectedNote}
              />
            </motion.div>
          ) : viewMode === "graph" ? (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GraphView
                notes={notes}
                onSelectNote={setSelectedNote}
                selectedId={selectedNote?.id}
              />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className="nb-grid"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
            >
              {isLoading ? (
                <div className="nb-loading">
                  <div className="nb-spinner" />
                  <p>Loading your notes…</p>
                </div>
              ) : displayNotes.length === 0 ? (
                <motion.div
                  className="nb-empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="nb-empty-icon">✦</div>
                  <h3>Your notebook is empty</h3>
                  <p>Create your first note and start building your knowledge graph.</p>
                  <button className="nb-empty-btn" onClick={() => setShowCreate(true)}>
                    <FaPlus /> Create Note
                  </button>
                </motion.div>
              ) : (
                displayNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onSelect={setSelectedNote}
                    onToggleFav={handleToggleFav}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateNoteModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}