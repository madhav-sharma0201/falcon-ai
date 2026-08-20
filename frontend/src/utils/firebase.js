
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "fresher-ai-dbe6a.firebaseapp.com",
  projectId: "fresher-ai-dbe6a",
  storageBucket: "fresher-ai-dbe6a.firebasestorage.app",
  messagingSenderId: "3354943916",
  appId: "1:3354943916:web:0ee4ea6109791578dcda09",
  measurementId: "G-YS2TY18T34"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app)

const provider = new GoogleAuthProvider()

export { auth , provider}