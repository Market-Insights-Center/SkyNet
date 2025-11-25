import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PenTool, Save, X, Layout, Type, Image as ImageIcon, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CreateArticle = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        subheading: '',
        category: 'Market Analysis',
        content: '',
        hashtags: '',
        cover_image: ''
    });

    const categories = ['Market Analysis', 'AI & Tech', 'Global Economy', 'Crypto', 'Investment Strategy'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('http://localhost:8000/api/articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    subheading: formData.subheading,
                    content: formData.content,
                    author: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Anonymous',
                    date: new Date().toISOString().split('T')[0],
                    category: formData.category,
                    hashtags: formData.hashtags.split(',').map(tag => tag.trim()).filter(tag => tag),
                    cover_image: formData.cover_image,
                    likes: 0,
                    dislikes: 0,
                    shares: 0
                })
            });

            if (response.ok) {
                const data = await response.json();
                navigate(`/news/${data.id}`);
            } else {
                console.error("Failed to create article");
            }
        } catch (error) {
            console.error("Error creating article:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <PenTool className="text-gold" /> Write Article
                        </h1>
                        <p className="text-gray-400 mt-2">Share your market insights with the community</p>
                    </div>
                    <button
                        onClick={() => navigate('/news')}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Main Content Card */}
                    <div className="bg-[#111] rounded-2xl border border-white/10 p-6 sm:p-8 space-y-6">
                        {/* Title */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Type size={16} className="text-gold" /> Article Title
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all placeholder-gray-600"
                                placeholder="Enter a compelling title..."
                            />
                        </div>

                        {/* Subheading */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Layout size={16} className="text-gold" /> Subheading
                            </label>
                            <textarea
                                required
                                value={formData.subheading}
                                onChange={(e) => setFormData({ ...formData, subheading: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all placeholder-gray-600 h-24 resize-none"
                                placeholder="Brief summary or hook..."
                            />
                        </div>

                        {/* Category & Tags */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <Tag size={16} className="text-gold" /> Category
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all appearance-none cursor-pointer"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat} className="bg-[#111]">{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <ImageIcon size={16} className="text-gold" /> Cover Image URL (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.cover_image}
                                    onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all placeholder-gray-600"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        {/* Hashtags */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Tag size={16} className="text-gold" /> Hashtags (comma separated)
                            </label>
                            <input
                                type="text"
                                value={formData.hashtags}
                                onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all placeholder-gray-600"
                                placeholder="AI, Tech, Finance..."
                            />
                        </div>

                        {/* Content */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <PenTool size={16} className="text-gold" /> Content
                            </label>
                            <textarea
                                required
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all placeholder-gray-600 h-96 font-mono text-sm leading-relaxed"
                                placeholder="Write your article content here (HTML supported)..."
                            />
                            <p className="text-xs text-gray-500 text-right">Supports basic HTML tags</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/news')}
                            className="px-6 py-3 rounded-xl text-gray-300 hover:bg-white/5 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-gold text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-colors shadow-lg shadow-gold/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    Publishing...
                                </>
                            ) : (
                                <>
                                    <Save size={18} /> Publish Article
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateArticle;
