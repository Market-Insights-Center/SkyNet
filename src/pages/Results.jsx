import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, Share2, ArrowUp, ArrowDown, Activity, Mail, Save } from 'lucide-react';

// Chart Colors
const CHART_COLORS = [
    '#D4AF37', '#6A0DAD', '#FFFFFF', '#9370DB', '#B8860B', '#4B0082', '#FFD700', '#8A2BE2', '#6B7280', '#10B981'
];

const DonutChart = ({ data }) => {
    const total = data.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
    let currentAngle = 0;

    if (total === 0) return (
        <div className="w-48 h-48 rounded-full border-8 border-white/5 flex items-center justify-center">
            <span className="text-gray-500 text-sm">No Data</span>
        </div>
    );

    return (
        <div className="relative w-64 h-64">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {data.map((item, index) => {
                    const value = parseFloat(item.value) || 0;
                    if (value <= 0) return null;
                    const percentage = value / total;
                    const angle = percentage * 360;
                    const radius = 40;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDasharray = `${(percentage * circumference)} ${circumference}`;
                    const strokeDashoffset = -(currentAngle / 360) * circumference;
                    currentAngle += angle;
                    return (
                        <circle
                            key={index} cx="50" cy="50" r={radius}
                            fill="transparent" stroke={item.color} strokeWidth="12"
                            strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500 hover:opacity-80"
                        >
                            <title>{item.label}: ${value.toLocaleString(undefined, {minimumFractionDigits: 2})} ({((value/total)*100).toFixed(1)}%)</title>
                        </circle>
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm text-gray-400">Total</span>
                <span className="text-xl font-bold text-white">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
        </div>
    );
};

const ExecutionModal = ({ isOpen, onClose, onExecute }) => {
    const [email, setEmail] = useState('');
    const [rhUser, setRhUser] = useState('');
    const [rhPass, setRhPass] = useState('');
    const [sendEmail, setSendEmail] = useState(false);
    const [execRh, setExecRh] = useState(false);
    const [overwrite, setOverwrite] = useState(false);

    // Load saved credentials on mount
    useEffect(() => {
        if (isOpen) {
            const savedEmail = localStorage.getItem('mic_email');
            const savedUser = localStorage.getItem('mic_rh_user');
            const savedPass = localStorage.getItem('mic_rh_pass'); // Stored locally for convenience as requested
            
            if (savedEmail) {
                setEmail(savedEmail);
                setSendEmail(true);
            }
            if (savedUser) {
                setRhUser(savedUser);
                setExecRh(true);
            }
            if (savedPass) {
                setRhPass(savedPass);
            }
        }
    }, [isOpen]);

    const handleConfirm = () => {
        // Save credentials to localStorage for next time
        if (sendEmail && email) localStorage.setItem('mic_email', email);
        if (execRh && rhUser) localStorage.setItem('mic_rh_user', rhUser);
        if (execRh && rhPass) localStorage.setItem('mic_rh_pass', rhPass);
        
        onExecute({ email, rhUser, rhPass, sendEmail, execRh, overwrite });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-900 border border-white/10 rounded-xl p-8 max-w-md w-full shadow-2xl relative"
            >
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Activity className="text-gold" /> Execution Options
                </h3>
                
                <div className="space-y-6">
                    {/* Email Section */}
                    <div className={`p-4 rounded-lg border ${sendEmail ? 'border-gold bg-gold/5' : 'border-gray-700 bg-black/30'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-gold w-5 h-5" />
                            <span className="font-bold text-white">Send Trades to Email</span>
                        </label>
                        {sendEmail && (
                            <input 
                                type="email" placeholder="Enter your email address" 
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded p-2 text-white mt-2 focus:border-gold outline-none"
                            />
                        )}
                    </div>

                    {/* Robinhood Section */}
                    <div className={`p-4 rounded-lg border ${execRh ? 'border-gold bg-gold/5' : 'border-gray-700 bg-black/30'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                            <input type="checkbox" checked={execRh} onChange={(e) => setExecRh(e.target.checked)} className="accent-gold w-5 h-5" />
                            <span className="font-bold text-white">Execute on Robinhood</span>
                        </label>
                        {execRh && (
                            <div className="space-y-2 mt-2">
                                <input type="text" placeholder="Robinhood Username" value={rhUser} onChange={(e) => setRhUser(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" />
                                <input type="password" placeholder="Robinhood Password" value={rhPass} onChange={(e) => setRhPass(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" />
                                <p className="text-xs text-red-400 mt-1">Credentials stored locally for convenience.</p>
                            </div>
                        )}
                    </div>

                    {/* Overwrite Section */}
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/5 rounded">
                        <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="accent-gold w-5 h-5" />
                        <span className="text-gray-300">Overwrite last save file?</span>
                    </label>
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-white">Cancel</button>
                    <button 
                        onClick={handleConfirm}
                        className="bg-gold text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors"
                    >
                        Confirm & Execute
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const Results = ({ toolType, onBack }) => {
    const data = window.analysisResults || { summary: [], table: [] };
    const { summary: summaryStats, table: rawTableData, raw_result, comparison, performance } = data;
    
    const [sortConfig, setSortConfig] = useState({ key: 'allocPercent', direction: 'desc' });
    const [showExecModal, setShowExecModal] = useState(false);

    const cashValue = raw_result?.final_cash || 0;
    const totalStockValue = rawTableData.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
    const totalPortfolioValue = totalStockValue + cashValue;

    const enhancedTableData = useMemo(() => rawTableData.map(item => {
        const val = parseFloat(item.value) || 0;
        return { ...item, allocPercent: totalPortfolioValue > 0 ? (val / totalPortfolioValue) * 100 : 0 };
    }), [rawTableData, totalPortfolioValue]);

    const chartData = useMemo(() => {
        const sorted = [...enhancedTableData].sort((a, b) => b.value - a.value);
        let items = sorted.slice(0, 8).map((item, i) => ({ label: item.ticker, value: item.value, color: CHART_COLORS[i % 8] }));
        const others = sorted.slice(8);
        if (others.length > 0) items.push({ label: "Other Stocks", value: others.reduce((s, i) => s + i.value, 0), color: CHART_COLORS[8] });
        if (cashValue > 0) items.push({ label: "Cash", value: cashValue, color: CHART_COLORS[9] });
        return items;
    }, [enhancedTableData, cashValue]);

    const handleSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const sortedTableData = useMemo(() => {
        return [...enhancedTableData].sort((a, b) => {
            let aVal = a[sortConfig.key], bVal = b[sortConfig.key];
            if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase(); }
            return (aVal < bVal ? -1 : 1) * (sortConfig.direction === 'asc' ? 1 : -1);
        });
    }, [enhancedTableData, sortConfig]);

    const handleExecution = async (options) => {
        setShowExecModal(false);
        const body = {
            action: "execute_trades",
            portfolio_code: raw_result?.portfolio_code || "Unknown", 
            trades: raw_result?.trades || [], 
            final_cash: cashValue,
            total_value: totalPortfolioValue,
            new_run_data: rawTableData,
            rh_username: options.execRh ? options.rhUser : null,
            rh_password: options.execRh ? options.rhPass : null,
            email_to: options.sendEmail ? options.email : null,
            overwrite: options.overwrite
        };

        try {
            const response = await fetch('http://localhost:8000/api/tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            alert(result.message || "Execution processed.");
        } catch (e) {
            alert("Execution failed: " + e.message);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex justify-between mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white"><ArrowLeft size={20} /> Back</button>
                <div className="flex gap-3">
                    {toolType === 'tracking' && (
                        <button onClick={() => setShowExecModal(true)} className="flex items-center gap-2 px-4 py-2 bg-royal-purple text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg">
                            <Activity size={20} /> Execute Actions
                        </button>
                    )}
                    <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white"><Share2 size={20} /></button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500"><Download size={20} /> Export</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {summaryStats.map((stat, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-gold">{stat.value}</h3>
                        <span className="text-xs text-gray-500">{stat.change}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                <div className="lg:col-span-1 bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center min-h-[400px]">
                    <DonutChart data={chartData} />
                    <div className="mt-8 flex flex-wrap gap-3 justify-center">
                        {chartData.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-md">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-gray-300">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar flex-grow">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-royal-purple/20 border-b border-white/10 text-sm text-gray-200">
                                    <th className="p-4 cursor-pointer" onClick={() => handleSort('ticker')}>Ticker <SortIcon columnKey="ticker" config={sortConfig} /></th>
                                    <th className="p-4 cursor-pointer" onClick={() => handleSort('shares')}>Shares <SortIcon columnKey="shares" config={sortConfig} /></th>
                                    <th className="p-4 cursor-pointer" onClick={() => handleSort('price')}>Price <SortIcon columnKey="price" config={sortConfig} /></th>
                                    <th className="p-4 cursor-pointer" onClick={() => handleSort('allocPercent')}>Alloc % <SortIcon columnKey="allocPercent" config={sortConfig} /></th>
                                    <th className="p-4 text-right cursor-pointer" onClick={() => handleSort('value')}>Value ($) <SortIcon columnKey="value" config={sortConfig} /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTableData.map((row, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="p-4 font-bold text-white">{row.ticker}</td>
                                        <td className="p-4 text-gray-300">{row.shares}</td>
                                        <td className="p-4 text-gray-300">${row.price.toFixed(2)}</td>
                                        <td className="p-4 text-gold">{(row.allocPercent).toFixed(2)}%</td>
                                        <td className="p-4 font-bold text-white text-right">${row.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Tracking Specific Tables */}
            {toolType === 'tracking' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Trade Recommendations */}
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-4 bg-white/10 border-b border-white/10"><h3 className="font-bold text-white">Trade Recommendations</h3></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead><tr className="text-xs text-gray-400 border-b border-white/10"><th className="p-3">Ticker</th><th className="p-3">Action</th><th className="p-3 text-right">Diff</th></tr></thead>
                                <tbody>
                                    {comparison && comparison.map((row, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5 text-sm">
                                            <td className="p-3 font-bold text-white">{row.ticker}</td>
                                            <td className={`p-3 font-bold ${row.action === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>{row.action}</td>
                                            {/* MODIFIED: Rounds to 2 decimal places */}
                                            <td className="p-3 text-right text-gray-300">{row.diff > 0 ? '+' : ''}{row.diff.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {(!comparison || comparison.length === 0) && <tr><td colSpan="3" className="p-4 text-center text-gray-500">No rebalancing needed.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Historical Performance */}
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-4 bg-white/10 border-b border-white/10"><h3 className="font-bold text-white">All-Time Performance</h3></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead><tr className="text-xs text-gray-400 border-b border-white/10"><th className="p-3">Ticker</th><th className="p-3 text-right">Origin</th><th className="p-3 text-right">Current</th><th className="p-3 text-right">P&L</th></tr></thead>
                                <tbody>
                                    {performance && performance.map((row, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5 text-sm">
                                            <td className="p-3 font-bold text-white">{row.ticker}</td>
                                            <td className="p-3 text-right text-gray-400">${row.origin_price.toFixed(2)}</td>
                                            <td className="p-3 text-right text-gray-300">${row.live_price.toFixed(2)}</td>
                                            <td className={`p-3 text-right font-bold ${row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {row.pnl >= 0 ? '+' : ''}{row.pnl.toFixed(2)} ({row.pnl_percent.toFixed(1)}%)
                                            </td>
                                        </tr>
                                    ))}
                                    {(!performance || performance.length === 0) && <tr><td colSpan="4" className="p-4 text-center text-gray-500">No historical data found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <ExecutionModal isOpen={showExecModal} onClose={() => setShowExecModal(false)} onExecute={handleExecution} />
        </motion.div>
    );
};

const SortIcon = ({ columnKey, config }) => {
    if (config.key !== columnKey) return <span className="inline-block w-4" />;
    return config.direction === 'asc' ? <ArrowUp size={14} className="inline" /> : <ArrowDown size={14} className="inline" />;
};

export default Results;