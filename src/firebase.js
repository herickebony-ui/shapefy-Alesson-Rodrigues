// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, updateDoc, setDoc, getDocs, deleteDoc, addDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// --- ⚠️ CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
apiKey: "AIzaSyDiLbc_PiVR1EVoLRJlZvNZYSMxb2rEE54",
authDomain: "onboarding-consultoria.firebaseapp.com",
projectId: "onboarding-consultoria",
storageBucket: "onboarding-consultoria.firebasestorage.app",
messagingSenderId: "658269586608",
appId: "1:658269586608:web:991d2c39d6f1664aaae775"
};

// Inicialização Segura (Singleton Pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);