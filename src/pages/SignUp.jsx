import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import MagneticButton from '../components/MagneticButton';
import WaveBackground from '../components/WaveBackground';

export default function SignUp() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();
    const usernameRef = useRef();
    // Get currentUser and global loading state
    const { signup, loginWithGoogle, updateUsername, currentUser, loading: authLoading } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Redirect if already logged in (e.g. returning from Google Redirect)
    useEffect(() => {
        if (currentUser) {
            navigate("/profile");
        }
    }, [currentUser, navigate]);

    async function handleSubmit(e) {
        e.preventDefault();

        if (passwordRef.current.value !== passwordConfirmRef.current.value) {
            return setError("Passwords do not match");
        }

        const username = usernameRef.current.value.trim();
        if (!username) {
            return setError("Username is required");
        }

        try {
            setError("");
            setLoading(true);

            // 1. Check Username Uniqueness
            const checkRes = await fetch('/api/auth/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const checkData = await checkRes.json();

            if (!checkData.available) {
                setLoading(false);
                return setError(checkData.message || "Username is already taken");
            }

            // 2. Create Auth User
            await signup(emailRef.current.value, passwordRef.current.value);

            // 3. Update Username (Display Name)
            await updateUsername(username);

            navigate("/profile");
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/configuration-not-found') {
                setError("Sign-in provider is disabled in the Firebase Console.");
            } else if (err.code === 'auth/email-already-in-use') {
                setError("Email already in use. Please log in.");
            } else {
                setError("Failed to create an account: " + err.message);
            }
            setLoading(false);
        }
    }

    async function handleGoogleSignUp() {
        try {
            setError("");
            setLoading(true);
            await loginWithGoogle();
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/configuration-not-found') {
                setError("Google Sign-In is disabled in the Firebase Console.");
            } else {
                setError("Failed to sign up with Google: " + err.message);
            }
            setLoading(false);
        }
    }

    // If global auth is loading (checking session), show spinner
    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-purple-500" size={48} />
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-black text-white flex items-center justify-center overflow-hidden py-10">
            <WaveBackground />

            <div className="relative z-10 w-full max-w-md p-8 bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <h2 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-gold-400 bg-clip-text text-transparent text-gold-400">
                    Create Account
                </h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 flex items-center gap-2">
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                        <input
                            type="text"
                            ref={usernameRef}
                            required
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Choose a unique username"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input
                            type="email"
                            ref={emailRef}
                            required
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Enter your email"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <input
                            type="password"
                            ref={passwordRef}
                            required
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Create a password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                        <input
                            type="password"
                            ref={passwordConfirmRef}
                            required
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Confirm your password"
                        />
                    </div>

                    <MagneticButton
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Create Account"}
                    </MagneticButton>
                </form>

                <div className="pt-4 border-t border-white/10 mt-6">
                    <p className="text-center text-gray-400 text-sm mb-3">Or continue with</p>
                    <button
                        type="button"
                        onClick={handleGoogleSignUp}
                        disabled={loading}
                        className="w-full bg-white text-black font-bold py-2 px-4 rounded-lg hover:bg-gray-200 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign Up with Google
                    </button>
                </div>

                <div className="w-full text-center mt-6 text-sm text-gray-400">
                    Already have an account? <Link to="/login" className="text-purple-400 hover:text-purple-300">Log In</Link>
                </div>
            </div>
        </div>
    );
}