import React, { useState, useEffect } from 'react';
import { Search, Download, Heart, Share2, GitBranch, Zap, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';

/**
 * AutomationMarket
 * Community marketplace for sharing capabilities.
 */
const AutomationMarket = () => {
    const { userProfile } = useAuth();
    const [filter, setFilter] = useState('popular'); // popular, new, official
    const [search, setSearch] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock API Call
        const fetchMarket = async () => {
            await new Promise(r => setTimeout(r, 800)); // Sim network
            setItems([
                { id: 1, name: "Volatility Scalper", author: "QuantMaster", downloads: 1205, likes: 340, tags: ["Risk", "Scalping"], desc: "High-frequency configuration for volatile assets using RSI + Bollinger Bands." },
                { id: 2, name: "Blue Chip DCA", author: "SafeHands", downloads: 850, likes: 120, tags: ["Investment", "Passive"], desc: "Automated Dollar Cost Averaging into top 5 SP500 holdings on dips." },
                { id: 3, name: "Crypto Sentinel", author: "SatoshiVision", downloads: 2100, likes: 890, tags: ["Crypto", "Sentinel"], desc: "Uses Sentinel AI to monitor sentiment and flash-crash indicators for BTC/ETH." },
                { id: 4, name: "Earnings Play", author: "WallStBets", downloads: 400, likes: 50, tags: ["Event", "High Risk"], desc: "Automated entry 3 days before earnings with tight stop losses." },
                { id: 5, name: "M.I.C. Official Def.", author: "System", downloads: 5000, likes: 2000, tags: ["Official", "Defensive"], desc: "Standard defensive rotation wrapper provided by M.I.C." },
                { id: 6, name: "Tesla Trend Follow", author: "ElonFan", downloads: 600, likes: 150, tags: ["Trend", "TSLA"], desc: "Specific logic for trading TSLA momentum bursts." }
            ]);
            setLoading(false);
        };
        fetchMarket();
    }, []);

    const filteredItems = items.filter(i =>
        (filter === 'all' || (filter === 'official' ? i.author === 'System' : true)) &&
        (i.name.toLowerCase().includes(search.toLowerCase()) || i.desc.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => {
        if (filter === 'popular') return b.downloads - a.downloads;
        if (filter === 'new') return b.id - a.id;
        return 0;
    });

    return (
        <div className="min-h-screen bg-deep-black text-white font-sans selection:bg-purple-500 selection:text-white">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold mb-4 tracking-tight">Workflow <span className="text-purple-500">Marketplace</span></h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Discover, share, and deploy battle-tested automation strategies from the community and M.I.C. team.
                    </p>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col md:flex-row gap-6 justify-between items-center mb-12 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search strategies..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>
                    <div className="flex gap-2 bg-black/30 p-1 rounded-xl">
                        {['popular', 'new', 'official'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-2 rounded-lg font-bold capitalize transition-all ${filter === f ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
                            ))
                        ) : filteredItems.map(item => (
                            <MarketCard key={item.id} item={item} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            <Footer />
        </div>
    );
};

const MarketCard = ({ item }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -5 }}
            className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300"
        >
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${item.author === 'System' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {item.author === 'System' ? <Zap size={24} /> : <GitBranch size={24} />}
                    </div>
                    <div className="flex gap-2">
                        {item.tags.map(t => (
                            <span key={t} className="text-[10px] uppercase font-bold bg-white/5 px-2 py-1 rounded text-gray-400 border border-white/5">{t}</span>
                        ))}
                    </div>
                </div>

                <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">{item.name}</h3>
                <p className="text-gray-400 text-sm mb-6 line-clamp-2 min-h-[40px]">{item.desc}</p>

                <div className="flex items-center gap-4 text-xs font-mono text-gray-500 mb-6">
                    <span className="flex items-center gap-1"><User size={12} /> {item.author}</span>
                    <span className="flex items-center gap-1"><Download size={12} /> {item.downloads}</span>
                    <span className="flex items-center gap-1"><Heart size={12} /> {item.likes}</span>
                </div>

                <button className="w-full py-3 rounded-xl bg-white/5 hover:bg-purple-600 hover:text-white text-gray-300 font-bold transition-all flex items-center justify-center gap-2 border border-white/5 hover:border-purple-500">
                    <Download size={18} /> Import Workflow
                </button>
            </div>
        </motion.div>
    );
};

export default AutomationMarket;
