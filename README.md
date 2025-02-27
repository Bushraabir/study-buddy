# Study Buddy

**Study Buddy** is a modern, interactive web application designed to help students study smarter. The platform combines a variety of study tools—from flashcards and session management to advanced graph visualization and smart note-taking—all wrapped in an engaging, animated user interface.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### User Authentication & Registration
- **Secure Authentication:** Uses Firebase Authentication to manage user logins and registrations.
- **Interactive Registration:** Built with Formik and Yup, the registration form features real-time validations, password visibility toggles, tooltips, and engaging Lottie animations.

### Interactive Study Tools

- **Flashcards Module:**
  - **Creation & Management:** Create, view, and delete flashcards that include questions, answers, and tags for effective organization.
  - **Engaging Experience:** Flashcards flip smoothly (powered by Framer Motion and GSAP) and support a quiz mode with randomized multiple-choice questions and a dynamic progress bar.
  - **Search & Filter:** Quickly find flashcards through keyword searches or by filtering tags/categories.

- **Study Session Manager:**
  - **Timers:** Choose between a Pomodoro timer (25-minute sessions with automatic reset and toast notifications) and a stopwatch for tracking study time.
  - **Study Fields:** Organize sessions by selecting or adding custom study fields; each field tracks the accumulated study time.
  - **To-Do List:** Manage study tasks with features to add, edit, delete (with an undo option), toggle completion, and sort by priority or deadline.
  - **Real-Time Sync:** Utilizes Firebase onSnapshot to ensure that task and study field updates are synchronized in real time.

- **Advanced Graphing Calculator (PlotGraph):**
  - **Multi-Type Equation Support:** Plot equations in various forms:
    - **Explicit:** e.g., `y = f(x)`
    - **Implicit:** e.g., `F(x,y)=0`
    - **Parametric:** e.g., `x = f(t), y = g(t)`
    - **Polar:** e.g., `r = f(θ)`
  - **Advanced Computations:** For explicit equations, display the derivative, integral, roots, and asymptotes.
  - **Customizable Graph Options:** Adjust grid visibility, axis titles, axis scales (linear or logarithmic), ranges, and aspect ratio.
  - **Interactive Variables:** Custom variables appear as sliders, letting you adjust values and see immediate changes in the graph.

- **Smart Notes:**
  - **Rich Text Editing:** Create and edit notes using ReactQuill with a full suite of rich text formatting options.
  - **Customization:** Choose background and text colors and add tags. Notes can be marked as favorites or pinned.
  - **Search & Filter:** Quickly search for notes by keywords or tags, with options to filter for favorites.
  - **Real-Time Sync:** All note changes are synchronized live with Firebase Firestore.

- **Login:**
  - **Modern Interface:** The login page features smooth animations (with Framer Motion and Lottie) and interactive elements such as password visibility toggles.
  - **User Feedback:** Provides immediate toast notifications for both successful and failed login attempts.

---

## Tech Stack

- **Frontend:**  
  - React  
  - React Router DOM  
  - React Hot Toast

- **State & Form Management:**  
  - React Hooks  
  - Formik, Yup

- **Animations & UI Effects:**  
  - Framer Motion  
  - GSAP  
  - Lottie React  
  - React Scroll  
  - React Tooltip  
  - React Icons (FontAwesome)

- **Graphing & Math:**  
  - Plotly.js (via react-plotly.js)  
  - Math.js

- **Rich Text Editing:**  
  - ReactQuill

- **Backend & Database:**  
  - Firebase Authentication  
  - Firebase Firestore  
  - Firebase Storage

- **Styling:**  
  - CSS (with utility classes inspired by Tailwind CSS)

---

## Project Structure

