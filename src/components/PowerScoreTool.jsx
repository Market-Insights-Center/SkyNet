import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Zap, AlertTriangle, Info, CheckCircle, Loader, XCircle, Circle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const STEPS_CONFIG = [
    { key: 'R', label: 'Market Score' },
    { key: 'AB', label: 'Beta/Correlation' },
    { key: 'AA', label: 'Volatility' },
    { key: 'F', label: 'Fundamentals' },
    { key: 'Q', label: 'Technicals' },
    { key: 'S', label: 'Sentiment' },
    { key: 'M', label: 'ML Forecast' },
];

const PowerScoreTool = ({ email }) => {
    const [ticker, setTicker] = useState('');
    const [sensitivity, setSensitivity] = useState(2);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Progress State
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState("");
    const [stepStatus, setStepStatus] = useState({}); // { Key: { status: 'pending'|'loading'|'done'|'error', val: ... } }

    const resetState = () => {
        setResult(null);
        setError(null);
        setProgress(0);
        setStatusMsg("Initializing...");
        const initialSteps = {};
        STEPS_CONFIG.forEach(s => initialSteps[s.key] = { status: 'pending', val: null });
        setStepStatus(initialSteps);
    };

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        setLoading(true);
        resetState();

        try {
            const response = await fetch(`${API_BASE_URL}/api/powerscore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    sensitivity: parseInt(sensitivity),
                    email: email || ''
                })
            });

            if (!response.ok) {
                // Try to parse error
                let errMsg = `HTTP Error: ${response.status}`;
                try {
                    const errData = await response.json();
                    if (errData.detail) errMsg = errData.detail;
                } catch (e) { }
                throw new Error(errMsg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);

                        if (event.type === 'status') {
                            setStatusMsg(event.message);
                            if (event.progress) setProgress(event.progress);
                        }
                        else if (event.type === 'step_start') {
                            setStepStatus(prev => ({
                                ...prev,
                                [event.key]: { status: 'loading', val: null }
                            }));
                            if (event.progress) setProgress(event.progress);
                        }
                        else if (event.type === 'step_complete') {
                            setStepStatus(prev => ({
                                ...prev,
                                [event.key]: { status: 'done', val: event.value }
                            }));
                            if (event.progress) setProgress(event.progress);
                        }
                        else if (event.type === 'result') {
                            setResult(event.payload);
                            setProgress(100);
                        }
                        else if (event.type === 'error') {
                            throw new Error(event.message);
                        }
                    } catch (err) {
                        console.error("Stream Parse Error:", err, line);
                    }
                }
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score === null || score === undefined) return 'text-gray-500';
        if (score > 60) return 'text-green-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 transition-colors duration-300 hover:border-gold/50">
                <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        placeholder="Enter Ticker (e.g. NVDA)"
                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold uppercase font-mono tracking-wider"
                    />
                    <select
                        value={sensitivity}
                        onChange={(e) => setSensitivity(e.target.value)}
                        className="bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold"
                    >
                        <option value={1}>Sensitivity 1 (Long Term)</option>
                        <option value={2}>Sensitivity 2 (Mid Term)</option>
                        <option value={3}>Sensitivity 3 (Short Term)</option>
                    </select>
                    <button
                        type="submit"
                        disabled={loading || !ticker}
                        className={`px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 justify-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading && !result ? <Zap className="animate-pulse" /> : <Search size={20} />}
                        {loading && !result ? 'Calculating...' : 'PowerScore'}
                    </button>
                </form>
                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        {error}
                    </div>
                )}
            </div>

            {/* PROGRESS & CHECKLIST (Visible during load or if result exists) */}
            {(loading || result) && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Progress Bar */}
                    {!result && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between text-sm text-gray-400 mb-2">
                                <span>{statusMsg || "Processing..."}</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-purple-500 to-gold"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Checklist Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {STEPS_CONFIG.map((step) => {
                            const info = stepStatus[step.key] || { status: 'pending' };
                            let icon = <Circle size={16} className="text-gray-600" />; // Pending
                            let textColor = "text-gray-500";
                            let borderColor = "border-white/5";

                            if (info.status === 'loading') {
                                icon = <Loader size={16} className="text-blue-400 animate-spin" />;
                                textColor = "text-blue-400";
                                borderColor = "border-blue-500/30";
                            } else if (info.status === 'done') {
                                if (info.val === null || info.val === undefined) {
                                    // Done but null/failed -> Treat as skipped/error
                                    icon = <XCircle size={16} className="text-red-400" />;
                                    textColor = "text-red-400 opacity-60";
                                    borderColor = "border-red-500/10";
                                } else {
                                    icon = <CheckCircle size={16} className="text-green-400" />;
                                    textColor = "text-green-400";
                                    borderColor = "border-green-500/30";
                                }
                            }

                            // If result exists, we reuse this grid or hide it? 
                            // User asked for "updates as each part ... and what is left".
                            // When finished, the main result card shows everything.
                            // But let's keep this as a secondary "Data Source status" view or hide it when done.
                            // The user said "do not display that part if failed".

                            // Let's hide this checklist ONLY when the main result is fully ready to take over, 
                            // OR keep it small.
                            // I'll keep it visible but maybe smaller or less prominent if done.

                            if (result) return null; // Hide checklist when result shows up, as result has its own grid

                            return (
                                <div key={step.key} className={`flex items-center gap-3 p-3 rounded-lg border ${borderColor} bg-black/20 transition-all`}>
                                    {icon}
                                    <span className={`text-sm font-medium ${textColor}`}>{step.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {result && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                >
                    {/* Main Score Card */}
                    <div className="bg-gradient-to-br from-white/10 to-black border border-gold/30 rounded-2xl p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent"></div>
                        <h2 className="text-3xl font-bold mb-2 text-white">{result.ticker} PowerScore</h2>
                        <div className="text-sm text-gold uppercase tracking-widest mb-6">Sensitivity Level {sensitivity}</div>

                        <div className="flex justify-center items-center mb-6">
                            <div className={`text-8xl font-black ${getScoreColor(result.powerscore)} drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]`}>
                                {result.powerscore?.toFixed(1)}
                            </div>
                        </div>

                        {/* Component Grid - Only show valid ones */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                            {[
                                { label: 'Market', val: result.prime_scores?.R, desc: 'Market Environment' },
                                { label: 'Beta/Corr', val: result.prime_scores?.AB, desc: 'Risk Profile' },
                                { label: 'Volatility', val: result.prime_scores?.AA, desc: 'Price Stability' },
                                { label: 'Fundam.', val: result.prime_scores?.F, desc: 'Financial Health' },
                                { label: 'Technicals', val: result.prime_scores?.Q, desc: 'Price Action' },
                                { label: 'Sentiment', val: result.prime_scores?.S, desc: 'Social/News' },
                                { label: 'ML Forecast', val: result.prime_scores?.M, desc: 'AI Prediction' },
                            ].map((item, i) => {
                                // Logic: "if a part... fails and returns 0... do not display"
                                // I assume "fails" means None, or maybe exactly 0.0 if derived from error.
                                // My backend returns None if skipped.
                                if (item.val === null || item.val === undefined) return null;

                                return (
                                    <div key={i} className="bg-black/40 rounded-lg p-3 border border-white/5">
                                        <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                                        <div className={`text-xl font-bold ${getScoreColor(item.val)}`}>
                                            {item.val.toFixed(1)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-gold mb-3 flex items-center gap-2">
                            <Info size={20} /> AI Analyst Insight
                        </h3>
                        <p className="text-gray-300 leading-relaxed italic">
                            "{result.ai_explanation}"
                        </p>
                    </div>

                </motion.div>
            )}
        </div>
    );
};

export default PowerScoreTool;
