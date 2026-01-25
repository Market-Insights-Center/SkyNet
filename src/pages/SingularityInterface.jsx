import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Activity, Wifi, Zap, Lock, Cpu, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Placeholder imports for sub-components we are about to build
import SingularityStream from '../components/SingularityStream';
import SingularityCanvas from '../components/SingularityCanvas';

const SingularityInterface = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('ANALYST'); // ANALYST (Prometheus) | GOVERNOR (Kronos)
    const [isMod, setIsMod] = useState(false);

    // Stubbed Backend Status (Would likely come from a context or hook in real integration)
    // Dynamic System Status
    const [systemStatus, setSystemStatus] = useState({
        online: true,
        latency: 42,
        activeTask: 'Prometheus: Monitoring Global Tickers...',
        marketStatus: 'CLOSED', // Default
        pnl: 12450.32
    });

    useEffect(() => {
        const checkMarketStatus = () => {
            const now = new Date();
            // Convert to EST (New York Time)
            const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
            const day = estTime.getDay(); // 0 = Sun, 6 = Sat
            const hour = estTime.getHours();
            const minute = estTime.getMinutes();

            // Market Hours: 9:30 AM - 4:00 PM EST, Mon-Fri
            const isWeekday = day >= 1 && day <= 5;
            const isOpen = isWeekday && (
                (hour > 9 && hour < 16) ||
                (hour === 9 && minute >= 30)
            );

            setSystemStatus(prev => ({
                ...prev,
                marketStatus: isOpen ? 'OPEN' : 'CLOSED',
                latency: Math.floor(Math.random() * 20) + 30 // Simulate slight jitter
            }));
        };

        checkMarketStatus();
        const interval = setInterval(checkMarketStatus, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    // --- SECURITY: Admin Check ---
    useEffect(() => {
        if (!currentUser) return;
        fetch('/api/mods')
            .then(res => res.json())
            .then(data => {
                const userEmail = currentUser.email.toLowerCase();
                const modsList = data.mods.map(m => m.toLowerCase());
                if (!modsList.includes(userEmail)) {
                    navigate('/');
                } else {
                    setIsMod(true);
                }
            })
            .catch(() => navigate('/'));
    }, [currentUser, navigate]);

    if (!isMod) return null; // Logic prevents render until verified

    return (
        <div className="h-screen w-full bg-[#050510] text-[#e0e0ff] font-mono overflow-hidden flex flex-col relative selection:bg-cyan-500/30">

            {/* --- BACKGROUND AMBIENCE --- */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className={`absolute top-0 left-0 w-full h-full opacity-20 transition-colors duration-1000 ${mode === 'ANALYST' ? 'bg-gradient-to-br from-cyan-900/40 via-transparent to-black' : 'bg-gradient-to-br from-amber-900/40 via-transparent to-black'}`} />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
            </div>

            {/* --- HEADER --- */}
            <header className="h-14 border-b border-white/5 bg-[#050510]/80 backdrop-blur-md flex items-center justify-between px-6 z-20 relative shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Cpu className={`w-5 h-5 ${mode === 'ANALYST' ? 'text-cyan-400' : 'text-amber-500'}`} />
                        <h1 className="font-bold tracking-widest text-sm text-white">
                            SINGULARITY <span className="opacity-50">V1.0</span>
                        </h1>
                    </div>
                </div>

                {/* MODE SWITCHER */}
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                    <button
                        onClick={() => setMode('ANALYST')}
                        className={`px-4 py-1 text-xs font-bold rounded transition-all duration-300 ${mode === 'ANALYST' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        PROMETHEUS
                    </button>
                    <button
                        onClick={() => setMode('GOVERNOR')}
                        className={`px-4 py-1 text-xs font-bold rounded transition-all duration-300 ${mode === 'GOVERNOR' ? 'bg-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        KRONOS
                    </button>
                </div>

                <div className="flex items-center gap-6 text-xs font-bold text-gray-500">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-green-500">SYSTEM STABLE</span>
                    </div>
                </div>
            </header>

            {/* --- MAIN SPLIT VIEW --- */}
            <main className="flex-1 flex overflow-hidden relative z-10">

                {/* LEFT: NEURAL STREAM */}
                <section className="w-[450px] shrink-0 border-r border-white/5 bg-black/20 flex flex-col relative z-20">
                    <SingularityStream mode={mode} />
                </section>

                {/* RIGHT: CANVAS */}
                <section className="flex-1 relative overflow-hidden bg-black/50">
                    <SingularityCanvas mode={mode} />
                </section>

            </main>

            {/* --- LIVE PULSE STATUS BAR --- */}
            <SingularityFooter
                systemStatus={systemStatus}
                isMod={isMod}
                currentUser={currentUser}
            />
        </div>
    );
};

const WIDGET_OPTIONS = [
    { id: 'market_status', label: 'Market Status', icon: Globe },
    { id: 'spy_day', label: 'SPY (Day)', icon: Activity },
    { id: 'spy_week', label: 'SPY (Week)', icon: Zap },
    { id: 'rh_value', label: 'Portfolio Value', icon: Lock, requiresAuth: true },
    { id: 'rh_day', label: 'Portfolio (Day)', icon: Cpu, requiresAuth: true },
];

const SingularityFooter = ({ systemStatus, isMod, currentUser }) => {
    const [widgets, setWidgets] = useState(['market_status', 'rh_value']);
    const [showMenu, setShowMenu] = useState(false);
    const [rhConnected, setRhConnected] = useState(false);
    const [rhData, setRhData] = useState(null);

    // Sync Settings & Fetch Data
    useEffect(() => {
        if (!currentUser) return;

        // 1. Settings Listener
        const docRef = doc(db, "users", currentUser.email);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.settings?.singularity_widgets) {
                    setWidgets(data.settings.singularity_widgets);
                }
                if (data.integrations?.robinhood?.connected) {
                    setRhConnected(true);
                } else {
                    setRhConnected(false);
                    setRhData(null);
                }
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // 2. Fetch RH Data if connected (separate effect to control frequency)
    useEffect(() => {
        if (!rhConnected || !currentUser) return;

        const fetchRhData = async () => {
            try {
                const rhRes = await fetch('/api/market-data/robinhood', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUser.email })
                });
                const rhJson = await rhRes.json();
                if (rhJson.status === 'success') {
                    setRhData(rhJson.data);
                }
            } catch (e) {
                console.error("Footer RH Fetch Error", e);
            }
        };

        fetchRhData();
        const interval = setInterval(fetchRhData, 60000);
        return () => clearInterval(interval);
    }, [rhConnected, currentUser]);

    const toggleWidget = async (id) => {
        const newWidgets = widgets.includes(id)
            ? widgets.filter(w => w !== id)
            : [...widgets, id].slice(0, 4);

        setWidgets(newWidgets);

        if (currentUser) {
            await setDoc(doc(db, "users", currentUser.email), {
                settings: { singularity_widgets: newWidgets }
            }, { merge: true });
        }
    };

    return (
        <footer className="h-8 border-t border-white/5 bg-[#020205] flex items-center justify-between px-4 text-[10px] uppercase tracking-wider text-gray-400 z-50 shrink-0 relative">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-green-500/80">
                    <Wifi size={10} />
                    <span>ONLINE ({systemStatus.latency}ms)</span>
                </div>
            </div>

            {/* Right side with Widgets */}
            <div className="flex items-center gap-6 bg-[#020205] pl-4 pr-16 relative">

                {/* Widget Render Loop */}
                {widgets.map(id => {
                    const def = WIDGET_OPTIONS.find(o => o.id === id);
                    if (!def) return null;
                    if (def.requiresAuth && !rhConnected) return null;

                    let display = "--";
                    let color = "text-gray-400";
                    let isValue = false;

                    if (id === 'market_status') {
                        display = systemStatus.marketStatus;
                        color = systemStatus.marketStatus === 'OPEN' ? 'text-green-500' : 'text-red-500';
                    }
                    else if (id === 'rh_value') {
                        display = rhData ? rhData.equity_formatted : 'Loading...';
                        color = "text-gold";
                        isValue = true;
                    }
                    else if (id === 'rh_day') {
                        const dChange = rhData ? rhData.day_change : 0;
                        const dPct = rhData ? rhData.day_change_pct : 0;
                        color = dChange >= 0 ? 'text-green-400' : 'text-red-400';
                        display = rhData ? `${dChange >= 0 ? '+' : ''}$${Math.abs(dChange).toFixed(2)} (${dPct.toFixed(2)}%)` : 'Loading...';
                    }
                    else if (id === 'spy_day') {
                        display = "+0.45%"; color = "text-green-400";
                    }

                    const Icon = def.icon;
                    return (
                        <div key={id} className="flex items-center gap-2">
                            <Icon size={10} />
                            <span className={isValue ? `blur-0 transition-all text-gold` : ""}>
                                <span className={color}>{def.label === 'Market Status' ? `MARKET: ${display}` : display}</span>
                            </span>
                        </div>
                    );
                })}

                {/* Settings Trigger */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-1 hover:text-white transition-colors"
                    >
                        <Cpu size={12} />
                    </button>

                    {/* Popover Menu */}
                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-full right-0 mb-2 w-48 bg-[#0c0c16] border border-white/10 rounded-lg shadow-xl p-2 z-[60]"
                            >
                                <div className="text-[10px] font-bold text-gray-500 mb-2 px-2">FOOTER WIDGETS</div>
                                {WIDGET_OPTIONS.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => toggleWidget(opt.id)}
                                        disabled={opt.requiresAuth && !rhConnected}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 text-[10px] ${widgets.includes(opt.id) ? 'text-cyan-400' : 'text-gray-400'} ${opt.requiresAuth && !rhConnected ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <opt.icon size={10} />
                                            {opt.label}
                                        </div>
                                        {widgets.includes(opt.id) && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </footer>
    );
};

export default SingularityInterface;
