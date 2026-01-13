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
    signInWithPopup,
    deleteUser
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

    function deleteAccount() {
        return deleteUser(currentUser);
    }

    // QA: Allow mods to temporarily override their tier locally
    function overrideUserTier(tier) {
        if (!currentUser) return;

        // Clone with prototype preservation to keep methods like getIdToken()
        const updatedUser = Object.assign(
            Object.create(Object.getPrototypeOf(currentUser)),
            currentUser
        );

        updatedUser.tier = tier;
        updatedUser.isTestingTier = true;

        setCurrentUser(updatedUser);
    }

    // NEW: Fetch user profile (Tier) from backend
    async function refreshUserProfile(user) {
        if (!user || !user.email) return;
        try {
            // Pass uid to allow auto-creation if missing, and displayName as preferred username
            const displayName = user.displayName ? encodeURIComponent(user.displayName) : "";
            const res = await fetch(`/api/user/profile?email=${user.email}&uid=${user.uid}&username=${displayName}`);
            const profile = await res.json();

            // CRITICAL FIX: Preserve prototype chain
            Object.assign(user, profile);

            // Force update with new properties while keeping methods
            const updatedUser = Object.assign(
                Object.create(Object.getPrototypeOf(user)),
                user
            );
            setCurrentUser(updatedUser);
        } catch (err) {
            console.error("Failed to fetch user profile", err);
            // Even if fetch fails, set the auth user so app doesn't hang
            // setCurrentUser(user); // Already set in onAuthStateChanged
        }
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch extra data (Tier) in background BEFORE setting loading to false
                // This ensures components don't redirect due to missing profile data
                await refreshUserProfile(user);

                setCurrentUser(user);
                setLoading(false);
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
        deleteAccount,
        refreshUserProfile,
        fetchUserProfile: refreshUserProfile,
        overrideUserTier,
        loading, // Expose loading state
        userProfile: currentUser // Expose currentUser as userProfile for compatibility
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}