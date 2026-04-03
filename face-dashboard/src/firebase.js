import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAwm-S9HagZPs7pzYdoaXZeYcpoDMhaxqA",
  authDomain: "face-recognition-b7c76-6e59c.firebaseapp.com",
  projectId: "face-recognition-b7c76-6e59c",
  storageBucket: "face-recognition-b7c76-6e59c.firebasestorage.app",
  messagingSenderId: "727333410370",
  appId: "1:727333410370:web:47dde3feb6dd031503bfdb",
  measurementId: "G-DTFPE9GFD7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
