import React from 'react';
import { TrendingUp, TrendingDown, Globe } from 'lucide-react';

const MarketBriefWidget = ({ market }) => {
    const isPositive = market.spy_change >= 0;

    return (
        <div className="glass-panel p-6 h-full rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-emerald-400" />
                    Market Pulse
                </h3>
                <span className={`text-xs font-bold px-2 py-1 rounded ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {market.status}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <div className="text-xs text-white/50 mb-1">SPY Price</div>
                    <div className="text-2xl font-bold text-white tracking-tight">
                        ${market.spy_price?.toFixed(2)}
                    </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <div className="text-xs text-white/50 mb-1">Change</div>
                    <div className={`text-2xl font-bold tracking-tight flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        {market.spy_change}%
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
                <span>VIX Index</span>
                <span className="text-white/70 font-mono">{market.vix}</span>
            </div>
        </div>
    );
};

export default MarketBriefWidget;
