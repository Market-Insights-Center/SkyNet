import React, { useState, useRef, useEffect } from 'react';
import { Send, Command, ChevronUp, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const SUGGESTIONS = [
    { type: 'cmd', label: '/backtest', desc: 'Run historical simulation' },
    { type: 'cmd', label: '/optimize', desc: 'Find best parameters' },
    { type: 'cmd', label: '/scan', desc: 'Market wide scan' },
    { type: 'ticker', label: '$SPY', desc: 'S&P 500 ETF' },
    { type: 'ticker', label: '$NVDA', desc: 'NVIDIA Corp' },
    { type: 'nlp', label: 'Find tech stocks breaking out', desc: 'Natural Language' },
];

const LogicBrickDrawer = ({ isOpen, onClose, onAddBrick }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute bottom-0 left-0 right-0 bg-[#0c0c16] border-t border-cyan-500/30 h-64 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex flex-col"
                >
                    <div className="h-8 bg-cyan-900/20 border-b border-cyan-500/10 flex items-center justify-between px-4">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Logic Bricks</span>
                        <button onClick={onClose} className="text-cyan-400 hover:text-white px-2">▼</button>
                    </div>
                    <div className="flex-1 p-4 grid grid-cols-3 gap-2 overflow-y-auto">
                        {['Strategy: MACD', 'Strategy: RSI', 'Universe: SPY', 'Universe: QQQ', 'Condition: Bear', 'Condition: Bull'].map((brick, i) => (
                            <button
                                key={i}
                                onClick={() => onAddBrick(brick)}
                                className="h-10 bg-cyan-500/10 border border-cyan-500/20 rounded flex items-center justify-center text-xs text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all font-mono"
                            >
                                {brick}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const SentimentCard = ({ data }) => {
    const [hidden, setHidden] = useState(false);
    return (
        <div className="mt-3 w-[90%] bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col gap-2 relative group transition-all duration-300 hover:border-cyan-500/30">
            <button onClick={() => setHidden(!hidden)} className="absolute top-2 right-2 text-[10px] font-bold bg-black/80 px-2 rounded border border-white/10 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20">
                {hidden ? 'EXPAND' : 'HIDE'}
            </button>
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs text-gray-400 font-mono">{data.ticker} SENTIMENT</span>
                <span className={`text-xs font-bold ${data.verdict === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>{data.verdict}</span>
            </div>
            {!hidden && (
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="text-2xl font-bold text-white">{data.score.toFixed(3)}</div>
                    <div className="text-[10px] text-gray-500 leading-tight flex-1">{data.details}</div>
                </div>
            )}
        </div>
    );
};

const QuickscoreCard = ({ data }) => {
    const [hidden, setHidden] = useState(false);
    return (
        <div className="mt-3 w-[95%] bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col gap-2 overflow-hidden relative group hover:border-cyan-500/30">
            <button onClick={() => setHidden(!hidden)} className="absolute top-2 right-2 text-[10px] font-bold bg-black/80 px-2 rounded border border-white/10 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20">
                {hidden ? 'EXPAND' : 'HIDE'}
            </button>
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs text-gray-400 font-mono">QUICKSCORE ANALYSIS</span>
                <span className="text-xs text-cyan-400 font-mono">{data.ticker}</span>
            </div>
            {!hidden && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-3 gap-2 text-center py-2">
                        {Object.entries(data.scores || {}).map(([k, item]) => {
                            // Handle backward compatibility or new object
                            const label = item.label || (k === '1' ? 'Weekly' : k === '2' ? 'Daily' : 'Hourly');
                            const val = item.score || item;
                            return (
                                <div key={k} className="bg-white/5 rounded p-1">
                                    <div className="text-[9px] text-gray-500 uppercase">{label}</div>
                                    <div className="text-sm font-bold text-white">{val}</div>
                                </div>
                            );
                        })}
                    </div>
                    {data.graphs && data.graphs[1] && (
                        <div className="relative w-full h-32 rounded bg-black/50 overflow-hidden">
                            <img src={data.graphs[1].split(': ')[1]} alt="Graph" className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const SingularityStream = ({ mode, onStatusChange, onAddModule, resetSignal }) => {
    const [input, setInput] = useState('');
    const [histories, setHistories] = useState(() => {
        const saved = localStorage.getItem('singularity_histories');
        try { return saved ? JSON.parse(saved) : { ANALYST: [], GOVERNOR: [] }; } catch { return { ANALYST: [], GOVERNOR: [] }; }
    });

    // Reset Listener
    useEffect(() => {
        if (resetSignal) {
            setHistories({ ANALYST: [], GOVERNOR: [] });
            localStorage.removeItem('singularity_histories');
        }
    }, [resetSignal]);

    useEffect(() => {
        localStorage.setItem('singularity_histories', JSON.stringify(histories));
    }, [histories]);

    const history = histories[mode] || [];

    const updateHistory = (updater) => {
        setHistories(prev => {
            const currentHistory = prev[mode] || [];
            const newHistory = typeof updater === 'function' ? updater(currentHistory) : updater;
            return {
                ...prev,
                [mode]: newHistory
            };
        });
    };

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const scrollRef = useRef(null);

    // Filter suggestions
    const filteredSuggestions = input
        ? SUGGESTIONS.filter(s => s.label.toLowerCase().includes(input.toLowerCase()))
        : [];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const { currentUser } = useAuth(); // Needed for API

    const themeColor = mode === 'ANALYST' ? 'cyan' : 'amber';
    const borderColor = mode === 'ANALYST' ? 'border-cyan-500/30' : 'border-amber-500/30';
    const textColor = mode === 'ANALYST' ? 'text-cyan-400' : 'text-amber-400';

    const QUICK_PROMPTS = mode === 'ANALYST'
        ? ['Analyze Tech Sector', 'Find Breakout Stocks', 'Sentiment on $NVDA', 'Explain Market Trend']
        : ['/backtest RSI on SPY', '/optimize MA_Cross', '/scan Convergence', 'Risk Check Portfolio'];






    const executeCommand = async (text) => {
        if (!text.trim()) return;

        // Add user message
        const userMsg = { role: 'user', content: text, timestamp: new Date().toLocaleTimeString() };
        updateHistory(prev => [...prev, userMsg]);

        // Placeholder for AI
        const aiPlaceholderId = Date.now();
        updateHistory(prev => [...prev, {
            id: aiPlaceholderId,
            role: 'ai',
            content: '',
            steps: [],
            isStreaming: true,
            widget: text.toLowerCase().includes('backtest') ? 'BACKTEST_WIDGET' : null,
            timestamp: new Date().toLocaleTimeString()
        }]);

        try {
            const res = await fetch('/api/prometheus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: text,
                    email: currentUser ? currentUser.email : 'guest',
                    mode: mode
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);

                        updateHistory(prev => prev.map(msg => {
                            if (msg.id !== aiPlaceholderId) return msg;

                            // Safety check for null/undefined data
                            if (!data || !data.type) return msg;

                            if (data.type === 'step') {
                                if (onStatusChange) onStatusChange(data.content);
                                return { ...msg, steps: [...(msg.steps || []), data.content] };
                            } else if (data.type === 'result') {
                                if (onStatusChange) setTimeout(() => onStatusChange(null), 2000); // Reset after delay
                                return { ...msg, content: data.content, isStreaming: false };
                            } else if (data.type === 'widget') {
                                // Lift widget to Canvas
                                if (onAddModule) {
                                    onAddModule({
                                        id: Date.now(),
                                        type: data.content.type,
                                        data: data.content.data,
                                        title: data.content.type.replace('_CARD', '')
                                    });
                                }
                                return { ...msg, widget: data.content.type, widgetData: data.content.data };
                            }
                            return msg;
                        }));

                    } catch (e) { console.error("Stream Parse Error", e); }
                }
            }
        } catch (e) {
            console.error("Prometheus Error", e);
            updateHistory(prev => prev.map(msg => {
                if (msg.id !== aiPlaceholderId) return msg;
                return { ...msg, content: "Connection to Singularity Core failed.", isStreaming: false };
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const cmd = input;
        setInput('');
        setShowSuggestions(false);
        await executeCommand(cmd);
    };

    const handlePromptClick = (text) => {
        executeCommand(text);
    };

    const handleBrickAdd = (brick) => {
        setInput(prev => prev + (prev ? ' + ' : '') + `[${brick}]`);
    };


    return (
        <div className="flex flex-col h-full w-full relative">

            {/* CHAT HISTORY */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10" ref={scrollRef}>
                {history.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                        <div className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed border ${msg.role === 'user' ? 'bg-white/10 border-white/5 text-white rounded-br-none' : `bg-black/40 ${borderColor} ${textColor} rounded-bl-none`}`}>
                            {msg.role === 'ai' && msg.steps && msg.steps.length > 0 && (
                                <div className="mb-3 space-y-1">
                                    {msg.steps.map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                                            {msg.isStreaming && idx === msg.steps.length - 1 ? (
                                                <span className={`w-2 h-2 rounded-full bg-${themeColor}-500 animate-pulse`}></span>
                                            ) : (
                                                <span className="text-green-500">✓</span>
                                            )}
                                            {step}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {msg.content}
                            {msg.isStreaming && !msg.content && <span className="animate-pulse">_</span>}
                        </div>

                        {/* WIDGET AREA */}
                        {msg.widget === 'BACKTEST_WIDGET' && (
                            <div className={`mt-2 w-[85%] h-24 bg-${themeColor}-900/10 border border-${themeColor}-500/20 rounded-lg flex items-center justify-center`}>
                                <span className={`text-xs ${textColor} animate-pulse`}>Initializing Simulation Widget...</span>
                            </div>
                        )}
                        {msg.widget === 'SENTIMENT_CARD' && msg.widgetData && (
                            <SentimentCard data={msg.widgetData} />
                        )}
                        {msg.widget === 'QUICKSCORE_CARD' && msg.widgetData && (
                            <QuickscoreCard data={msg.widgetData} />
                        )}

                        <span className="text-[9px] text-gray-600 mt-1 uppercase tracking-wide">{msg.role} • {msg.timestamp || new Date().toLocaleTimeString()}</span>
                    </motion.div>
                ))}
            </div>

            {/* INPUT AREA */}
            <div className="shrink-0 p-4 pt-2 relative">

                {/* QUICK PROMPTS */}
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none mask-linear-fade">
                    {QUICK_PROMPTS.map((prompt, i) => (
                        <button
                            key={i}
                            onClick={() => handlePromptClick(prompt)}
                            className={`whitespace-nowrap px-3 py-1 rounded-full border border-white/5 bg-white/5 text-[10px] text-gray-400 hover:text-${themeColor}-400 hover:border-${themeColor}-500/30 transition-colors`}
                        >
                            {prompt}
                        </button>
                    ))}
                </div>

                {/* GLASS SUGGESTIONS */}
                <AnimatePresence>
                    {showSuggestions && filteredSuggestions.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-4 right-4 mb-2 bg-[#121220]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-40"
                        >
                            {filteredSuggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setInput(s.label);
                                        setShowSuggestions(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between border-b border-white/5 last:border-0 group"
                                >
                                    <span className={`text-sm group-hover:text-${themeColor}-400 transition-colors`}>{s.label}</span>
                                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">{s.type}</span>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* LOGIC BRICK DRAWER */}
                <LogicBrickDrawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} onAddBrick={handleBrickAdd} />

                {/* INPUT BAR */}
                <div className="relative group">
                    <div className={`absolute inset-0 bg-gradient-to-r from-${themeColor}-500/20 to-purple-500/20 rounded-xl blur transition-all duration-500 opacity-50 group-hover:opacity-100`} />
                    <form onSubmit={handleSubmit} className="relative bg-black rounded-xl flex items-center p-1 border border-white/10 focus-within:border-white/30 transition-colors shadow-lg">

                        <button
                            type="button"
                            onClick={() => setShowDrawer(!showDrawer)}
                            className={`p-2 rounded-lg text-gray-500 hover:text-${themeColor}-400 hover:bg-white/5 transition-colors`}
                            title="Logic Bricks"
                        >
                            <Box size={18} />
                        </button>

                        <input
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                setShowSuggestions(!!e.target.value);
                            }}
                            placeholder={mode === 'ANALYST' ? "Ask Prometheus..." : "Command Kronos..."}
                            className="flex-1 bg-transparent border-none outline-none text-white px-3 font-mono text-sm placeholder:text-gray-600 h-10"
                        />

                        <button
                            type="submit"
                            className={`p-2 rounded-lg ${input ? `bg-${themeColor}-500 text-black` : 'bg-white/5 text-gray-600'} transition-all`}
                        >
                            {input.startsWith('/') ? <Command size={16} /> : <Send size={16} />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SingularityStream;
