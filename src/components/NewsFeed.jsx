import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, ThumbsUp } from 'lucide-react';

const NewsFeed = ({ limit = 3, compact = false }) => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch using the limit prop so it's dynamic
        fetch(`http://localhost:8001/api/articles?limit=${limit}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setArticles(data);
                } else {
                    console.error("API did not return an array", data);
                    setArticles([]);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching articles:", err);
                setLoading(false);
            });
    }, [limit]);

    if (loading) {
        return (
            <div className={`w-full ${!compact ? 'py-16' : 'py-8'} text-center`}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold mx-auto"></div>
            </div>
        );
    }

    if (articles.length === 0) {
        return (
            <div className="py-8 text-center text-gray-500">
                No articles found.
            </div>
        );
    }

    const ContentWrapper = compact ? 'div' : 'section';
    const wrapperClass = compact ? '' : 'py-16 px-4 bg-deep-black border-t border-white/5';

    return (
        <ContentWrapper className={wrapperClass}>
            <div className={!compact ? 'max-w-7xl mx-auto' : ''}>
                {!compact && (
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                                M.I.C.K.S. <span className="text-gold text-lg font-normal tracking-widest ml-2">(NEWS STREAM)</span>
                            </h2>
                            <p className="text-gray-400">Market Insights Center Knowledge Stream</p>
                        </div>
                        {/* We hide the View All button here if we are already on the News Page, 
                            but since this component is reused, we can control this via props or CSS 
                            if needed. For now, the landing page uses this link. */}
                    </div>
                )}

                <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-3'} gap-8`}>
                    {articles.map((article, index) => (
                        <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-gold/30 transition-all duration-300 flex flex-col h-full"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-gold/0 group-hover:bg-gold/100 transition-all duration-300 z-20" />

                            <Link to={`/article/${article.id}`} className="flex flex-col h-full">
                                <div className="h-48 overflow-hidden relative shrink-0">
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                                    <img
                                        src={article.cover_image || "https://images.unsplash.com/photo-1611974765270-ca12586343bb?auto=format&fit=crop&q=80&w=1000"}
                                        alt={article.title}
                                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                    />
                                </div>

                                <div className="p-6 flex flex-col flex-grow">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-xs font-bold text-gold uppercase tracking-wider border border-gold/20 px-2 py-1 rounded">
                                            {article.category || "Insight"}
                                        </span>
                                        <div className="flex items-center text-gray-500 text-xs">
                                            <Clock size={12} className="mr-1" />
                                            {article.date ? new Date(article.date).toLocaleDateString() : 'Recent'}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gold transition-colors line-clamp-2">
                                        {article.title}
                                    </h3>

                                    <p className="text-gray-400 text-sm mb-6 flex-grow line-clamp-3">
                                        {article.subheading || (article.content ? article.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : '')}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                        <div className="flex items-center text-gray-500 text-xs">
                                            <ThumbsUp size={12} className="mr-1" />
                                            {article.likes || 0}
                                        </div>
                                        <div className="text-sm font-bold text-gold flex items-center group-hover:translate-x-1 transition-transform">
                                            Read Analysis <ArrowRight size={16} className="ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </ContentWrapper>
    );
};

export default NewsFeed;