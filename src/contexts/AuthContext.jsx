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
    const [isMod, setIsMod] = useState(false);
    const [isSuperMod, setIsSuperMod] = useState(false);

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
                    console.error("Error creating user document (Offline or Permission Issue):", error);
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

                // Wrap Firestore operations in a try-catch so auth doesn't fail if DB is unreachable
                try {
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
                } catch (error) {
                    // Log the error but allow the user to proceed with login
                    console.warn("Firestore profile sync failed. Client might be offline or DB missing.", error);
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

    useEffect(() => {
        async function checkModStatus() {
            if (currentUser) {
                try {
                    const response = await fetch('http://localhost:8000/api/mods');
                    if (response.ok) {
                        const data = await response.json();
                        const mods = data.mods || [];
                        const userEmail = currentUser.email;
                        setIsMod(mods.includes(userEmail));
                        setIsSuperMod(userEmail === "marketinsightscenter@gmail.com");
                    }
                } catch (error) {
                    console.error("Failed to fetch mod list:", error);
                }
            } else {
                setIsMod(false);
                setIsSuperMod(false);
            }
        }
        checkModStatus();
    }, [currentUser]);

    const value = {
        currentUser,
        isMod,
        isSuperMod,
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