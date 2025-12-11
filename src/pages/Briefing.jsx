import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    FileText, Play, Activity, TrendingUp, TrendingDown,
    AlertTriangle, Globe, Loader2, DollarSign, BarChart2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Briefing() {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const runBriefing = async () => {
        if (!userProfile?.email) return;
        setLoading(true);
        setError(null);
        setData(null);

        try {
            const response = await fetch(`${API_URL}/api/briefing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userProfile.email })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.detail || result.message || 'Failed to generate briefing');
            }
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white pt-24 px-4 pb-12 font-mono selection:bg-purple-900 selection:text-white">
            <div className="max-w-6xl mx-auto space-y-8">

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                            <FileText className="text-purple-500" size={32} />
                            Daily Market Briefing
                        </h1>
                        <p className="text-gray-400">
                            Comprehensive pre-market analysis: Risk, Macro, Movers, and Breakouts.
                        </p>
                    </div>
                    <button
                        onClick={runBriefing}
                        disabled={loading}
                        className={`px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center gap-2
                    ${loading
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40'}`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                        {loading ? 'Analyzing...' : 'Generate Briefing'}
                    </button>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-red-200"
                    >
                        <div className="flex items-center gap-2 font-bold mb-2">
                            <AlertTriangle size={20} /> Analysis Failed
                        </div>
                        <p className="opacity-80">{error}</p>
                    </motion.div>
                )}

                {data && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="space-y-8"
                    >
                        {/* Section 1: Snapshot & Risk */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                                    <Activity size={20} /> Market Snapshot
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricBox label="S&P 500" data={data.market_snapshot?.spy} />
                                    <MetricBox label="VIX" data={data.market_snapshot?.vix} inverseColor />
                                    <MetricBox label="Crude Oil" data={data.market_snapshot?.oil} />
                                    <MetricBox label="Gold" data={data.market_snapshot?.gold} />
                                </div>
                            </div>

                            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-400">
                                    <AlertTriangle size={20} /> Risk Scores
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-black/40 rounded border border-gray-800">
                                        <span className="text-gray-400">General Market Risk</span>
                                        <span className="text-2xl font-bold text-white">{data.risk_scores?.general_score ?? 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-black/40 rounded border border-gray-800">
                                        <span className="text-gray-400">Market Invest Score</span>
                                        <span className="text-2xl font-bold text-white">{data.risk_scores?.market_invest_score ?? 'N/A'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="text-center p-2">
                                            <div className="text-xs text-gray-500 uppercase">10Y Yield</div>
                                            <div className="font-bold text-lg">{data.yields?.['10Y']?.toFixed(3)}%</div>
                                        </div>
                                        <div className="text-center p-2">
                                            <div className="text-xs text-gray-500 uppercase">2Y Yield</div>
                                            <div className="font-bold text-lg">{data.yields?.['2Y']?.toFixed(3)}%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: S&P Movers */}
                        <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
                                <BarChart2 size={20} /> S&P 500 Movers
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-sm uppercase text-gray-500 mb-3 font-bold">Top Gainers</h4>
                                    <div className="space-y-2">
                                        {data.sp500_movers?.top?.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 bg-green-900/10 rounded border border-green-900/30">
                                                <span className="font-bold">{item.ticker}</span>
                                                <span className="text-green-400 font-mono">+{item.change_pct?.toFixed(2)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm uppercase text-gray-500 mb-3 font-bold">Top Losers</h4>
                                    <div className="space-y-2">
                                        {data.sp500_movers?.bottom?.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 bg-red-900/10 rounded border border-red-900/30">
                                                <span className="font-bold">{item.ticker}</span>
                                                <span className="text-red-400 font-mono">{item.change_pct?.toFixed(2)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Breakouts & Macro */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
                                    <TrendingUp size={20} /> Breakout Candidates
                                </h3>
                                {data.breakouts?.stocks?.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.breakouts.stocks.map((stock, i) => {
                                            const perf = data.breakouts.performance?.[stock.Ticker] || {};
                                            return (
                                                <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded border border-gray-800">
                                                    <div>
                                                        <span className="text-lg font-bold text-yellow-400 mr-2">{stock.Ticker}</span>
                                                        <span className="text-xs text-gray-500">Score: {stock['Invest Score']}</span>
                                                    </div>
                                                    <div className="flex gap-4 text-sm font-mono text-gray-300">
                                                        <span>1D: {perf['1D'] ? `${perf['1D'] > 0 ? '+' : ''}${perf['1D'].toFixed(2)}%` : 'N/A'}</span>
                                                        <span className="hidden sm:inline">1W: {perf['1W'] ? `${perf['1W'] > 0 ? '+' : ''}${perf['1W'].toFixed(2)}%` : 'N/A'}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-gray-500 italic">No breakout candidates detected today.</div>
                                )}
                            </div>

                            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyan-400">
                                    <Globe size={20} /> Macro Data
                                </h3>
                                <div className="space-y-3 text-sm">
                                    {data.economic_data && Object.entries(data.economic_data).map(([key, val], i) => (
                                        <div key={i} className="flex justify-between border-b border-gray-800 pb-2 last:border-0">
                                            <span className="text-gray-400">{key}</span>
                                            <span className="text-right font-mono text-gray-200">{val}</span>
                                        </div>
                                    ))}
                                    {!data.economic_data && <div className="text-gray-500">No economic data available.</div>}
                                </div>
                            </div>
                        </div>

                        <div className="text-right text-xs text-gray-600 pt-4">
                            Generated at: {new Date(data.timestamp).toLocaleString()}
                        </div>

                    </motion.div>
                )}

                {!loading && !data && !error && (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-600 border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                        <FileText size={48} className="mb-4 opacity-50" />
                        <p>Ready to generate briefing.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

const MetricBox = ({ label, data, inverseColor }) => {
    if (!data || !data.live_price) return (
        <div className="bg-black/40 p-3 rounded border border-gray-800">
            <div className="text-xs text-gray-500 uppercase">{label}</div>
            <div className="text-gray-600">N/A</div>
        </div>
    );

    const change = data.change_pct || 0;
    const isPos = change >= 0;
    // Standard: Green is good (+), Red is bad (-).
    // Inverse (VIX): Red is "up" (bad usually), Green is "down" (good).
    // Actually VIX up is usually bad for market. So standard coloring (Green=Up) might be confusing.
    // Let's stick to Green = Number went up, Red = Number went down.

    const colorClass = isPos ? 'text-green-400' : 'text-red-400';

    return (
        <div className="bg-black/40 p-3 rounded border border-gray-800">
            <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
            <div className="font-bold text-lg">${data.live_price.toFixed(2)}</div>
            <div className={`text-xs font-mono font-bold ${colorClass}`}>
                {isPos ? '+' : ''}{change.toFixed(2)}%
            </div>
        </div>
    );
};
