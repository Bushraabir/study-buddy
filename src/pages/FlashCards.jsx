import React, { useState, useEffect } from "react";
import { db, auth } from "../components/firebase"; // Import Firebase config and auth
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
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
  const [quizOptions, setQuizOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [flippedCardId, setFlippedCardId] = useState(null); // Track the flipped card ID

  const flashcardsCollection = collection(db, "flashcards");

  // Fetch flashcards from Firestore for the current user
  useEffect(() => {
    const fetchFlashcards = async () => {
      const user = auth.currentUser;
      if (!user) {
        setFlashcards([]);
        return;
      }

      const q = query(flashcardsCollection, where("userId", "==", user.uid));
      const data = await getDocs(q);
      const cards = data.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      setFlashcards(cards);

      // Extract unique categories
      const uniqueCategories = [
        ...new Set(cards.flatMap((card) => card.tags || "Uncategorized")),
      ];
      setCategories(uniqueCategories);
    };

    fetchFlashcards();
  }, [flashcardsCollection]);

  // Add a new flashcard
  const addFlashcard = async (e) => {
    e.preventDefault();
    if (question.trim() === "" || answer.trim() === "" || tags.trim() === "")
      return;

    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to add a flashcard.");
      return;
    }

    const newCard = {
      question,
      answer,
      tags: tags.split(","),
      userId: user.uid, // Associate the flashcard with the user ID
    };
    const docRef = await addDoc(flashcardsCollection, newCard);
    setFlashcards([...flashcards, { ...newCard, id: docRef.id }]);
    setQuestion("");
    setAnswer("");
    setTags("");
  };

  // Delete a flashcard
  const deleteFlashcard = async (id) => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to delete a flashcard.");
      return;
    }

    const cardToDelete = flashcards.find((card) => card.id === id);
    if (cardToDelete.userId !== user.uid) {
      alert("You can only delete your own flashcards.");
      return;
    }

    await deleteDoc(doc(flashcardsCollection, id));
    setFlashcards(flashcards.filter((card) => card.id !== id));
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
    generateQuizOptions(shuffledCards[0]);
    setQuizMode(true);
    setScore(0);
  };

  const generateQuizOptions = (card) => {
    const incorrectAnswers = flashcards
      .filter((fc) => fc.id !== card.id)
      .map((fc) => fc.answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3); // Pick 3 random incorrect answers
    const options = [...incorrectAnswers, card.answer].sort(
      () => Math.random() - 0.5
    ); // Shuffle options
    setQuizOptions(options);
  };

  const submitQuizAnswer = (selectedAnswer) => {
    if (selectedAnswer === currentQuizCard.answer) {
      setScore((prev) => prev + 1);
    }
    const nextIndex = quizCards.indexOf(currentQuizCard) + 1;
    if (nextIndex < quizCards.length) {
      setCurrentQuizCard(quizCards[nextIndex]);
      generateQuizOptions(quizCards[nextIndex]);
    } else {
      alert(`Quiz Finished! Your score: ${score + 1}/${quizCards.length}`);
      setQuizMode(false);
      setCurrentQuizCard(null);
    }
  };

  const filteredFlashcards = flashcards.filter(
    (card) =>
      card.tags.some((tag) => tag.includes(filter)) &&
      card.question.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flashcards-container">
      {/* Header */}
      <div className="header">
        <h1>Flashcards App</h1>
        <p>Organize your study and quiz yourself with advanced flashcards.</p>
      </div>

      {/* Add Flashcard Form */}
      <div className="form-section">
        <h2>Create a Flashcard</h2>
        <form onSubmit={addFlashcard} className="flashcard-form">
          <input
            type="text"
            placeholder="Enter your question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <input
            type="text"
            placeholder="Enter the answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <input
            type="text"
            placeholder="Enter tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
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
            {filteredFlashcards.map((card) => (
              <motion.div
                key={card.id}
                className={`flashcard ${flippedCardId === card.id ? "flipped" : ""}`}
                onClick={() => setFlippedCardId(card.id)} // Toggle flip for the clicked card
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
                {flippedCardId === card.id && (
                  <motion.div className="flashcard-back">
                    <p>
                      <strong>A:</strong> {card.answer}<br/>
                    </p>
                    <p className="tags">
                      <strong>Tags:</strong> {card.tags.join(", ")}
                    </p>
                    <button
                      className="delete-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFlashcard(card.id);
                      }}
                    >
                      Delete
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ))}
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
          </motion.div>

          {/* Progress Bar */}
          <motion.div
            className="progress-bar-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div
              className="progress-bar"
              style={{
                width: `${((quizCards.indexOf(currentQuizCard) + 1) / quizCards.length) * 100}%`,
              }}
            ></div>
          </motion.div>
        </div>
      )}

      {/* Quiz Start Button */}
      {!quizMode && flashcards.length >= 4 && (
        <motion.button
          className="start-quiz-button"
          onClick={startQuiz}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Start Quiz
        </motion.button>
      )}
    </div>
  );
};

export default Flashcards;
