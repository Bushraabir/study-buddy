# 🎓 StudyBuddy

**StudyBuddy** is an all-in-one student productivity platform designed to streamline learning. From tracking deep-work sessions and mastering topics via flashcards to visualizing complex 3D mathematical models, StudyBuddy provides the tools students need to stay focused and organized—all without the friction of traditional passwords.

![StudyBuddy Banner](https://github.com/Bushraabir/study-buddy/blob/main/public/og-image.png)

## ✨ Features

-   **⏱️ Study Sessions:** Integrated focus timers and session tracking to manage your deep-work intervals.
-   **🃏 Interactive Flashcards:** Create and review digital flashcards to master any subject through active recall.
-   **📝 Rich Notes:** A digital notebook for capturing thoughts, lecture summaries, and study guides.
-   **📊 Math Visualization:** -   **2D Sketch Curves:** Visualize 2D mathematical functions instantly.
    -   **3D Graphs:** Explore 3D mathematical models with interactive rendering.
-   **🔐 Passwordless Auth:** Secure, frictionless sign-in using Firebase OTP (One-Time Password) authentication.
-   **📈 Progress Tracking:** Visualize your learning journey and study habits via a personalized profile dashboard.
-   **💎 Modern UI:** A premium "Glassmorphic" design interface with smooth Framer Motion animations and responsive layouts.

## 🚀 Tech Stack

-   **Frontend:** [React.js](https://reactjs.org/) + [Vite](https://vitejs.dev/)
-   **Styling:** CSS3 with Custom Design Tokens (Glassmorphism)
-   **Animations:** [Framer Motion](https://www.framer.com/motion/)
-   **Backend/Database:** [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage)
-   **Icons:** [React Icons](https://react-icons.github.io/react-icons/)
-   **Notifications:** [React Hot Toast](https://react-hot-toast.com/)

## 🛠️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/study-buddy.git](https://github.com/your-username/study-buddy.git)
    cd study-buddy
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env` file in the root directory and add your Firebase configuration:
    ```env
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

## 🔍 SEO & Performance

StudyBuddy is built with search visibility in mind:
-   **Semantic HTML5:** Structured for screen readers and search crawlers.
-   **Meta Optimization:** Includes Open Graph (OG) tags for high-quality social sharing and Twitter Cards.
-   **Performance:** Optimized assets and code-splitting via Vite for lightning-fast load times.
-   **Sitemap:** Auto-generated `sitemap.xml` for better Google indexing.

## 🛡️ Smart Navigation
The app features **Timer-Aware Routing**. If a user attempts to navigate away while a study timer is active, the system triggers a warning to prevent accidental loss of session data.


---
*Built with ❤️ for students, by students.*