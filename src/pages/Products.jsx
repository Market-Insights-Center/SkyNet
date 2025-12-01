import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, ChevronRight, Search, Scale, Siren } from 'lucide-react';

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

                    {/* Asset Evaluator - Locked */}
                    <div className="group relative">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="h-full bg-white/5 border border-white/10 rounded-2xl p-8 opacity-75 grayscale hover:grayscale-0 transition-all duration-500"
                        >
                            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-6 text-gray-400">
                                <Search size={24} />
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-gray-300">Asset Evaluator</h3>
                            <p className="text-gray-500 mb-6">
                                Tools for scoring the strength of portfolios and assets, generating investment recommendations.
                            </p>
                            <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-gray-400 border border-white/10">
                                COMING SOON
                            </div>
                        </motion.div>
                    </div>

                    {/* Comparison Matrix - Locked */}
                    <div className="group relative">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="h-full bg-white/5 border border-white/10 rounded-2xl p-8 opacity-75 grayscale hover:grayscale-0 transition-all duration-500"
                        >
                            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-6 text-gray-400">
                                <Scale size={24} />
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-gray-300">Comparison Matrix</h3>
                            <p className="text-gray-500 mb-6">
                                Products that produce lists of the strongest assets with the highest growth potential based on tested formulas.
                            </p>
                            <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-gray-400 border border-white/10">
                                COMING SOON
                            </div>
                        </motion.div>
                    </div>

                    {/* Market Nexus - Locked */}
                    <div className="group relative">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="h-full bg-white/5 border border-white/10 rounded-2xl p-8 opacity-75 grayscale hover:grayscale-0 transition-all duration-500"
                        >
                            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-6 text-gray-400">
                                <Siren size={24} />
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-gray-300">Market Nexus</h3>
                            <p className="text-gray-500 mb-6">
                                Score the strength of the market, forecast reversal likelihoods, and bring all relevant data into a single output.
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
