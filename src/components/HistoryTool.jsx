import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Activity } from 'lucide-react';

// Get API Base URL from env or default to relative path (proxy)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-lg shadow-xl">
                <p className="text-gray-400 mb-2">{new Date(label).toLocaleDateString()} {new Date(label).toLocaleTimeString()}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-300">{entry.name}:</span>
                        <span className="font-bold" style={{ color: entry.color }}>
                            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const HistoryTool = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Uses dynamic API URL
                const response = await fetch(`${API_BASE_URL}/api/history`);
                if (!response.ok) throw new Error('Failed to fetch history data');
                const result = await response.json();

                if (result.error) throw new Error(result.error);
                if (!Array.isArray(result)) throw new Error("Invalid data format received");

                // Process data for Recharts
                // Ensure numbers are numbers and timestamps are valid
                const processedData = result.map(item => ({
                    ...item,
                    timestamp: new Date(item.Timestamp).getTime(), // Use timestamp for XAxis
                    "General Market Score": parseFloat(item["General Market Score"]) || 0,
                    "Large Market Cap Score": parseFloat(item["Large Market Cap Score"]) || 0,
                    "Combined Score": parseFloat(item["Combined Score"]) || 0,
                    "EMA Score": parseFloat(item["EMA Score"]) || 0,
                    "Live SPY Price": parseFloat(item["Live SPY Price"]) || 0,
                    "Live VIX Price": parseFloat(item["Live VIX Price"]) || 0,
                    "Momentum Based Recession Chance": parseFloat(item["Momentum Based Recession Chance"]?.replace('%', '')) || 0,
                    "VIX Based Recession Chance": parseFloat(item["VIX Based Recession Chance"]?.replace('%', '')) || 0,
                }));

                setData(processedData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="text-center p-12 text-gray-400">Loading Historical Data...</div>;
    if (error) return <div className="text-center p-12 text-red-400">Error: {error}</div>;
    if (!data || data.length === 0) return (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white/5 rounded-2xl border border-white/10">
            <Activity size={48} className="mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">No Historical Data Yet</h3>
            <p>The system is collecting market data. Please check back later or trigger a Risk analysis.</p>
        </div>
    );

    return (
        <div className="space-y-12">
            {/* Chart 1: Market Scores */}
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold text-gold mb-6 flex items-center gap-2">
                    <Activity size={20} /> Historical Market Scores
                </h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                                dataKey="timestamp"
                                domain={['auto', 'auto']}
                                type="number"
                                tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()}
                                stroke="#9ca3af"
                            />
                            <YAxis domain={[0, 100]} stroke="#9ca3af" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="General Market Score" stroke="#eab308" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Large Market Cap Score" stroke="#22c55e" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Combined Score" stroke="#06b6d4" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="EMA Score" stroke="#a855f7" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 2: SPY vs VIX */}
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
                    <TrendingUp size={20} /> SPY vs VIX Price Action
                </h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                                dataKey="timestamp"
                                domain={['auto', 'auto']}
                                type="number"
                                tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()}
                                stroke="#9ca3af"
                            />
                            <YAxis yAxisId="left" stroke="#22c55e" label={{ value: 'SPY Price ($)', angle: -90, position: 'insideLeft', fill: '#22c55e' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#ef4444" label={{ value: 'VIX Price', angle: 90, position: 'insideRight', fill: '#ef4444' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="Live SPY Price" stroke="#22c55e" strokeWidth={2} dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="Live VIX Price" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 3: Recession Chances */}
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                    <Calendar size={20} /> Recession Probability History
                </h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                                dataKey="timestamp"
                                domain={['auto', 'auto']}
                                type="number"
                                tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()}
                                stroke="#9ca3af"
                            />
                            <YAxis domain={[0, 100]} stroke="#9ca3af" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="Momentum Based Recession Chance" name="EMA Chance" stroke="#f97316" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="VIX Based Recession Chance" name="VIX Chance" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default HistoryTool;