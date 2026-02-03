import React from 'react';
import { Activity, Clock } from 'lucide-react';

const AutomationWidget = ({ automations }) => {
    return (
        <div className="glass-panel p-6 h-full rounded-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Active Automations
                </h3>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded">
                    {automations.length} Running
                </span>
            </div>

            <div className="space-y-3 relative z-10">
                {automations.length === 0 ? (
                    <div className="text-white/40 text-sm italic py-4">No active automations.</div>
                ) : (
                    automations.map((auto) => (
                        <div key={auto.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-colors">
                            <div>
                                <div className="text-sm font-medium text-white">{auto.name}</div>
                                <div className="text-xs text-cyan-300/70 flex items-center gap-1 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    Running
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-white/50 flex items-center gap-1 justify-end">
                                    <Clock className="w-3 h-3" />
                                    Next: {auto.next_run}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AutomationWidget;
