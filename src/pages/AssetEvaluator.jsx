import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Activity, AlertTriangle, ChevronRight, BarChart2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const AssetEvaluator = () => {
    const { userProfile } = useAuth();
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
            const response = await fetch(`${API_BASE_URL}/api/quickscore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    email: userProfile?.email || ''
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
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-12">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-center"
                >
                    <div className="inline-flex items-center justify-center p-3 bg-gold/10 rounded-xl mb-4 text-gold border border-gold/20">
                        <Search size={32} />
                    </div>
                    <h1 className="text-4xl font-bold mb-2">Asset Evaluator</h1>
                    <p className="text-gray-400">Rapidly score assets and visualize trends using the Quickscore algorithm.</p>
                </motion.div>

                {/* Input Section */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                    <form onSubmit={handleAnalyze} className="flex gap-4">
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            placeholder="Enter Ticker (e.g. AAPL)"
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

                {/* Results Section */}
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Score Summary */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gold">
                                <Activity size={24} /> Analysis Results: {result.ticker}
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="p-4 bg-black/30 rounded-xl border border-white/5">
                                    <div className="text-gray-400 text-sm mb-1">Live Price (Daily)</div>
                                    <div className="text-2xl font-bold text-white">{result.live_price}</div>
                                </div>

                                {Object.entries(result.scores).map(([key, value]) => {
                                    const score = parseFloat(value);
                                    let scoreColor = 'text-red-400';
                                    if (score > 60) scoreColor = 'text-green-400';
                                    else if (score >= 40) scoreColor = 'text-yellow-400';

                                    return (
                                        <div key={key} className="p-4 bg-black/30 rounded-xl border border-white/5">
                                            <div className="text-gray-400 text-sm mb-1">
                                                {key === '1' ? 'Weekly (5Y)' : key === '2' ? 'Daily (1Y)' : 'Hourly (6M)'} Score
                                            </div>
                                            <div className={`text-2xl font-bold ${scoreColor}`}>
                                                {value}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Charts Grid */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-400">
                                <BarChart2 size={24} /> Technical Charts
                            </h3>
                            <div className="grid grid-cols-1 gap-6">
                                {result.graphs && result.graphs.map((graphStr, index) => {
                                    // The command returns format "Label: data:image..."
                                    // We need to split it carefully.
                                    const parts = graphStr.split(': data:image');
                                    const label = parts[0];
                                    const imgSrc = 'data:image' + parts[1];

                                    return (
                                        <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden">
                                            <div className="text-gray-400 font-bold mb-2 ml-1">{label}</div>
                                            <div className="w-full flex justify-center bg-black/50 rounded-lg p-2">
                                                {/* Ensure image is not too huge, "slightly small" as requested */}
                                                <img
                                                    src={imgSrc}
                                                    alt={label}
                                                    className="max-h-[300px] w-auto object-contain rounded"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default AssetEvaluator;
