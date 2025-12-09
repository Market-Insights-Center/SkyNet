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

                        <div className="flex flex-col items-center justify-center mb-8 p-6 bg-black/30 rounded-xl border border-white/5">
                            <div className="text-center">
                                <div className="text-sm text-gray-400 mb-1 tracking-wider uppercase">Sentiment Score</div>
                                <div className={`text-5xl font-bold font-mono ${result.sentiment_score_raw > 0.2 ? 'text-green-500' :
                                    result.sentiment_score_raw < -0.2 ? 'text-red-500' :
                                        'text-yellow-500'
                                    }`}>
                                    {result.sentiment_score_raw?.toFixed(3)}
                                </div>
                            </div>
                        </div>

                        {/* Sentiment Visualization Bar */}
                        <div className="mb-8 p-6 bg-black/30 rounded-xl border border-white/5 relative">
                            <div className="flex justify-between text-xs text-gray-500 mb-2 font-mono uppercase tracking-widest">
                                <span>Bearish (-1.0)</span>
                                <span>Neutral</span>
                                <span>Bullish (+1.0)</span>
                            </div>

                            {/* Main Bar Track */}
                            <div className="h-6 bg-gray-800/50 rounded-full relative w-full overflow-visible">
                                {/* Center Marker */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white/10 z-0 transform -translate-x-1/2 h-full"></div>

                                {/* Dynamic Fill Bar */}
                                {/* Logic: Fill from center (0) to the score. Color depends on the value range. */}
                                {(() => {
                                    const score = result.sentiment_score_raw || 0;
                                    const constrainedScore = Math.max(-1, Math.min(1, score));
                                    const widthPercent = Math.abs(constrainedScore) * 50; // 0 to 50% width

                                    // Determine Color
                                    let barColor = 'bg-yellow-500';
                                    if (constrainedScore > 0.2) barColor = 'bg-green-500';
                                    if (constrainedScore < -0.2) barColor = 'bg-red-500';

                                    // Start Position: If positive, start at 50%. If negative, start at 50% - width.
                                    const leftPercent = constrainedScore >= 0 ? 50 : 50 - widthPercent;

                                    return (
                                        <motion.div
                                            initial={{ width: 0, left: '50%' }}
                                            animate={{ width: `${widthPercent}%`, left: `${leftPercent}%` }}
                                            className={`absolute top-0 bottom-0 h-full rounded-full ${barColor} opacity-80`}
                                        />
                                    );
                                })()}

                                {/* Keyword Markers */}
                                {result.keywords && result.keywords.map((kw, i) => {
                                    const kScore = kw.score || 0;
                                    const leftPos = ((kScore + 1) / 2) * 100; // Map -1..1 to 0..100

                                    return (
                                        <div
                                            key={i}
                                            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 group z-10"
                                            style={{ left: `${leftPos}%` }}
                                        >
                                            <div className={`w-2 h-2 rounded-full border border-black ${kScore > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black border border-white/10 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                <span className={`${kScore > 0 ? 'text-green-400' : 'text-red-400'}`}>{kw.term} ({kScore.toFixed(2)})</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Zone Indicators (Subtle background optional, or just rely on color logic) */}
                            <div className="flex justify-between text-[10px] text-gray-600 mt-2 font-mono">
                                <span className="text-red-900/50">High Bear</span>
                                <span className="text-yellow-900/50">Mixed</span>
                                <span className="text-green-900/50">High Bull</span>
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
                                {/* Positive Keywords List */}
                                <div>
                                    <h3 className="text-lg font-bold text-green-400 mb-2">Positive Drivers</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {result.keywords?.filter(k => k.score > 0).length > 0 ? (
                                            result.keywords.filter(k => k.score > 0).map((kw, i) => (
                                                <span key={i} className="px-3 py-1 bg-green-500/10 text-green-300 border border-green-500/30 rounded-full text-xs flex items-center gap-1">
                                                    {kw.term} <span className="opacity-50 text-[10px]">{kw.score.toFixed(3)}</span>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-500 italic">None identified</span>
                                        )}
                                    </div>
                                </div>
                                {/* Negative Keywords List */}
                                <div>
                                    <h3 className="text-lg font-bold text-red-400 mb-2">Negative Drivers</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {result.keywords?.filter(k => k.score < 0).length > 0 ? (
                                            result.keywords.filter(k => k.score < 0).map((kw, i) => (
                                                <span key={i} className="px-3 py-1 bg-red-500/10 text-red-300 border border-red-500/30 rounded-full text-xs flex items-center gap-1">
                                                    {kw.term} <span className="opacity-50 text-[10px]">{kw.score.toFixed(3)}</span>
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
