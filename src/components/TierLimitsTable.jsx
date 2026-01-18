import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Shield, Zap, TrendingUp, Activity, Database, Brain, Cpu, Lock, Crown, ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ContainerScroll } from './ui/ContainerScroll';

const TierLimitsTable = () => {
    const { userProfile } = useAuth();
    const currentTier = userProfile?.tier || 'Basic';
    const tiers = ['Basic', 'Pro', 'Enterprise', 'Singularity', 'Visionary', 'Institutional'];
    const currentTierIdx = tiers.indexOf(currentTier);
    const isTierActive = (targetTier) => currentTierIdx >= tiers.indexOf(targetTier);

    const [hoveredRow, setHoveredRow] = useState(null);

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

    const RenderValue = ({ val, highlight = false, dim = false }) => {
        if (val === "No") return <X size={16} className="mx-auto text-gray-800" />;
        if (val === "Unlimited") return <span className={`font-bold text-lg ${highlight ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-blue-400'}`}>∞</span>;
        return <span className={`${highlight ? 'text-white font-bold' : dim ? 'text-gray-600' : 'text-gray-400'}`}>{val}</span>;
    };

    return (
        <section className="py-32 px-4 bg-black relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] mix-blend-screen animate-pulse-slow delay-1000" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <ContainerScroll
                    titleComponent={
                        <>
                            <h2 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-b from-white via-gray-200 to-gray-600 bg-clip-text text-transparent tracking-tight">
                                Choose Your <span className="text-gold relative inline-block">
                                    Power
                                    <motion.span
                                        className="absolute -top-1 -right-4 text-gold/30"
                                        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    >
                                        <Star size={24} />
                                    </motion.span>
                                </span>
                            </h2>
                            <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
                                Unlock the full potential of the Machine Intelligence Center.
                            </p>
                        </>
                    }
                >
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <table className="w-full min-w-[1000px] border-collapse relative">
                            <thead>
                                <tr>
                                    <th className="p-8 text-left w-1/4">
                                        <div className="text-xs text-gray-500 uppercase tracking-[0.2em] font-bold">Capabilities</div>
                                    </th>

                                    {/* Column Headers */}
                                    {[
                                        { tier: 'Basic', color: 'gray', label: 'Starter' },
                                        { tier: 'Pro', color: 'gold', label: 'Recommended', icon: Crown },
                                        { tier: 'Enterprise', color: 'purple', label: 'Power User' }
                                    ].map((col) => {
                                        const isCurrent = currentTier === col.tier;
                                        const isActive = isTierActive(col.tier);

                                        return (
                                            <th key={col.tier} className="p-8 text-center w-1/4 relative group align-top">
                                                {/* Header Gradient */}
                                                <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-${col.color === 'gold' ? 'yellow-500' : col.color === 'purple' ? 'purple-600' : 'white'}/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                                                <div className="relative z-10 flex flex-col items-center gap-2">
                                                    <div className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br ${col.color === 'gold' ? 'from-yellow-200 via-gold to-yellow-600' :
                                                        col.color === 'purple' ? 'from-purple-300 via-purple-500 to-indigo-600' :
                                                            'from-gray-100 to-gray-500'
                                                        }`}>
                                                        {col.tier}
                                                    </div>

                                                    {col.icon && <col.icon size={16} className={`text-${col.color === 'gold' ? 'yellow-500' : 'purple-400'} animate-bounce-slow`} />}

                                                    <div className={`text-[10px] uppercase tracking-widest font-mono py-1 px-3 rounded-full border ${isCurrent ? 'bg-white text-black border-white' :
                                                        `border-${col.color === 'gold' ? 'yellow-500/30 text-yellow-500' : col.color === 'purple' ? 'purple-500/30 text-purple-400' : 'white/10 text-gray-500'}`
                                                        }`}>
                                                        {isCurrent ? 'Current Plan' : col.label}
                                                    </div>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody onMouseLeave={() => setHoveredRow(null)}>
                                {features.map((feat, idx) => (
                                    <tr
                                        key={idx}
                                        onMouseEnter={() => setHoveredRow(idx)}
                                        className="relative transition-colors duration-300 border-t border-white/5 hover:bg-white/5"
                                    >
                                        <td className="p-6 pl-8">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg transition-colors duration-300 ${hoveredRow === idx ? 'bg-gold/20 text-gold shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'bg-white/5 text-gray-500'}`}>
                                                    <feat.icon size={18} />
                                                </div>
                                                <span className={`font-medium transition-colors ${hoveredRow === idx ? 'text-white' : 'text-gray-400'}`}>{feat.name}</span>
                                            </div>
                                        </td>

                                        <td className={`p-6 text-center font-mono relative ${currentTier === 'Basic' ? 'bg-white/5 border-l border-r border-white/10' : ''}`}>
                                            <RenderValue val={feat.basic} dim={true} highlight={currentTier === 'Basic'} />
                                        </td>

                                        <td className={`p-6 text-center font-mono relative ${currentTier === 'Pro' ? 'bg-gold/5 border-l border-r border-gold/20' : ''}`}>
                                            {/* Dynamic Highlight Column Background */}
                                            {currentTier === 'Pro' && (
                                                <div className="absolute inset-y-0 left-0 right-0 bg-gold/5 opacity-50 pointer-events-none" />
                                            )}
                                            <div className="relative z-10"><RenderValue val={feat.pro} highlight={currentTier === 'Pro'} /></div>
                                        </td>

                                        <td className={`p-6 text-center font-mono relative ${currentTier === 'Enterprise' ? 'bg-purple-500/5 border-l border-r border-purple-500/20' : ''}`}>
                                            <RenderValue val={feat.ent} highlight={currentTier === 'Enterprise'} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="p-8"></td>
                                    <td className="p-8 text-center align-bottom h-32">
                                        <div className="text-gray-500 font-bold text-sm">Always Free</div>
                                    </td>
                                    <td className="p-8 text-center align-bottom h-32 relative bg-gold/5">
                                        {!isTierActive('Pro') ? (
                                            <Link to="/products" className="group relative block w-full py-4 bg-gold hover:bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl overflow-hidden transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,215,0,0.4)]">
                                                <span className="relative z-10 flex items-center justify-center gap-2">
                                                    Upgrade <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                                </span>
                                                <div className="absolute inset-0 bg-white/50 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                            </Link>
                                        ) : (
                                            <div className="text-green-400 font-bold uppercase tracking-wider flex items-center justify-center gap-2"><Check /> Active</div>
                                        )}
                                    </td>
                                    <td className="p-8 text-center align-bottom h-32">
                                        {!isTierActive('Enterprise') ? (
                                            <Link to="/products" className="group block w-full py-4 border border-purple-500/30 hover:border-purple-500 hover:bg-purple-900/20 text-purple-300 hover:text-white font-bold uppercase tracking-widest text-sm rounded-xl transition-all">
                                                Upgrade
                                            </Link>
                                        ) : (
                                            <div className="text-purple-400 font-bold uppercase tracking-wider flex items-center justify-center gap-2"><Check /> Active</div>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </ContainerScroll>

                {/* Singularity Card - Exotic Animation */}
                {isTierActive('Singularity') && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 50 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        className="mt-12 mx-auto max-w-4xl relative group"
                    >
                        {/* Animated Border Gradient */}
                        <div className="absolute inset-[-4px] rounded-2xl bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 opacity-75 blur-lg group-hover:opacity-100 animate-gradient-xy transition-opacity duration-500" />

                        <div className="relative bg-black rounded-2xl p-1 overflow-hidden">
                            {/* Content */}
                            <div className="bg-gray-900/90 backdrop-blur-xl rounded-xl p-8 flex flex-col md:flex-row items-center gap-8 relative z-10">

                                <div className="relative">
                                    <div className="absolute inset-0 bg-white/20 blur-md rounded-full animate-pulse-fast" />
                                    <Crown size={48} className="text-white relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,1)]" />
                                </div>

                                <div className="text-center md:text-left flex-1">
                                    <h3 className="text-3xl font-black text-white mb-2 tracking-tight">SINGULARITY AUTHORIZED</h3>
                                    <p className="text-gray-400">
                                        You are operating beyond standard limits. All features are <span className="text-white font-bold">Unbounded</span>.
                                    </p>
                                </div>

                                <div className="px-6 py-2 bg-white/10 rounded-full border border-white/20 text-white font-mono text-sm animate-pulse">
                                    ACCESS_GRANTED
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </section>
    );
};

export default TierLimitsTable;
