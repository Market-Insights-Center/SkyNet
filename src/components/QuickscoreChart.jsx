import React, { useState } from 'react';
import {
    AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const dateStr = new Date(label).toLocaleDateString([], {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: label.includes('T') ? '2-digit' : undefined,
            minute: label.includes('T') ? '2-digit' : undefined
        });

        return (
            <div className="bg-black/80 border border-gold/30 p-3 rounded-lg backdrop-blur-md shadow-xl">
                <p className="text-gray-400 text-xs mb-2">{dateStr}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-medium">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-gray-300">{entry.name}:</span>
                        <span className="text-white">
                            ${Number(entry.value).toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const QuickscoreChart = ({ data, ticker }) => {
    // data is object: { "1": [...], "2": [...], "3": [...] }
    // "1": Weekly, "2": Daily, "3": Hourly

    // Determine the best starting tab
    const availableKeys = Object.keys(data || {});
    // Preference order: Daily (2), Weekly (1), Hourly (3)
    const initialTab = availableKeys.includes('2') && data['2'].length > 0 ? '2'
        : availableKeys.includes('1') && data['1'].length > 0 ? '1'
            : availableKeys.includes('3') && data['3'].length > 0 ? '3'
                : '2';

    const [activeTab, setActiveTab] = useState(initialTab);

    const chartData = data[activeTab] || [];

    // Determine min/max for Y-axis domain to make chart look dynamic
    const prices = chartData.map(d => d.price);
    const minPrice = Math.min(...prices) * 0.95;
    const maxPrice = Math.max(...prices) * 1.05;

    const tabs = [
        { id: '1', label: 'Weekly (5Y)' },
        { id: '2', label: 'Daily (1Y)' },
        { id: '3', label: 'Hourly (6M)' }
    ];

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-gold/30 transition-all duration-500 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-gold">
                    Technical Chart: {ticker}
                </h3>

                {/* Tabs */}
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-gold text-black shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[400px] w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis
                                dataKey="date"
                                hide={true} // Hide X axis labels for cleaner look or format them nicely
                            />
                            <YAxis
                                domain={[minPrice, maxPrice]}
                                orientation="right"
                                tick={{ fill: '#666', fontSize: 12 }}
                                tickFormatter={(val) => `$${val.toFixed(0)}`}
                                stroke="#333"
                            />
                            <Tooltip content={<CustomTooltip />} />

                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke="#D4AF37"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorPrice)"
                                name="Price"
                            />
                            <Line
                                type="monotone"
                                dataKey="ema_8"
                                stroke="#F87171"
                                strokeWidth={1.5}
                                dot={false}
                                name="EMA 8"
                            />
                            <Line
                                type="monotone"
                                dataKey="ema_55"
                                stroke="#34D399"
                                strokeWidth={1.5}
                                dot={false}
                                name="EMA 55"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        No chart data available for this timeframe.
                    </div>
                )}
            </div>

            <div className="mt-4 flex gap-6 justify-center text-xs text-gray-400">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gold rounded-full opacity-80"></div> Price
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div> EMA 8 (Fast)
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div> EMA 55 (Slow)
                </div>
            </div>
        </div>
    );
};

export default QuickscoreChart;
