import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, ThumbsUp } from 'lucide-react';

const ArticleCard = React.forwardRef(({ article, style, className, onClick, onMouseEnter, onMouseLeave, ...props }, ref) => {
    return (
        <div
            ref={ref}
            style={style}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`cursor-pointer absolute top-1/2 left-1/2 ${className || ''}`}
            {...props}
        >
            <div className="absolute top-0 left-0 w-1 h-full bg-gold/0 group-hover:bg-gold/100 transition-all duration-300 z-20" />

            <Link to={`/article/${article.id}`} className="flex flex-col h-full">
                <div className="h-48 overflow-hidden relative shrink-0">
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                    <img
                        src={article.cover_image || "https://images.unsplash.com/photo-1611974765270-ca12586343bb?auto=format&fit=crop&q=80&w=1000"}
                        alt={article.title}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                </div>

                <div className="p-6 flex flex-col flex-grow bg-deep-black/80 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-bold text-gold uppercase tracking-wider border border-gold/20 px-2 py-1 rounded">
                            {article.category || "Insight"}
                        </span>
                        <div className="flex items-center text-gray-500 text-[10px]">
                            <Clock size={12} className="mr-1" />
                            {article.date ? new Date(article.date).toLocaleDateString() : 'Recent'}
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-3 group-hover:text-gold transition-colors line-clamp-2">
                        {article.title}
                    </h3>

                    <p className="text-gray-400 text-xs mb-6 flex-grow line-clamp-3 leading-relaxed">
                        {article.subheading || (article.content ? article.content.replace(/<[^>]+>/g, '').substring(0, 80) + '...' : '')}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                        <div className="flex items-center text-gray-500 text-xs">
                            <ThumbsUp size={12} className="mr-1" />
                            {article.likes || 0}
                        </div>
                        <div className="text-xs font-bold text-gold flex items-center group-hover:translate-x-1 transition-transform">
                            Read <ArrowRight size={14} className="ml-1" />
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
});

export default ArticleCard;
