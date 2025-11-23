import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { User } from 'lucide-react';

const Layout = ({ children }) => {
    const location = useLocation();
    const { currentUser } = useAuth();

    const navItems = [
        { name: 'Portfolio Lab', path: '/' },
        { name: 'Custom Builder', path: '/custom' },
        { name: 'Quick Invest', path: '/invest' },
        { name: 'Cultivate', path: '/cultivate' },
        { name: 'Portfolio Tracker', path: '/tracking' },
    ];

    return (
        <div className="min-h-screen bg-deep-black text-white font-sans selection:bg-gold selection:text-black">
            {/* Navigation Bar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-deep-black/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex-shrink-0">
                            <Link to="/" className="text-xl font-bold tracking-wider text-white">
                                M.I.C. <span className="text-gold">SINGULARITY</span>
                            </Link>
                        </div>
                        <div className="hidden md:block">
                            <div className="ml-10 flex items-center space-x-4">
                                {navItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${isActive ? 'text-gold' : 'text-gray-300 hover:text-white'
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
                                    <Link
                                        to="/profile"
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${location.pathname === '/profile' ? 'text-gold' : 'text-gray-300 hover:text-white'}`}
                                    >
                                        <User size={16} />
                                        {currentUser.displayName || "Profile"}
                                    </Link>
                                ) : (
                                    <div className="flex items-center space-x-4">
                                        <Link
                                            to="/login"
                                            className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
                                        >
                                            Log In
                                        </Link>
                                        <Link
                                            to="/signup"
                                            className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/50 px-4 py-2 rounded-md text-sm font-medium transition-all"
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

            {/* Main Content - CHANGED: overflow-hidden to overflow-x-hidden to allow vertical scrolling */}
            <main className="pt-16 min-h-screen relative overflow-x-hidden">
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
