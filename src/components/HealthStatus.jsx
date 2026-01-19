import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Server, Zap } from 'lucide-react';

const HealthStatus = () => {
    const [status, setStatus] = useState({ status: 'unknown', orion_active: false });
    const [isExpanded, setIsExpanded] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const checkHealth = async () => {
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                setLastUpdated(new Date());
            } else {
                setStatus({ status: 'error', orion_active: false });
            }
        } catch (e) {
            setStatus({ status: 'offline', orion_active: false });
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const isOnline = status.status === 'ok';
    const isOrion = status.orion_active;

    return (
        <div
            className="fixed bottom-4 right-4 z-[60] flex flex-col items-end"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        className="mb-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl min-w-[200px]"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400 font-mono">SYSTEM STATUS</span>
                            <span className="text-[10px] text-gray-600">
                                {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Server size={14} className={isOnline ? "text-green-400" : "text-red-400"} />
                                    <span className="text-sm text-gray-200">Backend API</span>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className={isOrion ? "text-cyan-400" : "text-gray-600"} />
                                    <span className="text-sm text-gray-200">Orion Core</span>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${isOrion ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "bg-gray-700"}`} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                layout
                className={`flex items-center justify-center w-10 h-10 rounded-full border border-white/10 backdrop-blur-md shadow-lg transition-colors ${isOnline ? "bg-green-500/10 border-green-500/30 hover:bg-green-500/20" : "bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                    }`}
            >
                <Activity size={18} className={isOnline ? "text-green-400" : "text-red-400"} />
                {isOnline && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                )}
            </motion.button>
        </div>
    );
};

export default HealthStatus;
