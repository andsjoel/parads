import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBvZ29g2Hm2zzTxE0FhJLm93Q63noYDANA",
  authDomain: "parads-app-26f23.firebaseapp.com",
  projectId: "parads-app-26f23",
  storageBucket: "parads-app-26f23.firebasestorage.app",
  messagingSenderId: "823283824669",
  appId: "1:823283824669:web:fb82ca5a1560b3e2be2ef4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);