import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Activity, AlertTriangle, ChevronRight, BarChart2, PieChart, TrendingUp, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FundamentalsTool from '../components/FundamentalsTool';
import AssessTool from '../components/AssessTool';
import MLForecastTool from '../components/MLForecastTool';
import UpgradePopup from '../components/UpgradePopup';
import SentimentTool from '../components/SentimentTool';
import PowerScoreTool from '../components/PowerScoreTool';
import { useLocation } from 'react-router-dom';
import MagneticButton from '../components/MagneticButton';
import QuickscoreChart from '../components/QuickscoreChart';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const AssetEvaluator = () => {
    const { userProfile } = useAuth();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('quickscore');
    const [ticker, setTicker] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showUpgradePopup, setShowUpgradePopup] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');
        if (tabParam) {
            setActiveTab(tabParam);
        }
    }, [location]);

    // --- TIER CHECK ---
    // Fundamentals is available to all (Basic has limits), so we don't block the tab.
    // Quickscore is available to all.

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/quickscore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    email: userProfile?.email || ''
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403 && data.detail?.includes('limit')) {
                    setShowUpgradePopup(true);
                    throw new Error(data.detail);
                }
                throw new Error(data.detail || 'Analysis failed');
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-white pt-24 px-4 pb-12">
            <UpgradePopup
                isOpen={showUpgradePopup}
                onClose={() => setShowUpgradePopup(false)}
                featureName="Asset Evaluator Limit"
            />

            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center text-gold border border-gold/20">
                            <Search size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <h1 className="text-4xl font-bold">Asset Evaluator</h1>
                                <a
                                    href={`/help#${activeTab === 'quickscore' ? 'quickscore' :
                                        activeTab === 'fundamentals' ? 'fundamentals' :
                                            activeTab === 'assess' ? 'asset-evaluator' :
                                                activeTab === 'fundamentals' ? 'fundamentals' :
                                                    activeTab === 'assess' ? 'asset-evaluator' :
                                                        activeTab === 'mlforecast' ? 'ml-forecast' :
                                                            activeTab === 'sentiment' ? 'sentiment' :
                                                                activeTab === 'powerscore' ? 'powerscore' : 'asset-evaluator'
                                        }`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-gold/10 text-gold rounded-lg border border-gold/20 transition-all text-sm font-bold"
                                >
                                    <span>?</span> Help
                                </a>
                            </div>
                            <p className="text-gray-400">Rapidly score assets and visualize trends.</p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex flex-wrap gap-4 border-b border-white/10 pb-1 mb-6">
                        <button
                            onClick={() => setActiveTab('quickscore')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'quickscore'
                                ? 'border-gold text-gold'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Activity size={18} />
                            Quickscore
                        </button>
                        <button
                            onClick={() => setActiveTab('fundamentals')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'fundamentals'
                                ? 'border-green-400 text-green-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <PieChart size={18} />
                            Fundamentals
                        </button>
                        <button
                            onClick={() => setActiveTab('assess')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'assess'
                                ? 'border-blue-400 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <BarChart2 size={18} />
                            Assess
                        </button>
                        <button
                            onClick={() => setActiveTab('mlforecast')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'mlforecast'
                                ? 'border-purple-400 text-purple-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <TrendingUp size={18} />
                            ML Forecast
                        </button>
                        <button
                            onClick={() => setActiveTab('sentiment')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'sentiment'
                                ? 'border-pink-400 text-pink-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Activity size={18} />
                            Sentiment
                        </button>
                        <button
                            onClick={() => setActiveTab('powerscore')}
                            className={`flex items-center gap-2 px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'powerscore'
                                ? 'border-yellow-400 text-yellow-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Layers size={18} />
                            PowerScore
                        </button>
                    </div>
                </motion.div>

                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'fundamentals' && <FundamentalsTool email={userProfile?.email} />}
                    {activeTab === 'assess' && <AssessTool />}
                    {activeTab === 'mlforecast' && <MLForecastTool />}
                    {activeTab === 'sentiment' && <SentimentTool email={userProfile?.email} />}
                    {activeTab === 'powerscore' && <PowerScoreTool email={userProfile?.email} />}

                    {activeTab === 'quickscore' && (
                        <>
                            {/* Input Section */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 transition-colors duration-300 hover:border-gold/50">
                                <form onSubmit={handleAnalyze} className="flex gap-4">
                                    <input
                                        type="text"
                                        value={ticker}
                                        onChange={(e) => setTicker(e.target.value)}
                                        placeholder="Enter Ticker (e.g. AAPL)"
                                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold uppercase font-mono tracking-wider"
                                    />
                                    <MagneticButton
                                        type="submit"
                                        disabled={loading || !ticker}
                                        className={`px-8 py-3 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {loading ? <Activity className="animate-spin" /> : <Search size={20} />}
                                        {loading ? 'Analyzing...' : 'Analyze'}
                                    </MagneticButton>
                                </form>
                                {error && (
                                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                                        <AlertTriangle size={18} />
                                        {error}
                                    </div>
                                )}
                            </div>

                            {/* Results Section */}
                            {result && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-8"
                                >
                                    {/* Score Summary */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-gold/30 transition-colors">
                                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gold">
                                            <Activity size={24} /> Analysis Results: {result.ticker}
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="p-4 bg-black/30 rounded-xl border border-white/5 hover:border-gold/20 transition-colors">
                                                <div className="text-gray-400 text-sm mb-1">Live Price (Daily)</div>
                                                <div className="text-2xl font-bold text-white">{result.live_price}</div>
                                            </div>

                                            {result.scores && Object.entries(result.scores).map(([key, value]) => {
                                                const scoreVal = typeof value === 'object' && value !== null ? value.score : value;
                                                const scoreLabel = typeof value === 'object' && value !== null ? value.label : (key === '1' ? 'Weekly (5Y)' : key === '2' ? 'Daily (1Y)' : 'Hourly (6M)');

                                                const score = parseFloat(scoreVal);
                                                let scoreColor = 'text-gray-500'; // Default to gray for N/A
                                                if (!isNaN(score)) {
                                                    if (score > 60) scoreColor = 'text-green-400';
                                                    else if (score >= 40) scoreColor = 'text-yellow-400';
                                                    else scoreColor = 'text-red-400';
                                                }

                                                return (
                                                    <div key={key} className="p-4 bg-black/30 rounded-xl border border-white/5 hover:border-gold/20 transition-colors">
                                                        <div className="text-gray-400 text-sm mb-1">
                                                            {scoreLabel} Score
                                                        </div>
                                                        <div className={`text-2xl font-bold ${scoreColor}`}>
                                                            {scoreVal}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Charts Section */}
                                    <div className="mt-8">
                                        {result.chart_data ? (
                                            <QuickscoreChart data={result.chart_data} ticker={result.ticker} />
                                        ) : (
                                            <div className="grid grid-cols-1 gap-6">
                                                {result.graphs && result.graphs.map((graphStr, index) => {
                                                    const parts = graphStr.split(': data:image');
                                                    const label = parts[0];
                                                    const imgSrc = 'data:image' + parts[1];

                                                    return (
                                                        <div key={index} className="relative bg-black/40 border border-gold/20 rounded-2xl p-4 overflow-hidden shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:border-gold/50 transition-all duration-500 group">
                                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                                            <div className="text-gold font-bold mb-2 ml-1 flex items-center gap-2">
                                                                <Activity size={16} /> {label}
                                                            </div>
                                                            <div className="w-full flex justify-center bg-black/60 rounded-lg p-2 border border-white/5 backdrop-blur-sm relative z-10">
                                                                <img
                                                                    src={imgSrc}
                                                                    alt={label}
                                                                    className="max-h-[300px] w-auto object-contain rounded"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default AssetEvaluator;
