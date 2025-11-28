import React from 'react';
import { motion } from 'framer-motion';
import NewsFeed from '../components/NewsFeed'; // Ensure this path matches where you saved the file above

const NewsPage = () => {
    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl font-bold mb-4"
                    >
                        MARKET <span className="text-gold">NEWS</span>
                    </motion.h1>
                    <p className="text-xl text-gray-400">Complete Knowledge Stream & Analysis</p>
                </div>

                {/* We reuse the NewsFeed component but set a high limit to show everything */}
                <NewsFeed limit={100} />
            </div>
        </div>
    );
};

export default NewsPage;