import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, TrendingUp, Users } from 'lucide-react';
import NewsFeed from '../components/NewsFeed';

const Forum = () => {
    const [stats, setStats] = React.useState({
        total_users: 0,
        active_users: 0,
        total_posts: 0
    });

    React.useEffect(() => {
        fetch('http://localhost:8000/api/stats')
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error("Error fetching stats:", err));
    }, []);

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl font-bold mb-4"
                    >
                        M.I.C. <span className="text-gold">FORUM</span>
                    </motion.h1>
                    <p className="text-xl text-gray-400">Join the conversation and stay ahead of the market.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h3 className="text-gold font-bold mb-4 flex items-center">
                                <TrendingUp size={20} className="mr-2" /> Trending Topics
                            </h3>
                            <ul className="space-y-3 text-gray-300">
                                <li className="hover:text-gold cursor-pointer transition-colors">#AI_Investing</li>
                                <li className="hover:text-gold cursor-pointer transition-colors">#Crypto_Regulation</li>
                                <li className="hover:text-gold cursor-pointer transition-colors">#Green_Energy</li>
                                <li className="hover:text-gold cursor-pointer transition-colors">#Market_Crash</li>
                            </ul>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h3 className="text-gold font-bold mb-4 flex items-center">
                                <Users size={20} className="mr-2" /> Community
                            </h3>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400">Total Users</span>
                                <span className="text-white font-bold">{stats.total_users}</span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400">Active Users</span>
                                <span className="text-white font-bold">{stats.active_users}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Total Posts</span>
                                <span className="text-white font-bold">{stats.total_posts}</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content - Knowledge Stream */}
                    <div className="lg:col-span-3">
                        <NewsFeed limit={5} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Forum;
