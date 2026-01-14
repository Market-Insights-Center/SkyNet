
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Terminal, Send, Cpu, Activity, AlertTriangle, Check, X, Play, RotateCcw, Save, Trash2, ChevronDown, Layers, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NeonWrapper from '../components/NeonWrapper';

const SentinelAI = () => {
    const { userProfile } = useAuth();
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [executionPlan, setExecutionPlan] = useState([]);
    const [executionStatus, setExecutionStatus] = useState("idle"); // idle, planning, reviewing, executing, complete, error
    const [logs, setLogs] = useState([]);
    const [results, setResults] = useState(null);
    const [reviewMode, setReviewMode] = useState(false);
    const [finalSummary, setFinalSummary] = useState(null);
    const logEndRef = useRef(null);

    const scrollToBottom = () => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [logs]);

    const handleManualSetup = () => {
        setExecutionPlan([{
            step_id: 1,
            tool: "market",
            params: { sensitivity: 2, market_type: "sp500" },
            output_key: "step_1_output",
            description: "Initial market scan"
        }]);
        setReviewMode(true);
    };

    const handlePlan = async () => {
        if (!prompt.trim() || isProcessing) return;
        setIsProcessing(true);
        setExecutionStatus("planning");
        setLogs(prev => [...prev, { type: "info", message: "Generating execution plan for review...", timestamp: new Date() }]);

        try {
            const response = await fetch('/api/sentinel/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_prompt: prompt, email: userProfile?.email })
            });
            const data = await response.json();
            if (data.plan) {
                setExecutionPlan(data.plan);
                setExecutionStatus("reviewing"); // Switch to review mode
                setReviewMode(true);
            }
        } catch (error) {
            setLogs(prev => [...prev, { type: "error", message: "Planning Failed: " + error.message }]);
            setExecutionStatus("error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExecute = async (planToExecute = null) => {
        // Allow execution if we have a plan (manual mode) even if prompt is empty
        if ((!prompt.trim() && !planToExecute) || isProcessing) return;

        setIsProcessing(true);
        // If getting passed a plan (from Review), use it. Otherwise clear it for fresh run.
        if (!planToExecute) {
            setExecutionStatus("planning");
            setExecutionPlan([]);
            setResults(null);
            setFinalSummary(null);
        } else {
            setExecutionStatus("executing");
            setReviewMode(false); // Close modal immediately
        }

        if (!planToExecute) setLogs([]); // Only clear logs on fresh run

        // Track Usage
        import('../services/usageService').then(({ trackUsage }) => trackUsage('ml_forecast'));

        try {
            const effectivePrompt = prompt.trim() || "Manual Plan Execution";
            const bodyPayload = { user_prompt: effectivePrompt, email: userProfile?.email };
            if (planToExecute) bodyPayload.plan = planToExecute;

            const response = await fetch('/api/sentinel/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("Access Denied: Singularity Tier Required.");
                }
                throw new Error("Failed to contact Sentinel Core.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep incomplete line

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        processEvent(event);
                    } catch (e) {
                        console.error("JSON Parse Error:", e, line);
                    }
                }
                // Allow UI to breathe/render
                await new Promise(resolve => setTimeout(resolve, 0));
            }

        } catch (error) {
            setLogs(prev => [...prev, { type: "error", message: error.message }]);
            setExecutionStatus("error");
        } finally {
            setIsProcessing(false);
            if (executionStatus !== "error") setExecutionStatus("complete");
            setReviewMode(false);
        }
    };

    const processEvent = (event) => {
        if (event.type === "status") {
            setLogs(prev => [...prev, { type: "info", message: event.message, timestamp: new Date() }]);
        } else if (event.type === "plan") {
            setExecutionPlan(event.plan);
            setExecutionStatus("executing");
            setLogs(prev => [...prev, { type: "success", message: "Execution Plan Generated.", timestamp: new Date() }]);
        } else if (event.type === "step_result") {
            setLogs(prev => [...prev, { type: "step", message: `Step ${event.step_id} Completed.`, result: event.result, timestamp: new Date() }]);
        } else if (event.type === "final") {
            setResults(event.context);
            setExecutionStatus("complete");
        } else if (event.type === "summary") {
            setFinalSummary(event.message); // Store for dedicated UI
            // Also log a small confirmation
            setLogs(prev => [...prev, { type: "success", message: "Initial Mission Report Generated.", timestamp: new Date() }]);
        } else if (event.type === "error") {
            setLogs(prev => [...prev, { type: "error", message: event.message, timestamp: new Date() }]);
            setExecutionStatus("error");
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-white pt-24 px-4 pb-20">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-cyan-900/20 rounded-full border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                            <Bot className="w-12 h-12 text-cyan-400" />
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-wider">
                        SENTINEL <span className="text-cyan-400">AI</span>
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto font-mono text-sm">
                        Advanced Autonomous Agent. Describe a complex multi-step financial task, and Sentinel will plan, execute, and summarize the results.
                    </p>
                </motion.div>

                {/* Main Interface Grid */}
                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Left: Input & Logs */}
                    <div className="lg:col-span-12 xl:col-span-7 space-y-6">

                        {/* Input Area */}
                        <div className="bg-gray-900/40 border border-cyan-500/30 rounded-xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Cpu size={100} />
                            </div>

                            <label className="block text-cyan-400 font-bold mb-2 font-mono flex items-center gap-2">
                                <Terminal size={16} /> ENTER COMMAND PROTOCOL
                            </label>

                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={isProcessing}
                                placeholder="E.g., 'Run a market scan for S&P 500 stocks with sensitivity 2, then run sentiment analysis on the top 3 results.'"
                                className="w-full h-32 bg-black/50 border border-gray-700 rounded-lg p-4 text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none font-mono text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleExecute();
                                    }
                                }}
                            />

                            <div className="mt-4 flex justify-end gap-4">
                                <NeonWrapper color="purple">
                                    <button
                                        onClick={handleManualSetup}
                                        disabled={isProcessing}
                                        className={`px-6 py-2 bg-black border border-gray-500/50 rounded-lg flex items-center gap-2 font-bold transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-500/10 text-gray-400'}`}
                                    >
                                        <Layers size={18} />
                                        MANUAL SET-UP
                                    </button>

                                    <button
                                        onClick={handlePlan}
                                        disabled={isProcessing || !prompt.trim()}
                                        className={`px-6 py-2 bg-black border border-purple-500/50 rounded-lg flex items-center gap-2 font-bold transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-500/10 text-purple-400'}`}
                                    >
                                        <Bot size={18} />
                                        PLAN & REVIEW
                                    </button>
                                </NeonWrapper>

                                <NeonWrapper color="cyan">
                                    <button
                                        onClick={() => handleExecute(null)}
                                        disabled={isProcessing || !prompt.trim()}
                                        className={`px-6 py-2 bg-black border border-cyan-500/50 rounded-lg flex items-center gap-2 font-bold transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-500/10 text-cyan-400'}`}
                                    >
                                        {isProcessing ? <Activity className="animate-spin" /> : <Send size={18} />}
                                        {isProcessing ? "PROCESSING..." : "QUICK EXECUTE"}
                                    </button>
                                </NeonWrapper>
                            </div>
                        </div>

                        {/* Live Terminal */}
                        <div className="bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs h-[400px] overflow-y-auto shadow-inner relative">
                            <div className="sticky top-0 bg-black/90 backdrop-blur pb-2 border-b border-gray-800 mb-2 flex items-center justify-between z-10">
                                <span className="text-gray-500 flex items-center gap-2"><Terminal size={12} /> SYSTEM LOG</span>
                                {executionStatus === 'running' && <span className="text-cyan-500 animate-pulse">● LIVE</span>}
                            </div>

                            <div className="space-y-1">
                                {logs.length === 0 && <span className="text-gray-700 italic">Ready for input...</span>}
                                {logs.map((log, i) => (
                                    <div key={i} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'}`}>
                                        <span className="text-gray-600 shrink-0">[{log.timestamp?.toLocaleTimeString()}]</span>
                                        <span className="w-full">
                                            {/* Standard Message */}
                                            {log.message}
                                            {/* Detail Block */}
                                            {log.result && log.type !== 'summary' && (
                                                <div className="mt-1 ml-4 p-2 bg-gray-900 border border-gray-800 rounded text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono text-xs">
                                                    {typeof log.result === 'object' ? JSON.stringify(log.result, null, 2) : log.result}
                                                </div>
                                            )}
                                        </span>
                                    </div>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        </div>

                        {/* FINAL MISSION REPORT (Dedicated Box) */}
                        <AnimatePresence>
                            {finalSummary && (
                                <motion.div
                                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.5, type: "spring" }}
                                    className="bg-black/90 backdrop-blur-xl border border-gold/50 rounded-2xl p-8 shadow-[0_0_100px_rgba(234,179,8,0.15)] relative overflow-hidden group mt-12 mb-12"
                                >
                                    <div className="absolute top-0 right-0 p-12 opacity-5 text-gold">
                                        <Bot size={300} />
                                    </div>
                                    <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-gold/5 rounded-full blur-[100px]"></div>

                                    {/* Header */}
                                    <div className="flex items-center justify-between border-b border-gold/20 pb-6 mb-8 relative z-10">
                                        <h3 className="text-3xl font-black text-gold flex items-center gap-4 tracking-widest font-mono">
                                            <div className="p-3 bg-gold/10 rounded-lg border border-gold/30">
                                                <Cpu size={32} />
                                            </div>
                                            MISSION REPORT
                                        </h3>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => navigator.clipboard.writeText(finalSummary)}
                                                className="px-4 py-2 bg-black border border-gold/30 rounded-lg text-gold hover:bg-gold/10 transition-all font-mono text-xs font-bold flex items-center gap-2"
                                            >
                                                <Layers size={14} /> COPY REPORT
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="text-gray-200 whitespace-pre-wrap font-sans text-base leading-relaxed space-y-6 relative z-10 max-h-[800px] overflow-y-auto pr-6 custom-scrollbar-gold">
                                        {finalSummary.split('\n').map((line, i) => {
                                            // Enhanced Markdown Rendering
                                            if (line.trim().startsWith('# ')) return <h1 key={i} className="text-3xl font-black text-white mt-8 mb-4 border-b border-gray-800 pb-2">{line.replace('# ', '')}</h1>;
                                            if (line.trim().startsWith('## ')) return <h2 key={i} className="text-2xl font-bold text-gold mt-8 mb-3 flex items-center gap-2"><span className="w-1 h-6 bg-gold rounded-full"></span>{line.replace('## ', '')}</h2>;
                                            if (line.trim().startsWith('### ')) return <h3 key={i} className="text-xl font-bold text-white mt-6 mb-2">{line.replace('### ', '')}</h3>;
                                            if (line.trim().startsWith('- ')) return <div key={i} className="flex gap-3 ml-2"><span className="text-gold mt-2">•</span><p className="flex-1 text-gray-300">{line.replace('- ', '')}</p></div>;
                                            if (line.trim().match(/^\d+\./)) return <div key={i} className="ml-2 font-bold text-white mt-3 p-3 bg-white/5 rounded-lg border-l-2 border-gold">{line}</div>;
                                            if (line.trim().startsWith('**') && line.trim().endsWith('**')) return <p key={i} className="font-bold text-gold text-lg mt-4">{line.replace(/\*\*/g, '')}</p>;

                                            // Dynamic Highlighting logic
                                            const isKeyMetric = line.includes(':') && /\d/.test(line);

                                            return <p key={i} className={`${isKeyMetric ? 'font-mono text-cyan-200 bg-cyan-900/20 p-2 rounded -mx-2' : 'text-gray-300'}`}>{line}</p>;
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right: Plan & Status */}
                    <div className="lg:col-span-12 xl:col-span-5 space-y-6">

                        {/* Plan Visualizer */}
                        <div className="bg-gray-900/20 border border-gray-800 rounded-xl p-6 h-full">
                            <h3 className="text-gold font-bold mb-4 flex items-center gap-2">
                                <Layers size={18} /> EXECUTION PLAN
                            </h3>

                            {executionPlan.length === 0 ? (
                                <div className="text-center text-gray-600 py-10 flex flex-col items-center">
                                    <Clock className="mb-2 opacity-50" />
                                    <span>Waiting for AI analysis...</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {executionPlan.map((step, idx) => (
                                        <div key={idx} className="relative pl-6 border-l-2 border-gray-700">
                                            {/* Status Dot */}
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${logs.find(l => l.message.includes(`Step ${step.step_id} Completed`))
                                                ? 'bg-green-500 border-green-900'
                                                : logs.find(l => l.message.includes(`Executing Step ${step.step_id}`))
                                                    ? 'bg-cyan-500 border-cyan-900 animate-pulse'
                                                    : 'bg-gray-800 border-gray-600'
                                                }`}></div>

                                            <h4 className="font-bold text-gray-200">Step {step.step_id}: {step.tool.toUpperCase()}</h4>
                                            <p className="text-sm text-gray-400">{step.description}</p>
                                            <div className="mt-1 text-xs font-mono text-gray-500">
                                                Input: {JSON.stringify(step.params)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Plan Review Modal / Overlay */}
                        <AnimatePresence>
                            {reviewMode && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                                >
                                    <div className="bg-gray-900 border border-purple-500 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(168,85,247,0.3)]">
                                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-purple-900/20">
                                            <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                                                <Layers /> Review Execution Plan
                                            </h3>
                                            <button onClick={() => setReviewMode(false)} className="text-gray-400 hover:text-white">✕</button>
                                        </div>

                                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                                            <p className="text-sm text-gray-400 mb-4">
                                                Review and modify the generated steps before execution. You can manually adjust parameters to correct connections (e.g., change inputs).
                                            </p>

                                            {executionPlan.map((step, idx) => (
                                                <div key={idx} className="bg-black/50 border border-gray-700 rounded-lg p-4 relative group hover:border-purple-500/50 transition-colors">
                                                    {/* Header */}
                                                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-purple-900/40 text-purple-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-purple-500/30">
                                                                {idx + 1}
                                                            </div>
                                                            <div className="flex-1 relative group/select">
                                                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-cyan-500 group-hover/select:text-cyan-300 transition-colors">
                                                                    <ChevronDown size={16} />
                                                                </div>
                                                                <select
                                                                    className="w-full bg-black/60 border border-cyan-500/30 text-cyan-400 font-bold uppercase outline-none cursor-pointer hover:border-cyan-400 focus:border-cyan-400 focus:bg-cyan-900/10 rounded px-3 py-1.5 appearance-none pr-8 transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)] hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                                                                    value={step.tool}
                                                                    onChange={(e) => {
                                                                        const newTool = e.target.value;
                                                                        const newPlan = [...executionPlan];

                                                                        // Reset params & Set Default Description
                                                                        let defaultParams = {};
                                                                        let defaultDesc = "";

                                                                        if (newTool === 'market') {
                                                                            defaultParams = { sensitivity: 2, market_type: "sp500" };
                                                                            defaultDesc = "Scan market for opportunities.";
                                                                        } else if (newTool === 'manual_list') {
                                                                            defaultParams = { tickers: "" };
                                                                            defaultDesc = "Process manual ticker list.";
                                                                        } else if (['sentiment', 'fundamentals', 'powerscore', 'quickscore'].includes(newTool)) {
                                                                            defaultParams = { tickers_source: "", limit: 10 };
                                                                            const toolLabels = {
                                                                                sentiment: "Analyze sentiment",
                                                                                fundamentals: "Check fundamentals",
                                                                                powerscore: "Calculate PowerScore",
                                                                                quickscore: "Get QuickScore"
                                                                            };
                                                                            defaultDesc = `${toolLabels[newTool]} for top tickers...`;
                                                                        } else if (newTool === 'summary') {
                                                                            defaultParams = { data_source: "$CONTEXT" };
                                                                            defaultDesc = "Generate final mission report.";
                                                                        }

                                                                        newPlan[idx] = {
                                                                            ...step,
                                                                            tool: newTool,
                                                                            params: defaultParams,
                                                                            description: defaultDesc
                                                                        };
                                                                        setExecutionPlan(newPlan);
                                                                    }}
                                                                >
                                                                    {/* Dynamic Options based on Step Index & Usage */}
                                                                    {(() => {
                                                                        // Step 0: Input Sources Only (Market, Manual)
                                                                        if (idx === 0) {
                                                                            return (
                                                                                <>
                                                                                    <option value="market" className="bg-gray-900 text-white">MARKET SCAN</option>
                                                                                    <option value="manual_list" className="bg-gray-900 text-white">MANUAL TICKER LIST</option>
                                                                                </>
                                                                            );
                                                                        }

                                                                        // Step > 0: Analysis Tools (Exclude used ones, except self)
                                                                        const analysisTools = [
                                                                            { id: 'sentiment', label: 'SENTIMENT ANALYSIS' },
                                                                            { id: 'fundamentals', label: 'FUNDAMENTALS' },
                                                                            { id: 'powerscore', label: 'POWERSCORE' },
                                                                            { id: 'quickscore', label: 'QUICKSCORE' }
                                                                        ];

                                                                        // Filter out tools used elsewhere in the plan
                                                                        const usedTools = executionPlan.map(s => s.tool);

                                                                        const options = analysisTools.map(t => (
                                                                            <option
                                                                                key={t.id}
                                                                                value={t.id}
                                                                                disabled={usedTools.includes(t.id) && step.tool !== t.id}
                                                                                className={`${usedTools.includes(t.id) && step.tool !== t.id ? 'text-gray-600 bg-gray-900' : 'bg-gray-900 text-white'}`}
                                                                            >
                                                                                {t.label} {usedTools.includes(t.id) && step.tool !== t.id ? '(Used)' : ''}
                                                                            </option>
                                                                        ));

                                                                        // Always allow Summary as last step
                                                                        options.push(
                                                                            <option key="summary" value="summary" className="bg-gray-900 text-gold font-bold">
                                                                                ⭐ SUMMARY GENERATION
                                                                            </option>
                                                                        );

                                                                        return options;
                                                                    })()}
                                                                </select>
                                                            </div>
                                                        </div>


                                                        <div className="flex items-center gap-1">
                                                            {/* Reordering Controls */}
                                                            <div className="flex flex-col gap-0.5 mr-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (idx === 0) return;
                                                                        const newPlan = [...executionPlan];
                                                                        [newPlan[idx - 1], newPlan[idx]] = [newPlan[idx], newPlan[idx - 1]];
                                                                        // Update Step IDs
                                                                        newPlan.forEach((s, i) => { s.step_id = i + 1; s.output_key = `step_${i + 1}_output`; });
                                                                        setExecutionPlan(newPlan);
                                                                    }}
                                                                    disabled={idx === 0}
                                                                    className={`text-gray-500 hover:text-cyan-400 disabled:opacity-30 ${idx === 0 ? '' : 'cursor-pointer'}`}
                                                                >
                                                                    ▲
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (idx === executionPlan.length - 1) return;
                                                                        const newPlan = [...executionPlan];
                                                                        [newPlan[idx + 1], newPlan[idx]] = [newPlan[idx], newPlan[idx + 1]];
                                                                        // Update Step IDs
                                                                        newPlan.forEach((s, i) => { s.step_id = i + 1; s.output_key = `step_${i + 1}_output`; });
                                                                        setExecutionPlan(newPlan);
                                                                    }}
                                                                    disabled={idx === executionPlan.length - 1}
                                                                    className={`text-gray-500 hover:text-cyan-400 disabled:opacity-30 text-[10px] ${idx === executionPlan.length - 1 ? '' : 'cursor-pointer'}`}
                                                                >
                                                                    ▼
                                                                </button>
                                                            </div>

                                                            <button
                                                                onClick={() => {
                                                                    const newPlan = executionPlan.filter((_, i) => i !== idx);
                                                                    // Re-index steps
                                                                    const reindexed = newPlan.map((s, i) => ({ ...s, step_id: i + 1, output_key: `step_${i + 1}_output` }));
                                                                    setExecutionPlan(reindexed);
                                                                }}
                                                                className="text-gray-600 hover:text-red-400 p-1"
                                                            >
                                                                <Activity size={16} className="rotate-45" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Body */}
                                                    <div className="space-y-4">
                                                        {/* Description */}
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Description</label>
                                                            <input
                                                                type="text"
                                                                className="w-full bg-gray-900/50 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 focus:border-purple-500/50 outline-none"
                                                                value={step.description}
                                                                onChange={(e) => {
                                                                    const newPlan = [...executionPlan];
                                                                    newPlan[idx].description = e.target.value;
                                                                    setExecutionPlan(newPlan);
                                                                }}
                                                            />
                                                        </div>

                                                        {/* MANUAL LIST UI */}
                                                        {step.tool === 'manual_list' && (
                                                            <div>
                                                                <label className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1">
                                                                    Tickers (Comma Separated)
                                                                </label>
                                                                <textarea
                                                                    className="w-full h-20 bg-gray-900 border border-gray-700 rounded px-2 py-2 text-xs text-white focus:border-purple-500 outline-none font-mono"
                                                                    placeholder="AAPL, MSFT, TSLA..."
                                                                    value={step.params.tickers || ""}
                                                                    onChange={(e) => {
                                                                        const newPlan = [...executionPlan];
                                                                        newPlan[idx].params = { ...newPlan[idx].params, tickers: e.target.value };
                                                                        setExecutionPlan(newPlan);
                                                                    }}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Inputs / Dependencies */}
                                                        {['sentiment', 'powerscore', 'fundamentals', 'quickscore'].includes(step.tool) && (
                                                            <div>
                                                                <label className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                                                                    <Layers size={10} /> Data Source
                                                                </label>
                                                                <select
                                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                                                                    value={step.params.tickers_source || ""}
                                                                    onChange={(e) => {
                                                                        const newPlan = [...executionPlan];
                                                                        newPlan[idx].params = { ...newPlan[idx].params, tickers_source: e.target.value };
                                                                        setExecutionPlan(newPlan);
                                                                    }}
                                                                >
                                                                    <option value="">Select Input Source...</option>
                                                                    {idx > 0 && executionPlan.slice(0, idx).map((prevStep, prevIdx) => (
                                                                        <option key={prevIdx} value={`$step_${prevStep.step_id}_output.top_10`}>
                                                                            Step {prevStep.step_id} ({prevStep.tool.toUpperCase()}) Output
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}

                                                        {/* Tool Specific Params */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {step.tool === 'market' && (
                                                                <>
                                                                    <div>
                                                                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Sensitivity</label>
                                                                        <select
                                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none"
                                                                            value={step.params.sensitivity || 2}
                                                                            onChange={(e) => {
                                                                                const newPlan = [...executionPlan];
                                                                                newPlan[idx].params = { ...newPlan[idx].params, sensitivity: parseInt(e.target.value) };
                                                                                setExecutionPlan(newPlan);
                                                                            }}
                                                                        >
                                                                            <option value="1">1 (Weekly)</option>
                                                                            <option value="2">2 (Daily)</option>
                                                                            <option value="3">3 (Hourly)</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Market Type</label>
                                                                        <select
                                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none"
                                                                            value={step.params.market_type || "sp500"}
                                                                            onChange={(e) => {
                                                                                const newPlan = [...executionPlan];
                                                                                newPlan[idx].params = { ...newPlan[idx].params, market_type: e.target.value };
                                                                                setExecutionPlan(newPlan);
                                                                            }}
                                                                        >
                                                                            <option value="sp500">S&P 500</option>
                                                                            <option value="plus">Large Cap &gt;50B</option>
                                                                            <option value="plusplus">Mid Cap &gt;10B</option>
                                                                        </select>
                                                                    </div>
                                                                </>
                                                            )}

                                                            {['sentiment', 'powerscore', 'fundamentals', 'quickscore'].includes(step.tool) && (
                                                                <div>
                                                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Limit (Max Items)</label>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none"
                                                                        value={step.params.limit || 3}
                                                                        onChange={(e) => {
                                                                            const newPlan = [...executionPlan];
                                                                            newPlan[idx].params = { ...newPlan[idx].params, limit: parseInt(e.target.value) };
                                                                            setExecutionPlan(newPlan);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Connector Line Visual */}
                                                    {
                                                        idx < executionPlan.length - 1 && (
                                                            <div className="absolute -bottom-6 left-7 w-0.5 h-6 bg-gray-800 z-0"></div>
                                                        )
                                                    }
                                                </div>
                                            ))}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const nextId = executionPlan.length + 1;
                                                        // Determine next available tool
                                                        const usedTools = executionPlan.map(s => s.tool);
                                                        const allTools = ['sentiment', 'fundamentals', 'powerscore', 'quickscore'];
                                                        const available = allTools.find(t => !usedTools.includes(t));

                                                        if (available) {
                                                            setExecutionPlan([...executionPlan, {
                                                                step_id: nextId,
                                                                tool: available,
                                                                params: { tickers_source: "", limit: 10 },
                                                                output_key: `step_${nextId}_output`,
                                                                description: `Analyze using ${available}...`
                                                            }]);
                                                        }
                                                    }}
                                                    disabled={executionPlan.length >= 5}
                                                    className={`flex-1 py-3 border-2 border-dashed border-gray-800 rounded-lg text-gray-500 hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 font-bold text-sm ${executionPlan.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center text-xs">+</div>
                                                    ADD STEP
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        const nextId = executionPlan.length + 1;
                                                        setExecutionPlan([...executionPlan, {
                                                            step_id: nextId,
                                                            tool: "summary",
                                                            params: { data_source: "$CONTEXT" },
                                                            output_key: "final_summary",
                                                            description: "Generate final summary."
                                                        }]);
                                                    }}
                                                    className="px-4 py-3 border-2 border-dashed border-gray-800 rounded-lg text-gray-500 hover:text-gold hover:border-gold/30 hover:bg-gold/5 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                                                >
                                                    <Layers size={14} />
                                                    + SUMMARY
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-900">
                                            <button
                                                onClick={() => setReviewMode(false)}
                                                className="px-4 py-2 rounded text-gray-300 hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleExecute(executionPlan)}
                                                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold transition-colors shadow-lg shadow-purple-900/50"
                                            >
                                                Confirm & Execute
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SentinelAI;
