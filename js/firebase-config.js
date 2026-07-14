// js/firebase-config.js
// Configuración compartida de Firebase para el sitio público y el panel /admin.
// La apiKey de un proyecto Firebase es pública por diseño: la seguridad real
// vive en las reglas de Firestore/Storage (firestore.rules y storage.rules),
// no en ocultar esta configuración.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  getStorage,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBEQI0laVNCMzj_LamIHvwBDHp2vEyshY4",
  authDomain: "blogpersonal-8b141.firebaseapp.com",
  projectId: "blogpersonal-8b141",
  storageBucket: "blogpersonal-8b141.firebasestorage.app",
  messagingSenderId: "385538011071",
  appId: "1:385538011071:web:ea117e295a0923ac0afb0a",
  measurementId: "G-TE26ME9DSS",
};

export const app = initializeApp(firebaseConfig);

// Analytics puede fallar en local/incógnito (bloqueadores) — no debe romper el sitio.
try {
  getAnalytics(app);
} catch (e) {
  console.warn("Analytics no disponible:", e.message);
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
