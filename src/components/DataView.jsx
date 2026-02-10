
import React from 'react';
import { Copy, Table, Download } from 'lucide-react';

const DataView = ({ data }) => {
    if (!data || data.length === 0) return (
        <div className="p-8 text-center text-gray-500 italic">
            No structured data available for this report.
        </div>
    );

    const handleCopy = () => {
        const headers = ["Ticker", "Quickscore", "ML Forecast", "Beta", "Corr", "IV", "IVR", "AAPC"];
        const rows = data.map(r => [
            r.ticker,
            r.quickscore,
            (r.ml_forecast || []).map(f => `${f.period}: ${f.prediction}`).join("; "),
            r.beta,
            r.correlation,
            r.iv,
            r.ivr,
            r.gap
        ].join("\t"));

        const text = [headers.join("\t"), ...rows].join("\n");
        navigator.clipboard.writeText(text);
        alert("Data copied to clipboard!");
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-700">
                <div className="flex items-center space-x-2 text-cyan-400">
                    <Table size={18} />
                    <span className="font-semibold tracking-wide">SENTINEL DATA MATRIX</span>
                    <span className="text-xs text-gray-500 ml-2">({data.length} Assets)</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition-colors"
                >
                    <Copy size={14} />
                    <span>Copy TSV</span>
                </button>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-800 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700">Asset</th>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 text-right">Quickscore</th>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700">ML Forecasts</th>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 text-right">Beta</th>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 text-right">Corr</th>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 text-right">IV</th>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 text-right">IVR</th>
                            <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 text-right">AAPC</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                                <td className="p-3 text-sm font-medium text-cyan-300">
                                    {row.ticker}
                                    <div className="text-[10px] text-gray-500 font-normal truncate max-w-[120px]">
                                        {row.company_name}
                                    </div>
                                </td>
                                <td className="p-3 text-sm text-right font-mono text-gray-300">
                                    {/* Color code score */}
                                    <span className={
                                        parseFloat(row.quickscore) > 70 ? "text-green-400" :
                                            parseFloat(row.quickscore) < 40 ? "text-red-400" : "text-yellow-400"
                                    }>
                                        {row.quickscore}
                                    </span>
                                </td>
                                <td className="p-3 text-xs text-gray-400 max-w-xs">
                                    <div className="flex flex-wrap gap-1">
                                        {(row.ml_forecast || []).map((f, i) => (
                                            <span key={i} className={`px-1.5 py-0.5 rounded ${f.prediction === 'UP' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                                                {f.period}: {f.prediction} ({f.change})
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-3 text-sm text-right font-mono text-gray-400">{row.beta}</td>
                                <td className="p-3 text-sm text-right font-mono text-gray-400">{row.correlation}</td>
                                <td className="p-3 text-sm text-right font-mono text-gray-400">{row.iv}</td>
                                <td className="p-3 text-sm text-right font-mono text-gray-400">{row.ivr}</td>
                                <td className="p-3 text-sm text-right font-mono text-gray-400">{row.gap}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DataView;
