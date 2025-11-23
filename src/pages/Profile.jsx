import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, CheckCircle, LogOut, User, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import WaveBackground from "../components/WaveBackground";
import { motion, AnimatePresence } from "framer-motion";

export default function Profile() {
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const { currentUser, logout, updateUsername, updateUserPassword } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);

    const usernameRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();

    // Questionnaire State
    const [riskTolerance, setRiskTolerance] = useState(5);
    const [tradingFrequency, setTradingFrequency] = useState("");
    const [portfolioTypes, setPortfolioTypes] = useState([]);
    const [otherFrequency, setOtherFrequency] = useState("");
    const [otherPortfolioType, setOtherPortfolioType] = useState("");
    const [qLoading, setQLoading] = useState(false);
    const [qError, setQError] = useState("");

    // Check for existing profile data on mount
    useEffect(() => {
        async function checkProfile() {
            if (currentUser) {
                try {
                    const docRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // If critical data is missing, show questionnaire
                        if (!data.risk_tolerance || !data.trading_frequency) {
                            setShowQuestionnaire(true);
                        }
                    } else {
                        // No doc exists at all
                        setShowQuestionnaire(true);
                    }
                } catch (e) {
                    console.error("Error checking profile:", e);
                }
            }
        }
        checkProfile();
    }, [currentUser]);

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

    // Questionnaire Handlers
    const handlePortfolioTypeChange = (type) => {
        setPortfolioTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const saveProfileToBackend = async (uid, email, data) => {
        try {
            const body = {
                user_id: uid,
                email: email,
                risk_tolerance: parseInt(data.risk_tolerance),
                trading_frequency: data.trading_frequency,
                portfolio_types: data.portfolio_types
            };
            await fetch('http://localhost:8000/api/save_user_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } catch (e) {
            console.error("Failed to save profile to CSV backend", e);
        }
    };

    const handleQuestionnaireSubmit = async (e) => {
        e.preventDefault();
        setQLoading(true);
        setQError("");

        const profileData = {
            risk_tolerance: riskTolerance,
            trading_frequency: tradingFrequency === "Other" ? otherFrequency : tradingFrequency,
            portfolio_types: portfolioTypes.includes("Other") ? [...portfolioTypes.filter(t => t !== "Other"), otherPortfolioType] : portfolioTypes
        };

        if (!profileData.trading_frequency) {
            setQError("Please select a trading frequency.");
            setQLoading(false);
            return;
        }

        try {
            // 1. Save to Firestore
            await setDoc(doc(db, "users", currentUser.uid), profileData, { merge: true });
            
            // 2. Save to Backend CSV
            await saveProfileToBackend(currentUser.uid, currentUser.email, profileData);

            setShowQuestionnaire(false);
            setMessage("Profile setup complete!");
        } catch (err) {
            console.error(err);
            setQError("Failed to save profile: " + err.message);
        } finally {
            setQLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-black text-white flex flex-col items-center pt-24 pb-10 overflow-hidden">
            <WaveBackground />

            <div className="relative z-10 w-full max-w-2xl p-8 bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                
                {/* Back Button */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> 
                        Back to Portfolio Lab
                    </button>
                </div>

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
                            {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : currentUser?.email?.[0]?.toUpperCase() || "U"}
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

            {/* Questionnaire Modal */}
            <AnimatePresence>
                {showQuestionnaire && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-gray-900 border border-gold/30 rounded-2xl p-8 max-w-2xl w-full shadow-2xl relative my-8"
                        >
                            <h2 className="text-2xl font-bold text-center mb-2 text-gold">Complete Your Profile</h2>
                            <p className="text-gray-400 text-center mb-6">Tell us a bit about your investment style to unlock full features.</p>

                            {qError && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm">
                                    {qError}
                                </div>
                            )}

                            <form onSubmit={handleQuestionnaireSubmit} className="space-y-6">
                                {/* Risk Tolerance */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Risk Tolerance (1 - 10)</label>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-gray-400">Low</span>
                                        <input
                                            type="range" min="1" max="10" value={riskTolerance}
                                            onChange={(e) => setRiskTolerance(e.target.value)}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gold"
                                        />
                                        <span className="text-sm text-gray-400">High</span>
                                    </div>
                                    <div className="text-center text-gold font-bold mt-1">{riskTolerance}</div>
                                </div>

                                {/* Trading Frequency */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">How Often Do You Want To Trade</label>
                                    <div className="space-y-2">
                                        {["Once A Quarter Or Less Often", "Once A Month", "Once A Week", "Every Other Day", "Every Day Or More Often", "Other"].map((freq) => (
                                            <label key={freq} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5">
                                                <input
                                                    type="radio" name="frequency" value={freq}
                                                    checked={tradingFrequency === freq}
                                                    onChange={(e) => setTradingFrequency(e.target.value)}
                                                    className="accent-gold"
                                                />
                                                <span className="text-gray-300 text-sm">{freq}</span>
                                                {freq === "Other" && tradingFrequency === "Other" && (
                                                    <input
                                                        type="text" className="ml-2 bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-gold outline-none"
                                                        placeholder="Please specify" value={otherFrequency} onChange={(e) => setOtherFrequency(e.target.value)}
                                                    />
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Portfolio Types */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">What Kind of Investment Portfolio Would You Like</label>
                                    <p className="text-xs text-gray-500 mb-3">Choose As Many Options Apply And Feel Free To Mix And Match Or Specify For The "Other" Option.</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            "Low Risk", "Medium Risk", "High Risk",
                                            "Stocks", "ETFs", "Options",
                                            "Crypto", "Indexs", "Futures",
                                            "Sector Specific", "M.I.C. Algorithm Strategies", "Other"
                                        ].map((type) => (
                                            <label key={type} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5">
                                                <input
                                                    type="checkbox" value={type}
                                                    checked={portfolioTypes.includes(type)}
                                                    onChange={() => handlePortfolioTypeChange(type)}
                                                    className="accent-gold"
                                                />
                                                <span className="text-gray-300 text-sm">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {portfolioTypes.includes("Other") && (
                                        <input
                                            type="text" className="mt-2 w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-gold outline-none"
                                            placeholder="Please specify other options" value={otherPortfolioType} onChange={(e) => setOtherPortfolioType(e.target.value)}
                                        />
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={qLoading}
                                    className="w-full bg-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
                                >
                                    {qLoading ? <Loader2 className="animate-spin" /> : "Save Profile & Continue"}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}