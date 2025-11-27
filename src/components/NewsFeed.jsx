import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, ThumbsUp } from 'lucide-react';

const NewsFeed = ({ limit = 100 }) => { // Default limit increased to show all
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch with a high limit to get all posts
        fetch(`http://localhost:8000/api/articles?limit=${limit}`)
            .then(res => res.json())
            .then(data => {
                setArticles(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching articles:", err);
                setLoading(false);
            });
    }, [limit]);

    if (loading) {
        return (
            <section className="py-16 px-4 bg-deep-black border-t border-white/5">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold mx-auto"></div>
                </div>
            </section>
        );
    }

    if (articles.length === 0) return null;

    return (
        <section className="py-16 px-4 bg-deep-black border-t border-white/5">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            M.I.C.K.S. <span className="text-gold text-lg font-normal tracking-widest ml-2">(NEWS STREAM)</span>
                        </h2>
                        <p className="text-gray-400">Market Insights Center Knowledge Stream</p>
                    </div>
                    {/* View All button removed as requested */}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {articles.map((article, index) => (
                        <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
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
            </div>
        </section>
    );
};

export default NewsFeed;