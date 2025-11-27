import React, { useState } from 'react';
import { X, Upload, BarChart2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

const CreateIdeaModal = ({ isOpen, onClose, onIdeaCreated, user }) => {
    const [ticker, setTicker] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [hashtags, setHashtags] = useState('');

    // Image State
    const [imageMode, setImageMode] = useState('upload'); // 'upload' or 'url'
    const [imageFile, setImageFile] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [imagePreview, setImagePreview] = useState(null);

    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

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

    const handleViewChart = () => {
        if (!ticker) return;
        window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank', 'width=1200,height=800');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsUploading(true);

        try {
            let finalCoverImageUrl = null;

            // 1. Handle Image (Upload or URL)
            if (imageMode === 'upload' && imageFile) {
                const formData = new FormData();
                formData.append('file', imageFile);

                const uploadRes = await fetch('http://localhost:8000/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadRes.ok) throw new Error('Image upload failed');
                const uploadData = await uploadRes.json();
                finalCoverImageUrl = uploadData.url;
            } else if (imageMode === 'url' && imageUrl) {
                finalCoverImageUrl = imageUrl;
            }

            // 2. Create Idea
            const ideaData = {
                ticker: ticker.toUpperCase(),
                title,
                description,
                author: user?.email || 'Anonymous',
                hashtags: hashtags.split(',').map(tag => tag.trim()).filter(tag => tag),
                cover_image: finalCoverImageUrl,
                date: new Date().toISOString().split('T')[0]
            };

            const res = await fetch('http://localhost:8000/api/ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ideaData)
            });

            if (!res.ok) throw new Error('Failed to create idea');

            onIdeaCreated();
            onClose();
            // Reset form
            setTicker('');
            setTitle('');
            setDescription('');
            setHashtags('');
            setImageFile(null);
            setImageUrl('');
            setImagePreview(null);
            setImageMode('upload');

        } catch (error) {
            console.error("Error creating idea:", error);
            alert("Failed to create idea. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#0a0a0a] z-10">
                    <h2 className="text-2xl font-light text-white">Share Trading Idea</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Ticker & Chart */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-400 mb-2">Ticker Symbol</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                    placeholder="e.g. AAPL"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={handleViewChart}
                                    disabled={!ticker}
                                    className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <BarChart2 size={18} />
                                    Chart
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Click "Chart" to open TradingView. Take a screenshot or copy the image link.
                            </p>
                        </div>
                    </div>

                    {/* Image Selection */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Cover Image</label>

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
                            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-purple-500/50 transition-colors relative group">
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
                                        <span>Click to upload chart screenshot</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* URL Mode */}
                        {imageMode === 'url' && (
                            <div className="space-y-4">
                                <input
                                    type="url"
                                    value={imageUrl}
                                    onChange={handleUrlChange}
                                    placeholder="Paste image URL here (e.g. https://...)"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                />
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

                    {/* Title */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Bullish divergence on AAPL weekly"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Analysis / Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explain your thesis..."
                            rows={6}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                            required
                        />
                    </div>

                    {/* Hashtags */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Hashtags (comma separated)</label>
                        <input
                            type="text"
                            value={hashtags}
                            onChange={(e) => setHashtags(e.target.value)}
                            placeholder="e.g. technical, long, breakout"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    {/* Submit */}
                    <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="px-8 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isUploading ? 'Posting...' : 'Post Idea'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateIdeaModal;
