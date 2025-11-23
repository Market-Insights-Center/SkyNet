import React, { useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateEmail,
    updatePassword,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const AuthContext = React.createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function signup(email, password, additionalData = {}) {
        return createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                // Create user document in Firestore
                try {
                    await setDoc(doc(db, "users", user.uid), {
                        email: user.email,
                        createdAt: new Date(),
                        ...additionalData
                    });
                } catch (error) {
                    console.error("Error creating user document:", error);
                }
                return user;
            });
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function loginWithGoogle(additionalData = {}) {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider)
            .then(async (result) => {
                const user = result.user;
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    // New user via Google: Save profile + questionnaire data
                    await setDoc(doc(db, "users", user.uid), {
                        email: user.email,
                        createdAt: new Date(),
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        ...additionalData
                    });
                } else {
                    // Existing user: Update questionnaire if provided
                    if (Object.keys(additionalData).length > 0) {
                        await setDoc(doc(db, "users", user.uid), additionalData, { merge: true });
                    }
                }
                return user;
            });
    }

    function logout() {
        return signOut(auth);
    }

    function resetPassword(email) {
        return sendPasswordResetEmail(auth, email);
    }

    function updateUserEmail(email) {
        return updateEmail(currentUser, email);
    }

    function updateUserPassword(password) {
        return updatePassword(currentUser, password);
    }

    function updateUsername(username) {
        return updateProfile(currentUser, { displayName: username })
            .then(() => {
                return setDoc(doc(db, "users", currentUser.uid), { displayName: username }, { merge: true });
            });
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        login,
        signup,
        loginWithGoogle,
        logout,
        resetPassword,
        updateUserEmail,
        updateUserPassword,
        updateUsername
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}