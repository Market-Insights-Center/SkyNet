import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Search, Scale, Siren, HelpCircle, Terminal, Layers, Zap, Sprout, Activity, PieChart, BarChart2, TrendingUp, History, Globe, Briefcase, Settings, Database, AlertTriangle, Network, Maximize2, Cpu, Box, Workflow, DollarSign } from 'lucide-react';

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
                        { name: "Portfolio Code Name", desc: "The ID of the portfolio you want to track (e.g., EXISTING_PORTFOLIO)." },
                        { name: "Execution Options", desc: "Send recommendations to Email, execute on Robinhood, or overwrite saved data." }
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
                },
                {
                    id: 'sentiment',
                    title: "Sentiment Analysis",
                    icon: Activity,
                    desc: "AI-driven sentiment analysis aggregating data from news, social media, and financial reports.",
                    inputs: [
                        { name: "Ticker", desc: "Symbol to analyze." }
                    ],
                    usage: "Gauge the market's psychological state towards an asset to identify potential contrarian or momentum plays."
                },
                {
                    id: 'powerscore',
                    title: "PowerScore",
                    icon: Layers,
                    desc: "Composite multi-factor scoring model combining Fundamentals, Technicals, Sentiment, and Volatility.",
                    inputs: [
                        { name: "Ticker", desc: "Symbol to score." },
                        { name: "Sensitivity", desc: "Level 1 (Long Term), 2 (Mid Term), 3 (Short Term)." }
                    ],
                    usage: "Get a comprehensive, single-number rating (0-100) for an asset's overall health and potential."
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
                },
                {
                    id: 'performance-stream',
                    title: "Performance Stream",
                    icon: Maximize2,
                    desc: "Visual S&P 500 performance map with gold/purple indicators and deep-dive analytics.",
                    inputs: [
                        { name: "Timeframe", desc: "Day, Week, Month, Year." },
                        { name: "Interaction", desc: "Click any stock tile to flip it and reveal detailed analytics." }
                    ],
                    usage: "Use this for an instant visual read on the entire market. Green/Gold tiles are leading; Purple tiles are lagging. Click winners to see why they are up."
                }
            ]
        },
        {
            id: 'market-junction',
            title: 'Market Junction',
            icon: Siren,
            color: 'text-gold',
            description: 'Market Junction is the macro-intelligence hub. It forecasts broad market trends and assesses systemic risk.',
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
        },
        {
            id: 'portfolio-nexus',
            title: 'Portfolio Nexus',
            icon: Network,
            color: 'text-purple-400',
            description: 'The Portfolio Nexus is the central nervous system for advanced capital allocation. It operates as a "Fund of Funds" manager, allowing you to stitch together disparate strategies—whether from the Portfolio Lab, Market Junction, or external ideas—into one unified master portfolio. It handles the complex mathematics of weighting, fractional shares, and rebalancing across these layers to ensure your total capital is perfectly aligned with your high-level allocation goals.',
            subProducts: [
                {
                    id: 'nexus-execution',
                    title: "Nexus Engine",
                    icon: Network,
                    desc: "Allocates capital across multiple sub-portfolios according to defined weights, handling all fractional share math and rebalancing logic.",
                    inputs: [
                        { name: "Nexus Code", desc: "Unique identifier for this master configuration (e.g., MASTER_FUND_V1)." },
                        { name: "Total Value ($)", desc: "Total capital to distribute across all sub-strategies." },
                        { name: "Components", desc: "List of Portfolios (by code) or Commands (Market, Breakout, Cultivate)." },
                        { name: "Execution Options", desc: "Send trades to Email, execute on Robinhood, or overwrite last save." }
                    ],
                    usage: "1. Define Components: Identify portfolio codes created in Portfolio Lab (e.g., 'TECH_GROWTH') or standard commands.\n2. Assign Weights: Determine what percentage of your total capital goes to each strategy.\n3. Execute: The Nexus recursively calculates share counts for every underlying ticker, aggregating duplicates.\n4. Rebalance: Run periodically to ensure your master allocation remains true to targets."
                }
            ]
        },

        {
            id: 'workflow-automation',
            title: 'Workflow Automation',
            icon: Workflow,
            color: 'text-purple-400',
            description: 'Create autonomous trading agents that initiate transactions based on conditional logic blocks. Chain together market events with execution modules to run strategies 24/7 without manual intervention.',
            subProducts: [
                {
                    id: 'automation-builder',
                    title: "Automation Canvas",
                    icon: Layers,
                    desc: "Drag-and-drop builder to construct logic chains.",
                    inputs: [
                        { name: "Conditional Blocks", desc: "Triggers based on Risk (Market/General), Price, or Percentage changes over time." },
                        { name: "Action Blocks", desc: "Execute Tracking or Nexus portfolios when conditions are met." },
                        { name: "Info Blocks", desc: "Provide credentials (Email, Robinhood) to execution blocks." }
                    ],
                    usage: "1. Start with a Conditional Block (e.g. 'When Price of AAPL > $200').\n2. Connect it to an Action Block (e.g. 'Execute Tech Portfolio').\n3. Attach Info Blocks to provide necessary logins.\n4. Save and Activate. The system checks conditions every 15 minutes."
                }
            ]
        },

        {
            id: 'market-predictions',
            title: 'Market Predictions',
            icon: DollarSign,
            color: 'text-gold',
            description: 'Wager your Singularity Points on real-world market events. Test your forecasting skills against the community and climb the leaderboard by predicting earnings beats, price targets, and economic data releases.',
            subProducts: [
                {
                    id: 'predictions-active',
                    title: "Active Events",
                    icon: Activity,
                    desc: "View and filter currently open prediction contracts.",
                    inputs: [
                        { name: "Wager Amount", desc: "Points to bet (Min 10)." },
                        { name: "Side", desc: "Yes/Over or No/Under." }
                    ],
                    usage: "Find an event where you have a strong conviction (e.g., 'NVDA > $150'). Place a wager to potentiall win more points based on the pool odds."
                },
                {
                    id: 'predictions-leaderboard',
                    title: "Betting History",
                    icon: History,
                    desc: "Track your past performance and unsettled bets.",
                    inputs: [
                        { name: "N/A", desc: "Automatic tracking." }
                    ],
                    usage: "Review your win/loss ratio and claim winnings from settled events."
                }
            ]
        },
        {
            id: 'sentinel-ai',
            title: 'Sentinel AI',
            icon: Cpu,
            color: 'text-cyan-400',
            description: 'Sentinel AI is the autonomous intelligence layer of the Orion Ecosystem. It functions as an execution planner, capable of understanding natural language requests and chaining multiple SkyNet commands together to perform complex, multi-step financial conceptualizations and analyses.',
            subProducts: [
                {
                    id: 'sentinel-core',
                    title: "Sentinel Planner",
                    icon: Cpu,
                    desc: "The core agent interpreting your prompts and orchestrating the execution of other tools.",
                    inputs: [
                        { name: "Natural Language Prompt", desc: "Describe your goal in plain English (e.g., 'Scan the market for high volume stocks and run sentiment on the top 3')." }
                    ],
                    usage: "Use Sentinel when your query requires combining data from different tools (e.g., Market Scan + Sentiment + Fundamentals) or when you want a high-level summary without running individual commands manually."
                }
            ]
        },
        // NEW DATABASE CODES SECTION
        {
            id: 'database-lab',
            title: 'Database Codes',
            icon: Database,
            color: 'text-purple-400',
            description: 'The Database Lab is the persistent memory of the SkyNet ecosystem. It allows you to save, organize, and reuse your complex portfolio structures and Nexus configurations across different tools like Sentinel AI and the Portfolio Nexus.',
            subProducts: [
                {
                    id: 'portfolio-codes',
                    title: "Portfolio Codes",
                    icon: Box,
                    desc: "Saved definitions of basic investment strategies (e.g., fractional share allocations, momentum logic).",
                    inputs: [
                        { name: "Code Name", desc: "Unique ID (e.g., 'TECH_GROWTH')." },
                        { name: "Structure", desc: "A tree of assets and weights." }
                    ],
                    usage: "Save your favorite ticker lists here so you don't have to re-type them every time. Retrieve them by name in other tools."
                },
                {
                    id: 'nexus-codes',
                    title: "Nexus Codes",
                    icon: Network,
                    desc: "Master templates that combine multiple Portfolio Codes into one 'Super-Portfolio'.",
                    inputs: [
                        { name: "Nexus ID", desc: "Unique ID for the master structure." },
                        { name: "Components", desc: "List of other Portfolio Codes or Commands to include and their weights." }
                    ],
                    usage: "Create a 'Fund of Funds' strategy. For example, a Nexus Code 'ALL_WEATHER' could consist of 50% 'GROWTH_PORTFOLIO' and 50% 'DIVIDEND_PORTFOLIO'."
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
                        Detailed documentation, input specifications, and usage guides for the Orion Financial Ecosystem.
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
