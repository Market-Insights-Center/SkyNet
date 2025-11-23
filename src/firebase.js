import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration derived from project-mayhem-f6704
const firebaseConfig = {
    apiKey: "AIzaSyDP_Rt1QWEg23wZMM4yK8VyAwK83YnqRZA",
    authDomain: "project-mayhem-f6704.firebaseapp.com",
    projectId: "project-mayhem-f6704",
    storageBucket: "project-mayhem-f6704.firebasestorage.app",
    messagingSenderId: "402353663952",
    appId: "1:402353663952:web:551f2bc99da32e7e0d93d5",
    measurementId: "G-PRT2JBGCSF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
