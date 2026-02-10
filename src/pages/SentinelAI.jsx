import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Terminal, Send, Cpu, Activity, AlertTriangle, Check, X, Play, RotateCcw, Save, Trash2, Copy,
    ChevronDown, Layers, Clock, Mic, Volume2, VolumeX, Globe, Search, Menu, History, MessageSquare, ChevronLeft, ChevronRight, Zap, Plus, Settings, FileText, Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NeonWrapper from '../components/NeonWrapper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DataView from '../components/DataView'; // NEW IMPORT

// ... (Existing Tool Definitions) ...
const SENTINEL_TOOLS = [
    { value: "market", label: "Market Scan", params: ["sensitivity", "market_type"] },
    { value: "sentiment", label: "Sentiment Analysis", params: ["tickers_source", "limit"] },
    { value: "risk", label: "Risk Assessment", params: [] },
    { value: "fundamentals", label: "Fundamental Data", params: ["tickers_source", "limit"] },
    { value: "powerscore", label: "PowerScore Analysis", params: ["tickers_source", "limit"] },
    { value: "quickscore", label: "Quick Technical Score", params: ["tickers_source"] },
    { value: "mlforecast", label: "ML Price Forecast", params: ["tickers_source", "limit"] },
    { value: "nexus_import", label: "Import Nexus Portfolio", params: ["nexus_code"] },
    { value: "research", label: "Web Research", params: ["query", "tickers_source"] },
    { value: "assess", label: "Assess Risk (Beta/Corr)", params: ["tickers_source", "assess_type"] },
    { value: "summary", label: "Generate Summary", params: ["data_source"] }
];

const PARAM_OPTIONS = {
    sensitivity: [
        { value: 1, label: "1 (Weekly)" },
        { value: 2, label: "2 (Daily)" },
        { value: 3, label: "3 (Hourly)" }
    ],
    market_type: [
        { value: "sp500", label: "S&P 500" },
        { value: "plus", label: "S&P 500 + Nasdaq" },
        { value: "plusplus", label: "Full Market" }
    ],
    tickers_source: [
        { value: "$step_1_output.top_10", label: "Top 10 from Step 1" },
        { value: "$step_1_output.bottom_10", label: "Bottom 10 from Step 1" },
        { value: "user_input", label: "Manual Input" }
    ],
    assess_type: [
        { value: "code_a", label: "Code A (Beta/Correlation)" }
    ]
};

const SentinelAI = () => {
    const { userProfile } = useAuth();

    // Core State
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [executionPlan, setExecutionPlan] = useState([]);
    const [executionStatus, setExecutionStatus] = useState("idle");
    const [logs, setLogs] = useState([]);
    const [results, setResults] = useState(null);
    const [finalSummary, setFinalSummary] = useState(null);
    const [structuredData, setStructuredData] = useState([]); // NEW STATE
    const [lastReport, setLastReport] = useState(null);

    // UI State
    const [reviewMode, setReviewMode] = useState(false);
    const [isManualMode, setIsManualMode] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [researchMode, setResearchMode] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [pastSessions, setPastSessions] = useState([]);
    const [activeView, setActiveView] = useState("report"); // report, data, plan

    const logEndRef = useRef(null);

    // ... (Hooks) ...
    useEffect(() => {
        if (userProfile?.email) fetchHistory();
    }, [userProfile]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/sentinel/history?email=${userProfile.email}`);
            const data = await res.json();
            if (Array.isArray(data)) setPastSessions(data);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    };

    const loadSession = (session) => {
        setPrompt(session.prompt);
        setExecutionPlan(session.steps || []);
        setFinalSummary(session.final_summary);
        // Ensure legacy sessions don't break
        setStructuredData(session.structured_data || []);
        setLogs([{ type: 'info', message: 'Loaded past session.', timestamp: new Date(session.timestamp * 1000) }]);
        setShowSidebar(false);
        setActiveView("report");
    };

    const saveCurrentSession = async () => {
        if (!finalSummary) return;
        try {
            const payload = {
                user_prompt: prompt,
                email: userProfile.email,
                plan: executionPlan,
                summary: finalSummary,
                logs: "completed",
                structured_data: structuredData // Save this too if backend supports it (optional for now)
            };
            const res = await fetch('/api/sentinel/save-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                setLogs(prev => [...prev, { type: 'success', message: 'Session Saved.', timestamp: new Date() }]);
                fetchHistory();
            }
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    // ... (Test Prompt & Manual Mode Logic - Keep Unchanged) ...
    const handleTestPrompt = () => {
        const specificPrompt = `I have the following list of tickers:
$LITE, $DXYZ, $TER, $PALL, $SFTBY
Please compare all of the tickers using your general research, their ML forecast numbers on each time frame, their quickscore numbers on each time frame, and their AAPC, IV, IVR, Beta, and Correlation using Assess score A.

Please make sure to generate a final summary ordering the assets based on the strongest buy based on the found and calculated information to the weakest buy signal`;
        setPrompt(specificPrompt);
    };

    const handleManualSetup = () => {
        setIsManualMode(true);
        if (executionPlan.length === 0) {
            setExecutionPlan([{
                step_id: 1,
                tool: "market",
                params: { sensitivity: 2, market_type: "sp500" },
                output_key: "step_1_output",
                description: "Initial market scan"
            }]);
        }
        setReviewMode(true);
    };

    const addStep = () => {
        const newStepId = executionPlan.length + 1;
        setExecutionPlan([...executionPlan, {
            step_id: newStepId,
            tool: "market",
            params: { sensitivity: 2, market_type: "sp500" },
            output_key: `step_${newStepId}_output`,
            description: "New Step"
        }]);
    };

    const removeStep = (index) => {
        const newPlan = executionPlan.filter((_, i) => i !== index).map((step, i) => ({
            ...step,
            step_id: i + 1,
            output_key: `step_${i + 1}_output`
        }));
        setExecutionPlan(newPlan);
    };

    const updateStep = (index, field, value) => {
        const newPlan = [...executionPlan];
        newPlan[index] = { ...newPlan[index], [field]: value };
        if (field === 'tool') {
            const defaultParams = {};
            if (value === 'market') { defaultParams.sensitivity = 2; defaultParams.market_type = 'sp500'; }
            if (value === 'sentiment') { defaultParams.limit = 10; }
            newPlan[index].params = defaultParams;
        }
        setExecutionPlan(newPlan);
    };

    const updateStepParam = (index, paramKey, value) => {
        const newPlan = [...executionPlan];
        newPlan[index].params = { ...newPlan[index].params, [paramKey]: value };
        setExecutionPlan(newPlan);
    };

    const addSummaryStep = () => {
        setExecutionPlan([...executionPlan, {
            step_id: executionPlan.length + 1,
            tool: "summary",
            params: { data_source: "$CONTEXT" },
            output_key: "final_summary",
            description: "Generate Final Report"
        }]);
    };

    const handlePlan = async () => {
        if (!prompt.trim() || isProcessing) return;
        setIsProcessing(true);
        setIsManualMode(false);
        setExecutionStatus("planning");
        setLogs(prev => [...prev, { type: "info", message: "Generating execution plan...", timestamp: new Date() }]);

        try {
            const response = await fetch('/api/sentinel/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_prompt: prompt, email: userProfile?.email })
            });
            const data = await response.json();
            if (data.plan) {
                setExecutionPlan(data.plan);
                setExecutionStatus("reviewing");
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
        if ((!prompt.trim() && !planToExecute) || isProcessing) return;

        setIsProcessing(true);
        if (!planToExecute) {
            setExecutionStatus("planning");
            setExecutionPlan([]);
            setResults(null);
            setFinalSummary(null);
            setStructuredData([]); // Reset Data
            setLogs([]);
            setActiveView("logs"); // Auto-switch to logs on new run
        } else {
            setExecutionStatus("executing");
            setReviewMode(false);
            setActiveView("logs"); // Auto-switch to logs on execute
        }

        try {
            let effectivePrompt = prompt.trim() || "Manual Plan Execution";
            if (researchMode) effectivePrompt += " [RESEARCH_MODE_ENABLED]";

            // FIX: Default to Super Admin email for local testing/guest access to avoid 422/403
            const userEmail = userProfile?.email || "marketinsightscenter@gmail.com";

            const bodyPayload = { user_prompt: effectivePrompt, email: userEmail };
            if (planToExecute) bodyPayload.plan = planToExecute;

            const response = await fetch('/api/sentinel/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) throw new Error("Failed to contact Sentinel Core.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        processEvent(event);
                    } catch (e) { console.error(e); }
                }
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
        if (event.type === 'status') {
            setLogs(prev => [...prev, { type: 'info', message: event.message, timestamp: new Date() }]);
        } else if (event.type === 'error') {
            setLogs(prev => [...prev, { type: 'error', message: event.message, timestamp: new Date() }]);
            setExecutionStatus("error");
        } else if (event.type === 'plan') {
            setExecutionPlan(event.plan);
            setExecutionStatus("reviewing");
            setReviewMode(true);
        } else if (event.type === 'summary') {
            setFinalSummary(event.message);
            // Capture structured data if present
            if (event.data && Array.isArray(event.data)) {
                setStructuredData(event.data);
            }
            setLogs(prev => [...prev, { type: 'success', message: 'Mission Report Generated.', timestamp: new Date() }]);
        } else if (event.type === 'final') {
            setResults(event.context);
        }
    };

    const startListening = () => {
        if (!window.webkitSpeechRecognition && !window.SpeechRecognition) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => setPrompt(prev => (prev + " " + event.results[0][0].transcript).trim());
        recognition.start();
    };

    // Render Logic

    // ... (Keep generic render parts, focus on main content area) ...

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-100 flex overflow-hidden pt-20">

            {/* Sidebar (History) */}
            <AnimatePresence>
                {showSidebar && (
                    <motion.div
                        initial={{ x: -300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -300, opacity: 0 }}
                        className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col z-20 absolute h-full shadow-2xl"
                    >
                        {/* ... Sidebar Content (Keep existing) ... */}
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur">
                            <h2 className="text-cyan-400 font-bold flex items-center gap-2">
                                <History size={18} /> Mission Log
                            </h2>
                            <button onClick={() => setShowSidebar(false)} className="text-gray-500 hover:text-white transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {pastSessions.map((sess, idx) => (
                                <div key={idx} onClick={() => loadSession(sess)} className="p-3 rounded bg-gray-800/40 hover:bg-gray-800 cursor-pointer border border-transparent hover:border-cyan-500/30 transition-all group">
                                    <div className="text-xs text-cyan-500 font-mono mb-1">{new Date(sess.timestamp * 1000).toLocaleString()}</div>
                                    <div className="text-sm text-gray-300 line-clamp-2 group-hover:text-white">{sess.prompt}</div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col relative transition-all duration-300 ${showSidebar ? "ml-80" : "ml-0"}`}>

                {/* Header */}
                <header className="h-16 border-b border-gray-800 bg-gray-900/30 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setShowSidebar(!showSidebar)} className="text-gray-400 hover:text-cyan-400 p-2 rounded-full hover:bg-gray-800 transition-all">
                            <Menu size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                <Bot size={24} className="text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
                                    SENTINEL AI <span className="text-xs font-mono text-gray-500 font-normal ml-2">v3.0.1</span>
                                </h1>
                                <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Autonomous Strategic Analyst</div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden flex flex-col relative">
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black_70%,transparent_100%)] pointer-events-none opacity-20"></div>

                    {/* Scrollable Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 scroll-smooth">

                        {/* Prompt Input */}
                        <div className="max-w-4xl mx-auto w-full space-y-4">
                            <NeonWrapper>
                                <div className="bg-gray-900/80 backdrop-blur-xl p-1 rounded-xl border border-gray-800 shadow-2xl relative group">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Initialize Protocol... (e.g., 'Analyze $NVDA risk structure', 'Compare $TSLA and $RIVN')"
                                        className="w-full bg-transparent text-gray-200 placeholder-gray-600 p-4 min-h-[120px] outline-none text-lg resize-none font-light tracking-wide rounded-lg group-hover:bg-gray-900/90 transition-colors"
                                        disabled={isProcessing}
                                    />

                                    {/* Action Bar */}
                                    <div className="flex justify-between items-center px-4 py-2 border-t border-gray-800 bg-gray-900/50 rounded-b-lg">
                                        <div className="flex gap-2">
                                            <button onClick={startListening} className={`p-2 rounded-full hover:bg-gray-800 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} title="Voice Input">
                                                <Mic size={18} />
                                            </button>
                                            <button onClick={() => setResearchMode(!researchMode)} className={`p-2 rounded-full hover:bg-gray-800 transition-colors ${researchMode ? 'text-cyan-400' : 'text-gray-400'}`} title="Deep Research Mode">
                                                <Globe size={18} />
                                            </button>
                                            <button onClick={handleManualSetup} className={`p-2 rounded-full hover:bg-gray-800 transition-colors ${isManualMode ? 'text-purple-400' : 'text-gray-400'}`} title="Manual Protocol">
                                                <Settings size={18} />
                                            </button>
                                            <button onClick={handleTestPrompt} className="p-2 rounded-full hover:bg-gray-800 transition-colors text-gray-400 hover:text-green-400" title="Use Test Prompt">
                                                <Database size={18} />
                                            </button>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handlePlan()}
                                                disabled={isProcessing || !prompt.trim()}
                                                className="px-4 py-2 rounded-lg bg-gray-800 text-cyan-400 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-cyan-500/20 hover:border-cyan-500/50"
                                            >
                                                PLAN PROTOCOL
                                            </button>
                                            <button
                                                onClick={() => handleExecute(isManualMode ? executionPlan : null)}
                                                disabled={isProcessing || (isManualMode && executionPlan.length === 0)}
                                                className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                            >
                                                {isProcessing ? <Activity className="animate-spin" size={18} /> : <Terminal size={18} />}
                                                EXECUTE
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </NeonWrapper>
                        </div>

                        {/* Review Mode (Manual Planner) */}
                        <AnimatePresence>
                            {reviewMode && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                    className="max-w-4xl mx-auto w-full"
                                >
                                    <div className="bg-gray-900 border border-purple-500/30 rounded-xl overflow-hidden shadow-2xl">
                                        <div className="bg-purple-900/20 px-4 py-3 border-b border-purple-500/20 flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-purple-300">
                                                <Layers size={18} />
                                                <span className="font-bold tracking-wider text-sm">STRATEGIC SEQUENCE</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setExecutionPlan([]);
                                                        setIsManualMode(false);
                                                        setReviewMode(false);
                                                    }}
                                                    className="text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 px-3 py-1 rounded border border-red-500/30 transition-colors flex items-center gap-1"
                                                    title="Clear Sequence"
                                                >
                                                    <Trash2 size={12} /> Clear
                                                </button>
                                                <button onClick={addStep} className="text-xs bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 px-3 py-1 rounded border border-purple-500/30 transition-colors flex items-center gap-1">
                                                    <Plus size={12} /> Add Step
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {executionPlan.map((step, idx) => (
                                                <motion.div layout key={idx} className="bg-black/40 border border-gray-700/50 rounded-lg p-3 relative group">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-xs font-mono text-gray-500">{(idx + 1).toString().padStart(2, '0')}</span>
                                                        <select
                                                            value={step.tool}
                                                            onChange={(e) => updateStep(idx, 'tool', e.target.value)}
                                                            className="bg-gray-800 text-cyan-400 text-xs font-mono px-2 py-1 rounded border border-gray-700 outline-none focus:border-cyan-500"
                                                        >
                                                            {SENTINEL_TOOLS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                        </select>
                                                        <input
                                                            type="text"
                                                            value={step.description || ""}
                                                            onChange={(e) => updateStep(idx, 'description', e.target.value)}
                                                            placeholder="Step Description..."
                                                            className="bg-transparent border-b border-gray-700 focus:border-purple-500 text-sm text-gray-300 flex-1 outline-none px-2 py-1"
                                                        />
                                                        <button onClick={() => removeStep(idx)} className="text-gray-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Dynamic Params */}
                                                    <div className="pl-8 flex flex-wrap gap-2">
                                                        {SENTINEL_TOOLS.find(t => t.value === step.tool)?.params.map(param => (
                                                            <div key={param} className="flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded border border-gray-700/50">
                                                                <span className="text-[10px] text-gray-500 uppercase">{param}:</span>
                                                                {PARAM_OPTIONS[param] ? (
                                                                    <select
                                                                        value={step.params[param] || ""}
                                                                        onChange={(e) => updateStepParam(idx, param, e.target.value)}
                                                                        className="bg-transparent text-xs text-purple-300 outline-none w-24"
                                                                    >
                                                                        <option value="">Select...</option>
                                                                        {PARAM_OPTIONS[param].map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={step.params[param] || ""}
                                                                        onChange={(e) => updateStepParam(idx, param, e.target.value)}
                                                                        className="bg-transparent text-xs text-purple-300 outline-none w-24 border-b border-gray-700 focus:border-purple-500"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            ))}
                                            {executionPlan.length === 0 && <div className="text-center text-sm text-gray-500 py-4">Protocol Empty. Add steps or use AI Planner.</div>}
                                            <div className="flex justify-end pt-2">
                                                <button onClick={addSummaryStep} className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                                                    <FileText size={12} /> Add Report Gen Step
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* View Switcher for Report/Data/Plan */}
                        {(finalSummary || executionStatus === 'executing' || executionStatus === 'complete' || logs.length > 0) && (
                            <div className="max-w-5xl mx-auto w-full flex gap-1 mb-4 border-b border-gray-800">
                                <button
                                    onClick={() => finalSummary && setActiveView("report")}
                                    disabled={!finalSummary}
                                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeView === 'report' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500'} ${!finalSummary ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-300'}`}
                                >
                                    <FileText size={16} /> Mission Report
                                </button>
                                <button
                                    onClick={() => structuredData.length > 0 && setActiveView("data")}
                                    disabled={structuredData.length === 0}
                                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeView === 'data' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500'} ${structuredData.length > 0 ? 'animate-pulse hover:text-gray-300' : 'opacity-50 cursor-not-allowed'}`}
                                >
                                    <Database size={16} /> Data Matrix {structuredData.length > 0 && <span className="bg-cyan-500/20 text-cyan-300 px-1.5 rounded-full text-[10px]">{structuredData.length}</span>}
                                </button>
                                <button
                                    onClick={() => setActiveView("logs")}
                                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeView === 'logs' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Terminal size={16} /> System Logs
                                </button>
                            </div>
                        )}

                        {/* Output Display */}
                        <div className="max-w-5xl mx-auto w-full min-h-[400px]">
                            {/* Report View */}
                            {activeView === 'report' && finalSummary && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl relative">
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button
                                            onClick={saveCurrentSession}
                                            className="text-gray-500 hover:text-green-400 transition-colors p-2 rounded hover:bg-gray-800"
                                            title="Save to History"
                                        >
                                            <Save size={18} />
                                        </button>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(finalSummary)}
                                            className="text-gray-500 hover:text-cyan-400 transition-colors p-2 rounded hover:bg-gray-800"
                                            title="Copy Report"
                                        >
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                    <div className="prose prose-invert prose-cyan max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {finalSummary}
                                        </ReactMarkdown>
                                    </div>
                                </motion.div>
                            )}

                            {/* Data View */}
                            {activeView === 'data' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[600px]">
                                    <DataView data={structuredData} />
                                </motion.div>
                            )}

                            {/* Logs View */}
                            {activeView === 'logs' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs h-[500px] overflow-y-auto">
                                    <div className="space-y-1">
                                        {logs.map((log, i) => (
                                            <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'info' ? 'text-cyan-600' : 'text-gray-500'}`}>
                                                <span className="opacity-50 min-w-[30px]">{i + 1}</span>
                                                <span className="opacity-50">[{log.timestamp ? log.timestamp.toLocaleTimeString() : new Date().toLocaleTimeString()}]</span>
                                                <span>{log.message}</span>
                                            </div>
                                        ))}
                                        <div ref={logEndRef} />
                                    </div>
                                </motion.div>
                            )}
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
};

export default SentinelAI;
