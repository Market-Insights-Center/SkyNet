import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Siren, History, Activity, Lock } from 'lucide-react';
import RiskTool from '../components/RiskTool';
import HistoryTool from '../components/HistoryTool';
import { useAuth } from '../contexts/AuthContext';

const MarketNexus = () => {
    const { userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('risk');

    // Tier Access Logic (Pro and above)
    // Tier Access Logic (Pro and above)
    // Ensure userProfile exists and has a tier property
    const hasAccess = userProfile && userProfile.tier && ['Pro', 'Visionary', 'Institutional', 'Enterprise', 'Singularity'].includes(userProfile.tier);

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-deep-black text-white pt-24 px-4 flex items-center justify-center">
                <div className="text-center max-w-lg">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Lock size={40} className="text-gray-400" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
                    <p className="text-gray-400 mb-8">
                        The Market Nexus is available exclusively to Pro tier members and above. Upgrade your plan to unlock these advanced market analysis tools.
                    </p>
                    <button className="px-8 py-3 bg-gold text-black font-bold rounded-full hover:bg-yellow-500 transition-colors">
                        Upgrade Plan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-12">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center text-gold">
                            <Siren size={24} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold">Market Nexus</h1>
                            <p className="text-gray-400">Advanced market risk analysis and historical tracking.</p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-4 border-b border-white/10 pb-1">
                        <button
                            onClick={() => setActiveTab('risk')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'risk'
                                ? 'border-gold text-gold'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Activity size={18} />
                            Risk Command
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'history'
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <History size={18} />
                            History Command
                        </button>
                    </div>
                </motion.div>

                {/* Content Area */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'risk' ? <RiskTool /> : <HistoryTool />}
                </motion.div>
            </div>
        </div>
    );
};

export default MarketNexus;
