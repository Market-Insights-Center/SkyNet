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
        // Use popup for Google Auth to avoid redirect loops
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
            // Pass uid to allow auto-creation if missing, and displayName as preferred username
            const displayName = user.displayName ? encodeURIComponent(user.displayName) : "";
            const res = await fetch(`/api/user/profile?email=${user.email}&uid=${user.uid}&username=${displayName}`);
            const profile = await res.json();

            // CRITICAL FIX: Do NOT spread the user object ({...user}).
            // It destroys Firebase User prototype methods (like getIdToken, delete, etc.).
            // Instead, attach profile data directly to the user object.
            Object.assign(user, profile);

            // Force update with new properties
            setCurrentUser({ ...user });
        } catch (err) {
            console.error("Failed to fetch user profile", err);
            // Even if fetch fails, set the auth user so app doesn't hang
            // setCurrentUser(user); // Already set in onAuthStateChanged
        }
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // OPTIMIZATION: Set user immediately to unblock UI
                setCurrentUser(user);
                setLoading(false);

                // Fetch extra data (Tier) in background
                await refreshUserProfile(user);
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
        refreshUserProfile,
        fetchUserProfile: refreshUserProfile,
        loading, // Expose loading state
        userProfile: currentUser // Expose currentUser as userProfile for compatibility
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}