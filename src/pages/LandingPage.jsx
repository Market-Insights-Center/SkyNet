import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Check, ChevronDown, ChevronUp, TrendingUp, Shield, Zap, Globe, BarChart2, Lock, Users, FileText, Lightbulb, HelpCircle, X } from 'lucide-react';
import MarketDashboard from '../components/MarketDashboard';
import Watchlist from '../components/Watchlist';
import NewsFeed from '../components/NewsFeed';
import IdeaCard from '../components/IdeaCard';
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
        className="bg-white/5 p-8 rounded-2xl border border-white/10 hover:border-gold/50 transition-colors group"
    >
        <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-colors">
            <Icon size={32} className="text-gold" />
        </div>
        <h3 className="text-2xl font-bold mb-4 text-white">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{desc}</p>
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
            {/* Render tooltip in document.body via Portal to avoid overflow clipping */}
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
                                zIndex: 9999 // Very high z-index to sit on top of modal
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

const StatRow = ({ label, value, tooltip }) => (
    <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded transition-colors">
        <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{label}</span>
            {tooltip && (
                <Tooltip text={tooltip}>
                    <HelpCircle size={12} className="text-gray-500 hover:text-gold cursor-help transition-colors" />
                </Tooltip>
            )}
        </div>
        <span className="text-gray-200 font-mono text-sm font-medium">{value}</span>
    </div>
);

// --- Performance Details Modal ---
const PerformanceModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const tooltips = {
        totalReturn: "The percentage increase in the portfolio's value over the entire period.",
        cagr: "Compound Annual Growth Rate: The mean annual growth rate of an investment over a specified period of time longer than one year.",
        correlation: "A statistic that measures the degree to which the portfolio moves in relation to the SPY. Ranges from -1 to 1.",
        beta: "A measure of the volatility, or systematic risk, of the portfolio in comparison to the market (SPY).",
        meanDaily: "The average return realized by the portfolio on a daily basis.",
        stdDev: "Standard Deviation: A measure of the amount of variation or dispersion of the daily returns.",
        upsideDev: "A measure of volatility that only considers positive returns.",
        downsideDev: "A measure of volatility that only considers negative returns (downside risk).",
        cvar: "Conditional Value at Risk (5%): The weighted average of losses that occur beyond the 5% VaR threshold (worst 5% of days).",
        condGain: "The average gain on the best 5% of trading days."
    };

    return (
        // MODIFIED: Changed items-center to items-start, added pt-16 (padding-top) to force modal down
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4 pb-4 bg-black/80 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                // MODIFIED: Changed max-height to calc(100vh-6rem) to account for top padding
                className="bg-[#0a0a0a] border border-gold/20 rounded-2xl w-full max-w-5xl max-h-[calc(100vh-6rem)] overflow-y-auto shadow-2xl scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-black"
            >
                {/* Sticky Header with X Button */}
                <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10 p-4 flex justify-between items-center z-10">
                    <h3 className="text-xl font-bold text-gold">Performance Details</h3>
                    {/* Close Button "X" */}
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                        aria-label="Close details"
                    >
                        <X size={24} className="text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                </div>
                
                <div className="p-6 space-y-8">
                    {/* Performance Graph Image */}
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black relative h-[300px] md:h-[400px]">
                         <img 
                            src="/cultivatebacktest.png" 
                            alt="Cultivate Backtest vs SPY Graph" 
                            className="w-full h-full object-contain"
                        />
                    </div>

                    {/* Detailed Stats Text Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column */}
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-gold font-bold mb-3 border-b border-gold/20 pb-2 tracking-wider text-sm">PERFORMANCE SUMMARY</h4>
                                <div className="space-y-0.5">
                                    <StatRow label="Start Date" value="2015-11-30" />
                                    <StatRow label="End Date" value="2025-11-27" />
                                    <StatRow label="Duration" value="9.99 years" />
                                    <StatRow label="Initial Portfolio Value" value="$10,000.00" />
                                    <StatRow label="Final Portfolio Value" value="$68,721.09" />
                                    <StatRow label="Total Return" value="587.21%" tooltip={tooltips.totalReturn} />
                                    <StatRow label="CAGR" value="21.27%" tooltip={tooltips.cagr} />
                                </div>
                            </div>

                            <div>
                                <h4 className="text-gold font-bold mb-3 border-b border-gold/20 pb-2 tracking-wider text-sm">SPY BENCHMARK</h4>
                                <div className="space-y-0.5">
                                    <StatRow label="Final Value" value="$32,568.88" />
                                    <StatRow label="Total Return" value="225.69%" tooltip={tooltips.totalReturn} />
                                    <StatRow label="CAGR" value="12.54%" tooltip={tooltips.cagr} />
                                </div>
                            </div>

                            <div>
                                <h4 className="text-gold font-bold mb-3 border-b border-gold/20 pb-2 tracking-wider text-sm">CONDITION: OVERALL</h4>
                                <div className="space-y-0.5">
                                    <StatRow label="Correlation to SPY" value="0.6187" tooltip={tooltips.correlation} />
                                    <StatRow label="Beta to SPY" value="1.1277" tooltip={tooltips.beta} />
                                    
                                    <div className="mt-3 mb-1"><span className="text-xs text-gold font-bold uppercase">Cultivate Portfolio</span></div>
                                    <StatRow label="Mean Daily Return" value="0.0984%" tooltip={tooltips.meanDaily} />
                                    <StatRow label="Std Dev Daily Return" value="2.0824%" tooltip={tooltips.stdDev} />
                                    <StatRow label="Upside Std Dev" value="1.4233%" tooltip={tooltips.upsideDev} />
                                    <StatRow label="Downside Std Dev" value="1.4754%" tooltip={tooltips.downsideDev} />
                                    <StatRow label="CVaR 5% (Loss)" value="-4.8520%" tooltip={tooltips.cvar} />
                                    <StatRow label="Conditional Gain 5%" value="4.8178%" tooltip={tooltips.condGain} />

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

                        {/* Right Column */}
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
    // Singularity: 21.27% CAGR
    const rateSingularity = 0.2127; 
    const monthlyRateSingularity = Math.pow(1 + rateSingularity, 1/12) - 1;

    // SPY: 12.54% CAGR (Derived from 225.69% total return over 10 years)
    const rateSPY = 0.1254;
    const monthlyRateSPY = Math.pow(1 + rateSPY, 1/12) - 1;

    // Savings: 4.6% Annualized
    const rateSavings = 0.046;
    const monthlyRateSavings = Math.pow(1 + rateSavings, 1/12) - 1;

    // Calculation Function (Future Value of a Series + Initial Lump Sum)
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
        <section className="py-24 px-4 bg-deep-black">
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

const FAQSection = () => {
    const faqs = [
        { q: "Is my data secure?", a: "Absolutely. We use bank-grade AES-256 encryption to protect your personal and financial information. Your data is never sold to third parties." },
        { q: "Can I cancel my subscription anytime?", a: "Yes, you can cancel your subscription at any time with no hidden fees or penalties. You'll retain access until the end of your billing cycle." },
        { q: "Do I need prior trading experience?", a: "Not at all. M.I.C. Singularity is designed for all skill levels. Our 'Explorer' tier is perfect for beginners, while 'Visionary' offers tools for experts." },
        { q: "How does the AI analysis work?", a: "Our proprietary algorithms analyze historical price action, volume, and market sentiment to identify high-probability opportunities and optimize portfolio allocation." }
    ];

    return (
        <section className="py-24 px-4 bg-[#0a0a0a]">
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
                        <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const PricingCard = ({ title, price, period, features, isPopular, delay }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: delay }}
            className={`relative p-8 rounded-2xl border ${isPopular ? 'border-gold bg-gold/5' : 'border-white/10 bg-white/5'} flex flex-col h-full hover:transform hover:-translate-y-2 transition-all duration-300`}
        >
            {isPopular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gold text-black px-4 py-1 rounded-full text-sm font-bold">
                    Most Popular
                </div>
            )}
            <h3 className={`text-2xl font-bold mb-2 ${isPopular ? 'text-gold' : 'text-white'}`}>{title}</h3>
            <div className="flex items-baseline mb-6">
                <span className="text-4xl font-bold text-white">{price}</span>
                <span className="text-gray-400 ml-1">{period}</span>
            </div>
            <ul className="space-y-4 mb-8 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-300">
                        <Check size={18} className="text-gold mr-3 flex-shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>
            <button className={`w-full py-3 rounded-lg font-bold transition-colors ${isPopular ? 'bg-gold text-black hover:bg-yellow-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {price === "$0" ? "Get Started" : "Start Free Trial"}
            </button>
        </motion.div>
    );
};

const LandingPage = () => {
    const { currentUser } = useAuth();
    const [recentIdeas, setRecentIdeas] = useState([]);

    useEffect(() => {
        // UPDATED PORT: 8001
        fetch('http://localhost:8001/api/ideas?limit=3')
            .then(res => res.json())
            .then(data => setRecentIdeas(data))
            .catch(err => console.error("Error fetching ideas:", err));
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
                            <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
                                M.I.C. <span className="text-gold">SINGULARITY</span>
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

            {/* Market Dashboard */}
            <ErrorBoundary>
                <MarketDashboard />
            </ErrorBoundary>

            {/* Watchlist Preview */}
            <ErrorBoundary>
                <section className="py-12 px-4 bg-black">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                             <h2 className="text-3xl font-bold text-center">Live <span className="text-gold">Watchlist</span></h2>
                             {/* Added View All for consistency */}
                        </div>
                        <Watchlist /> 
                        
                        <div className="flex justify-between items-center mb-8 mt-12">
                            <h2 className="text-3xl font-bold flex items-center gap-2">
                                <Lightbulb className="text-gold" size={32} /> Recent <span className="text-gold">Ideas</span>
                            </h2>
                            <Link to="/ideas" className="text-gold hover:text-white flex items-center gap-2 transition-colors">
                                View All <ArrowRight size={16} />
                            </Link>
                        </div>

                        {recentIdeas.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                                <p className="text-gray-400 mb-4">No ideas posted yet.</p>
                            </div>
                        )}
                    </div>
                </section>
            </ErrorBoundary>

            {/* News Feed with View All */}
            <ErrorBoundary>
                <NewsFeed limit={3} showViewAll={true} />
            </ErrorBoundary>

            {/* Features Section */}
            <ErrorBoundary>
                <section className="py-24 px-4 bg-black relative z-10">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Engineered for <span className="text-gold">Alpha</span></h2>
                            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                                Our platform combines cutting-edge technology with proven financial models to deliver superior results.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <FeatureCard
                                icon={Zap}
                                title="AI-Powered Analysis"
                                desc="Real-time market scanning and predictive modeling to identify high-probability opportunities before they move."
                                delay={0.1}
                            />
                            <FeatureCard
                                icon={Shield}
                                title="Risk Management"
                                desc="Institutional-grade risk protocols that dynamically adjust your exposure based on market volatility."
                                delay={0.2}
                            />
                            <FeatureCard
                                icon={BarChart2}
                                title="Automated Rebalancing"
                                desc="Smart portfolio adjustments to maintain your target allocation and capitalize on market inefficiencies."
                                delay={0.3}
                            />
                        </div>
                    </div>
                </section>
            </ErrorBoundary>

            <ErrorBoundary>
                <WealthCalculator />
            </ErrorBoundary>

            <ErrorBoundary>
                <FAQSection />
            </ErrorBoundary>

            {/* Pricing Section */}
            <ErrorBoundary>
                <section className="py-24 px-4 bg-deep-black">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-bold mb-6">Choose Your <span className="text-gold">Tier</span></h2>
                            <p className="text-xl text-gray-400">Unlock the full potential of M.I.C. Singularity.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <PricingCard
                                title="Explorer"
                                price="$0"
                                period="/month"
                                features={["Basic Market Data", "Daily Newsletter", "Community Access"]}
                                delay={0.1}
                            />
                            <PricingCard
                                title="Visionary"
                                price="$49"
                                period="/month"
                                features={["Real-time AI Signals", "Advanced Portfolio Lab", "Priority Support", "Unlimited Backtesting"]}
                                isPopular={true}
                                delay={0.2}
                            />
                            <PricingCard
                                title="Institutional"
                                price="$199"
                                period="/month"
                                features={["API Access", "Dedicated Account Manager", "Custom Strategy Development", "White-label Reports"]}
                                delay={0.3}
                            />
                        </div>
                    </div>
                </section>
            </ErrorBoundary>
        </div>
    );
};

export default LandingPage;