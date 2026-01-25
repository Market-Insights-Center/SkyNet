import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const SingularityCanvas = ({ mode, customLabel, modules, onRemoveModule }) => {
    const canvasRef = useRef(null);

    // --- MOCK VISUALIZATION ---
    // In a real app, this would be Three.js or D3.js
    // For this prototype, we'll use a dynamic CSS/SVG pulse effect.

    const [stockData, setStockData] = useState([]);

    useEffect(() => {
        const fetchStocks = async () => {
            try {
                // Tickers to visualize
                const tickers = ['SPY', 'BTC-USD', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'GLD', '^VIX'];
                const res = await fetch('/api/market-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tickers })
                });
                const data = await res.json();
                if (data && Array.isArray(data)) {
                    // Map random positions for now, or keep fixed if preferred.
                    // We'll keep the "random-ish" fixed positions from the original code by mapping index.
                    const positions = [
                        { x: "10%", y: "20%" }, { x: "80%", y: "15%" }, { x: "15%", y: "40%" },
                        { x: "60%", y: "30%" }, { x: "85%", y: "60%" }, { x: "35%", y: "85%" },
                        { x: "50%", y: "10%" }, { x: "5%", y: "55%" }, { x: "70%", y: "80%" }, { x: "20%", y: "70%" }
                    ];

                    const mapped = data.map((item, i) => ({
                        ...item,
                        x: positions[i % positions.length].x,
                        y: positions[i % positions.length].y,
                        delay: i * 0.5
                    }));
                    setStockData(mapped);
                }
            } catch (e) {
                console.error("Canvas Market Data Error", e);
            }
        };

        fetchStocks();
        const interval = setInterval(fetchStocks, 60000);
        return () => clearInterval(interval);
    }, []);

    const primaryColor = mode === 'ANALYST' ? '#22d3ee' : '#f59e0b'; // Cyan vs Amber

    return (
        <div className="w-full h-full relative flex items-center justify-center overflow-hidden">

            {/* GRID BACKGROUND */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

            {/* IDLE STATE: PULSING CORE */}
            <div className="relative z-10">
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 0.8, 0.5],
                        rotate: [0, 360]
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="w-64 h-64 border-2 border-dashed rounded-full flex items-center justify-center"
                    style={{ borderColor: primaryColor }}
                >
                    <motion.div
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.3, 0.1, 0.3]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="w-32 h-32 rounded-full blur-xl"
                        style={{ backgroundColor: primaryColor }}
                    />
                </motion.div>

                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-xs tracking-[0.2em] font-bold uppercase text-center max-w-[200px] leading-relaxed transition-all duration-500" style={{ color: primaryColor }}>
                        {customLabel || (mode === 'ANALYST' ? 'AWAITING INPUT' : 'SYSTEM READY')}
                    </span>
                </div>
            </div>

            {/* REAL DATA NODES */}
            {stockData.map((s, i) => (
                <FloatingNode
                    key={s.ticker}
                    x={s.x}
                    y={s.y}
                    delay={s.delay}
                    color={primaryColor}
                    label={s.ticker === 'BTC-USD' ? 'BTC' : s.ticker}
                    val={`${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%`}
                />
            ))}

            {/* ACTIVE MODULES (CARDS) */}
            {modules && modules.map((mod, i) => (
                <FloatingModule
                    key={mod.id}
                    module={mod}
                    color={primaryColor}
                    onRemove={() => onRemoveModule(mod.id)}
                />
            ))}

        </div>
    );
};

const FloatingModule = ({ module, color, onRemove }) => {
    const [minimized, setMinimized] = useState(false);

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, height: minimized ? 'auto' : 'auto' }}
            drag
            className={`absolute bg-black/80 border backdrop-blur-md rounded-lg p-3 z-50 cursor-grab active:cursor-grabbing shadow-2xl transition-all duration-300 ${minimized ? 'w-48' : 'w-64'}`}
            style={{ left: module.x, top: module.y, borderColor: color }}
        >
            <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-2">
                <span className="text-[10px] font-bold tracking-widest text-white truncate pr-2">{module.title}</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
                        className="text-[9px] font-bold bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded text-gray-300 transition-colors"
                    >
                        {minimized ? '+' : '-'}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="text-[9px] font-bold bg-red-500/20 hover:bg-red-500/40 text-red-400 px-1.5 py-0.5 rounded transition-colors"
                    >
                        ✕
                    </button>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                </div>
            </div>

            {!minimized && (
                <div className="text-xs text-gray-300 animate-in fade-in duration-300">
                    {module.type === 'SENTIMENT_CARD' && (
                        <div className="flex items-center justify-between">
                            <span>Score</span>
                            <span className={`font-bold ${module.data.verdict === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>{module.data.score.toFixed(2)}</span>
                        </div>
                    )}
                    {module.type === 'QUICKSCORE_CARD' && (
                        <div className="grid grid-cols-3 gap-1 text-[9px]">
                            {Object.entries(module.data.scores || {}).map(([k, item]) => {
                                const val = item.score || item;
                                const tag = item.label ? item.label.substring(0, 1) : (k === '1' ? 'W' : k === '2' ? 'D' : 'H');
                                return (
                                    <div key={k} className="bg-white/5 p-1 rounded text-center">
                                        <div className="text-gray-500 opacity-50 text-[8px]">{tag}</div>
                                        <div>{val}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Connector Line (Visual Hack) */}
            <svg className="absolute top-1/2 left-1/2 w-[500px] h-[500px] pointer-events-none -z-10 -translate-x-1/2 -translate-y-1/2 opacity-20">
                <line x1="250" y1="250" x2="50%" y2="50%" stroke={color} strokeDasharray="5,5" />
            </svg>
        </motion.div>
    );
};

const FloatingNode = ({ x, y, delay, color, label, val }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, -10, 0] }}
        transition={{ delay, duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute px-3 py-1 bg-black/60 border border-white/10 backdrop-blur-sm rounded text-[10px] font-mono flex gap-2 items-center pointer-events-none"
        style={{ left: x, top: y, borderColor: `${color}40` }}
    >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
        <span className="text-white font-bold">{label}</span>
        <span className={val.includes('+') ? 'text-green-400' : 'text-red-400'}>{val}</span>
    </motion.div>
);

export default SingularityCanvas;
