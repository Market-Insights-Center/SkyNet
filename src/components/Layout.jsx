import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { User, Search, Home, Briefcase, MessageSquare, Users, Command, Shield, Menu, X, Zap } from 'lucide-react';

import LiquidBackground from './LiquidBackground';
import PillNav from './PillNav';
import HealthStatus from './HealthStatus';
import FloatingHeader from './FloatingHeader';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const searchRef = useRef(null);
    const [hasUnread, setHasUnread] = useState(false);

    const [isMod, setIsMod] = useState(false);

    // --- SECURITY FIX: Robust Admin Check ---
    // --- SECURITY FIX: Robust Admin Check ---
    // --- SECURITY FIX: Robust Admin Check ---
    useEffect(() => {
        if (currentUser && currentUser.email) {
            fetch('/api/mods')
                .then(res => res.json())
                .then(data => {
                    const userEmail = currentUser.email.toLowerCase();
                    const modsList = data.mods.map(m => m.toLowerCase());

                    if (modsList.includes(userEmail)) {
                        setIsMod(true);
                    } else {
                        setIsMod(false);
                    }
                })
                .catch(err => {
                    console.error("Error checking mods:", err);
                    // Maintain previous state on error
                });
        } else {
            setIsMod(false);
        }
    }, [currentUser?.email]); // Update only when EMAIL changes, not other User properties

    // To strictly follow "test tier options should always be visible to admins", 
    // we can memoize the check or trust the token. But this fetch is fine IF currentUser.email is stable.
    // The "overrideUserTier" creates a NEW object. This triggers this effect.
    // If the new object has the SAME email, the fetch happens again. 
    // If the fetch returns fast, it sets isMod=true again.
    // If it returns slow, there might be a flicker.
    // Ideally we shouldn't fetch if email hasn't changed.

    // Check for unread messages
    useEffect(() => {
        if (!currentUser) return;

        const checkUnread = async () => {
            try {
                const res = await fetch(`/api/chat/list?email=${currentUser.email}`);
                if (res.ok) {
                    const chats = await res.json();
                    let unreadFound = false;
                    for (const chat of chats) {
                        if (chat.last_updated) {
                            const lastRead = chat.last_read && chat.last_read[currentUser.email];
                            if (!lastRead) {
                                unreadFound = true;
                                break;
                            }
                            if (new Date(chat.last_updated) > new Date(lastRead)) {
                                unreadFound = true;
                                break;
                            }
                        }
                    }
                    setHasUnread(unreadFound);
                }
            } catch (e) {
                console.error("Unread check failed", e);
            }
        };

        checkUnread();
        const interval = setInterval(checkUnread, 10000); // Check every 10 seconds
        return () => clearInterval(interval);

    }, [currentUser]);

    // Heartbeat for Active Status
    useEffect(() => {
        if (!currentUser?.email) return;

        const sendHeartbeat = () => {
            if (document.hidden) return; // Don't ping if tab hidden
            fetch('/api/user/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email })
            }).catch(err => console.error("Heartbeat failed", err));
        };

        sendHeartbeat(); // Immediate
        const interval = setInterval(sendHeartbeat, 30000); // Every 30s
        return () => clearInterval(interval);
    }, [currentUser]);

    const navItems = React.useMemo(() => [
        { name: 'Home', path: '/', icon: Home },
        { name: 'Products', path: '/products', icon: Briefcase },
        { name: 'Forum', path: '/forum', icon: Users },
        { name: 'Chatbox', path: '/chat', icon: MessageSquare, hasNotification: hasUnread },
        { name: 'Profile', path: '/profile', icon: User },
        // Only render Admin tab if explicitly authorized
        ...(isMod ? [
            { name: 'Admin', path: '/admin', icon: Shield },
            // { name: 'Singularity', path: '/singularity', icon: Zap }
        ] : [])
    ], [hasUnread, isMod]);

    const searchableItems = [
        { name: 'Home', path: '/', type: 'Page' },
        { name: 'Products', path: '/products', type: 'Page' },
        { name: 'Portfolio Lab', path: '/portfolio-lab', type: 'Product' },
        { name: 'Cultivate', path: '/cultivate', type: 'Command' },
        { name: 'Invest', path: '/invest', type: 'Command' },
        { name: 'Custom Strategy', path: '/custom', type: 'Command' },
        { name: 'Tracking', path: '/tracking', type: 'Command' },
        { name: 'Profile', path: '/profile', type: 'Page' },
        { name: 'Chatbox', path: '/chat', type: 'Page' },
        // Hide from search results too
        ...(isMod ? [{ name: 'Admin Dashboard', path: '/admin', type: 'Page' }] : []),
        { name: 'Login', path: '/login', type: 'Auth' },
        { name: 'Sign Up', path: '/signup', type: 'Auth' },
    ];

    const filteredItems = searchableItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (filteredItems.length > 0) {
            navigate(filteredItems[0].path);
            setShowSuggestions(false);
            setSearchQuery('');
        }
    };

    const handleSelect = (path) => {
        navigate(path);
        setShowSuggestions(false);
        setSearchQuery('');
    };

    const pillItems = React.useMemo(() => [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Forum', href: '/forum' },
        { label: 'Chatbox', href: '/chat', hasNotification: hasUnread },
        { label: 'Profile', href: '/profile' },
        ...(isMod ? [
            { label: 'Admin', href: '/admin' },
            // { label: 'Singularity', href: '/singularity' }
        ] : []),
        ...(currentUser ? [] : [
            { label: 'Log In', href: '/login' },
            { label: 'Sign Up', href: '/signup' }
        ])
    ], [isMod, currentUser, hasUnread]);

    return (
        <div className="min-h-screen bg-deep-black text-white font-sans selection:bg-gold selection:text-black">
            {/* Liquid Background - Enhanced Glass Feel */}
            <LiquidBackground />

            {/* Floating Global Header */}
            <FloatingHeader />

            {/* Navigation Bar */}
            <div className="fixed top-0 left-0 right-0 z-50">
                <PillNav
                    logo="/logo.jpg"
                    logoAlt="M.I.C. Singularity"
                    items={pillItems}
                    activeHref={location.pathname}
                    baseColor="#ccc"
                    pillColor="#000000CC" // Semi-transparent black
                    pillTextColor="#fff"
                    hoveredPillTextColor="#000"
                    currentUser={currentUser}
                    isMod={isMod}
                >
                    {/* Search Bar - Injected into PillNav */}
                    <div className="relative group mr-8" ref={searchRef}>
                        <form onSubmit={handleSearch} className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-gray-400 group-focus-within:text-gold transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                className="bg-white/5 border border-white/10 text-gray-300 text-sm rounded-full focus:ring-1 focus:ring-gold focus:border-gold block w-32 md:w-48 pl-10 p-2.5 transition-all focus:w-48 md:focus:w-64 outline-none"
                            />
                        </form>

                        {/* Autocomplete Dropdown */}
                        <AnimatePresence>
                            {showSuggestions && searchQuery && filteredItems.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[200px]"
                                >
                                    {filteredItems.map((item, index) => (
                                        <div
                                            key={index}
                                            onClick={() => handleSelect(item.path)}
                                            className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
                                        >
                                            {item.type === 'Command' ? <Command size={14} className="text-gold" /> :
                                                item.type === 'Product' ? <Briefcase size={14} className="text-purple-400" /> :
                                                    <Search size={14} className="text-gray-500" />}
                                            <div>
                                                <div className="text-sm font-medium text-white">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.type}</div>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </PillNav>
            </div>

            {/* Main Content */}
            <main className="pt-24 md:pt-20 min-h-screen relative overflow-x-hidden">
                <div className="relative z-10">
                    {children}
                </div>
            </main>

            <HealthStatus />
        </div>
    );
};

export default Layout;