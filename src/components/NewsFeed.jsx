import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ArticleCard from './ArticleCard';
import { Link } from 'react-router-dom'; // Assuming Link is from react-router-dom
import { Clock, ThumbsUp, ArrowRight } from 'lucide-react'; // Assuming these icons are from lucide-react

const NewsFeed = ({ limit = 3, compact = false, articles: providedArticles }) => {
    const [articles, setArticles] = useState(providedArticles || []);
    const [loading, setLoading] = useState(!providedArticles);

    useEffect(() => {
        if (providedArticles) {
            setArticles(providedArticles);
            setLoading(false);
            return;
        }

        // Fetch using the limit prop so it's dynamic
        fetch(`/api/articles?limit=${limit}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setArticles(data);
                } else {
                    console.error("API did not return an array", data);
                    setArticles([]);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching articles:", err);
                setLoading(false);
            });
    }, [limit, providedArticles]);

    if (loading) {
        return (
            <div className={`w-full ${!compact ? 'py-16' : 'py-8'} text-center`}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold mx-auto"></div>
            </div>
        );
    }

    if (articles.length === 0) {
        return (
            <div className="py-8 text-center text-gray-500">
                No articles found.
            </div>
        );
    }

    const ContentWrapper = compact ? 'div' : 'section';
    const wrapperClass = compact ? '' : 'py-16 px-4 bg-deep-black border-t border-white/5';

    return (
        <ContentWrapper className={wrapperClass}>
            <div className={!compact ? 'max-w-7xl mx-auto' : ''}>
                {!compact && (
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                                M.I.C.K.S. <span className="text-gold text-lg font-normal tracking-widest ml-2">(NEWS STREAM)</span>
                            </h2>
                            <p className="text-gray-400">Market Insights Center Knowledge Stream</p>
                        </div>
                    </div>
                )}

                <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-3'} gap-8`}>
                    {articles.map((article, index) => (
                        <div key={article.id} className="h-[450px]">
                            <ArticleCard article={article} />
                        </div>
                    ))}
                </div>
            </div>
        </ContentWrapper>
    );
};

export default NewsFeed;