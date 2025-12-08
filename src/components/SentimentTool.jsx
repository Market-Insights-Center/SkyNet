import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Activity, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const SentimentTool = ({ email }) => {
    const [ticker, setTicker] = useState('');
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
            const response = await fetch(`${API_BASE_URL}/api/sentiment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
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

    return (
        <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 transition-colors duration-300 hover:border-gold/50">
                <form onSubmit={handleAnalyze} className="flex gap-4">
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        placeholder="Enter Ticker (e.g. TSLA)"
                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold uppercase font-mono tracking-wider"
                    />
                    <button
                        type="submit"
                        disabled={loading || !ticker}
                        className={`px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <Activity className="animate-spin" /> : <Search size={20} />}
                        {loading ? 'Analyzing...' : 'Analyze'}
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Activity className="text-gold" /> Sentiment Analysis: {result.ticker}
                        </h2>

                        <div className="flex flex-col md:flex-row gap-8 items-center justify-center mb-8 p-6 bg-black/30 rounded-xl border border-white/5">
                            <div className="text-center">
                                <div className="text-sm text-gray-400 mb-1">Raw Sentiment Score</div>
                                <div className="text-4xl font-bold text-white font-mono">{result.sentiment_score_raw?.toFixed(4)}</div>
                            </div>
                            <div className="h-12 w-[1px] bg-white/10 hidden md:block"></div>
                            <div className="text-center">
                                <div className="text-sm text-gray-400 mb-1">Score (Rounded 0.1)</div>
                                <div className={`text-4xl font-bold font-mono ${result.sentiment_score_rounded_01 > 0 ? 'text-green-400' : result.sentiment_score_rounded_01 < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                    {result.sentiment_score_rounded_01}
                                </div>
                            </div>
                        </div>

                        {/* Bull/Bear Intensity Bar */}
                        <div className="mb-8 p-4 bg-black/30 rounded-xl border border-white/5">
                            <div className="flex justify-between text-sm text-gray-400 mb-2">
                                <span className="flex items-center gap-1 text-red-400"><TrendingDown size={14} /> Bearish Intensity</span>
                                <span className="flex items-center gap-1 text-green-400">Bullish Intensity <TrendingUp size={14} /></span>
                            </div>
                            <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex relative">
                                {/* Center Marker */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white/20 z-10 transform -translate-x-1/2"></div>

                                {/* Bear Bar (Left) */}
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(0, ((-result.sentiment_score_raw + 1) / 2) * 50)}%` }} // Very rough viz logic, refining...
                                    // Actually, let's stick to the CLI logic: 
                                    // bear_intensity = ((-score + 1) / 2) * 10 (scale 0-10)
                                    // If score is -0.5: (0.5+1)/2 * 100 = 75% bearishness? No.
                                    // Let's just create two bars from center.
                                    className=""
                                />

                                {/* Let's try a simpler centered bar approach */}
                                <div className="w-1/2 flex justify-end">
                                    {result.sentiment_score_raw < 0 && (
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.abs(result.sentiment_score_raw) * 100}%` }}
                                            className="h-full bg-red-500 rounded-l-full"
                                        />
                                    )}
                                </div>
                                <div className="w-1/2 flex justify-start">
                                    {result.sentiment_score_raw > 0 && (
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${result.sentiment_score_raw * 100}%` }}
                                            className="h-full bg-green-500 rounded-r-full"
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="text-center text-xs text-gray-500 mt-2">
                                -1.0 (Max Bear) &nbsp;&nbsp; 0 (Neutral) &nbsp;&nbsp; +1.0 (Max Bull)
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gold mb-2">AI Summary</h3>
                                <p className="text-gray-300 leading-relaxed bg-black/20 p-4 rounded-lg border border-white/5">
                                    {result.summary}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-bold text-green-400 mb-2">Positive Driver Keywords</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {result.positive_keywords?.length > 0 ? (
                                            result.positive_keywords.map((kw, i) => (
                                                <span key={i} className="px-3 py-1 bg-green-500/10 text-green-300 border border-green-500/30 rounded-full text-sm">
                                                    {kw}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-500 italic">None identified</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-red-400 mb-2">Negative Driver Keywords</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {result.negative_keywords?.length > 0 ? (
                                            result.negative_keywords.map((kw, i) => (
                                                <span key={i} className="px-3 py-1 bg-red-500/10 text-red-300 border border-red-500/30 rounded-full text-sm">
                                                    {kw}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-500 italic">None identified</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default SentimentTool;
