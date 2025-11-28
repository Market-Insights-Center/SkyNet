import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CreateIdeaModal from '../components/CreateIdeaModal';
import IdeaCard from '../components/IdeaCard';

const IdeasPage = () => {
    const { currentUser } = useAuth();
    const [ideas, setIdeas] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchIdeas = async () => {
        try {
            // UPDATED PORT: 8001
            const res = await fetch('/api/ideas');
            const data = await res.json();
            setIdeas(data);
        } catch (error) {
            console.error("Error fetching ideas:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIdeas();
    }, []);

    const handleVote = async (ideaId, type) => {
        if (!currentUser) {
            alert("Please login to vote");
            return;
        }
        try {
            // UPDATED PORT: 8001
            const res = await fetch(`/api/ideas/${ideaId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.email, vote_type: type })
            });
            if (res.ok) {
                fetchIdeas(); // Refresh to show new counts
            }
        } catch (error) {
            console.error("Error voting:", error);
        }
    };

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-end mb-12 border-b border-white/10 pb-8">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-5xl font-bold mb-2"
                        >
                            M.I.C. <span className="text-gold">IDEAS</span>
                        </motion.h1>
                        <p className="text-xl text-gray-400">Community trading setups and analysis</p>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            if (!currentUser) {
                                alert("Please login to post an idea");
                                return;
                            }
                            setIsModalOpen(true);
                        }}
                        className="bg-gold text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-500 transition-colors"
                    >
                        <Plus size={20} />
                        Share Idea
                    </motion.button>
                </div>

                {/* Ideas Grid */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading ideas...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {ideas.map((idea) => (
                            <IdeaCard
                                key={idea.id}
                                idea={idea}
                                currentUser={currentUser}
                                onVote={handleVote}
                            />
                        ))}
                    </div>
                )}

                <CreateIdeaModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onIdeaCreated={fetchIdeas}
                    user={currentUser}
                />
            </div>
        </div>
    );
};

export default IdeasPage;