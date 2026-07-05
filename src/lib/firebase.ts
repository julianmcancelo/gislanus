import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getDataConnect, connectDataConnectEmulator } from "firebase/data-connect";
import { connectorConfig } from "./dataconnect";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Data Connect
const dataConnect = getDataConnect(app, connectorConfig);
// Para desarrollo local, conectarse al emulador de Data Connect
if (process.env.NODE_ENV === 'development') {
  // connectDataConnectEmulator(dataConnect, 'localhost', 9399);
}

const googleProvider = new GoogleAuthProvider();

export { app, auth, db, rtdb, googleProvider, dataConnect };
