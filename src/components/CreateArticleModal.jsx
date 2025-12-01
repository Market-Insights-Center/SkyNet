import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Image as ImageIcon, FileText, Hash, Type, Link as LinkIcon } from 'lucide-react';

const CreateArticleModal = ({ isOpen, onClose, onArticleCreated, user }) => {
    // Text Fields State
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        content: '',
        hashtags: ''
    });

    // Image Handling State
    const [imageMode, setImageMode] = useState('upload'); // 'upload' or 'url'
    const [imageFile, setImageFile] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    // Image Handlers
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleUrlChange = (e) => {
        const url = e.target.value;
        setImageUrl(url);
        setImagePreview(url);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsUploading(true);
        setError(null);

        try {
            let finalCoverImageUrl = null;

            // 1. Handle Image Upload logic
            if (imageMode === 'upload' && imageFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', imageFile);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: uploadFormData,
                });

                if (!uploadRes.ok) throw new Error('Image upload failed');
                const uploadData = await uploadRes.json();
                finalCoverImageUrl = uploadData.url;
            } else if (imageMode === 'url' && imageUrl) {
                finalCoverImageUrl = imageUrl;
            }

            // UPDATED: Determine Author Name (Display Name or Email Username)
            const authorName = user.displayName || user.email.split('@')[0];

            // 2. Create Article
            const res = await fetch('/api/articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    author: authorName, // Updated to use username instead of email
                    date: new Date().toISOString(),
                    hashtags: formData.hashtags.split(',').map(t => t.trim()).filter(t => t),
                    cover_image: finalCoverImageUrl
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to create article');
            }

            onArticleCreated();
            onClose();
            
            // Reset Form
            setFormData({ title: '', subtitle: '', content: '', hashtags: '' });
            setImageFile(null);
            setImageUrl('');
            setImagePreview(null);
            setImageMode('upload');
            
        } catch (err) {
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            {/* Container */}
            <div className="bg-[#0a0a0a] border border-gold/30 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative">
                
                {/* Header - Sticky */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a] rounded-t-2xl shrink-0">
                    <h2 className="text-2xl font-bold text-gold flex items-center gap-2">
                        <FileText size={24} /> Write an Article
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto custom-scrollbar p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all outline-none"
                                    placeholder="Article Title"
                                    required
                                />
                            </div>

                            {/* Subtitle */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Subtitle</label>
                                <div className="relative">
                                    <Type size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="text"
                                        value={formData.subtitle}
                                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-10 text-white focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all outline-none"
                                        placeholder="A short, engaging subtitle"
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Content</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all outline-none h-64 resize-none custom-scrollbar font-mono text-sm"
                                    placeholder="Write your article content here (Markdown supported)..."
                                    required
                                />
                            </div>

                            {/* Cover Image Section - Full Width for better UI */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Cover Image</label>

                                {/* Toggle Tabs */}
                                <div className="flex gap-4 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setImageMode('upload')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${imageMode === 'upload' ? 'bg-white/10 text-white border border-white/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <Upload size={16} /> Upload
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImageMode('url')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${imageMode === 'url' ? 'bg-white/10 text-white border border-white/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <LinkIcon size={16} /> Image Link
                                    </button>
                                </div>

                                {/* Upload Mode */}
                                {imageMode === 'upload' && (
                                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-gold/50 transition-colors relative group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        {imagePreview && imageMode === 'upload' ? (
                                            <div className="relative h-48 w-full">
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                                    <span className="text-white font-medium">Change Image</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 text-gray-400">
                                                <Upload size={32} />
                                                <span>Click to upload cover image</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* URL Mode */}
                                {imageMode === 'url' && (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <ImageIcon size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="url"
                                                value={imageUrl}
                                                onChange={handleUrlChange}
                                                placeholder="Paste image URL here (e.g. https://...)"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-10 text-white focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all outline-none"
                                            />
                                        </div>
                                        {imagePreview && imageUrl && (
                                            <div className="h-48 w-full rounded-xl overflow-hidden border border-white/10 bg-black/20">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Invalid+Image+URL'; }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Hashtags */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Hashtags</label>
                                <div className="relative">
                                    <Hash size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="text"
                                        value={formData.hashtags}
                                        onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-10 text-white focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all outline-none"
                                        placeholder="e.g. market, analysis, crypto"
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer - Sticky */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-4 bg-[#0a0a0a] rounded-b-2xl shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isUploading}
                        className="bg-gold text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-500 transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                Publishing...
                            </>
                        ) : (
                            'Publish Article'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateArticleModal;