import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import NewsFeed from '../components/NewsFeed';
import CreateArticleModal from '../components/CreateArticleModal';
import { useAuth } from '../contexts/AuthContext';

const NewsPage = () => {
    const { currentUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Hardcoded Admin Email for now, should be replaced with a proper role check
    const ADMIN_EMAIL = 'marketinsightscenter@gmail.com';

    useEffect(() => {
        if (currentUser) {
            if (currentUser.email === ADMIN_EMAIL) {
                setIsAdmin(true);
                return;
            }
            // Check remote admin list
            fetch('/api/admins')
                .then(res => res.json())
                .then(data => {
                    if (data.admins && data.admins.includes(currentUser.email)) {
                        setIsAdmin(true);
                    }
                })
                .catch(err => console.error("Error checking admin status:", err));
        }
    }, [currentUser]);

    const handleArticleCreated = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-12 border-b border-white/10 pb-8">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-5xl font-bold mb-2"
                        >
                            M.I.C.K.S. <span className="text-gold">NEWS</span>
                        </motion.h1>
                        <p className="text-xl text-gray-400">Market Insights Center Knowledge Stream</p>
                    </div>
                    {isAdmin && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsModalOpen(true)}
                            className="bg-gold text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-500 transition-colors"
                        >
                            <Plus size={20} />
                            Write Article
                        </motion.button>
                    )}
                </div>

                <NewsFeed key={refreshTrigger} />

                <CreateArticleModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onArticleCreated={handleArticleCreated}
                    user={currentUser}
                />
            </div>
        </div>
    );
};

export default NewsPage;