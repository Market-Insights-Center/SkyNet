import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Activity, TrendingUp, DollarSign, Globe, Trophy, X, Plus, Check, BarChart2, Loader2, Calendar, Minus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useLocation } from 'react-router-dom';

const FloatingHeader = () => {
    const { currentUser } = useAuth();
    const location = useLocation();
    const isWorkflowPage = location.pathname === '/workflow-automation';
    const [isMinimized, setIsMinimized] = useState(false);

    const [widgets, setWidgets] = useState([]);
    const [headerPos, setHeaderPos] = useState('top');
    const [enabled, setEnabled] = useState(true);
    const [rhConnected, setRhConnected] = useState(false);
    const [marketData, setMarketData] = useState({
        spy: { price: 0, change: 0 },
        status: 'CLOSED'
    });
    const [rhData, setRhData] = useState(null);

    // Position: Top (Default) or Right (Vertical)
    const isVertical = headerPos === 'right';

    // Dynamic Position Classes
    let positionClass = "";
    if (isWorkflowPage) {
        // Workflow page override (always bottom center for now, or match user preference?)
        // Let's keep workflow override as bottom center for usability unless requested otherwise
        positionClass = "fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2";
    } else if (isVertical) {
        positionClass = "fixed right-6 top-1/2 -translate-y-1/2 flex-col";
    } else {
        positionClass = "fixed bottom-6 md:bottom-auto md:top-24 left-1/2 -translate-x-1/2";
    }

    // Real-time Settings Sync
    useEffect(() => {
        if (!currentUser) return;

        const docRef = doc(db, "users", currentUser.email);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.settings?.header_widgets) {
                    setWidgets(data.settings.header_widgets);
                }
                if (data.settings?.header_position) setHeaderPos(data.settings.header_position);
                if (data.settings?.header_enabled !== undefined) setEnabled(data.settings.header_enabled);

                if (data.integrations?.robinhood?.connected) {
                    setRhConnected(true);
                } else {
                    setRhConnected(false);
                }
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Live Data Fetcher (SPY + Market Status + RH)
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Real SPY Data
                const res = await fetch('/api/market-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tickers: ['SPY'] })
                });
                const data = await res.json();
                if (data && data.length > 0) {
                    setMarketData(prev => ({ ...prev, spy: data[0] }));
                }

                // 2. Check Market Status
                const now = new Date();
                const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
                const hour = estTime.getHours();
                const minute = estTime.getMinutes();
                const day = estTime.getDay();
                const isWeekday = day >= 1 && day <= 5;
                const isOpen = isWeekday && ((hour > 9 && hour < 16) || (hour === 9 && minute >= 30));
                setMarketData(prev => ({ ...prev, status: isOpen ? 'OPEN' : 'CLOSED' }));

                // 3. Fetch Robinhood Data if connected
                if (rhConnected && currentUser) {
                    const rhRes = await fetch('/api/market-data/robinhood', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: currentUser.email })
                    });
                    const rhJson = await rhRes.json();
                    if (rhJson.status === 'success') {
                        setRhData(rhJson.data);
                    }
                }

            } catch (e) {
                console.error("Header Data Error", e);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [rhConnected, currentUser]);

    const [isEditing, setIsEditing] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);

    // Chart Modal State
    const [chartConfig, setChartConfig] = useState(null); // { ticker: 'SPY', range: '1d' }
    const [chartData, setChartData] = useState([]);
    const [loadingChart, setLoadingChart] = useState(false);

    // Save Widgets to Firestore
    const saveWidgets = async (newWidgets) => {
        setWidgets(newWidgets);
        if (currentUser) {
            await import("firebase/firestore").then(({ setDoc, doc }) => {
                setDoc(doc(db, "users", currentUser.email), { settings: { header_widgets: newWidgets } }, { merge: true });
            });
        }
    };

    const handleRemoveWidget = (id) => {
        const newWidgets = widgets.filter(w => w !== id);
        saveWidgets(newWidgets);
    };

    const handleAddWidget = (id) => {
        if (widgets.includes(id)) return;
        const newWidgets = [...widgets, id];
        saveWidgets(newWidgets);
        setShowAddMenu(false);
    };

    const lastFetchRange = React.useRef(null);

    // Chart Fetcher
    const openChart = async (metricId, overrideRange = null) => {
        if (isEditing && !overrideRange) return;

        let range = '1d';
        let ticker = 'SPY';

        if (metricId === 'spy_day') range = '1d';
        else if (metricId === 'spy_week') range = '1w';
        else if (metricId === 'spy_month') range = '1m';
        else if (metricId === 'spy_year') range = '1y';

        if (overrideRange) range = overrideRange;

        // Prevent redundant fetch if clicking same range? Optional.
        // if (chartConfig && chartConfig.range === range && chartConfig.metricId === metricId) return;

        setChartConfig({ ticker, range, metricId });
        setLoadingChart(true);
        // NOTE: We do NOT clear chartData here. Keeping old data while loading 
        // prevents the chart from unmounting/remounting, which causes the width(-1) error.

        lastFetchRange.current = range;

        try {
            const res = await fetch('/api/market-data/chart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker, range })
            });
            const json = await res.json();

            // Race condition check
            if (lastFetchRange.current !== range) return;

            if (json.status === 'success') {
                setChartData(json.data);
            }
        } catch (e) {
            console.error("Chart Fetch Error", e);
        } finally {
            if (lastFetchRange.current === range) {
                setLoadingChart(false);
            }
        }
    };

    // Available widgets for "Add" menu
    const ALL_WIDGETS = [
        { id: 'market_status', label: 'Market Status' },
        { id: 'spy_day', label: 'SPY (Day)' },
        { id: 'spy_week', label: 'SPY (Week)' },
        { id: 'spy_month', label: 'SPY (Month)' },
        { id: 'spy_year', label: 'SPY (Year)' },
        { id: 'rh_value', label: 'RH Value' },
        { id: 'rh_day', label: 'RH Return' }
    ];

    // Filter out already selected
    const availableWidgets = ALL_WIDGETS.filter(w => !widgets.includes(w.id));

    // Custom Reorder Handler
    const handleReorder = (newOrder) => {
        saveWidgets(newOrder); // Optimistic update
    };

    // Render Widget Item
    const WidgetItem = ({ id }) => {
        let content = null;
        let onClick = null;
        const isSpy = id.startsWith('spy_');

        if (isSpy) onClick = () => openChart(id);

        switch (id) {
            case 'market_status':
                const isOpen = marketData.status === 'OPEN';
                content = (
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <Globe size={12} className="text-gray-500" />
                        <span className="text-gray-400">Market:</span>
                        <span className={`font-bold ${isOpen ? 'text-green-500' : 'text-red-500'}`}>{marketData.status}</span>
                    </div>
                );
                break;
            case 'spy_day':
                const change = marketData.spy.change || 0;
                content = (
                    <div className="flex items-center gap-2 text-xs font-mono cursor-pointer hover:bg-white/5 rounded px-1 transition-colors">
                        <Activity size={12} className="text-gray-500" />
                        <span className="text-gray-400">SPY (Day):</span>
                        <span className={`font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
                    </div>
                );
                break;
            case 'spy_week':
                const changeW = marketData.spy.change1W || 0;
                content = (
                    <div className="flex items-center gap-2 text-xs font-mono cursor-pointer hover:bg-white/5 rounded px-1 transition-colors">
                        <TrendingUp size={12} className="text-gray-500" />
                        <span className="text-gray-400">SPY (Week):</span>
                        <span className={`font-bold ${changeW >= 0 ? 'text-green-400' : 'text-red-400'}`}>{changeW >= 0 ? '+' : ''}{changeW.toFixed(2)}%</span>
                    </div>
                );
                break;
            case 'spy_month':
                const changeM = marketData.spy.change1M || 0;
                content = (
                    <div className="flex items-center gap-2 text-xs font-mono cursor-pointer hover:bg-white/5 rounded px-1 transition-colors">
                        <Calendar size={12} className="text-gray-500" />
                        <span className="text-gray-400">SPY (Month):</span>
                        <span className={`font-bold ${changeM >= 0 ? 'text-green-400' : 'text-red-400'}`}>{changeM >= 0 ? '+' : ''}{changeM.toFixed(2)}%</span>
                    </div>
                );
                break;
            case 'spy_year':
                const changeY = marketData.spy.change1Y || 0;
                content = (
                    <div className="flex items-center gap-2 text-xs font-mono cursor-pointer hover:bg-white/5 rounded px-1 transition-colors">
                        <Trophy size={12} className="text-gray-500" />
                        <span className="text-gray-400">SPY (Year):</span>
                        <span className={`font-bold ${changeY >= 0 ? 'text-green-400' : 'text-red-400'}`}>{changeY >= 0 ? '+' : ''}{changeY.toFixed(2)}%</span>
                    </div>
                );
                break;
            case 'rh_value':
                if (!rhConnected) return null;
                const val = rhData ? rhData.equity_formatted : 'Loading...';
                content = (
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <DollarSign size={12} className="text-gold" />
                        <span className="text-gray-400">Portfolio:</span>
                        <span className="font-bold text-white">{val}</span>
                    </div>
                );
                break;
            case 'rh_day':
                if (!rhConnected) return null;
                const dChange = rhData ? rhData.day_change : 0;
                const dPct = rhData ? rhData.day_change_pct : 0;
                const dColor = dChange >= 0 ? 'text-green-400' : 'text-red-400';
                content = (
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <TrendingUp size={12} className={dColor} />
                        <span className="text-gray-400">Day:</span>
                        <span className={`font-bold ${dColor}`}>
                            {rhData ? `${dChange >= 0 ? '+' : ''}$${Math.abs(dChange).toFixed(2)} (${dPct.toFixed(2)}%)` : '...'}
                        </span>
                    </div>
                );
                break;
            default: return null;
        }

        if (!content) return null;

        return (
            <div onClick={onClick} className={`relative group ${isEditing ? 'border border-dashed border-white/20 p-1 rounded cursor-move' : ''}`}>
                {content}
                {isEditing && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveWidget(id); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-lg hover:scale-110 transition-transform"
                    >
                        <X size={10} />
                    </button>
                )}
            </div>
        );
    };

    if ((widgets.length === 0 || !enabled) && !isEditing) return null;

    return (
        <>
            <motion.div
                layout
                initial={{ y: -20, opacity: 0, width: "auto", borderRadius: 9999 }}
                animate={{
                    y: 0,
                    opacity: 1,
                    width: isMinimized ? 56 : "auto",
                    height: isMinimized ? 56 : (isVertical ? "auto" : 60),
                    borderRadius: 9999
                }}
                transition={{
                    type: "spring",
                    stiffness: 140,
                    damping: 25,
                    mass: 1,
                    layout: { duration: 0.8, type: "spring", stiffness: 140, damping: 25 }
                }}
                onDoubleClick={() => setIsEditing(!isEditing)}
                className={`${positionClass} z-[40] flex items-center justify-center glass-panel
                ${isMinimized ? 'p-0' : (isVertical ? 'py-10 px-6 max-h-[85vh] flex-col' : 'h-[60px] max-w-[90vw] pr-12 flex-row')}
                `}
                style={{ originX: 0.5, borderRadius: 9999 }}
            >
                <AnimatePresence initial={false}>
                    {isMinimized ? (
                        <motion.button
                            key="maximize-btn"
                            initial={{ opacity: 0, scale: 0.5, position: "absolute" }}
                            animate={{ opacity: 1, scale: 1, position: "absolute" }}
                            exit={{ opacity: 0, scale: 0.5, position: "absolute" }}
                            transition={{ duration: 0.3 }}
                            onClick={() => setIsMinimized(false)}
                            className="text-gold hover:text-white transition-colors flex items-center justify-center w-full h-full left-0 top-0"
                        >
                            <Plus size={28} />
                        </motion.button>
                    ) : (
                        <motion.div
                            key="content-container"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4, delay: 0.3 }}
                            className={`flex ${isVertical ? 'flex-col h-full w-full' : 'items-center h-full'}`}
                        >
                            <div className={`flex ${isVertical ? 'flex-col gap-4 overflow-y-auto overflow-x-hidden scrollbar-hide py-2 max-h-[70vh]' : 'items-center gap-6 px-6 overflow-x-auto scrollbar-hide h-full'}`}>
                                {isEditing ? (
                                    <Reorder.Group axis={isVertical ? "y" : "x"} values={widgets} onReorder={handleReorder} className={`flex ${isVertical ? 'flex-col gap-4' : 'items-center gap-6'}`}>
                                        {widgets.map(id => (
                                            <Reorder.Item key={id} value={id}>
                                                <WidgetItem id={id} />
                                            </Reorder.Item>
                                        ))}
                                    </Reorder.Group>
                                ) : (
                                    <div className={`flex ${isVertical ? 'flex-col gap-4' : 'items-center gap-6 whitespace-nowrap'}`}>
                                        {widgets.map(id => <div key={id}><WidgetItem id={id} /></div>)}
                                    </div>
                                )}
                            </div>

                            {!isEditing && (
                                <button
                                    onClick={() => setIsMinimized(true)}
                                    className={`absolute bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-full p-1.5 transition-all outline-none 
                                    ${isVertical ? 'bottom-2 left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2 right-3'}
                                    `}
                                    title="Minimize"
                                >
                                    <Minus size={14} />
                                </button>
                            )}

                            {/* Edit Mode Controls */}
                            <AnimatePresence>
                                {isEditing && (
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        className={`flex items-center gap-2 border-white/10 overflow-hidden ${isVertical ? 'flex-col border-t pt-4 mt-2' : 'border-l pl-4 mr-4'}`}
                                    >
                                        {/* Add Widget Button */}
                                        <div className="relative shrink-0">
                                            <button
                                                onClick={() => setShowAddMenu(!showAddMenu)}
                                                className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 p-1 rounded-full transition-colors flex items-center justify-center border border-purple-500/30"
                                            >
                                                <Plus size={16} />
                                            </button>

                                            {/* Add Menu Dropdown */}
                                            {showAddMenu && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                                                    <div className="p-2 text-xs font-bold text-gray-500 uppercase">Add Widget</div>
                                                    {availableWidgets.length > 0 ? (
                                                        availableWidgets.map(w => (
                                                            <button
                                                                key={w.id}
                                                                onClick={() => handleAddWidget(w.id)}
                                                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-2"
                                                            >
                                                                <Plus size={12} /> {w.label}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="px-3 py-2 text-xs text-gray-500 italic">No more widgets</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Exit Edit Mode */}
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="bg-green-500/20 hover:bg-green-500/40 text-green-400 p-1 rounded-full transition-colors flex items-center justify-center border border-green-500/30 shrink-0"
                                        >
                                            <Check size={16} />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* CHART MODAL */}
            <AnimatePresence>
                {chartConfig && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setChartConfig(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-panel border-white/10 rounded-2xl p-6 w-[90vw] max-w-4xl shadow-2xl relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={() => setChartConfig(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>

                            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <Activity className="text-gold" />
                                {chartConfig.ticker} Performance
                            </h3>
                            <div className="flex gap-2 mb-6">
                                {['1d', '1w', '1m', '1y'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => openChart(chartConfig.metricId, r)}
                                        className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${chartConfig.range === r ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>

                            <div className="h-[400px] w-full bg-black/20 rounded-xl border border-white/5 p-4 relative flex flex-col">
                                {/* Loader Overlay - Only show if we don't have data, or show as overlay? 
                                    Better to overlay so chart doesn't disappear if we have old data. 
                                */}
                                {loadingChart && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/10 backdrop-blur-[2px] rounded-xl transition-all duration-300">
                                        <Loader2 size={40} className="text-purple-500 animate-spin" />
                                    </div>
                                )}

                                <div style={{ width: '100%', height: '100%', minHeight: 0 }}>
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis
                                                    dataKey="time"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#6b7280', fontSize: 10 }}
                                                    tickFormatter={(str) => {
                                                        const d = new Date(str);
                                                        if (chartConfig.range === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                                    }}
                                                />
                                                <YAxis
                                                    hide
                                                    domain={['auto', 'auto']}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem' }}
                                                    itemStyle={{ color: '#e5e7eb' }}
                                                    labelFormatter={(label) => new Date(label).toLocaleString()}
                                                    formatter={(val) => [`$${parseFloat(val).toFixed(2)}`, 'Price']}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="value"
                                                    stroke="#8b5cf6"
                                                    strokeWidth={2}
                                                    fill="url(#chartGradient)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        !loadingChart && (
                                            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                                No Data Available
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default FloatingHeader;
