import React, { useState } from 'react';
import { Search, Activity, AlertTriangle, TrendingUp, ImageIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UpgradePopup from './UpgradePopup';

import MLForecastChart from './MLForecastChart';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const MLForecastTool = () => {
    const { userProfile } = useAuth();
    const [ticker, setTicker] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showUpgradePopup, setShowUpgradePopup] = useState(false);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!ticker.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/mlforecast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.toUpperCase(),
                    email: userProfile?.email || ''
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    setShowUpgradePopup(true);
                    throw new Error(data.detail);
                }
                throw new Error(data.detail || 'Analysis failed');
            }

            // data.results should contain { table: [...], graph: filename, chart_data: {...} }
            setResult(data.results);
            // Track Usage
            import('../services/usageService').then(({ trackUsage }) => trackUsage('ml_forecast'));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <UpgradePopup
                isOpen={showUpgradePopup}
                onClose={() => setShowUpgradePopup(false)}
                featureName="ML Forecast Limit"
            />

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-colors duration-300 hover:border-blue-500/50">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                    <TrendingUp size={24} /> ML Forecast
                </h2>
                <p className="text-gray-400 mb-6">
                    Use machine learning (Random Forest) to forecast price movements across multiple time horizons (5-Day to 1-Year).
                </p>

                <form onSubmit={handleAnalyze} className="flex gap-4">
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        placeholder="Enter Ticker (e.g. TSLA)"
                        className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 uppercase font-mono tracking-wider"
                    />
                    <button
                        type="submit"
                        disabled={loading || !ticker}
                        className={`px-8 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <Activity className="animate-spin" /> : <Search size={20} />}
                        {loading ? 'Running AI Model...' : 'Forecast'}
                    </button>
                </form>

                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        {error}
                    </div>
                )}
            </div>

            {result && (
                <div className="space-y-8 animate-fade-in">
                    {/* Forecast Table */}
                    {result.table && result.table.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-blue-300">Forecast Models Summary</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-700 text-gray-400 text-sm">
                                            <th className="p-3">Period</th>
                                            <th className="p-3">Prediction</th>
                                            <th className="p-3">Confidence</th>
                                            <th className="p-3">Est. Change</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.table.map((row, idx) => (
                                            <tr key={idx} className="border-b border-gray-800 hover:bg-white/5 font-mono">
                                                <td className="p-3 text-blue-200">{row.Period}</td>
                                                <td className={`p-3 font-bold ${row.Prediction === 'UP' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {row.Prediction}
                                                </td>
                                                <td className="p-3 text-white">{row.Confidence}</td>
                                                <td className={`p-3 ${row['Est. % Change'].includes('+') ? 'text-green-400' : 'text-red-400'}`}>
                                                    {row['Est. % Change']}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Interactive Forecast Chart */}
                    {result.chart_data ? (
                        <MLForecastChart
                            historicalData={result.chart_data.historical}
                            forecastData={result.chart_data.forecast}
                            anchors={result.chart_data.anchors}
                        />
                    ) : (
                        // Fallback to static image if chart_data is missing (legacy)
                        result.graph && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-4 text-blue-300 flex items-center gap-2">
                                    <ImageIcon size={20} /> Advanced Forecast Visualization (Static)
                                </h3>
                                <div className="w-full flex justify-center bg-black/50 rounded-lg p-2 border border-blue-900/30">
                                    <img
                                        src={`${API_BASE_URL}/static/${result.graph}`}
                                        alt="ML Forecast Graph"
                                        className="max-h-[500px] w-auto object-contain rounded"
                                    />
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};
export default MLForecastTool;
