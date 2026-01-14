import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';

// War Room Symbol Sets
const WAR_ROOM_SETS = [
    { name: "MARKET OVERVIEW", main: "AMEX:SPY", sub1: "FRED:VIXCLS", sub2: "COINBASE:BTCUSD", color: "gold" },
    { name: "TECH DOMINANCE", main: "NASDAQ:QQQ", sub1: "NASDAQ:NVDA", sub2: "NASDAQ:AAPL", color: "blue" },
    { name: "COMMODITIES", main: "TVC:USOIL", sub1: "TVC:GOLD", sub2: "TVC:SILVER", color: "orange" },
    { name: "CRYPTO FRONTIER", main: "COINBASE:ETHUSD", sub1: "COINBASE:SOLUSD", sub2: "COINBASE:DOGEUSD", color: "purple" }
];

const MarketDashboard = () => {
    const [warRoomActive, setWarRoomActive] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(10); // 10s per view

    useEffect(() => {
        let interval;
        let timer;
        if (warRoomActive) {
            interval = setInterval(() => {
                setCurrentIndex(prev => (prev + 1) % WAR_ROOM_SETS.length);
                setTimeLeft(10);
            }, 10000);

            timer = setInterval(() => {
                setTimeLeft(t => Math.max(0, t - 1));
            }, 1000);
        } else {
            setCurrentIndex(0); // Reset to default
        }
        return () => { clearInterval(interval); clearInterval(timer); };
    }, [warRoomActive]);

    const currentSet = WAR_ROOM_SETS[currentIndex];

    // Helper to get widget overrides based on active set
    const getWidgetProps = (symbol) => ({
        symbol,
        theme: "dark",
        autosize: true,
        // key: symbol // REMOVED: Passed explicitly in render to avoid spread warning
    });

    return (
        <section className={`py-12 px-4 transition-colors duration-1000 ${warRoomActive ? 'bg-red-900/10' : 'bg-deep-black'}`}>
            <div className="max-w-7xl mx-auto">

                {/* Header & Controls */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`text-sm font-mono font-bold px-3 py-1 rounded border ${warRoomActive ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                            {warRoomActive ? `WAR ROOM ACTIVE // CYCLE ${currentIndex + 1}/${WAR_ROOM_SETS.length}` : 'STANDARD FEED'}
                        </div>
                        {warRoomActive && (
                            <div className="text-xs font-mono text-gray-500">NEXT VIEW IN: {timeLeft}s</div>
                        )}
                    </div>

                    <button
                        onClick={() => setWarRoomActive(!warRoomActive)}
                        className={`flex items-center gap-2 px-6 py-2 rounded font-bold transition-all ${warRoomActive
                            ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                    >
                        <Activity size={18} className={warRoomActive ? 'animate-spin' : ''} />
                        {warRoomActive ? 'DISENGAGE WAR ROOM' : 'ACTIVATE WAR ROOM'}
                    </button>
                </div>

                {/* UPDATED: Flex-col for mobile (stacked), Grid for Desktop */}
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:h-[600px]">

                    {/* Primary Chart */}
                    <div className="lg:col-span-2 glass-panel glass-panel-hover rounded-xl overflow-hidden relative group flex flex-col h-[500px] lg:h-auto border border-white/10">
                        {/* Decorative Corner Accents */}
                        <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-${currentSet.color}-500/50 rounded-tl-lg z-20`} />
                        <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-${currentSet.color}-500/50 rounded-tr-lg z-20`} />

                        <div className="absolute top-4 left-4 z-30 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs font-bold text-white border border-white/10 uppercase">
                            {currentSet.name} // <span className={`text-${currentSet.color}-400`}>{currentSet.main}</span>
                        </div>

                        <div className="flex-grow relative w-full h-full">
                            <TradingViewWidget key={currentSet.main} {...getWidgetProps(currentSet.main)} />
                        </div>
                    </div>

                    {/* Secondary Charts Container */}
                    <div className="flex flex-col gap-6 h-auto lg:h-full">
                        {/* Sub 1 */}
                        <div className="flex-1 glass-panel glass-panel-hover rounded-xl overflow-hidden p-1 relative flex flex-col h-[400px] lg:h-auto group border border-white/10">
                            <div className="absolute top-2 left-4 z-10 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full bg-${currentSet.color}-500 animate-pulse`} />
                                <span className={`text-xs font-bold text-${currentSet.color}-400 tracking-wider`}>{currentSet.sub1}</span>
                            </div>

                            <div className="flex-grow relative w-full h-full rounded-lg overflow-hidden bg-black/20">
                                <TradingViewWidget
                                    key={currentSet.sub1}
                                    {...getWidgetProps(currentSet.sub1)}
                                    style="1"
                                    interval="D"
                                    hide_top_toolbar={true}
                                    hide_legend={true}
                                    hide_side_toolbar={true}
                                    allow_symbol_change={false}
                                    save_image={false}
                                />
                            </div>
                        </div>

                        {/* Sub 2 */}
                        <div className="flex-1 glass-panel glass-panel-hover rounded-xl overflow-hidden p-1 relative flex flex-col h-[400px] lg:h-auto group border border-white/10">
                            <div className="absolute top-2 left-4 z-10 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full bg-${currentSet.color}-500 animate-pulse`} />
                                <span className={`text-xs font-bold text-${currentSet.color}-400 tracking-wider`}>{currentSet.sub2}</span>
                            </div>

                            <div className="flex-grow relative w-full h-full rounded-lg overflow-hidden bg-black/20">
                                <TradingViewWidget
                                    key={currentSet.sub2}
                                    {...getWidgetProps(currentSet.sub2)}
                                    style="1"
                                    interval="60"
                                    hide_top_toolbar={true}
                                    hide_legend={true}
                                    hide_side_toolbar={true}
                                    allow_symbol_change={false}
                                    save_image={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MarketDashboard;