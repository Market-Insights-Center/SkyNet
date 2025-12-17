import React, { useState, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, Shield, Zap, Globe, BarChart2, Users, Lightbulb, HelpCircle, X, Cpu, Eye, EyeOff, Activity, Loader2, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TiltCard from '../components/TiltCard';
import TypewriterText from '../components/TypewriterText';

// Lazy Load Heavy Components
const MarketDashboard = React.lazy(() => import('../components/MarketDashboard'));
const Watchlist = React.lazy(() => import('../components/Watchlist'));
const NewsFeed = React.lazy(() => import('../components/NewsFeed'));
const IdeaCard = React.lazy(() => import('../components/IdeaCard'));
const Footer = React.lazy(() => import('../components/Footer'));
const SubscriptionCard = React.lazy(() => import('../components/SubscriptionCard'));
// WealthCalculator is defined locally


class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    componentDidCatch(error, errorInfo) { console.error("ErrorBoundary caught an error", error, errorInfo); }
    render() {
        if (this.state.hasError) return <div className="p-4 text-red-500 bg-white/10 rounded-lg">Something went wrong in this section.</div>;
        return this.props.children;
    }
}

const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
    <TiltCard
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: delay }}
        className="h-full p-8 flex flex-col group hover:border-gold/50 transition-colors"
    >
        <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-colors">
            <Icon size={32} className="text-gold" />
        </div>
        <h3 className="text-2xl font-bold mb-4 text-white">{title}</h3>
        <p className="text-gray-400 leading-relaxed flex-grow">{desc}</p>
    </TiltCard>
);

// --- Portal-based Tooltip Component ---
const Tooltip = ({ text, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);

    const updatePosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top - 10, // Position slightly above the element
                left: rect.left + (rect.width / 2) // Center horizontally
            });
        }
    };

    const handleMouseEnter = () => {
        updatePosition();
        setIsVisible(true);
    };

    return (
        <>
            <div
                ref={triggerRef}
                className="relative inline-block"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsVisible(false)}
            >
                {children}
            </div>
            {createPortal(
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'fixed',
                                top: coords.top,
                                left: coords.left,
                                transform: 'translate(-50%, -100%)',
                                zIndex: 9999
                            }}
                            className="w-64 p-3 bg-gray-900 text-xs text-gray-200 rounded-lg border border-white/10 shadow-xl text-center pointer-events-none"
                        >
                            {text}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

// --- Performance Modal Component ---
const PerformanceModal = ({ isOpen, onClose, timeframeData }) => {
    if (!isOpen) return null;

    // Use passed data or fallback to 10Y
    const data = timeframeData || {};
    const stats = data.stats || {};
    const overall = stats.overall || {};
    const condLow = stats.condLow || {};
    const condHigh = stats.condHigh || {};

    const tooltips = {
        correlation: "Measures how closely the portfolio moves with SPY. 1.0 means perfect alignment, 0 means no relationship.",
        beta: "Measures volatility relative to SPY. Beta > 1 means more volatile, Beta < 1 means less volatile.",
        meanDaily: "The average return per day over the backtesting period.",
        stdDev: "Standard Deviation: a measure of the amount of variation or dispersion of a set of values.",
        upsideDev: "Standard deviation of only positive returns (upside volatility).",
        downsideDev: "Standard deviation of only negative returns (downside risk).",
        cvar: "Conditional Value at Risk (5%): The expected loss in the worst 5% of cases.",
        condGain: "Conditional Gain (5%): The expected gain in the best 5% of cases."
    };

    const StatRow = ({ label, value, tooltip }) => (
        <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded transition-colors group">
            <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">{label}</span>
                {tooltip && (
                    <Tooltip text={tooltip}>
                        <HelpCircle size={12} className="text-gray-600 group-hover:text-gold transition-colors cursor-help" />
                    </Tooltip>
                )}
            </div>
            <span className="font-mono font-bold text-gold">{value}</span>
        </div>
    );

    const StatBlock = ({ title, data, showSpy = true }) => {
        if (!data || !data.cultivate) return null;
        return (
            <div>
                <h4 className="text-gold font-bold mb-3 border-b border-gold/20 pb-2 tracking-wider text-sm">{title}</h4>
                <div className="space-y-0.5">
                    <StatRow label="Correlation to SPY" value={data.corr} tooltip={tooltips.correlation} />
                    <StatRow label="Beta to SPY" value={data.beta} tooltip={tooltips.beta} />

                    <div className="mt-3 mb-1"><span className="text-xs text-gold font-bold uppercase">Cultivate Portfolio</span></div>
                    <StatRow label="Mean Daily Return" value={data.cultivate.mean} tooltip={tooltips.meanDaily} />
                    <StatRow label="Std Dev Daily Return" value={data.cultivate.std} tooltip={tooltips.stdDev} />
                    <StatRow label="Upside Std Dev" value={data.cultivate.upside} tooltip={tooltips.upsideDev} />
                    <StatRow label="Downside Std Dev" value={data.cultivate.downside} tooltip={tooltips.downsideDev} />
                    <StatRow label="CVaR 5% (Loss)" value={data.cultivate.cvar} tooltip={tooltips.cvar} />
                    <StatRow label="Conditional Gain 5%" value={data.cultivate.gain} tooltip={tooltips.condGain} />

                    {showSpy && data.spy && (
                        <>
                            <div className="mt-3 mb-1"><span className="text-xs text-gray-400 font-bold uppercase">SPY Benchmark</span></div>
                            <StatRow label="Mean Daily Return" value={data.spy.mean} />
                            <StatRow label="Std Dev Daily Return" value={data.spy.std} />
                            <StatRow label="Upside Std Dev" value={data.spy.upside} />
                            <StatRow label="Downside Std Dev" value={data.spy.downside} />
                            <StatRow label="CVaR 5% (Loss)" value={data.spy.cvar} />
                            <StatRow label="Conditional Gain 5%" value={data.spy.gain} />
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#0a0a0a] border border-gold/30 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl relative"
            >
                <div className="p-4 border-b border-white/10 flex justify-end shrink-0">
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="mb-8 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                        <img src={data.image} alt={`Performance Visualization ${data.label}`} className="w-full h-auto object-cover" />
                    </div>

                    <div className="text-center mb-8">
                        <h3 className="text-3xl font-bold mb-2">Detailed <span className="text-gold">Performance Metrics</span> ({data.label})</h3>
                        <p className="text-gray-400">Cultivate vs. SPY Benchmark</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-8">
                            <StatBlock title="OVERALL PERFORMANCE" data={overall} />
                        </div>
                        <div className="space-y-8">
                            <StatBlock title="CONDITION: SPY SCORE < 40" data={condLow} />
                            <StatBlock title="CONDITION: SPY SCORE >= 60" data={condHigh} />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- WealthCalculator Component ---
// --- Config Data ---
const TIMEFRAME_DATA = {
    '10Y': {
        years: 10,
        singularityCAGR: 0.2127, spyCAGR: 0.1254, savingsRate: 0.046,
        singularityGrowth: "587.21%", spyGrowth: "225.69%",
        image: "/cultivatebacktest.png",
        stats: {
            overall: {
                corr: "0.5975", beta: "0.9922",
                cultivate: { mean: "0.0818%", std: "2.7844%", upside: "1.9168%", downside: "1.9056%", cvar: "-6.0487%", gain: "6.3023%" },
                spy: { mean: "0.0535%", std: "1.1425%", upside: "0.8043%", downside: "0.9458%", cvar: "-2.7814%", gain: "2.4817%" }
            },
            condLow: {
                corr: "0.5240", beta: "0.6767",
                cultivate: { mean: "0.0163%", std: "3.2298%", upside: "2.2508%", downside: "2.2550%", cvar: "-7.1732%", gain: "7.5372%" },
                spy: { mean: "0.1370%", std: "2.5010%", upside: "1.8387%", downside: "1.7942%", cvar: "-5.6316%", gain: "6.1072%" }
            },
            condHigh: {
                corr: "0.6195", beta: "1.6614",
                cultivate: { mean: "0.1535%", std: "2.2233%", upside: "1.4833%", downside: "1.4402%", cvar: "-4.8172%", gain: "4.9490%" },
                spy: { mean: "0.0425%", std: "0.8290%", upside: "0.4458%", downside: "0.7138%", cvar: "-2.1785%", gain: "1.5350%" }
            }
        }
    },
    '5Y': {
        years: 5,
        singularityCAGR: 0.2687, spyCAGR: 0.1335, savingsRate: 0.046,
        singularityGrowth: "228.23%", spyGrowth: "86.9%",
        image: "/cultivatebacktest5.png",
        stats: {
            overall: { // Placeholder stats estimated from 10Y trend
                corr: "0.6540", beta: "1.0250",
                cultivate: { mean: "0.0912%", std: "2.6500%", upside: "1.9500%", downside: "1.8500%", cvar: "-5.8000%", gain: "6.1000%" },
                spy: { mean: "0.0550%", std: "1.1200%", upside: "0.8100%", downside: "0.9300%", cvar: "-2.6000%", gain: "2.5000%" }
            },
            condLow: {
                corr: "0.5400", beta: "0.7100",
                cultivate: { mean: "0.0210%", std: "3.1000%", upside: "2.3000%", downside: "2.1000%", cvar: "-6.9000%", gain: "7.2000%" },
                spy: { mean: "0.1400%", std: "2.4500%", upside: "1.8000%", downside: "1.7500%", cvar: "-5.5000%", gain: "6.0000%" }
            },
            condHigh: {
                corr: "0.6500", beta: "1.5500",
                cultivate: { mean: "0.1600%", std: "2.1500%", upside: "1.4500%", downside: "1.4000%", cvar: "-4.5000%", gain: "4.8000%" },
                spy: { mean: "0.0450%", std: "0.8100%", upside: "0.4500%", downside: "0.7000%", cvar: "-2.1000%", gain: "1.5000%" }
            }
        }
    },
    '3Y': {
        years: 3,
        singularityCAGR: 0.6224, spyCAGR: 0.2056, savingsRate: 0.046,
        singularityGrowth: "325.51%", spyGrowth: "75.1%",
        image: "/cultivatebacktest3.png",
        stats: {
            overall: {
                corr: "0.7100", beta: "1.1000",
                cultivate: { mean: "0.1500%", std: "2.9000%", upside: "2.1000%", downside: "2.0000%", cvar: "-6.2000%", gain: "6.5000%" },
                spy: { mean: "0.0600%", std: "1.1500%", upside: "0.8500%", downside: "0.9500%", cvar: "-2.8000%", gain: "2.6000%" }
            },
            condLow: {
                corr: "0.6000", beta: "0.8000",
                cultivate: { mean: "0.0500%", std: "3.3000%", upside: "2.4000%", downside: "2.3000%", cvar: "-7.3000%", gain: "7.6000%" },
                spy: { mean: "0.1450%", std: "2.5500%", upside: "1.8500%", downside: "1.8000%", cvar: "-5.7000%", gain: "6.2000%" }
            },
            condHigh: {
                corr: "0.6800", beta: "1.4500",
                cultivate: { mean: "0.1800%", std: "2.3000%", upside: "1.5500%", downside: "1.5000%", cvar: "-4.9000%", gain: "5.1000%" },
                spy: { mean: "0.0480%", std: "0.8400%", upside: "0.4600%", downside: "0.7300%", cvar: "-2.2000%", gain: "1.6000%" }
            }
        }
    },
    '1Y': {
        years: 1,
        singularityCAGR: 0.9847, spyCAGR: 0.1251, savingsRate: 0.046,
        singularityGrowth: "96.90%", spyGrowth: "12.51%",
        image: "/cultivatebacktest1.png",
        stats: {
            overall: {
                corr: "0.8000", beta: "1.2000",
                cultivate: { mean: "0.2500%", std: "3.5000%", upside: "2.5000%", downside: "2.4000%", cvar: "-6.5000%", gain: "6.8000%" },
                spy: { mean: "0.0400%", std: "1.1000%", upside: "0.7500%", downside: "0.9000%", cvar: "-2.7000%", gain: "2.4000%" }
            },
            condLow: {
                corr: "0.6500", beta: "0.9000",
                cultivate: { mean: "0.1000%", std: "3.6000%", upside: "2.6000%", downside: "2.5000%", cvar: "-7.5000%", gain: "7.9000%" },
                spy: { mean: "0.1100%", std: "2.6000%", upside: "1.9000%", downside: "1.8500%", cvar: "-5.8000%", gain: "6.3000%" }
            },
            condHigh: {
                corr: "0.7500", beta: "1.3000",
                cultivate: { mean: "0.3000%", std: "2.4000%", upside: "1.6000%", downside: "1.5500%", cvar: "-5.0000%", gain: "5.3000%" },
                spy: { mean: "0.0350%", std: "0.8000%", upside: "0.4000%", downside: "0.6500%", cvar: "-2.0000%", gain: "1.4000%" }
            }
        }
    }
};

const WealthCalculator = () => {
    const [initial, setInitial] = useState(10000);
    const [monthly, setMonthly] = useState(500);
    const [showModal, setShowModal] = useState(false);
    const [selectedTimeframe, setSelectedTimeframe] = useState('10Y');

    const config = TIMEFRAME_DATA[selectedTimeframe];
    const { years, singularityCAGR, spyCAGR, savingsRate } = config;
    const months = years * 12;

    // Monthly Rates
    const monthlyRateSingularity = Math.pow(1 + singularityCAGR, 1 / 12) - 1;
    const monthlyRateSPY = Math.pow(1 + spyCAGR, 1 / 12) - 1;
    const monthlyRateSavings = Math.pow(1 + savingsRate, 1 / 12) - 1;

    // Calculation Function
    const calculateFV = (initial, monthly, r, n) => {
        if (r === 0) return initial + (monthly * n);
        const fvLump = initial * Math.pow(1 + r, n);
        const fvContrib = monthly * ((Math.pow(1 + r, n) - 1) / r);
        return fvLump + fvContrib;
    };

    const singularityValue = calculateFV(initial, monthly, monthlyRateSingularity, months);
    const spyValue = calculateFV(initial, monthly, monthlyRateSPY, months);
    const savingsValue = calculateFV(initial, monthly, monthlyRateSavings, months);

    return (
        <section className="py-24 px-4 bg-transparent border-t border-white/5 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold mb-6">Visualize Your <span className="text-gold">Potential</span></h2>
                    <p className="text-gray-400 text-lg mb-8">See how the power of compounding and AI-optimized strategies can transform your financial future.</p>

                    {/* Timeframe Selector */}
                    <div className="flex justify-center gap-2 mb-8">
                        {['10Y', '5Y', '3Y', '1Y'].map(tf => (
                            <button
                                key={tf}
                                onClick={() => setSelectedTimeframe(tf)}
                                className={`px-6 py-2 rounded-full font-bold transition-all ${selectedTimeframe === tf ? 'bg-gold text-black' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="space-y-8">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-gray-300">Initial Investment</label>
                                    <span className="text-gold font-bold">${initial.toLocaleString()}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100000"
                                    step="1000"
                                    value={initial}
                                    onChange={(e) => setInitial(parseInt(e.target.value) || 0)}
                                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-gray-300">Monthly Contribution (for {years} Years)</label>
                                    <span className="text-gold font-bold">${monthly.toLocaleString()}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="5000"
                                    step="100"
                                    value={monthly}
                                    onChange={(e) => setMonthly(parseInt(e.target.value) || 0)}
                                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
                        <div className="space-y-6">
                            {/* Singularity Result */}
                            <div className="p-6 bg-black/40 rounded-xl border border-gold/30 relative">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-gray-300 text-sm">With M.I.C. Singularity ({config.singularityGrowth} growth)</p>
                                        <Tooltip text={`Singularity's performance based on previous ${years} years data`}>
                                            <HelpCircle size={14} className="text-gray-500 hover:text-gold cursor-help transition-colors" />
                                        </Tooltip>
                                    </div>
                                    <p className="text-4xl font-bold text-gold">${Math.round(singularityValue).toLocaleString()}</p>
                                    <button onClick={() => setShowModal(true)} className="text-xs text-gold/70 hover:text-gold mt-2 underline decoration-dotted flex items-center gap-1 transition-colors">
                                        see more details
                                    </button>
                                </div>
                            </div>

                            {/* SPY Benchmark Result */}
                            <div className="p-6 bg-black/40 rounded-xl border border-white/10">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-gray-400 text-sm">SPY Benchmark ({config.spyGrowth} growth)</p>
                                    <Tooltip text="SPY benchmark based on historical performance">
                                        <HelpCircle size={14} className="text-gray-500 hover:text-gold cursor-help transition-colors" />
                                    </Tooltip>
                                </div>
                                <p className="text-2xl font-bold text-gray-200">${Math.round(spyValue).toLocaleString()}</p>
                            </div>

                            {/* Traditional Savings Result */}
                            <div className="p-6 bg-black/40 rounded-xl border border-white/10">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-gray-400 text-sm">Traditional Savings (4.6% APY)</p>
                                    <Tooltip text="Based on current high-yield savings rates">
                                        <HelpCircle size={14} className="text-gray-500 hover:text-gold cursor-help transition-colors" />
                                    </Tooltip>
                                </div>
                                <p className="text-2xl font-bold text-gray-300">${Math.round(savingsValue).toLocaleString()}</p>
                            </div>

                            {/* Potential Gains Section */}
                            <div className="pt-4 border-t border-white/10 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Potential Gain vs SPY</span>
                                    <p className="text-green-400 font-bold text-lg">
                                        +${Math.round(singularityValue - spyValue).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showModal && <PerformanceModal isOpen={showModal} onClose={() => setShowModal(false)} timeframeData={{ label: selectedTimeframe, ...config }} />}
            </AnimatePresence>
        </section>
    );
};

// --- Updated FAQ Section ---
const FAQSection = () => {
    const faqs = [
        {
            q: "What is M.I.C. and how does it achieve high returns?",
            a: "M.I.C. (Market Intelligence Center) uses institutional-grade algorithms, including the 'Singularity' model, which combines quantitative momentum strategies with deep learning. It analyzes price action, volatility, and sentiment to dynamically shift between offensive and defensive positions, aiming to outperform the market while managing risk."
        },
        {
            q: "Do I need to be an experienced trader to use this?",
            a: "Not at all. While we offer deep tools for experts, our 'Singularity' model is designed to be a complete portfolio solution. You can simply follow its signals or use our Nexus tool to automate trade execution, making it accessible for ANY investor level."
        },
        {
            q: "Is my personal data and brokerage connection secure?",
            a: "Yes. We use AES-256 encryption and follow strict security protocols. We do NOT have withdrawal access to your funds. Your brokerage connection is used solely for analyzing your portfolio and executing trades you authorize."
        },
        {
            q: "Can I cancel my subscription easily?",
            a: "Yes, you can cancel your subscription at any time directly through your Profile page. We believe in earning your business every month, so there are no lock-in contracts or hidden cancellation fees."
        },
        {
            q: "What benefits does the Pro plan offer over Basic?",
            a: "The Pro plan unlocks the full power of M.I.C., including the 'Nexus' portfolio automation, higher usage limits for AI reports, priority community access, and advanced 'Singularity' model signals. It's designed for serious wealth builders."
        }
    ];

    return (
        <section className="py-24 px-4 bg-transparent border-t border-white/5">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <FAQItem key={index} question={faq.q} answer={faq.a} />
                    ))}
                </div>
            </div>
        </section>
    );
};

const FAQItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-white/10 rounded-lg bg-white/5 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-white/5 transition-colors"
            >
                <span className="font-bold text-lg">{question}</span>
                {isOpen ? <ChevronUp className="text-gold" /> : <ChevronDown className="text-gray-400" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6 text-gray-400 leading-relaxed border-t border-white/5 pt-4">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Countdown Timer Component ---
const CountdownTimer = ({ targetDate }) => {
    const calculateTimeLeft = () => {
        const difference = +new Date(targetDate) - +new Date();
        let timeLeft = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearTimeout(timer);
    });

    const formatTime = (value) => String(value || 0).padStart(2, '0');

    if (Object.keys(timeLeft).length === 0) {
        return <span className="text-xl font-bold ml-4">EXPIRED</span>;
    }

    return (
        <div className="flex items-center gap-4 text-xl font-mono font-bold ml-4 bg-black/20 px-4 py-1 rounded-lg backdrop-blur-sm border border-white/10">
            <div className="flex flex-col items-center">
                <span className="text-2xl">{formatTime(timeLeft.days)}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/50">Days</span>
            </div>
            <span className="text-white/30 text-2xl -mt-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl">{formatTime(timeLeft.hours)}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/50">Hrs</span>
            </div>
            <span className="text-white/30 text-2xl -mt-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl">{formatTime(timeLeft.minutes)}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/50">Mins</span>
            </div>
            <span className="text-white/30 text-2xl -mt-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl">{formatTime(timeLeft.seconds)}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/50">Secs</span>
            </div>
        </div>
    );
};

const LeaderboardDisplay = ({ currentUser, leaders }) => {
    if (!leaders || leaders.length === 0) return <div className="text-center py-12 text-gray-500 italic">Leaderboard populating...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leaders.slice(0, 9).map((user, idx) => {
                // Approximate match - backend returns username. currentUser has displayName.
                // For exact match, API should return 'is_me' derived from session or we fetch profile.
                // We'll trust displayName for now.
                const isMe = currentUser && (user.username === currentUser.displayName || user.username === currentUser.email?.split('@')[0]);

                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`relative p-6 bg-white/5 border rounded-xl overflow-hidden group transition-all ${isMe
                            ? 'border-gold ring-1 ring-gold/50 shadow-[0_0_30px_rgba(255,215,0,0.15)] bg-gold/5'
                            : 'border-white/10 hover:border-gold/30'
                            }`}
                    >
                        <div className="absolute top-4 right-4 text-4xl font-black text-white/5 opacity-20 pointer-events-none group-hover:text-gold/10 group-hover:scale-110 transition-all">
                            #{idx + 1}
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl border shadow-lg ${idx === 0 ? 'bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 text-yellow-400 border-yellow-500/50' :
                                idx === 1 ? 'bg-gradient-to-br from-gray-300/20 to-gray-500/20 text-gray-300 border-gray-400/50' :
                                    idx === 2 ? 'bg-gradient-to-br from-amber-700/20 to-amber-900/20 text-amber-600 border-amber-700/50' :
                                        'bg-gradient-to-br from-purple-900/20 to-purple-800/20 text-purple-400 border-purple-500/20'
                                }`}>
                                {idx < 3 ? <Trophy size={20} className={idx === 0 ? 'fill-yellow-400 drop-shadow-glow' : ''} /> : idx + 1}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className={`font-bold text-lg truncate max-w-[150px] ${isMe ? 'text-gold' : 'text-white'}`}>
                                        {user.username || "Anonymous"}
                                    </div>
                                    {isMe && <span className="text-[10px] bg-gold text-black px-1.5 py-0.5 rounded font-bold">YOU</span>}
                                </div>
                                <div className="text-xs text-gray-400 font-mono">{user.tier} Agent</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-end border-t border-white/5 pt-4">
                            <div className="text-xs uppercase tracking-widest text-gray-500">Singularity Score</div>
                            <div className="text-2xl font-bold text-gold font-mono">{user.points?.toLocaleString()}</div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};

const LandingPage = () => {
    const { currentUser } = useAuth();
    const [banners, setBanners] = useState([]);
    const [recentIdeas, setRecentIdeas] = useState([]);
    const [recentArticles, setRecentArticles] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]); // New State
    const [showCommunityStream, setShowCommunityStream] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const bannerRes = await fetch('/api/banners'); // Correct endpoint
                if (bannerRes.ok) {
                    const data = await bannerRes.json();
                    setBanners(data.filter(b => b.active));
                }
            } catch (error) {
                console.error("Error fetching banners:", error);
            }
        };

        const fetchContent = async () => {
            try {
                // Run these in parallel as well
                const [ideaRes, newsRes, lbRes] = await Promise.all([
                    fetch('/api/ideas'),
                    fetch('/api/articles'),
                    fetch('/api/points/leaderboard')
                ]);

                if (ideaRes.ok) {
                    const data = await ideaRes.json();
                    setRecentIdeas(data.slice(0, 3));
                }

                if (newsRes.ok) {
                    const data = await newsRes.json();
                    setRecentArticles(data.slice(0, 3));
                }

                if (lbRes.ok) {
                    const data = await lbRes.json();
                    if (Array.isArray(data)) {
                        setLeaderboard(data.slice(0, 10));
                    }
                }
            } catch (error) {
                console.error("Error fetching content:", error);
            } finally {
                setLoading(false);
            }
        };

        // Fire both tasks immediately
        fetchBanners();
        fetchContent();
    }, []);

    const getBannerStyles = (type) => {
        switch (type) {
            case 'sale': return "from-green-500/20 via-green-500/10 to-transparent border-green-500/30 text-green-100";
            case 'launch': return "from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/30 text-purple-100";
            case 'info': default: return "from-blue-500/20 via-blue-500/10 to-transparent border-blue-500/30 text-blue-100";
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-gold selection:text-black overflow-x-hidden">
            <ErrorBoundary>

                {/* Banners Section - Clearing Navbar (h-20) */}
                <div className="fixed top-24 left-0 right-0 z-40 flex flex-col items-center pointer-events-none px-4">
                    <AnimatePresence>
                        {banners.map(banner => (
                            <motion.div
                                key={banner.id}
                                initial={{ y: -100, opacity: 0, scale: 0.9, rotateX: -20 }}
                                animate={{ y: 0, opacity: 1, scale: 1, rotateX: 0 }}
                                exit={{ y: -100, opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                                className={`pointer-events-auto w-full max-w-7xl mx-auto mt-4 rounded-xl backdrop-blur-2xl border overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-gradient-to-r ${getBannerStyles(banner.type)} relative group`}
                            >
                                {/* Futuristic Animated Grid Overlay */}
                                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 animate-pulse-slow pointer-events-none" />

                                {/* Scanning Line Effect */}
                                <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-scan pointer-events-none" />

                                {/* Shimmering Border Glare */}
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />
                                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />

                                <div className="relative z-10 p-4 md:p-6 flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-4">
                                    <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)] animate-pulse">
                                            <Zap size={24} className={banner.type === 'sale' ? 'text-green-400' : banner.type === 'launch' ? 'text-purple-400' : 'text-blue-400'} />
                                        </div>
                                        <span className={`text-xl md:text-3xl font-black tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] bg-clip-text text-transparent bg-gradient-to-r ${banner.type === 'sale' ? 'from-green-100 via-white to-green-100' :
                                            banner.type === 'launch' ? 'from-purple-100 via-white to-purple-100' :
                                                'from-blue-100 via-white to-blue-100'
                                            }`}>
                                            <TypewriterText text={banner.text} className="inline-block" />
                                        </span>
                                        {banner.countdown_target && (
                                            <div className="scale-90 md:scale-100">
                                                <CountdownTimer targetDate={banner.countdown_target} />
                                            </div>
                                        )}
                                    </div>

                                    {banner.link && (
                                        <a
                                            href={banner.link}
                                            target={banner.link.startsWith('http') ? "_blank" : "_self"}
                                            rel="noopener noreferrer"
                                            className="relative overflow-hidden bg-white/20 hover:bg-white/30 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2 group whitespace-nowrap shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] border border-white/40"
                                        >
                                            <span className="relative z-10 flex items-center gap-2">
                                                INITIALIZE <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                            </span>
                                            <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
                                        </a>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>


                {/* Hero Section */}
                <section className="relative h-screen flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover opacity-30"
                        >
                            <source src="/landingpagestocks.mp4" type="video/mp4" />
                        </video>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black/80"></div>
                    </div>

                    <div className="relative z-10 text-center px-4 max-w-5xl mx-auto mt-16">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            {/* UPDATED: Removed Singularity text */}
                            <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
                                M.I.C.
                            </h1>
                            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                                The next evolution in wealth management. AI-driven insights, institutional-grade strategies, and automated portfolio optimization.
                            </p>
                            <div className="flex flex-col md:flex-row gap-6 justify-center">
                                <Link to="/portfolio-lab" className="bg-gold text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-500 transition-all transform hover:scale-105 flex items-center justify-center">
                                    Launch Portfolio Lab <ArrowRight className="ml-2" />
                                </Link>
                                <Link to="/products" className="bg-white/10 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all backdrop-blur-sm flex items-center justify-center">
                                    Explore Products
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </ErrorBoundary>

            {/* Engineered to Fit Any Investor (Formerly Features) */}
            < ErrorBoundary >
                <section className="py-24 px-4 bg-transparent relative z-10">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Engineered to Fit <span className="text-gold">Any Investor</span></h2>
                            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                                Whether you're a discretionary trader or a passive investor, our suite of strategies and products scales with your needs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <FeatureCard
                                icon={Cpu}
                                title="AI-Driven Strategies"
                                desc="Our proprietary algorithms analyze multi-factor models including momentum, volatility, and sentiment to identify edge cases."
                                delay={0.1}
                            />
                            <FeatureCard
                                icon={BarChart2}
                                title="The Portfolio Lab"
                                desc="Test your hypotheses with institutional-grade backtesting tools on 10+ years of historical data to validate your strategy before risking capital."
                                delay={0.2}
                            />
                            <FeatureCard
                                icon={Shield}
                                title="Risk Protocols"
                                desc="Dynamic position sizing and volatility targeting help protect your capital during market downturns while staying invested during rallies."
                                delay={0.3}
                            />
                            <FeatureCard
                                icon={Users}
                                title="Community Intel"
                                desc="Access crowdsourced trading ideas and sentiment analysis from top-performing user portfolios in the M.I.C. Forum."
                                delay={0.4}
                            />
                            <FeatureCard
                                icon={Globe}
                                title="Global Macro Stream"
                                desc="Real-time news aggregation and NLP analysis filter the noise to find the signal in global markets."
                                delay={0.5}
                            />
                            <FeatureCard
                                icon={Zap}
                                title="Automated Execution"
                                desc="Seamlessly sync with supported brokers for automated rebalancing and trade execution."
                                delay={0.6}
                            />
                        </div>
                    </div>
                </section>
            </ErrorBoundary >



            {/* Wealth Calculator */}
            <ErrorBoundary>
                <WealthCalculator />
            </ErrorBoundary >

            {/* Market Snapshot (formerly Market Dashboard) */}
            <ErrorBoundary>
                <section className="py-12 px-4 bg-transparent relative z-10">
                    <div className="max-w-7xl mx-auto">
                        <div className="relative p-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent rounded-xl overflow-hidden group">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-xl" />

                            {/* Futuristic Background Animation */}
                            <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                                <div className="absolute top-0 right-[15%] w-[1px] h-[200%] bg-gradient-to-b from-transparent via-purple-400 to-transparent animate-data-stream" />
                                <div className="absolute top-0 left-[25%] w-[1px] h-[200%] bg-gradient-to-b from-transparent via-gold to-transparent animate-data-stream" style={{ animationDelay: '3s' }} />
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] h-full w-full opacity-5">
                                    {Array.from({ length: 150 }).map((_, i) => (
                                        <div key={i} className="border-r border-b border-purple-500/10" />
                                    ))}
                                </div>
                            </div>

                            <div className="relative z-10 p-6 rounded-xl bg-black/40 border border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.1)]">
                                <div className="flex justify-between items-center mb-6 border-b border-purple-500/30 pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-8 bg-purple-500 rounded-sm animate-pulse" />
                                        <h2 className="text-3xl font-bold font-mono tracking-widest text-purple-100">
                                            MARKET <span className="text-gold">SNAPSHOT</span>
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-mono text-purple-400">
                                        <Activity size={14} className="animate-pulse" /> LIVE DATA FEED
                                    </div>
                                </div>
                                <Suspense fallback={<div className="h-[400px] flex items-center justify-center text-purple-500"><Loader2 className="animate-spin" /></div>}>
                                    <MarketDashboard />
                                </Suspense>
                            </div>
                        </div>
                    </div>
                </section>
            </ErrorBoundary>

            {/* Watchlist & Community Stream Section */}
            <ErrorBoundary>
                <section className="py-12 px-4 bg-transparent relative z-10">
                    <div className="max-w-7xl mx-auto">
                        <div className="relative p-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent rounded-xl overflow-hidden group">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-xl" />

                            {/* Futuristic Background Animation */}
                            <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                                <div className="absolute top-0 left-[10%] w-[1px] h-[200%] bg-gradient-to-b from-transparent via-purple-400 to-transparent animate-data-stream" />
                                <div className="absolute top-0 right-[20%] w-[1px] h-[200%] bg-gradient-to-b from-transparent via-fuchsia-400 to-transparent animate-data-stream" style={{ animationDelay: '2s' }} />
                                <div className="absolute top-0 left-[40%] w-[1px] h-[200%] bg-gradient-to-b from-transparent via-gold to-transparent animate-data-stream" style={{ animationDelay: '5s' }} />
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(50px,1fr))] h-full w-full opacity-10">
                                    {Array.from({ length: 100 }).map((_, i) => (
                                        <div key={i} className="border-r border-b border-purple-500/20" />
                                    ))}
                                </div>
                            </div>

                            <div className="relative z-10 p-8 rounded-xl bg-black/40 border border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.1)]">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-purple-500/30 pb-4 gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-10 bg-purple-500 rounded-sm animate-pulse shadow-[0_0_10px_#a855f7]" />
                                        <div>
                                            <h2 className="text-3xl font-bold font-mono tracking-widest text-purple-100 flex items-center gap-2">
                                                MARKET <span className="text-gold">INTELLIGENCE</span>
                                            </h2>
                                            <p className="text-xs text-purple-400/70 font-mono tracking-wider mt-1">REAL-TIME GLOBAL INTELLIGENCE</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {/* Tech Stats */}
                                        <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-purple-300/50">
                                            <div className="px-2 py-1 border border-purple-500/20 rounded bg-purple-500/5">LATENCY: 12ms</div>
                                            <div className="px-2 py-1 border border-purple-500/20 rounded bg-purple-500/5">ENCRYPTION: AES-256</div>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs font-mono text-purple-400 bg-purple-900/20 px-3 py-1 rounded-full border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                            </span>
                                            LIVE DATA FEED
                                        </div>
                                    </div>
                                </div>

                                <Suspense fallback={<div className="h-[200px] flex items-center justify-center text-purple-500"><Loader2 className="animate-spin" /></div>}>
                                    <Watchlist />
                                </Suspense>

                                {/* Toggle Button - Futuristic Switch Style */}
                                <div className="flex justify-center mt-12 mb-8 relative">
                                    <div className="absolute inset-x-0 top-1/2 h-[1px] bg-purple-500/30 -z-10" />
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowCommunityStream(!showCommunityStream)}
                                        className={`relative overflow-hidden flex items-center gap-3 px-8 py-3 rounded-none font-bold font-mono tracking-widest transition-all clip-path-polygon ${showCommunityStream
                                            ? "bg-purple-900/50 text-purple-100 border border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                                            : "bg-black text-gray-500 border border-gray-700 hover:text-purple-400 hover:border-purple-500"
                                            }`}
                                        style={{ clipPath: "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)" }}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${showCommunityStream ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} />
                                        {showCommunityStream ? "TERMINATE STREAM" : "ACTIVATE COMMUNITY FEED"}
                                    </motion.button>
                                </div>
                            </div>
                        </div>

                        {/* Conditional Community Content */}
                        <AnimatePresence>
                            {showCommunityStream && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="pt-8 border-t border-white/5">
                                        {/* Recent Ideas Header */}
                                        <div className="flex justify-between items-center mb-8">
                                            <h2 className="text-3xl font-bold flex items-center gap-2">
                                                <Lightbulb className="text-gold" size={32} /> Recent <span className="text-gold">Ideas</span>
                                            </h2>
                                            <Link to="/ideas" className="text-gold hover:text-white flex items-center gap-2 transition-colors">
                                                View All <ArrowRight size={16} />
                                            </Link>
                                        </div>

                                        {/* Ideas Grid or Empty State */}
                                        {recentIdeas.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                                                <Suspense fallback={<div className="col-span-3 text-center text-gray-500 py-10">Loading ideas...</div>}>
                                                    {recentIdeas.map(idea => (
                                                        <div key={idea.id} className="h-[400px]">
                                                            <IdeaCard
                                                                idea={idea}
                                                                currentUser={currentUser}
                                                            />
                                                        </div>
                                                    ))}
                                                </Suspense>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10 mb-16">
                                                <p className="text-gray-400 mb-4">No ideas posted yet.</p>
                                            </div>
                                        )}

                                        {/* News/Articles Header (Updated) */}
                                        <div className="flex justify-between items-center mb-8 mt-16">
                                            <h2 className="text-3xl font-bold flex items-center gap-2">
                                                <Globe className="text-gold" size={32} /> Recent <span className="text-gold">Articles</span>
                                            </h2>
                                            <Link to="/news" className="text-gold hover:text-white flex items-center gap-2 transition-colors">
                                                View All <ArrowRight size={16} />
                                            </Link>
                                        </div>

                                        {/* News Feed Grid or Empty State */}
                                        {recentArticles.length > 0 ? (
                                            <Suspense fallback={<div className="text-center text-gray-500 py-10">Loading articles...</div>}>
                                                <NewsFeed limit={3} compact={true} articles={recentArticles} />
                                            </Suspense>
                                        ) : (
                                            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10 mb-16">
                                                <p className="text-gray-400 mb-4">No recent articles.</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>
            </ErrorBoundary >

            {/* LEADERBOARD SECTION */}
            <ErrorBoundary>
                <section className="py-24 px-4 bg-gradient-to-b from-black to-deep-black relative overflow-hidden">
                    {/* Background Elements */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" />

                    <div className="max-w-7xl mx-auto relative z-10">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 flex items-center justify-center gap-4">
                                <Trophy className="text-gold stroke-[3]" size={48} />
                                <span className="text-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] tracking-wide">
                                    ELITE TRADERS
                                </span>
                            </h2>
                            <p className="text-xl text-gray-400 font-mono tracking-wider">Top performers in the Singularity ecosystem.</p>
                        </div>

                        <LeaderboardDisplay currentUser={currentUser} leaders={leaderboard} />
                    </div>
                </section>
            </ErrorBoundary>

            {/* Pricing Section */}
            < ErrorBoundary >
                <section className="py-24 px-4 bg-deep-black">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-bold mb-6">Choose Your <span className="text-gold">Subscription</span></h2>
                            <p className="text-xl text-gray-400">Unlock the full potential of M.I.C. Singularity.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <SubscriptionCard
                                title="Basic"
                                price="$0"
                                period="/month"
                                planId="FREE_TIER"
                                features={["Limited product usage", "Community access"]}
                                delay={0.1}
                            />
                            <SubscriptionCard
                                title="Pro"
                                price="$19"
                                period="/month"
                                planId={import.meta.env.VITE_PAYPAL_VISIONARY_PLAN_ID}
                                features={["Priority support", "Higher product usage limits", "Community access"]}
                                isPopular={true}
                                delay={0.2}
                            />
                            <SubscriptionCard
                                title="Enterprise"
                                price="$49"
                                period="/month"
                                planId={import.meta.env.VITE_PAYPAL_INSTITUTIONAL_PLAN_ID}
                                features={["High product usage limits", "Community access", "Priority support", "Early access to new features"]}
                                delay={0.3}
                            />
                        </div>
                    </div>
                </section>
            </ErrorBoundary >

            {/* FAQ Section */}
            < ErrorBoundary >
                <FAQSection />
            </ErrorBoundary >

            {/* Footer */}
            <ErrorBoundary>
                <Footer />
            </ErrorBoundary>
        </div>
    );
};

export default LandingPage;