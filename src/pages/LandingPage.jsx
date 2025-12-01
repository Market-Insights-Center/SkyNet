import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, Shield, Zap, Globe, BarChart2, Users, Lightbulb, HelpCircle, X, Cpu, Eye, EyeOff } from 'lucide-react';
import MarketDashboard from '../components/MarketDashboard';
import Watchlist from '../components/Watchlist';
import NewsFeed from '../components/NewsFeed';
import IdeaCard from '../components/IdeaCard';
import Footer from '../components/Footer';
import SubscriptionCard from '../components/SubscriptionCard';
import { useAuth } from '../contexts/AuthContext';

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
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: delay }}
        className="bg-white/5 p-8 rounded-2xl border border-white/10 hover:border-gold/50 transition-colors group h-full flex flex-col"
    >
        <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-colors">
            <Icon size={32} className="text-gold" />
        </div>
        <h3 className="text-2xl font-bold mb-4 text-white">{title}</h3>
        <p className="text-gray-400 leading-relaxed flex-grow">{desc}</p>
    </motion.div>
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
const PerformanceModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                // UPDATED: Added max-h-[85vh] and flex-col to ensure it doesn't get cut off, and scrolls properly
                className="bg-[#0a0a0a] border border-gold/30 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative"
            >
                <div className="p-4 border-b border-white/10 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {/* UPDATED: Added Image at the top */}
                    <div className="mb-8 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                        <img 
                            src="/cultivatebacktest.png" 
                            alt="Performance Visualization" 
                            className="w-full h-auto object-cover"
                        />
                    </div>

                    <div className="text-center mb-8">
                        <h3 className="text-3xl font-bold mb-2">Detailed <span className="text-gold">Performance Metrics</span></h3>
                        <p className="text-gray-400">Cultivate vs. SPY Benchmark (Nov 2015 - Nov 2025)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-gold font-bold mb-3 border-b border-gold/20 pb-2 tracking-wider text-sm">OVERALL PERFORMANCE</h4>
                                <div className="space-y-0.5">
                                    <StatRow label="Correlation to SPY" value="0.5975" tooltip={tooltips.correlation} />
                                    <StatRow label="Beta to SPY" value="0.9922" tooltip={tooltips.beta} />
                                    <div className="mt-3 mb-1"><span className="text-xs text-gold font-bold uppercase">Cultivate Portfolio</span></div>
                                    <StatRow label="Mean Daily Return" value="0.0818%" tooltip={tooltips.meanDaily} />
                                    <StatRow label="Std Dev Daily Return" value="2.7844%" tooltip={tooltips.stdDev} />
                                    <StatRow label="Upside Std Dev" value="1.9168%" tooltip={tooltips.upsideDev} />
                                    <StatRow label="Downside Std Dev" value="1.9056%" tooltip={tooltips.downsideDev} />
                                    <StatRow label="CVaR 5% (Loss)" value="-6.0487%" tooltip={tooltips.cvar} />
                                    <StatRow label="Conditional Gain 5%" value="6.3023%" tooltip={tooltips.condGain} />
                                    <div className="mt-3 mb-1"><span className="text-xs text-gray-400 font-bold uppercase">SPY Benchmark</span></div>
                                    <StatRow label="Mean Daily Return" value="0.0535%" />
                                    <StatRow label="Std Dev Daily Return" value="1.1425%" />
                                    <StatRow label="Upside Std Dev" value="0.8043%" />
                                    <StatRow label="Downside Std Dev" value="0.9458%" />
                                    <StatRow label="CVaR 5% (Loss)" value="-2.7814%" />
                                    <StatRow label="Conditional Gain 5%" value="2.4817%" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-gold font-bold mb-3 border-b border-gold/20 pb-2 tracking-wider text-sm">CONDITION: SPY SCORE &lt; 40</h4>
                                <div className="space-y-0.5">
                                    <StatRow label="Correlation to SPY" value="0.5240" tooltip={tooltips.correlation} />
                                    <StatRow label="Beta to SPY" value="0.6767" tooltip={tooltips.beta} />
                                    <div className="mt-3 mb-1"><span className="text-xs text-gold font-bold uppercase">Cultivate Portfolio</span></div>
                                    <StatRow label="Mean Daily Return" value="0.0163%" tooltip={tooltips.meanDaily} />
                                    <StatRow label="Std Dev Daily Return" value="3.2298%" tooltip={tooltips.stdDev} />
                                    <StatRow label="Upside Std Dev" value="2.2508%" tooltip={tooltips.upsideDev} />
                                    <StatRow label="Downside Std Dev" value="2.2550%" tooltip={tooltips.downsideDev} />
                                    <StatRow label="CVaR 5% (Loss)" value="-7.1732%" tooltip={tooltips.cvar} />
                                    <StatRow label="Conditional Gain 5%" value="7.5372%" tooltip={tooltips.condGain} />
                                    <div className="mt-3 mb-1"><span className="text-xs text-gray-400 font-bold uppercase">SPY Benchmark</span></div>
                                    <StatRow label="Mean Daily Return" value="0.1370%" />
                                    <StatRow label="Std Dev Daily Return" value="2.5010%" />
                                    <StatRow label="Upside Std Dev" value="1.8387%" />
                                    <StatRow label="Downside Std Dev" value="1.7942%" />
                                    <StatRow label="CVaR 5% (Loss)" value="-5.6316%" />
                                    <StatRow label="Conditional Gain 5%" value="6.1072%" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-gold font-bold mb-3 border-b border-gold/20 pb-2 tracking-wider text-sm">CONDITION: SPY SCORE &gt;= 60</h4>
                                <div className="space-y-0.5">
                                    <StatRow label="Correlation to SPY" value="0.6195" tooltip={tooltips.correlation} />
                                    <StatRow label="Beta to SPY" value="1.6614" tooltip={tooltips.beta} />
                                    <div className="mt-3 mb-1"><span className="text-xs text-gold font-bold uppercase">Cultivate Portfolio</span></div>
                                    <StatRow label="Mean Daily Return" value="0.1535%" tooltip={tooltips.meanDaily} />
                                    <StatRow label="Std Dev Daily Return" value="2.2233%" tooltip={tooltips.stdDev} />
                                    <StatRow label="Upside Std Dev" value="1.4833%" tooltip={tooltips.upsideDev} />
                                    <StatRow label="Downside Std Dev" value="1.4402%" tooltip={tooltips.downsideDev} />
                                    <StatRow label="CVaR 5% (Loss)" value="-4.8172%" tooltip={tooltips.cvar} />
                                    <StatRow label="Conditional Gain 5%" value="4.9490%" tooltip={tooltips.condGain} />
                                    <div className="mt-3 mb-1"><span className="text-xs text-gray-400 font-bold uppercase">SPY Benchmark</span></div>
                                    <StatRow label="Mean Daily Return" value="0.0425%" />
                                    <StatRow label="Std Dev Daily Return" value="0.8290%" />
                                    <StatRow label="Upside Std Dev" value="0.4458%" />
                                    <StatRow label="Downside Std Dev" value="0.7138%" />
                                    <StatRow label="CVaR 5% (Loss)" value="-2.1785%" />
                                    <StatRow label="Conditional Gain 5%" value="1.5350%" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- WealthCalculator Component ---
const WealthCalculator = () => {
    const [initial, setInitial] = useState(10000);
    const [monthly, setMonthly] = useState(500);
    const [showModal, setShowModal] = useState(false);

    // Config
    const years = 10;
    const months = years * 12;

    // Rates (CAGR -> Monthly Effective Rate)
    const rateSingularity = 0.2127;
    const monthlyRateSingularity = Math.pow(1 + rateSingularity, 1 / 12) - 1;

    const rateSPY = 0.1254;
    const monthlyRateSPY = Math.pow(1 + rateSPY, 1 / 12) - 1;

    const rateSavings = 0.046;
    const monthlyRateSavings = Math.pow(1 + rateSavings, 1 / 12) - 1;

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
        <section className="py-24 px-4 bg-deep-black border-t border-white/5">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                    <h2 className="text-4xl font-bold mb-6">Visualize Your <span className="text-gold">Potential</span></h2>
                    <p className="text-gray-400 text-lg mb-12">See how the power of compounding and AI-optimized strategies can transform your financial future over 10 years.</p>
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
                                <label className="text-gray-300">Monthly Contribution</label>
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
                                    <p className="text-gray-300 text-sm">With M.I.C. Singularity (587.21% growth)</p>
                                    <Tooltip text="Singularity's performance is based on the Cultivate tool's performance from November 30th 2015 to November 27th 2025">
                                        <HelpCircle size={14} className="text-gray-500 hover:text-gold cursor-help transition-colors" />
                                    </Tooltip>
                                </div>
                                <p className="text-4xl font-bold text-gold">${Math.round(singularityValue).toLocaleString()}</p>
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="text-xs text-gold/70 hover:text-gold mt-2 underline decoration-dotted flex items-center gap-1 transition-colors"
                                >
                                    see more details
                                </button>
                            </div>
                        </div>

                        {/* SPY Benchmark Result */}
                        <div className="p-6 bg-black/40 rounded-xl border border-white/10">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-gray-400 text-sm">SPY Benchmark (225.69% growth)</p>
                                <Tooltip text="SPY benchmark is based on the growth in the SPY from opening price in November 2015 to opening price in November 2025">
                                    <HelpCircle size={14} className="text-gray-500 hover:text-gold cursor-help transition-colors" />
                                </Tooltip>
                            </div>
                            <p className="text-2xl font-bold text-gray-200">${Math.round(spyValue).toLocaleString()}</p>
                        </div>

                        {/* Traditional Savings Result */}
                        <div className="p-6 bg-black/40 rounded-xl border border-white/10">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-gray-400 text-sm">Traditional Savings (4.6% APY)</p>
                                <Tooltip text="According to the Federal Reserve Bank of St. Louis (F.R.E.D.) as of November 2025">
                                    <HelpCircle size={14} className="text-gray-500 hover:text-gold cursor-help transition-colors" />
                                </Tooltip>
                            </div>
                            <p className="text-2xl font-bold text-gray-300">${Math.round(savingsValue).toLocaleString()}</p>
                        </div>

                        {/* Potential Gains Section */}
                        <div className="pt-4 border-t border-white/10 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Potential Gain vs Savings</span>
                                <p className="text-green-400 font-bold text-lg">
                                    +${Math.round(singularityValue - savingsValue).toLocaleString()}
                                </p>
                            </div>
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

            <AnimatePresence>
                {showModal && <PerformanceModal isOpen={showModal} onClose={() => setShowModal(false)} />}
            </AnimatePresence>
        </section>
    );
};

// --- Updated FAQ Section ---
const FAQSection = () => {
    const faqs = [
        {
            q: "What distinguishes the 'Pro' tier from the 'Basic' tier?",
            a: "The Pro tier is built for active investors seeking Alpha. While Basic gives you limited product usage and community access, Pro unlocks priority support and higher usage limits."
        },
        {
            q: "How does the 'Singularity' model adapt to market changes?",
            a: "M.I.C. Singularity uses a hybrid approach of quantitative momentum strategies and deep learning. It constantly retrains on new price action and volatility data, allowing it to shift between offensive and defensive postures automatically."
        },
        {
            q: "Is my personal and financial data secure?",
            a: "Security is our priority. We use bank-grade AES-256 encryption for all data transmission and storage. Furthermore, M.I.C. is a non-custodial analytics platform; we do not hold your funds or have withdrawal access to your brokerage accounts."
        },
        {
            q: "Do you offer API access for custom integrations?",
            a: "Yes, API access is available exclusively in the Enterprise tier. This allows you to programmatically access our signals, market data, and sentiment analysis for integration into your own algo-trading bots or dashboards."
        },
        {
            q: "Can I cancel or upgrade my subscription at any time?",
            a: "Absolutely. You can manage your subscription directly from your user dashboard. Upgrades take effect immediately, and cancellations will allow you to keep access until the end of your current billing cycle."
        }
    ];

    return (
        <section className="py-24 px-4 bg-[#0a0a0a] border-t border-white/5">
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

const LandingPage = () => {
    const { currentUser } = useAuth();
    const [recentIdeas, setRecentIdeas] = useState([]);
    const [recentArticles, setRecentArticles] = useState([]);
    const [showCommunityStream, setShowCommunityStream] = useState(false);

    useEffect(() => {
        // Fetch Recent Ideas
        fetch('/api/ideas?limit=3')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setRecentIdeas(data);
                else setRecentIdeas([]);
            })
            .catch(err => console.error("Error fetching ideas:", err));

        // Fetch Recent Articles
        fetch('/api/articles?limit=3')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setRecentArticles(data);
                else setRecentArticles([]);
            })
            .catch(err => console.error("Error fetching articles:", err));
    }, []);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Hero Section */}
            <ErrorBoundary>
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
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black"></div>
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
            <ErrorBoundary>
                <section className="py-24 px-4 bg-black relative z-10">
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
                                desc="Seamlessly sync with supported brokers for automated rebalancing and trade execution. (Coming Soon)"
                                delay={0.6}
                            />
                        </div>
                    </div>
                </section>
            </ErrorBoundary>

            {/* Wealth Calculator */}
            <ErrorBoundary>
                <WealthCalculator />
            </ErrorBoundary>

            {/* Market Dashboard */}
            <ErrorBoundary>
                <MarketDashboard />
            </ErrorBoundary>

            {/* Watchlist & Community Stream Section */}
            <ErrorBoundary>
                <section className="py-12 px-4 bg-black">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-bold text-center">Live <span className="text-gold">Watchlist</span></h2>
                        </div>
                        <Watchlist />

                        {/* Toggle Button */}
                        <div className="flex justify-center mt-12 mb-8">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowCommunityStream(!showCommunityStream)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${showCommunityStream
                                    ? "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                                    : "bg-gold/10 text-gold hover:bg-gold/20 border border-gold/30"
                                    }`}
                            >
                                {showCommunityStream ? (
                                    <>
                                        <EyeOff size={18} /> Hide Community Stream
                                    </>
                                ) : (
                                    <>
                                        <Eye size={18} /> Show Community Stream
                                    </>
                                )}
                            </motion.button>
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
                                                {recentIdeas.map(idea => (
                                                    <div key={idea.id} className="h-[400px]">
                                                        <IdeaCard
                                                            idea={idea}
                                                            currentUser={currentUser}
                                                        />
                                                    </div>
                                                ))}
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
                                            <NewsFeed limit={3} compact={true} articles={recentArticles} />
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
            </ErrorBoundary>

            {/* Pricing Section */}
            <ErrorBoundary>
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
            </ErrorBoundary>

            {/* FAQ Section */}
            <ErrorBoundary>
                <FAQSection />
            </ErrorBoundary>

            {/* Footer */}
            <ErrorBoundary>
                <Footer />
            </ErrorBoundary>
        </div>
    );
};

export default LandingPage;