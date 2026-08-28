import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuración de Firebase leída desde variables de entorno.
// 1) Copiá el archivo .env.example a .env (desarrollo local) o configuralas
//    en Netlify → Site settings → Environment variables (producción).
// 2) Pegá tus credenciales reales de Firebase.
// El archivo .env NO se sube a GitHub (está en .gitignore).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// true solo si TODAS las variables de entorno están configuradas.
// Evita que la app explote en una página en blanco cuando faltan.
export const firebaseReady = Object.values(firebaseConfig).every((value) => Boolean(value));

const app = firebaseReady ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;
