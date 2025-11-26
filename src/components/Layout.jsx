import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { User, Search, Home, Briefcase, MessageSquare, Users, Mail, Command, Shield } from 'lucide-react';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef(null);

    const [isMod, setIsMod] = useState(false);

    useEffect(() => {
        if (currentUser) {
            fetch('http://localhost:8001/api/mods')
                .then(res => res.json())
                .then(data => {
                    if (data.mods.includes(currentUser.email)) {
                        setIsMod(true);
                    }
                })
                .catch(err => console.error("Error checking mods:", err));
        }
    }, [currentUser]);

    const navItems = [
        { name: 'Home', path: '/', icon: Home },
        { name: 'Products', path: '/products', icon: Briefcase },
        { name: 'Forum', path: '/forum', icon: Users },
        { name: 'Knowledge Stream', path: '/knowledge-stream', icon: FileText },
        { name: 'Direct M.I.C.', path: '/messages', icon: Mail },
        { name: 'Profile', path: '/profile', icon: User },
        ...(isMod ? [{ name: 'Admin', path: '/admin', icon: Shield }] : [])
    ];

    const searchableItems = [
        { name: 'Home', path: '/', type: 'Page' },
        { name: 'Products', path: '/products', type: 'Page' },
        { name: 'Portfolio Lab', path: '/portfolio-lab', type: 'Product' },
        { name: 'Cultivate', path: '/cultivate', type: 'Command' },
        { name: 'Invest', path: '/invest', type: 'Command' },
        { name: 'Custom Strategy', path: '/custom', type: 'Command' },
        { name: 'Tracking', path: '/tracking', type: 'Command' },
        { name: 'Profile', path: '/profile', type: 'Page' },
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

    return (
        <div className="min-h-screen bg-deep-black text-white font-sans selection:bg-gold selection:text-black">
            {/* Navigation Bar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-deep-black/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center">
                            <Link to="/" className="text-xl font-bold tracking-wider text-white flex items-center gap-2">
                                M.I.C. <span className="text-gold">SINGULARITY</span>
                            </Link>
                        </div>

                        {/* Right Side: Search + Menu */}
                        <div className="hidden md:flex items-center gap-6">
                            {/* Search Bar */}
                            <div className="relative group" ref={searchRef}>
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
                                        className="bg-white/5 border border-white/10 text-gray-300 text-sm rounded-full focus:ring-1 focus:ring-gold focus:border-gold block w-48 pl-10 p-2.5 transition-all focus:w-64 outline-none"
                                    />
                                </form>

                                {/* Autocomplete Dropdown */}
                                <AnimatePresence>
                                    {showSuggestions && searchQuery && filteredItems.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
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

                            {/* Menu Items */}
                            <div className="flex items-center space-x-1">
                                {navItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 flex items-center gap-2 ${isActive ? 'text-gold' : 'text-gray-300 hover:text-white'
                                                }`}
                                        >
                                            {item.name}
                                            {isActive && (
                                                <motion.div
                                                    layoutId="nav-underline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold"
                                                    initial={false}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                />
                                            )}
                                        </Link>
                                    );
                                })}

                                <div className="h-6 w-px bg-white/10 mx-2" />

                                {currentUser ? (
                                    <div className="flex items-center gap-2 text-gray-300">
                                        <span className="text-sm">{currentUser.displayName}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <Link
                                            to="/login"
                                            className="text-gray-300 hover:text-white text-sm font-medium transition-colors px-3 py-2"
                                        >
                                            Log In
                                        </Link>
                                        <Link
                                            to="/signup"
                                            className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/50 px-4 py-2 rounded-full text-sm font-medium transition-all"
                                        >
                                            Sign Up
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-20 min-h-screen relative overflow-x-hidden">
                {/* Background Elements */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-royal-purple/20 rounded-full blur-[128px]" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/10 rounded-full blur-[128px]" />
                </div>

                <div className="relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
