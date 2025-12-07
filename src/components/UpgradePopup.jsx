import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const UpgradePopup = ({ isOpen, onClose, featureName }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-gray-900 border border-gold/30 rounded-2xl p-8 max-w-md w-full relative shadow-[0_0_50px_rgba(212,175,55,0.2)]"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>

                    <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mb-6 mx-auto text-gold border border-gold/20">
                        <Lock size={32} />
                    </div>

                    <h2 className="text-2xl font-bold text-center mb-2 px-4 whitespace-normal">
                        Unlock {featureName}
                    </h2>

                    <p className="text-gray-400 text-center mb-8">
                        This feature is available exclusively to Pro tier members and above. Upgrade your plan to access advanced market tools.
                    </p>

                    <div className="space-y-3">
                        <Link
                            to="/profile"
                            className="block w-full py-3 bg-gold text-black font-bold text-center rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                        >
                            <Zap size={18} /> Upgrade Now
                        </Link>
                        <button
                            onClick={onClose}
                            className="block w-full py-3 bg-transparent text-gray-400 font-bold text-center rounded-lg hover:text-white transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default UpgradePopup;
