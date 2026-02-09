import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Terminal, Send, Cpu, Activity, AlertTriangle, Check, X, Play, RotateCcw, Save, Trash2, Copy,
    ChevronDown, Layers, Clock, Mic, Volume2, VolumeX, Globe, Search, Menu, History, MessageSquare, ChevronLeft, ChevronRight, Zap, Plus, Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NeonWrapper from '../components/NeonWrapper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Tool Definitions for Manual Planner ---
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
    const [lastReport, setLastReport] = useState(null);

    // UI State
    const [reviewMode, setReviewMode] = useState(false); // Used for both Review and Manual Edit
    const [isManualMode, setIsManualMode] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [researchMode, setResearchMode] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [pastSessions, setPastSessions] = useState([]);

    const logEndRef = useRef(null);

    // Initial Load & History Fetch
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
        setLogs([{ type: 'info', message: 'Loaded past session.', timestamp: new Date(session.timestamp * 1000) }]);
        setShowSidebar(false);
    };

    const saveCurrentSession = async () => {
        if (!finalSummary) return;
        try {
            const payload = {
                user_prompt: prompt,
                email: userProfile.email,
                plan: executionPlan,
                summary: finalSummary,
                logs: "completed"
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

    const handleTestPrompt = () => {
        const specificPrompt = `I have the following list of tickers:
LITE, DXYZ, TER, PALL, SFTBY
Please compare all of the tickers using your general research, their ML forecast numbers on each time frame, their quickscore numbers on each time frame, and their AAPC, IV, IVR, Beta, and Correlation using Assess score A.

Please make sure to generate a final summary ordering the assets based on the strongest buy based on the found and calculated information to the weakest buy signal`;
        setPrompt(specificPrompt);
    };

    // --- Manual Planner Logic ---

    const handleManualSetup = () => {
        setIsManualMode(true);
        // Initialize with one empty market step if plan is empty
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
        // Reset params if tool changes
        if (field === 'tool') {
            const defaultParams = {};
            // Set some defaults
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

    // --- AI Plan & Execute Logic ---

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
            setLogs([]);
        } else {
            setExecutionStatus("executing");
            setReviewMode(false);
        }

        try {
            let effectivePrompt = prompt.trim() || "Manual Plan Execution";
            if (researchMode) effectivePrompt += " [RESEARCH_MODE_ENABLED]";

            const bodyPayload = { user_prompt: effectivePrompt, email: userProfile?.email };
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

    const speak = (text) => {
        if (!text || isMuted) return; // Mute Check
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Microsoft Zira') || v.name.includes('Google US English'));
        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
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
            setFinalSummary(event.message);
            setLastReport(event.message);
            setLogs(prev => [...prev, { type: "success", message: "Mission Report Generated.", timestamp: new Date() }]);
            speak("Mission accomplished.");
        } else if (event.type === "error") {
            setLogs(prev => [...prev, { type: "error", message: event.message, timestamp: new Date() }]);
            setExecutionStatus("error");
            speak("Error encountered.");
        }
    };

    const copyReport = () => {
        if (!finalSummary) return;
        navigator.clipboard.writeText(finalSummary);
        setLogs(prev => [...prev, { type: 'success', message: 'Mission Report copied to clipboard.', timestamp: new Date() }]);
    };

    // Custom CSS for the flowing gradient
    const gradientStyle = `
        @keyframes flow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .flowing-gradient {
            background: linear-gradient(-45deg, #0f172a, #111827, #1e1b4b, #0f172a);
            background-size: 400% 400%;
            animation: flow 20s ease infinite;
        }
    `;

    return (
        <div className="flex h-screen bg-black text-white pt-20 overflow-hidden font-mono relative selection:bg-cyan-500/30">
            <style>{gradientStyle}</style>

            {/* Animated Flowing Gradient Background */}
            <div className="absolute inset-0 z-0 pointer-events-none flowing-gradient opacity-80"></div>

            {/* Subtle Overlay to ensure text readability */}
            <div className="absolute inset-0 z-0 pointer-events-none bg-black/20"></div>

            {/* Sidebar (History) */}
            <motion.div
                initial={false}
                animate={{ width: showSidebar ? 300 : 0, opacity: showSidebar ? 1 : 0 }}
                className="bg-gray-950/90 backdrop-blur border-r border-gray-800 flex flex-col overflow-hidden relative z-10"
            >
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-cyan-400 font-bold flex items-center gap-2">
                        <History size={16} /> HISTORY
                    </span>
                    <button onClick={() => setShowSidebar(false)}><X size={16} className="text-gray-500 hover:text-white" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {pastSessions.map(session => (
                        <div key={session.id} onClick={() => loadSession(session)}
                            className="p-3 bg-black/50 hover:bg-black border border-gray-800 rounded cursor-pointer transition-colors group">
                            <div className="text-xs text-gray-500 mb-1">{new Date(session.timestamp * 1000).toLocaleString()}</div>
                            <div className="text-sm text-gray-300 truncate group-hover:text-cyan-400">{session.prompt}</div>
                        </div>
                    ))}
                    {pastSessions.length === 0 && <div className="text-center text-gray-600 p-4 text-xs">No saved missions.</div>}
                </div>
            </motion.div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative z-20">
                {!showSidebar && (
                    <button
                        onClick={() => setShowSidebar(true)}
                        className="absolute top-4 left-4 z-20 p-2 bg-gray-900/80 rounded hover:bg-gray-800 text-gray-400 border border-gray-700"
                    >
                        <ChevronRight size={18} />
                    </button>
                )}

                <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-6 gap-4 h-full">

                    {/* LOGS */}
                    <div className="flex-1 min-h-0 bg-black/80 backdrop-blur border border-gray-800 rounded-xl p-4 overflow-y-auto shadow-inner custom-scrollbar relative font-mono">
                        <div className="sticky top-0 bg-transparent pb-2 border-b border-gray-800 mb-2 flex items-center justify-between z-10">
                            <span className="text-gray-500 flex items-center gap-2 text-xs font-bold tracking-wider">
                                <Terminal size={12} /> SENTINEL CORE LOG
                            </span>
                            {executionStatus === 'executing' && <span className="text-cyan-500 animate-pulse text-xs">● LIVE LINK ACTIVE</span>}
                        </div>
                        <div className="space-y-1 font-mono text-xs">
                            {logs.length === 0 && <div className="text-gray-600 h-full flex items-center justify-center italic">System Idle. Awaiting Protocol.</div>}
                            {logs.map((log, i) => (
                                <div key={i} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                                    <span className="text-gray-700 shrink-0">[{log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour12: false }) : '00:00:00'}]</span>
                                    <span>{log.message}</span>
                                    {log.result && <div className="ml-14 text-gray-600 truncate opacity-50">{typeof log.result === 'string' ? log.result.substring(0, 50) : 'Data Object'}...</div>}
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </div>

                    {/* INPUT */}
                    <div className="flex-none h-40 relative group">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isProcessing}
                            placeholder="Initialize Sentinel Protocol... (e.g. 'Scan S&P 500 for breakouts...')"
                            className="w-full h-full bg-gray-900/60 backdrop-blur border border-gray-700 rounded-xl p-4 text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 outline-none transition-all resize-none font-mono text-sm placeholder-gray-600 shadow-xl"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleExecute();
                                }
                            }}
                        />
                        <div className="absolute bottom-4 right-4 flex items-center gap-2">
                            <button onClick={handleTestPrompt} title="Use Test Prompt" className="p-2 rounded-full bg-gray-800/80 text-gray-500 hover:text-cyan-400 hover:bg-gray-700 transition-all font-xs border border-gray-600/30">
                                <Zap size={14} />
                            </button>
                            <button onClick={() => setIsMuted(!isMuted)} title={isMuted ? "Unmute TTS" : "Mute TTS"} className={`p-2 rounded-full transition-all ${isMuted ? 'bg-red-900/50 text-red-400' : 'bg-gray-800/80 text-gray-500 hover:text-cyan-400'}`}>
                                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                            <button onClick={startListening} title="Voice Input" className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500 animate-pulse text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-800/80 text-gray-500 hover:text-cyan-400 hover:bg-gray-700'}`}>
                                <Mic size={18} />
                            </button>
                        </div>
                    </div>

                    {/* CONTROLS */}
                    <div className="flex-none h-16 bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-2 flex items-center justify-between px-6 shadow-lg">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setResearchMode(!researchMode)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${researchMode ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-transparent text-gray-600 border-gray-700 hover:border-gray-500'}`}
                            >
                                <Globe size={14} /> {researchMode ? 'NET LINK: ON' : 'NET LINK: OFF'}
                            </button>
                            <button
                                onClick={() => setFinalSummary(lastReport)}
                                disabled={!lastReport}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border 
                                ${lastReport
                                        ? 'bg-cyan-900/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] animate-pulse hover:bg-cyan-900/40'
                                        : 'border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 opacity-50 cursor-not-allowed'}`}
                            >
                                <MessageSquare size={14} /> REPORT
                            </button>
                            <button
                                onClick={copyReport}
                                disabled={!finalSummary}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border 
                                ${finalSummary
                                        ? 'border-cyan-400 text-cyan-400 hover:bg-cyan-900/40 cursor-pointer'
                                        : 'border-gray-700 text-gray-500 hover:border-gray-500 opacity-50 cursor-not-allowed'}`}
                                title="Copy Report"
                            >
                                <Copy size={14} />
                            </button>
                            <button
                                onClick={saveCurrentSession}
                                disabled={!lastReport}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Save size={14} /> SAVE MISSION
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <NeonWrapper color="purple">
                                <button onClick={handleManualSetup} disabled={isProcessing} className="px-4 py-2 bg-transparent border border-gray-500/30 rounded flex items-center gap-2 font-bold text-gray-400 hover:bg-gray-500/10 hover:text-gray-200 text-xs transition-all disabled:opacity-50">
                                    <Layers size={14} /> MANUAL
                                </button>
                            </NeonWrapper>

                            <NeonWrapper color="purple">
                                <button onClick={handlePlan} disabled={isProcessing || !prompt.trim()} className="px-6 py-2 bg-transparent border border-purple-500/30 rounded flex items-center gap-2 font-bold text-purple-400 hover:bg-purple-500/10 text-xs transition-all disabled:opacity-50">
                                    <Bot size={14} /> PLAN
                                </button>
                            </NeonWrapper>
                            <NeonWrapper color="cyan">
                                <button onClick={() => handleExecute(null)} disabled={isProcessing || (!prompt.trim() && executionPlan.length === 0)} className="px-8 py-2 bg-cyan-900/20 border border-cyan-500/50 rounded flex items-center gap-2 font-bold text-cyan-400 hover:bg-cyan-500/20 text-xs transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                                    {isProcessing ? <Activity size={14} className="animate-spin" /> : <Send size={14} />}
                                    {isProcessing ? "EXECUTING..." : "EXECUTE"}
                                </button>
                            </NeonWrapper>
                        </div>
                    </div>
                </div>

                {/* MODAL: Manual Planner / Review */}
                <AnimatePresence>
                    {reviewMode && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-gray-900 border border-purple-500/50 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
                            >
                                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-purple-900/20">
                                    <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                                        <Layers size={18} /> {isManualMode ? 'MANUAL EXECUTION BUILDER' : 'CONFIRM EXECUTION PROTOCOL'}
                                    </h3>
                                    <button onClick={() => setReviewMode(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-4">
                                    {executionPlan.map((step, idx) => (
                                        <div key={idx} className="bg-black/40 border border-purple-500/30 rounded-lg p-4 relative group">
                                            {/* HEADER: Step ID + Tool Selector */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="bg-purple-900/50 text-purple-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{step.step_id}</div>

                                                {isManualMode ? (
                                                    <select
                                                        value={step.tool}
                                                        onChange={(e) => updateStep(idx, 'tool', e.target.value)}
                                                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-cyan-400 font-bold text-sm outline-none focus:border-cyan-500"
                                                    >
                                                        {SENTINEL_TOOLS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="font-bold text-cyan-400 text-sm">{step.tool.toUpperCase()}</span>
                                                )}

                                                {isManualMode && (
                                                    <button onClick={() => removeStep(idx)} className="ml-auto text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
                                                )}
                                            </div>

                                            {/* BODY: Description + Params */}
                                            <div className="space-y-3">
                                                {/* Description Input */}
                                                <div>
                                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Description</label>
                                                    {isManualMode ? (
                                                        <input
                                                            type="text"
                                                            value={step.description}
                                                            onChange={(e) => updateStep(idx, 'description', e.target.value)}
                                                            className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 outline-none focus:border-purple-500"
                                                        />
                                                    ) : (
                                                        <div className="text-gray-400 text-xs">{step.description}</div>
                                                    )}
                                                </div>

                                                {/* Dynamic Params */}
                                                {isManualMode && SENTINEL_TOOLS.find(t => t.value === step.tool)?.params.length > 0 && (
                                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800/50">
                                                        {SENTINEL_TOOLS.find(t => t.value === step.tool).params.map(param => (
                                                            <div key={param}>
                                                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">{param.replace('_', ' ')}</label>
                                                                {PARAM_OPTIONS[param] ? (
                                                                    <select
                                                                        value={step.params[param] || ""}
                                                                        onChange={(e) => updateStepParam(idx, param, e.target.value)}
                                                                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-cyan-500"
                                                                    >
                                                                        {PARAM_OPTIONS[param].map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={step.params[param] || ""}
                                                                        onChange={(e) => updateStepParam(idx, param, e.target.value)}
                                                                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-cyan-500"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Read-Only Params for Review Mode */}
                                                {!isManualMode && Object.keys(step.params || {}).length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {Object.entries(step.params).map(([k, v]) => (
                                                            <span key={k} className="px-2 py-1 bg-gray-800 rounded text-[10px] text-gray-400 font-mono">{k}: <span className="text-gray-200">{v}</span></span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* FOOTER: Add Step / Summary / Buttons */}
                                <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex flex-col gap-3">
                                    {isManualMode && (
                                        <div className="flex gap-2">
                                            <button onClick={addStep} className="flex-1 py-2 border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/50 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all">
                                                <Plus size={14} /> ADD STEP
                                            </button>
                                            <button onClick={addSummaryStep} className="flex-1 py-2 border border-dashed border-gray-700 text-gray-500 hover:text-purple-400 hover:border-purple-500/50 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all">
                                                <Layers size={14} /> + SUMMARY
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 mt-2">
                                        <button onClick={() => setReviewMode(false)} className="px-4 py-2 rounded text-gray-400 hover:text-white text-sm font-bold">Cancel</button>
                                        <button
                                            onClick={() => handleExecute(executionPlan)}
                                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 rounded text-white font-bold text-sm hover:opacity-90 shadow-lg"
                                        >
                                            Confirm & Execute
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Overlay: Mission Report */}
                <AnimatePresence>
                    {finalSummary && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="absolute bottom-24 left-6 right-6 mx-auto max-w-5xl bg-black/95 backdrop-blur-xl border border-gold/50 rounded-xl shadow-[0_0_50px_rgba(234,179,8,0.2)] max-h-[70vh] flex flex-col overflow-hidden z-30"
                        >
                            <div className="p-4 border-b border-gold/20 flex justify-between items-center bg-gold/5">
                                <h3 className="text-gold font-bold flex items-center gap-2 font-mono tracking-widest">
                                    <Cpu size={16} /> MISSION REPORT
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={() => speak(finalSummary)} className="p-1.5 text-gold hover:bg-gold/10 rounded"><Volume2 size={16} /></button>
                                    <button onClick={() => navigator.clipboard.writeText(finalSummary)} className="p-1.5 text-gold hover:bg-gold/10 rounded"><Layers size={16} /></button>
                                    <button onClick={() => setFinalSummary(null)} className="p-1.5 text-gray-500 hover:text-white rounded"><X size={16} /></button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto font-sans text-sm leading-relaxed text-gray-300 space-y-4 custom-scrollbar-gold">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        // TABLE STYLING: Improved for wide data (Beta, Corr, Multi-ML)
                                        table: ({ node, ...props }) => (
                                            <div className="my-6 overflow-x-auto rounded-xl border border-gold/30 shadow-[0_0_15px_rgba(234,179,8,0.1)] bg-black/40 backdrop-blur-md">
                                                <table {...props} className="w-full border-collapse text-left min-w-[900px]" />
                                            </div>
                                        ),
                                        thead: ({ node, ...props }) => (
                                            <thead {...props} className="bg-gold/10 text-gold uppercase tracking-wider text-xs font-bold" />
                                        ),
                                        tbody: ({ node, ...props }) => (
                                            <tbody {...props} className="divide-y divide-gray-800/50" />
                                        ),
                                        tr: ({ node, ...props }) => (
                                            <tr {...props} className="hover:bg-gold/5 transition-colors duration-200" />
                                        ),
                                        th: ({ node, ...props }) => (
                                            <th {...props} className="px-6 py-4 border-b border-gold/20 whitespace-nowrap sticky left-0 bg-black/20 backdrop-blur-sm z-10" />
                                        ),
                                        td: ({ node, ...props }) => (
                                            <td {...props} className="px-6 py-4 text-gray-300 border-b border-gray-800/30 whitespace-nowrap" />
                                        ),
                                        // Text Styles
                                        h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold text-white mt-8 mb-4 border-b border-gray-800 pb-2 flex items-center gap-2"><Globe size={24} className="text-gold" /> {props.children}</h1>,
                                        h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-bold text-gold mt-6 mb-3 flex items-center gap-2"><Activity size={18} /> {props.children}</h2>,
                                        h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-bold text-cyan-400 mt-4 mb-2">{props.children}</h3>,
                                        p: ({ node, ...props }) => <p {...props} className="mb-4 text-gray-300" />,
                                        strong: ({ node, ...props }) => <strong {...props} className="text-cyan-300" />,
                                        ul: ({ node, ...props }) => <ul {...props} className="space-y-2 my-4 list-none pl-4" />,
                                        li: ({ node, ...props }) => <li {...props} className="flex gap-2 items-start"><span className="text-gold mt-1.5 text-[8px]">●</span> <span>{props.children}</span></li>,
                                        code: ({ node, inline, ...props }) => inline
                                            ? <code {...props} className="bg-gray-800 text-cyan-300 px-1 py-0.5 rounded text-xs font-mono" />
                                            : <pre className="bg-gray-950 p-4 rounded-lg overflow-x-auto border border-gray-800 my-4 shadow-inner"><code {...props} className="text-gray-300 text-xs font-mono" /></pre>
                                    }}
                                >
                                    {finalSummary}
                                </ReactMarkdown>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

export default SentinelAI;