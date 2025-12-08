import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Activity, PieChart, TrendingUp, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const FundamentalsTool = ({ email }) => {
    const [ticker, setTicker] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/fundamentals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    email: email
                })
            });

            const result = await response.json();

            if (!response.ok) {
                // Check specifically for limit exceeded to show a nicer message if needed
                throw new Error(result.detail || 'Analysis failed');
            }

            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const MetricCard = ({ label, value, score, maxScore = 25 }) => {
        const scoreColor = score > 15 ? 'text-green-400' : score >= 10 ? 'text-yellow-400' : 'text-red-400';
        return (
            <div className="bg-black/30 p-4 rounded-xl border border-white/5 hover:border-gold/20 transition-all">
                <div className="text-gray-400 text-sm mb-1">{label}</div>
                <div className="text-xl font-bold text-white mb-2">{value !== null ? value : 'N/A'}</div>
                <div className="text-xs flex justify-between items-center bg-white/5 rounded px-2 py-1">
                    <span className="text-gray-500">Score</span>
                    <span className={`font-bold ${scoreColor}`}>{score.toFixed(1)} / {maxScore}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-colors duration-300 hover:border-gold/50">
                <form onSubmit={handleAnalyze} className="flex gap-4">
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        placeholder="Enter Ticker for Fundamental Scan (e.g. NVDA)"
                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold uppercase font-mono tracking-wider"
                    />
                    <button
                        type="submit"
                        disabled={loading || !ticker}
                        className={`px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <Activity className="animate-spin" /> : <Search size={20} />}
                        {loading ? 'Scanning...' : 'Scan'}
                    </button>
                </form>
                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}
            </div>

            {data && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-8"
                >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-white/10 pb-6">
                        <div>
                            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                {data.ticker} <span className="text-base font-normal text-gray-400 bg-white/10 px-2 py-1 rounded">Fundamental Analysis</span>
                            </h2>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <div className="text-sm text-gray-400">Total Fundamental Score</div>
                            <div className={`text-4xl font-bold ${data.fundamental_score > 60 ? 'text-green-400' : data.fundamental_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {data.fundamental_score?.toFixed(1)} <span className="text-lg text-gray-500">/ 100</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            label="P/E Ratio"
                            value={data.pe_ratio?.toFixed(2)}
                            score={data.pe_score || 0}
                            maxScore={25}
                        />
                        <MetricCard
                            label="Revenue Growth"
                            value={data.revenue_growth ? (data.revenue_growth * 100).toFixed(2) + '%' : 'N/A'}
                            score={data.revenue_growth_score || 0}
                            maxScore={25}
                        />
                        <MetricCard
                            label="Debt-to-Equity"
                            value={data.debt_to_equity?.toFixed(2)}
                            score={data.debt_to_equity_score || 0}
                            maxScore={25}
                        />
                        <MetricCard
                            label="Profit Margin"
                            value={data.profit_margin ? (data.profit_margin * 100).toFixed(2) + '%' : 'N/A'}
                            score={data.profit_margin_score || 0}
                            maxScore={25}
                        />
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default FundamentalsTool;
