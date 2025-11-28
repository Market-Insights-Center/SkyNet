import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, Users, Lightbulb, Newspaper } from 'lucide-react';
import NewsFeed from '../components/NewsFeed';
import IdeaCard from '../components/IdeaCard';
import { useAuth } from '../contexts/AuthContext';

const Forum = () => {
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({
        total_users: 0,
        active_users: 0,
        total_posts: 0,
        trending_topics: []
    });
    const [recentIdeas, setRecentIdeas] = useState([]);

    useEffect(() => {
        // Fetch Stats - PORT 8001
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error("Error fetching stats:", err));

        // Fetch Recent Ideas - PORT 8001
        fetch('/api/ideas?limit=6')
            .then(res => res.json())
            .then(data => setRecentIdeas(data))
            .catch(err => console.error("Error fetching ideas:", err));
    }, []);

    const handleVote = async (ideaId, type) => {
        if (!currentUser) {
            alert("Please login to vote");
            return;
        }
        try {
            // PORT 8001
            const res = await fetch(`/api/ideas/${ideaId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.email, vote_type: type })
            });
            if (res.ok) {
                // Refresh ideas to show new counts - PORT 8001
                fetch('/api/ideas?limit=6')
                    .then(res => res.json())
                    .then(data => setRecentIdeas(data));
            }
        } catch (error) {
            console.error("Error voting:", error);
        }
    };

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
                                {stats.trending_topics && stats.trending_topics.length > 0 ? (
                                    stats.trending_topics.map((tag, i) => (
                                        <li key={i} className="hover:text-gold cursor-pointer transition-colors">#{tag}</li>
                                    ))
                                ) : (
                                    <li className="text-gray-500 italic">No trending topics yet</li>
                                )}
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

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-12">
                        {/* News Feed */}
                        <div className="relative">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Newspaper className="text-gold" size={24} /> Market <span className="text-gold">News</span>
                                </h2>
                                <Link to="/news" className="text-gold hover:text-white flex items-center gap-2 transition-colors">
                                    View All Articles <ArrowRight size={16} />
                                </Link>
                            </div>
                            <NewsFeed limit={6} compact={true} />
                        </div>

                        {/* Recent Ideas */}
                        <section>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Lightbulb className="text-gold" size={24} /> Recent Ideas
                                </h2>
                                <Link to="/ideas" className="text-gold hover:text-white flex items-center gap-2 transition-colors">
                                    View All Ideas <ArrowRight size={16} />
                                </Link>
                            </div>

                            {recentIdeas.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {recentIdeas.map(idea => (
                                        <div key={idea.id} className="h-[420px]">
                                            <IdeaCard
                                                idea={idea}
                                                currentUser={currentUser}
                                                onVote={handleVote}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-gray-400 mb-4">No ideas posted yet.</p>
                                    <Link to="/ideas" className="text-gold hover:underline">
                                        Be the first to share an idea!
                                    </Link>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Forum;