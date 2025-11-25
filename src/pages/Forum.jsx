import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, TrendingUp, Users } from 'lucide-react';

const Forum = () => {
    const [recentArticles, setRecentArticles] = useState([]);
    const [stats, setStats] = useState({
        community_stats: { online: 0, total_users: 0, total_posts: 0 },
        trending_topics: []
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Articles
                const articlesRes = await fetch('http://localhost:8000/api/articles');
                if (articlesRes.ok) {
                    const data = await articlesRes.json();
                    setRecentArticles(data.slice(0, 5));
                }

                // Fetch Stats
                const statsRes = await fetch('http://localhost:8000/api/stats');
                if (statsRes.ok) {
                    const data = await statsRes.json();
                    setStats(data);
                }
            } catch (error) {
                console.error("Error fetching forum data:", error);
            }
        };
        fetchData();
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
                                {stats && stats.trending_topics && Array.isArray(stats.trending_topics) && stats.trending_topics.length > 0 ? (
                                    stats.trending_topics.map((topic, index) => (
                                        <li key={index} className="hover:text-gold cursor-pointer transition-colors">{topic}</li>
                                    ))
                                ) : (
                                    <li className="text-gray-500">Loading topics...</li>
                                )}
                            </ul>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h3 className="text-gold font-bold mb-4 flex items-center">
                                <Users size={20} className="mr-2" /> Community
                            </h3>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400">Members Online</span>
                                <span className="text-white font-bold">{stats?.community_stats?.online?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Total Posts</span>
                                <span className="text-white font-bold">{stats?.community_stats?.total_posts?.toLocaleString() || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content - Knowledge Stream */}
                    <div className="lg:col-span-3">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-white">Knowledge Stream</h2>
                            <Link
                                to="/news"
                                className="flex items-center text-gold hover:text-white transition-colors font-bold"
                            >
                                View All Articles <ArrowRight size={20} className="ml-2" />
                            </Link>
                        </div>

                        <div className="space-y-6">
                            {recentArticles.map((article, index) => (
                                <motion.div
                                    key={article.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-gold/30 transition-all duration-300 group"
                                >
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="flex-grow">
                                            <div className="flex items-center text-xs text-gray-500 mb-2">
                                                <span className="bg-gold/10 text-gold px-2 py-1 rounded mr-3">Analysis</span>
                                                <span>{article.date}</span>
                                                <span className="mx-2">•</span>
                                                <span>{article.author}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gold transition-colors">
                                                <Link to={`/article/${article.id}`}>
                                                    {article.title}
                                                </Link>
                                            </h3>
                                            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                                                {article.subheading}
                                            </p>
                                            <div className="flex items-center gap-4 text-gray-500 text-sm">
                                                <span className="flex items-center hover:text-white transition-colors">
                                                    <MessageSquare size={16} className="mr-1" /> {article.comments.length} Comments
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                            <Link
                                                to={`/article/${article.id}`}
                                                className="bg-white/10 hover:bg-gold hover:text-black text-white px-6 py-2 rounded-lg font-bold transition-all duration-300 text-sm"
                                            >
                                                Read
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-8 text-center">
                            <Link
                                to="/news"
                                className="inline-block bg-gold/10 text-gold border border-gold/30 px-8 py-3 rounded-lg font-bold hover:bg-gold hover:text-black transition-all duration-300"
                            >
                                Load More Articles
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Forum;
