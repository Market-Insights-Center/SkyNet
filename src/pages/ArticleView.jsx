import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, ThumbsUp, ThumbsDown, MessageSquare, User, Calendar, ArrowLeft, Send, Trash2, CornerDownRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ArticleView = () => {
    const { id } = useParams();
    const { currentUser, isMod } = useAuth();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showComments, setShowComments] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // Comment ID being replied to

    useEffect(() => {
        fetchArticle();
    }, [id]);

    const fetchArticle = async () => {
        try {
            const response = await fetch(`http://localhost:8000/api/articles/${id}`);
            if (!response.ok) throw new Error('Failed to fetch article');
            const data = await response.json();
            setArticle(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (type) => {
        try {
            const response = await fetch(`http://localhost:8000/api/articles/${id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            if (response.ok) {
                const data = await response.json();
                setArticle(prev => ({ ...prev, likes: data.likes, dislikes: data.dislikes }));
            }
        } catch (err) {
            console.error("Error voting on article:", err);
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;

        try {
            const response = await fetch('http://localhost:8000/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 0, // Backend handles ID
                    article_id: parseInt(id),
                    user: currentUser.displayName || 'Anonymous',
                    text: newComment,
                    date: new Date().toISOString(),
                    isMod: isMod
                })
            });
            if (response.ok) {
                setNewComment('');
                fetchArticle(); // Refresh comments
            }
        } catch (err) {
            console.error("Error posting comment:", err);
        }
    };

    const handleReplySubmit = async (parentId) => {
        if (!replyText.trim() || !currentUser) return;

        try {
            const response = await fetch(`http://localhost:8000/api/comments/${parentId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: Date.now(), // Temporary ID, backend doesn't re-assign for replies in our simple logic
                    article_id: parseInt(id),
                    user: currentUser.displayName || 'Anonymous',
                    text: replyText,
                    date: new Date().toISOString(),
                    isMod: isMod
                })
            });
            if (response.ok) {
                setReplyText('');
                setReplyingTo(null);
                fetchArticle();
            }
        } catch (err) {
            console.error("Error posting reply:", err);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!isMod) return;
        if (window.confirm('Are you sure you want to delete this comment?')) {
            try {
                const response = await fetch(`http://localhost:8000/api/comments/${commentId}?requester_email=${currentUser.email}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    fetchArticle();
                }
            } catch (err) {
                console.error("Error deleting comment:", err);
            }
        }
    };

    const handleCommentVote = async (commentId, type) => {
        try {
            await fetch(`http://localhost:8000/api/comments/${commentId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, user_id: currentUser ? currentUser.uid : 'anon' })
            });
            fetchArticle();
        } catch (err) {
            console.error("Error voting on comment:", err);
        }
    };

    const CommentItem = ({ comment, isReply = false }) => {
        const isCommentMod = comment.isMod || comment.user === "AdminUser" || comment.user.includes("Admin");

        return (
            <div className={`group ${isReply ? 'ml-8 mt-4 border-l-2 border-white/10 pl-4' : 'border-b border-purple-500/10 last:border-0 pb-6 last:pb-0'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold ${isCommentMod ? 'text-gold' : 'text-purple-300'}`}>{comment.user}</span>
                        {isCommentMod && (
                            <span className="text-[10px] font-bold bg-gold/20 text-gold px-1.5 py-0.5 rounded border border-gold/30 tracking-wider">
                                MOD
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500">{new Date(comment.date).toLocaleDateString()}</span>
                        {isMod && (
                            <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Comment"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <p className="text-gray-300 text-sm mb-3">{comment.text}</p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <button
                        onClick={() => handleCommentVote(comment.id, 'up')}
                        className="flex items-center gap-1 hover:text-green-400 transition-colors"
                    >
                        <ThumbsUp size={12} /> {comment.likes || 0}
                    </button>
                    <button
                        onClick={() => handleCommentVote(comment.id, 'down')}
                        className="flex items-center gap-1 hover:text-red-400 transition-colors"
                    >
                        <ThumbsDown size={12} /> {comment.dislikes || 0}
                    </button>
                    {currentUser && !isReply && (
                        <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="flex items-center gap-1 hover:text-gold transition-colors"
                        >
                            <MessageSquare size={12} /> Reply
                        </button>
                    )}
                </div>

                {/* Reply Input */}
                {replyingTo === comment.id && (
                    <div className="mt-3 flex gap-2">
                        <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold outline-none"
                        />
                        <button
                            onClick={() => handleReplySubmit(comment.id)}
                            className="bg-gold text-black px-3 py-2 rounded-lg text-xs font-bold hover:bg-yellow-400 transition-colors"
                        >
                            Reply
                        </button>
                    </div>
                )}

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-4">
                        {comment.replies.map(reply => (
                            <CommentItem key={reply.id || Math.random()} comment={reply} isReply={true} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="min-h-screen pt-24 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div></div>;
    if (error || !article) return <div className="min-h-screen pt-24 text-center text-red-400">Error: {error || 'Article not found'}</div>;

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Link to="/news" className="inline-flex items-center text-gray-400 hover:text-gold mb-8 transition-colors">
                    <ArrowLeft size={20} className="mr-2" /> Back to News
                </Link>

                <article className="bg-[#111] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                    <div className="p-8 sm:p-12">
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
                            <span className="flex items-center gap-1"><User size={14} /> {article.author}</span>
                            <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(article.date).toLocaleDateString()}</span>
                            <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full text-xs border border-purple-500/30">
                                {article.category || 'General'}
                            </span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">{article.title}</h1>
                        <h2 className="text-xl text-gray-300 mb-6 font-light leading-relaxed">{article.subheading}</h2>

                        {/* Hashtags */}
                        {article.hashtags && article.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-8">
                                {article.hashtags.map((tag, index) => (
                                    <span key={index} className="text-xs font-medium bg-white/5 text-gold px-3 py-1 rounded-full border border-white/10">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Cover Image */}
                        {article.cover_image && (
                            <div className="mb-8 rounded-xl overflow-hidden border border-white/10">
                                <img src={article.cover_image} alt={article.title} className="w-full h-auto object-cover" />
                            </div>
                        )}

                        <div className="prose prose-invert max-w-none mb-12 text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: article.content }} />

                        <div className="flex items-center justify-between border-t border-white/10 pt-8">
                            <div className="flex items-center gap-6">
                                <button onClick={() => handleVote('up')} className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors group">
                                    <ThumbsUp size={20} className="group-hover:scale-110 transition-transform" />
                                    <span>{article.likes}</span>
                                </button>
                                <button onClick={() => handleVote('down')} className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors group">
                                    <ThumbsDown size={20} className="group-hover:scale-110 transition-transform" />
                                    <span>{article.dislikes}</span>
                                </button>
                                <button
                                    onClick={() => setShowComments(!showComments)}
                                    className={`flex items-center gap-2 transition-colors ${showComments ? 'text-gold' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <MessageSquare size={20} />
                                    <span>{article.comments ? article.comments.length : 0} Comments</span>
                                </button>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setShowShareMenu(!showShareMenu)}
                                    className="flex items-center gap-2 text-gray-400 hover:text-gold transition-colors"
                                >
                                    <Share2 size={20} />
                                    <span className="hidden sm:inline">Share</span>
                                </button>
                                <AnimatePresence>
                                    {showShareMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute bottom-full right-0 mb-2 bg-[#222] border border-white/10 rounded-xl shadow-xl p-2 min-w-[150px]"
                                        >
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(window.location.href);
                                                    setShowShareMenu(false);
                                                    alert("Link copied to clipboard!");
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
                                            >
                                                Copy Link
                                            </button>
                                            <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">Twitter</button>
                                            <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">LinkedIn</button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Comments Section */}
                    <AnimatePresence>
                        {showComments && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-[#0a0a0a] border-t border-white/10"
                            >
                                <div className="p-8 sm:p-12">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <MessageSquare size={20} className="text-gold" />
                                        Discussion
                                    </h3>

                                    {currentUser ? (
                                        <form onSubmit={handleCommentSubmit} className="mb-10">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                                                </div>
                                                <div className="flex-1">
                                                    <textarea
                                                        value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        placeholder="Share your insights..."
                                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:border-gold focus:ring-1 focus:ring-gold transition-all resize-none h-32"
                                                    />
                                                    <div className="flex justify-end mt-2">
                                                        <button
                                                            type="submit"
                                                            disabled={!newComment.trim()}
                                                            className="bg-gold text-black px-6 py-2 rounded-full font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                        >
                                                            <Send size={16} /> Post Comment
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="bg-white/5 rounded-xl p-6 text-center mb-10 border border-white/10">
                                            <p className="text-gray-300 mb-4">Join the conversation with other investors.</p>
                                            <div className="flex justify-center gap-4">
                                                <Link to="/login" className="text-gold hover:text-white font-medium transition-colors">Log In</Link>
                                                <span className="text-gray-600">|</span>
                                                <Link to="/signup" className="text-gold hover:text-white font-medium transition-colors">Sign Up</Link>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {article.comments && article.comments.length > 0 ? (
                                            article.comments.map((comment) => (
                                                <CommentItem key={comment.id} comment={comment} />
                                            ))
                                        ) : (
                                            <p className="text-center text-gray-500 py-8">No comments yet. Be the first to share your thoughts!</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </article>
            </div>
        </div>
    );
};

export default ArticleView;
