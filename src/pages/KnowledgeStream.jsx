import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, User, Tag } from 'lucide-react';

const KnowledgeStream = () => {
    const [articles, setArticles] = useState([]);
    const [visibleCount, setVisibleCount] = useState(5);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const response = await fetch('/api/articles?limit=100'); // Fetch all, handle pagination client-side for now or update API
                if (response.ok) {
                    const data = await response.json();
                    setArticles(data);
                }
            } catch (error) {
                console.error("Failed to fetch articles:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, []);

    const showMore = () => {
        setVisibleCount(prev => prev + 5);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-deep-black flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-20">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6">
                        M.I.C. <span className="text-gold">Knowledge Stream</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Deep dives, market analysis, and predictive insights from the Market Insights Center.
                    </p>
                </div>

                <div className="space-y-8">
                    {articles.slice(0, visibleCount).map((article, index) => (
                        <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-gold/30 transition-all group"
                        >
                            <Link to={`/article/${article.id}`} className="block md:flex">
                                <div className="md:w-1/3 h-64 md:h-auto relative overflow-hidden">
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                                    <img
                                        src={article.cover_image || "https://images.unsplash.com/photo-1611974765270-ca12586343bb?auto=format&fit=crop&q=80&w=1000"}
                                        alt={article.title}
                                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                    />
                                </div>
                                <div className="p-8 md:w-2/3 flex flex-col justify-center">
                                    <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} className="text-gold" />
                                            {new Date(article.date).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <User size={14} className="text-gold" />
                                            {article.author}
                                        </span>
                                        <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-xs text-white">
                                            <Tag size={12} />
                                            {article.category}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold mb-4 group-hover:text-gold transition-colors">
                                        {article.title}
                                    </h2>
                                    <p className="text-gray-400 mb-6 line-clamp-2">
                                        {article.subheading || article.content.substring(0, 150) + "..."}
                                    </p>
                                    <div className="flex items-center text-gold font-bold uppercase tracking-wider text-sm">
                                        Read Analysis <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {visibleCount < articles.length && (
                    <div className="text-center mt-12">
                        <button
                            onClick={showMore}
                            className="bg-white/10 text-white px-8 py-3 rounded-full font-bold hover:bg-white/20 transition-colors border border-white/10 hover:border-gold/50"
                        >
                            Show More Articles
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgeStream;
