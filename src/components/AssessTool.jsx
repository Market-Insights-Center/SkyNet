import React, { useState } from 'react';
import { Search, Activity, AlertTriangle, Layers, Briefcase, FileText, Database, TrendingUp, Settings, X, ChevronRight, Plus, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UpgradePopup from './UpgradePopup';
import { PortfolioConfigForm } from './WizardInputs';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const AssessTool = () => {
    const { userProfile } = useAuth();
    const [assessCode, setAssessCode] = useState('A'); // A, B, C, D, E
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showUpgradePopup, setShowUpgradePopup] = useState(false);

    // Modal State for Missing Portfolio (Code C)
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [missingPortfolioCode, setMissingPortfolioCode] = useState('');
    const [newConfig, setNewConfig] = useState({});

    // Inputs for Command A
    const [tickerA, setTickerA] = useState('');
    const [timeframeA, setTimeframeA] = useState('1Y');
    const [riskA, setRiskA] = useState(3);

    // Inputs for Command B (Manual)
    const [backtestB, setBacktestB] = useState('1y');
    const [manualHoldings, setManualHoldings] = useState([{ ticker: '', shares: '', value: '' }]);

    // Inputs for Command C (Custom)
    const [customCodeC, setCustomCodeC] = useState('');
    const [valueC, setValueC] = useState('');
    const [backtestC, setBacktestC] = useState('3y');

    // Inputs for Command D (Cultivate)
    const [cultivateCodeD, setCultivateCodeD] = useState('A');
    const [valueD, setValueD] = useState('');
    const [fracSharesD, setFracSharesD] = useState(false);
    const [backtestD, setBacktestD] = useState('5y');

    // Inputs for Command E (Portfolio Backtest)
    const [portfolioCodeE, setPortfolioCodeE] = useState('');
    const [startDateE, setStartDateE] = useState('');
    const [endDateE, setEndDateE] = useState('');

    const handleAccessCheck = (code) => {
        // Simple frontend check optional, backend handles enforcement.
        // We can check userProfile tier here to gray out tabs if desired, but 
        // the requirements say "have seperate limits for all of them and accessibility depending on tiers".
        // We rely on backend 403.
        setAssessCode(code);
        setResult(null);
        setError(null);
    };

    const addHoldingRow = () => {
        setManualHoldings([...manualHoldings, { ticker: '', shares: '', value: '' }]);
    };

    const updateHolding = (index, field, val) => {
        const newHoldings = [...manualHoldings];
        newHoldings[index][field] = val;
        setManualHoldings(newHoldings);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        // Construct Payload based on Code
        let payload = {
            email: userProfile?.email || '',
            user_id: userProfile?.uid || '',
            assess_code: assessCode,
        };

        if (assessCode === 'A') {
            if (!tickerA) {
                setError("Tickers required."); setLoading(false); return;
            }
            payload.tickers_str = tickerA;
            payload.timeframe_str = timeframeA;
            payload.risk_tolerance = parseInt(riskA);
        } else if (assessCode === 'B') {
            // Filter empty rows
            const validHoldings = manualHoldings.filter(h => h.ticker && (h.shares || h.value));
            if (validHoldings.length === 0) {
                setError("At least one valid holding required."); setLoading(false); return;
            }
            // Convert types
            const formattedHoldings = validHoldings.map(h => ({
                ticker: h.ticker,
                shares: h.shares ? parseFloat(h.shares) : undefined,
                value: h.value ? parseFloat(h.value) : undefined
            }));
            payload.backtest_period_str = backtestB;
            payload.manual_portfolio_holdings = formattedHoldings;
        } else if (assessCode === 'C') {
            if (!customCodeC || !valueC) { setError("Code and Value required."); setLoading(false); return; }
            payload.custom_portfolio_code = customCodeC;
            payload.value_for_assessment = parseFloat(valueC);
            payload.backtest_period_str = backtestC;
        } else if (assessCode === 'D') {
            if (!cultivateCodeD || !valueD) { setError("Code and Value required."); setLoading(false); return; }
            payload.cultivate_portfolio_code = cultivateCodeD;
            payload.value_for_assessment = parseFloat(valueD);
            payload.use_fractional_shares = fracSharesD;
            payload.backtest_period_str = backtestD;
        } else if (assessCode === 'E') {
            if (!portfolioCodeE || !startDateE || !endDateE) { setError("All fields required."); setLoading(false); return; }
            payload.portfolio_code = portfolioCodeE;
            payload.start_date = startDateE;
            payload.end_date = endDateE;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/assess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    setShowUpgradePopup(true);
                    throw new Error(data.detail);
                }
                throw new Error(data.detail || 'Assessment failed');
            }

            // Check for functional errors (like portfolio not found handled by backend returning 200 but error dict)
            // Or if backend returns 200 with error field
            let resData = data.result;
            if (resData && resData.error) {
                if (resData.error === 'portfolio_not_found') {
                    setMissingPortfolioCode(resData.code || customCodeC);
                    setShowConfigModal(true);
                    setLoading(false);
                    return;
                }
                throw new Error(resData.error);
            }

            setResult(resData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePortfolio = async () => {
        setShowConfigModal(false);
        setLoading(true);
        try {
            // Create portfolio via /api/custom logic
            // We duplicate minimal logic from Wizard to create it
            const mapSens = (s) => {
                const m = { "Low (Long-term)": 1, "Medium (Swing)": 2, "High (Day Trade)": 3, "Medium": 2 };
                return m[s] || 2;
            }

            const payload = {
                user_id: userProfile?.uid || "",
                email: userProfile?.email || "",
                action: "run_analysis", // This triggers creation/save in custom logic
                portfolio_code: missingPortfolioCode,
                total_value: parseFloat(valueC) || 10000, // Use assess value as base
                ema_sensitivity: mapSens(newConfig.sensitivity),
                amplification: parseFloat(newConfig.amplification) || 1.5,
                sub_portfolios: (newConfig.sub_portfolios || []).map(sp => ({
                    tickers: sp.tickers.split(',').map(t => t.trim()).filter(Boolean),
                    weight: parseFloat(sp.weight) || 0
                })),
                use_fractional_shares: true, // Default
                overwrite: true // Force create
            };

            const response = await fetch(`${API_BASE_URL}/api/custom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Failed to create portfolio.");

            // If successful, re-run the assessment
            await handleSubmit(null);

        } catch (err) {
            setError(`Creation failed: ${err.message}`);
            setLoading(false);
        }
    };

    // --- Table Renderer ---
    const renderTable = (res) => {
        if (!res || res.type !== 'table') return null;
        return (
            <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex justify-between items-center">
                    <h4 className="text-lg font-bold text-white tracking-wide">{res.title || "Assessment Results"}</h4>
                    {res.summary && <span className="text-xs text-gray-400">{res.summary}</span>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 text-gray-400 text-sm uppercase tracking-wider">
                                {res.headers.map((h, i) => (
                                    <th key={i} className="px-6 py-3 font-semibold border-b border-white/5">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-300 text-sm">
                            {res.rows.map((row, rI) => (
                                <tr key={rI} className="hover:bg-white/5 transition-colors">
                                    {row.map((cell, cI) => (
                                        <td key={cI} className="px-6 py-4 whitespace-nowrap">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <UpgradePopup
                isOpen={showUpgradePopup}
                onClose={() => setShowUpgradePopup(false)}
                featureName={`Assess Code ${assessCode} Limit`}
            />

            {/* Sub-Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
                {[
                    { code: 'A', name: 'Stock Volatility', icon: <Activity size={16} /> },
                    { code: 'B', name: 'Manual Portfolio', icon: <Briefcase size={16} /> },
                    { code: 'C', name: 'Custom Portfolio', icon: <Settings size={16} /> },
                    { code: 'D', name: 'Cultivate Risk', icon: <TrendingUp size={16} /> },
                    { code: 'E', name: 'Backtesting', icon: <Database size={16} /> }
                ].map((tab) => (
                    <button
                        key={tab.code}
                        onClick={() => handleAccessCheck(tab.code)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${assessCode === tab.code
                            ? 'bg-gold text-black'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        {tab.icon} {tab.name} (Code {tab.code})
                    </button>
                ))}

                {/* Contextual Help Button */}
                <a
                    href={`/help#${assessCode === 'A' ? 'quickscore' :
                        assessCode === 'B' ? 'Code-B' :
                            assessCode === 'C' ? 'Code-C' :
                                assessCode === 'D' ? 'Code-D' :
                                    assessCode === 'E' ? 'Code-E' : 'asset-evaluator'
                        }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/30"
                >
                    <HelpCircle size={18} /> Help
                </a>
            </div>

            {/* Input Explanations */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4 text-sm text-blue-200">
                {assessCode === 'A' && <p><strong>Code A (Stock Volatility):</strong> Analyzes price swings for a single ticker. Enter <strong>Ticker</strong> (e.g., AAPL), <strong>Timeframe</strong> (e.g., 1Y), and <strong>Risk Tolerance</strong> (1-5).</p>}
                {assessCode === 'B' && <p><strong>Code B (Manual Portfolio):</strong> Assesses risk for a manually entered list of stocks. Add rows for each holding with <strong>Ticker</strong> and <strong>Shares</strong> or <strong>Value</strong>.</p>}
                {assessCode === 'C' && <p><strong>Code C (Custom Portfolio):</strong> Analyzes a pre-defined portfolio from the database. Enter the <strong>Portfolio Code</strong> and total <strong>Investment Value</strong>.</p>}
                {assessCode === 'D' && <p><strong>Code D (Cultivate Risk):</strong> Specialized risk assessment for 'Cultivate' portfolios. Select <strong>Code (A/B)</strong> and <strong>Investment Value</strong>.</p>}
                {assessCode === 'E' && <p><strong>Code E (Backtesting):</strong> Simulates portfolio performance over a specific period. Enter <strong>Portfolio Code</strong>, <strong>Start Date</strong>, and <strong>End Date</strong>.</p>}
            </div>

            {/* Input Form Area */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Code A */}
                    {assessCode === 'A' && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gold"><Activity /> Stock Volatility Assessment</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input type="text" value={tickerA} onChange={e => setTickerA(e.target.value)} placeholder="Tickers (e.g. AAPL, MSFT)" className="bg-black/50 border border-gray-700 rounded px-4 py-2 uppercase" />
                                <select value={timeframeA} onChange={e => setTimeframeA(e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2">
                                    {['1Y', '3Y', '5Y', '10Y', '20Y', '3M', '1M'].map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <input type="number" min="1" max="5" value={riskA} onChange={e => setRiskA(e.target.value)} placeholder="Risk (1-5)" className="bg-black/50 border border-gray-700 rounded px-4 py-2" />
                            </div>
                        </div>
                    )}

                    {/* Code B */}
                    {assessCode === 'B' && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gold"><Briefcase /> Manual Portfolio Risk</h3>
                            <div className="space-y-2">
                                {manualHoldings.map((h, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input type="text" placeholder="Ticker" value={h.ticker} onChange={e => updateHolding(i, 'ticker', e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2 uppercase w-1/3" />
                                        <input type="number" placeholder="Shares" value={h.shares} onChange={e => updateHolding(i, 'shares', e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2 w-1/3" />
                                        <input type="number" placeholder="Value (Opt)" value={h.value} onChange={e => updateHolding(i, 'value', e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2 w-1/3" />
                                    </div>
                                ))}
                                <button type="button" onClick={addHoldingRow} className="text-xs text-gold underline">+ Add Holding</button>
                            </div>
                            <select value={backtestB} onChange={e => setBacktestB(e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2 w-full">
                                {['1y', '3y', '5y', '10y'].map(o => <option key={o} value={o}>Backtest: {o}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Code C */}
                    {assessCode === 'C' && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gold"><Settings /> Custom Portfolio Assessment</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input type="text" value={customCodeC} onChange={e => setCustomCodeC(e.target.value)} placeholder="Portfolio Code (from DB)" className="bg-black/50 border border-gray-700 rounded px-4 py-2" />
                                <input type="number" value={valueC} onChange={e => setValueC(e.target.value)} placeholder="Invested Value ($)" className="bg-black/50 border border-gray-700 rounded px-4 py-2" />
                            </div>
                            <select value={backtestC} onChange={e => setBacktestC(e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2 w-full">
                                {['1y', '3y', '5y', '10y'].map(o => <option key={o} value={o}>Backtest: {o}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Code D */}
                    {assessCode === 'D' && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gold"><TrendingUp /> Cultivate Portfolio Risk</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select value={cultivateCodeD} onChange={e => setCultivateCodeD(e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2">
                                    <option value="A">Code A (SPY)</option>
                                    <option value="B">Code B (Market)</option>
                                </select>
                                <input type="number" value={valueD} onChange={e => setValueD(e.target.value)} placeholder="Investment Value ($)" className="bg-black/50 border border-gray-700 rounded px-4 py-2" />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="fracD" checked={fracSharesD} onChange={e => setFracSharesD(e.target.checked)} />
                                <label htmlFor="fracD" className="text-gray-300">Use Fractional Shares</label>
                            </div>
                            <select value={backtestD} onChange={e => setBacktestD(e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2 w-full">
                                {['1y', '3y', '5y', '10y'].map(o => <option key={o} value={o}>Backtest: {o}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Code E */}
                    {assessCode === 'E' && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-gold"><Database /> Portfolio Backtesting</h3>
                            <input type="text" value={portfolioCodeE} onChange={e => setPortfolioCodeE(e.target.value)} placeholder="Portfolio Code" className="bg-black/50 border border-gray-700 rounded px-4 py-2 w-full" />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" value={startDateE} onChange={e => setStartDateE(e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2" />
                                <input type="date" value={endDateE} onChange={e => setEndDateE(e.target.value)} className="bg-black/50 border border-gray-700 rounded px-4 py-2" />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 bg-gradient-to-r from-gold to-yellow-600 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-lg shadow-gold/20 flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <Activity className="animate-spin" /> : <Layers size={20} />}
                        {loading ? 'Processing Assessment...' : 'Run Assessment'}
                    </button>
                </form>

                {error && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-3">
                        <AlertTriangle size={24} />
                        {error}
                    </div>
                )}
            </div>

            {/* Results Display */}
            {result && (
                <div className="bg-black/30 border border-white/5 rounded-2xl p-6 animate-fade-in space-y-4">
                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
                        <FileText className="text-gold" /> Result Analysis
                    </h3>

                    {/* Table Result */}
                    {result && result.type === 'table' ? (
                        renderTable(result)
                    ) : (
                        <div className="prose prose-invert max-w-none">
                            <p className="whitespace-pre-wrap text-gray-300 leading-relaxed text-lg">
                                {typeof result === 'string'
                                    ? result.replace(/\|/g, '\n\n')
                                    : (result.summary || JSON.stringify(result))}
                            </p>
                        </div>
                    )}

                    {/* Graph Result (for Code E) */}
                    {typeof result === 'object' && result.graph && (
                        <div className="mt-6">
                            <h4 className="text-xl font-bold flex items-center gap-2 text-blue-400 mb-2">
                                <TrendingUp size={20} /> Performance Graph
                            </h4>
                            <div className="w-full flex justify-center bg-black/50 rounded-lg p-2 border border-blue-900/30">
                                <img
                                    src={`${API_BASE_URL}/static/${result.graph}`}
                                    alt="Assessment Graph"
                                    className="max-h-[500px] w-auto object-contain rounded"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = "https://via.placeholder.com/800x400?text=Graph+Not+Found";
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Configuration Modal for Missing Portfolio */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-white/10 rounded-xl p-8 max-w-2xl w-full shadow-2xl relative animate-fade-in">
                        <button
                            onClick={() => setShowConfigModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <X size={24} />
                        </button>

                        <h2 className="text-2xl font-bold text-white mb-2">New Portfolio Detected</h2>
                        <p className="text-gray-400 mb-6">
                            The code <span className="text-gold font-bold">{missingPortfolioCode}</span> was not found in your database.
                            Create it now to proceed with assessment.
                        </p>

                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 border border-white/5 rounded-lg p-4 bg-black/30">
                            <PortfolioConfigForm onChange={(f, v) => setNewConfig(prev => ({ ...prev, [f]: v }))} />
                        </div>

                        <div className="mt-8 flex justify-end gap-4">
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="px-6 py-3 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePortfolio}
                                className="px-6 py-3 rounded-lg bg-gold text-black font-bold hover:bg-yellow-500 transition-colors shadow-lg hover:shadow-gold/20 flex items-center gap-2"
                            >
                                {loading ? <Activity className="animate-spin" size={18} /> : <Plus size={18} />} Create & Run
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssessTool;
