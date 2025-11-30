import React, { useContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateEmail,
    updatePassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";

const AuthContext = React.createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
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

    function updateUsername(name) {
        return updateProfile(currentUser, {
            displayName: name
        });
    }

    // NEW: Fetch user profile (Tier) from backend
    async function refreshUserProfile(user) {
        if (!user || !user.email) return;
        try {
            const res = await fetch(`/api/user/profile?email=${user.email}`);
            const profile = await res.json();
            // Merge profile data (tier) into the user object
            const mergedUser = { ...user, ...profile };
            setCurrentUser(mergedUser);
        } catch (err) {
            console.error("Failed to fetch user profile", err);
            // Even if fetch fails, set the auth user so app doesn't hang
            setCurrentUser(user);
        }
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Fetch extra data (Tier) when user logs in
                refreshUserProfile(user).then(() => setLoading(false));
            } else {
                setCurrentUser(null);
                setLoading(false);
            }
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
        updateUsername,
        refreshUserProfile // Exported so we can call it after payment
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}