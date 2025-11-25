import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, TrendingUp, Clock, MessageSquare, ChevronRight, User, PenTool } from 'lucide-react';

const NewsPage = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const categories = ['All', 'Market Analysis', 'AI & Tech', 'Global Economy', 'Crypto'];

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/articles');
                if (response.ok) {
                    const data = await response.json();
                    setArticles(data);
                } else {
                    console.error("Failed to fetch articles");
                }
            } catch (error) {
                console.error("Error fetching articles:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, []);

    const filteredArticles = articles.filter(article => {
        const matchesCategory = activeCategory === 'All' || article.category === activeCategory;
        const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.subheading.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const featuredArticle = articles.length > 0 ? articles[0] : null;
    const regularArticles = articles.length > 0 ? filteredArticles.filter(a => a.id !== featuredArticle.id) : [];

    if (loading) {
        return (
            <div className="min-h-screen pt-24 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Market Intelligence</h1>
                        <p className="text-gray-400">Curated insights for the modern investor</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            to="/create-article"
                            className="bg-gold text-black px-4 py-2 rounded-full font-bold hover:bg-yellow-400 transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                            <PenTool size={18} /> Write Article
                        </Link>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:border-gold outline-none w-full sm:w-64"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${activeCategory === cat
                                        ? 'bg-gold text-black font-bold'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Featured Article */}
                {featuredArticle && activeCategory === 'All' && !searchQuery && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-16 group cursor-pointer"
                    >
                        <Link to={`/news/${featuredArticle.id}`} className="block relative h-[500px] rounded-3xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
                            <img
                                src={featuredArticle.cover_image || `https://source.unsplash.com/random/1200x800?finance,${featuredArticle.category}`}
                                alt={featuredArticle.title}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 z-20">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="bg-gold text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                        Featured
                                    </span>
                                    <span className="text-gray-300 text-sm flex items-center gap-2">
                                        <Clock size={14} /> {new Date(featuredArticle.date).toLocaleDateString()}
                                    </span>
                                </div>
                                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 max-w-4xl leading-tight group-hover:text-gold transition-colors">
                                    {featuredArticle.title}
                                </h2>
                                <p className="text-gray-300 text-lg max-w-2xl mb-6 line-clamp-2">
                                    {featuredArticle.subheading}
                                </p>
                                <div className="flex items-center gap-6 text-sm font-medium">
                                    <span className="flex items-center gap-2 text-white">
                                        Read Analysis <ChevronRight size={16} className="text-gold" />
                                    </span>
                                    <span className="flex items-center gap-2 text-gray-400">
                                        <User size={16} /> {featuredArticle.author}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                )}

                {/* Article Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {regularArticles.map((article, index) => (
                        <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group bg-[#111] rounded-2xl overflow-hidden border border-white/5 hover:border-gold/30 transition-all hover:shadow-2xl hover:shadow-gold/5"
                        >
                            <Link to={`/news/${article.id}`} className="block h-full flex flex-col">
                                <div className="relative h-48 overflow-hidden">
                                    <div className="absolute top-4 left-4 z-10">
                                        <span className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                                            {article.category}
                                        </span>
                                    </div>
                                    <img
                                        src={article.cover_image || `https://source.unsplash.com/random/800x600?finance,${index}`}
                                        alt={article.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                </div>
                                <div className="p-6 flex-1 flex flex-col">
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(article.date).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><TrendingUp size={12} /> {article.likes} Likes</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gold transition-colors line-clamp-2">
                                        {article.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm mb-4 line-clamp-3 flex-1">
                                        {article.subheading}
                                    </p>
                                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-[10px]">
                                                {article.author[0]}
                                            </div>
                                            {article.author}
                                        </div>
                                        <span className="text-gold text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                            Read <ChevronRight size={12} />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {regularArticles.length === 0 && (
                    <div className="text-center py-24">
                        <div className="inline-block p-4 rounded-full bg-white/5 mb-4">
                            <Search size={32} className="text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No articles found</h3>
                        <p className="text-gray-400">Try adjusting your search or category filter</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsPage;
