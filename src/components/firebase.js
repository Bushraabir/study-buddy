import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
    apiKey: "AIzaSyBpMXV2vq9ZljbOZx3CCvaZXneXV2fEU8k",
    authDomain: "study-buddy-study-assiatant.firebaseapp.com",
    projectId: "study-buddy-study-assiatant",
    storageBucket: "study-buddy-study-assiatant.appspot.com", 
    messagingSenderId: "725712157464",
    appId: "1:725712157464:web:ecb7f93694fcafbbd3bc6d",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);  // Export the storage
export default app;