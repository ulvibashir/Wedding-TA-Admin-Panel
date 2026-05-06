import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCThHuAl1VzA8LU8AtRlHOcG-NJdKIaPsY",
  authDomain: "wedding-ta.firebaseapp.com",
  projectId: "wedding-ta",
  storageBucket: "wedding-ta.firebasestorage.app",
  messagingSenderId: "305745023352",
  appId: "1:305745023352:web:d4b46270a1c443b524b88d",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
