import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Activity, TrendingUp, HelpCircle } from 'lucide-react';

const Speedometer = ({ value, label, min = 0, max = 100, ranges }) => {
    // ranges: [{ max: 30, color: '#ef4444', label: 'Bearish' }, ...]

    const normalizedValue = Math.min(Math.max(value, min), max);

    // Determine current section label and color
    let currentLabel = '';
    let currentColor = '#6b7280';

    for (const range of ranges) {
        if (normalizedValue <= range.max) {
            currentColor = range.color;
            currentLabel = range.label;
            break;
        }
    }

    // Background segments data
    let start = min;
    const backgroundData = ranges.map(range => {
        const val = range.max - start;
        start = range.max;
        return { value: val, color: range.color + '40' }; // Add transparency
    });

    const needleData = [
        { name: 'Value', value: normalizedValue, color: 'transparent' },
        { name: 'Remaining', value: max - normalizedValue, color: 'transparent' }
    ];

    // Needle rotation
    const rotation = 180 * (normalizedValue / max);

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 relative">
            <h3 className="text-gray-300 font-medium mb-1">{label}</h3>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: currentColor }}>
                {currentLabel}
            </div>

            <div className="relative w-48 h-24 overflow-hidden">
                <ResponsiveContainer width="100%" height="200%">
                    <PieChart>
                        {/* Background Ranges */}
                        <Pie
                            data={backgroundData}
                            cx="50%"
                            cy="50%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {backgroundData.map((entry, index) => (
                                <Cell key={`bg-cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        {/* Needle Layer (Invisible Pie just for sizing if needed, but we use absolute div) */}
                    </PieChart>
                </ResponsiveContainer>

                {/* Needle */}
                <div
                    className="absolute bottom-0 left-1/2 w-1 h-20 bg-white origin-bottom transform -translate-x-1/2 transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-50%) rotate(${rotation - 90}deg)` }}
                >
                    <div className="absolute -top-1 -left-1 w-3 h-3 bg-white rounded-full" />
                </div>
                <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-gray-800 rounded-full transform -translate-x-1/2 translate-y-1/2 border-2 border-white" />
            </div>

            <div className="mt-2 text-3xl font-bold" style={{ color: currentColor }}>
                {typeof value === 'number' ? value.toFixed(1) : value}
            </div>
        </div>
    );
};

const RiskTool = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/risk');
                if (!response.ok) throw new Error('Failed to fetch risk data');
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="text-center p-12 text-gray-400">Loading Risk Analysis...</div>;
    if (error) return <div className="text-center p-12 text-red-400">Error: {error}</div>;
    if (!data) return <div className="text-center p-12 text-gray-400">No data available.</div>;

    // Range definitions with Labels
    const bullishRanges = [
        { max: 40, color: '#ef4444', label: 'Bearish' },
        { max: 60, color: '#eab308', label: 'Neutral' },
        { max: 100, color: '#22c55e', label: 'Bullish' }
    ];

    const bearishRanges = [
        { max: 40, color: '#22c55e', label: 'Low Risk' },
        { max: 60, color: '#eab308', label: 'Moderate' },
        { max: 100, color: '#ef4444', label: 'High Risk' }
    ];

    const ivRanges = [
        { max: 20, color: '#22c55e', label: 'Stable' },
        { max: 30, color: '#eab308', label: 'Elevated' },
        { max: 100, color: '#ef4444', label: 'Volatile' }
    ];

    // Helper to get label/color for header
    const getStatus = (value, ranges) => {
        for (const range of ranges) {
            if (value <= range.max) return { label: range.label, color: range.color };
        }
        return { label: 'Unknown', color: '#6b7280' };
    };

    const combinedStatus = getStatus(data.combined_score, bullishRanges);
    const investStatus = getStatus(data.market_invest_score, bullishRanges);

    return (
        <div className="space-y-12">
            {/* Simplified Header Stats */}
            <div className="flex flex-col md:flex-row justify-center gap-8 md:gap-16 items-center bg-white/5 p-8 rounded-2xl border border-white/10">
                <div className="text-center">
                    <div className="text-gray-400 text-lg mb-2">Combined Score</div>
                    <div className="text-6xl font-bold mb-2" style={{ color: combinedStatus.color }}>
                        {data.combined_score?.toFixed(1)}
                    </div>
                    <div className="text-xl font-bold uppercase tracking-widest" style={{ color: combinedStatus.color }}>
                        {combinedStatus.label}
                    </div>
                </div>

                <div className="w-px h-32 bg-white/10 hidden md:block"></div>

                <div className="text-center">
                    <div className="text-gray-400 text-lg mb-2">Market Invest Score</div>
                    <div className="text-6xl font-bold mb-2" style={{ color: investStatus.color }}>
                        {data.market_invest_score?.toFixed(1)}
                    </div>
                    <div className="text-xl font-bold uppercase tracking-widest" style={{ color: investStatus.color }}>
                        {investStatus.label}
                    </div>
                </div>
            </div>

            {/* Macro Scores */}
            <div>
                <h2 className="text-xl font-bold text-gold mb-6 flex items-center gap-2">
                    <Activity size={20} /> Macro Scores
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Speedometer label="Combined Score" value={data.combined_score} ranges={bullishRanges} />
                    <Speedometer label="General Score" value={data.general_score} ranges={bullishRanges} />
                    <Speedometer label="Large Cap Score" value={data.large_cap_score} ranges={bullishRanges} />
                    <Speedometer label="EMA Score" value={data.ema_score} ranges={bullishRanges} />
                </div>
            </div>

            {/* SPY Scores */}
            <div>
                <h2 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
                    <TrendingUp size={20} /> SPY Scores
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Speedometer label="Market Invest Score" value={data.market_invest_score} ranges={bullishRanges} />
                    <Speedometer label="Percentile" value={data.market_score_percentile} ranges={bullishRanges} />
                    <Speedometer label="Market IV" value={data.market_iv} ranges={ivRanges} />
                    <Speedometer label="Market IVR" value={data.market_ivr} ranges={bearishRanges} />
                </div>
            </div>

            {/* Contraction Chances */}
            <div>
                <div className="flex items-center gap-2 mb-6">
                    <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                        <AlertTriangle size={20} /> Contraction Chances
                    </h2>
                    <div className="group relative">
                        <HelpCircle size={18} className="text-gray-500 hover:text-gray-300 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                            Probability of a market contraction or recession based on momentum (EMA) and volatility (VIX) indicators. Higher percentages indicate higher risk.
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-900 border-r border-b border-gray-700 transform rotate-45"></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Speedometer label="Contraction Chance (EMA)" value={data.recession_chance_ema} ranges={bearishRanges} />
                    <Speedometer label="Contraction Chance (VIX)" value={data.recession_chance_vix} ranges={bearishRanges} />
                </div>
            </div>
        </div>
    );
};

export default RiskTool;
