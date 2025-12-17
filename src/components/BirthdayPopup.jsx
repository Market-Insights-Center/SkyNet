import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Star } from 'lucide-react';
import Confetti from 'react-confetti';

const BirthdayPopup = ({ isOpen, onClose, years }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <Confetti numberOfPieces={200} recycle={false} />
            <motion.div
                initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="relative bg-gradient-to-br from-gray-900 to-black border border-gold/50 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(255,215,0,0.3)]"
            >
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
                    <div className="w-24 h-24 bg-gold rounded-full flex items-center justify-center shadow-lg border-4 border-black">
                        <Gift size={48} className="text-black animate-bounce" />
                    </div>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <h2 className="text-3xl font-bold mt-10 mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gold via-yellow-200 to-gold">
                    Happy Anniversary!
                </h2>

                <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                    You've been a member of the Singularity for <span className="font-bold text-gold">{years} {years === 1 ? 'Year' : 'Years'}</span>!
                </p>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Star className="text-gold fill-gold" size={20} />
                        <span className="font-bold text-white">Loyalty Milestone Reached</span>
                        <Star className="text-gold fill-gold" size={20} />
                    </div>
                    <p className="text-sm text-gray-400">
                        Thank you for being part of our journey. Here's to another year of market dominance.
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-yellow-400 transition-all transform hover:scale-105 shadow-lg"
                >
                    Continue to Dashboard
                </button>
            </motion.div>
        </div>
    );
};

export default BirthdayPopup;
