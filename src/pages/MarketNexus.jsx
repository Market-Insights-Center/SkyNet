import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Siren, History, Activity, Lock, Globe } from 'lucide-react';
import RiskTool from '../components/RiskTool';
import HistoryTool from '../components/HistoryTool';
import BriefingTool from '../components/BriefingTool';
import UpgradePopup from '../components/UpgradePopup';
import { useAuth } from '../contexts/AuthContext';

const MarketNexus = () => {
    const { userProfile } = useAuth();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('risk');
    const [showUpgradePopup, setShowUpgradePopup] = useState(false);
    const [targetFeature, setTargetFeature] = useState('');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'history' || tab === 'risk' || tab === 'briefing') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // --- TIER ACCESS LOGIC ---
    // Basic: Risk (YES), History (NO), Briefing (NO - based on csv NA)
    // Pro/Enterprise/Singularity: Risk (YES), History (YES), Briefing (YES)

    const tier = userProfile?.tier || 'Basic';

    // Define capabilities
    const hasRiskAccess = ['Basic', 'Pro', 'Enterprise', 'Singularity', 'Visionary', 'Institutional'].includes(tier);
    const hasHistoryAccess = ['Pro', 'Enterprise', 'Singularity', 'Visionary', 'Institutional'].includes(tier);
    const hasBriefingAccess = ['Pro', 'Enterprise', 'Singularity', 'Visionary', 'Institutional'].includes(tier);

    // Initial check: If user has NO access to ANY, block them.
    const hasAnyAccess = hasRiskAccess || hasHistoryAccess || hasBriefingAccess;

    const handleTabChange = (tab) => {
        if (tab === 'history' && !hasHistoryAccess) {
            setTargetFeature('History Command');
            setShowUpgradePopup(true);
            return;
        }
        if (tab === 'briefing' && !hasBriefingAccess) {
            setTargetFeature('Market Briefing');
            setShowUpgradePopup(true);
            return;
        }
        if (tab === 'risk' && !hasRiskAccess) {
            setTargetFeature('Risk Command');
            setShowUpgradePopup(true);
            return;
        }
        setActiveTab(tab);
    };

    if (!userProfile) return null; // Wait for auth

    if (!hasAnyAccess) {
        return (
            <div className="min-h-screen bg-deep-black text-white pt-24 px-4 flex items-center justify-center">
                <div className="text-center max-w-lg">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gold/20">
                        <Lock size={40} className="text-gold" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
                    <p className="text-gray-400 mb-8">
                        The Market Nexus is available to subscribed members. Please upgrade your plan to unlock these advanced market analysis tools.
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
            <UpgradePopup
                isOpen={showUpgradePopup}
                onClose={() => setShowUpgradePopup(false)}
                featureName={targetFeature}
            />

            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center text-gold border border-gold/20">
                            <Siren size={24} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold">Market Nexus</h1>
                            <p className="text-gray-400">Advanced market risk analysis, historical tracking, and daily intelligence.</p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-4 border-b border-white/10 pb-1 overflow-x-auto">
                        <button
                            onClick={() => handleTabChange('risk')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'risk'
                                ? 'border-gold text-gold'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Activity size={18} />
                            Risk Command
                        </button>
                        <button
                            onClick={() => handleTabChange('history')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'history'
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            {hasHistoryAccess ? <History size={18} /> : <Lock size={14} />}
                            History Command
                        </button>
                        <button
                            onClick={() => handleTabChange('briefing')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'briefing'
                                ? 'border-blue-400 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            {hasBriefingAccess ? <Globe size={18} /> : <Lock size={14} />}
                            Briefing
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
                    {activeTab === 'risk' && <RiskTool />}
                    {activeTab === 'history' && <HistoryTool />}
                    {activeTab === 'briefing' && <BriefingTool email={userProfile.email} />}
                </motion.div>
            </div>
        </div>
    );
};

export default MarketNexus;
