import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Search, Scale, Siren, HelpCircle, Terminal, Layers, Zap, Sprout, Activity, PieChart, BarChart2, TrendingUp, History, Globe, Briefcase, Settings, Database, AlertTriangle } from 'lucide-react';

const Help = () => {
    const { hash } = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (hash) {
            const element = document.getElementById(hash.substring(1));
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }, [hash]);

    // Product Data Structure
    const products = [
        {
            id: 'portfolio-lab',
            title: 'Portfolio Lab',
            icon: Bot,
            color: 'text-gold',
            description: 'The Portfolio Lab is your command center for constructing and optimizing investment portfolios. It contains four powerful sub-modules designed to build, execute, and track your strategies.',
            subProducts: [
                {
                    id: 'custom-builder',
                    title: "Custom Builder",
                    icon: Layers,
                    desc: "Interactive tool to build complex, multi-layered investment strategies from scratch.",
                    inputs: [
                        { name: "Portfolio Code Name", desc: "Unique identifier for your strategy (e.g., TECH_GROWTH_V1)." },
                        { name: "Portfolio Value ($)", desc: "Total capital amount to simulate/allocate." },
                        { name: "Use Fractional Shares", desc: "Toggle to allow buying partial shares." },
                        { name: "EMA Sensitivity", desc: "Sets the timeframe for trend analysis (Low=Long-term, Medium=Swing, High=Day Trade)." },
                        { name: "Amplification Factor", desc: "Multiplier (0.25x - 3.0x) to increase weight of high-momentum assets." },
                        { name: "Sub-portfolios", desc: "Define baskets of tickers and their target allocation percentage." }
                    ],
                    usage: "Use this module when you have a specific list of stocks and a target allocation in mind. The builder will optimize the specific weights based on your risk profile and momentum settings."
                },
                {
                    id: 'quick-invest',
                    title: "Quick Invest",
                    icon: Zap,
                    desc: "Rapidly generate specific allocations for a basket of assets based on capital and risk.",
                    inputs: [
                        { name: "Investment Capital ($)", desc: "Total amount you wish to put to work." },
                        { name: "Portfolio Construction", desc: "List of tickers and their base weighting." },
                        { name: "EMA Sensitivity & Amplification", desc: "Fine-tune how aggressive the allocation should be towards momentum leaders." }
                    ],
                    usage: "Best for quick capital deployment. Enter your capital and tickers, and the system will tell you exactly how many shares to buy of each to maintain optimal risk parity."
                },
                {
                    id: 'cultivate',
                    title: "Cultivate",
                    icon: Sprout,
                    desc: "Algorithmic diversification engine using market capitalization and volume data.",
                    inputs: [
                        { name: "Strategy Code", desc: "Select 'Code A' (Market Broad) or 'Code B' (SPY Focused) for the underlying algo." },
                        { name: "Total Portfolio Value", desc: "Amount to invest." }
                    ],
                    usage: "Use Cultivate when you want the AI to suggest a diversified portfolio structure for you, rather than picking individual stocks yourself."
                },
                {
                    id: 'portfolio-tracker',
                    title: "Portfolio Tracker",
                    icon: Activity,
                    desc: "Real-time monitoring dashboard for your saved strategies.",
                    inputs: [
                        { name: "Portfolio Code Name", desc: "The ID of the portfolio you want to track (e.g., EXISTING_PORTFOLIO)." }
                    ],
                    usage: "Enter the code of a portfolio you previously built to see its live performance, risk metrics, and drift from target allocation."
                }
            ]
        },
        {
            id: 'asset-evaluator',
            title: 'Asset Evaluator',
            icon: Search,
            color: 'text-gold',
            description: 'The Asset Evaluator provides deep-dive analysis into individual assets. It uses a multi-faceted approach to score stocks and ETFs.',
            subProducts: [
                {
                    id: 'quickscore',
                    title: "Quickscore (Assess Code A)",
                    icon: Activity,
                    desc: "Generates an instant 'Buy/Hold/Sell' rating based on aggregated technical data.",
                    inputs: [
                        { name: "Tickers", desc: "Comma-separated list of symbols (e.g., AAPL, MSFT, TSLA)." },
                        { name: "Timeframe", desc: "Historical period for volatility analysis (1Y, 3Y, 5Y, etc.)." },
                        { name: "Risk Tolerance", desc: "1 (Conservative) to 5 (Aggressive)." }
                    ],
                    usage: "Get a quick pulse check on a stock's volatility and risk/reward profile before entering a trade."
                },
                {
                    id: 'Code-B',
                    title: "Manual Portfolio (Code B)",
                    icon: Briefcase,
                    desc: "Risk assessment for a manually entered list of holdings.",
                    inputs: [
                        { name: "Holdings Rows", desc: "Enter Ticker and (Shares OR Value) for each position." },
                        { name: "Backtest Period", desc: "Duration to simulate historical performance." }
                    ],
                    usage: "Analyze the risk of your current brokerage account by manually inputting your positions."
                },
                {
                    id: 'Code-C',
                    title: "Custom Portfolio (Code C)",
                    icon: Settings,
                    desc: "Risk assessment for a pre-saved custom portfolio from your database.",
                    inputs: [
                        { name: "Portfolio Code", desc: "The ID of the portfolio you want to assess." },
                        { name: "Invested Value ($)", desc: "Total value to simulate." },
                        { name: "Backtest Period", desc: "Duration to simulate." }
                    ],
                    usage: "Quickly check the risk stats of a strategy you built in the Custom Builder."
                },
                {
                    id: 'Code-D',
                    title: "Cultivate Risk (Code D)",
                    icon: TrendingUp,
                    desc: "Specialized risk assessment for Cultivate-style portfolios.",
                    inputs: [
                        { name: "Strategy Code", desc: "Code A (Market) or Code B (SPY)." },
                        { name: "Investment Value ($)", desc: "Total value." }
                    ],
                    usage: "Assess the risk profile of the AI's standard diversification algorithms."
                },
                {
                    id: 'fundamentals',
                    title: "Fundamentals",
                    icon: PieChart,
                    desc: "Comprehensive financial statement analysis and key metric visualization.",
                    inputs: [
                        { name: "Ticker", desc: "Symbol to analyze (e.g., NVDA)." }
                    ],
                    usage: "View balance sheets, income statements, P/E ratios, revenue growth, and debt leverage to assess long-term viability."
                },
                {
                    id: 'ml-forecast',
                    title: "ML Forecast",
                    icon: TrendingUp,
                    desc: "Machine Learning powered price prediction models.",
                    inputs: [
                        { name: "Ticker", desc: "Symbol to forecast." }
                    ],
                    usage: "View AI-generated predicted price ranges for the next 7-30 days to assist with timing entries and exits."
                },
                {
                    id: 'Code-E',
                    title: "Backtesting (Assess Code E)",
                    icon: Database,
                    desc: "Simulate portfolio performance over a specific historical window.",
                    inputs: [
                        { name: "Portfolio Code", desc: "ID of a saved custom portfolio." },
                        { name: "Start Date", desc: "Beginning of the simulation period." },
                        { name: "End Date", desc: "End of the simulation period." }
                    ],
                    usage: "Test how your strategy would have performed during specific market conditions (e.g., the 2020 crash)."
                }
            ]
        },
        {
            id: 'comparison-matrix',
            title: 'Comparison Matrix',
            icon: Scale,
            color: 'text-gold',
            description: 'The Comparison Matrix is designed for relative value analysis and market scanning.',
            subProducts: [
                {
                    id: 'market-heatmap',
                    title: "Market Heatmap",
                    icon: Activity,
                    desc: "Scans the market to rank top and bottom performers relative to SPY.",
                    inputs: [
                        { name: "Market Type", desc: "S&P 500, Large Cap (>50B), or Mid Cap (>10B)." },
                        { name: "Sensitivity", desc: "Low (Weekly), Medium (Daily), High (Hourly)." }
                    ],
                    usage: "Spot sector rotation and relative strength leaders. High sensitivity finds day-trading movers; Low sensitivity finds trend leaders."
                },
                {
                    id: 'breakout-detector',
                    title: "Breakout Detector",
                    icon: Zap,
                    desc: "Identifies assets that are breaking out of their volatility bands with volume confirmation.",
                    inputs: [
                        { name: "Run Detector", desc: "Button to initiate scan." }
                    ],
                    usage: "Run this scanner mid-session to find stocks that are making statistically significant moves outside their normal range."
                }
            ]
        },
        {
            id: 'market-nexus',
            title: 'Market Nexus',
            icon: Siren,
            color: 'text-gold',
            description: 'Market Nexus is the macro-intelligence hub. It forecasts broad market trends and assesses systemic risk.',
            subProducts: [
                {
                    id: 'risk-command',
                    title: "Risk Command",
                    icon: Activity,
                    desc: "Evaluates the current risk level of the general market (SPY/VIX).",
                    inputs: [
                        { name: "N/A", desc: "Automatic data feed." }
                    ],
                    usage: "Check this daily. 'High Risk' suggests reducing exposure or hedging; 'Low Risk' suggests buying opportunities."
                },
                {
                    id: 'history-command',
                    title: "History Command",
                    icon: History,
                    desc: "Historical database of market risk levels and performance.",
                    inputs: [
                        { name: "N/A", desc: "Automatic data feed." }
                    ],
                    usage: "Backtest how the Risk Command signal has performed over previous years and verify its accuracy."
                },
                {
                    id: 'briefing',
                    title: "Market Briefing",
                    icon: Globe,
                    desc: "AI-curated daily news, economic calendar, and sector performance.",
                    inputs: [
                        { name: "N/A", desc: "Automatic generation." }
                    ],
                    usage: "Read this every morning to stay informed on key market drivers, treasury yields, and economic releases."
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-20">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-purple-900/20 rounded-full border border-purple-500/30">
                            <Terminal className="w-12 h-12 text-purple-400" />
                        </div>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">Product <span className="text-gold">Manual</span></h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Detailed documentation, input specifications, and usage guides for the SkyNet Financial Ecosystem.
                    </p>
                </motion.div>

                <div className="space-y-24">
                    {products.map((product, index) => (
                        <motion.section
                            key={product.id}
                            id={product.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            className="relative"
                        >
                            {/* Section Divider */}
                            {index !== 0 && (
                                <div className="absolute -top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
                            )}

                            <div className="grid lg:grid-cols-12 gap-8 items-start">
                                {/* Header Column */}
                                <div className="lg:col-span-3 flex flex-col items-center lg:items-start sticky top-24">
                                    <div className={`w-20 h-20 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
                                        <product.icon className={`w-10 h-10 ${product.color}`} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-gray-100 mb-2 text-center lg:text-left">{product.title}</h2>
                                    <div className={`h-1 w-20 bg-gradient-to-r from-gold to-transparent rounded-full mb-4`} />
                                    <p className="text-gray-400 text-sm leading-relaxed text-center lg:text-left">
                                        {product.description}
                                    </p>
                                </div>

                                {/* Content Column */}
                                <div className="lg:col-span-9 space-y-8">
                                    {product.subProducts.map((sub, i) => (
                                        <div
                                            key={i}
                                            id={sub.id}
                                            className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 md:p-8 hover:border-gold/30 transition-all duration-300"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-black/50 rounded-lg border border-white/10">
                                                        <sub.icon className="w-6 h-6 text-gold" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-white">{sub.title}</h3>
                                                </div>
                                            </div>

                                            <p className="text-gray-300 mb-6 text-lg">
                                                {sub.desc}
                                            </p>

                                            <div className="grid md:grid-cols-2 gap-8">
                                                {/* Inputs Section */}
                                                <div>
                                                    <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                        <Terminal size={14} /> Inputs & Configuration
                                                    </h4>
                                                    <ul className="space-y-3">
                                                        {sub.inputs.map((input, k) => (
                                                            <li key={k} className="text-sm">
                                                                <span className="text-white font-mono font-bold block mb-1">{input.name}</span>
                                                                <span className="text-gray-400">{input.desc}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Usage Section */}
                                                <div>
                                                    <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                        <Activity size={14} /> Best Use Case
                                                    </h4>
                                                    <div className="bg-black/30 border-l-2 border-green-500/30 p-4 rounded-r-lg">
                                                        <p className="text-gray-400 text-sm leading-relaxed">
                                                            {sub.usage}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.section>
                    ))}
                </div>

                <div className="mt-24 p-8 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Still need help?</h2>
                    <p className="text-gray-400 mb-6">
                        Contact our support team for personalized assistance with any of our tools.
                        We can help you build custom strategies or explain any metric significantly deeper.
                    </p>
                    <button
                        onClick={() => navigate('/chat?action=contact_support')}
                        className="px-8 py-3 bg-gold hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors shadow-[0_0_20px_rgba(255,215,0,0.2)]"
                    >
                        Contact Admin Support
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Help;
