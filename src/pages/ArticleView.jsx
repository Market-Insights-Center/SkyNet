import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, ArrowRight, Send, X, Copy, Mail, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ArticleView = () => {
    const { id } = useParams();
    const { currentUser } = useAuth();
    const [article, setArticle] = useState(null);
    const [userVote, setUserVote] = useState(null);
    // FIX: Initialize with 0 to prevent NaN if fetch delays
    const [likes, setLikes] = useState(0);
    const [dislikes, setDislikes] = useState(0);
    const [shares, setShares] = useState(0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mods, setMods] = useState([]);
    const [isMod, setIsMod] = useState(false);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailTo, setEmailTo] = useState('');

    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
        // Fetch Mods
        fetch('/api/mods')
            .then(res => res.json())
            .then(data => {
                setMods(data.mods || []);
                if (currentUser && data.mods.includes(currentUser.email)) {
                    setIsMod(true);
                }
            })
            .catch(err => console.error("Error fetching mods:", err));

        // Fetch Article
        fetch(`/api/articles/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Article not found");
                return res.json();
            })
            .then(data => {
                setArticle(data);
                // FIX: Fallback to 0 if data is missing
                setLikes(data.likes || 0);
                setDislikes(data.dislikes || 0);
                setShares(data.shares || 0);
                setComments(data.comments || []);

                if (currentUser) {
                    if (data.liked_by && data.liked_by.includes(currentUser.uid)) setUserVote('up');
                    else if (data.disliked_by && data.disliked_by.includes(currentUser.uid)) setUserVote('down');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching article:", err);
                setLoading(false);
            });
    }, [id, currentUser]);

    const handleVote = (type) => {
        if (!currentUser) return;

        const prevVote = userVote;
        const prevLikes = likes;
        const prevDislikes = dislikes;

        // Optimistic UI Update
        if (userVote === type) {
            setUserVote(null);
            if (type === 'up') setLikes(prev => Math.max(0, prev - 1));
            else setDislikes(prev => Math.max(0, prev - 1));
        } else {
            if (userVote === 'up') setLikes(prev => Math.max(0, prev - 1));
            if (userVote === 'down') setDislikes(prev => Math.max(0, prev - 1));

            setUserVote(type);
            if (type === 'up') setLikes(prev => prev + 1);
            else setDislikes(prev => prev + 1);
        }

        fetch(`/api/articles/${id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.uid, vote_type: type })
        }).catch(err => {
            console.error("Error voting:", err);
            // Revert on error
            setUserVote(prevVote);
            setLikes(prevLikes);
            setDislikes(prevDislikes);
        });
    };

    const handleShareOption = (option) => {
        setShowShareMenu(false);

        if (option === 'copy') {
            navigator.clipboard.writeText(window.location.href);
            alert("Link copied to clipboard!");

            // Increment share count for copy
            fetch(`/api/articles/${id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'clipboard' })
            })
                .then(res => res.json())
                .then(data => setShares(data.shares || 0))
                .catch(err => console.error("Error sharing:", err));

        } else if (option === 'email') {
            setShowEmailModal(true);
        }
    };

    const sendEmail = (e) => {
        e.preventDefault();
        if (!emailTo) return;

        fetch(`/api/articles/${id}/share/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailTo,
                sender_name: currentUser ? currentUser.displayName || currentUser.email : "A User",
                article_link: window.location.href,
                article_title: article.title
            })
        })
            .then(res => res.json())
            .then(() => {
                alert(`Email sent to ${emailTo}!`);
                setShowEmailModal(false);
                setEmailTo('');
                setShares(prev => prev + 1); // Optimistic update
            })
            .catch(err => {
                console.error("Error sending email:", err);
                alert("Failed to send email.");
            });
    };

    const handleCommentSubmit = (e, parentId = null) => {
        e.preventDefault();
        const text = parentId ? replyText : newComment;
        if (!text.trim() || !currentUser) return;

        const commentData = {
            id: Date.now(),
            article_id: parseInt(id), // Ensure this matches backend expectation
            user: currentUser.displayName || currentUser.email.split('@')[0],
            email: currentUser.email,
            text: text,
            date: new Date().toISOString(),
            replies: []
        };

        if (parentId) {
            const updateComments = (commentsList) => {
                return commentsList.map(c => {
                    if (c.id === parentId) {
                        return { ...c, replies: [...(c.replies || []), commentData] };
                    } else if (c.replies && c.replies.length > 0) {
                        return { ...c, replies: updateComments(c.replies) };
                    }
                    return c;
                });
            };
            setComments(updateComments(comments));
            setReplyingTo(null);
            setReplyText('');
        } else {
            setComments([commentData, ...comments]);
            setNewComment('');
        }

        fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commentData)
        }).catch(err => console.error("Error posting comment:", err));
    };

    const handleDeleteComment = (commentId) => {
        if (isMod) {
            // Optimistic UI Removal
            const deleteFromList = (list) => {
                return list.filter(c => c.id !== commentId).map(c => ({
                    ...c,
                    replies: c.replies ? deleteFromList(c.replies) : []
                }));
            };
            setComments(deleteFromList(comments));

            fetch(`/api/comments/${commentId}?requester_email=${currentUser.email}`, {
                method: 'DELETE'
            }).catch(err => {
                console.error("Error deleting comment:", err);
                alert("Failed to delete comment on server.");
            });
        }
    };

    const renderComments = (commentsList, depth = 0) => {
        return commentsList.map((comment) => {
            const isCommentMod = mods.includes(comment.email);
            return (
                <div key={comment.id} className={`border-b border-purple-500/10 last:border-0 pb-6 last:pb-0 group ${depth > 0 ? 'ml-8 mt-4 border-l-2 border-purple-500/20 pl-4' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-purple-300">{comment.user}</span>
                            {isCommentMod && (
                                <span className="text-[10px] font-bold bg-gold/20 text-gold px-1.5 py-0.5 rounded border border-gold/30 tracking-wider">
                                    Admin
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">{new Date(comment.date).toLocaleDateString()}</span>
                            {currentUser && (
                                <button
                                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                    className="text-xs text-gold hover:text-white transition-colors"
                                >
                                    Reply
                                </button>
                            )}
                            {isMod && (
                                <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Comment"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="text-gray-300 mb-2">{comment.text}</p>

                    {replyingTo === comment.id && (
                        <form onSubmit={(e) => handleCommentSubmit(e, comment.id)} className="mt-4 mb-4 flex gap-2">
                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="flex-1 bg-black/30 border border-purple-500/30 rounded-lg p-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-500 transition-colors"
                                disabled={!replyText.trim()}
                            >
                                Reply
                            </button>
                        </form>
                    )}

                    {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-4">
                            {renderComments(comment.replies, depth + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-deep-black flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-deep-black flex items-center justify-center text-white">
                <p>Article not found.</p>
            </div>
        );
    }

    // ... (Remainder of the return statement is unchanged)
    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-20 relative">

            {/* Email Share Modal */}
            <AnimatePresence>
                {showEmailModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
                    >
                        <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 w-full max-w-md shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Mail className="text-gold" size={20} /> Share via Email
                                </h3>
                                <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={sendEmail}>
                                <label className="block text-sm text-gray-400 mb-1">To:</label>
                                <input
                                    type="email"
                                    placeholder="recipient@example.com"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 mb-6 text-white focus:border-gold outline-none"
                                    value={emailTo}
                                    onChange={e => setEmailTo(e.target.value)}
                                    required
                                    autoFocus
                                />

                                <div className="bg-white/5 p-4 rounded-lg border border-white/5 mb-6">
                                    <p className="text-xs text-gray-500 mb-1">Preview:</p>
                                    <p className="text-sm text-white font-bold mb-1">{currentUser ? (currentUser.displayName || currentUser.email) : "A User"} shared this article with you...</p>
                                    <p className="text-xs text-blue-400 truncate">{article.title}</p>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowEmailModal(false)}
                                        className="px-4 py-2 text-gray-400 hover:text-white font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-gold text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2"
                                    >
                                        Send Email <Send size={14} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <article className="max-w-4xl mx-auto">
                {/* Hero Image */}
                {article.cover_image && (
                    <div className="mb-8 rounded-xl overflow-hidden border border-white/10 shadow-2xl h-[400px] md:h-[500px] relative w-full">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                        <img src={article.cover_image} alt="Cover" className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <Link to="/news" className="text-gold hover:text-white transition-colors mb-6 inline-flex items-center text-sm font-bold">
                        <ArrowRight className="rotate-180 mr-2" size={16} /> Back to Stream
                    </Link>
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">{article.title}</h1>
                    {article.hashtags && article.hashtags.length > 0 && (
                        <div className="flex gap-2 mb-4 flex-wrap">
                            {article.hashtags.map((tag, i) => (
                                <span key={i} className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded">#{tag}</span>
                            ))}
                        </div>
                    )}
                    <p className="text-xl md:text-2xl text-gray-300 font-light leading-relaxed border-l-4 border-gold pl-6 py-2">
                        {article.subheading}
                    </p>
                </div>

                {/* Meta & Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-6 py-6 border-y border-white/10 mb-12">
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="font-bold text-white">{article.author}</span>
                        <span>•</span>
                        <span>{new Date(article.date).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Thumbs Up */}
                        <button
                            onClick={() => handleVote('up')}
                            disabled={!currentUser}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${userVote === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 hover:bg-white/10 text-gray-400'} ${!currentUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={!currentUser ? "Login to vote" : ""}
                        >
                            <ThumbsUp size={20} className={userVote === 'up' ? 'fill-current' : ''} />
                            <span className="font-bold">{likes}</span>
                        </button>

                        {/* Thumbs Down */}
                        <button
                            onClick={() => handleVote('down')}
                            disabled={!currentUser}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${userVote === 'down' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 hover:bg-white/10 text-gray-400'} ${!currentUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={!currentUser ? "Login to vote" : ""}
                        >
                            <ThumbsDown size={20} className={userVote === 'down' ? 'fill-current' : ''} />
                            <span className="font-bold">{dislikes}</span>
                        </button>

                        {/* Comment Toggle */}
                        <button
                            onClick={() => setShowComments(!showComments)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${showComments ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
                        >
                            <MessageCircle size={20} className={showComments ? 'fill-current' : ''} />
                            <span className="font-bold">{comments.length}</span>
                        </button>

                        {/* Share Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowShareMenu(!showShareMenu)}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 transition-all"
                            >
                                <Share2 size={20} />
                                <span className="font-bold">{shares}</span>
                            </button>

                            <AnimatePresence>
                                {showShareMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                                    >
                                        <div className="p-2 space-y-1">
                                            <button
                                                onClick={() => handleShareOption('copy')}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg text-left text-sm text-gray-300 hover:text-white transition-colors"
                                            >
                                                <Copy size={16} /> Copy Link
                                            </button>
                                            <button
                                                onClick={() => handleShareOption('email')}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg text-left text-sm text-gray-300 hover:text-white transition-colors"
                                            >
                                                <Mail size={16} /> Email
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Article Content */}
                <div
                    className="prose prose-invert prose-lg max-w-none mb-16 text-gray-300 leading-loose"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                />

                {/* Comments Section */}
                <AnimatePresence>
                    {showComments && (
                        <motion.section
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-purple-900/10 border border-purple-500/20 rounded-2xl p-8 overflow-hidden"
                        >
                            <h3 className="text-2xl font-bold text-purple-400 mb-6 flex items-center">
                                <MessageCircle className="mr-3" /> Discussion
                            </h3>

                            {currentUser ? (
                                <form onSubmit={(e) => handleCommentSubmit(e)} className="mb-8 relative">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Share your thoughts..."
                                        className="w-full bg-black/30 border border-purple-500/30 rounded-xl p-4 pr-12 text-white focus:border-purple-500 focus:outline-none min-h-[100px] resize-none"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute bottom-4 right-4 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={!newComment.trim()}
                                    >
                                        <Send size={18} />
                                    </button>
                                </form>
                            ) : (
                                <div className="mb-8 p-6 bg-black/30 border border-white/10 rounded-xl text-center">
                                    <p className="text-gray-400 mb-4">Please sign in to join the discussion.</p>
                                    <Link to="/login" className="inline-block bg-gold text-black px-6 py-2 rounded-lg font-bold hover:bg-yellow-500 transition-colors">
                                        Sign In
                                    </Link>
                                </div>
                            )}

                            <div className="space-y-6">
                                {comments.length > 0 ? (
                                    renderComments(comments)
                                ) : (
                                    <p className="text-center text-gray-500 italic">No comments yet. Be the first to start the discussion.</p>
                                )}
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </article>
        </div>
    );
};

export default ArticleView;