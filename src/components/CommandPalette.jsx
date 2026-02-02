import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Monitor, TrendingUp, User, Globe, Activity, Shield, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const inputRef = useRef(null);

    // Toggle with Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 10);
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    const actions = [
        // --- Core Navigation ---
        { id: 'dashboard', label: 'Dashboard / Home', icon: Monitor, path: '/' },
        { id: 'products', label: 'All Products', icon: Globe, path: '/products' },
        { id: 'profile', label: 'User Profile', icon: User, path: '/profile' },
        { id: 'help', label: 'Help & Documentation', icon: Shield, path: '/help' },
        { id: 'about', label: 'About Orion', icon: Shield, path: '/about' },

        // --- AI & Analysis Tools ---
        { id: 'sentinel', label: 'Sentinel AI', icon: Shield, path: '/sentinel-ai' },
        { id: 'asset-evaluator', label: 'Asset Evaluator', icon: TrendingUp, path: '/asset-evaluator' },
        { id: 'quickscore', label: 'Quickscore', icon: Activity, path: '/asset-evaluator' },
        { id: 'ml-forecast', label: 'ML Forecast', icon: TrendingUp, path: '/asset-evaluator' },
        { id: 'breakout', label: 'Breakout Analysis', icon: Activity, path: '/asset-evaluator' },
        { id: 'risk', label: 'Risk Analysis', icon: Shield, path: '/asset-evaluator' },
        { id: 'sentiment', label: 'Sentiment Analysis', icon: Activity, path: '/asset-evaluator' },
        { id: 'powerscore', label: 'Powerscore', icon: TrendingUp, path: '/asset-evaluator' },

        // --- Market Intelligence ---
        { id: 'market-junction', label: 'Market Junction', icon: Globe, path: '/market-junction' },
        { id: 'briefing', label: 'Market Briefing', icon: Activity, path: '/market-junction' },
        { id: 'predictions', label: 'Orion Market Predictions', icon: Activity, path: '/market-predictions' },
        { id: 'news', label: 'News Feed', icon: Globe, path: '/news' },

        // --- Portfolio Management ---
        { id: 'portfolio-lab', label: 'Portfolio Lab', icon: Monitor, path: '/portfolio-lab' },
        { id: 'nexus', label: 'Portfolio Nexus', icon: TrendingUp, path: '/portfolio-nexus' },
        { id: 'performance', label: 'Performance Stream', icon: Activity, path: '/performance-stream' },
        { id: 'cultivate', label: 'Cultivate / Allocate', icon: TrendingUp, path: '/cultivate' },
        { id: 'tracking', label: 'Tracking / Research', icon: Activity, path: '/tracking' },

        // --- Strategy & Comparison ---
        { id: 'strategy', label: 'Strategy Ranking', icon: TrendingUp, path: '/strategy-ranking' },
        { id: 'matrix', label: 'Comparison Matrix', icon: Activity, path: '/products/comparison-matrix' },

        // --- Knowledge & Learning ---
        { id: 'knowledge', label: 'Knowledge Stream', icon: Globe, path: '/knowledge-stream' },
        { id: 'custom', label: 'Custom Knowledge', icon: Monitor, path: '/custom' },
        { id: 'invest', label: 'Investment Research', icon: TrendingUp, path: '/invest' },

        // --- Community & Social ---
        { id: 'social', label: 'Community Forum', icon: User, path: '/forum' },
        { id: 'ideas', label: 'Trade Ideas', icon: TrendingUp, path: '/ideas' },

        // --- Data & Automation ---
        { id: 'database-lab', label: 'Database Lab', icon: Monitor, path: '/database-lab' },
        { id: 'automation', label: 'Workflow Automation (Medulla)', icon: Monitor, path: '/workflow-automation' },
    ];

    const filteredActions = actions.filter(action =>
        action.label.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (action) => {
        if (action.path) {
            navigate(action.path);
        } else if (action.action) {
            action.action();
        }
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredActions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredActions[selectedIndex]) {
                handleSelect(filteredActions[selectedIndex]);
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-lg bg-gray-900/90 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                    >
                        <div className="flex items-center px-4 py-3 border-b border-white/10">
                            <Search className="w-5 h-5 text-gray-400 mr-3" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a command or search..."
                                className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-lg"
                            />
                            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                                <span className="font-sans">ESC</span>
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto py-2">
                            {filteredActions.length === 0 ? (
                                <div className="px-4 py-8 text-center text-gray-500">
                                    No results found.
                                </div>
                            ) : (
                                filteredActions.map((action, index) => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleSelect(action)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${index === selectedIndex ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {React.createElement(action.icon, { size: 18, className: index === selectedIndex ? 'text-gold' : 'text-gray-500' })}
                                            <span className={index === selectedIndex ? 'font-medium' : ''}>{action.label}</span>
                                        </div>
                                        {index === selectedIndex && (
                                            <ArrowRight size={16} className="text-gray-500 opacity-50" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="bg-white/5 px-4 py-2 text-[10px] text-gray-500 flex justify-between uppercase tracking-wider font-bold">
                            <span>Orion OS v2.0</span>
                            <div className="flex gap-3">
                                <span>↑↓ to navigate</span>
                                <span>↵ to select</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;
