import React from 'react';
import { History, Zap } from 'lucide-react';

const RecentActionsWidget = ({ actions }) => {
    return (
        <div className="glass-panel p-6 h-full rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-400" />
                    Recent Actions
                </h3>
            </div>

            <div className="space-y-0 relative z-10">
                {actions.map((action, i) => (
                    <div key={i} className="flex gap-3 py-3 border-b border-white/5 last:border-0 group/item">
                        <div className="mt-1">
                            <div className="w-2 h-2 rounded-full bg-amber-500/50 group-hover/item:bg-amber-400 transition-colors" />
                        </div>
                        <div>
                            <div className="text-sm text-white font-medium">{action.action}</div>
                            <div className="text-xs text-white/50">{action.details}</div>
                            <div className="text-[10px] text-white/30 font-mono mt-1">{action.time}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentActionsWidget;
