import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronLeft, RefreshCw, Calendar, Loader2, TrendingUp, TrendingDown, Info, Newspaper, BarChart2, X, Maximize2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TiltCard from '../components/TiltCard';
import NeonWrapper from '../components/NeonWrapper';
import { useAuth } from '../contexts/AuthContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, ReferenceLine } from 'recharts';
import AccessGate from '../components/AccessGate';

const TIMEFRAMES = [
    { id: 'day', label: '1 Day', key: 'change_d' },
    { id: 'week', label: '1 Week', key: 'change_w' },
    { id: 'month', label: '1 Month', key: 'change_m' },
    { id: 'year', label: '1 Year', key: 'change_y' }
];

// Custom Content Renderer for Treemap
const CustomizedContent = (props) => {
    // Flatten props to avoid "payload" dependency issues
    const { depth, x, y, width, height, index, name, change } = props;

    // DEBUG LOGGING (Inspect full props to find data)
    if (index === 0 && depth > 0) {
        console.log(`[Item ${index}] Depth: ${depth}`, props);
    }

    // Safety checks for layout
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
        return null;
    }

    // RENDER: ROOT (Depth 0) -> Ignore background
    if (depth === 0) return null;

    // RENDER: SECTOR (Depth 1)
    if (depth === 1) {
        return (
            <g>
                <foreignObject x={x} y={y} width={width} height={height} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <div style={{ width: '100%', height: '100%', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                        <div style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: 14,
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backdropFilter: 'blur(2px)',
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            {name}
                        </div>
                    </div>
                </foreignObject>
            </g>
        );
    }

    // RENDER: STOCK (Depth 2, or any leaf)
    // Determine Color
    // If 'change' prop is missing, use props.payload?.change, or default
    const valChange = change !== undefined ? change : (props.payload ? props.payload.change : 0);

    // Fallback Color (Blue-Grey) if no change data
    const hasChangeData = change !== undefined || (props.payload && props.payload.change !== undefined);

    const isPositive = (valChange || 0) >= 0;
    const intensity = Math.min(Math.abs(valChange || 0) / 3, 1);

    let bgColor;
    if (!hasChangeData) {
        bgColor = `rgba(50, 50, 60, 0.8)`; // Neutral if missing data
    } else {
        // Base colors
        const goldBase = `rgba(255, 215, 0, ${0.3 + intensity * 0.7})`;
        const purpleBase = `rgba(139, 92, 246, ${0.3 + intensity * 0.7})`; // Using a lighter purple (violet-500) for better visibility
        bgColor = isPositive ? goldBase : purpleBase;
    }

    return (
        <g>
            <foreignObject x={x} y={y} width={width} height={height} style={{ overflow: 'visible' }}>
                <div
                    onClick={() => props.onClick && props.onClick(props.payload || { name, change: valChange })} // Pass constructed payload if missing
                    className="group relative w-full h-full p-[1px] transition-all duration-300 ease-out hover:z-20 hover:scale-[1.15]"
                >
                    <div
                        style={{ backgroundColor: bgColor }}
                        className="w-full h-full rounded-md border border-white/20 shadow-lg backdrop-blur-md overflow-hidden flex flex-col items-center justify-center relative cursor-pointer"
                    >
                        {/* Glass Gradient Overlay (Stronger for clarity) */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-black/20 pointer-events-none" />

                        {/* Shine Effect */}
                        <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />

                        {/* Content */}
                        <div className="relative z-10 flex flex-col items-center justify-center text-center p-0.5">
                            {(width > 25 && height > 25) && (
                                <>
                                    <span className="font-bold text-white text-[11px] md:text-xs drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight">{name}</span>
                                    {(width > 45 && height > 35 && typeof valChange === 'number') && (
                                        <span className="text-[10px] md:text-[11px] text-white font-mono mt-0.5 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                                            {valChange > 0 ? '+' : ''}{valChange.toFixed(2)}%
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </foreignObject>
        </g>
    );
};

const PerformanceStream = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[0]);
    const [selectedStock, setSelectedStock] = useState(null); // For detail view
    const [details, setDetails] = useState(null); // Detail data
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetch Heatmap Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/performance-stream');
            if (!res.ok) throw new Error("Failed to fetch");
            const jsonData = await res.json();
            setData(jsonData || []);
        } catch (error) {
            console.error("Performance Stream Fetch Error:", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Poll every 15 mins? Or user manual refresh. User manual for now or auto-refresh if tab active.
        const interval = setInterval(fetchData, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Formatted Data for Recharts
    // Recharts Treemap needs: [{ name: 'Sector', children: [...] }]
    // Our API returns exactly this.
    // However, we need to inject the "value" (size) and "change" (color) dynamically based on timeframe for rendering.

    const chartData = useMemo(() => {
        if (!data) return [];
        console.log("Processing Treemap Data:", data);
        // Deep copy to avoid mutating state directly if strict mode
        const mapped = data.map(sector => ({
            ...sector,
            // Ensure children exist
            children: (sector.children || []).map(stock => ({
                ...stock,
                value: (stock.size && stock.size > 0) ? stock.size : 1000000000, // Fallback Mkt Cap
                change: stock.changes?.[selectedTimeframe.id] || 0 // Color driven by timeframe
            }))
        }));
        console.log("Mapped Treemap Data:", mapped);
        return mapped;
    }, [data, selectedTimeframe]);

    // Check if we effectively have no stocks
    const hasData = useMemo(() => {
        if (!chartData || !chartData.length) return false;
        return chartData.some(s => s.children && s.children.length > 0);
    }, [chartData]);

    const [aiData, setAiData] = useState(null); // AI Summary, Sentiment, Powerscore
    const [loadingAI, setLoadingAI] = useState(false);

    const handleStockClick = async (stock) => {
        setSelectedStock(stock);
        setLoadingDetails(true);
        setLoadingAI(true);
        setDetails(null);
        setAiData(null);

        // Fetch Standard Details
        try {
            const res = await fetch(`/api/performance-stream/details/${stock.name}`);
            if (res.ok) {
                const json = await res.json();
                setDetails(json);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDetails(false);
        }

        // Initialize minimal state so UI shows "Loading..." for each section immediately
        setAiData({
            summary: null,
            sentiment: null,
            powerscore: null,
            loadingSummary: true,
            loadingSentiment: true,
            loadingPowerscore: true
        });


        // Fetch AI Data (Sequential Chaining for VPS Stability)
        // We fetch Summary -> Then Sentiment -> Then Powerscore.
        // This ensures the VPS only handles 1 LLM request at a time, preventing timeouts/failures.

        // 1. Fetch Summary
        fetch('/api/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: stock.name })
        })
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Summary API Error: ${res.status} - ${text.substring(0, 50)}`);
                }
                return res.json();
            })
            .then(data => {
                setAiData(prev => ({
                    ...prev,
                    summary: data.status === 'success' ? data.summary : "Summary unavailable.",
                    loadingSummary: false
                }));
            })
            .catch(err => {
                console.error("Summary Chain Error (Recovering):", err);
                setAiData(prev => ({ ...prev, summary: "Summary unavailable.", loadingSummary: false }));
            })
            .then(() => {
                // 2. Chain Sentiment (Always runs, even if Summary failed)
                return fetch('/api/sentiment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'guest', ticker: stock.name })
                });
            })
            .then(async res => {
                if (!res.ok) throw new Error(`Sentiment API Error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                setAiData(prev => ({
                    ...prev,
                    sentiment: data.status === 'success' ? data : null,
                    loadingSentiment: false
                }));
            })
            .catch(err => {
                console.error("Sentiment Chain Error (Recovering):", err);
                setAiData(prev => ({ ...prev, sentiment: null, loadingSentiment: false }));
            })
            .then(() => {
                // 3. Chain Powerscore (Always runs, even if Sentiment failed)
                return fetch('/api/powerscore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'guest', ticker: stock.name, sensitivity: 2 })
                });
            })
            .then(async res => {
                if (!res.ok) throw new Error(`Powerscore API Error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                setAiData(prev => ({
                    ...prev,
                    powerscore: data.status === 'success' ? data : null,
                    loadingPowerscore: false
                }));
            })
            .catch(err => {
                console.error("Powerscore Chain Error:", err);
                setAiData(prev => ({ ...prev, powerscore: null, loadingPowerscore: false }));
            })
            .finally(() => {
                // Redundant safety, but good to have
                setLoadingAI(false);
            });

        // We do NOT block on a global loadingAI flag anymore. The UI will use individual flags.
        setLoadingAI(false);
    };

    const closeDetail = () => {
        setSelectedStock(null);
        setDetails(null);
    };

    // Pre-calculate Trend Data (Percent Change)
    const trendData = useMemo(() => {
        if (!details || !details.history || details.history.length === 0) return [];
        const startPrice = details.history[0].price;
        return details.history.map(item => ({
            ...item,
            changePct: startPrice !== 0 ? ((item.price - startPrice) / startPrice) * 100 : 0
        }));
    }, [details]);

    // Calculate Total Change over the graph period (1 Year)
    const graphTotalChange = trendData.length > 0 ? trendData[trendData.length - 1].changePct : 0;

    return (
        <AccessGate productKey="performance_stream" title="Performance Stream">
            <div className="min-h-screen bg-[#050505] text-white pt-24 px-4 pb-8 overflow-hidden font-sans">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 max-w-[1920px] mx-auto w-full">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="p-3 bg-gradient-to-br from-gold/20 to-purple-900/20 rounded-xl border border-white/10 backdrop-blur">
                            <Maximize2 className="w-8 h-8 text-gold" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-purple-400">
                                Performance Stream
                            </h1>
                            <p className="text-gray-400 text-sm">Real-time S&P 500 Performance Visualization</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-gray-900/50 p-2 rounded-full border border-white/10 backdrop-blur-md">
                        {TIMEFRAMES.map((tf) => (
                            <button
                                key={tf.id}
                                onClick={() => setSelectedTimeframe(tf)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${selectedTimeframe.id === tf.id
                                    ? 'bg-gradient-to-r from-gold to-orange-500 text-black shadow-lg shadow-gold/20'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tf.label}
                            </button>
                        ))}
                        <div className="w-px h-6 bg-white/10 mx-2" />
                        <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Refresh Data">
                            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin text-gold' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Heatmap Container */}
                <div className="h-[calc(100vh-200px)] min-h-[600px] w-full max-w-[1920px] mx-auto bg-gray-900/20 rounded-2xl border border-white/5 backdrop-blur-sm p-1 relative overflow-hidden shadow-2xl">

                    {loading && !data.length ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-12 h-12 text-gold animate-spin" />
                            <div className="ml-4 text-white">Loading Initial Data...</div>
                        </div>
                    ) : !chartData || chartData.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                            <Info className="w-12 h-12 mb-2 opacity-50" />
                            <p>No Data Available</p>
                            <p className="text-xs mt-2">Check backend logs or wait for scheduled job.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                                data={chartData}
                                dataKey="value"
                                aspectRatio={4 / 3}
                                stroke="#000"
                                content={<CustomizedContent activeTimeframe={selectedTimeframe} onClick={handleStockClick} />}
                            >
                                <Tooltip
                                    content={({ payload }) => {
                                        if (!payload || !payload.length) return null;
                                        const d = payload[0].payload;
                                        // Don't show tooltip for sectors
                                        if (d.children && d.children.length > 0) return null;

                                        return (
                                            <div className="bg-black/90 border border-gold/30 p-3 rounded shadow-xl backdrop-blur-md">
                                                <div className="font-bold text-gold text-lg">{d.name}</div>
                                                <div className="text-white text-sm">Price: ${d.price?.toFixed(2)}</div>
                                                <div className={`text-sm ${d.change >= 0 ? 'text-green-400' : 'text-purple-400'}`}>
                                                    Change: {d.change > 0 ? '+' : ''}{d.change?.toFixed(2)}%
                                                </div>
                                                <div className="text-gray-500 text-xs mt-1">Click for details</div>
                                            </div>
                                        );
                                    }}
                                />
                            </Treemap>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Detail Modal (Flip Card Effect) */}
                <AnimatePresence>
                    {selectedStock && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                            <motion.div
                                initial={{ rotateY: 90, opacity: 0 }}
                                animate={{ rotateY: 0, opacity: 1 }}
                                exit={{ rotateY: -90, opacity: 0 }}
                                transition={{ duration: 0.4, type: "spring" }}
                                className="bg-[#0a0a0a] border border-gold/30 w-full max-w-4xl h-[80vh] rounded-2xl shadow-[0_0_50px_rgba(255,215,0,0.15)] overflow-hidden relative flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-gray-900 to-black">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold ${selectedStock.change >= 0 ? 'bg-gold/20 text-gold' : 'bg-purple-600/20 text-purple-400'}`}>
                                            {selectedStock.name}
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-white">
                                                {/* Show cached price first, then real-time price when details load */}
                                                ${(details?.price || selectedStock.price || 0).toFixed(2)}
                                            </div>
                                            <div className={`flex items-center gap-2 ${selectedStock.change >= 0 ? 'text-green-400' : 'text-purple-400'}`}>
                                                {selectedStock.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                                <span className="font-mono">{selectedStock.change > 0 ? '+' : ''}{selectedStock.change.toFixed(2)}%</span>
                                                <span className="text-gray-500 text-xs bg-white/5 px-2 py-0.5 rounded ml-2 uppercase">{selectedTimeframe.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={closeDetail} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                                        <X size={24} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Left: Chart & Stats */}
                                    <div className="lg:col-span-2 space-y-6">
                                        {/* Trend Chart */}
                                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 h-[300px] relative">
                                            {/* ... Chart Content (Unchanged) ... */}
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-gray-400 text-sm font-bold flex items-center gap-2">
                                                    <BarChart2 size={16} /> PRICE TREND (1Y)
                                                </h3>
                                                {!loadingDetails && details && (
                                                    <span className={`font-mono font-bold text-sm ${graphTotalChange >= 0 ? 'text-green-400' : 'text-purple-400'}`}>
                                                        {graphTotalChange > 0 ? '+' : ''}{graphTotalChange.toFixed(2)}%
                                                    </span>
                                                )}
                                            </div>

                                            {loadingDetails || !details ? (
                                                <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-gold" /></div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={trendData}>
                                                        <defs>
                                                            {/* SPLIT GRADIENT LOGIC */}
                                                            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                                                {(() => {
                                                                    const vals = trendData.map(d => d.changePct);
                                                                    const max = Math.max(...vals);
                                                                    const min = Math.min(...vals);

                                                                    if (max <= 0) return <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />;
                                                                    if (min >= 0) return <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />;

                                                                    const off = max / (max - min);
                                                                    return (
                                                                        <>
                                                                            <stop offset={off} stopColor="#4ade80" stopOpacity={1} />
                                                                            <stop offset={off} stopColor="#ef4444" stopOpacity={1} />
                                                                        </>
                                                                    );
                                                                })()}
                                                            </linearGradient>
                                                            {/* Fill Opacity Gradient (Optional, usually same split logic or just solid) */}
                                                            <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                                                                {(() => {
                                                                    const vals = trendData.map(d => d.changePct);
                                                                    const max = Math.max(...vals);
                                                                    const min = Math.min(...vals);
                                                                    const off = (max <= 0) ? 0 : (min >= 0) ? 1 : max / (max - min);

                                                                    return (
                                                                        <>
                                                                            <stop offset={off} stopColor="#4ade80" stopOpacity={0.2} />
                                                                            <stop offset={off} stopColor="#ef4444" stopOpacity={0.2} />
                                                                        </>
                                                                    );
                                                                })()}
                                                            </linearGradient>
                                                        </defs>
                                                        <XAxis dataKey="date" hide />
                                                        <YAxis domain={['auto', 'auto']} hide />
                                                        <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
                                                        <ChartTooltip
                                                            content={({ active, payload }) => {
                                                                if (active && payload && payload.length) {
                                                                    const d = payload[0].payload;
                                                                    return (
                                                                        <div className="bg-black/90 border border-white/10 p-3 rounded shadow-xl backdrop-blur-md">
                                                                            <div className="text-gray-400 text-xs mb-1">{d.date}</div>
                                                                            <div className="text-white font-bold text-sm">
                                                                                ${d.price.toFixed(2)}
                                                                            </div>
                                                                            <div className={`text-sm font-mono ${d.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                                {d.changePct > 0 ? '+' : ''}{d.changePct.toFixed(2)}%
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            }}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="changePct"
                                                            stroke="url(#splitColor)"
                                                            strokeWidth={2}
                                                            fillOpacity={1}
                                                            fill="url(#splitFill)"
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>

                                        {/* NEW: AI INSIGHT CARD */}
                                        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-6 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-10"><RefreshCw size={80} className="animate-pulse" /></div>
                                            <h3 className="text-blue-400 text-sm font-bold mb-3 flex items-center gap-2">
                                                <RefreshCw size={16} /> AI ANALYST INSIGHT
                                            </h3>

                                            {loadingAI ? (
                                                <div className="flex items-center gap-3 text-gray-400 py-4">
                                                    {/* This block might be redundant if loadingAI is false quickly, but keeps a fallback */}
                                                    <Loader2 className="animate-spin text-blue-400" />
                                                    <span>Initializing analysis...</span>
                                                </div>
                                            ) : aiData ? (
                                                <div className="space-y-4 relative z-10">
                                                    {/* Brief Summary */}
                                                    <div>
                                                        <div className="text-white font-medium text-sm leading-relaxed mb-2 relative min-h-[40px]">
                                                            {aiData.loadingSummary ? (
                                                                <div className="flex items-center gap-2 text-gray-400">
                                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                                                    <span className="text-xs animate-pulse">Generating summary...</span>
                                                                </div>
                                                            ) : (
                                                                <ExpandableText text={aiData.summary || "Summary unavailable."} />
                                                            )}
                                                        </div>
                                                        <div className="h-px w-full bg-white/10 my-3" />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Sentiment */}
                                                        <div>
                                                            <div className="text-gray-500 text-xs uppercase mb-1">Sentiment</div>
                                                            {aiData.loadingSentiment ? (
                                                                <div className="flex items-center gap-2 text-gray-400 py-2">
                                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                                                    <span className="text-xs">Analyzing...</span>
                                                                </div>
                                                            ) : aiData.sentiment ? (
                                                                <>
                                                                    {/* Logic: > 60 Green, 40-60 Yellow, < 40 Red */}
                                                                    {(() => {
                                                                        const val = aiData.sentiment.sentiment_score_raw * 100;
                                                                        const color = val > 60 ? 'text-green-400' : val > 40 ? 'text-yellow-400' : 'text-red-400';
                                                                        return (
                                                                            <div className={`text-lg font-bold ${color}`}>
                                                                                {val.toFixed(1)}%
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                                        <ExpandableText text={aiData.sentiment.summary || "No sentiment data"} />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="text-gray-600 text-sm">N/A</div>
                                                            )}
                                                        </div>

                                                        {/* Powerscore */}
                                                        <div>
                                                            <div className="text-gray-500 text-xs uppercase mb-1">PowerScore</div>
                                                            {aiData.loadingPowerscore ? (
                                                                <div className="flex items-center gap-2 text-gray-400 py-2">
                                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                                                    <span className="text-xs">Calculating...</span>
                                                                </div>
                                                            ) : aiData.powerscore ? (
                                                                <>
                                                                    {/* Logic: > 60 Green, 40-60 Yellow, < 40 Red */}
                                                                    <div className={`text-lg font-bold ${aiData.powerscore.powerscore > 60 ? 'text-green-400' : aiData.powerscore.powerscore > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                        {(aiData.powerscore.powerscore).toFixed(1)}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                                        <ExpandableText text={aiData.powerscore.ai_explanation || "No score data"} />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="text-gray-600 text-sm">N/A</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-gray-500 italic text-sm">Analysis failed.</div>
                                            )}
                                        </div>

                                        {/* News Feed */}
                                        <div>
                                            <h3 className="text-gray-400 text-sm font-bold mb-4 flex items-center gap-2">
                                                <Newspaper size={16} /> LATEST HEADLINES
                                            </h3>
                                            <div className="space-y-3">
                                                {loadingDetails ? (
                                                    <div className="text-gray-500 text-xs text-center py-4">Loading news...</div>
                                                ) : details?.news?.length > 0 ? (
                                                    details.news.map((item, i) => (
                                                        <div
                                                            key={i}
                                                            className="group/news p-3 rounded-lg bg-white/5 border border-white/5 pointer-events-none cursor-default"
                                                        >
                                                            <div className="text-xs font-medium text-gray-200 line-clamp-2 mb-2">
                                                                {item.title}
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                                                                <span className="font-semibold text-gray-400">{item.publisher}</span>
                                                                <span>{item.time_label}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-gray-500 text-xs italic">No recent news found.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Scores & Metrics */}
                                    <div className="space-y-6">
                                        {/* Quickscore */}
                                        {/* Quickscore (Multi-Timeframe) */}
                                        <TiltCard className="bg-gradient-to-br from-gray-900 to-black border border-blue-500/30 p-5 rounded-xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10"><Info size={60} /></div>
                                            <h3 className="text-blue-400 font-bold text-sm mb-4 flex items-center gap-2">
                                                QUICKSCORE <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">0-100</span>
                                            </h3>

                                            <div className="space-y-4 relative z-10">
                                                {['Short', 'Medium', 'Long'].map((tf) => {
                                                    const key = tf.toLowerCase();
                                                    const val = details?.quickscore?.[key] || 0;
                                                    const color = val > 70 ? 'bg-green-500' : val > 40 ? 'bg-yellow-500' : 'bg-red-500';

                                                    return (
                                                        <div key={tf}>
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="text-gray-400">{tf} Term</span>
                                                                <span className="text-white font-mono">{loadingDetails ? '...' : val}</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${color} transition-all duration-1000`}
                                                                    style={{ width: `${loadingDetails ? 0 : val}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </TiltCard>

                                        {/* Assess Code A */}
                                        <TiltCard delay={0.1} className="bg-gradient-to-br from-gray-900 to-black border border-green-500/30 p-6 rounded-xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={60} /></div>
                                            <h3 className="text-green-400 font-bold mb-2">ASSESS CODE A</h3>

                                            {loadingDetails ? (
                                                <div className="text-sm text-gray-400 animate-pulse">Calculating...</div>
                                            ) : details?.assess_code_a && typeof details.assess_code_a === 'object' ? (
                                                <div className="space-y-2 mt-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-400 text-xs uppercase">Beta (vs SPY)</span>
                                                        <span className="text-white font-mono font-bold">{details.assess_code_a.beta}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-400 text-xs uppercase">Correlation</span>
                                                        <span className="text-white font-mono font-bold">{details.assess_code_a.correlation}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm font-medium text-white mb-1 leading-relaxed">
                                                    {details?.assess_code_a || "Analysis unavailable."}
                                                </div>
                                            )}
                                        </TiltCard>

                                        {/* Key Stats */}
                                        <div className="bg-white/5 border border-white/5 rounded-xl p-6">
                                            <h3 className="text-gray-400 font-bold text-sm mb-4">KEY METRICS</h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-500 text-sm">Market Cap</span>
                                                    <span className="font-mono text-white">
                                                        {details?.marketCap
                                                            ? (details.marketCap >= 1e12
                                                                ? `$${(details.marketCap / 1e12).toFixed(2)}T`
                                                                : `$${(details.marketCap / 1e9).toFixed(2)}B`)
                                                            : "---"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-500 text-sm">Volume</span>
                                                    <span className="font-mono text-white">
                                                        {details?.volume
                                                            ? `${(details.volume / 1e6).toFixed(2)}M`
                                                            : "---"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </AccessGate>
    );
};



const ExpandableText = ({ text }) => {
    const [expanded, setExpanded] = useState(false);
    const threshold = 150;
    const isLong = text && text.length > threshold;

    return (
        <div>
            <span>
                {expanded || !isLong ? text : text.slice(0, threshold) + "..."}
            </span>
            {isLong && (
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className="ml-1 text-gold hover:underline text-xs font-bold uppercase tracking-wider"
                >
                    {expanded ? "Show Less" : "See More"}
                </button>
            )}
        </div>
    );
};

export default PerformanceStream;
