import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, ChevronRight, Search, Scale, Siren, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSkyNet } from '../contexts/SkyNetContext';

const Products = () => {
    const { userProfile } = useAuth();
    const { connect, disconnect, isConnected } = useSkyNet();
    const [skynetActive, setSkynetActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Sync local state with global isConnected
    useEffect(() => {
        setSkynetActive(isConnected);
    }, [isConnected]);

    // Check if we are inside the popup
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('skynet') === 'true') {
            setSkynetActive(true);
        }
    }, []);

    const toggleSkyNet = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            if (skynetActive) {
                // STOP Logic
                await fetch('http://localhost:8000/api/skynet/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'stop' })
                });
                disconnect();

            } else {
                // START Logic
                // 1. Tell backend to launch Python script
                const response = await fetch('http://localhost:8000/api/skynet/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start' })
                });

                const data = await response.json();

                if (response.ok) {
                    // 2. Connect directly (No Popup)
                    connect();
                } else {
                    alert(`Error starting SkyNet: ${data.detail || 'Unknown error'}`);
                }
            }
        } catch (error) {
            console.error("SkyNet Toggle Error:", error);
            alert("Failed to communicate with backend. Ensure main.py is running.");
        } finally {
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

                {/* --- SKYNET INTERFACE ACTIVATION --- */}
                {/* MODIFIED CONDITION: Show if Singularity Tier OR if profile hasn't loaded yet (!userProfile) */}
                {(!userProfile || userProfile?.tier === 'Singularity') && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-12 p-6 bg-gradient-to-r from-gray-900 to-black border border-cyan-500/30 rounded-xl flex flex-col md:flex-row items-center justify-between shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    >
                        <div className="mb-4 md:mb-0">
                            <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                                <Bot className="w-6 h-6" />
                                SkyNet Interface <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">BETA</span>
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                Activate gesture and voice control system. (Auto-starts backend process)
                            </p>
                        </div>

                        <button
                            onClick={toggleSkyNet}
                            disabled={isProcessing}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all border ${skynetActive
                                ? 'bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isProcessing ? (
                                <span className="animate-pulse">PROCESSING...</span>
                            ) : (
                                <>
                                    {skynetActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                    {skynetActive ? 'DISENGAGE SYSTEM' : 'INITIALIZE SYSTEM'}
                                    {!skynetActive && <ExternalLink className="w-4 h-4 ml-1" />}
                                </>
                            )}
                        </button>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Portfolio Lab - Active */}
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

                    {/* Asset Evaluator - Active */}
                    <Link to="/asset-evaluator" className="group">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="h-full bg-white/5 border border-purple-500/30 rounded-2xl p-8 hover:bg-white/10 hover:border-purple-500 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Search size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-6 text-purple-400">
                                    <Search size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-purple-400 transition-colors">Asset Evaluator</h3>
                                <p className="text-gray-400 mb-6">
                                    Tools for scoring the strength of portfolios and assets, generating investment recommendations.
                                </p>
                                <div className="flex items-center text-purple-400 font-bold">
                                    Launch Application <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>

                    {/* Comparison Matrix - Active */}
                    <Link to="/products/comparison-matrix" className="group">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="h-full bg-white/5 border border-cyan-500/30 rounded-2xl p-8 hover:bg-white/10 hover:border-cyan-500 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Scale size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-6 text-cyan-400">
                                    <Scale size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">Comparison Matrix</h3>
                                <p className="text-gray-400 mb-6">
                                    Products that produce lists of the strongest assets with the highest growth potential based on tested formulas.
                                </p>
                                <div className="flex items-center text-cyan-400 font-bold">
                                    Launch Application <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>

                    {/* Market Nexus - Active */}
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