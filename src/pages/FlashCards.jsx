import React, { useState, useEffect } from "react";
import { db, auth } from "../components/firebase"; // Import Firebase config and auth
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion"; // Import framer-motion for animations
import { gsap } from "gsap"; // Import GSAP for advanced animations
import "./FlashCards.css";

const Flashcards = () => {
  const [flashcards, setFlashcards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tags, setTags] = useState("");
  const [quizMode, setQuizMode] = useState(false);
  const [quizCards, setQuizCards] = useState([]);
  const [currentQuizCard, setCurrentQuizCard] = useState(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizOptions, setQuizOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [flippedCardId, setFlippedCardId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        setFlashcards([]);
        setCategories([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch flashcards from Firestore for the current user
  useEffect(() => {
    if (!user) {
      setFlashcards([]);
      setCategories([]);
      return;
    }

    const fetchFlashcards = async () => {
      try {
        const flashcardsCollection = collection(db, "flashcards");
        const q = query(flashcardsCollection, where("userId", "==", user.uid));
        
        // Use onSnapshot for real-time updates
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const cards = snapshot.docs.map((doc) => ({ 
            ...doc.data(), 
            id: doc.id 
          }));
          setFlashcards(cards);

          // Extract unique categories from tags
          const allTags = cards.flatMap((card) => 
            Array.isArray(card.tags) ? card.tags : [card.tags || "Uncategorized"]
          );
          const uniqueCategories = [...new Set(allTags)].filter(Boolean);
          setCategories(uniqueCategories);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching flashcards:", error);
        alert("Error loading flashcards. Please try again.");
      }
    };

    fetchFlashcards();
  }, [user]);

  // Add a new flashcard
  const addFlashcard = async (e) => {
    e.preventDefault();
    
    if (question.trim() === "" || answer.trim() === "" || tags.trim() === "") {
      alert("Please fill in all fields.");
      return;
    }

    if (!user) {
      alert("You must be logged in to add a flashcard.");
      return;
    }

    try {
      const flashcardsCollection = collection(db, "flashcards");
      const tagsArray = tags.split(",").map(tag => tag.trim()).filter(Boolean);
      
      const newCard = {
        question: question.trim(),
        answer: answer.trim(),
        tags: tagsArray,
        userId: user.uid,
        createdAt: new Date()
      };

      await addDoc(flashcardsCollection, newCard);
      
      // Clear form
      setQuestion("");
      setAnswer("");
      setTags("");
      
      // Success feedback
      console.log("Flashcard added successfully!");
    } catch (error) {
      console.error("Error adding flashcard:", error);
      alert("Error adding flashcard. Please try again.");
    }
  };

  // Delete a flashcard
  const deleteFlashcard = async (id) => {
    if (!user) {
      alert("You must be logged in to delete a flashcard.");
      return;
    }

    const cardToDelete = flashcards.find((card) => card.id === id);
    if (!cardToDelete || cardToDelete.userId !== user.uid) {
      alert("You can only delete your own flashcards.");
      return;
    }

    try {
      const flashcardsCollection = collection(db, "flashcards");
      await deleteDoc(doc(flashcardsCollection, id));
      console.log("Flashcard deleted successfully!");
    } catch (error) {
      console.error("Error deleting flashcard:", error);
      alert("Error deleting flashcard. Please try again.");
    }
  };

  // Start Quiz
  const startQuiz = () => {
    if (flashcards.length < 4) {
      alert("At least 4 flashcards are required to start the quiz.");
      return;
    }
    
    const shuffledCards = [...flashcards].sort(() => Math.random() - 0.5);
    setQuizCards(shuffledCards);
    setCurrentQuizCard(shuffledCards[0]);
    setCurrentQuizIndex(0);
    generateQuizOptions(shuffledCards[0]);
    setQuizMode(true);
    setScore(0);
  };

  const generateQuizOptions = (card) => {
    const incorrectAnswers = flashcards
      .filter((fc) => fc.id !== card.id)
      .map((fc) => fc.answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const options = [...incorrectAnswers, card.answer].sort(() => Math.random() - 0.5);
    setQuizOptions(options);
  };

  const submitQuizAnswer = (selectedAnswer) => {
    let newScore = score;
    if (selectedAnswer === currentQuizCard.answer) {
      newScore = score + 1;
      setScore(newScore);
    }
    
    const nextIndex = currentQuizIndex + 1;
    if (nextIndex < quizCards.length) {
      setCurrentQuizCard(quizCards[nextIndex]);
      setCurrentQuizIndex(nextIndex);
      generateQuizOptions(quizCards[nextIndex]);
    } else {
      alert(`Quiz Finished! Your score: ${newScore}/${quizCards.length}`);
      setQuizMode(false);
      setCurrentQuizCard(null);
      setCurrentQuizIndex(0);
      setQuizCards([]);
    }
  };

  // Handle card flip
  const handleCardFlip = (cardId) => {
    setFlippedCardId(flippedCardId === cardId ? null : cardId);
  };

  // Filter flashcards based on search and category filter
  const filteredFlashcards = flashcards.filter((card) => {
    const matchesSearch = card.question.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "" || 
      (Array.isArray(card.tags) ? card.tags.some(tag => tag.includes(filter)) : 
       (card.tags || "").includes(filter));
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flashcards-container">
        <div className="header">
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flashcards-container">
        <div className="header">
          <h1>Please Log In</h1>
          <p>You need to be logged in to access your flashcards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcards-container">
      {/* Header */}
      <div className="header">
        <h1>Create a Flashcard</h1>
        <p>Organize your study and quiz yourself with flashcards.</p>
      </div>

      {/* Add Flashcard Form */}
      <div className="form-section">
        <form onSubmit={addFlashcard} className="flashcard-form">
          <input
            type="text"
            placeholder="Enter your question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Enter the answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Enter tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            required
          />
          <button type="submit" className="add-button">
            Add Flashcard
          </button>
        </form>
      </div>

      {/* Search and Filter Section */}
      <div className="filter-section">
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-bar"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-dropdown"
        >
          <option value="">All Categories</option>
          {categories.map((category, index) => (
            <option key={index} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Flashcards List (only displayed when not in quiz mode) */}
      <AnimatePresence>
        {!quizMode && (
          <div className="flashcard-list">
            {filteredFlashcards.length === 0 ? (
              <div className="no-flashcards">
                <p>No flashcards found. {flashcards.length === 0 ? "Create your first flashcard!" : "Try adjusting your search or filter."}</p>
              </div>
            ) : (
              filteredFlashcards.map((card) => (
                <motion.div
                  key={card.id}
                  className={`flashcard ${flippedCardId === card.id ? "flipped" : ""}`}
                  onClick={() => handleCardFlip(card.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4 }}
                  layout
                >
                  <div className="flashcard-front">
                    <p>
                      <strong>Q:</strong> {card.question}
                    </p>
                  </div>
                  <div className="flashcard-back">
                    <p>
                      <strong>A:</strong> {card.answer}
                    </p>
                    <p className="tags">
                      <strong>Tags:</strong> {Array.isArray(card.tags) ? card.tags.join(", ") : card.tags || "None"}
                    </p>
                    <button
                      className="delete-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Are you sure you want to delete this flashcard?")) {
                          deleteFlashcard(card.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Quiz Mode */}
      {quizMode && currentQuizCard && (
        <div className="quiz-container">
          <motion.div
            className="quiz-card"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4 }}
          >
            <h2>Quiz: {currentQuizCard.question}</h2>
            <div className="quiz-options">
              {quizOptions.map((option, index) => (
                <button
                  key={index}
                  className="quiz-option"
                  onClick={() => submitQuizAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="quiz-progress">
              Question {currentQuizIndex + 1} of {quizCards.length} | Score: {score}
            </div>
          </motion.div>

          {/* Progress Bar */}
          <motion.div
            className="progress-bar-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="progress-bar">
              <div
                className="progress"
                style={{
                  width: `${((currentQuizIndex + 1) / quizCards.length) * 100}%`,
                }}
              ></div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quiz Start Button */}
      {!quizMode && flashcards.length >= 4 && (
        <motion.div
          className="quiz-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            className="start-quiz-button"
            onClick={startQuiz}
          >
            Start Quiz ({flashcards.length} cards available)
          </button>
        </motion.div>
      )}

      {!quizMode && flashcards.length > 0 && flashcards.length < 4 && (
        <div className="quiz-section">
          <p style={{ color: '#a8a8b3', textAlign: 'center' }}>
            You need at least 4 flashcards to start a quiz. You have {flashcards.length}.
          </p>
        </div>
      )}
    </div>
  );
};

export default Flashcards;