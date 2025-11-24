import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, ChevronRight, Lock } from 'lucide-react';

const Products = () => {
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
                                <Brain size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-gold/20 rounded-lg flex items-center justify-center mb-6 text-gold">
                                    <Brain size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-gold transition-colors">Portfolio Lab</h3>
                                <p className="text-gray-400 mb-6">
                                    The ultimate environment for testing and optimizing investment strategies with AI-driven insights.
                                </p>
                                <div className="flex items-center text-gold font-bold">
                                    Launch Application <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>

                    {/* Future Product 1 - Locked */}
                    <div className="group relative">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="h-full bg-white/5 border border-white/10 rounded-2xl p-8 opacity-75 grayscale hover:grayscale-0 transition-all duration-500"
                        >
                            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-6 text-gray-400">
                                <Lock size={24} />
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-gray-300">Quantum Hedge</h3>
                            <p className="text-gray-500 mb-6">
                                Advanced risk management using quantum-inspired algorithms for institutional-grade hedging.
                            </p>
                            <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-gray-400 border border-white/10">
                                COMING SOON
                            </div>
                        </motion.div>
                    </div>

                    {/* Future Product 2 - Locked */}
                    <div className="group relative">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="h-full bg-white/5 border border-white/10 rounded-2xl p-8 opacity-75 grayscale hover:grayscale-0 transition-all duration-500"
                        >
                            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-6 text-gray-400">
                                <Lock size={24} />
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-gray-300">Neural Trade</h3>
                            <p className="text-gray-500 mb-6">
                                Automated high-frequency trading execution powered by deep reinforcement learning.
                            </p>
                            <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-gray-400 border border-white/10">
                                COMING SOON
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Products;
