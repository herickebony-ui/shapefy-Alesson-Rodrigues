// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAlt_jULnfR0dY2Xd_pCcgxKsFj-yi8kGw",
  authDomain: "shapefy-alesson-rodrigues.firebaseapp.com",
  projectId: "shapefy-alesson-rodrigues",
  storageBucket: "shapefy-alesson-rodrigues.firebasestorage.app",
  messagingSenderId: "1017177047851",
  appId: "1:1017177047851:web:6e638ecc872b936e06bb6e",
  measurementId: "G-8HCNCLJ6E8"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);