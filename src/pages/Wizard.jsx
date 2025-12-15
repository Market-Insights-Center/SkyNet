import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Play, X, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import WizardInputs, { PortfolioConfigForm } from '../components/WizardInputs.jsx';
import WizardPreview from '../components/WizardPreview.jsx';
import Results from './Results.jsx';

const Wizard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [toolType, setToolType] = useState('');

    // Modal state for Custom/Tracking not found
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [missingPortfolioCode, setMissingPortfolioCode] = useState('');
    const [newConfig, setNewConfig] = useState({});

    // Progress state
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    useEffect(() => {
        const path = location.pathname.substring(1);
        setToolType(path);
    }, [location]);

    useEffect(() => {
        let interval;
        if (isAnalyzing) {
            setProgress(0);
            setProgressText('Initializing secure connection...');
            interval = setInterval(() => {
                setProgress(prev => {
                    let increment = 0;
                    if (prev < 20) increment = 1.5;
                    else if (prev < 60) increment = 0.8;
                    else if (prev < 85) increment = 0.5;
                    else if (prev < 98) increment = 0.2;

                    const newProgress = Math.min(prev + increment, 99);
                    if (newProgress < 15) setProgressText('Initializing secure connection...');
                    else if (newProgress < 30) setProgressText('Checking Subscription Limits...');
                    else if (newProgress < 45) setProgressText('Analyzing 10y Historical Volatility & Beta...');
                    else if (newProgress < 60) setProgressText('Calculating EMA Sensitivity & Trends...');
                    else if (newProgress < 70) setProgressText('Computing Asset Correlations...');
                    else if (newProgress < 80) setProgressText('Optimizing Weights & Risk Controls...');
                    else if (newProgress < 90) setProgressText('Applying Fractional Share Logic...');
                    else setProgressText('Finalizing Portfolio Report...');
                    return newProgress;
                });
            }, 200);
        } else {
            setProgress(0);
            setProgressText('');
        }
        return () => clearInterval(interval);
    }, [isAnalyzing]);

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
        setInputs(prev => {
            const newState = { ...prev, [field]: value };
            if (field === 'execute_rh' && value === true) {
                newState.overwrite = true;
            }
            return newState;
        });
    };

    const handleConfigChange = (field, value) => {
        setNewConfig(prev => ({ ...prev, [field]: value }));
    };

    const getRequestBody = (type, extraConfig = null) => {
        const parseTickerString = (str) => {
            if (!str) return [];
            if (Array.isArray(str)) return str;
            return str.split(',').map(t => t.trim()).filter(t => t.length > 0);
        };

        const mapSens = (s) => {
            const m = { "Low (Long-term)": 1, "Medium (Swing)": 2, "High (Day Trade)": 3, "Medium": 2 };
            return m[s] || 2;
        }

        // [FIX] Ensure user_id is a string
        let body = {
            user_id: currentUser?.uid || "",
            email: currentUser?.email || "" // <--- CRITICAL: Send email for limit checks
        };

        switch (type) {
            case 'invest':
                body = {
                    ...body,
                    ema_sensitivity: mapSens(inputs.ema_sensitivity),
                    amplification: parseFloat(inputs.amplification) || 1.0,
                    sub_portfolios: (Array.isArray(inputs.sub_portfolios) ? inputs.sub_portfolios : [{ tickers: "AAPL", weight: 100 }]).map(sp => ({
                        tickers: parseTickerString(sp.tickers),
                        weight: parseFloat(sp.weight) || 0
                    })),
                    tailor_to_value: true,
                    total_value: parseFloat(inputs.capital) || 10000,
                    use_fractional_shares: inputs.use_fractional_shares || false
                };
                break;

            case 'cultivate':
                const rawCode = inputs.strategy_code || "Code A";
                const cleanCode = rawCode.includes("Code B") ? "B" : "A";
                body = {
                    ...body,
                    email_to: currentUser?.email || "", // Cultivate uses email_to
                    cultivate_code: cleanCode,
                    portfolio_value: parseFloat(inputs.capital) || 10000,
                    use_fractional_shares: inputs.use_fractional_shares || false,
                    action: "run_analysis"
                };
                break;

            case 'custom':
            case 'tracking':
                body = {
                    ...body,
                    portfolio_code: inputs.name || "My Strategy",
                    tailor_to_value: true,
                    total_value: parseFloat(inputs.capital) || 10000,
                    use_fractional_shares: inputs.use_fractional_shares || false,
                    action: "run_analysis",
                    sub_portfolios: [],
                    ema_sensitivity: 2,
                    amplification: 1.0,
                    trades: [],
                    rh_username: inputs.rh_user || "",
                    rh_password: inputs.rh_pass || "",
                    email_to: inputs.send_email ? (inputs.email_to || currentUser?.email) : "",
                    risk_tolerance: 10,
                    vote_type: "stock",
                    execute_actions: inputs.execute_actions || false,
                    execute_rh: inputs.execute_rh || false,
                    overwrite: inputs.overwrite || false
                };
                if (type === 'custom') body.action = "run_existing_portfolio";

                if (extraConfig) {
                    body.ema_sensitivity = mapSens(extraConfig.sensitivity);
                    body.amplification = parseFloat(extraConfig.amplification) || 1.5;
                    if (Array.isArray(extraConfig.sub_portfolios)) {
                        body.sub_portfolios = extraConfig.sub_portfolios.map(sp => ({
                            tickers: parseTickerString(sp.tickers),
                            weight: parseFloat(sp.weight) || 0
                        }));
                    }
                }
                break;
        }
        return body;
    };

    const executeAnalysis = async (body, typeOverride = null) => {
        setIsAnalyzing(true);

        try {
            const endpoint = `/api/${typeOverride || toolType}`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle 403 specifically
                if (response.status === 403) {
                    alert(data.detail || "Usage limit reached. Please upgrade.");
                    setIsAnalyzing(false);
                    return;
                }
                throw new Error(`Server Error: ${response.status} - ${JSON.stringify(data.detail || data.message)}`);
            }

            if (data.status === 'error') {
                throw new Error(data.message || "Unknown error occurred.");
            }

            if ((toolType === 'custom' || toolType === 'tracking') && data.status === 'not_found') {
                setMissingPortfolioCode(inputs.name);
                setShowConfigModal(true);
                setIsAnalyzing(false);
                return;
            }

            window.analysisResults = data;
            setShowResults(true);
        } catch (error) {
            console.error("Analysis Execution Failed:", error);
            alert(`Failed to run analysis: ${error.message}`);
        } finally {
            if (!showConfigModal) {
                setIsAnalyzing(false);
            }
        }
    };

    const handleRunAnalysis = () => {
        if (!currentUser) {
            if (window.confirm("You must be logged in to execute commands. Create an account?")) {
                navigate('/signup');
            }
            return;
        }
        const body = getRequestBody(toolType);
        executeAnalysis(body);
    };

    const handleConfigSubmit = () => {
        setShowConfigModal(false);
        setIsAnalyzing(true);

        // Force 'create_and_run' action and ensure we use the 'custom' endpoint 
        // because only the custom command knows how to save new portfolio configs to the DB.
        const body = getRequestBody('custom', newConfig);
        body.portfolio_code = missingPortfolioCode;
        body.action = "create_and_run";

        // We assume tracking/custom inputs are compatible for creation
        // but we must send this to /api/custom to trigger the creation logic
        executeAnalysis(body, 'custom');
    };

    if (showResults) {
        return <Results toolType={toolType} onBack={() => setShowResults(false)} />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <span className="text-gold">{getToolTitle()}</span>
                        <ChevronRight className="text-gray-500" size={24} />
                        <span className="text-gray-400 text-xl font-light">Configuration</span>
                        <a
                            href={`/help#${toolType === 'custom' ? 'custom-builder' :
                                toolType === 'invest' ? 'quick-invest' :
                                    toolType === 'cultivate' ? 'cultivate' :
                                        toolType === 'tracking' ? 'portfolio-tracker' : 'portfolio-lab'
                                }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-1 text-xs bg-white/10 hover:bg-gold/20 text-gold px-3 py-1 rounded-full transition-colors"
                        >
                            <span className="font-bold">?</span> Help
                        </a>
                    </h1>
                    <p className="text-gray-400">Configure your parameters to generate an optimal strategy.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-1 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col"
                >
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                        <WizardInputs toolType={toolType} onChange={handleInputChange} values={inputs} />
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/10">
                        <button
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing}
                            className="w-full py-4 bg-gradient-to-r from-gold to-yellow-600 text-black font-bold text-lg rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
                        >
                            {isAnalyzing && (
                                <div
                                    className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            )}

                            {isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                        <span>{Math.floor(progress)}%</span>
                                    </div>
                                    <span className="text-xs font-normal opacity-80 mt-1">{progressText}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 z-10">
                                    {currentUser ? <Play size={20} fill="currentColor" /> : <Lock size={20} />}
                                    <span>{currentUser ? "Run Analysis" : "Login to Analyze"}</span>
                                </div>
                            )}
                        </button>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-2 bg-black/40 border border-white/10 rounded-xl p-8 flex items-center justify-center relative overflow-hidden"
                >
                    <WizardPreview toolType={toolType} isAnalyzing={isAnalyzing} />
                </motion.div>
            </div>

            <AnimatePresence>
                {showConfigModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 border border-white/10 rounded-xl p-8 max-w-2xl w-full shadow-2xl relative"
                        >
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-2">New Portfolio Detected</h2>
                            <p className="text-gray-400 mb-6">
                                The code <span className="text-gold font-bold">{missingPortfolioCode}</span> was not found.
                                Please configure the strategy parameters below to create it.
                            </p>

                            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                                <PortfolioConfigForm onChange={handleConfigChange} />
                            </div>

                            <div className="mt-8 flex justify-end gap-4">
                                <button
                                    onClick={() => setShowConfigModal(false)}
                                    className="px-6 py-3 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfigSubmit}
                                    className="px-6 py-3 rounded-lg bg-gold text-black font-bold hover:bg-yellow-500 transition-colors shadow-lg hover:shadow-gold/20"
                                >
                                    Create & Run Strategy
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Wizard;