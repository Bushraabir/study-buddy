import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";

import { db } from "../components/firebase";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, updateDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { useEditor, EditorContent, Node } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Plugin, PluginKey } from "prosemirror-state";

import Fuse from "fuse.js";
import { motion, AnimatePresence } from "framer-motion";

import {
  FaPlus, FaTrash, FaHeart, FaRegHeart, FaThumbtack,
  FaSearch, FaTimes, FaArrowLeft,
  FaFileExport, FaFilePdf, FaFileWord, FaProjectDiagram,
  FaLink, FaBold, FaItalic, FaUnderline as FaUnderlineIcon,
  FaCode, FaListUl, FaListOl, FaQuoteRight, FaStrikethrough,
  FaHighlighter, FaCheckSquare, FaRegClock,
} from "react-icons/fa";
import { MdOutlineAutoFixHigh } from "react-icons/md";

import toast from "react-hot-toast";
import "./Notes.css";

function stripHtml(html = "") {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || "";
}

function wordCount(html = "") {
  return stripHtml(html).split(/\s+/).filter(Boolean).length;
}

function readingTime(html = "") {
  return `${Math.max(1, Math.ceil(wordCount(html) / 200))} min read`;
}

function useDebounce(value, delay = 800) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const WikiLink = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      title:  { default: "" },
      noteId: { default: null },
      missing:{ default: false },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-wiki-link]" }];
  },

  renderHTML({ node }) {
    const { title, missing } = node.attrs;
    const safeTitle = title || "";
    return [
      "span",
      {
        "data-wiki-link": safeTitle,
        class: missing ? "nb-wiki missing" : "nb-wiki",
        contenteditable: "false",
      },
      `[[${safeTitle}]]`,
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("wikiLinkClick"),
        props: {
          handleClick(view, pos, event) {
            const target = event.target.closest("[data-wiki-link]");
            if (!target) return false;
            const title = target.dataset.wikiLink;
            window.dispatchEvent(new CustomEvent("nb:navigate-wiki", { detail: { title } }));
            return true;
          },
        },
      }),
    ];
  },
});

const FUSE_OPTIONS = {
  keys: ["title"],
  threshold: 0.38,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 1,
};

async function exportAsPDF(title, htmlContent) {
  try {
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:794px;padding:60px;font-family:Georgia,serif;background:#fff;color:#111;font-size:15px;line-height:1.75;`;
    container.innerHTML = `<h1 style="margin-bottom:24px;font-size:28px">${title}</h1>${htmlContent}`;
    document.body.appendChild(container);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
    document.body.removeChild(container);
    const pdf = new jsPDF("p", "mm", "a4");
    const imgW = 210;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
    pdf.save(`${title || "note"}.pdf`);
    toast.success("PDF exported!");
  } catch (e) {
    toast.error("PDF export failed.");
  }
}

async function exportAsDOCX(title, htmlContent) {
  try {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");
    const { saveAs } = await import("file-saver");
    const text = stripHtml(htmlContent);
    const paras = text.split(/\n+/).filter(Boolean).map(
      (line) => new Paragraph({ children: [new TextRun(line)] })
    );
    const docx = new Document({
      sections: [{ children: [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }), ...paras] }],
    });
    const blob = await Packer.toBlob(docx);
    saveAs(blob, `${title || "note"}.docx`);
    toast.success("DOCX exported!");
  } catch (e) {
    toast.error("DOCX export failed.");
  }
}

function WikiPopup({ query, results, onSelect, onDismiss }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [results]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && results[idx]) { e.preventDefault(); e.stopPropagation(); onSelect(results[idx]); }
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [idx, results, onSelect, onDismiss]);

  if (!results.length && !query) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="nb-wiki-popup"
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.14 }}
      >
        <div className="nb-wiki-popup-header">
          <FaLink className="nb-wiki-popup-icon" />
          <span>Link to note</span>
          {query && <span className="nb-wiki-popup-query">"{query}"</span>}
        </div>
        {results.length === 0 ? (
          <div className="nb-wiki-popup-empty">No notes found — press Enter to create link anyway</div>
        ) : (
          results.map((r, i) => (
            <motion.div
              key={r.id}
              className={`nb-wiki-popup-item${i === idx ? " active" : ""}`}
              onClick={() => onSelect(r)}
              whileHover={{ x: 3 }}
            >
              <span className="nb-wiki-popup-dot" />
              <span className="nb-wiki-popup-title">{r.title}</span>
            </motion.div>
          ))
        )}
        <div className="nb-wiki-popup-footer">↑↓ navigate · Enter select · Esc dismiss</div>
      </motion.div>
    </AnimatePresence>
  );
}

function EditorToolbar({ editor, onInsertWikiLink, onExport }) {
  if (!editor) return null;

  const btn = (label, icon, action, isActive = false) => (
    <motion.button
      key={label}
      className={`nb-tb-btn${isActive ? " is-active" : ""}`}
      onClick={action}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      title={label}
      type="button"
    >
      {icon}
    </motion.button>
  );

  return (
    <div className="nb-toolbar">
      <div className="nb-tb-group">
        {btn("Bold",      <FaBold />,           () => editor.chain().focus().toggleBold().run(),      editor.isActive("bold"))}
        {btn("Italic",    <FaItalic />,         () => editor.chain().focus().toggleItalic().run(),    editor.isActive("italic"))}
        {btn("Underline", <FaUnderlineIcon />,  () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {btn("Strike",    <FaStrikethrough />,  () => editor.chain().focus().toggleStrike().run(),    editor.isActive("strike"))}
        {btn("Highlight", <FaHighlighter />,    () => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"))}
      </div>
      <div className="nb-tb-divider" />
      <div className="nb-tb-group">
        {btn("H1", <span className="nb-tb-text">H1</span>, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
        {btn("H2", <span className="nb-tb-text">H2</span>, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
        {btn("H3", <span className="nb-tb-text">H3</span>, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}
      </div>
      <div className="nb-tb-divider" />
      <div className="nb-tb-group">
        {btn("Bullet List",  <FaListUl />,     () => editor.chain().focus().toggleBulletList().run(),  editor.isActive("bulletList"))}
        {btn("Ordered List", <FaListOl />,     () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {btn("Task List",    <FaCheckSquare />,() => editor.chain().focus().toggleTaskList().run(),    editor.isActive("taskList"))}
        {btn("Blockquote",   <FaQuoteRight />, () => editor.chain().focus().toggleBlockquote().run(),  editor.isActive("blockquote"))}
        {btn("Inline Code",  <FaCode />,       () => editor.chain().focus().toggleCode().run(),        editor.isActive("code"))}
      </div>
      <div className="nb-tb-divider" />
      <div className="nb-tb-group">
        <motion.button
          className="nb-tb-btn nb-tb-wiki"
          onClick={onInsertWikiLink}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          title="Insert [[wiki link]]"
          type="button"
        >
          <FaLink /><span className="nb-tb-wiki-label">[[Link]]</span>
        </motion.button>
      </div>
      <div className="nb-tb-spacer" />
      <ExportMenu onExport={onExport} />
    </div>
  );
}

function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="nb-export-menu" ref={ref}>
      <motion.button
        className="nb-tb-btn nb-tb-export"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        title="Export note"
        type="button"
      >
        <FaFileExport /><span className="nb-tb-wiki-label">Export</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="nb-export-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.14 }}
          >
            <button className="nb-export-item" onClick={() => { onExport("pdf"); setOpen(false); }}>
              <FaFilePdf /> Export as PDF
            </button>
            <button className="nb-export-item" onClick={() => { onExport("docx"); setOpen(false); }}>
              <FaFileWord /> Export as DOCX
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TagsRow({ note, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((note.tags || []).join(", "));

  useEffect(() => { setValue((note.tags || []).join(", ")); }, [note.id]);

  const commit = () => {
    const tags = value.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({ ...note, tags });
    setEditing(false);
  };

  return (
    <div className="nb-tags-row">
      {!editing ? (
        <>
          {(note.tags || []).filter(Boolean).map((t, i) => (
            <span key={i} className="nb-tag-chip" onClick={() => setEditing(true)}>#{t}</span>
          ))}
          <button className="nb-tag-add" onClick={() => setEditing(true)} type="button">
            <FaPlus /> tags
          </button>
        </>
      ) : (
        <input
          className="nb-tag-edit-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder="tag1, tag2, tag3"
          autoFocus
        />
      )}
    </div>
  );
}

function BacklinksSection({ noteId, noteTitle, allNotes, onSelect }) {
  const backlinks = useMemo(() =>
    allNotes.filter((n) => {
      if (n.id === noteId || !noteTitle) return false;
      return (n.content || "").includes(`[[${noteTitle}]]`);
    }),
    [noteId, noteTitle, allNotes]
  );

  if (!backlinks.length) return null;

  return (
    <div className="nb-backlinks">
      <div className="nb-backlinks-label">🔗 Linked from {backlinks.length} note{backlinks.length > 1 ? "s" : ""}</div>
      {backlinks.map((n) => (
        <motion.div key={n.id} className="nb-backlink-item" onClick={() => onSelect(n)} whileHover={{ x: 4 }}>
          <span className="nb-backlink-dot" />
          {n.title || stripHtml(n.content || "").slice(0, 48) || "Untitled"}
        </motion.div>
      ))}
    </div>
  );
}

function EditorPanel({ note, allNotes, onSave, onDelete, onToggleFav, onTogglePin, onBack, onSelectNote }) {
  const [title, setTitle] = useState(note.title || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [wikiQuery, setWikiQuery] = useState(null);
  const [wikiResults, setWikiResults] = useState([]);
  const [wikiInsertFn, setWikiInsertFn] = useState(null);
  const fuseRef = useRef(null);

  useEffect(() => { setTitle(note.title || ""); setLastSaved(null); }, [note.id]);

  useEffect(() => {
    const items = allNotes
      .filter((n) => n.id !== note.id)
      .map((n) => ({ id: n.id, title: n.title || stripHtml(n.content).slice(0, 50) }));
    fuseRef.current = new Fuse(items, FUSE_OPTIONS);
  }, [allNotes, note.id]);

  useEffect(() => {
    const handler = (e) => {
      const { title: t } = e.detail;
      const target = allNotes.find((n) => n.title === t);
      if (target) onSelectNote(target);
      else toast(`Note "${t}" not found`, { icon: "🔗" });
    };
    window.addEventListener("nb:navigate-wiki", handler);
    return () => window.removeEventListener("nb:navigate-wiki", handler);
  }, [allNotes, onSelectNote]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      Highlight.configure({ multicolor: false }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      WikiLink,
      Placeholder.configure({ placeholder: "Start writing… type [[ to link a note", emptyEditorClass: "is-editor-empty" }),
    ],
    content: note.content || "",
    editorProps: { attributes: { class: "nb-editor-content" } },

    onUpdate({ editor: ed }) {
      const { from } = ed.state.selection;
      const before = ed.state.doc.textBetween(Math.max(0, from - 80), from, "\n");
      const match = before.match(/\[\[([^\]]*)$/);

      if (match) {
        const q = match[1];
        setWikiQuery(q);
        const raw = q ? (fuseRef.current?.search(q) || []) : [];
        const allItems = fuseRef.current?._docs || [];
        const results = q ? raw.slice(0, 8).map((r) => ({ ...r.item, score: r.score })) : allItems.slice(0, 8);
        setWikiResults(results);
        setWikiInsertFn(() => (selectedNote) => {
          const noteTitle = selectedNote.title || "";
          const deleteLen = 2 + q.length;
          ed.chain().focus()
            .deleteRange({ from: from - deleteLen, to: from })
            .insertContent({ type: "wikiLink", attrs: { title: noteTitle, noteId: selectedNote.id, missing: false } })
            .run();
          setWikiQuery(null); setWikiResults([]); setWikiInsertFn(null);
        });
      } else {
        setWikiQuery(null); setWikiResults([]); setWikiInsertFn(null);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== note.content) editor.commands.setContent(note.content || "", false);
  }, [note.id]);

  const debouncedTitle = useDebounce(title, 900);
  const [editorHtml, setEditorHtml] = useState(note.content || "");

  useEffect(() => {
    if (!editor) return;
    const update = () => setEditorHtml(editor.getHTML());
    editor.on("update", update);
    return () => editor.off("update", update);
  }, [editor]);

  const debouncedContent = useDebounce(editorHtml, 900);

  useEffect(() => {
    if (!editor) return;
    const save = async () => {
      setIsSaving(true);
      try { await onSave({ ...note, title: debouncedTitle, content: debouncedContent }); setLastSaved(new Date()); }
      catch (e) { console.error(e); }
      finally { setIsSaving(false); }
    };
    save();
  }, [debouncedTitle, debouncedContent]);

  const handleInsertWikiLinkBtn = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent("[[").run();
  }, [editor]);

  const handleExport = useCallback(async (format) => {
    const html = editor?.getHTML() || note.content || "";
    if (format === "pdf") await exportAsPDF(title || "Untitled", html);
    else await exportAsDOCX(title || "Untitled", html);
  }, [editor, note.content, title]);

  return (
    <div className="nb-editor-panel">
      <div className="nb-panel-nav">
        <motion.button className="nb-panel-back" onClick={onBack} whileHover={{ x: -3 }} type="button">
          <FaArrowLeft />
        </motion.button>
        <div className="nb-panel-breadcrumb">
          <span className="nb-panel-bc-root">Notes</span>
          <span className="nb-panel-bc-sep">›</span>
          <span className="nb-panel-bc-current">{title || "Untitled"}</span>
        </div>
        <div className="nb-panel-status">
          {isSaving ? (
            <span className="nb-status-saving"><span className="nb-status-dot saving" /> Saving…</span>
          ) : lastSaved ? (
            <span className="nb-status-saved"><span className="nb-status-dot saved" /> Saved {lastSaved.toLocaleTimeString()}</span>
          ) : null}
        </div>
        <div className="nb-panel-actions">
          <motion.button className={`nb-panel-action${note.favorite ? " fav" : ""}`} onClick={() => onToggleFav(note.id, note.favorite)} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }} title="Favorite" type="button">
            {note.favorite ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <motion.button className={`nb-panel-action${note.pinned ? " pinned" : ""}`} onClick={() => onTogglePin(note.id, note.pinned)} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }} title="Pin" type="button">
            <FaThumbtack />
          </motion.button>
          <motion.button className="nb-panel-action delete" onClick={() => onDelete(note.id)} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }} title="Delete" type="button">
            <FaTrash />
          </motion.button>
        </div>
      </div>

      <EditorToolbar editor={editor} onInsertWikiLink={handleInsertWikiLinkBtn} onExport={handleExport} />

      <div className="nb-editor-body">
        <input
          className="nb-title-input"
          placeholder="Untitled"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          spellCheck={false}
        />
        <TagsRow note={note} onSave={onSave} />
        <div className="nb-editor-area" style={{ position: "relative" }}>
          <EditorContent editor={editor} />
          {wikiQuery !== null && (
            <WikiPopup
              query={wikiQuery}
              results={wikiResults}
              onSelect={(r) => wikiInsertFn?.(r)}
              onDismiss={() => { setWikiQuery(null); setWikiResults([]); setWikiInsertFn(null); }}
            />
          )}
        </div>
        <BacklinksSection noteId={note.id} noteTitle={note.title} allNotes={allNotes} onSelect={onSelectNote} />
      </div>

      <div className="nb-editor-footer">
        <span><FaRegClock style={{ marginRight: 5 }} />{readingTime(editorHtml)}</span>
        <span>{wordCount(editorHtml)} words</span>
        <span>{note.timestamp?.toDate?.()?.toLocaleDateString() || ""}</span>
      </div>
    </div>
  );
}

function Sidebar({ notes, selectedId, onSelect, onNew }) {
  const [collapsed, setCollapsed] = useState(false);
  const pinned = notes.filter((n) => n.pinned);
  const rest   = notes.filter((n) => !n.pinned);

  return (
    <motion.aside
      className="nb-sidebar"
      animate={{ width: collapsed ? 44 : 220 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <div className="nb-sb-top">
        <AnimatePresence>
          {!collapsed && (
            <motion.span className="nb-sb-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Notes
            </motion.span>
          )}
        </AnimatePresence>
        <button className="nb-sb-toggle" onClick={() => setCollapsed((v) => !v)} type="button">
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div className="nb-sb-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.button className="nb-sb-new" onClick={onNew} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="button">
              <FaPlus /> New Note
            </motion.button>

            {pinned.length > 0 && (
              <div className="nb-sb-section">
                <div className="nb-sb-section-label">📌 Pinned</div>
                {pinned.map((n) => <SidebarItem key={n.id} note={n} active={n.id === selectedId} onSelect={onSelect} />)}
              </div>
            )}
            <div className="nb-sb-section">
              <div className="nb-sb-section-label">📄 All Notes</div>
              {rest.map((n) => <SidebarItem key={n.id} note={n} active={n.id === selectedId} onSelect={onSelect} />)}
              {notes.length === 0 && <p className="nb-sb-empty">No notes yet</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

function SidebarItem({ note, active, onSelect }) {
  const title = note.title || stripHtml(note.content || "").slice(0, 36) || "Untitled";
  return (
    <motion.div
      className={`nb-sb-item${active ? " active" : ""}`}
      onClick={() => onSelect(note)}
      whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
    >
      <span className="nb-sb-item-icon">◆</span>
      <span className="nb-sb-item-title">{title}</span>
      {note.favorite && <FaHeart className="nb-sb-item-fav" />}
    </motion.div>
  );
}

function CreateModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");

  return (
    <motion.div
      className="nb-modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="nb-create-modal"
        initial={{ scale: 0.88, y: 32, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 32, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nb-modal-header">
          <MdOutlineAutoFixHigh className="nb-modal-icon" />
          <span>New Note</span>
          <button className="nb-modal-x" onClick={onClose} type="button"><FaTimes /></button>
        </div>
        <div className="nb-modal-body">
          <input
            className="nb-modal-title-input"
            placeholder="Note title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { onCreate(title.trim()); onClose(); } }}
            autoFocus
          />
          <p className="nb-modal-hint">You can add content after creating the note.</p>
        </div>
        <div className="nb-modal-footer">
          <button className="nb-modal-cancel" onClick={onClose} type="button">Cancel</button>
          <motion.button
            className="nb-modal-create"
            onClick={() => { if (title.trim()) { onCreate(title.trim()); onClose(); } }}
            disabled={!title.trim()}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            type="button"
          >
            <FaPlus /> Create
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NoteCard({ note, onSelect, onToggleFav, onDelete }) {
  const title = note.title || "Untitled";
  const rawText = stripHtml(note.content || "")
    .replace(/\[\[null\]\]/g, "")
    .replace(/\[\[([^\]]*)\]\]/g, (_, t) => t || "")
    .trim();
  const preview = rawText.slice(0, 130);
  const wikiCount = [...(note.content || "").matchAll(/data-wiki-link="([^"]+)"/g)]
    .filter(m => m[1] && m[1] !== "null").length;

  return (
    <motion.div
      className={`nb-card${note.pinned ? " pinned" : ""}${note.favorite ? " faved" : ""}`}
      variants={{ hidden: { opacity: 0, y: 18, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1 } }}
      whileHover={{ y: -5, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(note)}
      layout
    >
      {note.pinned && <div className="nb-card-pin"><FaThumbtack /></div>}
      <div className="nb-card-body">
        <p className="nb-card-title">{title}</p>
        {preview && <p className="nb-card-preview">{preview}</p>}
        {wikiCount > 0 && (
          <div className="nb-card-meta-row">
            <span className="nb-card-wiki-badge"><FaLink /> {wikiCount} link{wikiCount > 1 ? "s" : ""}</span>
          </div>
        )}
        {(note.tags || []).filter(Boolean).length > 0 && (
          <div className="nb-card-tags">
            {note.tags.slice(0, 4).map((t, i) => <span key={i} className="nb-card-tag">#{t}</span>)}
          </div>
        )}
      </div>
      <div className="nb-card-footer">
        <span className="nb-card-date">{note.timestamp?.toDate?.()?.toLocaleDateString() || ""}</span>
        <div className="nb-card-actions" onClick={(e) => e.stopPropagation()}>
          <motion.button className={`nb-card-btn${note.favorite ? " fav" : ""}`} onClick={() => onToggleFav(note.id, note.favorite)} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }} type="button">
            {note.favorite ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <motion.button className="nb-card-btn del" onClick={() => onDelete(note.id)} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }} type="button">
            <FaTrash />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function GraphView({ notes, onSelect }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const stateRef  = useRef({
    nodes: [], edges: [], nodeMap: {},
    hoveredNode: null, selectedNode: null,
    dragNode: null, isDragging: false,
    isPanning: false, panStart: null,
    pan: { x: 0, y: 0 }, zoom: 1, time: 0,
  });
  const tooltipRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = stateRef.current;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const mentionCount = {};
    notes.forEach((n) => { mentionCount[n.id] = 0; });
    notes.forEach((src) => {
      const ms = [...(src.content || "").matchAll(/data-wiki-link="([^"]+)"/g)];
      ms.forEach((m) => {
        const tgt = notes.find((x) => x.title === m[1]);
        if (tgt) mentionCount[tgt.id] = (mentionCount[tgt.id] || 0) + 1;
      });
    });
    const maxM = Math.max(1, ...Object.values(mentionCount));

    const W = canvas.width, H = canvas.height;
    const nodeMap = {};

    S.nodes = notes.map((n, i) => {
      const angle = (i / notes.length) * Math.PI * 2;
      const spiralR = 90 + (i % 6) * 42;
      const nd = {
        id: n.id,
        label: n.title || "Untitled",
        x: W / 2 + spiralR * Math.cos(angle) + (Math.random() - 0.5) * 55,
        y: H / 2 + spiralR * Math.sin(angle) + (Math.random() - 0.5) * 55,
        vx: 0, vy: 0,
        note: n,
        mentions: mentionCount[n.id] || 0,
        radius: 7 + (mentionCount[n.id] / maxM) * 18,
        pinned: n.pinned,
        favorite: n.favorite,
        pulsePhase: Math.random() * Math.PI * 2,
      };
      nodeMap[n.id] = nd;
      return nd;
    });
    S.nodeMap = nodeMap;

    S.edges = [];
    notes.forEach((n) => {
      const ms = [...(n.content || "").matchAll(/data-wiki-link="([^"]+)"/g)];
      ms.forEach((m) => {
        const tgt = notes.find((x) => x.title === m[1]);
        if (tgt && nodeMap[tgt.id]) S.edges.push({ from: n.id, to: tgt.id });
      });
    });

    const REPEL = 4500, SPRING_LEN = 130, SPRING_K = 0.034, DAMP = 0.83, GRAV = 0.006;

    const physicsTick = () => {
      const nodes = S.nodes;
      const W2 = canvas.width, H2 = canvas.height;
      const vcx = W2 / 2 - S.pan.x, vcy = H2 / 2 - S.pan.y;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = REPEL / (dist * dist);
          const fx = (dx / dist) * f, fy = (dy / dist) * f;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }

      S.edges.forEach(({ from, to }) => {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (dist - SPRING_LEN) * SPRING_K;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      });

      nodes.forEach((n) => {
        if (n === S.dragNode) return;
        n.vx += (vcx - n.x) * GRAV;
        n.vy += (vcy - n.y) * GRAV;
        n.vx *= DAMP; n.vy *= DAMP;
        n.x += n.vx; n.y += n.vy;
      });
    };

    const draw = () => {
      const W2 = canvas.width, H2 = canvas.height;
      S.time += 0.016;
      ctx.clearRect(0, 0, W2, H2);

      ctx.save();
      for (let gx = 0; gx < W2; gx += 34) {
        for (let gy = 0; gy < H2; gy += 34) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.7, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(192,132,252,0.055)";
          ctx.fill();
        }
      }
      ctx.restore();

      ctx.save();
      ctx.translate(S.pan.x, S.pan.y);
      ctx.scale(S.zoom, S.zoom);

      const hov = S.hoveredNode, sel = S.selectedNode;
      const hlIds = new Set();
      if (hov || sel) {
        const focal = hov || sel;
        hlIds.add(focal.id);
        S.edges.forEach(({ from, to }) => {
          if (from === focal.id) hlIds.add(to);
          if (to === focal.id) hlIds.add(from);
        });
      }
      const hasHl = hlIds.size > 0;

      S.edges.forEach(({ from, to }) => {
        const a = nodeMap[from], b = nodeMap[to];
        if (!a || !b) return;
        const isHl = hlIds.has(from) && hlIds.has(to);
        const alpha = hasHl ? (isHl ? 0.88 : 0.07) : 0.25;

        const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.13;
        const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.13;

        if (isHl) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(mx, my, b.x, b.y);
          ctx.strokeStyle = `rgba(249,168,212,${alpha * 0.35})`;
          ctx.lineWidth = 7 / S.zoom;
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);

        if (isHl) {
          const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          g.addColorStop(0, `rgba(244,114,182,${alpha})`);
          g.addColorStop(0.5, `rgba(232,121,249,${alpha})`);
          g.addColorStop(1, `rgba(192,132,252,${alpha})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 2 / S.zoom;
        } else {
          ctx.strokeStyle = `rgba(192,132,252,${alpha})`;
          ctx.lineWidth = 1 / S.zoom;
        }
        ctx.stroke();

        if (isHl) {
          const t2 = 0.84;
          const ax = (1 - t2) * (1 - t2) * a.x + 2 * (1 - t2) * t2 * mx + t2 * t2 * b.x;
          const ay = (1 - t2) * (1 - t2) * a.y + 2 * (1 - t2) * t2 * my + t2 * t2 * b.y;
          ctx.beginPath();
          ctx.arc(ax, ay, 3 / S.zoom, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(249,168,212,${alpha})`;
          ctx.fill();
        }
      });

      S.nodes.forEach((n) => {
        const isHov = n === hov, isSel = n === sel;
        const isDim = hasHl && !hlIds.has(n.id);
        const r = n.radius;
        const pulse = Math.sin(S.time * 1.9 + n.pulsePhase) * 0.5 + 0.5;
        const dimF = isDim ? 0.15 : 1;

        if (!isDim) {
          const glowR = r * (isHov || isSel ? 3.4 : 2.6);
          const glA = isHov ? 0.24 : isSel ? 0.20 : (n.mentions > 0 ? 0.11 : 0.07);
          const grd = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, glowR);
          let gc = "249,168,212";
          if (n.pinned)       gc = "251,191,36";
          if (n.favorite)     gc = "244,114,182";
          if (n.mentions >= 3) gc = "232,121,249";
          grd.addColorStop(0, `rgba(${gc},${glA + pulse * 0.05})`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);

        let fill, stroke, strokeW;
        if (isSel) {
          fill = `rgba(219,39,119,${0.88 * dimF})`; stroke = `rgba(252,231,243,${0.95 * dimF})`; strokeW = 2 / S.zoom;
        } else if (isHov) {
          fill = `rgba(244,114,182,${0.78 * dimF})`; stroke = `rgba(252,231,243,${0.92 * dimF})`; strokeW = 1.6 / S.zoom;
        } else if (n.pinned) {
          fill = `rgba(251,191,36,${0.55 * dimF})`;  stroke = `rgba(253,230,138,${0.80 * dimF})`; strokeW = 1.2 / S.zoom;
        } else if (n.favorite) {
          fill = `rgba(244,114,182,${0.55 * dimF})`; stroke = `rgba(249,168,212,${0.80 * dimF})`; strokeW = 1.2 / S.zoom;
        } else if (n.mentions >= 3) {
          fill = `rgba(168,85,247,${0.58 * dimF})`; stroke = `rgba(232,121,249,${0.88 * dimF})`; strokeW = 1.5 / S.zoom;
        } else if (n.mentions >= 1) {
          fill = `rgba(192,132,252,${0.42 * dimF})`; stroke = `rgba(192,132,252,${0.72 * dimF})`; strokeW = 1 / S.zoom;
        } else {
          fill = `rgba(249,168,212,${0.28 * dimF})`; stroke = `rgba(249,168,212,${0.55 * dimF})`; strokeW = 0.8 / S.zoom;
        }

        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeW;
        ctx.stroke();

        if (!isDim) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 0.36, 0, Math.PI * 2);
          ctx.fillStyle = isHov || isSel
            ? "rgba(252,231,243,0.88)"
            : n.mentions >= 3 ? "rgba(232,121,249,0.48)" : "rgba(249,168,212,0.38)";
          ctx.fill();
        }

        const showLabel = S.zoom > 0.5 || n.mentions >= 2 || isHov || isSel || n.pinned;
        if (showLabel && !isDim) {
          const lSize = Math.max(9, Math.min(13, 10 + r * 0.16)) / S.zoom;
          ctx.font = `${isHov || isSel ? 600 : 400} ${lSize}px 'DM Sans', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          let label = n.label;
          const maxW = (r * 5.5 + 30) / S.zoom;
          while (ctx.measureText(label + "…").width > maxW && label.length > 1) label = label.slice(0, -1);
          if (label !== n.label) label += "…";

          const ly = n.y + r + 5 / S.zoom;

          ctx.fillStyle = "rgba(14,10,22,0.78)";
          ctx.fillText(label, n.x + 0.5, ly + 0.5);
          ctx.fillStyle = isHov || isSel ? "#fce7f3" : n.mentions >= 3 ? "#e879f9" : "#dbc4d8";
          ctx.fillText(label, n.x, ly);
        }
      });

      ctx.restore();

      ctx.font = "10px 'DM Sans', sans-serif";
      ctx.fillStyle = "rgba(90,68,96,0.50)";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${Math.round(S.zoom * 100)}%  scroll · drag`, canvas.width - 14, canvas.height - 10);
    };

    const loop = () => { physicsTick(); draw(); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);

    const worldPos = (ex, ey) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (ex - rect.left - S.pan.x) / S.zoom, y: (ey - rect.top - S.pan.y) / S.zoom };
    };

    const hitTest = (ex, ey) => {
      const { x, y } = worldPos(ex, ey);
      return S.nodes.find((n) => {
        const dx = x - n.x, dy = y - n.y;
        return Math.sqrt(dx * dx + dy * dy) < n.radius + 4;
      }) || null;
    };

    const onMouseMove = (e) => {
      if (S.isDragging && S.dragNode) {
        const { x, y } = worldPos(e.clientX, e.clientY);
        S.dragNode.x = x; S.dragNode.y = y; S.dragNode.vx = 0; S.dragNode.vy = 0;
        return;
      }
      if (S.isPanning && S.panStart) {
        const rect = canvas.getBoundingClientRect();
        S.pan.x = e.clientX - rect.left - S.panStart.ox;
        S.pan.y = e.clientY - rect.top  - S.panStart.oy;
        return;
      }
      const hit = hitTest(e.clientX, e.clientY);
      S.hoveredNode = hit;
      canvas.style.cursor = hit ? "pointer" : "grab";

      if (tooltipRef.current) {
        if (hit) {
          const rect = canvas.getBoundingClientRect();
          tooltipRef.current.style.left = `${e.clientX - rect.left + 14}px`;
          tooltipRef.current.style.top  = `${e.clientY - rect.top  - 10}px`;
          tooltipRef.current.style.opacity = "1";
          tooltipRef.current.innerHTML = `
            <div class="nb-gtt-title">${hit.label}</div>
            ${hit.mentions > 0 ? `<div class="nb-gtt-meta">🔗 ${hit.mentions} backlink${hit.mentions > 1 ? "s" : ""}</div>` : ""}
            ${hit.pinned    ? `<div class="nb-gtt-meta">📌 Pinned</div>`   : ""}
            ${hit.favorite  ? `<div class="nb-gtt-meta">♡ Favorite</div>` : ""}
          `;
        } else {
          tooltipRef.current.style.opacity = "0";
        }
      }
    };

    const onMouseDown = (e) => {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        S.isDragging = true; S.dragNode = hit; canvas.style.cursor = "grabbing";
      } else {
        S.isPanning = true;
        const rect = canvas.getBoundingClientRect();
        S.panStart = { ox: e.clientX - rect.left - S.pan.x, oy: e.clientY - rect.top - S.pan.y };
        canvas.style.cursor = "grabbing";
      }
    };

    const onMouseUp = () => {
      S.isDragging = false; S.dragNode = null;
      S.isPanning = false; S.panStart = null;
      canvas.style.cursor = "grab";
    };

    const onClick = (e) => {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        if (S.selectedNode === hit) { onSelect(hit.note); }
        else S.selectedNode = hit;
      } else S.selectedNode = null;
    };

    const onDblClick = (e) => {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) onSelect(hit.note);
    };

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.11;
      const nz = Math.max(0.15, Math.min(4, S.zoom * delta));
      S.pan.x = mx - (mx - S.pan.x) * (nz / S.zoom);
      S.pan.y = my - (my - S.pan.y) * (nz / S.zoom);
      S.zoom = nz;
    };

    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("click",      onClick);
    canvas.addEventListener("dblclick",   onDblClick);
    canvas.addEventListener("wheel",      onWheel, { passive: false });
    canvas.addEventListener("mouseleave", () => {
      S.hoveredNode = null; S.isDragging = false; S.dragNode = null; S.isPanning = false;
      if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("click",      onClick);
      canvas.removeEventListener("dblclick",   onDblClick);
      canvas.removeEventListener("wheel",      onWheel);
    };
  }, [notes, onSelect]);

  const legend = [
    { color: "#f9a8d4", label: "Note" },
    { color: "#c084fc", label: "Linked" },
    { color: "#e879f9", label: "Hub" },
    { color: "#fbbf24", label: "Pinned" },
    { color: "#f472b6", label: "Fave" },
  ];

  return (
    <div className="nb-graph-container">
      <div className="nb-graph-bar">
        <FaProjectDiagram className="nb-graph-bar-icon" />
        <span className="nb-graph-bar-title">Knowledge Graph</span>
        <div className="nb-graph-legend">
          {legend.map((item) => (
            <div key={item.label} className="nb-graph-legend-item">
              <span className="nb-graph-legend-dot" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <span className="nb-graph-hint">click to select · dbl-click to open · drag to pan</span>
      </div>
      <div className="nb-graph-canvas-wrap">
        <canvas ref={canvasRef} className="nb-graph-canvas" style={{ cursor: "grab" }} />
        <div ref={tooltipRef} className="nb-graph-tooltip" />
        {notes.length === 0 && (
          <div className="nb-graph-empty">
            <div className="nb-graph-empty-glyph">✦</div>
            <p>No notes yet — create some and link them with [[wikilinks]]</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Notes() {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterFav, setFilterFav] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showGraph, setShowGraph] = useState(false);

  const colRef = useMemo(() => {
    if (!uid) return null;
    return query(collection(db, "notes"), where("userId", "==", uid));
  }, [uid]);

  useEffect(() => {
    if (!colRef) return;
    const unsub = onSnapshot(colRef, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
      });
      setNotes(data);
      setIsLoading(false);
      setSelectedNote((prev) => prev ? (data.find((n) => n.id === prev.id) || null) : null);
    });
    return unsub;
  }, [colRef]);

  const handleCreate = useCallback(async (title) => {
    if (!uid) return;
    const ref = await addDoc(collection(db, "notes"), {
      userId: uid, title, content: "", tags: [],
      favorite: false, pinned: false, timestamp: serverTimestamp(),
    });
    setTimeout(() => {
      setNotes((prev) => {
        const newNote = prev.find((n) => n.id === ref.id);
        if (newNote) setSelectedNote(newNote);
        return prev;
      });
    }, 500);
  }, [uid]);

  const handleSave = useCallback(async (updated) => {
    const { id, title, content, tags } = updated;
    await updateDoc(doc(db, "notes", id), { title: title || "", content: content || "", tags: tags || [] });
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this note permanently?")) return;
    await deleteDoc(doc(db, "notes", id));
    if (selectedNote?.id === id) setSelectedNote(null);
    toast("Note deleted 🗑️");
  }, [selectedNote]);

  const handleToggleFav = useCallback(async (id, cur) => {
    await updateDoc(doc(db, "notes", id), { favorite: !cur });
  }, []);

  const handleTogglePin = useCallback(async (id, cur) => {
    await updateDoc(doc(db, "notes", id), { pinned: !cur });
  }, []);

  const fuse = useMemo(() => new Fuse(notes, { keys: ["title", "tags"], threshold: 0.4 }), [notes]);

  const displayNotes = useMemo(() => {
    let list = searchTerm.trim() ? fuse.search(searchTerm).map((r) => r.item) : notes;
    if (filterFav) list = list.filter((n) => n.favorite);
    return list;
  }, [fuse, notes, searchTerm, filterFav]);

  if (!uid) {
    return (
      <div className="nb-root">
        <div className="nb-auth-wall"><h2>Please log in to access your notes.</h2></div>
      </div>
    );
  }

  return (
    <div className="nb-root">
      <div className="nb-orb nb-orb--1" />
      <div className="nb-orb nb-orb--2" />
      <div className="nb-orb nb-orb--3" />

      <Sidebar notes={notes} selectedId={selectedNote?.id} onSelect={setSelectedNote} onNew={() => setShowCreate(true)} />

      <main className="nb-main">
        <AnimatePresence mode="wait">
          {!selectedNote && (
            <motion.div
              key="topbar"
              className="nb-topbar"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="nb-topbar-left">
                <h1 className="nb-heading">
                  <span className="nb-heading-glyph">✦</span> My Notebook
                </h1>
                <span className="nb-note-count">{notes.length} notes</span>
              </div>
              <div className="nb-topbar-right">
                <div className="nb-topbar-search">
                  <FaSearch />
                  <input
                    className="nb-topbar-search-input"
                    placeholder="Search all notes…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && <button onClick={() => setSearchTerm("")} type="button"><FaTimes /></button>}
                </div>
                <motion.button
                  className={`nb-filter-btn${showGraph ? " active" : ""}`}
                  onClick={() => setShowGraph((v) => !v)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  type="button"
                >
                  <FaProjectDiagram /> Graph
                </motion.button>
                <button className={`nb-filter-btn${filterFav ? " active" : ""}`} onClick={() => setFilterFav((v) => !v)} type="button">
                  <FaHeart /> Favorites
                </button>
                <motion.button className="nb-new-btn" onClick={() => setShowCreate(true)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button">
                  <FaPlus /> New Note
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {selectedNote ? (
            <motion.div key="editor" className="nb-editor-wrapper" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }}>
              <EditorPanel
                note={selectedNote} allNotes={notes}
                onSave={handleSave} onDelete={handleDelete}
                onToggleFav={handleToggleFav} onTogglePin={handleTogglePin}
                onBack={() => setSelectedNote(null)} onSelectNote={setSelectedNote}
              />
            </motion.div>
          ) : showGraph ? (
            <motion.div key="graph" className="nb-graph-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GraphView notes={notes} onSelect={(n) => { setSelectedNote(n); setShowGraph(false); }} />
            </motion.div>
          ) : (
            <motion.div key="grid" className="nb-grid" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
              {isLoading ? (
                <div className="nb-loading"><div className="nb-spinner" /><p>Loading your notes…</p></div>
              ) : displayNotes.length === 0 ? (
                <motion.div className="nb-empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="nb-empty-glyph">✦</div>
                  <h3>Your notebook is empty</h3>
                  <p>Create a note and build your knowledge graph with [[wikilinks]].</p>
                  <button className="nb-empty-btn" onClick={() => setShowCreate(true)} type="button">
                    <FaPlus /> Create First Note
                  </button>
                </motion.div>
              ) : (
                displayNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onSelect={setSelectedNote} onToggleFav={handleToggleFav} onDelete={handleDelete} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      </AnimatePresence>
    </div>
  );
}