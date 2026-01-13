import React, { createContext, useContext, useState, useCallback } from 'react';

const CardExpansionContext = createContext();

export const useCardExpansion = () => useContext(CardExpansionContext);

export const CardExpansionProvider = ({ children }) => {
    const [expandedArticle, setExpandedArticle] = useState(null);
    const [isExpanding, setIsExpanding] = useState(false);

    const expandArticle = useCallback((article) => {
        setIsExpanding(true);
        setExpandedArticle(article);
    }, []);

    const closeArticle = useCallback(() => {
        setIsExpanding(false);
        // Delay clearing the article data to allow close animation if needed,
        // or just clear it immediately if we want to reset.
        // For transitions to page, we might clear it once page is ready.
        setTimeout(() => setExpandedArticle(null), 500);
    }, []);

    // Immediate clear for hard resets
    const reset = useCallback(() => {
        setExpandedArticle(null);
        setIsExpanding(false);
    }, []);

    return (
        <CardExpansionContext.Provider value={{ expandedArticle, isExpanding, expandArticle, closeArticle, reset }}>
            {children}
        </CardExpansionContext.Provider>
    );
};
