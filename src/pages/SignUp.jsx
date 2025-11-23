import React, { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import WaveBackground from "../components/WaveBackground";

export default function SignUp() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();
    const { signup } = useAuth();
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

    async function handleSubmit(e) {
        e.preventDefault();

        if (passwordRef.current.value !== passwordConfirmRef.current.value) {
            return setError("Passwords do not match");
        }

        try {
            setError("");
            setLoading(true);

            const questionnaireData = {
                riskTolerance,
                tradingFrequency: tradingFrequency === "Other" ? otherFrequency : tradingFrequency,
                portfolioTypes: portfolioTypes.includes("Other") ? [...portfolioTypes.filter(t => t !== "Other"), otherPortfolioType] : portfolioTypes
            };

            await signup(emailRef.current.value, passwordRef.current.value, questionnaireData);
            navigate("/profile");
        } catch (err) {
            setError("Failed to create an account: " + err.message);
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
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* STEP 1: Account Details */}
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

                    {/* STEP 2: Questionnaire */}
                    {step === 2 && (
                        <div className="space-y-6">

                            {/* Risk Tolerance */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Risk Tolerance (1 - 10)
                                </label>
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
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    How Often Do You Want To Trade?
                                </label>
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
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    What Kind of Investment Portfolio Would You Like?
                                </label>
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

                            <div className="flex justify-between pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-gray-400 hover:text-white flex items-center gap-2"
                                >
                                    <ChevronLeft size={18} /> Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : "Create Account"}
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
