import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Play } from 'lucide-react';
import WizardInputs from '../components/WizardInputs';
import WizardPreview from '../components/WizardPreview';
import Results from './Results';

const Wizard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(1);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [toolType, setToolType] = useState('');

    useEffect(() => {
        const path = location.pathname.substring(1); // remove leading slash
        setToolType(path);
    }, [location]);

    const getToolTitle = () => {
        switch (toolType) {
            case 'custom': return 'Custom Builder';
            case 'invest': return 'Quick Invest';
            case 'cultivate': return 'Cultivate';
            case 'tracking': return 'Portfolio Tracker';
            default: return 'Portfolio Wizard';
        }
    };

    const [inputs, setInputs] = useState({});

    const handleInputChange = (field, value) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    const getRequestBody = (type) => {
        // Use inputs from state, falling back to defaults if necessary
        switch (type) {
            case 'invest':
                // Map sensitivity string to int
                const sensMap = { "Low (Long-term)": 1, "Medium (Swing)": 2, "High (Day Trade)": 3, "Medium": 2 };
                const emaSens = sensMap[inputs.ema_sensitivity] || 2;

                // Handle tickers input: split string into list, default if empty
                const rawTickers = inputs.tickers || "AAPL, MSFT, NVDA";
                const tickerList = rawTickers.split(',').map(t => t.trim()).filter(t => t.length > 0);

                return {
                    ema_sensitivity: emaSens,
                    amplification: parseFloat(inputs.amplification) || 1.0,
                    sub_portfolios: [
                        {
                            tickers: tickerList.length > 0 ? tickerList : ["AAPL", "MSFT", "NVDA"],
                            weight: 100.0
                        }
                    ],
                    tailor_to_value: false, // Default for quick invest
                    total_value: 10000, // Default
                    use_fractional_shares: false
                };
            case 'cultivate':
                return {
                    cultivate_code: inputs.strategy_code || "Strategy A (Growth)",
                    portfolio_value: parseFloat(inputs.capital) || 50000,
                    use_fractional_shares: false,
                    action: "run_analysis"
                };
            case 'custom':
                const sensMapCustom = { "Low (Long-term)": 1, "Medium (Swing)": 2, "High (Day Trade)": 3, "Medium": 2 };
                const emaSensCustom = sensMapCustom[inputs.ema_sensitivity] || 2;

                return {
                    portfolio_code: inputs.name || "My Strategy",
                    ema_sensitivity: emaSensCustom,
                    amplification: parseFloat(inputs.amplification) || 1.5,
                    sub_portfolios: [
                        {
                            tickers: (inputs.sub_portfolios || "AAPL, MSFT").split(',').map(t => t.trim()),
                            weight: 100.0
                        }
                    ],
                    tailor_to_value: false,
                    total_value: 10000,
                    use_fractional_shares: inputs.auto_rebalance || false, // Mapping auto_rebalance to frac shares for now as proxy
                    action: "run_analysis"
                };
            case 'tracking':
                return {
                    portfolio_code: inputs.portfolio_id || "Main Holdings",
                    total_value: 10000, // Default
                    use_fractional_shares: false,
                    action: "run_analysis"
                };
            default: return {};
        }
    };

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const endpoint = `http://localhost:8000/api/${toolType}`;
            const body = getRequestBody(toolType);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            // Pass data to results page via state or context (simplified here by just showing results)
            // In a real app, we'd pass `data` to the Results component
            window.analysisResults = data; // Temporary hack for demo simplicity
            setShowResults(true);
        } catch (error) {
            console.error(error);
            alert('Failed to run analysis. Ensure backend is running.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (showResults) {
        return <Results toolType={toolType} onBack={() => setShowResults(false)} />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <span className="text-gold">{getToolTitle()}</span>
                        <ChevronRight className="text-gray-500" size={24} />
                        <span className="text-gray-400 text-xl font-light">Configuration</span>
                    </h1>
                    <p className="text-gray-400">Configure your parameters to generate an optimal strategy.</p>
                </div>

                {/* Progress Stepper */}
                <div className="flex items-center gap-4">
                    {[1, 2, 3].map((step) => (
                        <div key={step} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${activeStep >= step ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-700'
                                }`}>
                                {step}
                            </div>
                            {step < 3 && <div className={`w-12 h-0.5 mx-2 ${activeStep > step ? 'bg-gold' : 'bg-gray-800'}`} />}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
                {/* Left Panel: Inputs */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-1 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col"
                >
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                        <WizardInputs toolType={toolType} onChange={handleInputChange} />
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/10">
                        <button
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing}
                            className="w-full py-4 bg-gradient-to-r from-gold to-yellow-600 text-black font-bold text-lg rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isAnalyzing ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Play size={20} fill="currentColor" />
                                    Run Analysis
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>

                {/* Right Panel: Preview */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-2 bg-black/40 border border-white/10 rounded-xl p-8 flex items-center justify-center relative overflow-hidden"
                >
                    <WizardPreview toolType={toolType} isAnalyzing={isAnalyzing} />
                </motion.div>
            </div>
        </div>
    );
};

export default Wizard;
