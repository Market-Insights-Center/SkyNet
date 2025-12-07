import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, ChevronRight, Search, Scale, Siren, ToggleLeft, ToggleRight, ExternalLink, HelpCircle, X, Hand, Mic, Activity, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSkyNet } from '../contexts/SkyNetContext';

const Products = () => {
    const { userProfile } = useAuth();
    const { connect, disconnect, isConnected } = useSkyNet();
    const [skynetActive, setSkynetActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        setSkynetActive(isConnected);
    }, [isConnected]);

    const toggleSkyNet = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            if (skynetActive) {
                // STOP
                const host = window.location.hostname;
                await fetch(`/api/skynet/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'stop' })
                });
                disconnect();
                // Short delay for shutdown animation
                setTimeout(() => setIsProcessing(false), 1000);
            } else {
                // START
                const host = window.location.hostname;
                const response = await fetch(`/api/skynet/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start' })
                });

                if (response.ok) {
                    // FIX: Longer delay for smoother transition and backend init
                    setTimeout(() => {
                        connect();
                        // Only stop processing after connect is likely done
                        setTimeout(() => setIsProcessing(false), 500);
                    }, 2000);
                } else {
                    alert(`Error starting SkyNet.`);
                    setIsProcessing(false);
                }
            }
        } catch (error) {
            console.error("SkyNet Toggle Error:", error);
            alert("Failed to communicate with backend.");
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-5xl md:text-7xl font-bold mb-6">Our <span className="text-gold">Products</span></h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Explore the suite of advanced financial tools designed to give you the edge in the modern market.
                    </p>
                </motion.div>

                {(!userProfile || userProfile?.tier === 'Singularity') && (
                    <div className="hidden md:block">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-12 p-6 bg-gradient-to-r from-gray-900 to-black border border-purple-500/30 rounded-xl flex flex-col md:flex-row items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                        >
                            <div className="mb-4 md:mb-0">
                                <h2 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
                                    <Bot className="w-6 h-6" />
                                    SkyNet Interface
                                    <button
                                        onClick={() => setShowDetails(true)}
                                        className="text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 transition-colors uppercase tracking-wider font-semibold"
                                    >
                                        See More Details
                                    </button>
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    Activate gesture and voice control system.
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowControls(true)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-full font-bold border border-purple-500/30 bg-black hover:bg-purple-900/20 text-purple-400 transition-all"
                                >
                                    <HelpCircle className="w-5 h-5" />
                                    VIEW CONTROLS
                                </button>

                                <button
                                    onClick={toggleSkyNet}
                                    disabled={isProcessing}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all border ${skynetActive
                                        ? 'bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20'
                                        : 'bg-purple-500/10 text-purple-400 border-purple-500/50 hover:bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                                        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isProcessing ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>{skynetActive ? "TERMINATING..." : "ESTABLISHING UPLINK..."}</span>
                                        </div>
                                    ) : (
                                        <>
                                            {skynetActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                            {skynetActive ? 'DISENGAGE SYSTEM' : 'INITIALIZE SYSTEM'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {showDetails && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gray-900 border border-purple-500/50 rounded-lg shadow-[0_0_30px_rgba(168,85,247,0.3)] max-w-lg w-full relative overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                                        <Bot className="w-5 h-5" /> SkyNet Interface
                                    </h3>
                                    <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-white transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
                                    <p>
                                        <strong className="text-purple-300">SkyNet</strong> is an advanced Human-Computer Interface (HCI) designed to revolutionize how you interact with financial data. By bridging the gap between physical intent and digital execution, it allows for a seamless, keyboard-free workflow.
                                    </p>
                                    <p>
                                        Using computer vision and voice recognition, SkyNet empowers you to navigate charts, execute commands, and analyze markets using intuitive hand gestures and natural language. It functions as a detached, "always-on" assistant that overlays your existing workflow without interrupting it.
                                    </p>
                                    <div className="bg-purple-900/20 p-3 rounded border border-purple-500/20 text-xs italic text-purple-200">
                                        "The ultimate tool for the modern trader who values speed, precision, and a futuristic control capability."
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/40 p-3 border-t border-purple-500/20 flex justify-end">
                                <button onClick={() => setShowDetails(false)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-bold transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showControls && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gray-900 border border-cyan-500/50 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden text-cyan-100 font-mono relative">
                            <div className="flex items-center justify-between p-4 border-b border-cyan-500/30 bg-cyan-900/20">
                                <div className="flex items-center gap-2 text-cyan-400">
                                    <Activity className="w-5 h-5" />
                                    <h2 className="text-lg font-bold tracking-widest">SKYNET CONTROLS</h2>
                                </div>
                                <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-cyan-300 border-b border-cyan-500/30 pb-1 mb-2">
                                        <Hand className="w-4 h-4" />
                                        <h3 className="font-bold">RIGHT HAND</h3>
                                    </div>
                                    <ul className="space-y-3 text-xs text-gray-300">
                                        <li><strong className="text-cyan-400">Index Point:</strong> Move Cursor</li>
                                        <li><strong className="text-cyan-400">Pinch (Index):</strong> Click / Drag</li>
                                        <li><strong className="text-cyan-400">2x Pinch:</strong> Double Click</li>
                                        <li><strong className="text-cyan-400">Pinky+Thumb:</strong> Right Click</li>
                                        <li><strong className="text-cyan-400">2 Fingers Up/Down:</strong> Scroll</li>
                                        <li><strong className="text-cyan-400">Shaka 🤙:</strong> Toggle Sidebar</li>
                                    </ul>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-purple-300 border-b border-purple-500/30 pb-1 mb-2">
                                        <Hand className="w-4 h-4" />
                                        <h3 className="font-bold">LEFT HAND</h3>
                                    </div>
                                    <ul className="space-y-3 text-xs text-gray-300">
                                        <li><strong className="text-purple-400">Open Palm (Hold):</strong> Freeze / Controls</li>
                                        <li><strong className="text-purple-400">2 Fingers Up:</strong> Diction (Speech-to-Text)</li>
                                        <li><strong className="text-purple-400">3 Fingers Up:</strong> Delete Word (1/sec)</li>
                                        <li><strong className="text-purple-400">Mid+Thumb:</strong> Cycle Sensitivity</li>
                                        <li><strong className="text-purple-400">Closed Fist:</strong> Reset Mouse</li>
                                        <li><strong className="text-purple-400">Thumb+Pinky:</strong> Open TradingView</li>
                                        <li><strong className="text-purple-400">Triangle (Both Hands):</strong> TERMINATE</li>
                                    </ul>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-green-300 border-b border-green-500/30 pb-1 mb-2">
                                        <Mic className="w-4 h-4" />
                                        <h3 className="font-bold">VOICE COMMANDS</h3>
                                    </div>
                                    <ul className="space-y-3 text-xs text-gray-300">
                                        <li><strong className="text-green-400">"Open Chart [Ticker]"</strong><br /><span className="text-gray-500">e.g. "Open Chart NVDA"</span></li>
                                        <li><strong className="text-green-400">"Go to [Page/Product]"</strong><br /><span className="text-gray-500">e.g. "Go to Quickscore", "Go to Risk"</span></li>
                                        <li><strong className="text-green-400">"Start/Stop Diction"</strong><br /><span className="text-gray-500">Toggle typing mode</span></li>
                                        <li><strong className="text-green-400">"Sarah Connor"</strong><br /><span className="text-gray-500">System Shutdown</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Apps Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <Link to="/portfolio-lab" className="group">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="h-full bg-white/5 border border-gold/30 rounded-2xl p-8 hover:bg-white/10 hover:border-gold transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Bot size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-gold/20 rounded-lg flex items-center justify-center mb-6 text-gold">
                                    <Bot size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-gold transition-colors">Portfolio Lab</h3>
                                <p className="text-gray-400 mb-6">
                                    A tool that builds portfolios and portfolio allocations using advanced strategies and formulas backed by investment research.
                                </p>
                                <div className="flex items-center text-gold font-bold">
                                    Launch Application <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                    <Link to="/asset-evaluator" className="group">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="h-full bg-white/5 border border-gold/30 rounded-2xl p-8 hover:bg-white/10 hover:border-gold transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Search size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-gold/20 rounded-lg flex items-center justify-center mb-6 text-gold">
                                    <Search size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-gold transition-colors">Asset Evaluator</h3>
                                <p className="text-gray-400 mb-6">
                                    Tools for scoring the strength of portfolios and assets, generating investment recommendations.
                                </p>
                                <div className="flex items-center text-gold font-bold">
                                    Launch Application <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                    <Link to="/products/comparison-matrix" className="group">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="h-full bg-white/5 border border-gold/30 rounded-2xl p-8 hover:bg-white/10 hover:border-gold transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Scale size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-gold/20 rounded-lg flex items-center justify-center mb-6 text-gold">
                                    <Scale size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-gold transition-colors">Comparison Matrix</h3>
                                <p className="text-gray-400 mb-6">
                                    Products that produce lists of the strongest assets with the highest growth potential based on tested formulas.
                                </p>
                                <div className="flex items-center text-gold font-bold">
                                    Launch Application <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                    <Link to="/market-nexus" className="group">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="h-full bg-white/5 border border-gold/30 rounded-2xl p-8 hover:bg-white/10 hover:border-gold transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Siren size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-gold/20 rounded-lg flex items-center justify-center mb-6 text-gold">
                                    <Siren size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-gold transition-colors">Market Nexus</h3>
                                <p className="text-gray-400 mb-6">
                                    Score the strength of the market, forecast reversal likelihoods, and bring all relevant data into a single output.
                                </p>
                                <div className="flex items-center text-gold font-bold">
                                    Launch Application <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Products;