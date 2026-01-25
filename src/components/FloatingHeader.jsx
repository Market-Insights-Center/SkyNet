import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, DollarSign, Globe, Trophy } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const FloatingHeader = () => {
    const { currentUser } = useAuth();
    const [widgets, setWidgets] = useState([]);
    const [rhConnected, setRhConnected] = useState(false);
    const [marketData, setMarketData] = useState({
        spy: { price: 0, change: 0 },
        status: 'CLOSED'
    });
    const [rhData, setRhData] = useState(null);

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

    // Helper to render widget content
    const renderWidget = (id) => {
        switch (id) {
            case 'market_status':
                const isOpen = marketData.status === 'OPEN';
                return (
                    <div key={id} className="flex items-center gap-2 text-xs font-mono">
                        <Globe size={12} className="text-gray-500" />
                        <span className="text-gray-400">Market:</span>
                        <span className={`font-bold ${isOpen ? 'text-green-500' : 'text-red-500'}`}>{marketData.status}</span>
                    </div>
                );
            case 'spy_day':
                const change = marketData.spy.change || 0;
                return (
                    <div key={id} className="flex items-center gap-2 text-xs font-mono">
                        <Activity size={12} className="text-gray-500" />
                        <span className="text-gray-400">SPY (Day):</span>
                        <span className={`font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                    </div>
                );
            case 'spy_week':
                const changeW = marketData.spy.change1W || 0;
                return (
                    <div key={id} className="flex items-center gap-2 text-xs font-mono">
                        <TrendingUp size={12} className="text-gray-500" />
                        <span className="text-gray-400">SPY (Week):</span>
                        <span className={`font-bold ${changeW >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {changeW >= 0 ? '+' : ''}{changeW.toFixed(2)}%
                        </span>
                    </div>
                );
            case 'rh_value':
                if (!rhConnected) return null;
                const val = rhData ? rhData.equity_formatted : 'Loading...';
                return (
                    <div key={id} className="flex items-center gap-2 text-xs font-mono">
                        <DollarSign size={12} className="text-gold" />
                        <span className="text-gray-400">Portfolio:</span>
                        <span className="font-bold text-white">{val}</span>
                    </div>
                );
            case 'rh_day':
                if (!rhConnected) return null;
                const dChange = rhData ? rhData.day_change : 0;
                const dPct = rhData ? rhData.day_change_pct : 0;
                const dColor = dChange >= 0 ? 'text-green-400' : 'text-red-400';
                return (
                    <div key={id} className="flex items-center gap-2 text-xs font-mono">
                        <TrendingUp size={12} className={dColor} />
                        <span className="text-gray-400">Day:</span>
                        <span className={`font-bold ${dColor}`}>
                            {rhData ? `${dChange >= 0 ? '+' : ''}$${Math.abs(dChange).toFixed(2)} (${dPct.toFixed(2)}%)` : '...'}
                        </span>
                    </div>
                );
            default:
                return null;
        }
    };

    if (widgets.length === 0) return null;

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed top-32 left-1/2 -translate-x-1/2 z-[40] flex items-center gap-6 px-6 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl w-max max-w-[90vw] overflow-x-auto scrollbar-none"
        >
            {widgets.map(id => renderWidget(id))}
        </motion.div>
    );
};

export default FloatingHeader;
