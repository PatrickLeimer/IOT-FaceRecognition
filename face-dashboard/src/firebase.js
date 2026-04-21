import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBd7v15GXP8rI8Ou0XBUWb83TveuAr0GNE",
  authDomain: "face-recognition-b7c76.firebaseapp.com",
  projectId: "face-recognition-b7c76",
  storageBucket: "face-recognition-b7c76.firebasestorage.app",
  messagingSenderId: "411756874854",
  appId: "1:411756874854:web:e268d681de37c5ce6ef1a7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
