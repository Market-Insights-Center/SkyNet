import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, ThumbsUp, ThumbsDown, MessageSquare, User, Calendar, ArrowLeft, Send, Trash2, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ArticleView = () => {
    const { id } = useParams();
    const { currentUser, isMod } = useAuth();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showComments, setShowComments] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); 
    const [guestId, setGuestId] = useState(null);
    const [copied, setCopied] = useState(false);

    // --- Cookie Management for Guest Voting ---
    useEffect(() => {
        const getCookie = (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        };
        
        let gid = getCookie('mic_guest_id');
        if (!gid) {
            gid = 'guest_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            document.cookie = `mic_guest_id=${gid}; path=/; max-age=31536000`; // 1 year
        }
        setGuestId(gid);
    }, []);

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

    const getUserId = () => currentUser ? currentUser.uid : guestId;

    const handleVote = async (type) => {
        const userId = getUserId();
        try {
            const response = await fetch(`http://localhost:8000/api/articles/${id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, user_id: userId })
            });
            if (response.ok) {
                const data = await response.json();
                setArticle(prev => ({ ...prev, likes: data.likes, dislikes: data.dislikes }));
                // Optimistically update local lists for UI state
                let liked = article.liked_by || [];
                let disliked = article.disliked_by || [];
                if (type === 'up') {
                    if (liked.includes(userId)) liked = liked.filter(u => u !== userId);
                    else { liked.push(userId); disliked = disliked.filter(u => u !== userId); }
                } else {
                    if (disliked.includes(userId)) disliked = disliked.filter(u => u !== userId);
                    else { disliked.push(userId); liked = liked.filter(u => u !== userId); }
                }
                setArticle(prev => ({ ...prev, liked_by: liked, disliked_by: disliked }));
            }
        } catch (err) {
            console.error("Error voting on article:", err);
        }
    };

    const handleShare = async () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        try {
            const res = await fetch(`http://localhost:8000/api/articles/${id}/share`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setArticle(prev => ({ ...prev, shares: data.shares }));
            }
        } catch (e) { console.error(e); }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;

        try {
            const response = await fetch('http://localhost:8000/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 0, 
                    article_id: parseInt(id),
                    user: currentUser.displayName || 'Anonymous',
                    text: newComment,
                    date: new Date().toISOString(),
                })
            });
            if (response.ok) {
                setNewComment('');
                fetchArticle(); 
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
                    id: 0, 
                    article_id: parseInt(id),
                    user: currentUser.displayName || 'Anonymous',
                    text: replyText,
                    date: new Date().toISOString(),
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

    const handleCommentVote = async (commentId, type) => {
        const userId = getUserId();
        try {
            await fetch(`http://localhost:8000/api/comments/${commentId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, user_id: userId })
            });
            fetchArticle();
        } catch (err) {
            console.error("Error voting on comment:", err);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!isMod) return;
        if (window.confirm('Delete comment?')) {
            try {
                await fetch(`http://localhost:8000/api/comments/${commentId}?requester_email=${currentUser.email}`, { method: 'DELETE' });
                fetchArticle();
            } catch (err) { console.error(err); }
        }
    };

    const CommentItem = ({ comment, isReply = false }) => {
        const isCommentMod = comment.user.includes("Admin") || comment.user === "M.I.C. Research";
        const userId = getUserId();
        const userLiked = comment.liked_by && comment.liked_by.includes(userId);
        const userDisliked = comment.disliked_by && comment.disliked_by.includes(userId);

        return (
            <div className={`group ${isReply ? 'ml-8 mt-4 border-l-2 border-white/10 pl-4' : 'border-b border-purple-500/10 last:border-0 pb-6 last:pb-0'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold ${isCommentMod ? 'text-gold' : 'text-purple-300'}`}>{comment.user}</span>
                        {isCommentMod && <span className="text-[10px] font-bold bg-gold/20 text-gold px-1.5 py-0.5 rounded border border-gold/30">MOD</span>}
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500">{new Date(comment.date).toLocaleDateString()}</span>
                        {isMod && (
                            <button onClick={() => handleDeleteComment(comment.id)} className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <p className="text-gray-300 text-sm mb-3">{comment.text}</p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <button onClick={() => handleCommentVote(comment.id, 'up')} className={`flex items-center gap-1 transition-colors ${userLiked ? 'text-green-400 font-bold' : 'hover:text-green-400'}`}>
                        <ThumbsUp size={12} /> {comment.likes || 0}
                    </button>
                    <button onClick={() => handleCommentVote(comment.id, 'down')} className={`flex items-center gap-1 transition-colors ${userDisliked ? 'text-red-400 font-bold' : 'hover:text-red-400'}`}>
                        <ThumbsDown size={12} /> {comment.dislikes || 0}
                    </button>
                    {currentUser && !isReply && (
                        <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="flex items-center gap-1 hover:text-gold transition-colors">
                            <MessageSquare size={12} /> Reply
                        </button>
                    )}
                </div>

                {replyingTo === comment.id && (
                    <div className="mt-3 flex gap-2 animate-fade-in">
                        <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold outline-none" autoFocus />
                        <button onClick={() => handleReplySubmit(comment.id)} className="bg-gold text-black px-3 py-2 rounded-lg text-xs font-bold hover:bg-yellow-400 transition-colors">Reply</button>
                    </div>
                )}

                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-4">
                        {comment.replies.map(reply => <CommentItem key={reply.id} comment={reply} isReply={true} />)}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="min-h-screen pt-24 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div></div>;
    if (error || !article) return <div className="min-h-screen pt-24 text-center text-red-400">Error: {error || 'Article not found'}</div>;

    const isLiked = article.liked_by?.includes(getUserId());
    const isDisliked = article.disliked_by?.includes(getUserId());

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Link to="/news" className="inline-flex items-center text-gray-400 hover:text-gold mb-8 transition-colors"><ArrowLeft size={20} className="mr-2" /> Back to News</Link>
                <article className="bg-[#111] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                    <div className="p-8 sm:p-12">
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
                            <span className="flex items-center gap-1"><User size={14} /> {article.author}</span>
                            <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(article.date).toLocaleDateString()}</span>
                            <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full text-xs border border-purple-500/30">{article.category}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">{article.title}</h1>
                        <h2 className="text-xl text-gray-300 mb-6 font-light leading-relaxed">{article.subheading}</h2>
                        
                        {article.hashtags && (
                            <div className="flex flex-wrap gap-2 mb-8">
                                {article.hashtags.map((tag, index) => <span key={index} className="text-xs font-medium bg-white/5 text-gold px-3 py-1 rounded-full border border-white/10">#{tag}</span>)}
                            </div>
                        )}

                        {article.cover_image && <div className="mb-8 rounded-xl overflow-hidden border border-white/10"><img src={article.cover_image} alt={article.title} className="w-full h-auto object-cover" /></div>}
                        <div className="prose prose-invert max-w-none mb-12 text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: article.content }} />

                        <div className="flex items-center justify-between border-t border-white/10 pt-8">
                            <div className="flex items-center gap-6">
                                <button onClick={() => handleVote('up')} className={`flex items-center gap-2 transition-colors group ${isLiked ? 'text-green-400 font-bold' : 'text-gray-400 hover:text-green-400'}`}>
                                    <ThumbsUp size={20} className="group-hover:scale-110 transition-transform" /> <span>{article.likes}</span>
                                </button>
                                <button onClick={() => handleVote('down')} className={`flex items-center gap-2 transition-colors group ${isDisliked ? 'text-red-400 font-bold' : 'text-gray-400 hover:text-red-400'}`}>
                                    <ThumbsDown size={20} className="group-hover:scale-110 transition-transform" /> <span>{article.dislikes}</span>
                                </button>
                                <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 transition-colors ${showComments ? 'text-gold' : 'text-gray-400 hover:text-white'}`}>
                                    <MessageSquare size={20} /> <span>{article.comments ? article.comments.length : 0} Comments</span>
                                </button>
                            </div>
                            <button onClick={handleShare} className={`flex items-center gap-2 transition-colors ${copied ? 'text-green-400' : 'text-gray-400 hover:text-gold'}`}>
                                {copied ? <span className="text-sm font-bold">Link Copied!</span> : (
                                    <>
                                        <Copy size={20} />
                                        <span className="hidden sm:inline">Copy Link</span>
                                        <span className="bg-white/10 px-2 rounded text-xs">{article.shares}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showComments && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-[#0a0a0a] border-t border-white/10">
                                <div className="p-8 sm:p-12">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><MessageSquare size={20} className="text-gold" /> Discussion</h3>
                                    
                                    {currentUser ? (
                                        <form onSubmit={handleCommentSubmit} className="mb-10">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                                                </div>
                                                <div className="flex-1">
                                                    <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Share your insights..." className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:border-gold focus:ring-1 focus:ring-gold transition-all resize-none h-32" />
                                                    <div className="flex justify-end mt-2">
                                                        <button type="submit" disabled={!newComment.trim()} className="bg-gold text-black px-6 py-2 rounded-full font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center gap-2"><Send size={16} /> Post Comment</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="bg-white/5 rounded-xl p-6 text-center mb-10 border border-white/10">
                                            <p className="text-gray-300 mb-4">Login required to contribute to the discussion.</p>
                                            <div className="flex justify-center gap-4">
                                                <Link to="/login" className="text-gold hover:text-white font-medium transition-colors">Log In</Link>
                                                <span className="text-gray-600">|</span>
                                                <Link to="/signup" className="text-gold hover:text-white font-medium transition-colors">Sign Up</Link>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {article.comments && article.comments.length > 0 ? (
                                            article.comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)
                                        ) : (
                                            <p className="text-center text-gray-500 py-8">No comments yet.</p>
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