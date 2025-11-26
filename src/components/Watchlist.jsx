import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, Plus, Search, GripVertical, X, ChevronDown, ChevronUp, Check, RefreshCw, Trash2, Maximize2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Initialize with STRINGS, not objects
const INITIAL_TICKERS = ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'PLUG'];

const AVAILABLE_COLUMNS = [
    { id: 'price', label: 'Price' },
    { id: 'trend', label: 'Trend' },
    { id: 'change', label: '1D %' },
    { id: 'marketCap', label: 'Market Cap' },
    { id: 'volume', label: 'Volume' },
];

const DEFAULT_COLUMNS = [
    AVAILABLE_COLUMNS[0], // Price
    AVAILABLE_COLUMNS[2], // 1D %
    AVAILABLE_COLUMNS[3], // Market Cap
];

// --- Helpers ---

const parseValue = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return -Infinity;

    const v = val.trim().toUpperCase();
    const multiplier = { 'T': 1e12, 'B': 1e9, 'M': 1e6, 'K': 1e3, '%': 1 };

    const suffix = v.slice(-1);
    const num = parseFloat(v);

    if (isNaN(num)) return -Infinity;
    if (multiplier[suffix]) return num * multiplier[suffix];

    return num;
};

// --- Sub-Components ---

const TradingViewWidget = ({ ticker }) => {
    const container = useRef();

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            if (window.TradingView) {
                new window.TradingView.widget({
                    "width": "100%",
                    "height": "100%",
                    "symbol": ticker,
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": "dark",
                    "style": "1", // 1 = Candles
                    "locale": "en",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "allow_symbol_change": true,
                    "container_id": `tradingview_${ticker}`
                });
            }
        };

        // Append script
        if (container.current) {
            container.current.innerHTML = "";
            const div = document.createElement("div");
            div.id = `tradingview_${ticker}`;
            div.style.height = "100%";
            container.current.appendChild(div);
            container.current.appendChild(script);
        }
    }, [ticker]);

    return <div ref={container} className="w-full h-full min-h-[500px]" />;
};

const Sparkline = ({ data, isPositive }) => {
    if (!data || data.length < 2) return <div className="w-[100px] h-[30px] opacity-20 bg-gray-700/10 rounded"></div>;

    const width = 100;
    const height = 30;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const color = isPositive ? "#10B981" : "#EF4444";

    return (
        <svg width={width} height={height} className="overflow-visible">
            <path
                d={`M ${points}`}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

const SortableHeader = ({ column, onToggle, isEditing, sortConfig, onSort }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isEditing ? 'grab' : 'pointer'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`flex items-center gap-1 select-none px-2 py-1 rounded transition-colors ${isEditing ? 'bg-white/5 border border-white/10' : 'hover:text-gold'}`}
            onClick={(e) => {
                if (!isEditing) onSort(column.id);
            }}
        >
            {isEditing && (
                <button onClick={(e) => { e.stopPropagation(); onToggle(column); }} className="mr-1 text-red-400 hover:text-red-300">
                    <X size={12} />
                </button>
            )}
            <span className="font-bold text-xs uppercase tracking-wider">{column.label}</span>
            {!isEditing && sortConfig.key === column.id && (
                sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-gold" /> : <ChevronDown size={14} className="text-gold" />
            )}
        </div>
    );
};

const SortableRow = ({ ticker, columns, onDelete, data, onSelect }) => {
    const tickerId = typeof ticker === 'string' ? ticker : (ticker?.symbol || 'UNKNOWN');
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tickerId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    const rowData = data[tickerId] || {};
    const change = rowData.change !== undefined ? rowData.change : 0;
    const isPositive = parseFloat(change) >= 0;
    const name = rowData.name || tickerId;

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, gridTemplateColumns: `40px 120px ${columns.map(() => '1fr').join(' ')} 40px` }}
            className="grid items-center gap-4 p-4 bg-white/5 border-b border-white/5 hover:bg-white/10 transition-colors group"
        >
            <div {...attributes} {...listeners} className="cursor-grab text-gray-600 hover:text-gold">
                <GripVertical size={18} />
            </div>

            <div>
                <button
                    onClick={() => onSelect(tickerId)}
                    className="font-bold text-white hover:text-blue-400 hover:underline text-left"
                >
                    {tickerId}
                </button>
                <div className="text-xs text-gray-500 truncate max-w-[100px]" title={name}>{name}</div>
            </div>

            {columns.map((col) => {
                if (col.id === 'trend') {
                    return (
                        <div key={col.id} className="flex items-center justify-start h-full">
                            <Sparkline data={rowData.sparkline} isPositive={isPositive} />
                        </div>
                    );
                }

                const val = rowData[col.id];
                let displayVal = val !== undefined ? val : '-';
                let colorClass = 'text-gray-300';

                if (col.id === 'price') {
                    const numVal = parseFloat(val);
                    if (!isNaN(numVal)) displayVal = `$${numVal.toFixed(2)}`;
                    colorClass = isPositive ? 'text-green-400' : 'text-red-400';
                } else if (col.id.includes('change') || col.id.includes('Change')) {
                    const numVal = parseFloat(val);
                    if (!isNaN(numVal)) {
                        displayVal = `${numVal > 0 ? '+' : ''}${numVal.toFixed(2)}%`;
                        colorClass = numVal > 0 ? 'text-green-400' : (numVal < 0 ? 'text-red-400' : 'text-gray-300');
                    }
                }

                return (
                    <div key={col.id} className={`text-sm font-medium truncate ${colorClass}`}>
                        {displayVal}
                    </div>
                );
            })}

            <button
                onClick={(e) => { e.stopPropagation(); onDelete(tickerId); }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-all p-2 rounded-full hover:bg-red-500/10"
            >
                <Trash2 size={18} />
            </button>
        </div>
    );
};

// --- Main Component ---

const Watchlist = () => {
    const { currentUser } = useAuth();

    // State
    const [watchlistName, setWatchlistName] = useState("My Watchlist");
    const [tickers, setTickers] = useState(INITIAL_TICKERS);
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
    const [marketData, setMarketData] = useState({});
    const [isLoadingData, setIsLoadingData] = useState(false);

    // UI State
    const [isEditingName, setIsEditingName] = useState(false);
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
    const [isEditingColumns, setIsEditingColumns] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [selectedTicker, setSelectedTicker] = useState(null); // For TradingView Modal

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // --- Persistence ---

    // Load Watchlist
    useEffect(() => {
        if (!currentUser) return;
        const fetchWatchlist = async () => {
            try {
                const docRef = doc(db, "users", currentUser.uid, "watchlists", "default");
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.name) setWatchlistName(data.name);

                    if (data.tickers && Array.isArray(data.tickers)) {
                        const cleanTickers = data.tickers.map(t =>
                            typeof t === 'string' ? t : (t.id || t.symbol || '')
                        ).filter(Boolean);

                        setTickers([...new Set(cleanTickers)]);
                    }

                    if (data.columns) setVisibleColumns(data.columns);

                    // Restore Sort Configuration
                    if (data.sortConfig) {
                        setSortConfig(data.sortConfig);
                    }
                }
            } catch (e) {
                console.error("Error loading watchlist:", e);
            }
        };
        fetchWatchlist();
    }, [currentUser]);

    // Save Watchlist (Debounced)
    useEffect(() => {
        if (!currentUser) return;
        const timeoutId = setTimeout(async () => {
            try {
                const docRef = doc(db, "users", currentUser.uid, "watchlists", "default");
                await setDoc(docRef, {
                    name: watchlistName,
                    tickers,
                    columns: visibleColumns,
                    sortConfig, // Saving sort preferences
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (e) {
                console.error("Error saving watchlist:", e);
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [watchlistName, tickers, visibleColumns, sortConfig, currentUser]);

    // --- Data Fetching ---

    const fetchChunk = async (chunk) => {
        try {
            const response = await fetch('http://localhost:8001/api/market-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers: chunk })
            });
            const data = await response.json();

            if (Array.isArray(data)) {
                const newMarketData = {};
                data.forEach(item => {
                    newMarketData[item.ticker] = item;
                });
                setMarketData(prev => ({ ...prev, ...newMarketData }));
            }
        } catch (error) {
            console.error("Failed to fetch chunk:", chunk, error);
        }
    };

    const fetchMarketData = useCallback(async () => {
        if (tickers.length === 0) return;
        setIsLoadingData(true);

        const chunkSize = 3;
        const chunks = [];
        for (let i = 0; i < tickers.length; i += chunkSize) {
            chunks.push(tickers.slice(i, i + chunkSize));
        }

        for (const chunk of chunks) {
            await fetchChunk(chunk);
        }

        setIsLoadingData(false);
    }, [tickers]);

    useEffect(() => {
        fetchMarketData();
        const interval = setInterval(fetchMarketData, 30000);
        return () => clearInterval(interval);
    }, [fetchMarketData]);

    // --- Handlers ---

    const handleSort = (columnId) => {
        setSortConfig(prev => {
            if (prev.key === columnId) {
                if (prev.direction === 'asc') return { key: columnId, direction: 'desc' };
                if (prev.direction === 'desc') return { key: null, direction: null };
            }
            return { key: columnId, direction: 'asc' };
        });
    };

    const sortedTickers = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return tickers;

        return [...tickers].sort((a, b) => {
            const dataA = marketData[a] || {};
            const dataB = marketData[b] || {};

            const valA = parseValue(dataA[sortConfig.key]);
            const valB = parseValue(dataB[sortConfig.key]);

            if (valA === valB) return 0;

            const comparison = valA > valB ? 1 : -1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [tickers, marketData, sortConfig]);

    const handleAddTicker = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        const symbol = searchQuery.toUpperCase().trim();

        if (!tickers.includes(symbol)) {
            const newTickers = [...tickers, symbol];
            setTickers(newTickers);
            // Optimistic update then fetch
            setIsLoadingData(true);
            await fetchChunk([symbol]);
            setIsLoadingData(false);
        }
        setSearchQuery('');
        setIsAddOpen(false);
    };

    const removeTicker = (symbol) => {
        setTickers(prev => prev.filter(t => t !== symbol));
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;

        if (visibleColumns.some(c => c.id === active.id)) {
            if (active.id !== over.id) {
                setVisibleColumns((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    return arrayMove(items, oldIndex, newIndex);
                });
            }
        }
        else if (!sortConfig.key) {
            if (active.id !== over.id) {
                setTickers((items) => {
                    const oldIndex = items.indexOf(active.id);
                    const newIndex = items.indexOf(over.id);
                    return arrayMove(items, oldIndex, newIndex);
                });
            }
        }
    };

    const toggleColumn = (col) => {
        if (visibleColumns.find(c => c.id === col.id)) {
            setVisibleColumns(prev => prev.filter(c => c.id !== col.id));
        } else {
            setVisibleColumns(prev => [...prev, col]);
        }
    };

    return (
        <section className="py-12 px-4 bg-deep-black">
            {/* Modal for TradingView */}
            {selectedTicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-5xl h-[80vh] bg-[#151515] rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-[#0A0A0A]">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {selectedTicker} <span className="text-gray-500 text-sm">Interactive Chart</span>
                            </h3>
                            <button
                                onClick={() => setSelectedTicker(null)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-grow bg-[#151515]">
                            <TradingViewWidget ticker={selectedTicker} />
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-white/5 to-transparent">
                        <div className="flex items-center gap-4">
                            {isEditingName ? (
                                <form onSubmit={(e) => { e.preventDefault(); setIsEditingName(false); }}>
                                    <input
                                        autoFocus
                                        className="bg-transparent text-2xl font-bold text-gold border-b border-gold outline-none"
                                        value={watchlistName}
                                        onChange={(e) => setWatchlistName(e.target.value)}
                                        onBlur={() => setIsEditingName(false)}
                                    />
                                </form>
                            ) : (
                                <h2
                                    className="text-2xl font-bold text-gold cursor-pointer hover:text-white transition-colors"
                                    onDoubleClick={() => setIsEditingName(true)}
                                    title="Double click to rename"
                                >
                                    {watchlistName}
                                </h2>
                            )}
                            <button
                                onClick={fetchMarketData}
                                className={`p-2 rounded-full hover:bg-white/10 transition-all ${isLoadingData ? 'animate-spin text-gold' : 'text-gray-500 hover:text-white'}`}
                                title="Refresh Data"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        {/* Column Manager */}
                        <div className="relative">
                            <button
                                onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                                className={`p-2 rounded-lg transition-all ${isColumnMenuOpen ? 'bg-gold text-black' : 'hover:bg-white/10 text-gray-400'}`}
                            >
                                <MoreVertical size={20} />
                            </button>

                            {isColumnMenuOpen && (
                                <div className="absolute right-0 top-12 w-56 bg-[#151515] border border-white/10 rounded-xl shadow-2xl z-50 p-2">
                                    <div className="flex justify-between items-center px-3 py-2 mb-2 border-b border-white/10">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Columns</span>
                                        <button
                                            onClick={() => setIsEditingColumns(!isEditingColumns)}
                                            className={`text-xs ${isEditingColumns ? 'text-gold' : 'text-blue-400 hover:text-blue-300'}`}
                                        >
                                            {isEditingColumns ? 'Done' : 'Edit'}
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                        {AVAILABLE_COLUMNS.map(col => (
                                            <button
                                                key={col.id}
                                                onClick={() => toggleColumn(col)}
                                                className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-white/5 text-sm text-gray-300"
                                            >
                                                <span>{col.label}</span>
                                                {visibleColumns.find(c => c.id === col.id) && <Check size={14} className="text-gold" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="overflow-x-auto custom-scrollbar">
                            <div className="min-w-[800px]">
                                {/* Table Head */}
                                <div
                                    className="grid gap-4 p-4 bg-white/5 border-b border-white/10 text-xs font-bold text-gray-500 uppercase tracking-wider"
                                    style={{ gridTemplateColumns: `40px 120px ${visibleColumns.map(() => '1fr').join(' ')} 40px` }}
                                >
                                    <div></div>
                                    <div>Ticker</div>
                                    <SortableContext
                                        items={visibleColumns.map(c => c.id)}
                                        strategy={horizontalListSortingStrategy}
                                    >
                                        {visibleColumns.map(col => (
                                            <SortableHeader
                                                key={col.id}
                                                column={col}
                                                isEditing={isEditingColumns}
                                                onToggle={toggleColumn}
                                                sortConfig={sortConfig}
                                                onSort={handleSort}
                                            />
                                        ))}
                                    </SortableContext>
                                    <div></div>
                                </div>

                                {/* Table Body */}
                                <SortableContext
                                    items={sortedTickers}
                                    strategy={verticalListSortingStrategy}
                                    disabled={!!sortConfig.key}
                                >
                                    <div className="divide-y divide-white/5">
                                        {sortedTickers.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500">No tickers in watchlist. Add one below.</div>
                                        ) : (
                                            sortedTickers.map(ticker => (
                                                <SortableRow
                                                    key={ticker}
                                                    ticker={ticker}
                                                    data={marketData}
                                                    columns={visibleColumns}
                                                    onDelete={removeTicker}
                                                    onSelect={setSelectedTicker}
                                                />
                                            ))
                                        )}
                                    </div>
                                </SortableContext>
                            </div>
                        </div>
                    </DndContext>

                    {/* Footer Input */}
                    <div className="p-4 bg-white/5 border-t border-white/10">
                        {isAddOpen ? (
                            <form onSubmit={handleAddTicker} className="flex items-center gap-3 bg-black/50 border border-gold/30 rounded-lg px-4 py-2 max-w-md mx-auto">
                                <Search size={18} className="text-gold" />
                                <input
                                    autoFocus
                                    className="bg-transparent flex-grow outline-none text-white placeholder-gray-500 uppercase"
                                    placeholder="Symbol (e.g. AAPL)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onBlur={() => !searchQuery && setIsAddOpen(false)}
                                />
                                <button type="submit" className="text-xs font-bold bg-gold text-black px-3 py-1 rounded hover:bg-yellow-500">
                                    ADD
                                </button>
                            </form>
                        ) : (
                            <button
                                onClick={() => setIsAddOpen(true)}
                                className="w-full py-2 flex items-center justify-center gap-2 text-gray-500 hover:text-gold transition-colors border border-dashed border-gray-800 hover:border-gold/30 rounded-lg"
                            >
                                <Plus size={18} /> Add Ticker
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Watchlist;