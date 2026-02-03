import React, { useEffect, useState } from 'react';
import { LayoutDashboard, RefreshCw, Loader2 } from 'lucide-react';
import AutomationWidget from '../components/dashboard/AutomationWidget';
import PnLWidget from '../components/dashboard/PnLWidget';
import RecentActionsWidget from '../components/dashboard/RecentActionsWidget';
import MarketBriefWidget from '../components/dashboard/MarketBriefWidget';

const UnifiedDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/dashboard/summary');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error("Failed to fetch dashboard data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading && !data) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center text-white/50 animate-pulse">
                <LayoutDashboard className="w-12 h-12 mb-4 opacity-50" />
                <div className="text-sm font-mono">INITIALIZING DASHBOARD...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-8 pt-24 pb-24">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50 mb-2">
                        STRATEGY COMMAND
                    </h1>
                    <p className="text-white/40 text-sm font-mono uppercase tracking-widest">
                        SkyNet Unified Operations
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all active:scale-95"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Grid Layout */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[800px] md:h-[500px]">

                {/* 1. Automations (Tall on mobile, Wide on Desktop?) - Let's keep 4 cols */}
                <div className="col-span-1 md:col-span-2 lg:col-span-1 h-64 md:h-full">
                    <AutomationWidget automations={data?.active_automations || []} />
                </div>

                {/* 2. Strategy PnL (Wide) */}
                <div className="col-span-1 md:col-span-2 lg:col-span-2 h-64 md:h-full">
                    <PnLWidget pnl={data?.strategy_pnl || {}} />
                </div>

                {/* 3. Right Column Stack */}
                <div className="col-span-1 md:col-span-2 lg:col-span-1 flex flex-col gap-6 h-full">
                    <div className="flex-1 min-h-[150px]">
                        <MarketBriefWidget market={data?.market_overview || {}} />
                    </div>
                    <div className="flex-1 min-h-[200px]">
                        <RecentActionsWidget actions={data?.recent_actions || []} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default UnifiedDashboard;
