import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, PieChart, Activity } from 'lucide-react';

const WizardPreview = ({ toolType, isAnalyzing }) => {
    if (isAnalyzing) {
        return (
            <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-t-gold border-r-transparent border-b-transparent border-l-transparent rounded-full"
                    />
                </div>
                <h3 className="text-xl text-gold font-bold mb-2">Analyzing Market Data</h3>
                <p className="text-gray-400">Processing algorithms and optimizing allocation...</p>
            </div>
        );
    }

    return (
        <div className="text-center opacity-50">
            <div className="mb-6 flex justify-center gap-4">
                <BarChart size={48} className="text-gray-600" />
                <PieChart size={48} className="text-gray-600" />
                <Activity size={48} className="text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Ready to Analyze</h3>
            <p className="text-gray-400 max-w-md mx-auto">
                Configure the parameters on the left panel and click "Run Analysis" to generate your optimized strategy.
            </p>

            {/* Decorative Grid */}
            <div className="absolute inset-0 z-[-1] opacity-10"
                style={{
                    backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />
        </div>
    );
};

export default WizardPreview;