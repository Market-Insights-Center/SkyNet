import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowUp, ArrowDown, Activity, Layers, X } from 'lucide-react';
import TradingViewWidget from '../components/TradingViewWidget';

const CHART_COLORS = [
    '#D4AF37', '#6A0DAD', '#FFFFFF', '#9370DB', '#B8860B', '#4B0082', '#FFD700', '#8A2BE2', '#6B7280', '#10B981'
];

const DonutChart = ({ data }) => {
    const safeData = Array.isArray(data) ? data : [];
    const total = safeData.reduce((sum, item) => sum + (parseFloat(item?.value) || 0), 0);
    let currentAngle = 0;

    if (total === 0) return (
        <div className="w-48 h-48 rounded-full border-8 border-white/5 flex items-center justify-center">
            <span className="text-gray-500 text-sm">No Data</span>
        </div>
    );

    return (
        <div className="relative w-64 h-64">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {safeData.map((item, index) => {
                    const value = parseFloat(item?.value) || 0;
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
                            <title>{item.label}: ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({((value / total) * 100).toFixed(1)}%)</title>
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
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsProcessing(false);
            const savedEmail = localStorage.getItem('mic_email');
            const savedUser = localStorage.getItem('mic_rh_user');
            const savedPass = localStorage.getItem('mic_rh_pass');

            if (savedEmail) {
                setEmail(savedEmail);
                // setSendEmail(true); // check removed
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
        if (isProcessing) return;
        setIsProcessing(true);

        if (execRh && rhUser) localStorage.setItem('mic_rh_user', rhUser);
        if (execRh && rhPass) localStorage.setItem('mic_rh_pass', rhPass);

        onExecute({ rhUser, rhPass, execRh });
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
                    {/* Email option removed per request */}

                    <div className={`p-4 rounded-lg border ${execRh ? 'border-gold bg-gold/5' : 'border-gray-700 bg-black/30'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                            <input type="checkbox" checked={execRh} onChange={(e) => setExecRh(e.target.checked)} className="accent-gold w-5 h-5" />
                            <span className="font-bold text-white">Execute on Robinhood</span>
                        </label>
                        {execRh && (
                            <div className="space-y-2 mt-2">
                                <input type="text" placeholder="Robinhood Username" value={rhUser} onChange={(e) => setRhUser(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" />
                                <input type="password" placeholder="Robinhood Password" value={rhPass} onChange={(e) => setRhPass(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" />
                                <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-200">
                                    <strong>Important:</strong> If you have 2FA enabled, please check your mobile device immediately after clicking "Confirm".
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Overwrite option is now handled by the tool inputs or defaults, not this modal, unless we want to force it here?
                        The user said "send email and overwrite options must be only on the inputs menu". 
                        However, Results.jsx is often displayed AFTER inputs are gone (if navigating back).
                        But usually for Tracking, inputs are on the Wizard page.
                        If this is just the results view, we might not have access to the original inputs state unless passed down.
                        But wait, `stableData` comes from `window.analysisResults`.
                        If the original request had `overwrite`, maybe we should honor it?
                        Or does the user want these options completely GONE from the execution modal? yes.
                        "Overwrite" logic is usually passed to `execute-trades` endpoint.
                        If we remove it from modal, we need to know if we should overwrite.
                        Let's assume "Overwrite" is FALSE by default here if not in modal, OR we assume the previous `run` already handled the "save" part, and this is just "execute trades".
                        Execute Trades endpoint DOES NOT save/overwrite database. It just executes on RH.
                        So "Overwrite" here might be irrelevant for `execute-trades` endpoint UNLESS `execute-trades` calls save?
                        Looking at `main.py`, `execute_trades_endpoint` calls `execute_portfolio_rebalance`. It does NOT seem to save to DB.
                        So "Overwrite" in Execution Modal was likely misleading or for a different purpose?
                        Actually, `PortfolioNexus` has an `overwrite` option that interacts with `runNexus`.
                        But `Results.jsx` calls `/api/execute-trades`.
                        Let's remove it as requested.
                     */}
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={onClose} disabled={isProcessing} className="text-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="bg-gold text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isProcessing ? 'Processing...' : 'Confirm & Execute'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const Results = ({ toolType, onBack }) => {
    // [FIX] Use State to capture window data *once* on mount to ensure stability
    const [stableData, setStableData] = useState(() => {
        const winData = window.analysisResults || {};
        return {
            summary: Array.isArray(winData.summary) ? winData.summary : [],
            table: Array.isArray(winData.table) ? winData.table : [],
            raw_result: winData.raw_result || {},
            comparison: Array.isArray(winData.comparison) ? winData.comparison : [],
            performance: Array.isArray(winData.performance) ? winData.performance : [],
            since_last_save: Array.isArray(winData.since_last_save) ? winData.since_last_save : [],
            requires_execution_confirmation: winData.requires_execution_confirmation || winData.raw_result?.requires_execution_confirmation || false
        };
    });

    const [sortConfig, setSortConfig] = useState({ key: 'allocPercent', direction: 'desc' });
    const [showExecModal, setShowExecModal] = useState(false);
    const [activeTicker, setActiveTicker] = useState(null);

    // Destructure stable state
    const { summary: summaryStats, table: rawTableData, raw_result, comparison, performance, since_last_save } = stableData;
    const cashValue = parseFloat(raw_result?.final_cash) || 0;

    const totalStockValue = rawTableData.reduce((sum, item) => {
        const val = parseFloat(item?.value || item?.actual_money_allocation || item?.equity || 0);
        return sum + val;
    }, 0);
    const totalPortfolioValue = totalStockValue + cashValue;
    const holdingsCount = rawTableData.filter(item => item?.ticker !== 'Cash').length;

    // Normalize Data Structure
    const enhancedTableData = useMemo(() => rawTableData.map(item => {
        if (!item) return { ticker: "Unknown", value: 0, allocPercent: 0, price: 0, shares: 0 };
        const val = parseFloat(item.value || item.actual_money_allocation || item.equity || 0);
        const shares = parseFloat(item.shares || 0);
        let price = parseFloat(item.price || item.live_price || item.Close || 0);
        if (price === 0 && shares > 0) price = val / shares;

        return {
            ...item,
            value: val,
            price: price,
            shares: shares,
            allocPercent: totalPortfolioValue > 0 ? (val / totalPortfolioValue) * 100 : 0
        };
    }), [rawTableData, totalPortfolioValue]);

    const chartData = useMemo(() => {
        const sorted = [...enhancedTableData].sort((a, b) => b.value - a.value);
        let items = sorted.slice(0, 8).map((item, i) => ({
            label: item.ticker || "N/A", value: item.value || 0, color: CHART_COLORS[i % 8]
        }));
        const others = sorted.slice(8);
        if (others.length > 0) {
            items.push({ label: "Other Stocks", value: others.reduce((s, i) => s + (i.value || 0), 0), color: CHART_COLORS[8] });
        }
        if (cashValue > 0) {
            items.push({ label: "Cash", value: cashValue, color: CHART_COLORS[9] });
        }
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
        // NOTE: Modal closes only AFTER fetch or error to keep UI state consistent
        // We handle logic here.

        const payloadData = raw_result?.trades || [];

        if (!payloadData || payloadData.length === 0) {
            alert("Error: No trade data found. Please re-run the analysis.");
            setShowExecModal(false);
            return;
        }

        // User requested removing email/overwrite from modal.
        // We need to decide where to get them.
        // If this is `Results.jsx`, we are likely viewing a result.
        // If we want to support email here without a modal input, we'd need to fetch it from localStorage or raw_result metadata.
        // For now, let's check `localStorage` for email if we implicitly want to send it?
        // Or if the user meant "inputs menu" (Wizard), then maybe those inputs were already passed to the backend during analysis and stored in result?
        // `raw_result` might have `email_to`.
        // Let's try to grab from raw_result or localStorage if we want to support it, otherwise we send null.

        const storedEmail = localStorage.getItem('mic_email');
        // We won't prompt, but if we have an email and the user originally requested it... 
        // Actually, without the checkbox in modal, the user can't "opt-in" at this stage.
        // So we will only send email if `options.sendEmail` is passed? But we removed the checkbox!
        // So `options.sendEmail` will probably be false/undefined.
        // Effectively, this disables email sending from this specific modal unless we force it.
        // Given the instructions "send email... only on the inputs menu", it implies that if I set it in inputs, it should happen.
        // BUT `Results.jsx` is a separate view. If I ran the tool with "Send Email" checked, the backend likely ALREADY sent the email during the analysis breakdown?
        // No, usually "Execute Trades" is a separate step for RH.
        // Use Case: User runs analysis -> sees results -> clicks "Execute Trades".
        // If they checked "Send Email" in inputs, maybe they want the EXECUTION confirmation email?
        // Let's rely on standard args. If we extracted email from valid inputs earlier, we might not have it here.
        // We'll proceed with just RH execution for now as that seems to be the core request.

        const body = {
            trades: payloadData,
            rh_username: options.execRh ? options.rhUser : null,
            rh_password: options.execRh ? options.rhPass : null,
            email_to: null, // explicit null as we removed the input
            portfolio_code: raw_result?.portfolio_code || "Unknown"
        };

        try {
            const response = await fetch('/api/execute-trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();

            if (result.status === 'success') {
                alert(result.message || "Execution processed.");
            } else {
                alert("Execution Result: " + (result.message || "Unknown status"));
            }
        } catch (e) {
            alert("Execution failed: " + e.message);
        } finally {
            setShowExecModal(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex justify-between mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white"><ArrowLeft size={20} /> Back</button>
                <div className="flex gap-3">
                    {/* Execution Actions */
                        ((toolType === 'tracking' && stableData.requires_execution_confirmation) || (stableData.requires_execution_confirmation)) && (
                            <button onClick={() => setShowExecModal(true)} className="flex items-center gap-2 px-4 py-2 bg-royal-purple text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg">
                                <Activity size={20} /> Execute Trades
                            </button>
                        )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {summaryStats.map((stat, i) => {
                    if (!stat) return null;
                    return (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <p className="text-gray-400 text-sm mb-1">{stat.label || "Metric"}</p>
                            <h3 className="text-2xl font-bold text-gold">{stat.value || "0"}</h3>
                            <span className="text-xs text-gray-500">{stat.change || ""}</span>
                        </div>
                    );
                })}
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
                                {sortedTableData.map((row, i) => {
                                    if (!row) return null;
                                    return (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="p-4 font-bold text-white cursor-pointer hover:text-gold transition-colors" onClick={() => setActiveTicker(row.ticker)}>{row.ticker || "N/A"}</td>
                                            <td className="p-4 text-gray-300">
                                                {(row.shares || 0).toLocaleString(undefined, { maximumFractionDigits: 5 })}
                                            </td>
                                            <td className="p-4 text-gray-300">${(parseFloat(row.price) || 0).toFixed(2)}</td>
                                            <td className="p-4 text-gold">{(row.allocPercent || 0).toFixed(2)}%</td>
                                            <td className="p-4 font-bold text-white text-right">${(parseFloat(row.value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}
                                {sortedTableData.length === 0 && (
                                    <tr><td colSpan="5" className="p-4 text-center text-gray-500">No data available.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Tracking Specific Tables */}
            {toolType === 'tracking' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <div className="p-4 bg-white/10 border-b border-white/10"><h3 className="font-bold text-white">Trade Recommendations</h3></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="text-xs text-gray-400 border-b border-white/10"><th className="p-3">Ticker</th><th className="p-3 text-right">Diff</th></tr></thead>
                                    <tbody>
                                        {comparison && comparison.map((row, i) => {
                                            if (!row) return null;
                                            return (
                                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 text-sm">
                                                    <td className="p-3 font-bold text-white cursor-pointer hover:text-gold transition-colors" onClick={() => setActiveTicker(row.ticker)}>{row.ticker || "N/A"}</td>
                                                    <td className={`p-3 font-bold ${row.action === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>{row.action || "-"}</td>
                                                    <td className="p-3 text-right text-gray-300">{(row.diff || 0) > 0 ? '+' : ''}{(parseFloat(row.diff) || 0).toFixed(4)}</td>
                                                </tr>
                                            );
                                        })}
                                        {(!comparison || comparison.length === 0) && <tr><td colSpan="3" className="p-4 text-center text-gray-500">No rebalancing needed.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <div className="p-4 bg-white/10 border-b border-white/10"><h3 className="font-bold text-white">All-Time Performance</h3></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="text-xs text-gray-400 border-b border-white/10"><th className="p-3">Ticker</th><th className="p-3 text-right">Origin</th><th className="p-3 text-right">Current</th><th className="p-3 text-right">P&L</th></tr></thead>
                                    <tbody>
                                        {performance && performance.map((row, i) => {
                                            if (!row) return null;
                                            const pnl = parseFloat(row.pnl) || 0;
                                            return (
                                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 text-sm">
                                                    <td className="p-3 font-bold text-white cursor-pointer hover:text-gold transition-colors" onClick={() => setActiveTicker(row.ticker)}>{row.ticker || "N/A"}</td>
                                                    <td className="p-3 text-right text-gray-400">${(parseFloat(row.origin_price) || 0).toFixed(2)}</td>
                                                    <td className="p-3 text-right text-gray-300">${(parseFloat(row.live_price) || 0).toFixed(2)}</td>
                                                    <td className={`p-3 text-right font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({(parseFloat(row.pnl_percent) || 0).toFixed(1)}%)
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(!performance || performance.length === 0) && <tr><td colSpan="4" className="p-4 text-center text-gray-500">No historical data found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-4 bg-white/10 border-b border-white/10"><h3 className="font-bold text-white">Performance Since Last Save</h3></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead><tr className="text-xs text-gray-400 border-b border-white/10"><th className="p-3">Ticker</th><th className="p-3 text-right">Held Shares</th><th className="p-3 text-right">Last Save Price</th><th className="p-3 text-right">Current Price</th><th className="p-3 text-right">P&L</th></tr></thead>
                                <tbody>
                                    {since_last_save && since_last_save.map((row, i) => {
                                        if (!row) return null;
                                        const pnl = parseFloat(row.pnl) || 0;
                                        return (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 text-sm">
                                                <td className="p-3 font-bold text-white cursor-pointer hover:text-gold transition-colors" onClick={() => setActiveTicker(row.ticker)}>{row.ticker || "N/A"}</td>
                                                <td className="p-3 text-right text-gray-300">{(parseFloat(row.shares) || 0).toLocaleString(undefined, { maximumFractionDigits: 5 })}</td>
                                                <td className="p-3 text-right text-gray-400">${(parseFloat(row.last_save_price) || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right text-gray-300">${(parseFloat(row.current_price) || 0).toFixed(2)}</td>
                                                <td className={`p-3 text-right font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({(parseFloat(row.pnl_percent) || 0).toFixed(1)}%)
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(!since_last_save || since_last_save.length === 0) && <tr><td colSpan="5" className="p-4 text-center text-gray-500">No previous run data available.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <ExecutionModal isOpen={showExecModal} onClose={() => setShowExecModal(false)} onExecute={handleExecution} />

            {/* TradingView Widget Modal */}
            <AnimatePresence>
                {activeTicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setActiveTicker(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-5xl h-[80vh] bg-gray-900 border border-gray-700 rounded-xl overflow-hidden relative shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setActiveTicker(null)}
                                className="absolute top-4 right-4 z-10 bg-gray-800 text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="h-full w-full">
                                <TradingViewWidget ticker={activeTicker} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const SortIcon = ({ columnKey, config }) => {
    if (config.key !== columnKey) return <span className="inline-block w-4" />;
    return config.direction === 'asc' ? <ArrowUp size={14} className="inline" /> : <ArrowDown size={14} className="inline" />;
};

export default Results;