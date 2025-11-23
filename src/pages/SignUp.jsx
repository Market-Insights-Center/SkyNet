import React, { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import WaveBackground from "../components/WaveBackground";

export default function SignUp() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();
    const { signup, loginWithGoogle } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Account, 2: Questionnaire

    // Questionnaire State
    const [riskTolerance, setRiskTolerance] = useState(5);
    const [tradingFrequency, setTradingFrequency] = useState("");
    const [portfolioTypes, setPortfolioTypes] = useState([]);
    const [otherFrequency, setOtherFrequency] = useState("");
    const [otherPortfolioType, setOtherPortfolioType] = useState("");

    const handlePortfolioTypeChange = (type) => {
        setPortfolioTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const getQuestionnaireData = () => ({
        riskTolerance,
        tradingFrequency: tradingFrequency === "Other" ? otherFrequency : tradingFrequency,
        portfolioTypes: portfolioTypes.includes("Other") ? [...portfolioTypes.filter(t => t !== "Other"), otherPortfolioType] : portfolioTypes
    });

    async function handleSubmit(e) {
        e.preventDefault();

        if (passwordRef.current.value !== passwordConfirmRef.current.value) {
            return setError("Passwords do not match");
        }

        try {
            setError("");
            setLoading(true);
            await signup(emailRef.current.value, passwordRef.current.value, getQuestionnaireData());
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
        }
        setLoading(false);
    }

    async function handleGoogleSignUp() {
        try {
            setError("");
            setLoading(true);
            await loginWithGoogle(getQuestionnaireData());
            navigate("/profile");
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/configuration-not-found') {
                setError("Google Sign-In is disabled in the Firebase Console.");
            } else {
                setError("Failed to sign up with Google: " + err.message);
            }
        }
        setLoading(false);
    }

    return (
        <div className="relative min-h-screen bg-black text-white flex items-center justify-center overflow-hidden py-10">
            <WaveBackground />

            <div className="relative z-10 w-full max-w-2xl p-8 bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <h2 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-gold-400 bg-clip-text text-transparent text-gold-400">
                    {step === 1 ? "Create Account" : "Investor Profile"}
                </h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 flex items-center gap-2">
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {step === 1 && (
                        <div className="space-y-4">
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
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition-all flex items-center gap-2"
                                >
                                    Next <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Risk Tolerance */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Risk Tolerance (1 - 10)</label>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-400">Low Risk</span>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={riskTolerance}
                                        onChange={(e) => setRiskTolerance(e.target.value)}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                    <span className="text-sm text-gray-400">High Risk</span>
                                </div>
                                <div className="text-center text-purple-400 font-bold mt-1">{riskTolerance}</div>
                            </div>

                            {/* Trading Frequency */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">How Often Do You Want To Trade?</label>
                                <div className="space-y-2">
                                    {["Once A Quarter Or Less Often", "Once A Month", "Once A Week", "Every Other Day", "Every Day Or More Often", "Other"].map((freq) => (
                                        <label key={freq} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="frequency"
                                                value={freq}
                                                checked={tradingFrequency === freq}
                                                onChange={(e) => setTradingFrequency(e.target.value)}
                                                className="accent-purple-500"
                                            />
                                            <span className="text-gray-300 text-sm">{freq}</span>
                                            {freq === "Other" && tradingFrequency === "Other" && (
                                                <input
                                                    type="text"
                                                    className="ml-2 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                                                    placeholder="Please specify"
                                                    value={otherFrequency}
                                                    onChange={(e) => setOtherFrequency(e.target.value)}
                                                />
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Portfolio Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">What Kind of Investment Portfolio Would You Like?</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        "Low Risk", "Medium Risk", "High Risk",
                                        "Stocks", "ETFs", "Options",
                                        "Crypto", "Indexs", "Futures",
                                        "Sector Specific", "M.I.C. Algorithm Strategies", "Other"
                                    ].map((type) => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                value={type}
                                                checked={portfolioTypes.includes(type)}
                                                onChange={() => handlePortfolioTypeChange(type)}
                                                className="accent-purple-500"
                                            />
                                            <span className="text-gray-300 text-sm">{type}</span>
                                        </label>
                                    ))}
                                </div>
                                {portfolioTypes.includes("Other") && (
                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
                                            placeholder="Please specify other options"
                                            value={otherPortfolioType}
                                            onChange={(e) => setOtherPortfolioType(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between pt-4 border-t border-white/10 gap-4">
                                <button type="button" onClick={() => setStep(1)} className="text-gray-400 hover:text-white flex items-center gap-2">
                                    <ChevronLeft size={18} /> Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : "Create Account"}
                                </button>
                            </div>

                            {/* Google Sign Up Button */}
                            <div className="pt-2">
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
                        </div>
                    )}
                </form>

                <div className="w-full text-center mt-6 text-sm text-gray-400">
                    Already have an account? <Link to="/login" className="text-purple-400 hover:text-purple-300">Log In</Link>
                </div>
            </div>
        </div>
    );
}