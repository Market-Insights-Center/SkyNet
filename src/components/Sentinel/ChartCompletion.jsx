
import React, { useState, useRef, useMemo } from 'react';
import { Sparkles, Upload, Plus, Trash2, Copy, Check, Table, Play, AlertCircle, ArrowUpDown, Download } from 'lucide-react';

const ANALYSIS_OPTIONS = [
    { group: "QuickScore", label: "QuickScore 5y (Weekly)", value: "QS 1" },
    { group: "QuickScore", label: "QuickScore 1y (Daily)", value: "QS 2" },
    { group: "QuickScore", label: "QuickScore 6mo (Hourly)", value: "QS 3" },

    { group: "Sentiment", label: "Sentiment Score", value: "Sentiment" },

    { group: "ML Forecast", label: "ML Forecast 5 Day", value: "MLF 1" },
    { group: "ML Forecast", label: "ML Forecast 1 Month", value: "MLF 2" },
    { group: "ML Forecast", label: "ML Forecast 3 Month", value: "MLF 3" },
    { group: "ML Forecast", label: "ML Forecast 6 Month", value: "MLF 4" },
    { group: "ML Forecast", label: "ML Forecast 1 Year", value: "MLF 5" },

    { group: "Assess A", label: "Assess A Beta", value: "Assess A Beta" },
    { group: "Assess A", label: "Assess A Correlation", value: "Assess A Correlation" },
    { group: "Assess A", label: "Assess A AAPC", value: "Assess A AAPC" },
    { group: "Assess A", label: "Assess A IV", value: "Assess A IV" },
    { group: "Assess A", label: "Assess A IV Rank", value: "Assess A IVR" },
];

const ChartCompletion = () => {
    const [mode, setMode] = useState('manual');
    const [tickers, setTickers] = useState([]);
    const [columns, setColumns] = useState([]);
    const [results, setResults] = useState(null); // { headers: [], rows: [] }
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Progress State
    const [progress, setProgress] = useState({ current: 0, total: 0, startTime: 0, eta: null });
    const [processingTicker, setProcessingTicker] = useState(null);

    const fileInputRef = useRef(null);
    const [copySuccess, setCopySuccess] = useState(false);

    // --- CSV Handling ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row.");

                const headers = lines[0].split(',').map(h => h.trim());
                const newColumns = headers.slice(1);
                const newTickers = [];



                const NORMALIZE_MAP = {
                    // QuickScore
                    "QS 1": "QS 1", "QS1": "QS 1", "QUICKSCORE 5Y": "QS 1",
                    "QS 2": "QS 2", "QS2": "QS 2", "QUICKSCORE 1Y": "QS 2",
                    "QS 3": "QS 3", "QS3": "QS 3", "QUICKSCORE 6MO": "QS 3",

                    // Sentiment
                    "S": "Sentiment", "SENTIMENT": "Sentiment",

                    // ML Forecast
                    "MLF 1": "MLF 1", "ML FORECAST 5D": "MLF 1",
                    "MLF 2": "MLF 2", "ML FORECAST 1MO": "MLF 2",
                    "MLF 3": "MLF 3", "ML FORECAST 3MO": "MLF 3",
                    "MLF 4": "MLF 4", "ML FORECAST 6MO": "MLF 4",
                    "MLF 5": "MLF 5", "ML FORECAST 1Y": "MLF 5",

                    // Assess A
                    "AA B": "Assess A Beta", "BETA": "Assess A Beta",
                    "AA C": "Assess A Correlation", "CORR": "Assess A Correlation",
                    "AA AAPC": "Assess A AAPC", "AAPC": "Assess A AAPC",
                    "AA IV": "Assess A IV", "IV": "Assess A IV",
                    "AA IVR": "Assess A IVR", "IVR": "Assess A IVR"
                };

                const normalizeHeader = (h) => {
                    const upper = h.toUpperCase().replace(/\s+/g, ' ').trim();
                    for (const [key, value] of Object.entries(NORMALIZE_MAP)) {
                        if (key === upper) return value;
                    }
                    return h;
                };

                const cleanColumns = newColumns.map(c => normalizeHeader(c));

                // Populate Results with Existing Data
                const rows = [];
                const seenTickers = new Set();

                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split(',');
                    const ticker = parts[0]?.trim()?.toUpperCase();
                    if (!ticker) continue;

                    if (seenTickers.has(ticker)) continue; // Skip duplicate in CSV
                    seenTickers.add(ticker);

                    newTickers.push(ticker);

                    const rowData = { ticker };
                    // Map parts to columns
                    cleanColumns.forEach((col, idx) => {
                        // parts[0] is ticker, so data starts at parts[1]
                        const val = parts[idx + 1]?.trim();
                        // Treat empty or "..." or "N/A" as missing/to-do? 
                        // User said "use those values... just pick up where it was left off".
                        // So keep "N/A" if it was a final result? Or retry it?
                        // Let's assume if it has a value (not empty string), we keep it.
                        if (val && val !== "") {
                            rowData[col] = val;
                        } else {
                            rowData[col] = "..."; // Mark as pending
                        }
                    });
                    rows.push(rowData);
                }

                setTickers(newTickers);
                setColumns(cleanColumns.map(c => ({ value: c, label: c }))); // Simple map
                setResults({
                    headers: cleanColumns,
                    rows: rows
                });

                setMode('manual');
                setError(null);
            } catch (err) {
                console.error(err);
                setError(`Failed to parse CSV: ${err.message}`);
            }
        };
        reader.readAsText(file);
    };

    // --- Manual Table Logic ---
    const addTicker = () => setTickers([...tickers, ""]);
    const updateTicker = (idx, val) => {
        const newTickers = [...tickers];
        newTickers[idx] = val.toUpperCase();
        setTickers(newTickers);
    };
    const removeTicker = (idx) => setTickers(tickers.filter((_, i) => i !== idx));

    const addColumn = (selectedValue) => {
        if (!selectedValue) return;
        setColumns([...columns, { id: Date.now(), value: selectedValue }]);
    };
    const removeColumn = (id) => setColumns(columns.filter(c => c.id !== id));

    // --- API & Streaming Logic ---
    const runAnalysis = async () => {
        setIsLoading(true);
        setError(null);

        // Deduplicate and clean tickers (normalize to UpperCase)
        const cleanTickers = [...new Set(tickers.map(t => t.trim().toUpperCase()).filter(t => t !== ""))];
        const cleanColumns = columns.map(c => c.value);

        if (cleanTickers.length === 0) { setError("Please add at least one ticker."); setIsLoading(false); return; }
        if (cleanColumns.length === 0) { setError("Please select at least one analysis column."); setIsLoading(false); return; }

        // Initialize Data (Merge with existing if available)
        const existingRows = results?.rows || [];

        const mergedRows = cleanTickers.map(t => {
            const existingRow = existingRows.find(r => r.ticker === t) || {};
            const newRow = { ticker: t };

            cleanColumns.forEach(c => {
                // Keep existing value if valid, otherwise pending "..."
                if (existingRow[c] && existingRow[c] !== "..." && existingRow[c] !== "") {
                    newRow[c] = existingRow[c];
                } else {
                    newRow[c] = "...";
                }
            });
            return newRow;
        });

        // Determine which tickers actually need processing (any "..." in their row)
        // This allows "picking up where we left off" for partial rows or fully missing rows.
        // Note: This effectively re-runs the whole row for the selected columns if even one cell is missing,
        // which matches the backend's batching logic.
        const tickersToRun = mergedRows.filter(row => {
            return cleanColumns.some(c => row[c] === "...");
        }).map(row => row.ticker);

        setResults({
            headers: cleanColumns,
            rows: mergedRows
        });

        if (tickersToRun.length === 0) {
            setIsLoading(false);
            return;
        }

        // Initialize Progress
        setProgress({ current: 0, total: 0, startTime: Date.now(), eta: null });

        try {
            const response = await fetch('http://localhost:8000/api/chart-completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers: tickersToRun, columns: cleanColumns })
            });

            if (!response.ok) throw new Error("Connection failed.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        handleStreamEvent(event);
                    } catch (e) {
                        console.error("Parse error", e);
                    }
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setProcessingTicker(null);
        }
    };

    const handleStreamEvent = (event) => {
        if (event.type === 'start') {
            setProgress(prev => ({ ...prev, total: event.total_cells, startTime: Date.now() }));
        } else if (event.type === 'row_start') {
            setProcessingTicker(event.ticker);
        } else if (event.type === 'update') {
            // Update Data
            setResults(prev => {
                const newRows = prev.rows.map(row => {
                    if (row.ticker === event.ticker) {
                        return { ...row, [event.col_id]: event.value };
                    }
                    return row;
                });
                return { ...prev, rows: newRows };
            });

            // Update Progress & ETA
            setProgress(prev => {
                const newCurrent = prev.current + 1;
                const elapsed = (Date.now() - prev.startTime) / 1000; // seconds
                // Simple linear extrapolation
                let newEta = null;
                if (newCurrent > 0 && elapsed > 1) {
                    const rate = newCurrent / elapsed; // cells per second
                    const remaining = prev.total - newCurrent;
                    if (remaining > 0) {
                        newEta = remaining / rate;
                    } else {
                        newEta = 0;
                    }
                }
                return { ...prev, current: newCurrent, eta: newEta };
            });

        } else if (event.type === 'done') {
            setProcessingTicker(null);
            setProgress(prev => ({ ...prev, eta: 0 }));
        } else if (event.type === 'error') {
            console.error("Stream Error:", event.message);
        }
    };

    // --- Sorting Logic ---
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRows = useMemo(() => {
        if (!results) return [];
        const rows = [...results.rows];
        if (sortConfig.key) {
            rows.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                // Handle "..." and "N/A"
                if (valA === "..." || valA === "N/A") return 1;
                if (valB === "..." || valB === "N/A") return -1;

                // Try numeric sort
                const numA = parseFloat(valA?.replace(/[%$]/g, ''));
                const numB = parseFloat(valB?.replace(/[%$]/g, ''));

                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
                }

                // String sort
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return rows;
    }, [results, sortConfig]);

    // --- Utilities ---
    const copyToClipboard = () => {
        if (!results) return;
        let text = `Ticker\t${results.headers.join('\t')}\n`;
        sortedRows.forEach(row => {
            text += `${row.ticker}`;
            results.headers.forEach(h => {
                text += `\t${row[h] || ""}`;
            });
            text += '\n';
        });

        navigator.clipboard.writeText(text).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const downloadCSV = () => {
        if (!results) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `Ticker,${results.headers.join(',')}\n`;

        sortedRows.forEach(row => {
            const rowStr = [row.ticker, ...results.headers.map(h => row[h] || "")].join(",");
            csvContent += rowStr + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "chart_analysis.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 shadow-2xl w-full max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Table className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Chart Completion</h2>
                        <p className="text-sm text-gray-400">Fill data matrices using Sentinel's analytical engine</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-all"
                    >
                        <Upload size={16} /> Load CSV
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </button>
                    <button
                        onClick={() => { setTickers([]); setColumns([]); setResults(null); }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-red-900/30 text-gray-300 hover:text-red-400 rounded-lg text-sm transition-all"
                    >
                        <Trash2 size={16} /> Clear All
                    </button>
                </div>
            </div>


            {/* Config Area - Hidden when results are showing to save space? Optional. Keeping visible for now. */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Tickers Column */}
                <div className="bg-black/40 rounded-lg p-4 border border-gray-800 col-span-1 flex flex-col h-80">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Tickers</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {tickers.map((t, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input
                                    value={t}
                                    onChange={(e) => updateTicker(idx, e.target.value)}
                                    placeholder="TICKER"
                                    className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-1 text-sm focus:border-purple-500 focus:outline-none uppercase"
                                />
                                <button onClick={() => removeTicker(idx)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={addTicker} className="w-full py-2 border border-dashed border-gray-700 text-gray-500 hover:text-purple-400 hover:border-purple-500/50 rounded flex items-center justify-center gap-2 text-sm transition-colors">
                            <Plus size={14} /> Add Ticker
                        </button>
                    </div>
                </div>

                {/* Columns Config */}
                <div className="bg-black/40 rounded-lg p-4 border border-gray-800 col-span-1 lg:col-span-3 flex flex-col h-80">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Analysis Columns</h3>

                    {/* Column Selection Dropdown */}
                    <div className="mb-4 flex gap-2">
                        <select
                            id="col-select"
                            className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 text-sm focus:border-purple-500 focus:outline-none"
                            defaultValue=""
                            onChange={(e) => {
                                if (e.target.value) {
                                    addColumn(e.target.value);
                                    e.target.value = ""; // reset
                                }
                            }}
                        >
                            <option value="" disabled>+ Add Analysis Column...</option>
                            {/* Group options */}
                            {["QuickScore", "Sentiment", "ML Forecast", "Assess A"].map(group => (
                                <optgroup key={group} label={group}>
                                    {ANALYSIS_OPTIONS.filter(o => o.group === group).map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Selected Columns List (Horizontal Cards) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {columns.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-lg">
                                <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm text-center">Add columns to build your matrix</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 text-sm">
                                {columns.map((col, idx) => {
                                    const opt = ANALYSIS_OPTIONS.find(o => o.value === col.value) || { label: col.value };
                                    return (
                                        <div key={col.id} className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg text-gray-200 group hover:border-purple-500/30 transition-colors">
                                            <span className="font-mono text-xs text-gray-500 mr-1">{idx + 1}</span>
                                            {opt.label}
                                            <button onClick={() => removeColumn(col.id)} className="ml-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between bg-black/20 p-4 rounded-lg border border-gray-800 mb-8">
                <div className="text-sm text-gray-400">
                    <span className="text-white font-mono">{tickers.length}</span> Tickers × <span className="text-white font-mono">{columns.length}</span> Columns
                </div>
                <button
                    onClick={runAnalysis}
                    disabled={isLoading || tickers.length === 0 || columns.length === 0}
                    className={`
                        flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-all
                        ${isLoading || tickers.length === 0 || columns.length === 0
                            ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-500/25'}
                    `}
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Play size={18} fill="currentColor" /> Run Auto-Complete
                        </>
                    )}
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Results Grid */}
            {results && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Generated Data Matrix</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={downloadCSV}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors border border-gray-700"
                            >
                                <Download size={14} /> CSV
                            </button>
                            <button
                                onClick={copyToClipboard}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors border border-gray-700"
                            >
                                {copySuccess ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                {copySuccess ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>



                    {/* Progress Bar */}
                    {isLoading && progress.total > 0 && (
                        <div className="mb-4 bg-gray-800 rounded-lg p-3 border border-gray-700">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Processing... {processingTicker && `(${processingTicker})`}</span>
                                <span>{Math.round((progress.current / progress.total) * 100)}% {progress.eta !== null && `• ~${Math.ceil(progress.eta)}s remaining`}</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${Math.min((progress.current / progress.total) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="block w-full max-w-[85vw] lg:max-w-[92vw] 2xl:max-w-[85vw] h-[calc(100vh-320px)] overflow-y-auto overflow-x-auto rounded-lg border border-gray-700 bg-black/60 shadow-inner pb-2 custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse min-w-max">
                            <thead>
                                <tr className="bg-gray-800/50 text-gray-400 border-b border-gray-700">
                                    <th
                                        className="p-2 font-medium uppercase tracking-wider text-[10px] border-r border-gray-700/50 sticky left-0 bg-gray-900 z-10 w-20 cursor-pointer hover:text-white whitespace-nowrap"
                                        onClick={() => handleSort('ticker')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Ticker
                                            {sortConfig.key === 'ticker' && <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'rotate-0' : 'rotate-180'} />}
                                        </div>
                                    </th>
                                    {results.headers.map((h, i) => (
                                        <th
                                            key={i}
                                            className="p-2 font-medium uppercase tracking-wider text-[10px] border-r border-gray-700/50 whitespace-nowrap cursor-pointer hover:text-white"
                                            onClick={() => handleSort(h)}
                                        >
                                            <div className="flex items-center gap-1">
                                                {ANALYSIS_OPTIONS.find(o => o.value === h)?.label || h}
                                                {sortConfig.key === h && <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'rotate-0' : 'rotate-180'} />}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((row, rIdx) => (
                                    <tr key={rIdx} className="border-b border-gray-800 hover:bg-white/5 transition-colors group">
                                        <td className="p-2 font-mono text-blue-400 font-bold border-r border-gray-700/50 sticky left-0 bg-gray-900 group-hover:bg-gray-800 transition-colors">
                                            {row.ticker}
                                        </td>
                                        {results.headers.map((h, cIdx) => (
                                            <td key={cIdx} className="p-2 text-gray-300 border-r border-gray-700/50 whitespace-nowrap">
                                                {row[h] === "..." ? (
                                                    <span className="text-gray-600 animate-pulse">...</span>
                                                ) : (
                                                    <span className="animate-in fade-in duration-300">{row[h]}</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartCompletion;
