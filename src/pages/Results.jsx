import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Share2 } from 'lucide-react';

// Simple Donut Chart Component
const DonutChart = ({ data }) => {
    const total = data.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
    let currentAngle = 0;
    
    // Define colors
    const colors = ['#D4AF37', '#6A0DAD', '#4B5563', '#9CA3AF', '#1F2937'];

    if (total === 0) return (
        <div className="w-48 h-48 rounded-full border-8 border-white/5 flex items-center justify-center">
            <span className="text-gray-500 text-sm">No Data</span>
        </div>
    );

    return (
        <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {data.map((item, index) => {
                    const value = parseFloat(item.value) || 0;
                    if (value <= 0) return null;
                    
                    const percentage = value / total;
                    const angle = percentage * 360;
                    
                    // Calculate SVG arc path
                    const radius = 40; // r
                    const circumference = 2 * Math.PI * radius;
                    const strokeDasharray = `${(percentage * circumference)} ${circumference}`;
                    const strokeDashoffset = -(currentAngle / 360) * circumference;
                    
                    currentAngle += angle;
                    
                    return (
                        <circle
                            key={index}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={colors[index % colors.length]}
                            strokeWidth="12"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500"
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-white">Allocation</span>
            </div>
        </div>
    );
};

const Results = ({ toolType, onBack }) => {
    const data = window.analysisResults || { summary: [], table: [] };
    const { summary: summaryStats, table: tableData } = data;

    // Prepare data for chart (using 'value' which is actual money allocation)
    const chartData = tableData.map(item => ({
        label: item.ticker,
        value: item.value // Use the raw value from backend for accuracy
    })).filter(item => item.value > 0);

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
                        <span className="text-xs text-gray-500">
                            {stat.change}
                        </span>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-1 bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
                    <DonutChart data={chartData} />
                    <div className="mt-6 flex flex-wrap gap-4 justify-center">
                        {chartData.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: ['#D4AF37', '#6A0DAD', '#4B5563', '#9CA3AF', '#1F2937'][index % 5] }}
                                ></div>
                                <span className="text-sm text-gray-300">{item.label}</span>
                            </div>
                        ))}
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
                                    <th className="p-4 text-sm font-bold text-white">Allocation %</th>
                                    <th className="p-4 text-sm font-bold text-white text-right">Value ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-bold text-white">{row.ticker}</td>
                                        <td className="p-4 text-gray-300">{row.shares}</td>
                                        <td className="p-4 text-gray-300">${row.price.toFixed(2)}</td>
                                        <td className="p-4 text-gray-300">{row.alloc}</td>
                                        <td className="p-4 font-bold text-white text-right">
                                            ${row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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