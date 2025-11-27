import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ThumbsUp, ThumbsDown, User, Calendar, MessageSquare, Send } from 'lucide-react';

const IdeaCard = ({ idea, currentUser, onVote }) => {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState(idea.comments || []);
    const [commentText, setCommentText] = useState('');

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser) return;

        const newComment = {
            idea_id: idea.id,
            user: currentUser.email.split('@')[0],
            email: currentUser.email,
            text: commentText,
            date: new Date().toISOString().split('T')[0]
        };

        try {
            const res = await fetch('http://localhost:8000/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newComment)
            });

            if (res.ok) {
                const data = await res.json();
                // Handle different response structures (if backend returns {comment: obj} or just obj)
                const addedComment = data.comment || data; 
                if (addedComment) {
                    setComments(prev => [...prev, addedComment]);
                    setCommentText('');
                }
            } else {
                console.error("Failed to post comment");
            }
        } catch (error) {
            console.error("Error posting comment:", error);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-gold/50 transition-colors group h-full flex flex-col"
        >
            {/* Cover Image - Height Reduced */}
            <div className="h-40 bg-black/50 relative overflow-hidden shrink-0">
                {idea.cover_image ? (
                    <img
                        src={idea.cover_image}
                        alt={idea.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <TrendingUp size={48} />
                    </div>
                )}
                <div className="absolute top-3 right-3 bg-black/80 backdrop-blur px-2 py-0.5 rounded-full border border-white/10 text-gold font-bold text-xs">
                    {idea.ticker}
                </div>
            </div>

            {/* Content - Padding Reduced */}
            <div className="p-4 flex flex-col flex-1">
                <h3 className="text-lg font-bold mb-1 line-clamp-2 group-hover:text-gold transition-colors leading-tight">
                    {idea.title}
                </h3>
                <p className="text-gray-400 text-xs mb-3 line-clamp-3 flex-1">
                    {idea.description}
                </p>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-1 mb-3">
                    {idea.hashtags && idea.hashtags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[10px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-white/10 pt-3 mt-auto">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <User size={12} />
                            <span className="truncate max-w-[80px]">{idea.author.split('@')[0]}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{idea.date}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
                            className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                        >
                            <MessageSquare size={12} />
                            <span>{comments.length}</span>
                        </button>
                        <button
                            onClick={() => onVote && onVote(idea.id, 'up')}
                            className={`flex items-center gap-1 hover:text-green-400 transition-colors ${idea.liked_by?.includes(currentUser?.email) ? 'text-green-400' : ''}`}
                        >
                            <ThumbsUp size={12} />
                            <span>{idea.likes}</span>
                        </button>
                    </div>
                </div>

                {/* Comments Section */}
                <AnimatePresence>
                    {showComments && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/10 bg-black/20 mt-3"
                        >
                            <div className="p-3 space-y-3">
                                <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
                                    {comments.length > 0 ? (
                                        comments.map((comment, idx) => (
                                            <div key={idx} className="bg-white/5 p-2 rounded text-xs">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-gold">{comment.user}</span>
                                                    <span className="text-[10px] text-gray-500">{comment.date}</span>
                                                </div>
                                                <p className="text-gray-300">{comment.text}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-center text-xs py-1">No comments yet.</p>
                                    )}
                                </div>

                                {currentUser ? (
                                    <form onSubmit={handleCommentSubmit} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Comment..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gold/50"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!commentText.trim()}
                                            className="bg-gold/10 text-gold p-1.5 rounded hover:bg-gold/20 disabled:opacity-50 transition-colors"
                                        >
                                            <Send size={12} />
                                        </button>
                                    </form>
                                ) : (
                                    <p className="text-xs text-center text-gray-500">Log in to comment</p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default IdeaCard;