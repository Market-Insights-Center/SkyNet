import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Scale, Activity, Zap, Search, AlertTriangle, FileText, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// --- Interactive Chart Component ---
const MarketPerformanceChart = ({ data, title, colorBase }) => {
    // Extract unique keys (tickers) excluding 'date'
    // Modified to scan ALL data points, not just the first one, to catch tickers that might start later
    const allKeys = React.useMemo(() => {
        if (!data || data.length === 0) return [];
        const keys = new Set();
        data.forEach(item => {
            Object.keys(item).forEach(k => {
                if (k !== 'date') keys.add(k);
            });
        });
        return Array.from(keys).sort();
    }, [data]);

    // State for toggling visibility
    const [visibility, setVisibility] = useState(() =>
        allKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    );

    // Update visibility state when allKeys changes (e.g. data update)
    React.useEffect(() => {
        setVisibility(prev => {
            const next = { ...prev };
            allKeys.forEach(key => {
                if (next[key] === undefined) next[key] = true;
            });
            return next;
        });
    }, [allKeys]);

    const handleLegendClick = (e) => {
        const { dataKey } = e;
        setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    };

    // Generate colors dynamically or mapped
    const getColor = (key, index) => {
        if (key === 'SPY') return '#ffffff'; // White for SPY
        // Generate gradients based on index
        const base = colorBase === 'green' ? 120 : 0; // Hue
        const lightness = 50 + (index * 5) % 40;
        return `hsl(${base}, 70%, ${lightness}%)`;
    };

    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gold">
                <BarChart2 size={24} /> {title}
            </h3>
            <div className="h-[400px] w-full bg-black/50 rounded-lg p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                            dataKey="date"
                            stroke="#888"
                            fontSize={12}
                            tickFormatter={(str) => {
                                const d = new Date(str);
                                return `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                        />
                        <YAxis stroke="#888" fontSize={12} unit="%" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                            itemStyle={{ fontSize: '12px' }}
                            labelStyle={{ color: '#888', marginBottom: '5px' }}
                            formatter={(value) => value.toFixed(2) + '%'}
                            itemSorter={(item) => -item.value}
                        />
                        <Legend
                            onClick={handleLegendClick}
                            wrapperStyle={{ cursor: 'pointer', paddingTop: '10px' }}
                        />
                        {allKeys.map((key, index) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={getColor(key, index)}
                                strokeWidth={key === 'SPY' ? 3 : 2}
                                dot={false}
                                hide={visibility[key] === false}
                                activeDot={{ r: 6 }}
                                animationDuration={500}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">Click legend items to toggle visibility</p>
        </div>
    );
};

const ComparisonMatrix = () => {
    const { userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('market'); // 'market' or 'breakout'
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Market State
    const [marketType, setMarketType] = useState('sp500'); // sp500, plus, plusplus
    const [sensitivity, setSensitivity] = useState(2); // 1, 2, 3

    const handleMarketAnalyze = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/market`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userProfile?.email || '',
                    market_type: marketType,
                    sensitivity: parseInt(sensitivity)
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Market analysis failed');
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBreakoutRun = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/breakout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userProfile?.email || ''
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Breakout analysis failed');
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-12">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-center"
                >
                    <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-xl mb-4 text-white border border-white/20">
                        <Scale size={32} />
                    </div>
                    <h1 className="text-4xl font-bold mb-2">Comparison Matrix</h1>
                    <p className="text-gray-400">Advanced market scanning and breakout detection tools.</p>
                </motion.div>

                {/* Tab Navigation */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white/5 p-1 rounded-full flex">
                        <button
                            onClick={() => { setActiveTab('market'); setResult(null); setError(null); }}
                            className={`px-8 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${activeTab === 'market' ? 'bg-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Activity size={18} /> Market Heatmap
                        </button>
                        <button
                            onClick={() => { setActiveTab('breakout'); setResult(null); setError(null); }}
                            className={`px-8 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${activeTab === 'breakout' ? 'bg-cyan-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Zap size={18} /> Breakout Detector
                        </button>
                    </div>
                </div>

                {/* Input Panel */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 max-w-3xl mx-auto">
                    {activeTab === 'market' && (
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                            <select
                                value={marketType}
                                onChange={(e) => setMarketType(e.target.value)}
                                className="bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold"
                            >
                                <option value="sp500">S&P 500 Companies</option>
                                <option value="plus">Large Cap (&gt;50B)</option>
                                <option value="plusplus">Mid Cap (&gt;10B)</option>
                            </select>

                            <select
                                value={sensitivity}
                                onChange={(e) => setSensitivity(e.target.value)}
                                className="bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold"
                            >
                                <option value="1">Weekly (Long Term)</option>
                                <option value="2">Daily (Medium Term)</option>
                                <option value="3">Hourly (Short Term)</option>
                            </select>

                            <button
                                onClick={handleMarketAnalyze}
                                disabled={loading}
                                className={`px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 ${loading ? 'opacity-50' : ''}`}
                            >
                                {loading ? <Activity className="animate-spin" /> : <Search size={20} />}
                                {loading ? 'Scanning...' : 'Scan Market'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'breakout' && (
                        <div className="text-center">
                            <p className="text-gray-400 mb-4">
                                Scans for high-momentum assets breaking out of EMA bands with volume confirmation.
                            </p>
                            <button
                                onClick={handleBreakoutRun}
                                disabled={loading}
                                className={`px-8 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center gap-2 mx-auto ${loading ? 'opacity-50' : ''}`}
                            >
                                {loading ? <Activity className="animate-spin" /> : <Zap size={20} />}
                                {loading ? 'Detecting Breakouts...' : 'Run Detector'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                        <AlertTriangle size={20} />
                        {error}
                    </div>
                )}

                {/* Results Display */}
                {result && activeTab === 'market' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

                        {/* Interactive Charts */}
                        {result.chart_data && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                <MarketPerformanceChart
                                    data={result.chart_data.top_10_data}
                                    title="Top 10 Performers vs SPY"
                                    colorBase="green"
                                />
                                <MarketPerformanceChart
                                    data={result.chart_data.bottom_10_data}
                                    title="Bottom 10 Performers vs SPY"
                                    colorBase="red"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Top 10 */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-4 text-green-400">Top 10 Scores</h3>
                                <div className="space-y-2">
                                    {result.top_10?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                                            <span className="font-bold">{item.ticker}</span>
                                            <div className="text-right">
                                                <div className="text-xs text-gray-500">${item.live_price?.toFixed(2)}</div>
                                                <div className="text-green-400 font-mono font-bold">{item.score?.toFixed(2)}%</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bottom 10 */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-4 text-red-400">Bottom 10 Scores</h3>
                                <div className="space-y-2">
                                    {result.bottom_10?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                                            <span className="font-bold">{item.ticker}</span>
                                            <div className="text-right">
                                                <div className="text-xs text-gray-500">${item.live_price?.toFixed(2)}</div>
                                                <div className="text-red-400 font-mono font-bold">{item.score?.toFixed(2)}%</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SPY Check */}
                        {result.spy_data && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                                <h3 className="text-lg font-bold text-gray-300">Market Reference (SPY)</h3>
                                <div className="text-3xl font-bold text-gold mt-2">{result.spy_data.score?.toFixed(2)}%</div>
                                <div className="text-gray-500">${result.spy_data.live_price?.toFixed(2)}</div>
                            </div>
                        )}
                    </motion.div>
                )}

                {result && activeTab === 'breakout' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                        {(!result.current_breakout_stocks || result.current_breakout_stocks.length === 0) ? (
                            <div className="text-center text-gray-400 py-12">
                                {result.message || "No breakouts detected at this time."}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {result.current_breakout_stocks.map((stock, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-2xl font-bold text-cyan-400">{stock.Ticker}</h3>
                                                <p className="text-sm text-gray-400">{stock.Status} Breakout</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-white">{stock['Invest Score']}</div>
                                                <div className="text-sm text-green-400">High: {stock['Highest Invest Score']}</div>
                                            </div>
                                        </div>

                                        {/* Breakout Chart */}
                                        {result.charts && result.charts[stock.Ticker] && (
                                            <div className="mt-4 bg-black/50 rounded-lg p-2 flex justify-center">
                                                <img
                                                    src={result.charts[stock.Ticker]}
                                                    alt={`${stock.Ticker} Chart`}
                                                    className="max-h-[250px] w-auto object-contain rounded"
                                                />
                                            </div>
                                        )}

                                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm border-t border-white/10 pt-4">
                                            <div>
                                                <span className="text-gray-500">Live Price:</span>
                                                <div className="text-white font-mono">${stock['Live Price']}</div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-gray-500">1Y Change:</span>
                                                <div className={`font-mono ${parseFloat(stock['1Y% Change']) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {stock['1Y% Change']}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default ComparisonMatrix;
