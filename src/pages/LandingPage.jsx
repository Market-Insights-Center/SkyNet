import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Brain, RefreshCw, Shield, Twitter, Linkedin, Disc } from 'lucide-react';
import MarketDashboard from '../components/MarketDashboard';
import Watchlist from '../components/Watchlist';

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-deep-black text-white overflow-x-hidden font-sans">
            {/* Hero Section with Video Background */}
            <section className="relative h-screen flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-black/60 z-10" />
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        poster="blackimg.png"
                    >
                        <source src="/landingpagestocks.mp4" type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                </div>

                <div className="relative z-20 text-center px-4 max-w-5xl mx-auto">
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-6xl md:text-8xl font-bold mb-6 tracking-tight drop-shadow-2xl"
                    >
                        M.I.C. <span className="text-gold">SINGULARITY</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-2xl md:text-3xl text-gray-200 font-light mb-12 tracking-wide drop-shadow-lg"
                    >
                        The Next Era of Investing, For All
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        <Link
                            to="/portfolio-lab"
                            className="bg-gold text-black px-10 py-4 rounded-full text-lg font-bold hover:bg-yellow-500 transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(212,175,55,0.5)]"
                        >
                            Enter Portfolio Lab
                        </Link>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-20"
                >
                    <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center p-1">
                        <motion.div
                            animate={{ y: [0, 12, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-1.5 h-1.5 bg-white rounded-full"
                        />
                    </div>
                </motion.div>
            </section>

            {/* Market Intelligence Section */}
            <MarketDashboard />
            <Watchlist />

            {/* Mission Statement Section */}
            <section className="py-24 px-4 bg-deep-black relative">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-gold mb-8">Our Mission</h2>
                        <p className="text-xl md:text-2xl text-gray-300 leading-relaxed font-light">
                            "At M.I.C. Singularity, we believe that advanced financial intelligence shouldn't be the privilege of the few. Our mission is to democratize institutional-grade portfolio management through the power of artificial intelligence. By fusing cutting-edge algorithms with intuitive design, we empower every investor—from the novice to the expert—to build, test, and execute wealth-generating strategies with precision and confidence. Welcome to the singularity of finance."
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Products Section */}
            <section className="py-24 px-4 bg-[#0a0a0a]" id="products">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">Our Products</h2>
                        <p className="text-gray-400 text-xl">Access the tools that power the singularity</p>
                    </div>

                    {/* Main Product: Portfolio Lab */}
                    <div className="mb-16">
                        <Link to="/portfolio-lab">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="relative group overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-deep-black to-purple-900/20 p-8 md:p-12 hover:border-gold/60 transition-all duration-500"
                            >
                                <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                                    <div className="flex-1 text-center md:text-left">
                                        <div className="inline-block px-4 py-1 rounded-full bg-gold/20 text-gold font-bold text-sm mb-4 border border-gold/30">
                                            FLAGSHIP
                                        </div>
                                        <h3 className="text-3xl md:text-4xl font-bold mb-4 text-white group-hover:text-gold transition-colors">Portfolio Lab</h3>
                                        <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                                            The ultimate environment for testing, analyzing, and perfecting your investment strategies.
                                            Harness the power of AI to simulate market conditions and optimize your allocations before risking real capital.
                                        </p>
                                        <span className="inline-flex items-center text-gold font-bold group-hover:translate-x-2 transition-transform">
                                            Enter Laboratory <ChevronDown className="ml-2 -rotate-90" />
                                        </span>
                                    </div>
                                    <div className="flex-1 flex justify-center">
                                        <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-black/50 border-2 border-gold/30 flex items-center justify-center relative shadow-[0_0_50px_rgba(212,175,55,0.2)] group-hover:shadow-[0_0_80px_rgba(212,175,55,0.4)] transition-shadow duration-500">
                                            <Brain size={80} className="text-gold animate-pulse" />
                                            <div className="absolute inset-0 border border-white/10 rounded-full animate-[spin_10s_linear_infinite]" />
                                            <div className="absolute inset-4 border border-purple-500/30 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </Link>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <FeatureCard
                            icon={Brain}
                            title="AI-Powered Analysis"
                            desc="Our neural networks process millions of data points to identify hidden patterns and predictive signals that human analysis misses."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={RefreshCw}
                            title="Automated Rebalancing"
                            desc="Keep your portfolio perfectly aligned with your goals. Our systems automatically adjust allocations to maintain your target risk profile."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Institutional Risk Management"
                            desc="Protect your wealth with the same sophisticated hedging and risk mitigation strategies used by top hedge funds."
                            delay={0.3}
                        />
                    </div>
                </div>
            </section>

            {/* Interactive Wealth Calculator */}
            <WealthCalculator />

            {/* Pricing Section */}
            <section className="py-24 px-4 bg-gradient-to-b from-deep-black to-[#1a1a1a]">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">Choose Your Path</h2>
                        <p className="text-gray-400 text-xl">Unlock the full potential of your portfolio</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <PricingCard
                            title="Explorer"
                            price="$0"
                            period="/mo"
                            features={[
                                "Access to Portfolio Lab",
                                "1 Custom Strategy",
                                "Basic Market Data",
                                "Community Support"
                            ]}
                            delay={0.1}
                        />
                        <PricingCard
                            title="Navigator"
                            price="$29"
                            period="/mo"
                            isPopular={true}
                            features={[
                                "Unlimited Strategies",
                                "Advanced Analytics",
                                "Real-time Data",
                                "Priority Support",
                                "14-Day Free Trial"
                            ]}
                            delay={0.2}
                        />
                        <PricingCard
                            title="Visionary"
                            price="$99"
                            period="/mo"
                            features={[
                                "AI-Driven Insights",
                                "API Access",
                                "Institutional Tools",
                                "Dedicated Advisor",
                                "30-Day Free Trial"
                            ]}
                            delay={0.3}
                        />
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <FAQSection />

            {/* Newsletter Section */}
            <section className="py-24 px-4 bg-gold/5 border-y border-gold/10">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">Join the Singularity</h2>
                    <p className="text-gray-400 text-xl mb-8">Get the latest market insights and platform updates delivered to your inbox.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="flex-grow px-6 py-3 rounded-lg bg-black/50 border border-white/20 focus:border-gold focus:outline-none text-white placeholder-gray-500"
                        />
                        <button className="bg-gold text-black px-8 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors">
                            Subscribe
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-black py-12 px-4 border-t border-white/10">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="col-span-1 md:col-span-2">
                        <h3 className="text-2xl font-bold mb-4">M.I.C. <span className="text-gold">SINGULARITY</span></h3>
                        <p className="text-gray-400 max-w-sm">Democratizing institutional-grade portfolio management for the modern investor.</p>
                    </div>
                    <div>
                        <h4 className="font-bold mb-4 text-white">Platform</h4>
                        <ul className="space-y-2 text-gray-400">
                            <li><Link to="/portfolio-lab" className="hover:text-gold transition-colors">Portfolio Lab</Link></li>
                            <li><Link to="/pricing" className="hover:text-gold transition-colors">Pricing</Link></li>
                            <li><Link to="/features" className="hover:text-gold transition-colors">Features</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-4 text-white">Legal</h4>
                        <ul className="space-y-2 text-gray-400">
                            <li><Link to="/privacy" className="hover:text-gold transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-gold transition-colors">Terms of Service</Link></li>
                            <li><Link to="/contact" className="hover:text-gold transition-colors">Contact Us</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">© 2025 M.I.C. Singularity. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="text-gray-400 hover:text-gold transition-colors"><Twitter size={20} /></a>
                        <a href="#" className="text-gray-400 hover:text-gold transition-colors"><Linkedin size={20} /></a>
                        <a href="#" className="text-gray-400 hover:text-gold transition-colors"><Disc size={20} /></a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay }}
        className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-gold/50 transition-all duration-300 group"
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

export default LandingPage;
