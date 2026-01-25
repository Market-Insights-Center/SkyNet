import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Play, Settings, Terminal, Cpu, Database, RefreshCw, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import OptimizationStatus from './OptimizationStatus';

const STRATEGIES = [
    { value: 'rsi', label: 'RSI Strategy' },
    { value: 'ma_crossover', label: 'MA Crossover' },
    { value: 'macd', label: 'MACD' },
    { value: 'bollinger', label: 'Bollinger Bands' },
    { value: 'trend_following', label: 'Trend Following' }
];

const TICKERS = [
    'SPY', 'QQQ', 'IWM', 'DIA', 'BTC-USD', 'ETH-USD',
    'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META'
];

const PERIODS = [
    '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max', 'ytd'
];

const UNIVERSES = [
    { value: 'SPY', label: 'S&P 500 (SPY)' },
    { value: 'QQQ', label: 'Nasdaq 100 (QQQ)' },
    { value: 'AI_TECH', label: 'AI & Tech Growth' },
    { value: 'CRYPTO', label: 'Top Crypto' }
];

const CONDITIONS = [
    { value: 'Current_1Y', label: 'Current Market (1Y)' },
    { value: '2022_Bear', label: '2022 Bear Market' },
    { value: '2021_Bull', label: '2021 Bull Run' },
    { value: '2020_Crash', label: 'COVID Crash (2020)' }
];

const TARGET_FILES = [
    'risk_command.py',
    'breakout_command.py',
    'sentiment_command.py',
    'fundamentals_command.py',
    'mlforecast_command.py'
];

const BackgroundCommandPanel = () => {
    const [status, setStatus] = useState({ active: false, mode: 'Loading...', schedule: [] });
    // Granular loading states
    const [globalLoading, setGlobalLoading] = useState(false);
    const [loadingStates, setLoadingStates] = useState({
        optimize: false,
        convergence: false,
        test: false
    });

    const [output, setOutput] = useState('');
    const terminalRef = React.useRef(null);

    // Command States
    const [optimizeParams, setOptimizeParams] = useState({ strategy: 'rsi', ticker: 'SPY', period: '1y', generations: 10, population: 20 });
    const [convergenceParams, setConvergenceParams] = useState({ run_name: 'auto_run', universes: 'SPY', conditions: 'Current_1Y', strategies: 'ma_crossover' });
    const [testParams, setTestParams] = useState({ file: 'risk_command.py', ticker: 'SPY', period: '1y', mode: 'manual' });

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output]);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/background/status');
            const data = await res.json();
            setStatus({
                active: data.active,
                mode: data.mode,
                schedule: data.schedule || []
            });
        } catch (e) {
            console.error("Failed to fetch status:", e);
        }
    };

    const toggleStatus = async () => {
        setGlobalLoading(true);
        try {
            const res = await fetch('/api/background/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !status.active })
            });
            const data = await res.json();
            setStatus(prev => ({ ...prev, active: data.active }));
        } catch (e) {
            alert("Failed to toggle status");
        } finally {
            setGlobalLoading(false);
        }
    };

    // Log Polling
    useEffect(() => {
        let pollInterval;
        if (status.active || Object.values(loadingStates).some(v => v)) {
            pollInterval = setInterval(fetchLogs, 2000);
        }
        return () => clearInterval(pollInterval);
    }, [status.active, loadingStates]);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/background/logs?lines=50');
            const data = await res.json();
            if (data.logs && Array.isArray(data.logs)) {
                setOutput(data.logs.join(''));
            }
        } catch (e) {
            console.error("Failed to fetch logs:", e);
        }
    };

    const runCommand = async (command, params) => {
        setLoadingStates(prev => ({ ...prev, [command]: true }));
        // Don't clear output immediately, let logs append/refresh

        try {
            // Convert comma-separated strings to lists for convergence
            const formattedParams = { ...params };
            if (command === 'convergence') {
                formattedParams.universes = params.universes.split(',').map(s => s.trim());
                formattedParams.conditions = params.conditions.split(',').map(s => s.trim());
                formattedParams.strategies = params.strategies.split(',').map(s => s.trim());
            }

            const res = await fetch('/api/background/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, params: formattedParams })
            });
            const data = await res.json();

            // We rely on logs for output now, but can append the immediate API response too
            if (data.status !== 'success') {
                // Only append error if distinct, otherwise logs will show it likely
                // setOutput(prev => prev + `\nError: ${data.detail || data.message}\n> Failed.\n`);
            }
        } catch (e) {
            // setOutput(prev => prev + `\nNetwork Error: ${e.message}\n> Failed.\n`);
        } finally {
            setLoadingStates(prev => ({ ...prev, [command]: false }));
            fetchLogs(); // One final fetch
        }
    };

    const inputClass = "w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-gold/50 focus:outline-none";

    return (
        <div className="space-y-6">
            {/* Header / Status */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${status.active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        <Cpu size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            Prometheus Core
                            <span className={`text-xs px-2 py-0.5 rounded-full ${status.active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                {status.active ? "ONLINE" : "OFFLINE"}
                            </span>
                        </h2>
                        <div className="flex gap-4 text-sm text-gray-400">
                            <span>Mode: {status.mode}</span>
                            <span>Scheduled Jobs: {status.schedule.length}</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={toggleStatus}
                    disabled={globalLoading}
                    className={`px-6 py-2 rounded-lg font-bold transition-all ${status.active
                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                        : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
                >
                    {globalLoading ? "Processing..." : status.active ? "Deactivate Core" : "Activate Core"}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* KRONOS COMMAND CENTER */}
                <div className="space-y-6">
                    {/* OPTIMIZE CARD */}
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden relative">
                        {loadingStates.optimize && <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center pointer-events-none"><span className="text-gold font-bold animate-pulse">OPTIMIZING...</span></div>}
                        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Settings size={18} className="text-gold" /> Parameter Optimization</h3>
                            <button
                                onClick={() => runCommand('optimize', optimizeParams)}
                                disabled={loadingStates.optimize}
                                className="bg-gold text-black px-3 py-1 rounded text-sm font-bold hover:bg-yellow-500 disabled:opacity-50"
                            >
                                Run Optim
                            </button>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500">Strategy</label>
                                <select className={inputClass} value={optimizeParams.strategy} onChange={e => setOptimizeParams({ ...optimizeParams, strategy: e.target.value })}>
                                    {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Ticker</label>
                                <select className={inputClass} value={optimizeParams.ticker} onChange={e => setOptimizeParams({ ...optimizeParams, ticker: e.target.value })}>
                                    {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Period</label>
                                <select className={inputClass} value={optimizeParams.period} onChange={e => setOptimizeParams({ ...optimizeParams, period: e.target.value })}>
                                    {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Gens</label>
                                    <input type="number" className={inputClass} value={optimizeParams.generations} onChange={e => setOptimizeParams({ ...optimizeParams, generations: parseInt(e.target.value) })} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Pop</label>
                                    <input type="number" className={inputClass} value={optimizeParams.population} onChange={e => setOptimizeParams({ ...optimizeParams, population: parseInt(e.target.value) })} />
                                </div>
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded text-xs text-blue-200 flex gap-2">
                                <RefreshCw size={14} className="mt-0.5 shrink-0" />
                                <span>Specific evolutionary algorithm (GA) to find best params for a single strategy on one ticker.</span>
                            </div>
                        </div>
                    </div>

                    {/* CONVERGENCE CARD */}
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden relative">
                        {loadingStates.convergence && <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center pointer-events-none"><span className="text-purple-400 font-bold animate-pulse">RUNNING CONVERGENCE...</span></div>}
                        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Database size={18} className="text-purple-400" /> Convergence Matrix</h3>
                            <button
                                onClick={() => runCommand('convergence', convergenceParams)}
                                disabled={loadingStates.convergence}
                                className="bg-purple-500/20 text-purple-400 border border-purple-500/50 px-3 py-1 rounded text-sm font-bold hover:bg-purple-500/30 disabled:opacity-50"
                            >
                                Start Run
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-xs text-gray-500">Run Name</label>
                                <input className={inputClass} value={convergenceParams.run_name} onChange={e => setConvergenceParams({ ...convergenceParams, run_name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Universes</label>
                                <select className={inputClass} value={convergenceParams.universes} onChange={e => setConvergenceParams({ ...convergenceParams, universes: e.target.value })}>
                                    {UNIVERSES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Conditions</label>
                                <select className={inputClass} value={convergenceParams.conditions} onChange={e => setConvergenceParams({ ...convergenceParams, conditions: e.target.value })}>
                                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Strategies</label>
                                <select className={inputClass} value={convergenceParams.strategies} onChange={e => setConvergenceParams({ ...convergenceParams, strategies: e.target.value })}>
                                    {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <div className="bg-purple-900/10 border border-purple-500/20 p-3 rounded text-xs text-purple-200 flex gap-2">
                                <Zap size={14} className="mt-0.5 shrink-0" />
                                <span>Massive multi-scenario backtest execution. Runs permutations of Universes x Conditions x Strategies to solve market "truth".</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* TEST / IMPROVE CARD */}
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden relative">
                        {loadingStates.test && <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center pointer-events-none"><span className="text-green-400 font-bold animate-pulse">TESTING...</span></div>}
                        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><CheckCircle size={18} className="text-green-400" /> Self-Improvement Test</h3>
                            <button
                                onClick={() => runCommand('test', testParams)}
                                disabled={loadingStates.test}
                                className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded text-sm font-bold hover:bg-green-500/30 disabled:opacity-50"
                            >
                                Run Test
                            </button>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs text-gray-500">Target File</label>
                                <select className={inputClass} value={testParams.file} onChange={e => setTestParams({ ...testParams, file: e.target.value })}>
                                    {TARGET_FILES.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Ticker</label>
                                <select className={inputClass} value={testParams.ticker} onChange={e => setTestParams({ ...testParams, ticker: e.target.value })}>
                                    {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Mode</label>
                                <select className={inputClass} value={testParams.mode} onChange={e => setTestParams({ ...testParams, mode: e.target.value })}>
                                    <option value="manual">Manual Review</option>
                                    <option value="auto">Auto Apply</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <div className="bg-green-900/10 border border-green-500/20 p-3 rounded text-xs text-green-200 flex gap-2">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <span>Uses AI to generate a hypothesis for code improvement, writes new code, and validates it against current version.</span>
                            </div>
                        </div>
                    </div>

                    {/* SCHEDULE CARD */}
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Activity size={18} className="text-blue-400" /> Active Schedule</h3>
                        </div>
                        <div className="p-4 max-h-48 overflow-y-auto space-y-2">
                            {status.schedule.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">No scheduled jobs.</p>
                            ) : (
                                status.schedule.map((job, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-white/5 rounded border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white">{job.job_type}</span>
                                            <span className="text-xs text-gray-400">{job.ticker} • {job.interval}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-gold">{new Date(job.next_run).toLocaleTimeString()}</span>
                                            <div className="text-[10px] text-gray-500">{new Date(job.next_run).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* CURRENT STATUS */}
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Activity size={18} className="text-blue-400" /> Current Activity</h3>
                        </div>
                        <div className="p-4 font-mono text-xs text-blue-300">
                            {output ? (
                                output.split('\n').reverse().find(l => l.includes("Executing:") || l.includes("Generation") || l.includes("Step")) || "Idle"
                            ) : "Idle"}
                        </div>
                    </div>

                    {/* TERMINAL OUTPUT */}
                    <div className="bg-black rounded-xl border border-white/10 flex flex-col h-48 font-mono text-xs">
                        <div className="p-2 border-b border-white/10 flex items-center justify-between text-gray-500">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} />
                                <span>System Logs</span>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(output)}
                                className="text-[10px] bg-white/10 px-2 py-0.5 rounded hover:bg-white/20 hover:text-white transition-colors"
                            >
                                Copy Logs
                            </button>
                        </div>
                        <div
                            ref={terminalRef}
                            className="p-4 overflow-auto flex-1 text-gray-300 whitespace-pre-wrap"
                        >
                            {!output ? "Ready..." : output.split('\n').map((line, i) => {
                                // Skip printing the final result in the log stream if we are showing it separately
                                // but keeping it for context might be good. Let's keep it but grey it out.
                                if (line.includes("[FINAL RESULT]")) return null;

                                if (line.includes("ERROR") || line.includes("Exception")) {
                                    return <div key={i} className="text-red-400 whitespace-pre-wrap">{line}</div>;
                                }
                                if (line.includes("WARNING")) {
                                    return <div key={i} className="text-yellow-400 whitespace-pre-wrap">{line}</div>;
                                }
                                return <div key={i} className="whitespace-pre-wrap min-h-[1.2em] opacity-80">{line}</div>;
                            })}
                        </div>
                    </div>

                    {/* FINAL RESULT BOX */}
                    <OptimizationStatus />

                    <AnimatePresence>
                        {(() => {
                            if (!output) return null;
                            const finalResultLine = output.split('\n').find(l => l.includes("[FINAL RESULT]"));

                            // CASE: GENERIC FINAL RESULT (Fallback for non-optimization commands)
                            if (finalResultLine) {
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-green-900/10 rounded-xl border border-green-500/30 overflow-hidden shadow-[0_0_20px_rgba(74,222,128,0.1)]"
                                    >
                                        <div className="p-4 bg-green-500/10 border-b border-green-500/20 flex justify-between items-center">
                                            <h3 className="font-bold flex items-center gap-2 text-green-400"><CheckCircle size={18} /> Final Output</h3>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(finalResultLine.replace("[FINAL RESULT]", ""))}
                                                className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded hover:bg-green-500/20 transition-colors border border-green-500/20"
                                            >
                                                Copy Result
                                            </button>
                                        </div>
                                        <div className="p-6 text-sm font-mono text-green-300 whitespace-pre-wrap leading-relaxed">
                                            {finalResultLine.replace("[FINAL RESULT]", "")}
                                        </div>
                                    </motion.div>
                                );
                            }
                            return null;
                        })()}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default BackgroundCommandPanel;
