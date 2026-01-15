import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, ThumbsUp } from 'lucide-react';
import { useCardExpansion } from '../contexts/CardExpansionContext';

// Utility for class merging
const cn = (...classes) => classes.filter(Boolean).join(" ");

const ArticleCard = ({ article, className }) => {
    const { expandArticle } = useCardExpansion();
    const id = useId();

    const formattedDate = article.date ? new Date(article.date).toLocaleDateString() : 'Recent';
    const category = article.category || "Insight";

    // Standard Framer Motion spring for natural feel
    // Using layoutId is key for the shared element transition
    return (
        <motion.div
            layoutId={`card-${article.id}-global`}
            onClick={() => expandArticle(article)}
            className={cn(
                "cursor-pointer group relative w-full h-full flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-gold/50 transition-colors",
                className
            )}
        >
            {/* Image Wrapper - Matches Reference Structure */}
            <motion.div
                layoutId={`image-wrapper-${article.id}-global`}
                className="h-48 overflow-hidden relative shrink-0"
            >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                <motion.img
                    layoutId={`image-${article.id}-global`}
                    src={article.cover_image || "https://images.unsplash.com/photo-1611974765270-ca12586343bb?auto=format&fit=crop&q=80&w=1000"}
                    alt={article.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                />
            </motion.div>

            {/* Content Section */}
            <div className="p-6 flex flex-col flex-1 bg-[#121212] backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                    <motion.span
                        layoutId={`category-${article.id}-global`}
                        className="text-[10px] font-bold text-gold uppercase tracking-wider border border-gold/20 px-2 py-1 rounded"
                    >
                        {category}
                    </motion.span>
                    <div className="flex items-center text-gray-500 text-[10px]">
                        <Clock size={12} className="mr-1" />
                        {formattedDate}
                    </div>
                </div>

                <motion.h3
                    layoutId={`title-${article.id}-global`}
                    className="text-lg font-bold text-white mb-3 group-hover:text-gold transition-colors line-clamp-2"
                >
                    {article.title}
                </motion.h3>

                <motion.p
                    layoutId={`description-${article.id}-global`}
                    className="text-gray-400 text-xs mb-6 flex-grow line-clamp-3 leading-relaxed"
                >
                    {article.subheading || (article.content ? article.content.replace(/<[^>]+>/g, '').substring(0, 80) + '...' : '')}
                </motion.p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center text-gray-500 text-xs">
                        <ThumbsUp size={12} className="mr-1" />
                        {article.likes || 0}
                    </div>
                    <div className="text-xs font-bold text-gold flex items-center group-hover:translate-x-1 transition-transform">
                        Expand <ArrowRight size={14} className="ml-1" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default ArticleCard;
