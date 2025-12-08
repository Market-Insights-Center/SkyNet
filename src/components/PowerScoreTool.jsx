import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Zap, AlertTriangle, Info } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const PowerScoreTool = ({ email }) => {
    const [ticker, setTicker] = useState('');
    const [sensitivity, setSensitivity] = useState(2);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Analysis failed');
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 70) return 'text-green-400';
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
                        {loading ? <Zap className="animate-pulse" /> : <Search size={20} />}
                        {loading ? 'Calculating...' : 'PowerScore'}
                    </button>
                </form>
                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        {error}
                    </div>
                )}
            </div>

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

                        {/* Component Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                            {[
                                { label: 'Market', val: result.prime_scores?.R, desc: 'Market Environment' },
                                { label: 'Beta/Corr', val: result.prime_scores?.AB, desc: 'Risk Profile' },
                                { label: 'Volatility', val: result.prime_scores?.AA, desc: 'Price Stability' },
                                { label: 'Fundam.', val: result.prime_scores?.F, desc: 'Financial Health' },
                                { label: 'Technicals', val: result.prime_scores?.Q, desc: 'Price Action' },
                                { label: 'Sentiment', val: result.prime_scores?.S, desc: 'Social/News' },
                                { label: 'ML Forecast', val: result.prime_scores?.M, desc: 'AI Prediction' },
                            ].map((item, i) => (
                                <div key={i} className="bg-black/40 rounded-lg p-3 border border-white/5">
                                    <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                                    <div className={`text-xl font-bold ${getScoreColor(item.val)}`}>
                                        {item.val !== null && item.val !== undefined ? item.val.toFixed(1) : 'N/A'}
                                    </div>
                                </div>
                            ))}
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
