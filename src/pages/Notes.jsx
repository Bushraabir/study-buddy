import React, { useState, useEffect } from "react";
import { db, storage } from "../components/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { motion } from "framer-motion";
import { FaTrash, FaRegHeart, FaThumbtack, FaArrowLeft, FaEdit, FaSave } from "react-icons/fa";
import "./Notes .css";

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

  const notesCollectionRef = collection(db, "notes");

  // Fetch notes from Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(notesCollectionRef, (snapshot) => {
      setNotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  // Add a new note
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

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
  };

  // Delete a note
  const handleDeleteNote = async (id) => {
    await deleteDoc(doc(db, "notes", id));
  };

  // Toggle favorite
  const handleToggleFavorite = async (id, currentFavorite) => {
    await updateDoc(doc(db, "notes", id), { favorite: !currentFavorite });
  };

  // Toggle pin
  const handleTogglePin = async (id, currentPinned) => {
    await updateDoc(doc(db, "notes", id), { pinned: !currentPinned });
  };

  // Update an existing note
  const handleUpdateNote = async () => {
    if (!selectedNote?.text?.trim()) {
      alert("Note text cannot be empty!");
      return;
    }
  
    try {
      // Update the note in Firestore
      await updateDoc(doc(db, "notes", selectedNote.id), {
        text: selectedNote.text,
        tags: selectedNote.tags,
        color: selectedNote.color,
        textColor: selectedNote.textColor,
      });
  
      // Reset editing state
      setEditingNote(false);
      setSelectedNote(null);
      alert("Note updated successfully!");
    } catch (error) {
      console.error("Error updating note:", error);
      alert("Failed to update the note. Please try again.");
    }
  };
  

  // Filter and sort notes
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

  return (
    <motion.div
      className="notes-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="header"> Notes</h2>

      {/* Add New Note Section */}
      <div className="add-note">
        <ReactQuill
          theme="snow"
          value={newNote}
          onChange={(value) => setNewNote(value)}
          placeholder="Write your note here..."
          style={{ color: textColor }}
        />

        <div className="tags-section">
          <input
            type="text"
            placeholder="Add tags (comma-separated)"
            value={tags.join(", ")}
            onChange={(e) => setTags(e.target.value.split(",").map((tag) => tag.trim()))}
          />
        </div>

        <div className="color-selectors">
          <label>
            Note Color:
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label>
            Text Color:
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </label>
        </div>

        <button onClick={handleAddNote}>Add Note</button>
      </div>

      {/* Search and Filter */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={filterFavorites}
            onChange={() => setFilterFavorites(!filterFavorites)}
          />
          Show only favorites
        </label>
      </div>

      {/* Notes List or Selected Note View */}
      <div className="notes-list">
        {selectedNote ? (
          <div className="selected-note">
            <button onClick={() => setSelectedNote(null)}>
              <FaArrowLeft /> Back
            </button>

            {editingNote ? (
              <>
                <ReactQuill
                  theme="snow"
                  value={selectedNote.text}
                  onChange={(value) =>
                    setSelectedNote({ ...selectedNote, text: value })
                  }
                />
                <div className="tags-section">
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
                  />
                </div>
                <button onClick={handleUpdateNote}>
                  <FaSave /> Save
                </button>
              </>
            ) : (
              <>
                <div
                  dangerouslySetInnerHTML={{ __html: selectedNote.text }}
                  className="note-content"
                ></div>
                <div className="tags">Tags: {selectedNote.tags?.join(", ") || "None"}</div>
                <div className="note-actions">
                  <button onClick={() => setEditingNote(true)}>
                    <FaEdit /> Edit
                  </button>
                  <button onClick={() => handleDeleteNote(selectedNote.id)}>
                    <FaTrash /> Delete
                  </button>
                  <button
                    onClick={() =>
                      handleToggleFavorite(selectedNote.id, selectedNote.favorite)
                    }
                  >
                    <FaRegHeart /> {selectedNote.favorite ? "Unfavorite" : "Favorite"}
                  </button>
                  <button
                    onClick={() =>
                      handleTogglePin(selectedNote.id, selectedNote.pinned)
                    }
                  >
                    <FaThumbtack /> {selectedNote.pinned ? "Unpin" : "Pin"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          sortedNotes.map((note) => (
            <motion.div
              key={note.id}
              className="note-item"
              style={{ backgroundColor: note.color, color: note.textColor }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
              onClick={() => setSelectedNote(note)}
            >
              <div className="note-preview">
                <div
                  dangerouslySetInnerHTML={{
                    __html: note.text.length > 100 ? `${note.text.substring(0, 100)}...` : note.text,
                  }}
                />
                <div className="tags">
                  Tags: {note.tags?.join(", ") || "None"}
                </div>
              </div>
              <div className="note-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note.id);
                  }}
                >
                  <FaTrash />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(note.id, note.favorite);
                  }}
                >
                  {note.favorite ? <FaRegHeart className="favorite" /> : <FaRegHeart />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePin(note.id, note.pinned);
                  }}
                >
                  {note.pinned ? <FaThumbtack className="pinned" /> : <FaThumbtack />}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {sortedNotes.length === 0 && !selectedNote && (
        <div className="empty-state">No notes found. Start adding your notes!</div>
      )}
    </motion.div>
  );
};

export default Notes;
