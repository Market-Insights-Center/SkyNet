import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Clock, ThumbsUp, Search, Edit2 } from 'lucide-react';

const NewsPage = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const { currentUser } = useAuth();
    const [isMod, setIsMod] = useState(false);

    useEffect(() => {
        if (currentUser) {
            fetch('http://localhost:8000/api/mods')
                .then(res => res.json())
                .then(data => {
                    if (data.mods.includes(currentUser.email)) {
                        setIsMod(true);
                    }
                })
                .catch(err => console.error("Error checking mods:", err));
        }
    }, [currentUser]);

    useEffect(() => {
        fetch('http://localhost:8000/api/articles?limit=100')
            .then(res => res.json())
            .then(data => {
                setArticles(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching articles:", err);
                setLoading(false);
            });
    }, []);

    const filteredArticles = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.subheading.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-20">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            M.I.C.K.S. <span className="text-gold">NEWS STREAM</span>
                        </h1>
                        <p className="text-gray-400 text-xl">Market Insights Center Knowledge Stream</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        {isMod && (
                            <Link
                                to="/admin?tab=articles&action=new"
                                className="bg-gold text-black px-6 py-3 rounded-full font-bold hover:bg-yellow-500 transition-colors flex items-center whitespace-nowrap"
                            >
                                <Edit2 size={18} className="mr-2" /> Write Article
                            </Link>
                        )}
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-6 text-white focus:border-gold focus:outline-none transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredArticles.map((article, index) => (
                            <motion.div
                                key={article.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-gold/30 transition-all duration-300 flex flex-col h-full"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-gold/0 group-hover:bg-gold/100 transition-all duration-300" />

                                <div className="p-6 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-xs font-bold text-gold uppercase tracking-wider border border-gold/20 px-2 py-1 rounded">
                                            {article.category || "Insight"}
                                        </span>
                                        <div className="flex items-center text-gray-500 text-xs">
                                            <Clock size={12} className="mr-1" />
                                            {new Date(article.date).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gold transition-colors line-clamp-2">
                                        {article.title}
                                    </h3>

                                    <p className="text-gray-400 text-sm mb-6 flex-grow line-clamp-3">
                                        {article.subheading}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                        <div className="flex items-center text-gray-500 text-xs">
                                            <ThumbsUp size={12} className="mr-1" />
                                            {article.likes}
                                        </div>
                                        <Link
                                            to={`/article/${article.id}`}
                                            className="text-sm font-bold text-gold flex items-center group-hover:translate-x-1 transition-transform"
                                        >
                                            Read Analysis <ArrowRight size={16} className="ml-1" />
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {!loading && filteredArticles.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                        No articles found matching your search.
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsPage;
