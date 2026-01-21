import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Globe, DollarSign, BarChart2, AlertTriangle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const BriefingTool = ({ email }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBriefing = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/briefing`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || 'Failed to fetch briefing');
                }

                const result = await response.json();
                setData(result);
                // Track Usage
                import('../services/usageService').then(({ trackUsage }) => trackUsage('briefing'));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (email) fetchBriefing();
    }, [email]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-gray-400">
            <Activity className="animate-spin mb-4 text-gold" size={40} />
            <p>Gathering market intelligence...</p>
        </div>
    );

    if (error) return (
        <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
            <AlertTriangle className="mx-auto text-red-400 mb-2" size={32} />
            <p className="text-red-400">{error}</p>
        </div>
    );

    if (!data) return null;

    // Helper for Price Cards
    const PriceCard = ({ title, value, change, isPercent = false }) => {
        const numChange = parseFloat(String(change).replace('%', ''));
        const isPos = numChange >= 0;
        return (
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                <div className="text-gray-400 text-sm mb-1">{title}</div>
                <div className="text-2xl font-bold mb-1">{value}</div>
                <div className={`flex items-center text-sm font-bold ${isPos ? 'text-green-400' : 'text-red-400'}`}>
                    {isPos ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                    {numChange > 0 ? '+' : ''}{numChange.toFixed(2)}%
                </div>
            </div>
        );
    };

    const spy = data.market_snapshot?.spy || {};
    const vix = data.market_snapshot?.vix || {};
    const oil = data.market_snapshot?.oil || {};
    const gold = data.market_snapshot?.gold || {};
    const silver = data.market_snapshot?.silver || {};
    const breakouts = data.breakouts || {};

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Daily Market Briefing</h2>
                <p className="text-gray-400 text-sm">Generated: {new Date(data.timestamp).toLocaleString()}</p>
            </div>

            {/* Core Market Snapshot */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <PriceCard title="S&P 500" value={`$${spy.live_price?.toFixed(2)}`} change={spy.change_pct} />
                <PriceCard title="VIX" value={vix.live_price?.toFixed(2)} change={vix.change_pct} />
                <PriceCard title="Crude Oil" value={`$${oil.live_price?.toFixed(2)}`} change={oil.change_pct} />
                <PriceCard title="Gold" value={gold.live_price ? `$${gold.live_price.toFixed(2)}` : 'N/A'} change={gold.change_pct || 0} />
                <PriceCard title="Silver" value={silver.live_price ? `$${silver.live_price.toFixed(2)}` : 'N/A'} change={silver.change_pct || 0} />
            </div>

            {/* Yields & Risk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-gold mb-4 flex items-center gap-2">
                        <Activity size={20} /> Treasury Yields
                    </h3>
                    <div className="flex justify-between items-center px-4">
                        <div className="text-center">
                            <div className="text-gray-400 text-sm">10-Year</div>
                            <div className="text-3xl font-bold text-white">{data.yields['10Y']?.toFixed(3)}%</div>
                        </div>
                        <div className="h-12 w-px bg-white/10"></div>
                        <div className="text-center">
                            <div className="text-gray-400 text-sm">2-Year</div>
                            <div className="text-3xl font-bold text-white">{data.yields['2Y']?.toFixed(3)}%</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <AlertTriangle size={20} /> Risk Scores
                    </h3>
                    <div className="flex justify-between items-center px-4">
                        <div className="text-center">
                            <div className="text-gray-400 text-sm">General Score</div>
                            <div className="text-3xl font-bold text-white">{data.risk_scores.general_score?.toFixed(1)}</div>
                        </div>
                        <div className="h-12 w-px bg-white/10"></div>
                        <div className="text-center">
                            <div className="text-gray-400 text-sm">Market Invest</div>
                            <div className="text-3xl font-bold text-white">{data.risk_scores.market_invest_score?.toFixed(1)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* S&P Movers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-green-400 mb-4">Top S&P Movers</h3>
                    <div className="space-y-3">
                        {data.sp500_movers.top?.map((m, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                                <span className="font-bold">{m.ticker}</span>
                                <span className="text-green-400 font-mono">+{m.change_pct?.toFixed(2)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-red-400 mb-4">Bottom S&P Movers</h3>
                    <div className="space-y-3">
                        {data.sp500_movers.bottom?.map((m, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                                <span className="font-bold">{m.ticker}</span>
                                <span className="text-red-400 font-mono">{m.change_pct?.toFixed(2)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Breakouts Section */}
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} /> Breakout Stocks
                </h3>
                {breakouts.stocks && breakouts.stocks.length > 0 ? (
                    <div className="space-y-3">
                        {breakouts.stocks.map((stock, i) => {
                            const perf = breakouts.performance?.[stock.Ticker] || {};
                            return (
                                <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-white">{stock.Ticker}</span>
                                        <span className="text-xs text-gray-400">Score: {stock['Invest Score']}</span>
                                    </div>
                                    <div className="flex gap-4 text-xs font-mono">
                                        <span className={perf['1D'] >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            1D: {perf['1D'] != null ? `${perf['1D'] >= 0 ? '+' : ''}${perf['1D'].toFixed(2)}%` : 'N/A'}
                                        </span>
                                        <span className={perf['1W'] >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            1W: {perf['1W'] != null ? `${perf['1W'] >= 0 ? '+' : ''}${perf['1W'].toFixed(2)}%` : 'N/A'}
                                        </span>
                                        <span className={perf['1M'] >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            1M: {perf['1M'] != null ? `${perf['1M'] >= 0 ? '+' : ''}${perf['1M'].toFixed(2)}%` : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-400 text-sm italic">No current breakout stocks detected.</p>
                )}
            </div>

            {/* Economic Data */}
            {data.economic_data && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                        <Globe size={20} /> Economic Snapshot
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(data.economic_data).map(([key, val]) => (
                            <div key={key} className="p-3 bg-black/30 rounded-lg">
                                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">{key}</div>
                                <div className="font-bold text-white">{val}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BriefingTool;
