import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDP_Rt1QWEg23wZMM4yK8VyAwK83YnqRZA",
  authDomain: "marketinsightscenter.com",
  projectId: "project-mayhem-f6704",
  storageBucket: "project-mayhem-f6704.firebasestorage.app",
  messagingSenderId: "402353663952",
  appId: "1:402353663952:web:551f2bc99da32e7e0d93d5",
  measurementId: "G-PRT2JBGCSF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize services and export them so the rest of the app can use them
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;