import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Share2 } from 'lucide-react';

const Results = ({ toolType, onBack }) => {
    // Use data from API if available, otherwise fallback to empty/mock
    const data = window.analysisResults || { summary: [], table: [] };
    const { summary: summaryStats, table: tableData } = data;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to Configuration
                </button>
                <div className="flex gap-3">
                    <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white transition-colors">
                        <Share2 size={20} />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors">
                        <Download size={20} />
                        Export Report
                    </button>
                </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-6">Analysis Results</h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {summaryStats.map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-xl p-6"
                    >
                        <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-gold">{stat.value}</h3>
                        <span className={`text-xs ${stat.isPositive ? 'text-green-400' : 'text-gray-500'}`}>
                            {stat.change}
                        </span>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section (Placeholder) */}
                <div className="lg:col-span-1 bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-48 h-48 rounded-full border-8 border-white/5 border-t-royal-purple border-r-gold relative flex items-center justify-center">
                        <span className="text-xl font-bold text-white">Allocation</span>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-4 justify-center">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gold rounded-full"></div><span className="text-sm text-gray-300">Tech</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-royal-purple rounded-full"></div><span className="text-sm text-gray-300">Growth</span></div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-royal-purple/20 border-b border-white/10">
                                    <th className="p-4 text-sm font-bold text-white">Ticker</th>
                                    <th className="p-4 text-sm font-bold text-white">Shares</th>
                                    <th className="p-4 text-sm font-bold text-white">Price</th>
                                    <th className="p-4 text-sm font-bold text-white">Allocation</th>
                                    <th className="p-4 text-sm font-bold text-white text-right">P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-bold text-white">{row.ticker}</td>
                                        <td className="p-4 text-gray-300">{row.shares}</td>
                                        <td className="p-4 text-gray-300">${row.price.toFixed(2)}</td>
                                        <td className="p-4 text-gray-300">{row.alloc}</td>
                                        <td className={`p-4 font-bold text-right ${row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {row.pnl >= 0 ? '+' : ''}{row.pnl.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default Results;
