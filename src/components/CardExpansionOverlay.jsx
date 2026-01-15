import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { useCardExpansion } from '../contexts/CardExpansionContext';

const CardExpansionOverlay = () => {
    const { expandedArticle, reset } = useCardExpansion();
    const navigate = useNavigate();
    const location = useLocation();

    // -- NAVIGATION LOGIC --
    useEffect(() => {
        if (expandedArticle) {
            // WAIT for the expansion to feel "done" (600ms) before triggering the route change.
            // If we trigger too early (e.g. 100ms), the browser freezes slightly/redirects 
            // while the animation is flying, causing the "reload" jerk.
            const timer = setTimeout(() => {
                navigate(`/article/${expandedArticle.id}`, { state: { initialArticle: expandedArticle } });
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [expandedArticle, navigate]);

    // -- DISMISS LOGIC --
    useEffect(() => {
        if (expandedArticle && location.pathname === `/article/${expandedArticle.id}`) {
            // Route has changed. 
            // Keep the overlay for a split second longer to ensure the new page 
            // is painted and ready underneath. 
            // Then fade out (reset).
            const timer = setTimeout(() => {
                reset();
            }, 800); // Increased to 800ms to cover "mode=wait" transition gap
            return () => clearTimeout(timer);
        }
    }, [location, expandedArticle, reset]);

    if (!expandedArticle) return null;

    const article = expandedArticle;
    const formattedDate = article.date ? new Date(article.date).toLocaleDateString() : 'Recent';
    const category = article.category || "Insight";

    // Smooth Spring Physics
    const transition = { type: "spring", stiffness: 200, damping: 25, mass: 1 };

    return (
        <AnimatePresence>
            {expandedArticle && (
                <div className="fixed inset-0 z-[9999] pointer-events-none">

                    {/* Background Fills Screen */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#0a0a0a] pointer-events-auto"
                    />

                    {/* Content Scroll Container */}
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar pointer-events-auto">
                        {/* Centered Content Wrapper: Matches Article Page Layout */}
                        <div className="max-w-4xl mx-auto pt-24 px-4 pb-20 w-full">

                            {/* EXPANDING CARD ROOT */}
                            <motion.div
                                layoutId={`card-${article.id}-global`}
                                className="w-full flex flex-col relative"
                                transition={transition}
                            >
                                {/* IMAGE WRAPPER */}
                                <motion.div
                                    layoutId={`image-wrapper-${article.id}-global`}
                                    className="mb-8 rounded-xl overflow-hidden border border-white/10 shadow-2xl h-[400px] md:h-[500px] relative w-full shrink-0"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                                    <motion.img
                                        layoutId={`image-${article.id}-global`}
                                        src={article.cover_image || "https://images.unsplash.com/photo-1611974765270-ca12586343bb?auto=format&fit=crop&q=80&w=1000"}
                                        alt={article.title}
                                        className="w-full h-full object-cover"
                                    />
                                </motion.div>

                                {/* CONTENT */}
                                <div className="mb-8">
                                    {/* Back Link Placeholder */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                        className="text-gold mb-6 inline-flex items-center text-sm font-bold"
                                    >
                                        <ArrowRight className="rotate-180 mr-2" size={16} /> Back to Stream
                                    </motion.div>

                                    {/* Title Morph */}
                                    <motion.h3
                                        layoutId={`title-${article.id}-global`}
                                        className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight"
                                    >
                                        {article.title}
                                    </motion.h3>

                                    {/* Subheading */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <div className="flex gap-2 mb-4 flex-wrap">
                                            {article.hashtags?.map((tag, i) => (
                                                <span key={i} className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded">#{tag}</span>
                                            )) || <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded">#MarketInsight</span>}
                                        </div>

                                        <motion.p
                                            layoutId={`description-${article.id}-global`}
                                            className="text-xl md:text-2xl text-gray-300 font-light leading-relaxed border-l-4 border-gold pl-6 py-2"
                                        >
                                            {article.subheading || "Analysis Loading..."}
                                        </motion.p>
                                    </motion.div>
                                </div>

                                {/* Meta Bar */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex flex-wrap items-center justify-between gap-6 py-6 border-y border-white/10 mb-12"
                                >
                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                        <span className="font-bold text-white">{article.author || "Orion Analyst"}</span>
                                        <span>•</span>
                                        <span>{formattedDate}</span>
                                    </div>
                                    <motion.span
                                        layoutId={`category-${article.id}-global`}
                                        className="text-[10px] font-bold text-gold uppercase tracking-wider border border-gold/20 px-2 py-1 rounded"
                                    >
                                        {category}
                                    </motion.span>
                                </motion.div>

                                {/* Body Placeholder */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="prose prose-invert prose-lg max-w-none text-gray-500"
                                >
                                    <p>Loading full article content...</p>
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CardExpansionOverlay;
