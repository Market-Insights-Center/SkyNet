import React from 'react';
import { DollarSign, TrendingUp, BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const PnLWidget = ({ pnl }) => {
    // Mock data for the chart, in real app pass this in
    const data = [
        { name: 'Mon', val: 400 },
        { name: 'Tue', val: 300 },
        { name: 'Wed', val: 550 },
        { name: 'Thu', val: 900 },
        { name: 'Fri', val: 1250 },
    ];

    return (
        <div className="glass-panel p-6 h-full rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-indigo-400" />
                    Strategy PnL
                </h3>
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
                    Weekly
                </span>
            </div>

            <div className="flex items-baseline gap-2 mb-6 relative z-10">
                <span className="text-3xl font-bold text-white tracking-tight">${pnl.weekly?.toFixed(2)}</span>
                <span className="text-sm font-medium text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    +{pnl.daily_pct}%
                </span>
            </div>

            <div className="h-32 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ display: 'none' }}
                        />
                        <Area type="monotone" dataKey="val" stroke="#818cf8" fillOpacity={1} fill="url(#colorVal)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PnLWidget;
