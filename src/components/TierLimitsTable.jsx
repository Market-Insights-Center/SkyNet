import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Shield, Zap, TrendingUp, Activity, Database, Brain, Cpu, Lock, Crown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const TierLimitsTable = () => {
    const { userProfile } = useAuth();
    const currentTier = userProfile?.tier || 'Basic';

    // Tier Hierarchy for comparison
    const tiers = ['Basic', 'Pro', 'Enterprise', 'Singularity', 'Visionary', 'Institutional'];
    const currentTierIdx = tiers.indexOf(currentTier);

    const isTierActive = (targetTier) => {
        const targetIdx = tiers.indexOf(targetTier);
        return currentTierIdx >= targetIdx;
    };

    // Data from tier_limits.csv
    const features = [
        { name: "Daily AI Investments", basic: "3", pro: "10", ent: "Unlimited", icon: TrendingUp },
        { name: "Cultivate Optimization", basic: "1/week", pro: "3/day", ent: "5/day", icon: Zap },
        { name: "Portfolio Tracking", basic: "1/day", pro: "10/day", ent: "Unlimited", icon: Activity },
        { name: "Market Briefings", basic: "No", pro: "3/day", ent: "5/day", icon: Database },
        { name: "Risk Analysis", basic: "Unlimited", pro: "Unlimited", ent: "Unlimited", icon: Shield },
        { name: "Trading History", basic: "No", pro: "Unlimited", ent: "Unlimited", icon: Database },
        { name: "QuickScore Ratings", basic: "Unlimited", pro: "20/day", ent: "Unlimited", icon: Activity },
        { name: "Breakout Scans", basic: "No", pro: "3/day", ent: "10/day", icon: TrendingUp },
        { name: "Sentiment Analysis", basic: "No", pro: "3/day", ent: "5/day", icon: Brain },
        { name: "Nexus Portfolios", basic: "No", pro: "No", ent: "5/day", icon: Cpu },
        { name: "Automation Blocks", basic: "5", pro: "10", ent: "25", icon: Cpu },
    ];

    const RenderValue = ({ val, highlight = false }) => {
        if (val === "No") return <X size={16} className="mx-auto text-gray-700" />;
        if (val === "Unlimited") return <span className={`font-bold text-lg ${highlight ? 'text-white' : 'text-blue-400'}`}>∞</span>;
        return <span className={highlight ? 'text-white font-bold' : 'text-gray-400'}>{val}</span>;
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const rowVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 }
    };

    return (
        <section className="py-24 px-4 bg-black border-t border-white/5 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-900/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                        Choose Your <span className="text-gold">Power Level</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Scale your capabilities with higher limits and advanced features.
                    </p>
                </motion.div>

                <div className="overflow-x-auto custom-scrollbar pb-8 px-2">
                    <motion.table
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={containerVariants}
                        className="w-full min-w-[900px] border-collapse"
                    >
                        <thead>
                            <tr>
                                <th className="p-6 text-left text-gray-500 font-medium w-1/4 uppercase tracking-widest text-xs">Feature</th>

                                {/* Basic Header */}
                                <th className="p-6 text-center w-1/4 relative group">
                                    <div className={`absolute inset-0 bg-white/5 rounded-t-xl transition-opacity ${currentTier === 'Basic' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                    <div className="relative z-10">
                                        <div className="text-2xl font-bold text-white mb-1">Basic</div>
                                        <div className="text-xs text-gray-500 uppercase tracking-widest font-mono">Starter</div>
                                        {currentTier === 'Basic' && (
                                            <div className="mt-2 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full inline-block">Current</div>
                                        )}
                                    </div>
                                </th>

                                {/* Pro Header */}
                                <th className="p-6 text-center w-1/4 relative group">
                                    <div className={`absolute inset-0 bg-gold/10 border-x border-t border-gold/20 rounded-t-xl transition-opacity ${currentTier === 'Pro' ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />
                                    {/* Neon Glow */}
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-70 shadow-[0_0_15px_rgba(255,215,0,0.5)]"></div>

                                    <div className="relative z-10">
                                        <div className="text-2xl font-bold text-gold mb-1 flex items-center justify-center gap-2">
                                            Pro <Crown size={16} className="fill-gold" />
                                        </div>
                                        <div className="text-xs text-yellow-600 uppercase tracking-widest font-mono">Most Popular</div>
                                        {currentTier === 'Pro' && (
                                            <div className="mt-2 text-xs bg-gold text-black font-bold px-2 py-0.5 rounded-full inline-block shadow-[0_0_10px_rgba(255,215,0,0.4)]">Current</div>
                                        )}
                                    </div>
                                </th>

                                {/* Enterprise Header */}
                                <th className="p-6 text-center w-1/4 relative group">
                                    <div className={`absolute inset-0 bg-purple-900/10 border-x border-t border-purple-500/20 rounded-t-xl transition-opacity ${currentTier === 'Enterprise' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                    <div className="relative z-10">
                                        <div className="text-2xl font-bold text-white mb-1">Enterprise</div>
                                        <div className="text-xs text-purple-400 uppercase tracking-widest font-mono">Power User</div>
                                        {isTierActive('Enterprise') && currentTier !== 'Pro' && currentTier !== 'Basic' && (
                                            <div className="mt-2 text-xs bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full inline-block shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                                                {currentTier === 'Enterprise' ? 'Current' : 'Included'}
                                            </div>
                                        )}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {features.map((feat, idx) => (
                                <motion.tr
                                    key={idx}
                                    variants={rowVariants}
                                    className="group hover:bg-white/5 transition-colors relative"
                                >
                                    {/* Feature Name */}
                                    <td className="p-6 relative">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 group-hover:text-gold group-hover:border-gold/30 transition-colors shadow-lg">
                                                <feat.icon size={18} />
                                            </div>
                                            <span className="font-medium text-gray-200 group-hover:text-white transition-colors">{feat.name}</span>
                                        </div>
                                    </td>

                                    {/* Basic Value */}
                                    <td className="p-6 text-center text-gray-400 font-mono relative">
                                        <div className={`absolute inset-0 bg-white/5 opacity-0 ${currentTier === 'Basic' ? 'opacity-50' : 'group-hover:opacity-30'} transition-opacity`} />
                                        <div className="relative z-10"><RenderValue val={feat.basic} /></div>
                                    </td>

                                    {/* Pro Value */}
                                    <td className="p-6 text-center font-mono relative border-x border-white/5 bg-gold/5">
                                        <div className={`absolute inset-0 bg-gold/10 opacity-0 ${currentTier === 'Pro' ? 'opacity-100' : 'group-hover:opacity-50'} transition-opacity`} />
                                        <div className="relative z-10 text-gold"><RenderValue val={feat.pro} highlight={true} /></div>
                                    </td>

                                    {/* Enterprise Value */}
                                    <td className="p-6 text-center text-gray-300 font-mono relative">
                                        <div className={`absolute inset-0 bg-purple-500/5 opacity-0 ${currentTier === 'Enterprise' ? 'opacity-100' : 'group-hover:opacity-30'} transition-opacity`} />
                                        <div className="relative z-10"><RenderValue val={feat.ent} /></div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className="p-6"></td>

                                {/* Basic Footer */}
                                <td className="p-6 text-center relative">
                                    <div className={`absolute inset-0 bg-white/5 rounded-b-xl opacity-0 ${currentTier === 'Basic' ? 'opacity-100' : ''}`} />
                                    <div className="relative z-10">
                                        <div className="text-sm font-bold text-gray-500">Free Forever</div>
                                    </div>
                                </td>

                                {/* Pro Footer */}
                                <td className="p-6 text-center relative bg-gold/5 border-x border-b border-gold/20 rounded-b-xl">
                                    <div className="relative z-10">
                                        {isTierActive('Pro') ? (
                                            <div className="flex items-center justify-center gap-2 text-green-400 font-bold uppercase tracking-wider text-sm py-2">
                                                <Check size={18} /> Included
                                            </div>
                                        ) : (
                                            <Link to="/products" className="inline-flex items-center gap-2 px-8 py-3 bg-gold hover:bg-white hover:text-black text-black font-bold rounded-lg transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,215,0,0.3)] text-sm group">
                                                Upgrade <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        )}
                                    </div>
                                </td>

                                {/* Enterprise Footer */}
                                <td className="p-6 text-center relative border-x border-b border-purple-500/20 rounded-b-xl">
                                    <div className="relative z-10">
                                        {isTierActive('Enterprise') ? (
                                            <div className="flex items-center justify-center gap-2 text-purple-400 font-bold uppercase tracking-wider text-sm py-2">
                                                <Check size={18} /> Included
                                            </div>
                                        ) : (
                                            <Link to="/products" className="inline-block px-8 py-3 border border-white/20 hover:border-purple-500 hover:text-purple-400 hover:bg-purple-500/10 text-gray-300 font-bold rounded-lg transition-colors text-sm">
                                                Upgrade
                                            </Link>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </motion.table>
                </div>

                {isTierActive('Singularity') && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        className="mt-8 text-center p-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-white/10 rounded-2xl max-w-3xl mx-auto shadow-2xl"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-3 bg-black rounded-full border border-gray-700 shadow-lg">
                                <Crown size={32} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent">
                                    You Have Singularity Access
                                </h3>
                                <p className="text-gray-400 mt-2">
                                    Your tier exceeds all limits shown above. You operate without constraints.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </section>
    );
};

export default TierLimitsTable;
