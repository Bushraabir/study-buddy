import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db, auth } from "../components/firebase";
import {
  collection, addDoc, deleteDoc, doc, query, where, onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import "./FlashCards.css";

const POOKIE_EMOJIS = ["🌸", "💖", "✨", "🎀", "💝", "🌷", "🦋", "💫", "🍓", "🌺"];
const randomEmoji = () => POOKIE_EMOJIS[Math.floor(Math.random() * POOKIE_EMOJIS.length)];

const SkeletonCard = () => (
  <div className="pookie-skeleton">
    <div className="pookie-skeleton__line pookie-skeleton__line--short" />
    <div className="pookie-skeleton__line" />
    <div className="pookie-skeleton__line pookie-skeleton__line--med" />
  </div>
);

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
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [flippedCardId, setFlippedCardId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) { setFlashcards([]); setCategories([]); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "flashcards"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const cards = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      setFlashcards(cards);
      const allTags = cards.flatMap((c) => Array.isArray(c.tags) ? c.tags : [c.tags || "Uncategorized"]);
      setCategories([...new Set(allTags)].filter(Boolean));
    }, () => toast.error("Couldn't load cards, bestie 😿"));
    return () => unsub();
  }, [user]);

  const spawnConfetti = useCallback(() => {
    const pieces = Array.from({ length: 22 }, (_, i) => ({
      id: i,
      emoji: randomEmoji(),
      x: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.2 + Math.random() * 0.8,
    }));
    setConfettiPieces(pieces);
    setTimeout(() => setConfettiPieces([]), 2800);
  }, []);

  const addFlashcard = useCallback(async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim() || !tags.trim()) {
      toast.error("Fill in all fields, pookie! 🥺");
      return;
    }
    if (!user) { toast.error("Log in first! 🔐"); return; }
    try {
      await addDoc(collection(db, "flashcards"), {
        question: question.trim(),
        answer: answer.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        userId: user.uid,
        createdAt: new Date(),
      });
      setQuestion(""); setAnswer(""); setTags("");
      setFormOpen(false);
      toast.success("Card added! You're doing amazing 🌸");
      spawnConfetti();
    } catch {
      toast.error("Oopsie, something went wrong 😿");
    }
  }, [question, answer, tags, user, spawnConfetti]);

  const deleteFlashcard = useCallback(async (id) => {
    if (!user) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "flashcards", id));
      toast.success("Poof! Card deleted 💨");
    } catch {
      toast.error("Couldn't delete that one 😔");
    } finally {
      setDeletingId(null);
    }
  }, [user]);

  const generateQuizOptions = useCallback((card, allCards) => {
    const wrongs = allCards
      .filter((c) => c.id !== card.id)
      .map((c) => c.answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [...wrongs, card.answer].sort(() => Math.random() - 0.5);
  }, []);

  const startQuiz = useCallback(() => {
    if (flashcards.length < 4) { toast.error("Need at least 4 cards to quiz! 🎀"); return; }
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setQuizCards(shuffled);
    setCurrentQuizCard(shuffled[0]);
    setCurrentQuizIndex(0);
    setQuizOptions(generateQuizOptions(shuffled[0], shuffled));
    setScore(0);
    setQuizFinished(false);
    setLastAnswerCorrect(null);
    setQuizMode(true);
  }, [flashcards, generateQuizOptions]);

  const submitQuizAnswer = useCallback((selected) => {
    const correct = selected === currentQuizCard.answer;
    setLastAnswerCorrect(correct);
    const newScore = correct ? score + 1 : score;
    if (correct) { setScore(newScore); spawnConfetti(); }

    setTimeout(() => {
      setLastAnswerCorrect(null);
      const nextIdx = currentQuizIndex + 1;
      if (nextIdx < quizCards.length) {
        setCurrentQuizCard(quizCards[nextIdx]);
        setCurrentQuizIndex(nextIdx);
        setQuizOptions(generateQuizOptions(quizCards[nextIdx], quizCards));
      } else {
        setQuizFinished(true);
        spawnConfetti();
      }
    }, 900);
  }, [currentQuizCard, currentQuizIndex, quizCards, score, generateQuizOptions, spawnConfetti]);

  const exitQuiz = useCallback(() => {
    setQuizMode(false);
    setQuizFinished(false);
    setCurrentQuizCard(null);
    setCurrentQuizIndex(0);
    setQuizCards([]);
    setLastAnswerCorrect(null);
  }, []);

  const filteredFlashcards = useMemo(() => flashcards.filter((card) => {
    const matchSearch = card.question.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "" || (Array.isArray(card.tags) ? card.tags.includes(filter) : card.tags === filter);
    return matchSearch && matchFilter;
  }), [flashcards, search, filter]);

  const scorePercent = quizCards.length ? Math.round((score / quizCards.length) * 100) : 0;

  const getScoreMessage = () => {
    if (scorePercent === 100) return "PERFECT SCORE! You're literally the main character 👑";
    if (scorePercent >= 80) return "So close to perfect! You ate that 🍓";
    if (scorePercent >= 60) return "Not bad at all, pookie! Keep studying 🌸";
    return "It's okay! Every queen stumbles 🎀 Try again!";
  };

  if (loading) {
    return (
      <div className="pookie-page">
        <div className="pookie-sparkles" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => <span key={i} className="pookie-sparkle" style={{ "--i": i }} />)}
        </div>
        <div className="pookie-header">
          <h1 className="pookie-title">Loading your cards ✨</h1>
        </div>
        <div className="pookie-card-grid">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pookie-page">
        <div className="pookie-header">
          <div className="pookie-badge">🔒 Private Zone</div>
          <h1 className="pookie-title">Bestie, log in first 🥺</h1>
          <p className="pookie-subtitle">Your flashcards are waiting for you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pookie-page">
      <div className="pookie-sparkles" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => <span key={i} className="pookie-sparkle" style={{ "--i": i }} />)}
      </div>

      <AnimatePresence>
        {confettiPieces.map((p) => (
          <motion.span
            key={p.id}
            className="pookie-confetti"
            initial={{ y: -10, x: `${p.x}vw`, opacity: 1, scale: 1 }}
            animate={{ y: "110vh", opacity: 0, scale: 0.4, rotate: 360 }}
            transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
            aria-hidden="true"
          >
            {p.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      <motion.div className="pookie-header" initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="pookie-badge">🌸 Study Session</div>
        <h1 className="pookie-title">Your Flashcards</h1>
        <p className="pookie-subtitle">
          {flashcards.length === 0 ? "No cards yet — create your first one!" : `${flashcards.length} card${flashcards.length !== 1 ? "s" : ""} ready to study 💖`}
        </p>
      </motion.div>

      <AnimatePresence>
        {!quizMode && (
          <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            <div className="pookie-toolbar">
              <div className="pookie-search-wrap">
                <span className="pookie-search-icon">🔍</span>
                <input
                  className="pookie-input pookie-input--search"
                  placeholder="Search cards..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className="pookie-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">All Tags 🏷️</option>
                {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
              <motion.button
                className="pookie-btn pookie-btn--primary"
                onClick={() => setFormOpen((p) => !p)}
                whileTap={{ scale: 0.96 }}
              >
                {formOpen ? "✖ Cancel" : "＋ New Card"}
              </motion.button>
              {flashcards.length >= 4 && (
                <motion.button className="pookie-btn pookie-btn--quiz" onClick={startQuiz} whileTap={{ scale: 0.96 }}>
                  🎀 Quiz Me!
                </motion.button>
              )}
            </div>

            <AnimatePresence>
              {formOpen && (
                <motion.div
                  className="pookie-form-card"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  <h2 className="pookie-form-title">Create a Card 🌷</h2>
                  <form onSubmit={addFlashcard} className="pookie-form">
                    <label className="pookie-label">Question</label>
                    <input
                      className="pookie-input"
                      placeholder="What do you want to remember?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                    <label className="pookie-label">Answer</label>
                    <input
                      className="pookie-input"
                      placeholder="The answer..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    <label className="pookie-label">Tags (comma-separated)</label>
                    <input
                      className="pookie-input"
                      placeholder="e.g. math, biology"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                    />
                    <motion.button type="submit" className="pookie-btn pookie-btn--submit" whileTap={{ scale: 0.97 }}>
                      Save Card ✨
                    </motion.button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {flashcards.length > 0 && flashcards.length < 4 && (
              <p className="pookie-hint">Add {4 - flashcards.length} more card{4 - flashcards.length !== 1 ? "s" : ""} to unlock quiz mode 🎀</p>
            )}

            <div className="pookie-card-grid">
              {filteredFlashcards.length === 0 ? (
                <motion.div className="pookie-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="pookie-empty-emoji">🌸</span>
                  <p>{flashcards.length === 0 ? "No cards yet! Create your first one 💖" : "No matching cards, bestie 🔍"}</p>
                </motion.div>
              ) : (
                <AnimatePresence>
                  {filteredFlashcards.map((card, idx) => (
                    <motion.div
                      key={card.id}
                      className={`pookie-flip-card ${flippedCardId === card.id ? "pookie-flip-card--flipped" : ""} ${deletingId === card.id ? "pookie-flip-card--deleting" : ""}`}
                      onClick={() => setFlippedCardId(flippedCardId === card.id ? null : card.id)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      layout
                    >
                      <div className="pookie-flip-inner">
                        <div className="pookie-flip-front">
                          <span className="pookie-card-icon">💭</span>
                          <p className="pookie-card-text">{card.question}</p>
                          <span className="pookie-tap-hint">tap to reveal ✨</span>
                        </div>
                        <div className="pookie-flip-back">
                          <span className="pookie-card-icon">💡</span>
                          <p className="pookie-card-text">{card.answer}</p>
                          <div className="pookie-tags">
                            {(Array.isArray(card.tags) ? card.tags : [card.tags]).filter(Boolean).map((t, i) => (
                              <span key={i} className="pookie-tag">#{t}</span>
                            ))}
                          </div>
                          <button
                            className="pookie-delete-btn"
                            onClick={(e) => { e.stopPropagation(); deleteFlashcard(card.id); }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quizMode && (
          <motion.div
            key="quiz"
            className="pookie-quiz"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.45 }}
          >
            {!quizFinished ? (
              <>
                <div className="pookie-quiz-header">
                  <button className="pookie-quiz-exit" onClick={exitQuiz}>✖ Exit Quiz</button>
                  <div className="pookie-quiz-progress-text">
                    {currentQuizIndex + 1} / {quizCards.length} &nbsp;·&nbsp; Score: {score} 🌸
                  </div>
                </div>

                <div className="pookie-quiz-bar-track">
                  <motion.div
                    className="pookie-quiz-bar-fill"
                    animate={{ width: `${((currentQuizIndex + 1) / quizCards.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuizIndex}
                    className={`pookie-quiz-card ${lastAnswerCorrect === true ? "pookie-quiz-card--correct" : lastAnswerCorrect === false ? "pookie-quiz-card--wrong" : ""}`}
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -60 }}
                    transition={{ duration: 0.35 }}
                  >
                    <span className="pookie-quiz-q-label">Question {currentQuizIndex + 1}</span>
                    <p className="pookie-quiz-question">{currentQuizCard?.question}</p>

                    {lastAnswerCorrect !== null && (
                      <motion.div
                        className={`pookie-quiz-feedback ${lastAnswerCorrect ? "pookie-quiz-feedback--correct" : "pookie-quiz-feedback--wrong"}`}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        {lastAnswerCorrect ? "✨ Correct, pookie!" : "💔 Not quite..."}
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="pookie-quiz-options">
                  {quizOptions.map((opt, i) => (
                    <motion.button
                      key={i}
                      className="pookie-quiz-option"
                      onClick={() => lastAnswerCorrect === null && submitQuizAnswer(opt)}
                      whileHover={{ scale: lastAnswerCorrect === null ? 1.03 : 1 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={lastAnswerCorrect !== null}
                    >
                      <span className="pookie-quiz-option-letter">{["A", "B", "C", "D"][i]}</span>
                      {opt}
                    </motion.button>
                  ))}
                </div>
              </>
            ) : (
              <motion.div className="pookie-quiz-result" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="pookie-quiz-result-emoji">
                  {scorePercent === 100 ? "👑" : scorePercent >= 80 ? "🌟" : scorePercent >= 60 ? "🌸" : "🎀"}
                </div>
                <h2 className="pookie-quiz-result-title">Quiz Complete!</h2>
                <div className="pookie-quiz-result-score">
                  {score} / {quizCards.length}
                  <span className="pookie-quiz-result-pct">{scorePercent}%</span>
                </div>
                <p className="pookie-quiz-result-msg">{getScoreMessage()}</p>
                <div className="pookie-quiz-result-btns">
                  <button className="pookie-btn pookie-btn--quiz" onClick={startQuiz}>Try Again 🔁</button>
                  <button className="pookie-btn pookie-btn--primary" onClick={exitQuiz}>Back to Cards 🌸</button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Flashcards;