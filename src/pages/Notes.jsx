import React, { useState, useEffect } from "react";
import { db } from "../components/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaTrash, 
  FaRegHeart, 
  FaHeart,
  FaThumbtack, 
  FaArrowLeft, 
  FaEdit, 
  FaSave,
  FaPlus,
  FaTimes,
  FaPalette
} from "react-icons/fa";
import Seo from "../components/Seo";       
import "./Notes.css";

const Notes = () => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [tags, setTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#000000");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [isLoading, setIsLoading] = useState(true);

  const notesCollectionRef = collection(db, "notes");

  // Fetch notes from Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(notesCollectionRef, (snapshot) => {
      setNotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsLoading(true);
    await addDoc(notesCollectionRef, {
      text: newNote,
      tags,
      color,
      textColor,
      favorite: false,
      pinned: false,
      timestamp: new Date(),
    });
    setNewNote("");
    setTags([]);
    setColor("#ffffff");
    setTextColor("#000000");
    setShowAddForm(false);
    setIsLoading(false);
  };

  const handleDeleteNote = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this note?");
    if (confirmDelete) {
      await deleteDoc(doc(db, "notes", id));
      if (selectedNote?.id === id) setSelectedNote(null);
    }
  };

  const handleToggleFavorite = async (id, currentFavorite) => {
    await updateDoc(doc(db, "notes", id), { favorite: !currentFavorite });
  };

  const handleTogglePin = async (id, currentPinned) => {
    await updateDoc(doc(db, "notes", id), { pinned: !currentPinned });
  };

  const handleUpdateNote = async () => {
    if (!selectedNote?.text?.trim()) {
      alert("Note text cannot be empty!");
      return;
    }
    try {
      await updateDoc(doc(db, "notes", selectedNote.id), {
        text: selectedNote.text,
        tags: selectedNote.tags,
        color: selectedNote.color,
        textColor: selectedNote.textColor,
      });
      setEditingNote(false);
      alert("Note updated successfully!");
    } catch (error) {
      console.error("Error updating note:", error);
      alert("Failed to update the note. Please try again.");
    }
  };

  // Filter & sort logic
  const filteredNotes = notes.filter(
    (note) =>
      (note.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))) &&
      (!filterFavorites || note.favorite)
  );
  const sortedNotes = filteredNotes.sort((a, b) => {
    if (a.pinned === b.pinned) {
      return b.timestamp.toDate() - a.timestamp.toDate();
    }
    return a.pinned ? -1 : 1;
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } }
  };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 50 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 300 } }
  };

  return (
    <>
 
      <Seo
        title="Rich Text Notes with Tags & Colors"
        description="Organize your study notes with a powerful rich‑text editor, color coding, tags, and favorites. Search, pin, and never lose an idea again."
        path="/notes"
        image="https://study-buddy-seven-blush.vercel.app/notes-preview.png"
      />

      <motion.div
        className="notes-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Visible headings for on‑page SEO */}
        <div className="sr-only-headings" style={{ position: 'absolute', top: 0, left: 0, width: '1px', height: '1px', overflow: 'hidden' }}>
          <h1>StudyBuddy Notes – Organize your study materials</h1>
          <h2>Rich text editor, tags, favorites & search</h2>
        </div>

        {/* Header with Actions */}
        <motion.div className="header-section" variants={itemVariants}>
          <div className="header-content">
            <h1 className="main-title">
              <span className="title-icon">📝</span>
              My Notes
            </h1>
            <div className="header-actions">
              <motion.button
                className="add-note-btn"
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaPlus /> Add Note
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Search and Filter Bar */}
        <motion.div className="controls-section" variants={itemVariants}>
          <div className="search-container">
            <input
              type="text"
              placeholder="Search your notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <motion.button
              className={`filter-btn ${filterFavorites ? 'active' : ''}`}
              onClick={() => setFilterFavorites(!filterFavorites)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaHeart /> Favorites
            </motion.button>
            <motion.button
              className={`view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {viewMode === 'grid' ? '☰' : '⊞'}
            </motion.button>
          </div>
        </motion.div>


        <AnimatePresence>
          {showAddForm && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
            >
              <motion.div
                className="add-note-modal"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>Create New Note</h3>
                  <button className="close-btn" onClick={() => setShowAddForm(false)}>
                    <FaTimes />
                  </button>
                </div>
                <div className="modal-content">
                  <ReactQuill
                    theme="snow"
                    value={newNote}
                    onChange={(value) => setNewNote(value)}
                    placeholder="Write your note here..."
                    className="note-editor"
                  />
                  <div className="form-row">
                    <div className="tags-input-container">
                      <input
                        type="text"
                        placeholder="Add tags (comma-separated)"
                        value={tags.join(", ")}
                        onChange={(e) => setTags(e.target.value.split(",").map((tag) => tag.trim()))}
                        className="tags-input"
                      />
                    </div>
                  </div>
                  <div className="color-section">
                    <div className="color-picker">
                      <label>
                        <FaPalette /> Note Color:
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                      </label>
                    </div>
                    <div className="color-picker">
                      <label>
                        Text Color:
                        <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                      </label>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <motion.button
                      className="save-btn"
                      onClick={handleAddNote}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={!newNote.trim()}
                    >
                      <FaSave /> Save Note
                    </motion.button>
                    <button className="cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes Display */}
        <AnimatePresence mode="wait">
          {selectedNote ? (
            <motion.div
              key="selected-note"
              className="selected-note-container"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <div className="selected-note-header">
                <motion.button
                  className="back-btn"
                  onClick={() => setSelectedNote(null)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaArrowLeft /> Back to Notes
                </motion.button>
                <div className="note-meta">
                  <span className="note-date">
                    {selectedNote.timestamp?.toDate().toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div
                className="selected-note-content"
                style={{ backgroundColor: selectedNote.color, color: selectedNote.textColor }}
              >
                {editingNote ? (
                  <div className="edit-mode">
                    <ReactQuill
                      theme="snow"
                      value={selectedNote.text}
                      onChange={(value) => setSelectedNote({ ...selectedNote, text: value })}
                      className="edit-editor"
                    />
                    <div className="edit-tags">
                      <input
                        type="text"
                        placeholder="Edit tags (comma-separated)"
                        value={selectedNote.tags?.join(", ") || ""}
                        onChange={(e) =>
                          setSelectedNote({
                            ...selectedNote,
                            tags: e.target.value.split(",").map((tag) => tag.trim()),
                          })
                        }
                        className="tags-edit-input"
                      />
                    </div>
                    <div className="edit-actions">
                      <motion.button
                        className="save-edit-btn"
                        onClick={handleUpdateNote}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <FaSave /> Save Changes
                      </motion.button>
                      <button className="cancel-edit-btn" onClick={() => setEditingNote(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="view-mode">
                    <div className="note-text" dangerouslySetInnerHTML={{ __html: selectedNote.text }} />
                    {selectedNote.tags && selectedNote.tags.length > 0 && (
                      <div className="note-tags">
                        {selectedNote.tags.map((tag, index) => (
                          <span key={index} className="tag-pill">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="note-actions-bar">
                      <motion.button
                        className="action-btn edit-btn"
                        onClick={() => setEditingNote(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <FaEdit /> Edit
                      </motion.button>
                      <motion.button
                        className={`action-btn favorite-btn ${selectedNote.favorite ? 'active' : ''}`}
                        onClick={() => handleToggleFavorite(selectedNote.id, selectedNote.favorite)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {selectedNote.favorite ? <FaHeart /> : <FaRegHeart />}
                        {selectedNote.favorite ? 'Favorited' : 'Favorite'}
                      </motion.button>
                      <motion.button
                        className={`action-btn pin-btn ${selectedNote.pinned ? 'active' : ''}`}
                        onClick={() => handleTogglePin(selectedNote.id, selectedNote.pinned)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <FaThumbtack /> {selectedNote.pinned ? 'Unpin' : 'Pin'}
                      </motion.button>
                      <motion.button
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteNote(selectedNote.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <FaTrash /> Delete
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="notes-grid"
              className={`notes-grid ${viewMode}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {isLoading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading your notes...</p>
                </div>
              ) : sortedNotes.length === 0 ? (
                <motion.div className="empty-state" variants={itemVariants}>
                  <div className="empty-icon">📝</div>
                  <h3>No notes yet</h3>
                  <p>Start creating your first note to get organized!</p>
                  <motion.button
                    className="create-first-btn"
                    onClick={() => setShowAddForm(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Create Your First Note
                  </motion.button>
                </motion.div>
              ) : (
                sortedNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    className={`note-card ${note.pinned ? 'pinned' : ''}`}
                    style={{ backgroundColor: note.color, color: note.textColor }}
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, y: -5, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNote(note)}
                    layout
                  >
                    {note.pinned && (
                      <div className="pin-indicator"><FaThumbtack /></div>
                    )}
                    <div className="card-content">
                      <div
                        className="note-preview"
                        dangerouslySetInnerHTML={{
                          __html: note.text.length > 150 ? `${note.text.substring(0, 150)}...` : note.text,
                        }}
                      />
                      {note.tags && note.tags.length > 0 && (
                        <div className="card-tags">
                          {note.tags.slice(0, 3).map((tag, tagIndex) => (
                            <span key={tagIndex} className="tag-mini">{tag}</span>
                          ))}
                          {note.tags.length > 3 && <span className="tag-mini more">+{note.tags.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    <div className="card-footer">
                      <span className="card-date">{note.timestamp?.toDate().toLocaleDateString()}</span>
                      <div className="card-actions">
                        <motion.button
                          className={`quick-action ${note.favorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(note.id, note.favorite);
                          }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          {note.favorite ? <FaHeart /> : <FaRegHeart />}
                        </motion.button>
                        <motion.button
                          className="quick-action delete-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaTrash />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default Notes;