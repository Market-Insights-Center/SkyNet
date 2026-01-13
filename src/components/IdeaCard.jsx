import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ThumbsUp, ThumbsDown, User, Calendar, MessageSquare, Send, Trash2, ShieldCheck } from 'lucide-react';
import TiltCard from './TiltCard';

const IdeaCard = React.forwardRef(({ idea, currentUser, onVote, style, className, onClick, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const [showComments, setShowComments] = useState(false);

    // UPDATED: Initialize comments sorted by date (Newest First)
    const [comments, setComments] = useState(
        (idea.comments || []).sort((a, b) => new Date(b.date) - new Date(a.date))
    );

    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMod, setIsMod] = useState(false);

    // Hardcoded Admin Email for tagging
    const ADMIN_EMAIL = 'marketinsightscenter@gmail.com';

    // Check if current user is a moderator
    useEffect(() => {
        if (currentUser) {
            // Immediate check for super admin
            if (currentUser.email === ADMIN_EMAIL) {
                setIsMod(true);
                return;
            }

            // Check remote mod list
            fetch('/api/mods')
                .then(res => res.json())
                .then(data => {
                    if (data.mods && data.mods.includes(currentUser.email)) {
                        setIsMod(true);
                    }
                })
                .catch(err => console.error("Error checking mod status:", err));
        }
    }, [currentUser]);

    const handleCommentSubmit = async (e) => {
        e.preventDefault();

        if (!currentUser) {
            alert("Please log in to post a comment.");
            return;
        }

        if (!commentText.trim()) return;
        if (!idea.id) {
            console.error("Missing Idea ID");
            return;
        }

        setIsSubmitting(true);

        const newCommentPayload = {
            id: 0, // Dummy ID
            idea_id: parseInt(idea.id),
            user_id: currentUser.email,
            user: currentUser.displayName || currentUser.email.split('@')[0],
            email: currentUser.email,
            text: commentText,
            date: new Date().toISOString().split('T')[0]
        };

        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCommentPayload)
            });

            if (res.ok) {
                const data = await res.json();
                const addedComment = data.comment || data;

                // UPDATED: Prepend new comment to the top of the list
                setComments(prev => [addedComment, ...prev]);

                setCommentText('');
            } else {
                let errorData;
                try {
                    errorData = await res.json();
                } catch (e) {
                    errorData = { detail: "Unknown server error" };
                }

                console.error("Failed to post comment:", errorData);

                let errorMessage = `Server error ${res.status}`;
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    errorMessage += ": " + errorData.detail.map(e => `${e.loc[1]}: ${e.msg}`).join(', ');
                } else if (errorData.detail) {
                    errorMessage += ": " + errorData.detail;
                }

                alert(`Could not post comment. ${errorMessage}`);
            }
        } catch (error) {
            console.error("Error posting comment:", error);
            alert("Network error: Could not post comment.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!commentId) return;
        if (!window.confirm("Are you sure you want to delete this comment?")) return;

        if (!currentUser) {
            alert("You must be logged in to delete comments.");
            return;
        }

        try {
            const res = await fetch(`/api/comments/${commentId}?requester_email=${encodeURIComponent(currentUser.email)}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setComments(prev => prev.filter(c => c.id !== commentId));
            } else {
                let errorData;
                try {
                    errorData = await res.json();
                } catch (jsonError) {
                    const text = await res.text();
                    errorData = { detail: text || "Unknown server error" };
                }

                console.error("Delete failed:", res.status, errorData);

                let errorMessage = `Server error ${res.status}`;
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    errorMessage += ": " + errorData.detail.map(e => `${e.loc[1]}: ${e.msg}`).join(', ');
                } else if (errorData.detail) {
                    errorMessage += ": " + errorData.detail;
                }

                alert(`Failed to delete comment. ${errorMessage}`);
            }
        } catch (error) {
            console.error("Error deleting comment:", error);
            alert("Network error: Could not delete comment.");
        }
    };

    // Helper to check if a specific comment is from an admin
    const isCommentAdmin = (comment) => {
        return comment.email === ADMIN_EMAIL || comment.isAdmin;
    };

    return (
        <div
            ref={ref}
            style={style}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`card-wrapper absolute top-1/2 left-1/2 ${className || ''}`}
        >
            <TiltCard
                className="h-full flex flex-col bg-white/5 border border-white/10 overflow-hidden hover:border-gold/50 transition-colors group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Cover Image */}
                <div className="aspect-square bg-black/50 relative overflow-hidden shrink-0 border-b border-white/5">
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
                    <div className="absolute top-3 right-3 bg-black/80 backdrop-blur px-2 py-0.5 border border-white/10 text-gold font-bold text-xs">
                        {idea.ticker}
                    </div>
                </div>

                {/* Content */}
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

                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
                                className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                            >
                                <MessageSquare size={14} />
                                <span>{comments.length}</span>
                            </button>
                            <button
                                onClick={() => onVote && onVote(idea.id, 'up')}
                                className={`flex items-center gap-1 hover:text-green-400 transition-colors ${idea.liked_by?.includes(currentUser?.email) ? 'text-green-400' : ''}`}
                            >
                                <ThumbsUp size={14} />
                                <span>{idea.likes || 0}</span>
                            </button>
                            <button
                                onClick={() => onVote && onVote(idea.id, 'down')}
                                className={`flex items-center gap-1 hover:text-red-400 transition-colors ${idea.disliked_by?.includes(currentUser?.email) ? 'text-red-400' : ''}`}
                            >
                                <ThumbsDown size={14} />
                                <span>{idea.dislikes || 0}</span>
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
                                                <div key={comment.id || idx} className={`bg-white/5 p-2 text-xs relative hover:bg-white/10 transition-colors ${isCommentAdmin(comment) ? 'border-l-2 border-gold pl-3' : ''}`}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-gold">{comment.user}</span>
                                                            {isCommentAdmin(comment) && (
                                                                <span className="bg-gold text-black text-[9px] font-bold px-1 rounded flex items-center gap-0.5">
                                                                    <ShieldCheck size={8} /> ADMIN
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-gray-500">{comment.date}</span>
                                                            {(isMod || (currentUser?.email === comment.email)) && (
                                                                <button
                                                                    onClick={() => handleDeleteComment(comment.id)}
                                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                                    title="Delete Comment"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
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
                                                disabled={!commentText.trim() || isSubmitting}
                                                className="bg-gold/10 text-gold p-1.5 rounded hover:bg-gold/20 disabled:opacity-50 transition-colors"
                                            >
                                                {isSubmitting ? <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin"></div> : <Send size={12} />}
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
            </TiltCard>
        </div>
    );
});

export default IdeaCard;