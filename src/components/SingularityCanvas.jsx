import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const SingularityCanvas = ({ mode }) => {
    const canvasRef = useRef(null);

    // --- MOCK VISUALIZATION ---
    // In a real app, this would be Three.js or D3.js
    // For this prototype, we'll use a dynamic CSS/SVG pulse effect.

    const [stockData, setStockData] = React.useState([]);

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
                    <span className="font-mono text-xs tracking-[0.2em] font-bold" style={{ color: primaryColor }}>
                        {mode === 'ANALYST' ? 'AWAITING INPUT' : 'SYSTEM READY'}
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

        </div>
    );
};

const FloatingNode = ({ x, y, delay, color, label, val }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, -10, 0] }}
        transition={{ delay, duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute px-3 py-1 bg-black/60 border border-white/10 backdrop-blur-sm rounded text-[10px] font-mono flex gap-2 items-center"
        style={{ left: x, top: y, borderColor: `${color}40` }}
    >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
        <span className="text-white font-bold">{label}</span>
        <span className={val.includes('+') ? 'text-green-400' : 'text-red-400'}>{val}</span>
    </motion.div>
);

export default SingularityCanvas;
