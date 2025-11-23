import React, { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, CheckCircle, LogOut, User, Lock, Mail } from "lucide-react";
import WaveBackground from "../components/WaveBackground";

export default function Profile() {
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const { currentUser, logout, updateUsername, updateUserPassword } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const usernameRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();

    async function handleLogout() {
        setError("");
        try {
            await logout();
            navigate("/login");
        } catch {
            setError("Failed to log out");
        }
    }

    async function handleUpdateProfile(e) {
        e.preventDefault();
        const promises = [];
        setLoading(true);
        setError("");
        setMessage("");

        if (usernameRef.current.value !== currentUser.displayName) {
            promises.push(updateUsername(usernameRef.current.value));
        }
        if (passwordRef.current.value) {
            if (passwordRef.current.value !== passwordConfirmRef.current.value) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }
            promises.push(updateUserPassword(passwordRef.current.value));
        }

        Promise.all(promises)
            .then(() => {
                setMessage("Profile updated successfully");
            })
            .catch((err) => {
                setError("Failed to update account: " + err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    }

    return (
        <div className="relative min-h-screen bg-black text-white flex flex-col items-center pt-24 pb-10 overflow-hidden">
            <WaveBackground />

            <div className="relative z-10 w-full max-w-2xl p-8 bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-gold-400 bg-clip-text text-transparent text-gold-400">
                        Profile
                    </h2>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                    >
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 flex items-center gap-2">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {message && (
                    <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-lg mb-4 flex items-center gap-2">
                        <CheckCircle size={18} />
                        <span>{message}</span>
                    </div>
                )}

                <div className="mb-8 p-4 bg-black/30 rounded-lg border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl font-bold">
                            {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : currentUser?.email[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-white">{currentUser?.displayName || "User"}</h3>
                            <p className="text-gray-400 text-sm">{currentUser?.email}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                            <User size={16} /> Display Name
                        </label>
                        <input
                            type="text"
                            ref={usernameRef}
                            defaultValue={currentUser?.displayName}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Enter display name"
                        />
                    </div>

                    <div className="pt-4 border-t border-white/10">
                        <h4 className="text-lg font-medium text-gray-200 mb-4">Change Password</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                                    <Lock size={16} /> New Password
                                </label>
                                <input
                                    type="password"
                                    ref={passwordRef}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="Leave blank to keep same"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                                    <Lock size={16} /> Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    ref={passwordConfirmRef}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="Leave blank to keep same"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Updating..." : "Update Profile"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
