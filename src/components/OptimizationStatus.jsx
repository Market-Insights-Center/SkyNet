import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Settings, CheckCircle, BarChart2 } from 'lucide-react';

const OptimizationStatus = () => {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/background/optimization_status');
                const data = await res.json();

                // Only set data if it's a valid status object (has generation or status)
                if (data && (data.generation || data.status === 'completed')) {
                    setStatusData(data);
                }
            } catch (e) {
                console.error("Failed to fetch optimization status", e);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 2000); // Poll every 2s
        return () => clearInterval(interval);
    }, []);

    if (!statusData) return null;

    const isRunning = statusData.status === 'running';
    const isCompleted = statusData.status === 'completed';
    const isWin = (statusData.best_return || 0) > (statusData.buy_hold_return || 0);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
            >
                {/* Header Status */}
                <div className={`flex items-center gap-2 ${isRunning ? 'text-gold animate-pulse' : 'text-green-400'}`}>
                    {isRunning ? <Zap size={16} /> : <CheckCircle size={16} />}
                    <span className="font-bold text-sm">
                        {isRunning ? `Optimization in Progress (Gen ${statusData.generation})...` : 'Optimization Completed'}
                    </span>
                </div>

                {/* Performance Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Strategy Card */}
                    <div className={`rounded-xl border p-4 relative overflow-hidden ${isRunning ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'
                        }`}>
                        {isRunning && (
                            <div className="absolute top-2 right-2 flex gap-1">
                                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-ping"></span>
                            </div>
                        )}
                        <div className={`text-xs mb-1 ${isRunning ? 'text-yellow-400' : 'text-green-400'}`}>
                            {isRunning ? 'Best Return So Far' : 'Final Strategy Return'}
                        </div>
                        <div className={`text-2xl font-bold ${isRunning ? 'text-yellow-400' : 'text-green-400'}`}>
                            {statusData.best_return?.toFixed(2)}%
                        </div>
                        <div className={`text-xs mt-1 ${isRunning ? 'text-yellow-500/50' : 'text-green-500/50'}`}>
                            Sharpe: {statusData.sharpe_ratio?.toFixed(2)} • Trades: {statusData.trade_count}
                        </div>
                    </div>

                    {/* Previous Best Card */}
                    <div className="bg-white/5 rounded-xl border border-white/10 p-4 relative">
                        <div className="text-xs text-gray-400 mb-1">Previous Personal Best</div>
                        <div className="text-2xl font-bold text-gray-300">
                            {statusData.previous_best_return ? statusData.previous_best_return.toFixed(2) : "0.00"}%
                        </div>
                        {statusData.previous_best_return && statusData.best_return > statusData.previous_best_return && (
                            <div className="text-xs mt-1 text-green-400 font-bold flex items-center gap-1 animate-pulse">
                                <Zap size={10} />
                                New Record!
                            </div>
                        )}
                        {statusData.previous_best_return && statusData.best_return <= statusData.previous_best_return && (
                            <div className="text-xs mt-1 text-gray-500">
                                Trying to beat...
                            </div>
                        )}
                        {!statusData.previous_best_return && <div className="text-xs mt-1 text-gray-500">First Run</div>}
                    </div>

                    {/* Buy & Hold Card */}
                    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                        <div className="text-xs text-gray-400 mb-1">Buy & Hold Return</div>
                        <div className="text-2xl font-bold text-gray-300">
                            {statusData.buy_hold_return?.toFixed(2)}%
                        </div>
                        <div className={`text-xs mt-1 ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                            {isWin ? "Strategy Leading" : "Strategy Lagging"}
                        </div>
                    </div>
                </div>

                {/* Best Parameters Box */}
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-400 flex items-center gap-2">
                            <Settings size={14} />
                            {isRunning ? 'Current Best Configuration' : 'Final Parameters Found'}
                        </span>
                        {isCompleted && (
                            <button
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(statusData.best_params, null, 2))}
                                className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors text-white"
                            >
                                Copy JSON
                            </button>
                        )}
                    </div>
                    <div className="p-4 font-mono text-xs text-gray-300 bg-black/50 max-h-60 overflow-auto">
                        <pre>{JSON.stringify(statusData.best_params, null, 2)}</pre>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default OptimizationStatus;
