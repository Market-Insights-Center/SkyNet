import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Network, Play, Plus, Trash2, Save, BarChart3,
    PieChart, ChevronRight, AlertTriangle, CheckCircle,
    Database, RefreshCw, Mail, Shield, Check, ArrowUp, ArrowDown, X
} from 'lucide-react';
import AccessGate from '../components/AccessGate';
import TierGate from '../components/TierGate';
import UpgradePopup from '../components/UpgradePopup';
import TradingViewWidget from '../components/TradingViewWidget';

const API_URL = import.meta.env.VITE_API_URL || '/api';

import { useAuth } from '../contexts/AuthContext';

export default function PortfolioNexus() {
    const { userProfile } = useAuth();

    const [nexusCode, setNexusCode] = useState('');
    const [totalValue, setTotalValue] = useState(10000);
    const [loading, setLoading] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showExecModal, setShowExecModal] = useState(false);
    const [activeTicker, setActiveTicker] = useState(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: 'weight', direction: 'desc' });

    // Execution State
    const [executionOpts, setExecutionOpts] = useState({
        use_fractional_shares: false,
        send_email: false,
        email_to: '',
        execute_rh: false,
        rh_user: '',
        rh_pass: '',
        overwrite: false
    });

    const updateExecOpt = (field, val) => {
        setExecutionOpts(prev => {
            const newState = { ...prev, [field]: val };
            if (field === 'execute_rh' && val === true) {
                newState.overwrite = true;
            }
            return newState;
        });
    };

    const runNexus = async () => {
        if (!nexusCode) return;
        setLoading(true);
        setProgressMsg('Initializing...');
        setError(null);
        setResult(null);

        try {
            const userEmail = localStorage.getItem('mic_email') || "user@example.com";
            const body = {
                user_id: "",
                email: userEmail,
                nexus_code: nexusCode,
                total_value: Number(totalValue),
                ...executionOpts
            };

            const response = await fetch(`/api/nexus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedData = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accumulatedData += chunk;

                // Split by newline
                const lines = accumulatedData.split('\n');
                accumulatedData = lines.pop(); // Keep last incomplete line

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);

                        if (event.type === 'progress') {
                            setProgressMsg(event.message);
                            console.log("Progress:", event.message);
                        } else if (event.type === 'result') {
                            setResult(event.payload);
                        } else if (event.type === 'error') {
                            throw new Error(event.message);
                        }
                    } catch (e) {
                        console.error("Parse error", e);
                    }
                }
            }

            // Check if we got a result
            // if (!result) throw new Error("Stream ended without result"); 
            // result state update is async, so we rely on the loop event.

        } catch (err) {
            console.error("Nexus Execution Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
            setProgressMsg('');
        }
    };

    // Sorting Logic
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortedHoldings = () => {
        const list = result?.table || result?.holdings || [];
        if (!list.length) return [];

        return [...list].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            // Handle numeric values
            if (sortConfig.key === 'weight') { aVal = a.weight || a.percent || 0; bVal = b.weight || b.percent || 0; }
            if (sortConfig.key === 'value') { aVal = Number(a.value); bVal = Number(b.value); }
            if (sortConfig.key === 'shares') { aVal = Number(a.shares); bVal = Number(b.shares); }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const sortedHoldings = getSortedHoldings();

    return (
        <AccessGate productKey="portfolio_nexus" title="Portfolio Nexus">
            <div className="min-h-screen bg-black text-white pt-24 px-4 pb-12 font-mono selection:bg-purple-900 selection:text-white">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="relative border-l-4 border-purple-500 pl-6 py-2">
                        <h1 className="text-5xl font-bold tracking-tight mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                            PORTFOLIO NEXUS
                        </h1>
                        <p className="text-gray-400 text-lg max-w-2xl">
                            Advanced Meta-Portfolio Construction & Execution Engine.
                            Combine multiple strategies and portfolios into a single cohesive allocation.
                        </p>
                        <div className="absolute top-0 right-0 hidden md:block opacity-20 transform translate-x-12 -translate-y-4">
                            <Network size={120} className="text-purple-500" />
                        </div>
                    </div>

                    {/* Control Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="lg:col-span-1 space-y-6"
                        >
                            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-transparent opacity-50"></div>

                                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-purple-400">
                                    <Database size={20} />
                                    Configuration
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Nexus Code</label>
                                        <input
                                            type="text"
                                            value={nexusCode}
                                            onChange={(e) => setNexusCode(e.target.value)}
                                            placeholder="e.g. ALPHA_PRIME"
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Total Capital ($)</label>
                                        <input
                                            type="number"
                                            value={totalValue}
                                            onChange={(e) => setTotalValue(e.target.value)}
                                            className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                                        />
                                    </div>

                                    {/* Execution Options */}
                                    <div className="pt-4 border-t border-gray-800 space-y-3">
                                        <h3 className="text-xs uppercase tracking-widest text-gold mb-2 font-bold">Execution Options</h3>

                                        {/* Fractional Shares */}
                                        <div className="bg-white/5 p-3 rounded-lg border border-gray-800">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={executionOpts.use_fractional_shares} onChange={e => updateExecOpt('use_fractional_shares', e.target.checked)} className="accent-gold" />
                                                <span className="text-sm">Use Fractional Shares</span>
                                            </label>
                                        </div>

                                        {/* Email */}
                                        <div className="bg-white/5 p-3 rounded-lg border border-gray-800">
                                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                <input type="checkbox" checked={executionOpts.send_email} onChange={e => updateExecOpt('send_email', e.target.checked)} className="accent-gold" />
                                                <span className="text-sm">Send Trades to Email</span>
                                            </label>
                                            {executionOpts.send_email && (
                                                <input
                                                    type="email"
                                                    placeholder="Email Address"
                                                    value={executionOpts.email_to}
                                                    onChange={e => updateExecOpt('email_to', e.target.value)}
                                                    className="w-full bg-black border border-gray-700 rounded p-2 text-xs"
                                                />
                                            )}
                                        </div>

                                        {/* Robinhood */}
                                        <div className="relative group">
                                            <div className={`p-3 rounded-lg border border-gray-800 transition-all ${executionOpts.execute_rh ? 'bg-gold/10 border-gold/30' : 'bg-white/5'}`}>
                                                <TierGate type="overlay" requiredTier="Pro" showLock={!['pro', 'enterprise', 'singularity', 'visionary', 'institutional'].includes((userProfile?.tier || 'Basic').toLowerCase())}>
                                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                        <input type="checkbox" checked={executionOpts.execute_rh} onChange={e => updateExecOpt('execute_rh', e.target.checked)} className="accent-gold" />
                                                        <span className="text-sm">Execute on Robinhood</span>
                                                    </label>
                                                    {executionOpts.execute_rh && (
                                                        <div className="space-y-2">
                                                            <input
                                                                type="text"
                                                                placeholder="RH Username"
                                                                value={executionOpts.rh_user}
                                                                onChange={e => updateExecOpt('rh_user', e.target.value)}
                                                                className="w-full bg-black border border-gray-700 rounded p-2 text-xs"
                                                            />
                                                            <input
                                                                type="password"
                                                                placeholder="RH Password"
                                                                value={executionOpts.rh_pass}
                                                                onChange={e => updateExecOpt('rh_pass', e.target.value)}
                                                                className="w-full bg-black border border-gray-700 rounded p-2 text-xs"
                                                            />
                                                        </div>
                                                    )}
                                                </TierGate>
                                            </div>
                                        </div>

                                        {/* Overwrite */}
                                        <label className={`flex items-center gap-2 cursor-pointer ${executionOpts.execute_rh ? 'text-gray-500 cursor-not-allowed opacity-70' : 'text-gray-400 hover:text-white'}`}>
                                            <input
                                                type="checkbox"
                                                checked={executionOpts.overwrite}
                                                onChange={e => {
                                                    if (executionOpts.execute_rh) return; // Prevent change if execution is enabled
                                                    updateExecOpt('overwrite', e.target.checked)
                                                }}
                                                disabled={executionOpts.execute_rh}
                                                className="accent-gold"
                                            />
                                            <span className="text-xs">Overwrite Last Save? {executionOpts.execute_rh && "(Locked by Execution)"}</span>
                                        </label>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            onClick={runNexus}
                                            disabled={loading || !nexusCode}
                                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all
                                    ${loading || !nexusCode
                                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40'}`}
                                        >
                                            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
                                            {loading ? (progressMsg || 'Processing...') : 'Execute Run'}
                                        </button>

                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-colors"
                                            title="Create New Nexus"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Instructions / Info */}
                            <div className="bg-gray-900/30 border border-gray-800 p-6 rounded-xl text-sm text-gray-400">
                                <h3 className="text-gray-300 font-semibold mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-yellow-500" />
                                    System Status
                                </h3>
                                <p>
                                    Nexus aligns multiple portfolios and commands into a singular execution path.
                                    Ensure all sub-portfolios exist in the database before running.
                                </p>
                            </div>
                        </motion.div>

                        {/* Results Display */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="lg:col-span-2 min-h-[400px]"
                        >
                            {error && (
                                <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-red-200 flex items-start gap-3">
                                    <AlertTriangle className="shrink-0 mt-1" />
                                    <div>
                                        <h3 className="font-bold mb-1">Execution Failed</h3>
                                        <p className="opacity-80 font-mono text-sm break-all">{error}</p>
                                    </div>
                                </div>
                            )}

                            {result && !error && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-gray-200">Portfolio Results</h3>
                                        {result.requires_execution_confirmation && (
                                            <button
                                                onClick={() => setShowExecModal(true)}
                                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-green-900/20"
                                            >
                                                <Play size={18} /> Execute Trades
                                            </button>
                                        )}
                                    </div>
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <SummaryCard label="Total Value" value={`$${result.total_value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} highlight="text-green-400" />
                                        <SummaryCard label="Cash Balance" value={`$${result.cash?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                                        <SummaryCard label="Holdings Count" value={(result.table || result.holdings)?.length} />
                                        <SummaryCard label="Nexus Code" value={result.nexus_code} highlight="text-purple-400" />
                                    </div>

                                    {/* Allocation Table */}
                                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                                            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                                                <BarChart3 size={18} className="text-blue-400" />
                                                Allocation Breakdown
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider bg-gray-900/50">
                                                        <th className="px-6 py-3 cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('ticker')}>
                                                            <div className="flex items-center gap-1">Ticker <SortIcon column="ticker" sortConfig={sortConfig} /></div>
                                                        </th>
                                                        <th className="px-6 py-3 text-right cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('shares')}>
                                                            <div className="flex items-center justify-end gap-1">Shares <SortIcon column="shares" sortConfig={sortConfig} /></div>
                                                        </th>
                                                        <th className="px-6 py-3 text-right cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('value')}>
                                                            <div className="flex items-center justify-end gap-1">Value <SortIcon column="value" sortConfig={sortConfig} /></div>
                                                        </th>
                                                        <th className="px-6 py-3 text-right cursor-pointer hover:text-white transition-colors group" onClick={() => handleSort('weight')}>
                                                            <div className="flex items-center justify-end gap-1">Weight <SortIcon column="weight" sortConfig={sortConfig} /></div>
                                                        </th>
                                                        <th className="px-6 py-3 hidden md:table-cell">Source Path</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800">
                                                    {sortedHoldings.map((h, i) => (
                                                        <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                                                            <td className="px-6 py-3 font-bold text-blue-300 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => setActiveTicker(h.ticker)}>{h.ticker}</td>
                                                            <td className="px-6 py-3 text-right font-mono text-gray-300">{Number(h.shares).toFixed(4)}</td>
                                                            <td className="px-6 py-3 text-right font-mono text-gray-300">${Number(h.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-3 text-right font-mono text-gray-300">
                                                                <span className="bg-gray-800 px-2 py-1 rounded text-xs">{Number(h.weight || h.percent || 0).toFixed(2)}%</span>
                                                            </td>
                                                            <td className="px-6 py-3 hidden md:table-cell text-xs text-gray-500 font-mono truncate max-w-[200px]" title={Array.isArray(h.path) ? h.path.join(' > ') : h.path}>
                                                                {Array.isArray(h.path) ? h.path.join(' > ') : h.path}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Cash Row */}
                                                    <tr className="bg-gray-900/30">
                                                        <td className="px-6 py-3 font-bold text-green-500">CASH</td>
                                                        <td className="px-6 py-3 text-right">-</td>
                                                        <td className="px-6 py-3 text-right font-mono text-green-400">${Number(result.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-6 py-3 text-right font-mono text-green-400">
                                                            <span className="bg-green-900/20 text-green-400 px-2 py-1 rounded text-xs">
                                                                {((result.cash / result.total_value) * 100).toFixed(2)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 hidden md:table-cell text-xs text-gray-500 text-center">-</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>


                                    {/* Recommended Trades Table */}
                                    {result.trades && result.trades.length > 0 && (
                                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden mt-6">
                                            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                                                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                                                    <RefreshCw size={18} className="text-green-400" />
                                                    Recommended Trades
                                                </h3>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead>
                                                        <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider bg-gray-900/50">
                                                            <th className="px-6 py-3">Ticker</th>
                                                            <th className="px-6 py-3">Action</th>
                                                            <th className="px-6 py-3 text-right">Quantity</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-800">
                                                        {result.trades.map((t, i) => (
                                                            <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                                                                <td className="px-6 py-3 font-bold text-white">{t.ticker}</td>
                                                                <td className={`px-6 py-3 font-bold uppercase ${t.action === 'Buy' || t.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {t.action || t.side}
                                                                </td>
                                                                <td className="px-6 py-3 text-right font-mono text-gray-300">
                                                                    {Number(t.diff || t.quantity).toFixed(4)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}



                            {!result && !error && !loading && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 py-20 border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                                    <Network size={64} className="mb-4 opacity-50" />
                                    <p>Configure and run a Nexus portfolio to see results.</p>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    <CreateNexusModal
                        isOpen={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                        initialCode={nexusCode}
                        onSave={(data) => {
                            setNexusCode(data.nexus_code);
                            setShowCreateModal(false);
                            runNexus(); // Auto-run after creation
                        }}
                    />

                    <ExecutionModal
                        isOpen={showExecModal}
                        onClose={() => setShowExecModal(false)}
                        onExecute={async (options) => {
                            // Handle Execution
                            const trades = result.trades || (result.table ? result.table.filter(t => t.ticker !== 'Cash' && t.ticker !== 'Total') : []);
                            // Fallback logic for trades if result.trades is empty but table exists? 
                            // Usually Nexus returns `trades` key specifically for rebalancing. If empty, maybe just holdings?
                            // The user said "No trade data found". This implies result.trades is missing. 
                            // If Nexus was run with "Execute RH", the backend might have already executed? 
                            // No, this modal is for manual "Execute Trades" button press AFTER run.
                            if (!trades || trades.length === 0) { alert("No trades to execute."); return; }


                            // MERGE logic: Use Modal's RH opts, but Parent's Execution Opts for email
                            // The user said "send email... only on the inputs menu".
                            // So we use `executionOpts` for email/overwrite.

                            const body = {
                                trades: trades,
                                rh_username: options.execRh ? options.rhUser : null,
                                rh_password: options.execRh ? options.rhPass : null,
                                email_to: executionOpts.send_email ? (executionOpts.email_to || localStorage.getItem('mic_email')) : null,
                                portfolio_code: result.nexus_code || "Nexus"
                            };

                            // Ensure email is valid if checked
                            if (executionOpts.send_email && !body.email_to) {
                                alert("Please enter an email address in the configuration panel.");
                                return;
                            }

                            try {
                                const response = await fetch('/api/execute-trades', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(body)
                                });
                                const res = await response.json();
                                if (res.status === 'success') {
                                    alert(res.message);
                                } else {
                                    alert("Error: " + res.message);
                                }
                            } catch (e) {
                                alert("Execution Error: " + e.message);
                            } finally {
                                setShowExecModal(false);
                            }
                        }}
                    />

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

                </div >
            </div >

            <UpgradePopup
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                featureName="Nexus Limit Reached"
            />
        </AccessGate >
    );
}

const SummaryCard = ({ label, value, highlight = "text-white" }) => (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg">
        <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-xl font-bold font-mono ${highlight}`}>{value}</div>
    </div>
);

const SortIcon = ({ column, sortConfig }) => {
    if (sortConfig.key !== column) return <span className="w-4 h-4" />; // Spacer
    return sortConfig.direction === 'asc'
        ? <ArrowUp size={14} className="text-purple-400" />
        : <ArrowDown size={14} className="text-purple-400" />;
};

const CreateNexusModal = ({ isOpen, onClose, onSave, initialCode = '' }) => {
    const [code, setCode] = useState(initialCode);
    const [components, setComponents] = useState([{ type: 'Portfolio', value: '', weight: 100, id: 1 }]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && initialCode) setCode(initialCode);
    }, [isOpen, initialCode]);

    const addComponent = () => {
        setComponents([...components, { type: 'Portfolio', value: '', weight: 0, id: Date.now() }]);
    };

    const removeComponent = (id) => {
        setComponents(components.filter(c => c.id !== id));
    };

    const updateComponent = (id, field, val) => {
        setComponents(components.map(c => c.id === id ? { ...c, [field]: val } : c));
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Send to backend
        try {
            const userEmail = localStorage.getItem('mic_email') || "user@example.com";
            const response = await fetch('/api/nexus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    nexus_code: code,
                    create_new: true,
                    components: components
                })
            });
            const data = await response.json();
            if (response.ok) {
                onSave({ nexus_code: code });
            } else {
                alert("Error: " + (data.message || "Failed"));
            }
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus className="text-purple-500" /> Create New Nexus
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1">Nexus Code</label>
                        <input
                            value={code} onChange={e => setCode(e.target.value)}
                            className="w-full bg-black border border-gray-700 rounded p-2 text-white"
                            placeholder="e.g. MEGA_FUND"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs uppercase text-gray-500">Components</label>
                            <button onClick={addComponent} className="text-xs bg-gray-800 px-2 py-1 rounded hover:bg-gray-700 text-purple-300">+ Add</button>
                        </div>

                        {components.map((comp, idx) => (
                            <div key={comp.id} className="flex gap-2 items-start bg-gray-950 p-3 rounded border border-gray-800">
                                <div className="flex-1 space-y-2">
                                    <div className="flex gap-2">
                                        <select
                                            value={comp.type}
                                            onChange={e => updateComponent(comp.id, 'type', e.target.value)}
                                            className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
                                        >
                                            <option value="Portfolio">Portfolio</option>
                                            <option value="Command">Command</option>
                                        </select>

                                        {/* Dynamic Input based on Type */}
                                        {comp.type === 'Command' ? (
                                            <select
                                                value={comp.value}
                                                onChange={e => updateComponent(comp.id, 'value', e.target.value)}
                                                className="flex-1 bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
                                            >
                                                <option value="">Select Command...</option>
                                                <option value="Market">Market (Top 10)</option>
                                                <option value="Breakout">Breakout (All)</option>
                                                <option value="Cultivate A">Cultivate (Code A)</option>
                                                <option value="Cultivate B">Cultivate (Code B)</option>
                                            </select>
                                        ) : (
                                            <input
                                                value={comp.value}
                                                onChange={e => updateComponent(comp.id, 'value', e.target.value)}
                                                placeholder="Portfolio Code"
                                                className="flex-1 bg-black border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-500">Weight %</label>
                                        <input
                                            type="number"
                                            value={comp.weight}
                                            onChange={e => updateComponent(comp.id, 'weight', Number(e.target.value))}
                                            className="w-24 bg-black border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <button onClick={() => removeComponent(comp.id)} className="text-red-500 hover:text-red-400 p-1">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded text-gray-400 hover:text-white" disabled={isSaving}>Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-purple-600 rounded text-white font-bold hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <RefreshCw className="animate-spin" size={16} />
                                Saving...
                            </>
                        ) : (
                            "Create Nexus"
                        )}
                    </button>
                </div>
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
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsProcessing(false);
            const savedEmail = localStorage.getItem('mic_email');
            const savedUser = localStorage.getItem('mic_rh_user');
            const savedPass = localStorage.getItem('mic_rh_pass');

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

        // We only pass back RH credentials. Email, overwrite are handled by initial configuration or main state if passed down, 
        // BUT wait, execution happens here on "Execute Trades" button which invokes /api/execute-trades.
        // The /api/execute-trades endpoint NEEDS email_to if we want to send email. 
        // We removed email input from Modal, so we rely on what was set in Main UI? 
        // Issue: ExecutionModal is a child, it doesn't know about Main UI state unless passed. 
        // We should pass `executionOpts` from parent to this modal or `onExecute` should merge it.
        // Let's rely on `onExecute` merging it.
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
                    <Play className="text-gold" /> Execute Trades
                </h3>

                <div className="space-y-6">
                    {/* Send Email and Overwrite are now handled in the main UI config, not here. This modal is strictly for RH confirmation if enabled, or just confirmation. */}

                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <p className="text-sm text-gray-300 mb-2">
                            You are about to execute trades.
                            {/* Check if main UI opts are on */}
                        </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${execRh ? 'border-gold bg-gold/5' : 'border-gray-700 bg-black/30'}`}>
                        <label className="flex items-center gap-3 cursor-pointer mb-2">
                            <input type="checkbox" checked={execRh} onChange={(e) => setExecRh(e.target.checked)} className="accent-gold w-5 h-5" />
                            <span className="font-bold text-white">Execute on Robinhood</span>
                        </label>
                        {execRh && (
                            <div className="space-y-2 mt-2">
                                <input type="text" placeholder="Robinhood Username" value={rhUser} onChange={(e) => setRhUser(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" />
                                <input type="password" placeholder="Robinhood Password" value={rhPass} onChange={(e) => setRhPass(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={onClose} disabled={isProcessing} className="text-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="bg-gold text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isProcessing ? 'Processing...' : 'Confirm Execution'}
                    </button>
                </div>
            </motion.div >
        </div >
    );
};