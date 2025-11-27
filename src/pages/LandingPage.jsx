import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Check, ChevronDown, ChevronUp, TrendingUp, Shield, Zap, Globe, BarChart2, Lock, Users, FileText } from 'lucide-react';
import MarketDashboard from '../components/MarketDashboard';
import Watchlist from '../components/Watchlist';
import NewsFeed from '../components/NewsFeed';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <div className="p-4 text-red-500 bg-white/10 rounded-lg">Something went wrong in this section.</div>;
        }

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

const WealthCalculator = () => {
    const [initial, setInitial] = useState(10000);
    const [monthly, setMonthly] = useState(500);
    const years = 20;
    const rate = 0.08; // 8% return

    const futureValue = initial * Math.pow(1 + rate, years) + monthly * ((Math.pow(1 + rate, years) - 1) / rate) * (1 + rate);
    const bankValue = initial + (monthly * 12 * years); // 0% interest assumption for contrast

    return (
        <section className="py-24 px-4 bg-deep-black">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                    <h2 className="text-4xl font-bold mb-6">Visualize Your <span className="text-gold">Potential</span></h2>
                    <p className="text-gray-400 text-lg mb-12">See how the power of compounding and AI-optimized strategies can transform your financial future over 20 years.</p>

                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-gray-300">Initial Investment</label>
                                <span className="text-gold font-bold">${initial.toLocaleString()}</span>
                            </div>
                            <input
                                type="range"
                                min="1000"
                                max="100000"
                                step="1000"
                                value={initial}
                                onChange={(e) => setInitial(parseInt(e.target.value))}
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
                                min="100"
                                max="5000"
                                step="100"
                                value={monthly}
                                onChange={(e) => setMonthly(parseInt(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
                    <div className="space-y-6">
                        <div className="p-6 bg-black/40 rounded-xl border border-gold/30">
                            <p className="text-gray-400 text-sm mb-1">With M.I.C. Singularity (8% avg)</p>
                            <p className="text-4xl font-bold text-gold">${Math.round(futureValue).toLocaleString()}</p>
                        </div>
                        <div className="p-6 bg-black/40 rounded-xl border border-white/10">
                            <p className="text-gray-400 text-sm mb-1">Traditional Savings (0% avg)</p>
                            <p className="text-2xl font-bold text-gray-300">${Math.round(bankValue).toLocaleString()}</p>
                        </div>
                        <div className="pt-4 border-t border-white/10">
                            <p className="text-green-400 font-bold text-lg">
                                +${Math.round(futureValue - bankValue).toLocaleString()} Potential Gain
                            </p>
                        </div>
                    </div>
                </div>
            </div>
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
                        <h2 className="text-3xl font-bold mb-8 text-center">Live <span className="text-gold">Watchlist</span></h2>
                        <Watchlist />
                    </div>
                </section>
            </ErrorBoundary>

            {/* Recent Articles (M.I.C.K.S.) - Displayed below Watchlist via NewsFeed */}
            <ErrorBoundary>
                <NewsFeed limit={3} />
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